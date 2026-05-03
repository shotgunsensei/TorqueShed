import type { Request, Response, NextFunction } from "express";

// Shared rate limiter — Redis-aware when REDIS_URL is set, otherwise per-process
// in-memory. This is the single rate-limiter used by every public/auth endpoint
// in the app; routes pass their own bucket name + max + window so behaviour
// stays per-endpoint while the storage backend is shared.

interface RedisClientLike {
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  on(event: string, listener: (...args: unknown[]) => void): void;
}

let redisClient: RedisClientLike | null = null;
let redisEnabled = false;

async function initRedis(): Promise<void> {
  if (redisClient !== null || !process.env.REDIS_URL) return;
  try {
    const { default: Redis } = await import("ioredis");
    const client = new Redis(process.env.REDIS_URL);
    client.on("error", (err: Error) => {
      // Loud — losing Redis means rate limits silently degrade to per-process,
      // which is the exact bypass this module exists to prevent in production.
      console.error(
        "[RateLimiter] CRITICAL: Redis error, falling back to in-memory limiter (rate limits no longer shared across instances):",
        err.message,
      );
      redisEnabled = false;
    });
    client.on("connect", () => {
      console.log("[RateLimiter] Redis connected — rate limits scale across instances");
      redisEnabled = true;
    });
    redisClient = client as unknown as RedisClientLike;
  } catch (err) {
    console.error(
      "[RateLimiter] CRITICAL: REDIS_URL is set but Redis client failed to initialise — production rate limits will NOT be shared across instances:",
      err,
    );
    redisEnabled = false;
  }
}

initRedis().catch(() => {});

export function isRedisRateLimitEnabled(): boolean {
  return redisEnabled;
}

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export interface RateLimitOptions {
  key: string;
  max: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

function checkInMemory(opts: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(opts.key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(opts.key, { count: 1, resetAt: now + opts.windowMs });
    return { allowed: true, remaining: opts.max - 1, retryAfterSeconds: 0 };
  }
  if (existing.count >= opts.max) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }
  existing.count += 1;
  return {
    allowed: true,
    remaining: Math.max(0, opts.max - existing.count),
    retryAfterSeconds: 0,
  };
}

async function checkRedisWith(
  client: RedisClientLike,
  opts: RateLimitOptions,
): Promise<RateLimitResult> {
  const key = `ratelimit:${opts.key}`;
  const windowSeconds = Math.max(1, Math.ceil(opts.windowMs / 1000));
  try {
    const current = await client.incr(key);
    if (current === 1) await client.expire(key, windowSeconds);
    if (current > opts.max) {
      return { allowed: false, remaining: 0, retryAfterSeconds: windowSeconds };
    }
    return { allowed: true, remaining: opts.max - current, retryAfterSeconds: 0 };
  } catch (err) {
    console.error("[RateLimiter] Redis check failed, falling back to in-memory:", err);
    return checkInMemory(opts);
  }
}

export async function checkRateLimit(opts: RateLimitOptions): Promise<RateLimitResult> {
  if (redisEnabled && redisClient) return checkRedisWith(redisClient, opts);
  return checkInMemory(opts);
}

// Testing-only: build a checker bound to a specific Redis client. Used to
// simulate two backend instances sharing one Redis bucket — each instance
// gets its own client wrapper, but both point at the same backend state.
export function _checkRateLimitWithClient(
  client: RedisClientLike,
  opts: RateLimitOptions,
): Promise<RateLimitResult> {
  return checkRedisWith(client, opts);
}

// Testing-only: inject a fake Redis client and toggle the enabled flag so
// the public checkRateLimit() routes through the Redis path. Lets tests
// verify production wiring without spinning up a real Redis server.
export function _setRedisForTesting(client: RedisClientLike | null, enabled: boolean): void {
  redisClient = client;
  redisEnabled = enabled;
}

function clientIp(req: Request): string {
  return (
    req.ip ||
    (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ||
    "unknown"
  );
}

export function rateLimited(bucket: string, max: number, windowMs: number) {
  return async function rateLimitMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const result = await checkRateLimit({
      key: `${bucket}:${clientIp(req)}`,
      max,
      windowMs,
    });

    if (!result.allowed) {
      res.setHeader("Retry-After", String(result.retryAfterSeconds));
      res.status(429).json({
        error: "Too Many Requests",
        message: `Rate limit exceeded. Try again in ${result.retryAfterSeconds}s.`,
        retryAfterSeconds: result.retryAfterSeconds,
      });
      return;
    }

    next();
  };
}

export function _resetRateLimits(): void {
  buckets.clear();
}
