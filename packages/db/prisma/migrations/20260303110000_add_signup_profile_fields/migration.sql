-- Add profile fields used by signup flow
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "username" TEXT,
  ADD COLUMN IF NOT EXISTS "fullName" TEXT,
  ADD COLUMN IF NOT EXISTS "country" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON "User"("username");
