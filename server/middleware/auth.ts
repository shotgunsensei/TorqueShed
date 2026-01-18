import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { storage } from "../storage";

export interface AuthenticatedRequest extends Request {
  userId?: string;
  userRole?: string;
}

interface JWTPayload {
  sub: string;
  email?: string;
  role?: string;
  exp?: number;
  iat?: number;
}

function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") {
    return null;
  }
  
  return parts[1];
}

function verifyJWT(token: string): JWTPayload | null {
  const secret = process.env.SUPABASE_JWT_SECRET;
  
  if (!secret) {
    console.error(JSON.stringify({
      type: "auth_error",
      message: "SUPABASE_JWT_SECRET not configured",
      timestamp: new Date().toISOString(),
    }));
    return null;
  }

  try {
    const decoded = jwt.verify(token, secret, {
      algorithms: ["HS256"],
    }) as JWTPayload;

    if (!decoded.sub) {
      return null;
    }

    return decoded;
  } catch (error) {
    const err = error as Error;
    console.error(JSON.stringify({
      type: "jwt_verification_failed",
      message: err.message,
      timestamp: new Date().toISOString(),
    }));
    return null;
  }
}

export function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const token = extractToken(req);

  if (!token) {
    res.status(401).json({ 
      error: "Unauthorized", 
      message: "Missing or invalid Authorization header. Expected: Bearer <token>" 
    });
    return;
  }

  const payload = verifyJWT(token);

  if (!payload) {
    res.status(401).json({ 
      error: "Unauthorized", 
      message: "Invalid or expired token" 
    });
    return;
  }

  req.userId = payload.sub;
  next();
}

export async function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const token = extractToken(req);

  if (!token) {
    res.status(401).json({ 
      error: "Unauthorized", 
      message: "Missing or invalid Authorization header. Expected: Bearer <token>" 
    });
    return;
  }

  const payload = verifyJWT(token);

  if (!payload) {
    res.status(401).json({ 
      error: "Unauthorized", 
      message: "Invalid or expired token" 
    });
    return;
  }

  const userId = payload.sub;
  req.userId = userId;

  try {
    const user = await storage.getUser(userId);
    
    if (!user) {
      res.status(401).json({ 
        error: "Unauthorized", 
        message: "User not found" 
      });
      return;
    }

    if (user.role !== "admin") {
      console.error(JSON.stringify({
        type: "admin_access_denied",
        userId,
        userRole: user.role,
        path: req.path,
        method: req.method,
        timestamp: new Date().toISOString(),
      }));
      
      res.status(403).json({ 
        error: "Forbidden", 
        message: "Admin access required" 
      });
      return;
    }

    req.userRole = user.role;
    next();
  } catch (error) {
    console.error(JSON.stringify({
      type: "admin_check_error",
      userId,
      error: (error as Error).message,
      timestamp: new Date().toISOString(),
    }));
    
    res.status(500).json({ 
      error: "Internal Server Error", 
      message: "Failed to verify admin status" 
    });
  }
}
