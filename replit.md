# TorqueShed - Automotive Community Platform

## Overview
TorqueShed is a mobile-first automotive community platform designed to connect mechanics, enthusiasts, and DIYers. It aims to be "The Garage for Real People," fostering a strong community around automotive interests. Key features include brand-specific communities ("Bays"), vehicle maintenance tracking ("Garage"), a step-by-step diagnostic wizard ("TorqueAssist"), a peer-to-peer marketplace ("Swap Shop"), a curated marketplace for tools and gear ("Shop"), and rich user profiles with credibility signals.

## User Preferences
- Bold, industrial design aesthetic
- Racing Orange as primary accent color
- No emojis in the app
- Mobile-first with iOS 26 liquid glass inspiration
- Dark theme by default (neutral-950 background)
- App must only display real data — no test data, fake counts, or placeholders

## System Architecture

### Frontend (Expo + React Native)
- **Framework**: React Native + Expo (SDK 54) with TypeScript
- **Navigation**: React Navigation 7+ with `RootStackNavigator` > `ResponsiveNavigator` (bottom tabs on mobile, sidebar on desktop) > per-tab stack navigators
- **State/Data**: @tanstack/react-query with default fetcher; `getApiUrl()` from `@/lib/query-client` for API base URL
- **Styling**: StyleSheet.create with theme-aware hooks (`useTheme`); no CSS files
- **Typography**: Montserrat (headings via @expo-google-fonts/montserrat), Inter (body via @expo-google-fonts/inter)
- **Brand Colors**: Racing Orange #FF6B35 (primary), Industrial Black #0D0F12 (secondary), Caution Yellow #F59E0B (accent)

### Backend (Express + PostgreSQL)
- **Server**: Express.js with TypeScript on port 5000
- **Database**: PostgreSQL with Drizzle ORM
- **Auth**: JWT-based with bcrypt password hashing; `requireAuth` and `requireAdmin` middleware
- **API**: RESTful under `/api/*`
- **CORS**: Dynamic origins from env vars + hardcoded production domains (torqueshed.pro)
- **Security**: Helmet headers, trust proxy, 1mb request body limit

### Navigation Structure
```
RootStackNavigator
  ├── Login / Signup (auth flow)
  ├── Onboarding
  ├── Main → ResponsiveNavigator (6 tabs, Cases is initial route)
  │     ├── HomeTab → HomeStackNavigator (Home feed)
  │     ├── DiagnoseTab → DiagnoseStackNavigator (TorqueAssist diagnostic engine)
  │     ├── CasesTab → CasesStackNavigator (Cases feed + Bays browser)
  │     ├── NotesTab → NotesStackNavigator (Garage: Vehicles + VehicleDetail)
  │     ├── MarketTab → MarketStackNavigator (Shop / Swap / Find Parts)
  │     └── MoreTab → MoreStackNavigator (Tool & Gear, settings)
  ├── Profile, AddVehicle, AddNote, AddListing, ListingDetail
  ├── EditListing, AddThread, ThreadDetail, AskForHelp, NewCase (modal)
  ├── SubmitProduct, AdminProducts, GarageDetail
```

