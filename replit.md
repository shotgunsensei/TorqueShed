# TorqueShed - Automotive Community Platform

## Overview
TorqueShed is a mobile-first automotive community platform designed to connect mechanics, enthusiasts, and DIYers. It offers features like chatrooms, forums, vehicle tracking, parts finding, and a curated marketplace. The platform's vision is to be "The Garage for Real People," fostering a strong community around automotive interests. Key capabilities include brand-specific communities ("Bays"), real-time chat, discussion threads, vehicle maintenance tracking ("Notes"), a diagnostic and parts assistant ("TorqueAssist"), a peer-to-peer marketplace ("Swap Shop"), and a curated section for tools and gear ("Tool & Gear").

## User Preferences
- Bold, industrial design aesthetic
- Racing Orange as primary accent color
- No emojis in the app
- Mobile-first with iOS 26 liquid glass inspiration
- Dark theme by default (neutral-950 background)

## System Architecture

### UI/UX Design
The platform features a custom component system with an automotive-themed design. The brand identity is "TorqueShed" with "The Garage for Real People" as its tagline. The primary color is Racing Orange (#FF6B35), with Industrial Black (#0D0F12) as a secondary and Caution Yellow (#F59E0B) as an accent. Bay-specific brand colors are used for major automotive brands. Typography uses Montserrat for headings and Inter for body text. UI components include cards with subtle shadows, animated press feedback, Floating Action Buttons (FABs), and segmented controls.

### Technical Implementation
The platform uses a mobile-first approach with a React Native + Expo frontend written in TypeScript. The backend is an Express.js server, also in TypeScript, and data is stored in a PostgreSQL database.

**Key Features:**
- **Bays**: Brand-specific community chatrooms (Ford, Dodge, Chevy, Jeep, General) and a dedicated Swap Shop Bay.
- **Realtime Chat & Threads**: Live chat communication and discussion threads within Bays. Messages display user credibility signals (years wrenching, focus areas).
- **Notes**: Vehicle tracking with VIN/YMM, allowing users to document maintenance and modifications.
- **TorqueAssist**: A vehicle-aware diagnostic and parts assistant providing structured guidance, likely causes, recommended checks, torque specs, and suggested parts. It includes ethical monetization practices with transparent affiliate links.
- **Swap Shop**: A peer-to-peer marketplace for buying, selling, and trading automotive parts.
- **Tool & Gear**: A curated marketplace for automotive tools and gear, with a vendor submission process for admin approval.
- **User Profiles**: Detailed profiles with credibility fields such as `focusAreas`, `vehiclesWorkedOn`, `yearsWrenching`, and `shopAffiliation`.
- **Content Moderation**: Reporting system for inappropriate content.

### System Design Choices
- **Responsive Web Layout**: The app supports both mobile and desktop viewports. On desktop (width >= 1024px), a sidebar navigation replaces bottom tabs. Screens use responsive grid layouts (1 column on mobile, 2-3 columns on tablet, 3-4 columns on desktop). The `useResponsive` hook provides breakpoint detection.
- **Navigation**: Utilizes React Navigation with a `RootStackNavigator` encompassing a `ResponsiveNavigator` that switches between bottom tabs (mobile) and sidebar navigation (desktop). Modal screens for adding vehicles, notes, submitting products, and user profiles.
- **Data Management**: React Query is used for client-side data fetching and caching. WebSocket at `/ws/chat` for real-time communication.
- **Database Schema**: PostgreSQL with Drizzle ORM managing users, garages, garage members, chat messages, vehicles, vehicle notes, and reports. User credibility fields are stored in the `users` table.
- **API**: A RESTful API under `/api/*` for managing garages, messages, user profiles, reports, TorqueAssist queries, and products. Rate limiting (10 requests/min/client) and caching (5 min TTL) are implemented for TorqueAssist.
- **Monetization Ethics**: TorqueAssist features ethical monetization with transparent disclosure of affiliate links, offering multiple vendors (mixing affiliate and non-affiliate), prioritizing relevance over commission, and requiring explicit user action for external links.
- **Tool & Gear Monetization**: Curated product discovery with `whyItMatters` context boxes, sponsored product badges (yellow "Sponsored" in top-left), "View Deal" CTAs, admin-only CRUD via x-admin-user-id header authentication. Products table includes: title, description, whyItMatters, price, priceRange, category, affiliateLink, vendor, imageUrl, isSponsored, isApproved.

### Recent API Integration (Feb 2026)
All major features now use real database storage instead of stub data:
- **Vehicles API** (`/api/vehicles`): Full CRUD for user vehicles with VIN/YMM tracking. Requires authentication. Frontend screens: NotesScreen, AddVehicleScreen.
- **Vehicle Notes API** (`/api/vehicles/:vehicleId/notes`, `/api/notes/:id`): Maintenance and modification notes per vehicle. Frontend screens: VehicleDetailScreen, AddNoteScreen.
- **Threads API** (`/api/garages/:garageId/threads`, `/api/threads/:id`): Bay discussion threads with replies and solution marking. Frontend: GarageDetailScreen (Threads tab).
- **Swap Shop API** (`/api/swap-shop`): Peer-to-peer parts marketplace with condition ratings and shipping options. Frontend: SwapShopScreen (with fallback to stub data if empty).

## Project Structure

### Folder Layout
- `client/` - React Native + Expo frontend (TypeScript)
- `server/` - Express.js backend (TypeScript)
- `shared/` - Server-only shared code (Drizzle schema, TorqueAssist types)
- `assets/` - Static assets (images, fonts)
- `scripts/` - Build scripts

### Path Aliases
- `@/*` → `./client/*` (frontend imports)
- `@shared/*` → `./shared/*` (server-only, NOT for client use)

### Important Notes
- The `shared/` folder contains Drizzle ORM schema and is server-only
- Client types are defined locally in `client/` (e.g., `client/hooks/useWebSocket.ts`, `client/constants/products.ts`)
- Do not import from `@shared/*` in client code
- Use `useSafeTabBarHeight()` hook instead of `useBottomTabBarHeight()` for screens that need tab bar padding - it safely returns 0 on desktop where sidebar navigation is used instead of bottom tabs

## External Dependencies
- **React Native + Expo**: For mobile application development.
- **Express.js**: For the backend server.
- **PostgreSQL**: As the primary database.
- **Drizzle ORM**: For interacting with the PostgreSQL database.
- **WebSockets**: For real-time chat functionality.