# GearHead - MVP Product Requirements Document

## Overview
GearHead is a mobile-first automotive community platform connecting mechanics, enthusiasts, and DIYers with chatrooms, forums, vehicle tracking, parts finding, and a curated marketplace.

---

## 1. Feature List

### MVP (v1.0) - Ship This First

| Feature | Description | Priority |
|---------|-------------|----------|
| **Auth & Profiles** | Email/password signup, profile with handle/avatar/bio/location/specialties | P0 |
| **Brand Garages** | Ford, Dodge, Chevy, Jeep, General, Swap Shop communities | P0 |
| **Realtime Chat** | Discord-style chatrooms per garage with message history | P0 |
| **Forum Threads** | Thread-based discussions per garage (create, reply, view) | P0 |
| **Vehicle Cards** | Create vehicles by VIN or Y/M/M with nickname | P0 |
| **Vehicle Notes** | CRUD notes attached to vehicles (private by default) | P0 |
| **Parts Finder** | VIN/Y/M/M lookup + part query → vendor link aggregation | P1 |
| **Marketplace** | Browse approved trending products with affiliate links | P1 |
| **Vendor Submission** | Submit product for admin approval | P1 |
| **Admin Approval** | Simple admin screen to approve/reject vendor submissions | P1 |
| **Report Content** | Report messages/threads for moderation | P1 |
| **Block User** | Block users from your view | P2 |

### Post-MVP (v1.x+)

| Feature | Description |
|---------|-------------|
| Note Sharing | Per-note public/private toggle with shareable links |
| Reputation System | Points for helpful posts, verified fixes, community contribution |
| VIN Decoder API | Real VIN decoding via NHTSA/third-party API |
| AI Part Assistant | OpenAI-powered part recommendations and fitment verification |
| Push Notifications | New messages, replies, product approvals |
| Image Attachments | Photos in chat, forums, vehicle cards, notes |
| OAuth Login | Apple Sign-In, Google Sign-In |
| Moderation Dashboard | Full admin panel with user management, analytics |
| Real Affiliate Links | RockAuto, AutoZone, O'Reilly API integrations |
| Search | Full-text search across forums, vehicles, products |
| Direct Messages | Private 1:1 messaging between users |

---

## 2. User Roles

| Role | Permissions |
|------|-------------|
| **User** | Create profile, join garages, chat, post threads, manage own vehicles/notes, report content, block users |
| **Vendor** | All User permissions + submit products for approval |
| **Moderator** | All User permissions + delete any message/thread, warn users, temp-ban (24h/7d) |
| **Admin** | All permissions + approve vendors, approve products, manage roles, permanent bans, access admin dashboard |

### Role Hierarchy
```
Admin > Moderator > Vendor > User
```

---

## 3. Database Schema (PostgreSQL)

### 3.1 Users

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  handle VARCHAR(50) UNIQUE NOT NULL,
  avatar_url TEXT,
  bio TEXT,
  location VARCHAR(100),
  specialties TEXT[], -- Array of tags
  role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'vendor', 'moderator', 'admin')),
  reputation_score INTEGER DEFAULT 0,
  is_banned BOOLEAN DEFAULT FALSE,
  banned_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_handle ON users(handle);
