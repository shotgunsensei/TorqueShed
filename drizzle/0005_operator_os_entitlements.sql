ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "operator_os_tenant_id" varchar(64);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "entitlement_snapshot_json" jsonb;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_entitlement_sync_at" timestamp;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "name" text;
