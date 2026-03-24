# TorqueShed - Automotive Community Platform

## Overview
TorqueShed is a mobile-first automotive community platform designed to connect mechanics, enthusiasts, and DIYers. It offers features like forums, vehicle tracking, diagnostic tools, and a curated marketplace. The platform's vision is to be "The Garage for Real People," fostering a strong community around automotive interests. Key capabilities include brand-specific communities ("Bays"), discussion threads, vehicle maintenance tracking ("Notes"), a step-by-step diagnostic wizard ("TorqueAssist"), a peer-to-peer marketplace ("Swap Shop"), and a curated section for tools and gear ("Tool & Gear").

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
- **Bays**: Brand-specific community forums (Ford, Dodge, Chevy, Jeep, General) with discussion threads.
- **Forum Threads**: Discussion threads within Bays for community Q&A. Messages display user credibility signals (years wrenching, focus areas). Chat feature has been removed in favor of forum-style discussions.
- **Notes**: Vehicle tracking with VIN/YMM, allowing users to document maintenance and modifications.
- **TorqueAssist**: A step-by-step diagnostic wizard providing interactive checklists, torque specs, and suggested parts. Uses category-based navigation (Brakes, Engine, Electrical, Suspension) with symptom selection and progress tracking. No AI/external API required - all diagnostics run locally with predefined patterns.
- **Swap Shop**: A peer-to-peer marketplace for buying, selling, and trading automotive parts.
- **Tool & Gear**: A curated marketplace for automotive tools and gear, with a vendor submission process for admin approval.
- **User Profiles**: Detailed profiles with credibility fields such as `focusAreas`, `vehiclesWorkedOn`, `yearsWrenching`, and `shopAffiliation`.
- **Content Moderation**: Reporting system for inappropriate content.

### System Design Choices
- **Responsive Web Layout**: The app supports both mobile and desktop viewports. On desktop (width >= 1024px), a sidebar navigation replaces bottom tabs. Screens use responsive grid layouts (1 column on mobile, 2-3 columns on tablet, 3-4 columns on desktop). The `useResponsive` hook provides breakpoint detection.
- **Navigation**: Utilizes React Navigation with a `RootStackNavigator` encompassing a `ResponsiveNavigator` that switches between bottom tabs (mobile) and sidebar navigation (desktop). Modal screens for adding vehicles, notes, submitting products, and user profiles.
- **Data Management**: React Query is used for client-side data fetching and caching.
- **Database Schema**: PostgreSQL with Drizzle ORM managing users, garages, garage members, vehicles, vehicle notes, threads, and reports. User credibility fields are stored in the `users` table.
- **API**: A RESTful API under `/api/*` for managing garages, user profiles, reports, threads, and products.
- **CORS Configuration**: Production domain (torqueshed.pro) is configured with proper CORS headers. Custom domains can be added via ALLOWED_ORIGINS env var.
- **Monetization Ethics**: TorqueAssist features ethical monetization with transparent disclosure of affiliate links, offering multiple vendors (mixing affiliate and non-affiliate), prioritizing relevance over commission, and requiring explicit user action for external links.
- **Tool & Gear Monetization**: Curated product discovery with `whyItMatters` context boxes, sponsored product badges (yellow "Sponsored" in top-left), "View Deal" CTAs, admin-only CRUD via x-admin-user-id header authentication. Products table includes: title, description, whyItMatters, price, priceRange, category, affiliateLink, vendor, imageUrl, isSponsored, isApproved.

### Recent Updates (Feb 2026)
- **UserAvatar Component**: Reusable avatar component showing user initials, avatar image, or fallback icon. Used across DesktopSidebar and profiles.
- **Role Display**: Only Admin/Moderator roles are shown - regular users ("enthusiast") don't display a role label.
- **ErrorBoundary for TorqueAssist**: TorqueAssist screen wrapped in ErrorBoundary with user-friendly fallback and "Try Again" button.
- **EditListingScreen**: Full listing editing capability for Swap Shop with PATCH endpoint integration.
- **Improved Validation**: AddThreadScreen and EditListingScreen show explicit validation error messages.
- **Delete Functionality**: Both Swap Shop listings and forum threads can now be deleted by their owners with confirmation dialogs.
- **Forum-Style Thread View**: ThreadDetailScreen shows original post, author avatar, replies, and "Replying to thread" label above the input field. Not chat-like - full message board view.
- **Add Vehicle Button**: NotesScreen displays an "Add Vehicle" button at the top of the vehicle list, or a prominent "Add Your First Vehicle" button when empty.

