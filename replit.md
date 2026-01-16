# TorqueShed - Automotive Community Platform

## Overview
TorqueShed (formerly GearHead) is a mobile-first automotive community platform connecting mechanics, enthusiasts, and DIYers with chatrooms, forums, vehicle tracking, parts finding, and a curated marketplace. Tagline: "The Garage for Real People"

## Tech Stack
- **Mobile**: React Native + Expo (TypeScript)
- **Backend**: Express.js (TypeScript)
- **Database**: PostgreSQL (schema defined in docs/MVP_PRD.md)
- **UI**: Custom component system with automotive-themed design

## Project Structure

```
├── client/                  # React Native Expo app
│   ├── App.tsx             # Root component with font loading
│   ├── components/         # Reusable UI components
│   │   ├── Button.tsx      # Primary button with animation
│   │   ├── Card.tsx        # Elevated card component
│   │   ├── EmptyState.tsx  # Empty state with illustration
│   │   ├── FAB.tsx         # Floating action button
│   │   ├── GarageBadge.tsx # Brand color badge
│   │   ├── GarageCard.tsx  # Garage community card
│   │   ├── Input.tsx       # Text input with icons
│   │   ├── MessageBubble.tsx # Chat message bubble
│   │   ├── NoteCard.tsx    # Vehicle note card
│   │   ├── ProductCard.tsx # Marketplace product card
│   │   ├── SegmentedControl.tsx # Tab segment control
│   │   ├── ThemedText.tsx  # Themed typography
│   │   ├── ThemedView.tsx  # Themed container
│   │   └── VehicleCard.tsx # Vehicle list card
│   ├── constants/          # App constants
│   │   ├── brand.ts        # TorqueShed branding, themes, copy
│   │   ├── theme.ts        # Colors, spacing, typography
│   │   ├── garages.ts      # Garage data and sample messages
│   │   ├── vehicles.ts     # Vehicle data structures
│   │   └── products.ts     # Product data structures
│   ├── hooks/              # Custom React hooks
│   │   ├── useTheme.ts     # Theme hook
│   │   ├── useScreenOptions.ts # Navigation options
│   │   ├── useColorScheme.ts # System color scheme
│   │   ├── useWebSocket.ts # WebSocket connection for realtime chat
│   │   └── useChat.ts      # Chat state management with WebSocket
│   ├── navigation/         # React Navigation setup
│   │   ├── RootStackNavigator.tsx  # Root stack with modals
│   │   ├── MainTabNavigator.tsx    # Bottom tab navigator
│   │   ├── GaragesStackNavigator.tsx # Community stack
│   │   ├── NotesStackNavigator.tsx   # Vehicle notes stack
│   │   ├── PartsStackNavigator.tsx   # Parts finder stack
│   │   ├── SwapShopStackNavigator.tsx # P2P marketplace stack
│   │   ├── TrendingStackNavigator.tsx # Curated products stack
│   │   └── ProfileStackNavigator.tsx
│   ├── screens/            # App screens
│   │   ├── GaragesScreen.tsx       # Brand garage list
│   │   ├── GarageDetailScreen.tsx  # Chat + Forums
│   │   ├── NotesScreen.tsx         # Vehicle list
│   │   ├── VehicleDetailScreen.tsx # Vehicle notes
│   │   ├── AddVehicleScreen.tsx    # Add vehicle modal
│   │   ├── AddNoteScreen.tsx       # Add note modal
│   │   ├── PartsScreen.tsx         # Parts search (VIN/YMM)
│   │   ├── SwapShopScreen.tsx      # P2P marketplace
│   │   ├── TrendingScreen.tsx      # Curated products
│   │   ├── SubmitProductScreen.tsx # Vendor submission
│   │   └── ProfileScreen.tsx       # User profile
│   └── lib/                # Utilities
│       └── query-client.ts # React Query setup
├── server/                 # Express backend
│   ├── index.ts           # Server entry point
│   ├── routes.ts          # API routes
│   └── templates/         # HTML templates
├── packages/              # Shared packages (reference only)
│   └── shared/            # Brand tokens, themes, UI primitives
├── assets/                # Static assets
│   └── images/            # App icons and illustrations
├── docs/                  # Documentation
│   └── MVP_PRD.md         # Product requirements document
├── app.json               # Expo configuration
└── design_guidelines.md   # UI/UX design specifications
```

## Navigation Structure

```
RootStackNavigator
├── MainTabNavigator
│   ├── GaragesTab → GaragesScreen (Bays - brand communities)
│   ├── SwapShopTab → SwapShopScreen (P2P marketplace)
│   ├── NotesTab → NotesScreen (Vehicle tracking)
│   ├── PartsTab → PartsScreen (TorqueAssist - parts lookup)
│   └── TrendingTab → TrendingScreen (Tool & Gear)
├── GarageDetail (Chat + Threads)
├── VehicleDetail (Notes list)
├── AddVehicle (Modal)
├── AddNote (Modal)
├── SubmitProduct (Modal)
└── Profile (User settings)
```

