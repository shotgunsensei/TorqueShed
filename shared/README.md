# Shared (Server-Only)

This folder contains shared code used by the **server only**.

## Contents

- `schema.ts` - Drizzle ORM database schema and type exports
- `torque-assist.ts` - TorqueAssist types and interfaces

## Usage

Import via the `@shared/*` path alias (configured in tsconfig.json):

```typescript
import { users, garages, ChatMessage } from "@shared/schema";
import type { TorqueAssistRequest } from "@shared/torque-assist";
```

## Important

**DO NOT import from this folder in client code.**

The client has its own type definitions in:
- `client/hooks/useWebSocket.ts` - ChatMessage type
- `client/constants/products.ts` - Product type

This separation exists because:
1. Drizzle ORM imports are server-only (Node.js)
2. Client types may differ from database types (API transformations)
3. Keeps client bundle size small
