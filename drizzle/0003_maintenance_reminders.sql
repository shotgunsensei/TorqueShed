ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email" varchar(200);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "expo_push_token" varchar(200);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "notifications_enabled" boolean DEFAULT true;

CREATE TABLE IF NOT EXISTS "maintenance_reminders" (
  "id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" varchar(36) NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "note_id" varchar(36) NOT NULL REFERENCES "vehicle_notes"("id") ON DELETE CASCADE,
  "channel" varchar(20) NOT NULL,
  "reason" varchar(50),
  "sent_at" timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "maintenance_reminders_user_note_unique"
  ON "maintenance_reminders" ("user_id", "note_id");
