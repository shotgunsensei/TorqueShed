# TorqueShed

**The Garage for Real People**

A mobile-first automotive community platform connecting mechanics, enthusiasts, and DIYers.

## Features

### Community Bays
Brand-specific chatrooms for Ford, Dodge, Chevy, Jeep, and General automotive discussions. Real-time messaging with credibility indicators showing users' experience and focus areas.

### Vehicle Notes
Track your vehicles by VIN or Year/Make/Model. Document maintenance, modifications, and repairs with private notes attached to each vehicle.

### TorqueAssist
Vehicle-aware diagnostic assistant providing structured guidance, likely causes, recommended checks, torque specs, and suggested parts with transparent affiliate links.

### Swap Shop
Peer-to-peer marketplace for buying, selling, and trading automotive parts within the community.

### Tool & Gear
Curated product discovery featuring automotive tools and gear with vendor submission for admin approval.

## Tech Stack

- **Frontend:** React Native + Expo (TypeScript)
- **Backend:** Express.js (TypeScript)
- **Database:** PostgreSQL with Drizzle ORM
- **Real-time:** WebSocket for live chat
- **Auth:** JWT-based authentication

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL database

### Installation

1. Clone the repository:
```bash
git clone https://github.com/shotgunsensei/TorqueShed.git
cd TorqueShed
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
# Required
DATABASE_URL=your_postgres_connection_string
APP_JWT_SECRET=your_jwt_secret

# Optional
SESSION_SECRET=your_session_secret
```

4. Push database schema:
```bash
npm run db:push
```

5. Start the development servers:
```bash
# Backend
npm run server:dev

# Frontend (in another terminal)
npm run expo:dev
```

## Project Structure

```
TorqueShed/
├── client/           # React Native + Expo frontend
│   ├── components/   # Reusable UI components
│   ├── screens/      # App screens
│   ├── navigation/   # React Navigation setup
│   ├── contexts/     # React contexts (Auth, Theme)
│   ├── hooks/        # Custom hooks
│   └── constants/    # Theme, branding, config
├── server/           # Express.js backend
│   ├── routes/       # API route handlers
│   ├── middleware/   # Auth, validation middleware
│   └── websocket.ts  # WebSocket chat handler
├── shared/           # Drizzle schema (server-only)
└── docs/             # Documentation
```

## Design

- **Primary Color:** Racing Orange (#FF6B35)
- **Background:** Industrial Black (#0D0F12)
- **Typography:** Montserrat (headings), Inter (body)
- **Theme:** Dark mode with iOS liquid glass inspiration

## License

MIT
