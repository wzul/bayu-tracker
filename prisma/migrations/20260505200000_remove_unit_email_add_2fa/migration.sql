-- Remove email from Unit, add 2FA fields to User

-- Step 1: Add 2FA columns to User (nullable, default false)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "twoFactorSecret" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false;

-- Step 2: Drop email column from Unit
-- First, handle any foreign key constraints if they reference this column
-- (Prisma doesn't create FKs on non-relation columns, so we can drop directly)
ALTER TABLE "Unit" DROP COLUMN IF EXISTS "email";
