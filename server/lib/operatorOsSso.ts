import jwt from "jsonwebtoken";

// OperatorOS-owned entitlement levels. Map to local SubscriptionTier in
// server/entitlements.ts. `none` (or `target_module_enabled === false`)
// short-circuits to the AccessDenied screen.
export type OperatorOsAccessLevel = "none" | "viewer" | "user" | "admin" | "owner";

export interface OperatorOsClaims {
  iss: string;
  aud: string;
  env: "prod" | "staging" | "dev";
  sub: string;
  user_id: string;
  email?: string;
  name?: string | null;
  role?: string;
  module_slug: string;
  plan_slug?: string | null;
  organization_id?: string | null;
  // --- Extended claims (Task #68). All optional for back-compat with the
  // minimal OperatorOS payload — older tokens still launch successfully and
  // fall through to whatever local snapshot exists. ---
  tenant_id?: string | null;
  module_role?: string | null;
  target_module_key?: string | null;
  target_module_enabled?: boolean | null;
  target_module_access_level?: OperatorOsAccessLevel | null;
  target_module_features?: string[] | null;
  subscription_status?: string | null;
  jti: string;
  iat: number;
  exp: number;
}

// Resolve the configured "child app module key" — defaults to the SSO
// audience for back-compat so existing deployments don't need a new env var.
function childAppModuleKey(): string {
  return (
    process.env.CHILD_APP_MODULE_KEY ||
    process.env.OPERATOROS_SSO_AUDIENCE ||
    ""
  ).toLowerCase();
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
  | "sso_consume_unavailable"
  | "internal_error";

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
  // Accept both legacy and Task #68 env-var names so deployments can adopt
  // OPERATOROS_JWT_SECRET / OPERATOROS_ISSUER without breaking existing ones.
  return {
    secret:
      process.env.OPERATOROS_JWT_SECRET ||
      process.env.MODULE_SSO_SECRET ||
      "",
    issuer:
      process.env.OPERATOROS_ISSUER ||
      process.env.OPERATOROS_BASE_URL ||
      "",
    audience: (
      process.env.CHILD_APP_MODULE_KEY ||
      process.env.OPERATOROS_SSO_AUDIENCE ||
      ""
    ).toLowerCase(),
    env: (process.env.OPERATOROS_SSO_ENV || "") as "prod" | "staging" | "dev" | "",
    apiUrl: process.env.OPERATOROS_API_URL || "",
    serviceToken: process.env.OPERATOROS_SERVICE_TOKEN || "",
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
  if (!cfg.serviceToken) {
    throw new Error(
      "[operatoros-sso] OPERATOROS_SERVICE_TOKEN must be set in production so OperatorOS can push entitlement updates.",
    );
  }
}

// Read-only accessor for routes that need the configured service-to-service
// token (the /api/operatoros/entitlements/sync header check).
export function getOperatorOsServiceToken(): string {
  return readEnv().serviceToken;
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
    // Allow ±5s of clock drift between OperatorOS and TorqueShed at the JWT
    // library level so a token whose `exp` is a couple of seconds in the past
    // is still accepted (matching the documented skew tolerance). All other
    // time checks are then enforced explicitly below from a single `now`
    // reading so the verifier behaves deterministically.
    claims = jwt.verify(token, cfg.secret, {
      algorithms: ["HS256"],
      clockTolerance: CLOCK_SKEW_SECONDS,
    }) as OperatorOsClaims;
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
  // If the OperatorOS payload includes target_module_key it must match our
  // configured child-app module key. Older tokens without this claim still
  // pass through for back-compat (the aud + module_slug check above already
  // pins them to this app).
  if (
    claims.target_module_key &&
    typeof claims.target_module_key === "string" &&
    claims.target_module_key.toLowerCase() !== cfg.audience
  ) {
    return err(401, "audience_mismatch");
  }
  if (cfg.env && claims.env !== cfg.env) return err(401, "env_mismatch");

  const nowSeconds = Math.floor((opts.now ? opts.now() : Date.now()) / 1000);
  if (claims.iat - nowSeconds > CLOCK_SKEW_SECONDS) return err(401, "clock_skew");
  // 90s max age is enforced from `iat`, with the same ±5s tolerance applied so
  // a token issued exactly 90s ago isn't rejected over a sub-second drift.
  if (nowSeconds - claims.iat > TOKEN_MAX_AGE_SECONDS + CLOCK_SKEW_SECONDS) {
    return err(401, "expired");
  }

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
