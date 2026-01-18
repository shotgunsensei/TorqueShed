import express from "express";
import type { Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import * as fs from "fs";
import * as path from "path";
import { ZodError } from "zod";

const app = express();
const log = console.log;

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

function setupCors(app: express.Application) {
  app.use((req, res, next) => {
    const origins = new Set<string>();

    if (process.env.REPLIT_DEV_DOMAIN) {
      origins.add(`https://${process.env.REPLIT_DEV_DOMAIN}`);
    }

    if (process.env.REPLIT_DOMAINS) {
      process.env.REPLIT_DOMAINS.split(",").forEach((d) => {
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
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );

  app.use(express.urlencoded({ extended: false }));
}

function setupRequestLogging(app: express.Application) {
  app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;
    let capturedJsonResponse: Record<string, unknown> | undefined = undefined;

    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };

    res.on("finish", () => {
      if (!path.startsWith("/api")) return;

      const duration = Date.now() - start;

      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

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

(async () => {
  setupCors(app);
  setupBodyParsing(app);
  setupRequestLogging(app);

  configureExpoAndLanding(app);

  const server = await registerRoutes(app);

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
    },
  );
})();