### Key Features
- **Home Feed**: Personalized feed with sections ordered by onboarding goals (vehicles, bay threads, garage threads, swap listings). Pull-to-refresh, error state with retry.
- **Cases (primary tab)**: Flat case feed across all bays. Search bar, 4 quick actions (New Case, TorqueAssist, Scan Code, Sell Part), and chip-row filters for status (Open / Testing / Solved / Pinned), system category, and bay. Case cards display title, vehicle, OBD chips, status/system/urgency badges, root-cause preview, reply count, last activity. The Bays browser is reachable from a header grid icon.
- **New Case wizard**: 3-step modal (Vehicle → Problem details → Review). Step 1 picks an existing vehicle or quick-adds year/make/model/trim/engine/mileage/VIN. Step 2 captures title, symptoms, OBD codes (with autocomplete + system inference), urgency, budget, tools available, when it happens, recent repairs, parts replaced. Step 3 shows TorqueAssist preview (top probable causes from decoded OBD codes) and posts to the bay matched by vehicle make. Photo upload is a placeholder.
- **Bays (Garages)**: Brand-specific community forums (Ford, Chevy, Dodge, Jeep, General). Join/leave, discussion threads with solution marking. Credibility signals on thread cards (Trusted Solver badge, years wrenching). Reachable from the Cases tab header.
- **Garage (Build Journal)**: Vehicle build journals with typed entries (maintenance, mod, issue, general). Tracks cost, mileage, parts. VIN decoding via NHTSA API.
- **Structured replies & verified solved-case flow**: Reply composer has a chip selector for reply type (comment / question / suggested test / test result / confirmed fix / warning / part rec / tool rec / shop estimate); each reply renders a type-colored badge. Case authors get an inline status changer (Open / Testing / Needs Expert) and a "Mark Case Solved" button that opens a FinalFix form (root cause, final fix, parts used, tools used, total cost, labor minutes, verification notes). Submission posts to `POST /api/threads/:id/solved`; the `PATCH /api/threads/:id/status` endpoint rejects "solved" so verified solving must always go through FinalFix.
- **TorqueAssist (Diagnose tab)**: Professional diagnostic engine with 10 category decision trees (no-crank, no-start, overheating, misfire, charging-system, brake-noise, front-end-clunk, parasitic-drain, ac-not-cold, transmission-issue). Four-phase flow: intake (vehicle info + DTC codes), category selection, narrowing questions (one-at-a-time with "why asking" context), and diagnostic dashboard (ranked hypotheses with confidence bars, safety/difficulty/cost metadata, expandable test procedures with pass/fail/inconclusive recording). Session persistence via API. Export summary to clipboard. Hypothesis scoring engine in `shared/diagnostic-engine.ts`. DTC code integration: 57 DTC-to-hypothesis mappings across all 10 categories (regex pattern matching, +15-30 confidence deltas). Question prerequisites: conditional question gating based on prior answers (e.g., coil swap test only shown for single-cylinder misfires).
- **Market Tab** (formerly Source): Unified parts sourcing hub with three segments:
  - **Shop**: Curated products with category filters, "Why It Matters" context boxes, sponsored/featured badges, affiliate tracking
  - **Swap Shop**: Peer-to-peer marketplace with condition badges, shipping options, seller credibility (join date, listing count), report flow, share via clipboard, image URL support in listing forms
  - **Find Parts**: Search across major vendors (RockAuto, AutoZone, O'Reilly, Amazon) with vehicle context badge, expo-web-browser in-app browsing, search history (AsyncStorage)
- **User Profiles**: Rich profiles with hero section, 5-stat row (vehicles, threads, solutions, replies, listings), public vehicles carousel, recent activity feed, collapsible edit form. Role badges (Admin/Mod) and trust badges from API (Trusted Solver, Verified Owner, Active Contributor). Profile completeness indicator with progress bar.
- **Saved Items**: Users can bookmark/save threads (ThreadDetailScreen) and swap listings (ListingDetailScreen). Saved items appear in a dedicated section on ProfileScreen. Save state managed via `/api/saved/thread-ids` and `/api/saved/listing-ids` queries.
- **Content Moderation**: Report flow for threads, replies, and swap listings with predefined reasons. Admin report review tab in AdminProducts screen with dismiss/remove actions.
- **Admin**: Product management (approve/reject/delete), curated product curation. Reports tab with pending report queue, dismiss/remove content actions.

### Database Schema (Drizzle ORM)
Key tables: `users`, `garages`, `garageMembers`, `vehicles`, `vehicleNotes`, `threads`, `threadReplies`, `swapShopListings`, `products`, `reports`, `savedThreads`, `savedListings`, `diagnosticSessions`, `subscriptions`, `sellerProfiles`, `expertReviews`, `repairPlanExports`, `caseRecommendations`.

`swapShopListings` is extended with `category` (parts/tools/scan_tools/services/project_vehicles), `attachedCaseId` (optional FK to a thread), and `isRecommendedForCase` for context-aware recommendations.

### Monetization Model (placeholder Stripe)
Tiers: Free, DIY Pro ($9.99/mo), Garage Pro ($29/mo), Shop Pro ($79/mo). Soft monetization — no paywalls on case creation or community help. Upsells appear at points of intent:
- **Premium diagnostics** — TorqueAssist deep mode gated by `useEntitlements().hasFeature('deepDiagnostics')`.
- **Parts & Tools panel** (`PartsAndToolsCard` on ThreadDetail) — shows required tools, optional tools, likely parts, confirmed parts (post-solve), and user listings attached to the case via `attachedCaseId`.
- **Expert Review** (`EscalateCaseCard`) — Quick ($15), Full ($39), Live ($99). Posts to `POST /api/cases/:id/escalate`. UI + records only; no real expert assignment.
- **Repair Plan export** (`RepairPlanCard`) — free preview; premium tiers can "Export PDF" (currently JSON to clipboard).
- **Seller Dashboard** — listing limit 3 on Free; unlimited on Garage Pro+. Free-tier sellers see upgrade prompt when at limit.

Stripe integration is a stub: `/api/subscription` POST simulates the upgrade and returns 503 with a helpful message if `STRIPE_SECRET_KEY` is missing.

### Marketplace Tabs
The Market tab has 8 segments: Shop, Parts, Tools, Scan Tools, Services, Project Vehicles, Saved, Find Parts. The first 5 of those (Parts → Project Vehicles) reuse `SwapSection` filtered by `categoryFilter`. Saved is `SwapSection` with `savedOnly`. Add/Edit listing screens include a category chip-row picker; Add Listing also lets the seller attach the listing to one of their open cases (chip selector populated from `GET /api/threads/me`).

### UI Component Library
- `Card` — themed card with 1px border (cardBorder), elevation levels, press feedback
- `Button` — primary action button with pill shape
- `FAB` — floating action button with safe area insets
- `EmptyState` — icon + title + description + optional CTA for empty/error states
- `Skeleton` — loading placeholders (List, Grid, Box variants) with cardBorder
- `StatusBadge` — shared badge/chip with variants (default, success, warning, error, primary, muted), icon support, sm/md sizes. Used for condition badges, role badges, trust signals, and featured/sponsored indicators.
- `UserAvatar` — avatar with role badge support
- `Input` — themed text input with md border radius, 1px border
- `ThemedText` / `ThemedView` — theme-aware primitives
- `ErrorBoundary` — crash recovery with restart

### Error Handling Patterns
- **Loading**: Skeleton loaders on all data-fetching screens
- **Error**: EmptyState with alert-circle icon and retry button on all query-driven screens
- **Empty**: Branded EmptyState with relevant icon, message, and CTA
- **Form errors**: Toast notifications for mutation failures, inline validation for forms
- **Auth errors**: Inline alert in login/signup forms

### Stub Endpoints (TODO)
- `POST /api/auth/forgot-password` — awaiting email service integration
- `POST /api/auth/reset-password` — awaiting email service integration
- `POST /api/auth/verify-email` — awaiting email service integration

### Monetization
- TorqueAssist transparently uses affiliate links, prioritizing relevance
- Shop features curated products with "Why It Matters" context boxes and sponsored product badges
- Click tracking on affiliate links for analytics

## External Dependencies
- **React Native + Expo**: Mobile application framework
- **Express.js**: Backend server
- **PostgreSQL**: Primary database
- **Drizzle ORM**: Database ORM
- **@tanstack/react-query**: Client-side data fetching and caching
- **React Navigation**: App navigation
- **expo-linear-gradient**: Gradient effects
- **expo-haptics**: Haptic feedback on interactions
- **expo-clipboard**: Clipboard access for share functionality
- **expo-web-browser**: In-app browser for vendor links
- **bcrypt**: Password hashing
- **jsonwebtoken**: JWT auth tokens
- **zod**: Schema validation

## Development
- Frontend runs on port 8081 (Expo dev server with HMR)
- Backend runs on port 5000 (Express API + static landing page)
- `npm run server:dev` starts backend, `npm run expo:dev` starts frontend
- TypeScript strict mode enabled
- Admin account: configured via ADMIN_USERNAME/ADMIN_PASSWORD env vars
