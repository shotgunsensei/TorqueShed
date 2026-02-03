import express from "express";
import type { Request, Response, NextFunction } from "express";
import helmet from "helmet";
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcrypt";
import { registerRoutes } from "./routes";
import { storage } from "./storage";
import * as fs from "fs";
import * as path from "path";
import { ZodError } from "zod";

const app = express();
const log = console.log;

// Server start time for uptime calculation
const SERVER_START_TIME = Date.now();

// Commit hash for health checks (set via env or read from .git)
const COMMIT_HASH = process.env.COMMIT_HASH || getCommitHash();

function getCommitHash(): string {
  try {
    const headPath = path.resolve(process.cwd(), ".git", "HEAD");
    const head = fs.readFileSync(headPath, "utf-8").trim();
    if (head.startsWith("ref: ")) {
      const refPath = path.resolve(process.cwd(), ".git", head.slice(5));
      return fs.readFileSync(refPath, "utf-8").trim().slice(0, 7);
    }
    return head.slice(0, 7);
  } catch {
    return "unknown";
  }
}

// Extend Express Request to include requestId
declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

// Configure trust proxy for proper client IP detection behind reverse proxies
// (Replit, Vercel, Fly.io, Render, Heroku, etc. all use proxies)
// This ensures req.ip uses X-Forwarded-For correctly for rate limiting
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
  log("trust proxy enabled (production mode)");
} else if (process.env.REPLIT_DEV_DOMAIN || process.env.RENDER || process.env.FLY_APP_NAME || process.env.VERCEL) {
  // Also enable in dev when running on cloud platforms
  app.set("trust proxy", 1);
  log("trust proxy enabled (cloud platform detected)");
}

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// Request size limits to prevent abuse
const REQUEST_BODY_LIMIT = process.env.REQUEST_BODY_LIMIT || "1mb";

function setupSecurity(app: express.Application) {
  // Helmet for security headers with Expo-compatible settings
  app.use(
    helmet({
      // Allow inline scripts for Expo web and landing page
      contentSecurityPolicy: false,
      // Allow cross-origin requests for Expo
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
    })
  );
  log("Helmet security headers enabled");
}

function setupRequestId(app: express.Application) {
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const existingId = req.header("x-request-id");
    req.requestId = existingId && existingId.length > 0 ? existingId.slice(0, 36) : uuidv4();
    next();
  });
}

function setupCors(app: express.Application) {
  app.use((req, res, next) => {
    const origins = new Set<string>();

    if (process.env.REPLIT_DEV_DOMAIN) {
      origins.add(`https://${process.env.REPLIT_DEV_DOMAIN}`);
    }

    if (process.env.REPLIT_DOMAINS) {
      process.env.REPLIT_DOMAINS.split(",").forEach((d: string) => {
        origins.add(`https://${d.trim()}`);
      });
    }

    const origin = req.header("origin");

    // Allow localhost origins for Expo web development (any port)
    const isLocalhost =
      origin?.startsWith("http://localhost:") ||
      origin?.startsWith("http://127.0.0.1:");

    if (origin && (origins.has(origin) || isLocalhost)) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, PATCH, OPTIONS",
      );
      res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.header("Access-Control-Allow-Credentials", "true");
    }

    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }

    next();
  });
}