## Design System

### Brand Identity
- **Name**: TorqueShed
- **Tagline**: "The Garage for Real People"
- **Legal**: TorqueShed, LLC

### Colors
- **Primary**: #FF6B35 (Racing Orange)
- **Secondary**: #0D0F12 (Industrial Black / neutral-950)
- **Accent**: #F59E0B (Caution Yellow)
- **Bay Brand Colors**:
  - Ford: #003478 (Ford Blue)
  - Dodge: #C8102E (Dodge Red)
  - Chevy: #F2A900 (Chevy Gold)
  - Jeep: #006341 (Jeep Green)
  - General: #6B6B6B (General Gray)
  - Swap Shop: #FF6B35 (Primary Orange)

### Typography
- **Headings**: Montserrat (Bold/SemiBold)
- **Body**: Inter (Regular/Medium)

### Components
- Cards with 1px border and subtle shadow
- Animated press feedback on all interactive elements
- FAB for primary actions
- Segmented control for mode switching

## Key Features

### MVP (Current)
1. **Bays**: Browse brand-specific bays (Ford, Dodge, Chevy, Jeep, General, Swap Shop)
2. **Realtime Chat**: Message other enthusiasts in bay chatrooms
3. **Threads**: Create and reply to discussion threads within bays
4. **Notes**: Track your vehicles with VIN or Y/M/M, document maintenance
5. **Vehicle Notes**: Document maintenance and modifications
6. **TorqueAssist**: AI-assisted parts search by VIN or vehicle info
7. **Swap Shop**: P2P marketplace for buying/selling/trading parts
8. **Tool & Gear**: Browse curated automotive tools and gear
9. **Vendor Submission**: Submit products for admin approval

### Post-MVP
- Real VIN decoding API integration
- AI-powered part recommendations
- Push notifications
- Image attachments
- OAuth login (Apple/Google)
- Full moderation dashboard

## Development

### Running the App
The app runs via two workflows:
- **Start Backend**: Express server on port 5000
- **Start Frontend**: Expo dev server on port 8081

### Testing on Device
1. Install Expo Go on your phone
2. Scan the QR code from the Replit URL bar
3. App loads directly in Expo Go

### Adding Features
1. Create screen in `client/screens/`
2. Add to appropriate stack navigator
3. Update type definitions in navigator file
4. Follow existing component patterns
5. Use brand constants from `client/constants/brand.ts`

## API Routes (Backend)

Currently the backend serves:
- Static Expo manifests for mobile builds
- Landing page at root URL
- API routes under `/api/*`
- WebSocket at `/ws/chat` for realtime chat

### REST Endpoints
- `GET /api/garages` - List all garage communities with active user count
- `GET /api/garages/:id` - Get specific garage details
- `GET /api/garages/:id/messages` - Get chat messages with pagination (?limit=50&before=msgId)
- `POST /api/garages/:id/messages` - Send a new message (body: userId, content)
- `POST /api/reports` - Submit a content report (body: reporterId, reportedUserId, contentType, contentId, reason, details)

### WebSocket Events (ws/chat)
- `join_garage` - Join a garage chatroom
- `leave_garage` - Leave a garage chatroom
- `send_message` - Send a message to the garage
- `typing` - Broadcast typing indicator
- Incoming: `new_message`, `user_joined`, `user_left`, `user_typing`

See `docs/MVP_PRD.md` for complete API specification.

## Database Schema (PostgreSQL + Drizzle ORM)
- **users** - User accounts with username, password, avatar, bio, location
- **garages** - Garage communities (ford, dodge, chevy, jeep, general, swap-shop)
- **garage_members** - User-garage membership (many-to-many)
- **chat_messages** - Realtime chat messages with soft delete
- **vehicles** - User vehicles with VIN or Y/M/M
- **vehicle_notes** - Maintenance and modification notes
- **reports** - Content moderation reports

## Recent Changes
- Rebranded from "GearHead" to "TorqueShed"
- Created comprehensive brand system in `client/constants/brand.ts`
- New 5-tab navigation: Bays, Swap Shop, Notes, TorqueAssist, Tool & Gear
- All screens use local brand imports (no monorepo shared package)
- Complete PRD with database schema and event flows
- Dark theme with Racing Orange (#FF6B35) primary color
- Added PostgreSQL database with Drizzle ORM schema
- Implemented WebSocket server for realtime chat
- Created useWebSocket and useChat hooks for mobile client
- Added ReportModal component for content reporting
- Added profanity filter stub (client/lib/profanity-filter.ts)
- **Terminology update**: Garages → Bays, Parts Finder → TorqueAssist, Trending → Tool & Gear, Forums → Threads

## User Preferences
- Bold, industrial design aesthetic
- Racing Orange as primary accent color
- No emojis in the app
- Mobile-first with iOS 26 liquid glass inspiration
- Dark theme by default (neutral-950 background)
