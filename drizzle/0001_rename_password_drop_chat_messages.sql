-- Phase 1 Foundation Cleanup Migration
-- Applied: 2026-03-24
-- Description: Rename password column to password_hash, drop chat_messages table

ALTER TABLE "users" RENAME COLUMN "password" TO "password_hash";

DROP TABLE IF EXISTS "chat_messages";
