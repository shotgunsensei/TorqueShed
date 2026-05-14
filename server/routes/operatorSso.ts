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
        return reject(res, 500, "consume_failed", result.claims.jti);
      }

      console.log(
        `[operatoros-sso] launch ok jti=${result.claims.jti} sub=${result.claims.sub}`,
      );

      // Hand the session token to the bridge page. The bridge:
      //   1. Writes the token to localStorage under `torqueshed_auth_token`.
      //   2. Attempts a `torqueshed://sso?token=...` deep link so a user who
      //      arrived in a mobile browser is bounced into the native app.
      //   3. Falls back to `/?ssoToken=<token>` so AuthContext's web pickup
      //      path persists the token and strips it from the URL.
      // The bridge sanitises its `redirect` param to internal paths only,
      // closing the open-redirect vector.
      res.redirect(
        302,
        `/sso/bridge?token=${encodeURIComponent(sessionToken)}`,
      );
    } catch (e) {
      console.error(
        `[operatoros-sso] provisioning error jti=${result.claims.jti}: ${(e as Error).message}`,
      );
      reject(res, 500, "consume_failed", result.claims.jti);
    }
  });

  app.get("/sso/bridge", (_req: Request, res: Response) => {
    res.sendFile(path.join(process.cwd(), "server", "templates", "sso-bridge.html"));
  });
}
