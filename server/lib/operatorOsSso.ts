import jwt from "jsonwebtoken";

export interface OperatorOsClaims {
  iss: string;
  aud: string;
  env: "prod" | "staging" | "dev";
  sub: string;
  user_id: string;
  email?: string;
  role?: string;
  module_slug: string;
  plan_slug?: string | null;
  organization_id?: string | null;
  jti: string;
  iat: number;
  exp: number;
}

export type OperatorOsRejectCode =
  | "missing_token"
  | "bad_request"
  | "signature_invalid"
  | "issuer_mismatch"
  | "audience_mismatch"
  | "env_mismatch"
  | "expired"
  | "clock_skew"
  | "consume_failed"
  | "sso_consume_unavailable";

export interface OperatorOsVerifyOk {
  ok: true;
  claims: OperatorOsClaims;
}

export interface OperatorOsVerifyErr {
  ok: false;
  status: number;
  code: OperatorOsRejectCode;
}

export type OperatorOsVerifyResult = OperatorOsVerifyOk | OperatorOsVerifyErr;

const TOKEN_MAX_AGE_SECONDS = 90;
const CLOCK_SKEW_SECONDS = 5;

function readEnv() {
  return {
    secret: process.env.MODULE_SSO_SECRET || "",
    issuer: process.env.OPERATOROS_BASE_URL || "",
    audience: (process.env.OPERATOROS_SSO_AUDIENCE || "").toLowerCase(),
    env: (process.env.OPERATOROS_SSO_ENV || "") as "prod" | "staging" | "dev" | "",
    apiUrl: process.env.OPERATOROS_API_URL || "",
  };
}

// Fail startup loudly in production when the shared secret is missing — there
// is no safe fallback for a child app accepting SSO handoffs.
export function assertOperatorOsSsoConfigOrThrow(): void {
  if (process.env.NODE_ENV !== "production") return;
  const cfg = readEnv();
  if (!cfg.secret || cfg.secret.length < 16) {
    throw new Error(
      "[operatoros-sso] MODULE_SSO_SECRET must be set (>=16 chars) in production. Refusing to start.",
    );
  }
  if (!cfg.issuer || !cfg.audience || !cfg.env || !cfg.apiUrl) {
    throw new Error(
      "[operatoros-sso] OPERATOROS_BASE_URL, OPERATOROS_SSO_AUDIENCE, OPERATOROS_SSO_ENV, and OPERATOROS_API_URL must all be set in production.",
    );
  }
}

function err(status: number, code: OperatorOsRejectCode): OperatorOsVerifyErr {
  return { ok: false, status, code };
}

export interface VerifyOptions {
  // Override the consume fetcher in tests.
  consume?: (
    apiUrl: string,
    body: { jti: string; aud: string; env: string },
  ) => Promise<{ status: number; body: { code?: string } | null }>;
  now?: () => number;
}

async function defaultConsume(
  apiUrl: string,
  body: { jti: string; aud: string; env: string },
): Promise<{ status: number; body: { code?: string } | null }> {
  const url = `${apiUrl.replace(/\/$/, "")}/v1/modules/sso/consume`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let parsed: { code?: string } | null = null;
  try {
    parsed = (await res.json()) as { code?: string };
  } catch {
    parsed = null;
  }
  return { status: res.status, body: parsed };
}

export async function verifyLaunchToken(
  token: string,
  opts: VerifyOptions = {},
): Promise<OperatorOsVerifyResult> {
  if (!token || typeof token !== "string") return err(400, "missing_token");
  const cfg = readEnv();
  if (!cfg.secret) {
    // Mis-configured server — treat like a verification failure so callers get
    // a stable code instead of a 500. assertOperatorOsSsoConfigOrThrow() should
    // already have prevented this in production.
    return err(401, "signature_invalid");
  }

  let claims: OperatorOsClaims;
  try {
    claims = jwt.verify(token, cfg.secret, { algorithms: ["HS256"] }) as OperatorOsClaims;
  } catch (e) {
    const name = (e as { name?: string }).name;
    if (name === "TokenExpiredError") return err(401, "expired");
    if (name === "JsonWebTokenError") return err(401, "signature_invalid");
    return err(400, "bad_request");
  }

  if (!claims || typeof claims !== "object") return err(400, "bad_request");
  if (!claims.sub || !claims.jti || !claims.iat || !claims.exp) return err(400, "bad_request");

  if (cfg.issuer && claims.iss !== cfg.issuer) return err(401, "issuer_mismatch");
  if (
    cfg.audience &&
    (claims.aud !== cfg.audience || claims.module_slug !== cfg.audience)
  ) {
    return err(401, "audience_mismatch");
  }
  if (cfg.env && claims.env !== cfg.env) return err(401, "env_mismatch");

  const nowSeconds = Math.floor((opts.now ? opts.now() : Date.now()) / 1000);
  if (claims.iat - nowSeconds > CLOCK_SKEW_SECONDS) return err(401, "clock_skew");
  if (claims.exp + CLOCK_SKEW_SECONDS < nowSeconds) return err(401, "expired");
  if (nowSeconds - claims.iat > TOKEN_MAX_AGE_SECONDS) return err(401, "expired");

  if (!cfg.apiUrl) {
    // Without the consume URL we cannot enforce single-use — treat as
    // unavailable to fail closed.
    return err(502, "sso_consume_unavailable");
  }

  const consume = opts.consume || defaultConsume;
  let consumeRes: { status: number; body: { code?: string } | null };
  try {
    consumeRes = await consume(cfg.apiUrl, {
      jti: claims.jti,
      aud: claims.aud,
      env: claims.env,
    });
  } catch {
    return err(502, "sso_consume_unavailable");
  }

  if (consumeRes.status >= 500) return err(502, "sso_consume_unavailable");
  if (consumeRes.status >= 400) {
    const apiCode = consumeRes.body?.code;
    if (apiCode === "TOKEN_EXPIRED") return err(401, "expired");
    if (apiCode === "AUDIENCE_MISMATCH") return err(401, "audience_mismatch");
    if (apiCode === "ENV_MISMATCH") return err(401, "env_mismatch");
    // TOKEN_UNKNOWN, TOKEN_REPLAYED, and anything else 4xx → consume_failed.
    return err(401, "consume_failed");
  }

  return { ok: true, claims };
}