### API Integration (Feb 2026)
All major features now use real database storage instead of stub data:
- **Vehicles API** (`/api/vehicles`): Full CRUD for user vehicles with VIN/YMM tracking. Requires authentication. Frontend screens: NotesScreen, AddVehicleScreen.
- **Vehicle Notes API** (`/api/vehicles/:vehicleId/notes`, `/api/notes/:id`): Maintenance and modification notes per vehicle. Frontend screens: VehicleDetailScreen, AddNoteScreen.
- **Threads API** (`/api/garages/:garageId/threads`, `/api/threads/:id`, `/api/threads/:threadId/replies`): Bay discussion threads with replies and solution marking. Frontend: GarageDetailScreen (Threads tab), AddThreadScreen, ThreadDetailScreen with reply functionality.
- **Swap Shop API** (`/api/swap-shop`, `/api/swap-shop/:id`): Peer-to-peer parts marketplace with condition ratings and shipping options. Supports PATCH for editing listings. Frontend: SwapShopScreen, AddListingScreen, ListingDetailScreen, EditListingScreen.

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
- Client types are defined locally in `client/` (e.g., `client/constants/products.ts`)
- Do not import from `@shared/*` in client code
- Use `useSafeTabBarHeight()` hook instead of `useBottomTabBarHeight()` for screens that need tab bar padding - it safely returns 0 on desktop where sidebar navigation is used instead of bottom tabs
- Use the `Screen` wrapper component (`client/components/Screen.tsx`) for consistent scrolling, padding, and keyboard awareness across screens

## External Dependencies
- **React Native + Expo**: For mobile application development.
- **Express.js**: For the backend server.
- **PostgreSQL**: As the primary database.
- **Drizzle ORM**: For interacting with the PostgreSQL database.

## Recent Changes (Mar 2026)
- **Phase 1 Foundation Cleanup**: Removed 7 orphaned navigator files and 4 orphaned screen files. Renamed `password` field to `passwordHash` in schema/server code (same DB column). Removed `chat_messages` table and all related code. React Query keys audited for consistency.
- **Eliminated all hardcoded/fake data**: Removed SAMPLE_THREADS, SAMPLE_MESSAGES, SAMPLE_VEHICLES, SAMPLE_NOTES, SAMPLE_PRODUCTS, FALLBACK_PRODUCTS, STUB_GARAGES, STUB_SWAP_ITEMS from all client code. Every screen now displays only real data from the database.
- **Real member/thread counts**: GaragesScreen fetches from `/api/garages` which computes memberCount from `garage_members` table and threadCount from `threads` table in real-time.
- **Removed fake indicators**: No more hardcoded "online" counts, "active now" counts, or "hot threads" sections. These were artificial metrics not backed by real data.
- **PartsFinderScreen**: Search now generates direct links to vendor search pages (RockAuto, AutoZone, O'Reilly, Amazon) instead of returning mock results with fake prices.
- **MarketplaceScreen and TrendingScreen**: Now fetch products from `/api/products` API instead of using hardcoded sample product arrays.
- **MyGarageScreen**: Now fetches vehicles from `/api/vehicles` instead of using hardcoded sample vehicles.
- **SwapShopScreen**: Uses only real listings from `/api/swap-shop`, shows empty state when no listings exist.

## Previous Changes (Feb 2026)
- Removed real-time chat feature (WebSocket) in favor of forum-style threads
- Redesigned TorqueAssist from API-based to wizard/checklist approach
- Added CORS support for torqueshed.pro production domain
- Created reusable Screen wrapper component for consistent layout
- Fixed API URL fallback logic for production environments