function setupBodyParsing(app: express.Application) {
  app.use(
    express.json({
      limit: REQUEST_BODY_LIMIT,
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );

  app.use(express.urlencoded({ extended: false, limit: REQUEST_BODY_LIMIT }));
  log(`Request body limit: ${REQUEST_BODY_LIMIT}`);
}

function setupRequestLogging(app: express.Application) {
  app.use((req, res, next) => {
    const start = Date.now();
    const reqPath = req.path;

    // Set response header with request ID for tracing
    if (req.requestId) {
      res.setHeader("x-request-id", req.requestId);
    }

    res.on("finish", () => {
      // Skip logging for non-API routes and health checks
      if (!reqPath.startsWith("/api") && reqPath !== "/healthz") return;

      const duration = Date.now() - start;

      // Structured log format: [requestId] METHOD /path STATUS in DURATIONms
      const reqId = req.requestId ? req.requestId.slice(0, 8) : "--------";
      const logLine = `[${reqId}] ${req.method} ${reqPath} ${res.statusCode} ${duration}ms`;
      log(logLine);
    });

    next();
  });
}

function getAppName(): string {
  try {
    const appJsonPath = path.resolve(process.cwd(), "app.json");
    const appJsonContent = fs.readFileSync(appJsonPath, "utf-8");
    const appJson = JSON.parse(appJsonContent);
    return appJson.expo?.name || "App Landing Page";
  } catch {
    return "App Landing Page";
  }
}

function serveExpoManifest(platform: string, res: Response) {
  const manifestPath = path.resolve(
    process.cwd(),
    "static-build",
    platform,
    "manifest.json",
  );

  if (!fs.existsSync(manifestPath)) {
    return res
      .status(404)
      .json({ error: `Manifest not found for platform: ${platform}` });
  }

  res.setHeader("expo-protocol-version", "1");
  res.setHeader("expo-sfv-version", "0");
  res.setHeader("content-type", "application/json");

  const manifest = fs.readFileSync(manifestPath, "utf-8");
  res.send(manifest);
}

function serveLandingPage({
  req,
  res,
  landingPageTemplate,
  appName,
}: {
  req: Request;
  res: Response;
  landingPageTemplate: string;
  appName: string;
}) {
  const forwardedProto = req.header("x-forwarded-proto");
  const protocol = forwardedProto || req.protocol || "https";
  const forwardedHost = req.header("x-forwarded-host");
  const host = forwardedHost || req.get("host");
  const baseUrl = `${protocol}://${host}`;
  const expsUrl = `${host}`;

  log(`baseUrl`, baseUrl);
  log(`expsUrl`, expsUrl);

  const html = landingPageTemplate
    .replace(/BASE_URL_PLACEHOLDER/g, baseUrl)
    .replace(/EXPS_URL_PLACEHOLDER/g, expsUrl)
    .replace(/APP_NAME_PLACEHOLDER/g, appName);

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}

function configureExpoAndLanding(app: express.Application) {
  const templatePath = path.resolve(
    process.cwd(),
    "server",
    "templates",
    "landing-page.html",
  );
  const landingPageTemplate = fs.readFileSync(templatePath, "utf-8");
  const appName = getAppName();

  log("Serving static Expo files with dynamic manifest routing");

  // Serve web app at /app route
  const webIndexPath = path.resolve(process.cwd(), "static-build", "web", "index.html");
  const isDevelopment = process.env.NODE_ENV !== "production";
  
  app.get("/app", (req: Request, res: Response) => {
    // Check for static web build first
    if (fs.existsSync(webIndexPath)) {
      return res.sendFile(webIndexPath);
    }
    // Only redirect to dev server in development mode
    if (isDevelopment) {
      const devDomain = process.env.REPLIT_DEV_DOMAIN;
      if (devDomain) {
        return res.redirect(`https://${devDomain}:8081`);
      }
    }
    // In production without a web build, show helpful message
    res.status(503).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>TorqueShed - Web App</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: -apple-system, sans-serif; background: #0D0F12; color: #E5E7EB; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; text-align: center; }
            .container { padding: 40px; }
            h1 { color: #FF6B35; margin-bottom: 16px; }
            p { color: #9CA3AF; }
            a { color: #FF6B35; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Web App Coming Soon</h1>
            <p>The web version is being prepared. In the meantime, use the <a href="/">mobile app</a> via Expo Go.</p>
          </div>
        </body>
      </html>
    `);
  });
  
  // Serve web app static assets
  app.use("/app", express.static(path.resolve(process.cwd(), "static-build", "web")));

  // Delete account page for Google Play compliance
  app.get("/delete-account", (_req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(200).send(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <title>Delete Account - TorqueShed</title>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Montserrat:wght@700;800&display=swap" rel="stylesheet">
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body {
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
              background: #0D0F12;
              color: #E5E7EB;
              line-height: 1.6;
              min-height: 100vh;
              display: flex;
              justify-content: center;
              align-items: center;
            }
            .container {
              max-width: 500px;
              padding: 48px 24px;
              text-align: center;
            }
            .brand {
              display: inline-flex;
              align-items: center;
              margin-bottom: 32px;
            }
            .brand-logo {
              width: 120px;
              height: 120px;
              object-fit: contain;
            }
            h1 {
              font-family: 'Montserrat', sans-serif;
              font-weight: 800;
              font-size: 28px;
              color: #fff;
              margin-bottom: 16px;
            }
            p {
              color: #9CA3AF;
              margin-bottom: 24px;
              font-size: 16px;
            }
            .steps {
              text-align: left;
              background: #1A1D23;
              border-radius: 12px;
              padding: 24px;
              margin-bottom: 24px;
            }
            .steps h2 {
              font-family: 'Montserrat', sans-serif;
              font-size: 18px;
              color: #FF6B35;
              margin-bottom: 16px;
            }
            .steps ol {
              padding-left: 20px;
              color: #E5E7EB;
            }
            .steps li {
              margin-bottom: 12px;
            }
            .contact {
              background: #1A1D23;
              border-radius: 12px;
              padding: 24px;
            }
            .contact h2 {
              font-family: 'Montserrat', sans-serif;
              font-size: 18px;
              color: #FF6B35;
              margin-bottom: 12px;
            }
            .contact a {
              color: #FF6B35;
              text-decoration: none;
            }
            .contact a:hover {
              text-decoration: underline;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="brand">
              <img src="/assets/logo.png" alt="TorqueShed" class="brand-logo">
            </div>
            
            <h1>Delete Your Account</h1>
            <p>We're sorry to see you go. Deleting your account will permanently remove all your data including your profile, vehicles, notes, and messages.</p>
            
            <div class="steps">
              <h2>How to Delete Your Account</h2>
              <ol>
                <li>Open the TorqueShed app on your device</li>
                <li>Log in to your account</li>
                <li>Tap on the Profile tab</li>
                <li>Scroll to the bottom of the page</li>
                <li>Tap "Delete Account"</li>
                <li>Confirm your choice in the dialog</li>
              </ol>
            </div>
            
            <div class="contact">
              <h2>Need Help?</h2>
              <p>If you're having trouble deleting your account or have questions, please contact us at <a href="mailto:support@torqueshed.app">support@torqueshed.app</a></p>
            </div>
          </div>
        </body>
      </html>
    `);
  });

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith("/api")) {
      return next();
    }

    if (req.path !== "/" && req.path !== "/manifest") {
      return next();
    }

    const platform = req.header("expo-platform");
    if (platform && (platform === "ios" || platform === "android")) {
      return serveExpoManifest(platform, res);
    }

    if (req.path === "/") {
      return serveLandingPage({
        req,
        res,
        landingPageTemplate,
        appName,
      });
    }

    next();
  });

  app.use("/assets", express.static(path.resolve(process.cwd(), "assets")));
  app.use(express.static(path.resolve(process.cwd(), "static-build")));

  log("Expo routing: Checking expo-platform header on / and /manifest");
}

function setupHealthCheck(app: express.Application) {
  app.get("/healthz", async (_req: Request, res: Response) => {
    const uptimeSeconds = Math.floor((Date.now() - SERVER_START_TIME) / 1000);
    const uptimeFormatted = formatUptime(uptimeSeconds);

    // Optional: check database connectivity
    let dbStatus = "not_checked";
    if (process.env.DATABASE_URL) {
      try {
        const pg = await import("pg");
        const testPool = new pg.default.Pool({ 
          connectionString: process.env.DATABASE_URL,
          max: 1,
          idleTimeoutMillis: 1000,
          connectionTimeoutMillis: 3000,
        });
        const client = await testPool.connect();
        await client.query("SELECT 1");
        client.release();
        await testPool.end();
        dbStatus = "connected";
      } catch (err) {
        dbStatus = "error";
        // Log error in development for debugging
        if (process.env.NODE_ENV !== "production") {
          console.error("[healthz] DB check failed:", err);
        }
      }
    }

    res.status(200).json({
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: uptimeFormatted,
      uptimeSeconds,
      commit: COMMIT_HASH,
      env: process.env.NODE_ENV || "development",
      database: dbStatus,
    });
  });
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${secs}s`);

  return parts.join(" ");
}

function setupErrorHandler(app: express.Application) {
  app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
    let status = 500;
    let message = "Internal Server Error";

    // Handle Zod validation errors
    if (err instanceof ZodError) {
      status = 400;
      const issues = err.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ");
      message = `Validation error: ${issues}`;
    }
    // Handle errors with status codes
    else if (err && typeof err === "object") {
      const errorObj = err as {
        status?: number;
        statusCode?: number;
        code?: string;
        message?: string;
      };

      // Check for specific status codes
      if (errorObj.status) {
        status = errorObj.status;
      } else if (errorObj.statusCode) {
        status = errorObj.statusCode;
      } else if (errorObj.code === "UNAUTHORIZED") {
        status = 401;
      } else if (errorObj.code === "FORBIDDEN") {
        status = 403;
      } else if (errorObj.code === "NOT_FOUND") {
        status = 404;
      }

      if (errorObj.message) {
        message = errorObj.message;
      }
    }
    // Handle Error instances
    else if (err instanceof Error) {
      message = err.message;
    }

    // Structured logging
    console.error(
      JSON.stringify({
        type: "error",
        path: req.path,
        method: req.method,
        status,
        message,
        timestamp: new Date().toISOString(),
      })
    );

    // Send response and return (no rethrow)
    res.status(status).json({ message });
    return;
  });
}

// Seed Google Play reviewer test account
async function seedReviewerAccount() {
  const REVIEWER_USERNAME = process.env.REVIEWER_USERNAME;
  const REVIEWER_PASSWORD = process.env.REVIEWER_PASSWORD;
  
  if (!REVIEWER_USERNAME || !REVIEWER_PASSWORD) {
    log("Reviewer account credentials not configured - skipping seed");
    return;
  }
  
  try {
    // Check if account already exists
    const existingUser = await storage.getUserByUsername(REVIEWER_USERNAME);
    if (existingUser) {
      log(`Reviewer account already exists: ${REVIEWER_USERNAME}`);
      return;
    }
    
    // Create reviewer account with hashed password
    const hashedPassword = await bcrypt.hash(REVIEWER_PASSWORD, 10);
    await storage.createUser({
      username: REVIEWER_USERNAME,
      password: hashedPassword,
    });
    
    log(`Created reviewer test account: ${REVIEWER_USERNAME}`);
  } catch (error) {
    console.error("Failed to seed reviewer account:", error);
  }
}

(async () => {
  // Security middleware (must be first)
  setupSecurity(app);
  setupRequestId(app);

  // CORS (before body parsing)
  setupCors(app);

  // Body parsing with size limits
  setupBodyParsing(app);

  // Request logging
  setupRequestLogging(app);

  // Health check endpoint (before Expo routing)
  setupHealthCheck(app);

  // Expo and landing page routing
  configureExpoAndLanding(app);

  // API routes
  const server = await registerRoutes(app);

  // Seed test accounts for app store review
  await seedReviewerAccount();

  // Error handler (must be last)
  setupErrorHandler(app);

  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`express server serving on port ${port}`);
      log(`Health check available at /healthz`);
    },
  );
})();
