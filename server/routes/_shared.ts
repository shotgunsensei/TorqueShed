// AUTO-GENERATED from server/routes.ts split. See task #51.
import type { Request } from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { storage } from "../storage";
import { userHasFeature } from "../entitlements";
import { getStripeClient } from "../stripe";

// Returns true if `objectUrl` is still referenced by any active thread,
// thread reply, or swap-shop listing. Used to guard cleanup of legacy
// (non-user-scoped) object paths that may have been shared across records.
export async function isObjectStillReferenced(objectUrl: string): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT 1 FROM threads
      WHERE photo_urls::jsonb ? ${objectUrl}
         OR video_urls::jsonb ? ${objectUrl}
    UNION ALL
    SELECT 1 FROM thread_replies
      WHERE photo_urls::jsonb ? ${objectUrl}
         OR video_urls::jsonb ? ${objectUrl}
    UNION ALL
    SELECT 1 FROM swap_shop_listings
      WHERE image_url = ${objectUrl}
         OR extra_image_urls::jsonb ? ${objectUrl}
    LIMIT 1
  `);
  const rows = (result as unknown as { rows?: unknown[] }).rows;
  if (Array.isArray(rows)) return rows.length > 0;
  if (Array.isArray(result)) return (result as unknown[]).length > 0;
  return false;
}

// Team-aware thread access: returns true if requester is the case author,
// a global admin, or a Shop Pro team member of the case author with one of
// the allowed roles AND the author has the team_access feature.
export async function hasThreadAccess(
  thread: { userId: string | null },
  userId: string,
  userRole: string | undefined,
  allowedTeamRoles: ("owner" | "admin" | "technician" | "viewer")[],
): Promise<boolean> {
  if (userRole === "admin") return true;
  if (thread.userId && thread.userId === userId) return true;
  if (!thread.userId) return false;
  const role = await storage.getTeamRole(thread.userId, userId);
  if (!role || !(allowedTeamRoles as string[]).includes(role)) return false;
  return await userHasFeature(thread.userId, "team_access");
}

export function pickReturnBaseUrl(req: Request): string {
  const explicit = process.env.STRIPE_BILLING_RETURN_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const origin = req.header("origin");
  if (origin && /^https?:\/\//.test(origin)) return origin.replace(/\/+$/, "");
  const proto = req.header("x-forwarded-proto") || req.protocol || "https";
  const host = req.header("x-forwarded-host") || req.get("host");
  return `${proto}://${host}`;
}

export function getReturnBaseUrl(req: Request): string {
  const explicit = process.env.EXPO_PUBLIC_DOMAIN || process.env.PUBLIC_BASE_URL;
  if (explicit) {
    return explicit.startsWith("http") ? explicit : `https://${explicit}`;
  }
  const forwardedProto = req.header("x-forwarded-proto");
  const protocol = forwardedProto || req.protocol || "https";
  const forwardedHost = req.header("x-forwarded-host");
  const host = forwardedHost || req.get("host") || "localhost";
  return `${protocol}://${host}`;
}

export async function ensureStripeCustomerForUser(userId: string): Promise<string> {
  const existing = await storage.getSubscription(userId);
  if (existing?.stripeCustomerId) return existing.stripeCustomerId;
  const user = await storage.getUser(userId);
  if (!user) throw new Error("User not found");
  const stripe = await getStripeClient();
  const customer = await stripe.customers.create({
    name: user.username,
    metadata: { userId, username: user.username },
  });
  await storage.setStripeCustomerId(userId, customer.id);
  return customer.id;
}

export const FREE_SAVED_THREAD_LIMIT = 3;