CREATE INDEX idx_users_role ON users(role);
```

### 3.2 Garages

```sql
CREATE TABLE garages (
  id VARCHAR(50) PRIMARY KEY, -- 'ford', 'dodge', 'chevy', 'jeep', 'general', 'swap-shop'
  name VARCHAR(100) NOT NULL,
  description TEXT,
  brand_color VARCHAR(7), -- Hex color
  member_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE garage_members (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  garage_id VARCHAR(50) REFERENCES garages(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, garage_id)
);

CREATE INDEX idx_garage_members_garage ON garage_members(garage_id);
```

### 3.3 Chat Messages

```sql
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  garage_id VARCHAR(50) REFERENCES garages(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_chat_messages_garage ON chat_messages(garage_id, created_at DESC);
CREATE INDEX idx_chat_messages_user ON chat_messages(user_id);
```

### 3.4 Forum Threads & Replies

```sql
CREATE TABLE forum_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  garage_id VARCHAR(50) REFERENCES garages(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  is_pinned BOOLEAN DEFAULT FALSE,
  is_locked BOOLEAN DEFAULT FALSE,
  is_deleted BOOLEAN DEFAULT FALSE,
  reply_count INTEGER DEFAULT 0,
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE forum_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID REFERENCES forum_threads(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_forum_threads_garage ON forum_threads(garage_id, last_activity_at DESC);
CREATE INDEX idx_forum_replies_thread ON forum_replies(thread_id, created_at ASC);
```

### 3.5 Vehicles & Notes

```sql
CREATE TABLE vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  vin VARCHAR(17),
  year INTEGER,
  make VARCHAR(50),
  model VARCHAR(100),
  nickname VARCHAR(100),
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE vehicle_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  is_private BOOLEAN DEFAULT TRUE,
  share_token VARCHAR(32) UNIQUE, -- For future sharing feature
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_vehicles_user ON vehicles(user_id);
CREATE INDEX idx_vehicles_vin ON vehicles(vin) WHERE vin IS NOT NULL;
CREATE INDEX idx_vehicle_notes_vehicle ON vehicle_notes(vehicle_id, created_at DESC);
```

### 3.6 Products & Vendor Submissions

```sql
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  price VARCHAR(20),
  vendor_name VARCHAR(100),
  affiliate_url TEXT NOT NULL,
  category VARCHAR(50),
  image_url TEXT,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  submitted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_category ON products(category) WHERE status = 'approved';
CREATE INDEX idx_products_submitted_by ON products(submitted_by);
```

### 3.7 Moderation

```sql
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID REFERENCES users(id) ON DELETE SET NULL,
  reported_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  content_type VARCHAR(20) NOT NULL CHECK (content_type IN ('chat_message', 'forum_thread', 'forum_reply', 'user')),
  content_id UUID, -- ID of the reported content
  reason VARCHAR(50) NOT NULL CHECK (reason IN ('spam', 'harassment', 'scam', 'illegal', 'impersonation', 'other')),
  details TEXT,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'actioned', 'dismissed')),
  reviewed_by UUID REFERENCES users(id),
  action_taken TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

CREATE TABLE user_blocks (
  blocker_id UUID REFERENCES users(id) ON DELETE CASCADE,
  blocked_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (blocker_id, blocked_id)
);

CREATE INDEX idx_reports_status ON reports(status, created_at DESC);
CREATE INDEX idx_user_blocks_blocker ON user_blocks(blocker_id);
```

### 3.8 Sessions

```sql
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_token ON sessions(token_hash);
```

---

## 4. Event Flows

### 4.1 Chat Message Flow

```
User types message → Client
     ↓
POST /api/garages/:id/messages { content }
     ↓
Server validates:
  - User authenticated
  - User not banned
  - User member of garage
  - Content length 1-2000 chars
  - Rate limit: 5 msg/10sec
     ↓
Insert into chat_messages
     ↓
Broadcast via WebSocket to garage subscribers
     ↓
Clients receive and render message
```

### 4.2 Forum Post Flow

```
User creates thread → Client
     ↓
POST /api/garages/:id/threads { title, content }
     ↓
Server validates:
  - User authenticated
  - User not banned
  - Title 5-255 chars
  - Content 10-10000 chars
  - Rate limit: 1 thread/5min
     ↓
Insert into forum_threads
     ↓
Return thread with ID
     ↓
Client navigates to thread view
```

### 4.3 Vehicle Note Flow

```
User creates note → Client
     ↓
POST /api/vehicles/:id/notes { title, content, is_private }
     ↓
Server validates:
  - User authenticated
  - User owns vehicle
  - Title 1-255 chars
  - Content 1-5000 chars
     ↓
Insert into vehicle_notes
     ↓
Return note with ID
```

### 4.4 Vendor Submission Flow

```
Vendor submits product → Client
     ↓
POST /api/products { title, description, price, vendor_name, affiliate_url, category }
     ↓
Server validates:
  - User authenticated
  - User role = vendor OR admin
  - Required fields present
  - URL valid format
  - Rate limit: 5 submissions/day
     ↓
Insert into products (status='pending')
     ↓
(Future) Notify admins
     ↓
Return submission confirmation
```

### 4.5 Product Approval Flow

```
Admin reviews product → Admin Dashboard
     ↓
PUT /api/admin/products/:id { status, rejection_reason? }
     ↓
Server validates:
  - User authenticated
  - User role = admin
  - Status in ['approved', 'rejected']
     ↓
Update products set status, reviewed_by, reviewed_at
     ↓
(Future) Notify submitter
     ↓
If approved: Product visible in marketplace
If rejected: Vendor sees reason in their submissions
```

---

## 5. Abuse & Threat Model

### 5.1 Threat Categories

| Threat | Risk Level | MVP Mitigation |
|--------|------------|----------------|
| **Spam** | HIGH | Rate limiting, report system, mod delete |
| **Scams** | HIGH | Report system, vendor verification, affiliate-only links |
| **Harassment** | MEDIUM | Block user, report system, temp bans |
| **Doxxing** | MEDIUM | Report system, no PII fields required, mod review |
| **Illegal Sales** | HIGH | Swap Shop moderation, report system, TOS |
| **Impersonation** | MEDIUM | Unique handles, report system, admin review |
| **Bot Abuse** | MEDIUM | Rate limiting, CAPTCHA (post-MVP) |

### 5.2 MVP Mitigations

#### Rate Limits
```
Chat messages:     5/10sec per user per garage
Forum threads:     1/5min per user
Forum replies:     5/min per user
Product submit:    5/day per user
Reports:           10/hour per user
```

#### Content Moderation
- **Report Flow**: User reports → Pending queue → Mod reviews → Action taken
- **Actions Available**: 
  - Delete content
  - Warn user (tracked)
  - Temp ban (24h, 7d)
  - Permanent ban (admin only)

#### User Blocks
- Blocked users' content hidden from blocker
- Blocks are one-directional
- Blocked user not notified

#### Swap Shop Rules (Enforced by TOS + Moderation)
- No firearms, drugs, stolen parts
- No VIN washing or title fraud
- Local pickup encouraged (reduces shipping scams)

### 5.3 Post-MVP Security Enhancements

| Enhancement | Purpose |
|-------------|---------|
| Phone verification | Reduce throwaway accounts |
| Verified seller badge | Trust signal for Swap Shop |
| AI content moderation | Auto-flag suspicious content |
| Escrow integration | Safe Swap Shop transactions |
| CAPTCHA | Prevent bot signups |
| IP reputation | Block known bad actors |
| Image scanning | Block explicit/illegal images |

---

## 6. API Endpoints Summary

### Auth
```
POST   /api/auth/signup
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me
```

### Users
```
GET    /api/users/:handle
PUT    /api/users/me
POST   /api/users/:id/block
DELETE /api/users/:id/block
```

### Garages
```
GET    /api/garages
GET    /api/garages/:id
POST   /api/garages/:id/join
POST   /api/garages/:id/leave
```

### Chat (REST + WebSocket)
```
GET    /api/garages/:id/messages?before=<timestamp>
POST   /api/garages/:id/messages
DELETE /api/messages/:id (mod only)
WS     /ws/garages/:id
```

### Forums
```
GET    /api/garages/:id/threads
POST   /api/garages/:id/threads
GET    /api/threads/:id
POST   /api/threads/:id/replies
DELETE /api/threads/:id (mod only)
DELETE /api/replies/:id (mod only)
```

### Vehicles
```
GET    /api/vehicles
POST   /api/vehicles
GET    /api/vehicles/:id
PUT    /api/vehicles/:id
DELETE /api/vehicles/:id
```

### Notes
```
GET    /api/vehicles/:id/notes
POST   /api/vehicles/:id/notes
PUT    /api/notes/:id
DELETE /api/notes/:id
```

### Products
```
GET    /api/products (approved only)
POST   /api/products (vendor/admin)
GET    /api/products/mine (vendor's submissions)
```

### Admin
```
GET    /api/admin/products?status=pending
PUT    /api/admin/products/:id
GET    /api/admin/reports?status=pending
PUT    /api/admin/reports/:id
POST   /api/admin/users/:id/ban
DELETE /api/admin/users/:id/ban
```

### Reports
```
POST   /api/reports
```

---

## 7. Success Metrics (v1)

| Metric | Target |
|--------|--------|
| Daily Active Users | 100+ |
| Messages/day | 500+ |
| Vehicles created | 200+ |
| Products approved | 20+ |
| Report resolution time | <24h |
| Crash-free rate | >99% |

---

## 8. Tech Stack Summary

| Layer | Technology |
|-------|------------|
| Mobile | React Native + Expo |
| Web | Next.js (post-MVP) |
| Backend | Express.js / Node.js |
| Database | PostgreSQL |
| Realtime | WebSockets (ws) |
| Auth | Sessions + bcrypt |
| Storage | Supabase Storage (post-MVP) |
| Hosting | Replit Deployments |

---

*Document Version: 1.0*  
*Last Updated: January 2026*
