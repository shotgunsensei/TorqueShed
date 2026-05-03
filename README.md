# TorqueShed

**Diagnose smarter. Track repairs. Find parts, tools, and real-world fixes faster.**

A mobile-first automotive community platform connecting mechanics, enthusiasts, and DIYers — built by **Shotgun Ninjas Productions**.

## Part of the Shotgun Ninjas Ecosystem

TorqueShed is the automotive vertical of a wider tools-for-real-operators ecosystem:

| Product | Role | Link |
|---|---|---|
| **TorqueShed** | Automotive diagnostics, repair cases, parts & tools, mechanic community | [torqueshed.pro](https://torqueshed.pro) |
| **TradeFlowKit** | Shop business operations — quotes, invoices, cash flow | [tradeflowkit.com](https://tradeflowkit.com) |
| **TechDeck** | IT operations, scripts, automation, MSP & power-user tooling | [techdeck.app](https://techdeck.app) |
| **PulseDesk** | Healthcare operations coordination | [pulsedesk.support](https://pulsedesk.support) |
| **FaultlineLab** | Diagnostic challenge & investigation training | [faultlinelab.com](https://faultlinelab.com) |
| **Shotgun Ninja Village** | Community, content, games, creator hub | [shotgunninjavillage.com](https://shotgunninjavillage.com) |
| **Shotgun Ninjas** | Central ecosystem hub | [shotgunninjas.com](https://shotgunninjas.com) |

**How TorqueShed connects to the ecosystem:**
- Shop Pro users naturally graduate into **TradeFlowKit** for the business side of their shop.
- Anyone wanting to sharpen diagnostic instincts is sent to **FaultlineLab** for fault-scenario training.
- The landing page and the in-app **More → Shotgun Ninjas Ecosystem** group surface relevant cross-products without crowding the core experience.

## Features

### Cases & Bays
Brand-specific community garages (Ford, Dodge, Chevy, Jeep, etc.) with structured case threads, replies, FinalFix verification, photo + video attachments, and similar-solved-case suggestions.

### Garage / Build Journal
Track vehicles by VIN or YMM. Log maintenance, mods, and issues per vehicle.

### TorqueAssist
Vehicle-aware diagnostic engine with decision trees, DTC code integration, ranked hypotheses, and test procedures (premium-gated).

### Marketplace
Curated Shop, peer-to-peer Swap Shop with photo galleries, and Find Parts vendor search.

### Shop Pro
Public shop pages, services, customer leads, team access, and customer-facing diagnostic summaries for paying shops.

### Subscription Tiers
- **Free** — community + 3 saved cases
- **DIY Pro** — $9.99/mo
- **Garage Pro** — $29/mo (multi-vehicle tracking, tool inventory, full diagnostics)
- **Shop Pro** — $79/mo (public shop, leads, team, customer summaries)

Billing runs on Stripe with webhook reconciliation, Customer Portal, and per-feature entitlement enforcement.

## Tech Stack

- **Frontend:** React Native + Expo (TypeScript), React Navigation 7, @tanstack/react-query
- **Backend:** Express.js (TypeScript) on Node 22
- **Database:** PostgreSQL with Drizzle ORM
- **Payments:** Stripe (test + production via the Replit Stripe connector)
- **Storage:** Replit Object Storage (Google Cloud Storage backed) for photos & videos
- **Auth:** JWT + bcrypt

## Getting Started

### Prerequisites
- Node.js 22+
- PostgreSQL database
- Stripe account (for billing testing)

### Installation

```bash
git clone https://github.com/shotgunsensei/TorqueShed.git
cd TorqueShed
npm install
```

### Environment

```bash
DATABASE_URL=...
APP_JWT_SECRET=...
SESSION_SECRET=...
ADMIN_PASSWORD=...
STRIPE_PRICE_DIY_PRO=price_...
STRIPE_PRICE_GARAGE_PRO=price_...
STRIPE_PRICE_SHOP_PRO=price_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Run

```bash
npm run db:push       # apply schema
npm run server:dev    # backend on :5000
npm run expo:dev      # frontend on :8081
```

### Keeping the database schema in sync

The Drizzle schema lives in `shared/schema.ts`. After pulling changes from
`main` (or any time you add/rename a column), run:

```bash
npm run db:push
```

The dev backend (`npm run server:dev`) refuses to start when it detects that
the database is missing tables or columns declared in the schema, and prints
the exact missing tables/columns plus the command to fix them. This prevents
silent 500s like the Cases tab POST failure caused by `shop_services.stripe_price_id`
existing in `shared/schema.ts` but never being pushed to the DB.

To bypass the check temporarily (e.g. when working offline against a snapshot
DB you don't intend to migrate), set `SKIP_SCHEMA_CHECK=1`. The check is
skipped automatically in production (`NODE_ENV=production`); production
schemas are managed via your deployment migration workflow.

## Project Structure

```
TorqueShed/
├── client/           # React Native + Expo frontend
│   ├── components/
│   ├── screens/
│   │   └── shop-pro/ # Shop Pro owner screens
│   ├── navigation/
│   ├── contexts/
│   ├── hooks/
│   └── constants/
├── server/           # Express.js backend
│   ├── routes.ts
│   ├── stripeBilling.ts
│   ├── entitlements.ts
│   ├── objectStorage.ts
│   └── templates/    # landing-page.html, public-shop.html, public-summary.html
├── shared/           # Drizzle schema (server-only)
└── docs/
```

## Design

- **Primary:** Racing Orange `#FF6B35`
- **Background:** Industrial Black `#0D0F12`
- **Accent:** Caution Yellow `#F59E0B`
- **Typography:** Montserrat (headings), Inter (body)
- **Theme:** Dark by default, iOS 26 liquid glass inspiration

## License

MIT — © Shotgun Ninjas Productions
