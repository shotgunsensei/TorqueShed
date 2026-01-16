# GearHead - Automotive Community Platform

## Overview
GearHead is a mobile-first automotive community platform connecting mechanics, enthusiasts, and DIYers with chatrooms, forums, vehicle tracking, parts finding, and a curated marketplace.

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
│   │   ├── theme.ts        # Colors, spacing, typography
│   │   ├── garages.ts      # Garage data and sample messages
│   │   ├── vehicles.ts     # Vehicle data structures
│   │   └── products.ts     # Product data structures
│   ├── hooks/              # Custom React hooks
│   │   ├── useTheme.ts     # Theme hook
│   │   ├── useScreenOptions.ts # Navigation options
│   │   └── useColorScheme.ts # System color scheme
│   ├── navigation/         # React Navigation setup
│   │   ├── RootStackNavigator.tsx  # Root stack with modals
│   │   ├── MainTabNavigator.tsx    # Bottom tab navigator
│   │   ├── CommunityStackNavigator.tsx
│   │   ├── MyGarageStackNavigator.tsx
│   │   ├── PartsFinderStackNavigator.tsx
│   │   ├── MarketplaceStackNavigator.tsx
│   │   └── ProfileStackNavigator.tsx
│   ├── screens/            # App screens
│   │   ├── CommunityScreen.tsx     # Garage list
│   │   ├── GarageDetailScreen.tsx  # Chat + Forums
│   │   ├── MyGarageScreen.tsx      # Vehicle list
│   │   ├── VehicleDetailScreen.tsx # Vehicle notes
│   │   ├── AddVehicleScreen.tsx    # Add vehicle modal
│   │   ├── AddNoteScreen.tsx       # Add note modal
│   │   ├── PartsFinderScreen.tsx   # Parts search
│   │   ├── MarketplaceScreen.tsx   # Product grid
│   │   ├── SubmitProductScreen.tsx # Vendor submission
│   │   └── ProfileScreen.tsx       # User profile
│   └── lib/                # Utilities
│       └── query-client.ts # React Query setup
├── server/                 # Express backend
│   ├── index.ts           # Server entry point
│   ├── routes.ts          # API routes
│   └── templates/         # HTML templates
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
│   ├── CommunityTab → CommunityScreen (Garages grid)
│   ├── MyGarageTab → MyGarageScreen (Vehicles list)
│   ├── PartsFinderTab → PartsFinderScreen (Parts search)
│   ├── MarketplaceTab → MarketplaceScreen (Products grid)
│   └── ProfileTab → ProfileScreen (User settings)
├── GarageDetail (Chat + Forums)
├── VehicleDetail (Notes list)
├── AddVehicle (Modal)
├── AddNote (Modal)
└── SubmitProduct (Modal)
```

## Design System

### Colors
- **Primary**: #FF6B35 (Racing Orange)
- **Secondary**: #1A1A1A (Industrial Black)
- **Accent**: #FFC107 (Caution Yellow)
- **Brand Colors**: Ford Blue, Dodge Red, Chevy Gold, Jeep Green

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
1. **Community Hub**: Browse brand garages, join discussions
2. **Realtime Chat**: Message other enthusiasts in garage chatrooms
3. **Forum Threads**: Create and reply to discussion threads
4. **My Garage**: Track your vehicles with VIN or Y/M/M
5. **Vehicle Notes**: Document maintenance and modifications
6. **Parts Finder**: Search for parts by VIN or vehicle info
7. **Marketplace**: Browse trending automotive products
8. **Vendor Submission**: Submit products for admin approval

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

## API Routes (Backend)

Currently the backend serves:
- Static Expo manifests for mobile builds
- Landing page at root URL
- API routes under `/api/*`

See `docs/MVP_PRD.md` for complete API specification.

## Recent Changes
- Initial MVP implementation
- 5-tab navigation: Community, My Garage, Parts, Shop, Profile
- Custom design system with automotive theme
- Sample data for testing all features
- Complete PRD with database schema and event flows

## User Preferences
- Bold, industrial design aesthetic
- Racing orange as primary accent color
- No emojis in the app
- Mobile-first with iOS 26 liquid glass inspiration
