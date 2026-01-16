# @gearhead/shared

Shared types, validators, Supabase client, and API utilities for GearHead.

## Installation

This package is designed to be consumed by both web and mobile clients via path aliases or npm workspaces.

## Structure

```
src/
├── types/           # TypeScript types mirroring DB schema
│   ├── database.ts  # Database table types + Supabase Database type
│   └── api.ts       # API response types, enriched types
├── validators/      # Zod schemas for runtime validation
│   ├── common.ts    # Shared validators (UUID, URL, VIN, etc.)
│   ├── profile.ts   # Profile create/update validators
│   ├── garage.ts    # Garage validators
│   ├── chat.ts      # Chat message validators
│   ├── forum.ts     # Forum thread/reply validators
│   ├── vehicle.ts   # Vehicle/note validators
│   ├── product.ts   # Product/vendor submission validators
│   └── report.ts    # Report/block validators
├── supabase/        # Typed Supabase client wrapper
│   ├── client.ts    # Client initialization and singleton
│   ├── auth.ts      # Authentication helpers
│   └── realtime.ts  # Realtime subscription utilities
├── api/             # Unified API client
│   ├── client.ts    # HTTP client with auth token injection
│   └── endpoints.ts # Type-safe API endpoint functions
└── index.ts         # Main exports
```

## Usage

### Types

```typescript
import type { Profile, Vehicle, Product, Database } from '@gearhead/shared';

const user: Profile = { ... };
```

### Validators

```typescript
import { createVehicleSchema, updateProfileSchema } from '@gearhead/shared';

const result = createVehicleSchema.safeParse(formData);
if (!result.success) {
  console.error(result.error.flatten());
}
```

### Supabase Client

```typescript
import { initSupabase, getSupabase, signIn, signUp } from '@gearhead/shared';

// Initialize once at app startup
initSupabase({
  url: process.env.SUPABASE_URL,
  anonKey: process.env.SUPABASE_ANON_KEY,
});

// Use anywhere
const supabase = getSupabase();
const { data } = await supabase.from('garages').select('*');

// Auth helpers
const { user, error } = await signIn({ email, password });
```

### Realtime Subscriptions

```typescript
import { subscribeToChatMessages, cleanupAllChannels } from '@gearhead/shared';

const subscription = subscribeToChatMessages('ford', (payload) => {
  console.log('New message:', payload.new);
});

// Cleanup on unmount
subscription.unsubscribe();
```

### API Client

```typescript
import { initApiClient, garageApi, vehicleApi, chatApi } from '@gearhead/shared';

// Initialize once
initApiClient({
  baseUrl: 'https://your-api.com',
  getAuthToken: async () => session?.access_token,
  onUnauthorized: () => navigation.navigate('Login'),
});

// Use type-safe API functions
const { data: garages } = await garageApi.list();
const { data: vehicles } = await vehicleApi.list();
const { error } = await chatApi.sendMessage({ garage_id: 'ford', content: 'Hello!' });
```

## Available Exports

### Types
- `Profile`, `Garage`, `ChatMessage`, `ForumThread`, `ForumReply`
- `Vehicle`, `VehicleNote`, `Product`, `Report`, `UserBlock`
- `Database` (Supabase typed database)
- `ApiResponse<T>`, `PaginatedResponse<T>`, enriched types

### Validators
- `createProfileSchema`, `updateProfileSchema`
- `createGarageSchema`, `joinGarageSchema`
- `createChatMessageSchema`
- `createForumThreadSchema`, `createForumReplySchema`
- `createVehicleSchema`, `createVehicleNoteSchema`
- `createProductSchema`, `approveProductSchema`
- `createReportSchema`, `blockUserSchema`

### Supabase
- `initSupabase()`, `getSupabase()`, `createSupabaseClient()`
- `signUp()`, `signIn()`, `signOut()`, `getSession()`, `getUser()`
- `onAuthStateChange()`, `getCurrentProfile()`
- `subscribeToTable()`, `subscribeToChatMessages()`, `subscribeToForumThreads()`

### API
- `initApiClient()`, `get()`, `post()`, `put()`, `patch()`, `del()`
- `profileApi`, `garageApi`, `chatApi`, `forumApi`
- `vehicleApi`, `productApi`, `adminApi`, `reportApi`, `blockApi`, `partsApi`
