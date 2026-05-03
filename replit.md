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

### Billing & Entitlements
Subscription tiers (DIY Pro, Garage Pro, Shop Pro) ship with both monthly and annual prices. The `subscriptions` table stores `interval` (`month`|`year`) and `trialEndsAt` so the client can render a trial countdown and a "Renews YYYY-MM-DD" line on the Billing screen. New paying customers automatically receive a 14-day free trial via Stripe Checkout `trial_period_days` (gated on `!subscription.stripeSubscriptionId`, so reactivations skip the trial).

Required Stripe env vars:
- `STRIPE_PRICE_DIY_PRO`, `STRIPE_PRICE_GARAGE_PRO`, `STRIPE_PRICE_SHOP_PRO` — monthly recurring price IDs (baseline; missing IDs put the app into `missing_config` mode).
- `STRIPE_PRICE_DIY_PRO_ANNUAL`, `STRIPE_PRICE_GARAGE_PRO_ANNUAL`, `STRIPE_PRICE_SHOP_PRO_ANNUAL` — yearly price IDs ($99 / $290 / $790). When all three are present, `/api/subscription` reports `annualPricesConfigured: true` and the SubscriptionScreen renders the Monthly/Annual toggle with a "2 months free" badge.
- `STRIPE_WEBHOOK_SECRET` and `STRIPE_BILLING_RETURN_URL` as before.

Run `npx tsx scripts/seed-stripe-tiers.ts` in test mode to (idempotently) create products and both monthly + annual prices tagged `metadata.tier` and `metadata.interval`. Copy the printed price IDs into the env vars above.
- **Resend / Postmark**: Email sending providers.
