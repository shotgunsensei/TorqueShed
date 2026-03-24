# TorqueShed - Automotive Community Platform

## Overview
TorqueShed is a mobile-first automotive community platform designed to connect mechanics, enthusiasts, and DIYers. It aims to be "The Garage for Real People," fostering a strong community around automotive interests. Key features include brand-specific communities ("Bays"), vehicle maintenance tracking ("Garage"), a step-by-step diagnostic wizard ("TorqueAssist"), a peer-to-peer marketplace ("Swap Shop"), and a curated marketplace for tools and gear ("Shop").

## User Preferences
- Bold, industrial design aesthetic
- Racing Orange as primary accent color
- No emojis in the app
- Mobile-first with iOS 26 liquid glass inspiration
- Dark theme by default (neutral-950 background)

## System Architecture

### UI/UX Design
The platform features a custom component system with an automotive theme. The brand identity is "TorqueShed" with "The Garage for Real People" as its tagline. The primary color is Racing Orange (#FF6B35), with Industrial Black (#0D0F12) as a secondary and Caution Yellow (#F59E0B) as an accent. Typography uses Montserrat for headings and Inter for body text. UI components include cards, animated press feedback, Floating Action Buttons (FABs), and segmented controls. The design supports responsive layouts for mobile and desktop, utilizing a sidebar navigation on larger screens.

### Technical Implementation
The platform uses a mobile-first approach with a React Native + Expo frontend written in TypeScript. The backend is an Express.js server, also in TypeScript, and data is stored in a PostgreSQL database.

**Key Features:**
- **Bays**: Brand-specific community forums with discussion threads and user credibility signals.
- **Garage (Build Journal)**: Vehicle build journals with typed entries (maintenance, mod, issue, general), tracking cost, mileage, and parts.
- **TorqueAssist**: A step-by-step diagnostic wizard providing interactive checklists and suggested parts, running locally with predefined patterns.
- **Source Tab**: A unified parts sourcing hub featuring a curated "Shop", a peer-to-peer "Swap Shop", and a "Find Parts" search across major vendors.
- **User Profiles**: Detailed profiles with credibility fields like `focusAreas` and `yearsWrenching`.
- **Content Moderation**: A reporting system for inappropriate content.

### System Design Choices
- **Responsive Layout**: Adapts for mobile and desktop viewports, switching between bottom tabs and sidebar navigation.
- **Navigation**: Uses React Navigation with a `RootStackNavigator` and `ResponsiveNavigator`.
- **Data Management**: React Query for client-side data fetching and caching.
- **Database Schema**: PostgreSQL with Drizzle ORM managing users, garages, vehicles, notes, threads, and marketplace items.
- **API**: A RESTful API under `/api/*` for managing all platform data.
- **Monetization Ethics**: TorqueAssist transparently uses affiliate links, prioritizing relevance and user action. The "Shop" features curated products with context boxes and sponsored product badges.

## External Dependencies
- **React Native + Expo**: For mobile application development.
- **Express.js**: For the backend server.
- **PostgreSQL**: As the primary database.
- **Drizzle ORM**: For interacting with the PostgreSQL database.