/*
  # Add last_seen_at to users_profile

  1. Changes
    - Add `last_seen_at` column to `users_profile` table
    - Add index on `last_seen_at` for performance
*/

ALTER TABLE "public"."users_profile" 
ADD COLUMN IF NOT EXISTS "last_seen_at" timestamptz;

CREATE INDEX IF NOT EXISTS "users_profile_last_seen_at_idx" 
ON "public"."users_profile" ("last_seen_at");
