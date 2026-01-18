# DEPRECATED - Supabase Migrations

These files are historical examples and are NOT used by the current project.

## Current Stack

TorqueShed uses:
- **PostgreSQL** with `DATABASE_URL` environment variable
- **Drizzle ORM** for schema management (`shared/schema.ts`)
- **Custom JWT auth** with `APP_JWT_SECRET` (not Supabase auth)

## Database Management

To apply schema changes:
```bash
npm run db:push
```

The Drizzle schema is defined in `shared/schema.ts`.

## Why These Files Exist

These SQL migrations were created during early development when Supabase was considered. They are preserved for reference only and should not be used.
