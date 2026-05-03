import type { Request, Response, NextFunction } from "express";

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

export async function checkRateLimit(opts: RateLimitOptions): Promise<RateLimitResult> {
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

function clientIp(req: Request): string {
  return req.ip || (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() || "unknown";
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
