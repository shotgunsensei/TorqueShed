# TorqueShed - Automotive Community Platform

## Overview
TorqueShed is a mobile-first automotive community platform designed to connect mechanics, enthusiasts, and DIYers, aiming to be "The Garage for Real People." It fosters a community around automotive interests by offering brand-specific communities ("Bays"), vehicle maintenance tracking ("Garage"), a diagnostic wizard ("TorqueAssist"), a peer-to-peer marketplace ("Swap Shop"), a curated tools marketplace ("Shop"), and rich user profiles. The project's vision is to create a vibrant, engaged community while providing essential tools for automotive repair and maintenance.

## User Preferences
- Bold, industrial design aesthetic
- Racing Orange as primary accent color
- No emojis in the app
- Mobile-first with iOS 26 liquid glass inspiration
- Dark theme by default (neutral-950 background)
- App must only display real data — no test data, fake counts, or placeholders

## System Architecture

### UI/UX Decisions
The platform features a bold, industrial design with Racing Orange as the primary accent. It's mobile-first, inspired by iOS 26 liquid glass, and defaults to a dark theme (neutral-950 background). Typography uses Montserrat for headings and Inter for body text. The color palette includes Racing Orange (#FF6B35), Industrial Black (#0D0F12), and Caution Yellow (#F59E0B). A custom UI component library ensures consistency, including `Card`, `Button`, `FAB`, `EmptyState`, `Skeleton` loaders, `StatusBadge`, `UserAvatar`, `Input`, and theme-aware primitives.

### Technical Implementations
The frontend is built with React Native and Expo (SDK 54) using TypeScript, employing React Navigation 7+ for responsive navigation. `@tanstack/react-query` handles data fetching and state management. Styling uses `StyleSheet.create` and theme-aware hooks.
The backend is an Express.js server in TypeScript, using PostgreSQL with Drizzle ORM. Authentication is JWT-based with bcrypt for password hashing. API is RESTful (`/api/*`), with CORS configured dynamically. Security includes Helmet and request body limits. Email verification uses `email_verifications` table with hashed tokens and a custom mailer (`resend` or `postmark`). Billing is integrated with Stripe for subscription management and one-time expert escalations, enforced via server-side checks and middleware.

### Feature Specifications
- **Home Feed**: Personalized content.
- **Cases**: Automotive problem-solving hub with search, filtering, and a "New Case" wizard. Supports structured replies and a "FinalFix" workflow.
- **Bays (Garages)**: Brand-specific community forums.
- **Garage (Build Journal)**: Vehicle build journals with VIN decoding.
- **TorqueAssist**: Diagnostic engine with decision trees and DTC integration.
- **Market Tab**: Integrates a curated "Shop," a peer-to-peer "Swap Shop," and a "Find Parts" search.
- **User Profiles**: Detailed profiles with activity and credibility badges.
- **Saved Items**: Bookmark functionality.
- **Content Moderation**: Reporting system and admin review.
- **Shop Pro**: Business features including profiles, service listings, lead capture, and team management.
- **Monetization**: Four tiers (Free, DIY Pro, Garage Pro, Shop Pro) with premium-gated features like advanced diagnostics, full parts/tools access, expert reviews, and PDF exports.

### System Design Choices
Error handling includes skeleton loaders, `EmptyState` components, toast notifications, and inline form validation. An `ErrorBoundary` is implemented for crash recovery. The database schema includes tables for users, garages, vehicles, threads, listings, products, reports, diagnostic sessions, subscriptions, and specialized Shop Pro features.

## External Dependencies
- **React Native + Expo**: Mobile application development.
- **Express.js**: Backend web framework.
- **PostgreSQL**: Relational database.
- **Drizzle ORM**: Database interaction.
- **@tanstack/react-query**: Data fetching and state management.
- **React Navigation**: Application navigation.
- **expo-linear-gradient**: Gradient effects.
- **expo-haptics**: Haptic feedback.
- **expo-clipboard**: Clipboard functionality.
- **expo-web-browser**: In-app web browsing.
- **bcrypt**: Password hashing.
- **jsonwebtoken**: JWT authentication.
- **zod**: Schema validation.
- **Stripe**: Payment processing and subscription management.
- **Resend / Postmark**: Email sending providers.