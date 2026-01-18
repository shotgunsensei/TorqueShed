# TorqueShed Supabase Migrations (DEPRECATED)

> **Note:** These files are historical examples and are NOT used by the current project. TorqueShed now uses Drizzle ORM with PostgreSQL. See `DEPRECATED.md` for details.

## Overview
These SQL migrations were created during early development when Supabase was considered. They are preserved for reference only.

## Migration Files

| File | Description |
|------|-------------|
| `00001_create_extensions.sql` | Enable UUID and text search extensions |
| `00002_create_users_table.sql` | Profiles table with RLS (extends auth.users) |
| `00003_create_garages_table.sql` | Garages and membership tables with RLS |
| `00004_create_chat_messages_table.sql` | Chat messages with RLS and realtime |
| `00005_create_forums_tables.sql` | Forum threads and replies with RLS |
| `00006_create_vehicles_tables.sql` | Vehicles and notes (private to owner) |
| `00007_create_products_table.sql` | Products/vendor submissions with RLS |
| `00008_create_moderation_tables.sql` | Reports and user blocks with RLS |
| `00009_seed_data.sql` | Seed garages and sample products |
| `00010_create_admin_functions.sql` | Admin helper functions |

## Running Migrations

### Option 1: Supabase CLI
```bash
# Install Supabase CLI
npm install -g supabase

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Run migrations
supabase db push
```

### Option 2: Supabase Dashboard
1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy and paste each migration file in order
4. Execute each one

### Option 3: Combined Migration
Run `combined_migration.sql` which contains all migrations in order.

## RLS Policy Summary

### Profiles
| Policy | Access |
|--------|--------|
| SELECT | All authenticated users |
| UPDATE own | Owner only |
| UPDATE any | Admin only |

### Garages
| Policy | Access |
|--------|--------|
| SELECT | All authenticated users |
| INSERT/UPDATE/DELETE | Admin only |

### Garage Members
| Policy | Access |
|--------|--------|
| SELECT | All authenticated users |
| INSERT/DELETE own | Owner only |

### Chat Messages
| Policy | Access |
|--------|--------|
| SELECT | All authenticated (non-deleted) |
| INSERT | Authenticated, non-banned |
| UPDATE (delete) | Owner, Moderator, Admin |

### Forum Threads/Replies
| Policy | Access |
|--------|--------|
| SELECT | All authenticated (non-deleted) |
| INSERT | Authenticated, non-banned |
| UPDATE own | Owner only |
| UPDATE any | Moderator, Admin |

### Vehicles & Notes
| Policy | Access |
|--------|--------|
| ALL | Owner only (private) |

### Products
| Policy | Access |
|--------|--------|
| SELECT approved | All authenticated |
| SELECT own | Submitter |
| SELECT all | Admin |
| INSERT | Vendor, Admin |
| UPDATE/DELETE | Admin only |

### Reports
| Policy | Access |
|--------|--------|
| SELECT own | Reporter |
| SELECT all | Moderator, Admin |
| INSERT | All authenticated |
| UPDATE | Moderator, Admin |

### User Blocks
| Policy | Access |
|--------|--------|
| ALL own | Blocker only |

## Helper Functions

| Function | Purpose |
|----------|---------|
| `is_user_banned(uuid)` | Check if user is currently banned |
| `is_garage_member(uuid, varchar)` | Check garage membership |
| `is_blocked(uuid, uuid)` | Check if user is blocked |
| `is_admin()` | Check if current user is admin |
| `is_mod_or_admin()` | Check if current user is mod/admin |
| `ban_user(uuid, interval, text)` | Ban a user (mod/admin) |
| `unban_user(uuid)` | Unban a user (mod/admin) |
| `approve_product(uuid)` | Approve vendor submission (admin) |
| `reject_product(uuid, text)` | Reject vendor submission (admin) |
| `promote_to_vendor(uuid)` | Promote user to vendor role (admin) |

## Environment Variables

Add these to your `.env` file:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Post-Migration Steps

1. **Create first admin user:**
   - Sign up a user through the app
   - In Supabase dashboard, update their profile: `UPDATE profiles SET role = 'admin' WHERE handle = 'your_handle';`

2. **Create sample thread (optional):**
   - The commented SQL in `00009_seed_data.sql` shows how to create a welcome thread

3. **Enable Realtime:**
   - Chat messages table is added to realtime publication
   - Enable realtime in Supabase dashboard for the project

## Security Notes

- All tables have RLS enabled
- Service role key bypasses RLS (use only on server)
- Anon key respects RLS (safe for client)
- Ban checks happen at insert time for messages/threads
- Soft deletes preserve data for moderation review
