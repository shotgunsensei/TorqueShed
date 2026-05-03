# TorqueShed - Automotive Community Platform

## Overview
TorqueShed is a mobile-first automotive community platform connecting mechanics, enthusiasts, and DIYers. It aims to be "The Garage for Real People," fostering a vibrant community around automotive interests. Key capabilities include brand-specific communities ("Bays"), vehicle maintenance tracking ("Garage"), a step-by-step diagnostic wizard ("TorqueAssist"), a peer-to-peer marketplace ("Swap Shop"), a curated marketplace for tools and gear ("Shop"), and rich user profiles with credibility signals. The project's vision is to provide essential tools for automotive repair and maintenance, building a strong, engaged community.

## User Preferences
- Bold, industrial design aesthetic
- Racing Orange as primary accent color
- No emojis in the app
- Mobile-first with iOS 26 liquid glass inspiration
- Dark theme by default (neutral-950 background)
- App must only display real data — no test data, fake counts, or placeholders

## System Architecture

### Frontend
The frontend is a React Native and Expo (SDK 54) application written in TypeScript, ensuring a mobile-first experience with responsive design adapting to different device sizes. Navigation is managed by React Navigation 7+. Data fetching and state management are handled by `@tanstack/react-query`. Styling uses `StyleSheet.create` and theme-aware hooks, avoiding CSS files, with Montserrat for headings and Inter for body text. The brand color palette includes Racing Orange (#FF6B35), Industrial Black (#0D0F12), and Caution Yellow (#F59E0B). A custom UI component library provides consistent elements like `Card`, `Button`, `FAB`, `EmptyState`, `Skeleton`, `StatusBadge`, `UserAvatar`, `Input`, and theme-aware primitives, alongside an `ErrorBoundary` for crash recovery. Error handling includes skeleton loaders, branded `EmptyState` components, toast notifications, and inline form validation.

### Backend
The backend is an Express.js server in TypeScript, using PostgreSQL as its primary database managed by Drizzle ORM. Authentication is JWT-based with bcrypt for password hashing and secure access control middleware (`requireAuth`, `requireAdmin`). The API is RESTful, served under `/api/*`. CORS is dynamically configured, and security is enhanced with Helmet headers and a 1MB request body limit. The system includes robust email verification with a dedicated table and a configurable mailer service supporting Resend or Postmark. Billing is integrated with Stripe for subscription management and one-time charges, supporting multiple tiers (Free, DIY Pro, Garage Pro, Shop Pro) with server-side enforcement of features based on user entitlements.

### Key Features
- **Community & Content:** Personalized Home Feed, Cases for problem-solving with a "New Case" wizard, brand-specific "Bays" (Garages), vehicle "Garage" (Build Journal) with VIN decoding, structured replies, and "FinalFix" for case resolution.
- **Diagnostic & Marketplace:** "TorqueAssist" provides professional diagnostics with decision trees. The "Market Tab" unifies a curated "Shop," a peer-to-peer "Swap Shop," and a "Find Parts" search.
- **User Management:** Rich User Profiles with activity and credibility badges, Saved Items functionality, and Content Moderation tools.
- **Business Features:** "Shop Pro" offers features for businesses, including public profiles, service listings, lead capture, and team management.
- **Monetization:** Stripe billing supports multiple tiers (Free, DIY Pro, Garage Pro, Shop Pro) with premium-gated features like advanced diagnostics, full parts/tools panels, expert reviews, PDF repair plans, multi-vehicle tracking, and Shop Pro functionalities.

### Database Schema
The Drizzle ORM-managed schema includes tables for `users`, `garages`, `vehicles`, `threads`, `swapShopListings`, `products`, `reports`, `diagnosticSessions`, `subscriptions`, `email_verifications`, and `Shop Pro` related tables such as `shopServices`, `shopLeads`, `shopTeamMembers`, and `caseCustomerSummaries`.

## External Dependencies
- **React Native + Expo**: Mobile application development framework.
- **Express.js**: Backend web application framework.
- **PostgreSQL**: Relational database.
- **Drizzle ORM**: ORM for database interactions.
- **@tanstack/react-query**: Data fetching and state management.
- **React Navigation**: In-app navigation.
- **Stripe**: Payment processing and subscription management.
- **bcrypt**: Password hashing library.
- **jsonwebtoken**: JWT-based authentication.
- **zod**: Schema validation.
- **expo-linear-gradient, expo-haptics, expo-clipboard, expo-web-browser**: Expo SDK modules for specific mobile functionalities.