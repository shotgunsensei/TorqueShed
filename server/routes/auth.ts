// AUTO-GENERATED from server/routes.ts split. See task #51.
import type { Express, Request, Response } from "express";
import path from "node:path";
import bcrypt from "bcrypt";
import { ZodError } from "zod";
import { signupSchema, loginSchema } from "@shared/schema";
import { storage } from "../storage";
import { rateLimited } from "../lib/rateLimit";
import { requireAuth, signJWT, type AuthenticatedRequest } from "../middleware/auth";

const BCRYPT_ROUNDS = 12;

export function register(app: Express): void {
  app.post("/api/auth/signup", rateLimited("auth:signup", 5, 60 * 60 * 1000), async (req: Request, res: Response) => {
    try {
      const { username, password } = signupSchema.parse(req.body);

      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(409).json({ 
          error: "Conflict", 
          message: "Username already exists" 
        });
      }

      const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
      
      const user = await storage.createUser({
        username: username.trim(),
        passwordHash: hashedPassword,
      });

      const token = signJWT({ sub: user.id, role: user.role || "user" });
      
      if (!token) {
        return res.status(500).json({ 
          error: "Internal Server Error", 
          message: "Failed to generate token. Check JWT_SECRET configuration." 
        });
      }

      res.status(201).json({
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          onboardingCompleted: user.onboardingCompleted ?? false,
          onboardingGoals: user.onboardingGoals ?? [],
        },
        token,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: "Bad Request", message: error.errors.map(e => e.message).join(", ") });
      }
      console.error("Error during signup:", error);
      res.status(500).json({ error: "Internal Server Error", message: "Failed to create user" });
    }
  });

  app.post("/api/auth/login", rateLimited("auth:login", 10, 15 * 60 * 1000), async (req: Request, res: Response) => {
    try {
      const { username, password } = loginSchema.parse(req.body);

      // Per-username lockout to slow distributed brute-force attempts.
      const LOCKOUT_MAX_ATTEMPTS = 10;
      const LOCKOUT_DURATION_MS = 15 * 60 * 1000;
      const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;

      const existingLockout = await storage.getLoginLockout(username);
      if (existingLockout?.lockedUntil && existingLockout.lockedUntil.getTime() > Date.now()) {
        const unlockAt = existingLockout.lockedUntil;
        const retryAfterSeconds = Math.max(1, Math.ceil((unlockAt.getTime() - Date.now()) / 1000));
        const unlockLabel = unlockAt.toISOString().slice(11, 16);
        res.setHeader("Retry-After", String(retryAfterSeconds));
        return res.status(423).json({
          error: "Locked",
          message: `Too many failed login attempts. Try again at ${unlockLabel} UTC.`,
          unlockAt: unlockAt.toISOString(),
          retryAfterSeconds,
        });
      }

      const recordFailure = async () => {
        const result = await storage.recordFailedLogin(username, {
          maxAttempts: LOCKOUT_MAX_ATTEMPTS,
          lockMs: LOCKOUT_DURATION_MS,
          windowMs: LOCKOUT_WINDOW_MS,
        });
        if (result.lockedUntil) {
          const retryAfterSeconds = Math.max(
            1,
            Math.ceil((result.lockedUntil.getTime() - Date.now()) / 1000),
          );
          const unlockLabel = result.lockedUntil.toISOString().slice(11, 16);
          res.setHeader("Retry-After", String(retryAfterSeconds));
          return res.status(423).json({
            error: "Locked",
            message: `Too many failed login attempts. Try again at ${unlockLabel} UTC.`,
            unlockAt: result.lockedUntil.toISOString(),
            retryAfterSeconds,
          });
        }
        return res.status(401).json({
          error: "Unauthorized",
          message: "Invalid username or password",
        });
      };

      const user = await storage.getUserByUsername(username);
      if (!user) {
        return await recordFailure();
      }

      const isValidPassword = await bcrypt.compare(password, user.passwordHash);
      if (!isValidPassword) {
        return await recordFailure();
      }

      await storage.clearFailedLogins(username);

      const token = signJWT({ sub: user.id, role: user.role || "user" });
      
      if (!token) {
        return res.status(500).json({ 
          error: "Internal Server Error", 
          message: "Failed to generate token. Check JWT_SECRET configuration." 
        });
      }

      res.json({
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          onboardingCompleted: user.onboardingCompleted ?? true,
          onboardingGoals: user.onboardingGoals ?? [],
        },
        token,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: "Bad Request", message: error.errors.map(e => e.message).join(", ") });
      }
      console.error("Error during login:", error);
      res.status(500).json({ error: "Internal Server Error", message: "Failed to login" });
    }
  });

  // TODO: Wire up email service for password reset flow
  app.post("/api/auth/forgot-password", rateLimited("auth:forgot", 5, 60 * 60 * 1000), async (req: Request, res: Response) => {
    try {
      const { username } = req.body;
      if (!username) {
        return res.status(400).json({ error: "Username is required" });
      }
      // TODO: When email service is wired up:
      // 1. Look up user by username
      // 2. Generate a secure reset token with expiration
      // 3. Send reset email with token link
      // For now, always return success to avoid leaking user existence
      res.json({ message: "If an account with that username exists, a reset link has been sent." });
    } catch (error) {
      console.error("Error in forgot-password:", error);
      res.status(500).json({ error: "Failed to process request" });
    }
  });

  // TODO: Wire up email service for password reset flow
  app.post("/api/auth/reset-password", rateLimited("auth:reset", 10, 15 * 60 * 1000), async (req: Request, res: Response) => {
    try {
      const { token, newPassword } = req.body;
      if (!token || !newPassword) {
        return res.status(400).json({ error: "Token and new password are required" });
      }
      // TODO: When email service is wired up:
      // 1. Validate the reset token and check expiration
      // 2. Hash the new password
      // 3. Update the user's password
      // 4. Invalidate the token
      res.status(501).json({ error: "Password reset is not yet available. Contact support for assistance." });
    } catch (error) {
      console.error("Error in reset-password:", error);
      res.status(500).json({ error: "Failed to process request" });
    }
  });

  // ========== Email Verification ==========
  app.post(
    "/api/auth/email/send-verification",
    requireAuth,
    rateLimited("auth:emailsend", 5, 60 * 60 * 1000),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const user = await storage.getUser(req.userId!);
        if (!user) return res.status(404).json({ error: "User not found" });
        if (!user.email) {
          return res.status(400).json({ error: "Bad Request", message: "Add an email address before requesting verification." });
        }
        if (user.emailVerifiedAt) {
          return res.json({ ok: true, alreadyVerified: true });
        }
        const { token } = await storage.createEmailVerification(user.id, user.email);
        const { sendEmail, buildVerificationEmail } = await import("../lib/mailer");
        const baseUrl =
          process.env.PUBLIC_APP_URL ||
          process.env.APP_URL ||
          (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : null) ||
          `${req.protocol}://${req.get("host")}`;
        const verifyUrl = `${baseUrl.replace(/\/$/, "")}/verify-email?token=${encodeURIComponent(token)}`;
        const { subject, html, text } = buildVerificationEmail(verifyUrl, user.email);
        const result = await sendEmail({ to: user.email, subject, html, text });
        if (!result.ok) {
          console.error("Failed to send verification email:", result.error);
          return res.status(502).json({ error: "Mailer error", message: "Could not send verification email. Try again later." });
        }
        res.json({ ok: true, provider: result.provider });
      } catch (error) {
        console.error("Error sending verification email:", error);
        res.status(500).json({ error: "Failed to send verification email" });
      }
    },
  );

  app.post(
    "/api/auth/email/verify",
    rateLimited("auth:emailverify", 10, 15 * 60 * 1000),
    async (req: Request, res: Response) => {
      try {
        const token = typeof req.body?.token === "string" ? req.body.token.trim() : "";
        if (!token) {
          return res.status(400).json({ error: "Bad Request", message: "Verification token is required." });
        }
        const result = await storage.consumeEmailVerification(token);
        if (!result) {
          return res.status(400).json({ error: "Invalid token", message: "This verification link is invalid, expired, or already used." });
        }
        res.json({ ok: true, email: result.email });
      } catch (error) {
        console.error("Error verifying email:", error);
        res.status(500).json({ error: "Failed to verify email" });
      }
    },
  );

  app.get("/verify-email", (_req: Request, res: Response) => {
    res.sendFile(path.resolve(process.cwd(), "server", "templates", "verify-email.html"));
  });
}
