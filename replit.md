# TorqueShed - Automotive Community Platform

## Overview
TorqueShed is a mobile-first automotive community platform designed to connect mechanics, enthusiasts, and DIYers. Its core purpose is to build a strong community around automotive interests, acting as "The Garage for Real People." Key capabilities include brand-specific communities ("Bays"), vehicle maintenance tracking ("Garage"), a diagnostic wizard ("TorqueAssist"), a peer-to-peer marketplace ("Swap Shop"), a curated marketplace for tools ("Shop"), and rich user profiles. The project aims to foster a vibrant community and provide essential tools for automotive repair and maintenance, with a vision to become the leading digital hub for automotive enthusiasts and professionals.

## User Preferences
- Bold, industrial design aesthetic
- Racing Orange as primary accent color
- No emojis in the app
- Mobile-first with iOS 26 liquid glass inspiration
- Dark theme by default (neutral-950 background)
- App must only display real data — no test data, fake counts, or placeholders

## System Architecture

### Frontend
The frontend is a mobile-first application built with React Native and Expo (SDK 54), utilizing TypeScript. It employs React Navigation 7+ for routing, adapting to both mobile (bottom tabs) and desktop (sidebar). Data fetching and state management are handled by `@tanstack/react-query`. Styling uses `StyleSheet.create` and theme-aware hooks, avoiding CSS files. Typography consists of Montserrat for headings and Inter for body text. The brand color palette includes Racing Orange (#FF6B35), Industrial Black (#0D0F12), and Caution Yellow (#F59E0B). UI/UX prioritizes a bold, industrial aesthetic, with a default dark theme and no emojis.

### Backend
The backend is an Express.js server developed in TypeScript, using PostgreSQL as its primary database managed by Drizzle ORM. Authentication is JWT-based, secured with bcrypt for password hashing and middleware (`requireAuth`, `requireAdmin`). The API is RESTful, served under `/api/*`. CORS is configured dynamically, and security includes Helmet headers and a 1MB request body limit. The system includes robust billing and entitlements managed via Stripe, supporting various subscription tiers and one-time charges for expert escalations. Email verification is implemented with secure token handling and a dedicated mailer service.

### Key Features
Core features include a personalized Home Feed, a "Cases" system for automotive problem-solving with a structured "New Case" wizard and "FinalFix" workflow, brand-specific "Bays" (community forums), and "Garage" (build journals with VIN decoding). "TorqueAssist" provides professional diagnostics with decision trees and DTC code integration. The "Market Tab" unifies "Shop," "Swap Shop," and a "Find Parts" search. User Profiles display activity and credibility. The platform also supports saved items, content moderation, and "Shop Pro" features for businesses, including public profiles, service listings, and lead capture. Monetization is handled through a tiered Stripe billing system (Free, DIY Pro, Garage Pro, Shop Pro) with premium-gated features.

### Database Schema
The database schema, managed by Drizzle ORM, comprises tables for users, garages, vehicles, threads, swap shop listings, products, reports, diagnostic sessions, subscriptions, and specialized tables for Shop Pro functionalities like shop services, leads, team members, and case customer summaries.

### OperatorOS SSO
TorqueShed accepts launch handoffs from the OperatorOS parent shell at `GET /sso?token=...`. The token is a short-lived HS256 JWT signed with the shared `MODULE_SSO_SECRET`. The verifier (`server/lib/operatorOsSso.ts`) enforces issuer (`OPERATOROS_BASE_URL`), audience + `module_slug` (`OPERATOROS_SSO_AUDIENCE`, lowercase), env (`OPERATOROS_SSO_ENV`), ±5s clock skew, and a 90s max age, then performs a mandatory single-use `POST {OPERATOROS_API_URL}/v1/modules/sso/consume` with `{jti, aud, env}`. Reject codes returned to the browser: `missing_token` / `bad_request` (400), `signature_invalid` / `issuer_mismatch` / `audience_mismatch` / `env_mismatch` / `expired` / `clock_skew` / `consume_failed` (401), `sso_consume_unavailable` (502), `internal_error` (500 — reserved for our own mint/provisioning failures so it stays distinct from the 401 `consume_failed` mapping). `bad_request` covers a structurally-valid HS256 token whose payload is missing required claims (`sub`, `jti`, `iat`, `exp`). Consume API codes map as: `TOKEN_UNKNOWN`/`TOKEN_REPLAYED` → `consume_failed`, `TOKEN_EXPIRED` → `expired`, `AUDIENCE_MISMATCH` → `audience_mismatch`, `ENV_MISMATCH` → `env_mismatch`, any 5xx → `sso_consume_unavailable`.

On success the route lazily provisions a local user keyed by `users.operator_os_user_id` (caching `email`, `role`, `plan_slug`, `organization_id`, `last_seen_at`), mints a normal TorqueShed JWT via `signJWT`, and 302-redirects to `/sso/bridge?token=...`. The bridge HTML (a) persists the token to `localStorage` under `torqueshed_auth_token`, (b) attempts a `torqueshed://sso?token=...` deep link so a mobile-browser launch is bounced into the native app, and (c) after a 600 ms timeout falls back to `/?ssoToken=<token>` on the web build. `AuthContext` accepts `?ssoToken=` on web boot, persists it, and strips it from the URL via `history.replaceState`. The bridge sanitises its `redirect` query parameter to internal paths only (no `//` or backslash) to prevent the route being abused as an open redirect. Local password login is never possible for SSO-provisioned users — their `passwordHash` is the sentinel `!sso:operatoros`, and `server/routes/auth.ts` short-circuits any login attempt against accounts whose hash starts with `!sso:` with a clear "sign in via OperatorOS" 401. Username collisions during lazy provisioning are resolved by retrying with a numeric suffix (race-safe via a re-select on the unique `operator_os_user_id` index). The `Authorization: Bearer` header is intentionally never used as an SSO transport — only `?token=` on the dedicated `/sso` route.

Required env vars (server fails fast in production if any are missing): `MODULE_SSO_SECRET` (≥16 chars), `OPERATOROS_BASE_URL`, `OPERATOROS_SSO_AUDIENCE`, `OPERATOROS_SSO_ENV` (`prod`|`staging`|`dev`), `OPERATOROS_API_URL`.

### Rate Limiting
Auth and other public endpoints share a single limiter (`server/lib/rateLimit.ts`). When `REDIS_URL` is set the limiter uses Redis (via `ioredis`) so counters are shared across every backend instance — required in production / autoscale deployments to prevent attackers from bypassing limits by hopping between servers. Without `REDIS_URL` it falls back to a per-process in-memory map, which is fine for local dev but **must not be relied on in production**.

### UI Component Library & Error Handling
A custom UI component library ensures consistency, featuring components like `Card`, `Button`, `Input`, and `Skeleton` loaders, with theme-aware primitives. Error handling includes skeleton loaders, branded `EmptyState` components, toast notifications for mutations, and inline form validation, with an `ErrorBoundary` for crash recovery.

## External Dependencies
- **React Native + Expo**: Mobile application framework.
- **Express.js**: Backend server framework.
- **PostgreSQL**: Primary relational database.
- **Drizzle ORM**: Object-Relational Mapper.
- **@tanstack/react-query**: Data fetching and state management.
- **React Navigation**: Navigation for React Native.
- **Stripe**: Payment processing and subscription management.
- **Resend/Postmark**: Email sending services (via `server/lib/mailer.ts`).
- **expo-linear-gradient**: Gradient effects.
- **expo-haptics**: Haptic feedback.
- **expo-clipboard**: Clipboard interaction.
- **expo-web-browser**: In-app web browsing.
- **bcrypt**: Password hashing.
- **jsonwebtoken**: JWT authentication.
- **zod**: Schema validation.
- **Stripe**: Payment processing and subscription management.

### OperatorOS Entitlements (source of truth)
Task #68: OperatorOS owns plans, seats, and module access. TorqueShed never makes its own access decisions from the local `subscriptions` table anymore.

- **Snapshot storage**: `users.entitlement_snapshot_json` (jsonb) holds the latest `EntitlementSnapshot` (`server/lib/operatorOsEntitlements.ts`) — `{ operatoros_user_id, operatoros_tenant_id, module_key, enabled, access_level, features, role, module_role, plan_slug, subscription_status, email, name, updated_at }`. `users.operator_os_tenant_id`, `last_entitlement_sync_at`, and `name` are mirrored alongside `operator_os_user_id` for indexed lookups.
- **Refresh paths**:
  1. SSO launch (`GET /sso`) — the verified JWT may carry `target_module_*` claims; `buildSnapshotFromClaims` writes the snapshot on login.
  2. Server-to-server push — `POST /api/operatoros/entitlements/sync` accepts an `EntitlementSnapshot` body authenticated with the `X-OperatorOS-Service-Token` header (compared with `timingSafeEqual` against `OPERATOROS_SERVICE_TOKEN`). Returns 401 on bad/missing token, 404 if `operatoros_user_id` is unknown.
  3. Client read — `GET /api/entitlements/me` returns the cached snapshot plus derived `{ tier, role, features, moduleDisabled, readOnly, manageBillingUrl }`. Used by `client/lib/entitlements.ts#useEntitlements`.
- **Tier mapping** (`snapshotTier`): `plan_slug` (`diy_pro|garage_pro|shop_pro|free`) wins when present, otherwise `access_level` maps `owner→shop_pro`, `admin→garage_pro`, `user→diy_pro`, `viewer/none→free`. Any `subscription_status` outside `{active, trialing, past_due, ok, in_trial, ""}` collapses to `free`.
- **Module disabled / read-only**: `snapshot.enabled === false` or `access_level === "none"` flags the user as module-disabled — the client routes them to `AccessDeniedScreen` with a "Manage Billing in OperatorOS" link, and server requireFeature responds 403 `{code:"module_disabled", managedBy:"operatoros"}`. `access_level === "viewer"` flags read-only and is surfaced on the client.
- **Local role**: `snapshotLocalRole` maps owner/admin (or `module_admin`/`tenant_admin`/`owner` role strings) → `admin`, everything else → `user`.
- **Required env vars** (in addition to the SSO ones above): `OPERATOROS_SERVICE_TOKEN` (mandatory in production; ≥16 chars) for the sync endpoint. Also accepted as aliases: `OPERATOROS_JWT_SECRET`/`OPERATOROS_ISSUER`/`CHILD_APP_MODULE_KEY`.
- **Billing UI**: `BillingScreen` and `SubscriptionScreen` are read-only — they display the current tier from OperatorOS plus a "Manage Billing in OperatorOS" link to `OPERATOROS_BASE_URL`. No checkout / portal buttons remain.
- **Legacy Stripe code**: `server/stripe.ts`, `stripeBilling.ts`, `stripeClient.ts`, `stripeWebhookRoute.ts`, `webhookEventHandlers.ts`, `server/routes/subscriptions.ts` are marked `// DORMANT (task #68)`. They still load so the server boots without `STRIPE_*` env vars, but no live access decisions flow through them.

### Billing & Entitlements (legacy / dormant)
Subscription tiers (DIY Pro, Garage Pro, Shop Pro) ship with both monthly and annual prices. The `subscriptions` table stores `interval` (`month`|`year`) and `trialEndsAt` so the client can render a trial countdown and a "Renews YYYY-MM-DD" line on the Billing screen. New paying customers automatically receive a 14-day free trial via Stripe Checkout `trial_period_days` (gated on `!subscription.stripeSubscriptionId`, so reactivations skip the trial).

Required Stripe env vars:
- `STRIPE_PRICE_DIY_PRO`, `STRIPE_PRICE_GARAGE_PRO`, `STRIPE_PRICE_SHOP_PRO` — monthly recurring price IDs (baseline; missing IDs put the app into `missing_config` mode).
- `STRIPE_PRICE_DIY_PRO_ANNUAL`, `STRIPE_PRICE_GARAGE_PRO_ANNUAL`, `STRIPE_PRICE_SHOP_PRO_ANNUAL` — yearly price IDs ($99 / $290 / $790). When all three are present, `/api/subscription` reports `annualPricesConfigured: true` and the SubscriptionScreen renders the Monthly/Annual toggle with a "2 months free" badge.
- `STRIPE_WEBHOOK_SECRET` and `STRIPE_BILLING_RETURN_URL` as before.

Run `npx tsx scripts/seed-stripe-tiers.ts` in test mode to (idempotently) create products and both monthly + annual prices tagged `metadata.tier` and `metadata.interval`. Copy the printed price IDs into the env vars above.
- **Resend / Postmark**: Email sending providers.
