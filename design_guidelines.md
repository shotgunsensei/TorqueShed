# Automotive Community Platform - Design Guidelines

## Brand Identity

**Purpose**: A social hub for mechanics, enthusiasts, and DIYers to connect, share knowledge, and find parts. This is a utilitarian workspace with community warmth.

**Aesthetic Direction**: **Bold/Industrial** - High contrast, attention-grabbing hierarchy with automotive-inspired details. Think garage workshop meets modern social platform: clean but confident, organized but energetic.

**Memorable Element**: Color-coded "Garage" brand badges (Ford blue, Dodge red, Chevy gold, etc.) that serve as visual anchors throughout the app. Users instantly recognize which community they're in.

## Navigation Architecture

**Root Navigation**: Tab Bar (Mobile) / Sidebar (Web)
- **Community** (chatrooms + forums)
- **My Garage** (vehicle notes)
- **Parts Finder** (core action - center position on mobile)
- **Marketplace** (trending products)
- **Profile** (settings, admin)

**Auth**: Required (multi-user social platform)
- Apple Sign-In + Google Sign-In
- Profile screen includes: handle, avatar, bio, location, specialties, reputation score

## Screen-by-Screen Specifications

### 1. Community Hub
- **Purpose**: Browse garages, enter chatrooms or forums
- **Layout**: 
  - Transparent header with search bar (right icon: filter by brand)
  - Scrollable grid of Garage cards (2 columns mobile, 4 web)
  - Each card: brand badge, member count, recent activity indicator
  - Safe area: top = headerHeight + 20, bottom = tabBarHeight + 20
- **Empty state**: "No garages yet" (empty-garages.png)

### 2. Chatroom
- **Purpose**: Real-time conversation in a specific garage
- **Layout**:
  - Custom header: Garage name + brand badge (left: back, right: members icon)
  - Message list (inverted FlatList)
  - Fixed input bar at bottom with attachment + send icons
  - Safe area: top = headerHeight, bottom = inputBarHeight + 12
- **Components**: Message bubbles (self vs others), timestamp, avatar thumbnails

### 3. Forum Thread List
- **Purpose**: Browse discussion threads in a garage
- **Layout**:
  - Transparent header with search + filter (right: new thread FAB)
  - List of thread cards: title, author, reply count, last activity
  - Safe area: top = headerHeight + 20, bottom = tabBarHeight + 20
- **Empty state**: "Start the first discussion" (empty-threads.png)

### 4. My Garage (Vehicle Notes)
- **Purpose**: Manage user's vehicle cards
- **Layout**:
  - Transparent header (right: add vehicle button)
  - Scrollable list of vehicle cards: photo, Y/M/M, nickname, notes count
  - Safe area: top = headerHeight + 20, bottom = tabBarHeight + 20
- **Empty state**: "Add your first vehicle" (empty-garage.png)

### 5. Vehicle Detail
- **Purpose**: View/edit notes for a specific vehicle
- **Layout**:
  - Custom header: vehicle nickname (left: back, right: edit)
  - Scrollable content: VIN badge, photo gallery, notes list (chronological)
  - FAB: add note (bottom-right, elevation shadow)
  - Safe area: top = headerHeight, bottom = tabBarHeight + 80 (for FAB clearance)

### 6. Parts Finder
- **Purpose**: Search for compatible parts by VIN or Y/M/M
- **Layout**:
  - Default header: "Parts Finder"
  - Form area: VIN input OR Y/M/M dropdowns, part search field, submit button
  - Results area (after search): AI-generated part info + purchase link cards
  - Safe area: top = 20, bottom = tabBarHeight + 20
- **Components**: Toggle between VIN/manual input, link cards with vendor logos

### 7. Marketplace
- **Purpose**: Browse trending products + submit vendor items
- **Layout**:
  - Transparent header (right: submit product button)
  - Scrollable grid of product cards: image, title, price, affiliate link CTA
  - Safe area: top = headerHeight + 20, bottom = tabBarHeight + 20
- **Empty state**: "No products yet" (empty-marketplace.png)

### 8. Profile / Settings
- **Purpose**: Edit profile, view reputation, admin tools (if admin)
- **Layout**:
  - Default header: "Profile"
  - Scrollable form: avatar, handle, bio, location, specialties
  - Admin section (if role = admin): "Moderate Content", "Approve Vendors"
  - Account actions: Log Out, Delete Account (nested under Settings)
  - Safe area: top = 20, bottom = tabBarHeight + 20

## Color Palette

**Primary**: `#FF6B35` (Racing Orange - bold, energetic)  
**Secondary**: `#1A1A1A` (Industrial Black - strong contrast)  
**Accent**: `#FFC107` (Caution Yellow - attention-grabbing CTAs)  
**Background**: `#F5F5F5` (Light Gray - clean workspace)  
**Surface**: `#FFFFFF` (White cards)  
**Text Primary**: `#1A1A1A`  
**Text Secondary**: `#757575`  
**Success**: `#4CAF50`  
**Error**: `#F44336`  

**Brand Garage Colors** (for badges):
- Ford: `#003478`, Dodge: `#C8102E`, Chevy: `#F2A900`, Jeep: `#006341`, General: `#757575`

## Typography

**Primary Font**: **Montserrat** (bold, modern, high-impact headings)  
**Body Font**: **Inter** (legible, professional body text)

**Type Scale**:
- Display: Montserrat Bold, 32px
- H1: Montserrat Bold, 24px
- H2: Montserrat SemiBold, 20px
- H3: Montserrat SemiBold, 18px
- Body: Inter Regular, 16px
- Caption: Inter Regular, 14px
- Small: Inter Regular, 12px

## Visual Design

- **Icons**: Feather icons from @expo/vector-icons
- **Touchables**: 48px minimum height, subtle background color shift on press
- **FABs**: Racing Orange with drop shadow (offset: {width: 0, height: 2}, opacity: 0.10, radius: 2)
- **Cards**: 12px border radius, 1px border (#E0E0E0), white background
- **Brand Badges**: Circular 32px icons with brand color backgrounds

## Assets to Generate

1. **icon.png** - App icon: Orange wrench + chat bubble, used on device home screen
2. **splash-icon.png** - Simplified wrench icon, shown during launch
3. **empty-garages.png** - Empty garage bay with tools on wall, used in Community Hub
4. **empty-threads.png** - Empty forum podium, used in Forum Thread List
5. **empty-garage.png** - Car silhouette with dashed outline, used in My Garage
6. **empty-marketplace.png** - Empty shelves, used in Marketplace
7. **avatar-default.png** - Helmet icon placeholder, used for user profiles without custom avatars