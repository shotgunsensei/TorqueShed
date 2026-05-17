import { describe, it, expect, beforeEach, afterEach } from "vitest";
import jwt from "jsonwebtoken";
import express from "express";
import type { AddressInfo } from "net";
import type { Server } from "http";
import { verifyLaunchToken } from "../server/lib/operatorOsSso";

const SECRET = "test-secret-please-do-not-use-in-prod";
const ISSUER = "https://operatoros.test";
const AUDIENCE = "torqueshed";
const ENV = "dev";
const API = "https://api.operatoros.test";

const baseClaims = () => ({
  iss: ISSUER,
  aud: AUDIENCE,
  env: ENV,
  sub: "user_abc123",
  user_id: "user_abc123",
  email: "driver@example.com",
  role: "member",
  module_slug: AUDIENCE,
  plan_slug: "garage_pro",
  organization_id: "org_xyz",
  jti: "jti_one",
});

function sign(claims: Record<string, unknown>, opts: jwt.SignOptions = {}) {
  return jwt.sign(claims, SECRET, { algorithm: "HS256", expiresIn: "60s", ...opts });
}

const okConsume = async () => ({ status: 200, body: null });

describe("operatorOsSso.verifyLaunchToken", () => {
  beforeEach(() => {
    process.env.MODULE_SSO_SECRET = SECRET;
    process.env.OPERATOROS_BASE_URL = ISSUER;
    process.env.OPERATOROS_SSO_AUDIENCE = AUDIENCE;
    process.env.OPERATOROS_SSO_ENV = ENV;
    process.env.OPERATOROS_API_URL = API;
  });
  afterEach(() => {
    delete process.env.MODULE_SSO_SECRET;
    delete process.env.OPERATOROS_BASE_URL;
    delete process.env.OPERATOROS_SSO_AUDIENCE;
    delete process.env.OPERATOROS_SSO_ENV;
    delete process.env.OPERATOROS_API_URL;
  });

  it("accepts a valid token after consume succeeds", async () => {
    const token = sign(baseClaims());
    const res = await verifyLaunchToken(token, { consume: okConsume });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.claims.sub).toBe("user_abc123");
      expect(res.claims.module_slug).toBe(AUDIENCE);
    }
  });

  it("rejects an empty token", async () => {
    const res = await verifyLaunchToken("", { consume: okConsume });
    expect(res).toEqual({ ok: false, status: 400, code: "missing_token" });
  });

  it("rejects a token missing required claims with bad_request", async () => {
    // Sign a payload that is structurally a valid HS256 JWT but lacks the
    // mandatory sub/jti/iat/exp set the verifier requires.
    const token = jwt.sign({ iss: ISSUER, aud: AUDIENCE, env: ENV }, SECRET, {
      algorithm: "HS256",
      noTimestamp: true,
    });
    const res = await verifyLaunchToken(token, { consume: okConsume });
    expect(res).toEqual({ ok: false, status: 400, code: "bad_request" });
  });

  it("rejects a bad signature", async () => {
    const token = jwt.sign(baseClaims(), "wrong-secret", { algorithm: "HS256", expiresIn: "60s" });
    const res = await verifyLaunchToken(token, { consume: okConsume });
    expect(res).toEqual({ ok: false, status: 401, code: "signature_invalid" });
  });

  it("rejects mismatched issuer", async () => {
    const token = sign({ ...baseClaims(), iss: "https://evil.example" });
    const res = await verifyLaunchToken(token, { consume: okConsume });
    expect(res).toEqual({ ok: false, status: 401, code: "issuer_mismatch" });
  });

  it("rejects mismatched audience", async () => {
    const token = sign({ ...baseClaims(), aud: "other", module_slug: "other" });
    const res = await verifyLaunchToken(token, { consume: okConsume });
    expect(res).toEqual({ ok: false, status: 401, code: "audience_mismatch" });
  });

  it("rejects mismatched module_slug even when aud matches", async () => {
    const token = sign({ ...baseClaims(), module_slug: "another" });
    const res = await verifyLaunchToken(token, { consume: okConsume });
    expect(res).toEqual({ ok: false, status: 401, code: "audience_mismatch" });
  });

  it("rejects mismatched env", async () => {
    const token = sign({ ...baseClaims(), env: "prod" });
    const res = await verifyLaunchToken(token, { consume: okConsume });
    expect(res).toEqual({ ok: false, status: 401, code: "env_mismatch" });
  });

  it("rejects an expired token (beyond skew tolerance)", async () => {
    const token = sign(baseClaims(), { expiresIn: "-30s" });
    const res = await verifyLaunchToken(token, { consume: okConsume });
    expect(res).toEqual({ ok: false, status: 401, code: "expired" });
  });

  it("accepts a token expired by less than 5s (clock skew tolerance)", async () => {
    const token = sign(baseClaims(), { expiresIn: "-2s" });
    const res = await verifyLaunchToken(token, { consume: okConsume });
    expect(res.ok).toBe(true);
  });

  it("rejects a token older than 90s even if exp is in the future", async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const token = jwt.sign(
      { ...baseClaims(), iat: nowSec - 200, exp: nowSec + 600 },
      SECRET,
      { algorithm: "HS256" },
    );
    const res = await verifyLaunchToken(token, { consume: okConsume });
    expect(res).toEqual({ ok: false, status: 401, code: "expired" });
  });

  it("rejects when iat is too far in the future (clock skew)", async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const token = jwt.sign(
      { ...baseClaims(), iat: nowSec + 60, exp: nowSec + 600 },
      SECRET,
      { algorithm: "HS256" },
    );
    const res = await verifyLaunchToken(token, { consume: okConsume });
    expect(res).toEqual({ ok: false, status: 401, code: "clock_skew" });
  });

  it("maps consume TOKEN_REPLAYED to consume_failed", async () => {
    const token = sign(baseClaims());
    const res = await verifyLaunchToken(token, {
      consume: async () => ({ status: 409, body: { code: "TOKEN_REPLAYED" } }),
    });
    expect(res).toEqual({ ok: false, status: 401, code: "consume_failed" });
  });

  it("maps consume TOKEN_UNKNOWN to consume_failed", async () => {
    const token = sign(baseClaims());
    const res = await verifyLaunchToken(token, {
      consume: async () => ({ status: 404, body: { code: "TOKEN_UNKNOWN" } }),
    });
    expect(res).toEqual({ ok: false, status: 401, code: "consume_failed" });
  });

  it("maps consume TOKEN_EXPIRED to expired", async () => {
    const token = sign(baseClaims());
    const res = await verifyLaunchToken(token, {
      consume: async () => ({ status: 410, body: { code: "TOKEN_EXPIRED" } }),
    });
    expect(res).toEqual({ ok: false, status: 401, code: "expired" });
  });

  it("maps consume AUDIENCE_MISMATCH to audience_mismatch", async () => {
    const token = sign(baseClaims());
    const res = await verifyLaunchToken(token, {
      consume: async () => ({ status: 401, body: { code: "AUDIENCE_MISMATCH" } }),
    });
    expect(res).toEqual({ ok: false, status: 401, code: "audience_mismatch" });
  });

  it("maps consume ENV_MISMATCH to env_mismatch", async () => {
    const token = sign(baseClaims());
    const res = await verifyLaunchToken(token, {
      consume: async () => ({ status: 401, body: { code: "ENV_MISMATCH" } }),
    });
    expect(res).toEqual({ ok: false, status: 401, code: "env_mismatch" });
  });

  it("maps consume 5xx to sso_consume_unavailable", async () => {
    const token = sign(baseClaims());
    const res = await verifyLaunchToken(token, {
      consume: async () => ({ status: 503, body: null }),
    });
    expect(res).toEqual({ ok: false, status: 502, code: "sso_consume_unavailable" });
  });

  it("maps consume network error to sso_consume_unavailable", async () => {
    const token = sign(baseClaims());
    const res = await verifyLaunchToken(token, {
      consume: async () => {
        throw new Error("network down");
      },
    });
    expect(res).toEqual({ ok: false, status: 502, code: "sso_consume_unavailable" });
  });

  describe("defaultConsume (real fetch path)", () => {
    let server: Server;
    let baseUrl: string;
    let lastRequest: {
      method?: string;
      path?: string;
      contentType?: string | string[];
      body?: unknown;
    } = {};
    let respond: (
      req: express.Request,
      res: express.Response,
    ) => void = (_req, res) => res.status(200).json({});

    beforeEach(async () => {
      lastRequest = {};
      const app = express();
      app.use(express.json());
      app.post("/v1/modules/sso/consume", (req, res) => {
        lastRequest = {
          method: req.method,
          path: req.path,
          contentType: req.headers["content-type"],
          body: req.body,
        };
        respond(req, res);
      });
      await new Promise<void>((resolve) => {
        server = app.listen(0, "127.0.0.1", () => resolve());
      });
      const { port } = server.address() as AddressInfo;
      baseUrl = `http://127.0.0.1:${port}`;
      process.env.OPERATOROS_API_URL = baseUrl;
    });

    afterEach(async () => {
      await new Promise<void>((resolve, reject) =>
        server.close((e) => (e ? reject(e) : resolve())),
      );
    });

    it("POSTs {jti,aud,env} as JSON to /v1/modules/sso/consume and returns ok on 200", async () => {
      respond = (_req, res) => res.status(200).json({});
      const token = sign(baseClaims());
      const res = await verifyLaunchToken(token);
      expect(res.ok).toBe(true);
      expect(lastRequest.method).toBe("POST");
      expect(lastRequest.path).toBe("/v1/modules/sso/consume");
      expect(String(lastRequest.contentType || "")).toMatch(/^application\/json/);
      expect(lastRequest.body).toEqual({
        jti: "jti_one",
        aud: AUDIENCE,
        env: ENV,
      });
    });

    it("strips a trailing slash from OPERATOROS_API_URL when building the consume URL", async () => {
      process.env.OPERATOROS_API_URL = `${baseUrl}/`;
      respond = (_req, res) => res.status(200).json({});
      const token = sign(baseClaims());
      const res = await verifyLaunchToken(token);
      expect(res.ok).toBe(true);
      expect(lastRequest.path).toBe("/v1/modules/sso/consume");
    });

    it("maps a real 503 response from the consume endpoint to sso_consume_unavailable", async () => {
      respond = (_req, res) => res.status(503).json({});
      const token = sign(baseClaims());
      const res = await verifyLaunchToken(token);
      expect(res).toEqual({ ok: false, status: 502, code: "sso_consume_unavailable" });
    });
  });

  it("rejects an RS256-signed token (HS256-only)", async () => {
    // Build a header.payload.sig structure that *claims* RS256 but is signed with our HS256 secret.
    // jsonwebtoken's verify with algorithms:["HS256"] should reject any other alg in the header.
    const token = jwt.sign(baseClaims(), SECRET, { algorithm: "HS256", expiresIn: "60s" });
    const [headerB64, payloadB64, sig] = token.split(".");
    const header = JSON.parse(Buffer.from(headerB64, "base64url").toString("utf8"));
    header.alg = "RS256";
    const tamperedHeader = Buffer.from(JSON.stringify(header)).toString("base64url");
    const tampered = `${tamperedHeader}.${payloadB64}.${sig}`;
    const res = await verifyLaunchToken(tampered, { consume: okConsume });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(["signature_invalid", "bad_request"]).toContain(res.code);
    }
  });
});
