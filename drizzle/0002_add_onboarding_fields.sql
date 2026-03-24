ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "onboarding_completed" boolean DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "onboarding_goals" json DEFAULT '[]'::json;
UPDATE "users" SET "onboarding_completed" = true WHERE "onboarding_completed" IS NULL;
