import type { Request, Response, NextFunction } from "express";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { storage } from "../storage";

export interface AuthenticatedRequest extends Request {
  userId?: string;
  userRole?: string;
}

export interface JWTPayload {
  sub: string;
  role?: string;
  exp?: number;
  iat?: number;
}

const JWT_ENV_VAR = "APP_JWT_SECRET";

// Fail fast in production: refuse to boot without a real secret. There is NO
// hardcoded fallback. In development a per-process ephemeral secret is
// generated so dev tokens just rotate on restart.
if (process.env.NODE_ENV === "production" && !process.env[JWT_ENV_VAR]) {
  throw new Error(
    `[auth] ${JWT_ENV_VAR} must be set in production. Refusing to start with an insecure default.`,
  );
}

let cachedSecret: string | null = null;
let warnedEphemeral = false;

function getJwtSecret(): string | null {
  if (cachedSecret) return cachedSecret;
  const fromEnv = process.env[JWT_ENV_VAR];
  if (fromEnv && fromEnv.length > 0) {
    cachedSecret = fromEnv;
    return cachedSecret;
  }
  if (process.env.NODE_ENV === "production") {
    // Defensive — module-load check above should have already prevented this.
    return null;
  }
  cachedSecret = crypto.randomBytes(48).toString("hex");
  if (!warnedEphemeral) {
    warnedEphemeral = true;
    console.warn(
      `[auth] ${JWT_ENV_VAR} not set — generated an ephemeral secret for this process. ` +
        `Tokens will be invalidated on every restart. Set ${JWT_ENV_VAR} for stable dev sessions.`,
    );
  }
  return cachedSecret;
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

export function verifyJWT(token: string): JWTPayload | null {
  const secret = getJwtSecret();
  if (!secret) return null;

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

export function signJWT(payload: { sub: string; role?: string }, expiresInSeconds: number = 60 * 60 * 24 * 7): string | null {
  const secret = getJwtSecret();
  if (!secret) return null;

  return jwt.sign(payload, secret, {
    algorithm: "HS256",
    expiresIn: expiresInSeconds,
  });
}

export function optionalAuth(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void {
  const token = extractToken(req);
  if (token) {
    const payload = verifyJWT(token);
    if (payload) {
      req.userId = payload.sub;
      req.userRole = payload.role;
    }
  }
  next();
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
  req.userRole = payload.role;
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
