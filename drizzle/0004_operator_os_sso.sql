ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "operator_os_user_id" varchar(64);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "operator_os_email" varchar(200);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "operator_os_role" varchar(40);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "operator_os_plan_slug" varchar(40);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "operator_os_organization_id" varchar(64);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "operator_os_last_seen_at" timestamp;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_operator_os_user_id_unique'
  ) THEN
    ALTER TABLE "users"
      ADD CONSTRAINT "users_operator_os_user_id_unique"
      UNIQUE ("operator_os_user_id");
  END IF;
END$$;
