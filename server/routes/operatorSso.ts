import type { Express, Request, Response } from "express";
import path from "node:path";
import { storage } from "../storage";
import { signJWT } from "../middleware/auth";
import {
  verifyLaunchToken,
  assertOperatorOsSsoConfigOrThrow,
  type OperatorOsRejectCode,
} from "../lib/operatorOsSso";

assertOperatorOsSsoConfigOrThrow();

function reject(res: Response, status: number, code: OperatorOsRejectCode, jti?: string): void {
  // Only the jti is safe to log; never log the secret or the raw token.
  console.warn(
    `[operatoros-sso] reject code=${code} status=${status}${jti ? ` jti=${jti}` : ""}`,
  );
  res.status(status).json({ code });
}

export function register(app: Express): void {
  app.get("/sso", async (req: Request, res: Response) => {
    const tokenParam = req.query.token;
    const token = typeof tokenParam === "string" ? tokenParam : "";
    if (!token) {
      return reject(res, 400, "missing_token");
    }

    const result = await verifyLaunchToken(token);
    if (!result.ok) {
      return reject(res, result.status, result.code);
    }

    try {
      const user = await storage.findOrCreateUserByOperatorOsId({
        sub: result.claims.sub,
        email: result.claims.email ?? null,
        role: result.claims.role ?? null,
        planSlug: result.claims.plan_slug ?? null,
        organizationId: result.claims.organization_id ?? null,
      });
      const sessionToken = signJWT({ sub: user.id, role: user.role || "user" });
      if (!sessionToken) {
        console.error(
          `[operatoros-sso] failed to mint session token jti=${result.claims.jti}`,
        );
        return res
          .status(500)
          .json({ code: "consume_failed", message: "Failed to mint session" });
      }

      console.log(
        `[operatoros-sso] launch ok jti=${result.claims.jti} sub=${result.claims.sub}`,
      );

      // Hand the session token to the bridge page, which writes it into
      // localStorage under the same key AuthContext already reads, then
      // forwards the browser to the app root with the token stripped from
      // the address bar.
      res.redirect(
        302,
        `/sso/bridge?token=${encodeURIComponent(sessionToken)}&redirect=%2F`,
      );
    } catch (e) {
      console.error(
        `[operatoros-sso] provisioning error jti=${result.claims.jti}: ${(e as Error).message}`,
      );
      res.status(500).json({ code: "consume_failed", message: "Failed to provision user" });
    }
  });

  app.get("/sso/bridge", (_req: Request, res: Response) => {
    res.sendFile(path.join(process.cwd(), "server", "templates", "sso-bridge.html"));
  });
}
