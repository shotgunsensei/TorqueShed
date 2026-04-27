# TorqueShed - Automotive Community Platform

## Overview
TorqueShed is a mobile-first automotive community platform connecting mechanics, enthusiasts, and DIYers. Its purpose is to be "The Garage for Real People," building a strong community around automotive interests. Key capabilities include brand-specific communities ("Bays"), vehicle maintenance tracking ("Garage"), a step-by-step diagnostic wizard ("TorqueAssist"), a peer-to-peer marketplace ("Swap Shop"), a curated marketplace for tools and gear ("Shop"), and rich user profiles with credibility signals. The project aims to foster a vibrant, engaged community and provide essential tools for automotive repair and maintenance.

## User Preferences
- Bold, industrial design aesthetic
- Racing Orange as primary accent color
- No emojis in the app
- Mobile-first with iOS 26 liquid glass inspiration
- Dark theme by default (neutral-950 background)
- App must only display real data — no test data, fake counts, or placeholders

## System Architecture

### Frontend (Expo + React Native)
The frontend is built with React Native and Expo (SDK 54) using TypeScript. It uses React Navigation 7+ for navigation, featuring a responsive design that adapts bottom tabs for mobile and a sidebar for desktop. Data fetching and state management are handled by `@tanstack/react-query`. Styling is implemented with `StyleSheet.create` and theme-aware hooks, specifically avoiding CSS files. Typography utilizes Montserrat for headings and Inter for body text. The brand color palette includes Racing Orange (#FF6B35), Industrial Black (#0D0F12), and Caution Yellow (#F59E0B).

### Backend (Express + PostgreSQL)
The backend is an Express.js server developed with TypeScript, running on port 5000. It uses PostgreSQL as its primary database, managed by Drizzle ORM. Authentication is JWT-based, incorporating bcrypt for password hashing and middleware for secure access control (`requireAuth`, `requireAdmin`). The API is RESTful, served under `/api/*`. CORS is configured dynamically from environment variables and hardcoded production domains. Security measures include Helmet headers, trust proxy settings, and a 1MB request body limit.

### Key Features
- **Home Feed**: Personalized content based on user onboarding goals.
- **Cases**: Central hub for automotive problem-solving, featuring a flat feed, search, quick actions, and filtering. Includes a "New Case" wizard for structured problem reporting.
- **Bays (Garages)**: Brand-specific community forums with discussion threads and credibility signals.
- **Garage (Build Journal)**: Vehicle build journals for tracking maintenance, modifications, and issues, with VIN decoding.
- **Structured Replies & Solved Cases**: Advanced reply composer with type-specific badges and a verified "FinalFix" workflow for case resolution.
- **TorqueAssist**: A professional diagnostic engine with decision trees, DTC code integration, and session persistence, providing ranked hypotheses and test procedures.
- **Market Tab**: A unified hub for parts and tools, integrating a curated "Shop," a peer-to-peer "Swap Shop," and a "Find Parts" search across major vendors.
- **User Profiles**: Detailed profiles showcasing user activity, vehicles, and credibility badges.
- **Saved Items**: Functionality for users to bookmark threads and listings.
- **Content Moderation**: Reporting system for user-generated content, with an admin review interface.
- **Shop Pro**: Features for businesses including public profiles, service listings, lead capture, and team management.
- **Monetization**: Premium tiers (DIY Pro $9.99/mo, Garage Pro $29/mo, Shop Pro $79/mo) gate diagnostic depth, parts & tools panels, repair plan exports, multi-vehicle features, and shop dashboards. Live Stripe billing is wired via the Replit Stripe connector: `server/stripeClient.ts` (cred lookup), `server/stripeBilling.ts` (Checkout, Portal, tier→price resolution by `metadata.tier`, webhook reconcile), `server/webhookHandlers.ts` + `/api/stripe/webhook` route in `server/index.ts` (raw-body, registered before `express.json()`), and `stripe-replit-sync` for managed webhook + Stripe→Postgres mirror. Run `npx tsx scripts/seed-stripe-tiers.ts` to (re)create the three priced products tagged with `metadata.tier`.

### Database Schema
The database schema, managed by Drizzle ORM, includes tables for `users`, `garages`, `vehicles`, `threads`, `swapShopListings`, `products`, `reports`, `diagnosticSessions`, `subscriptions`, and specialized tables for `Shop Pro` features like `shopServices`, `shopLeads`, `shopTeamMembers`, and `caseCustomerSummaries`. `swapShopListings` is extended to support categories and case-specific recommendations.

### UI Component Library
A custom UI component library ensures consistency and reusability, including `Card`, `Button`, `FAB`, `EmptyState`, `Skeleton` loaders, `StatusBadge`, `UserAvatar`, `Input`, and theme-aware primitives (`ThemedText`, `ThemedView`). An `ErrorBoundary` is in place for crash recovery.

### Error Handling
Comprehensive error handling includes skeleton loaders for data fetching, branded `EmptyState` components for errors and empty states, toast notifications for mutation failures, and inline validation for forms.

## External Dependencies
- **React Native + Expo**: Mobile application framework.
- **Express.js**: Backend server framework.
- **PostgreSQL**: Primary relational database.
- **Drizzle ORM**: Object-Relational Mapper for database interaction.
- **@tanstack/react-query**: Data fetching, caching, and state management library.
- **React Navigation**: Navigation solution for React Native applications.
- **expo-linear-gradient**: For applying gradient effects.
- **expo-haptics**: For providing haptic feedback.
- **expo-clipboard**: For clipboard interaction.
- **expo-web-browser**: For opening web links within the app.
- **bcrypt**: Library for hashing passwords.
- **jsonwebtoken**: For implementing JWT-based authentication.
- **zod**: Schema declaration and validation library.