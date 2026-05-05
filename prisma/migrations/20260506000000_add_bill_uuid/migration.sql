-- Add uuid column to Bill
ALTER TABLE "Bill" ADD COLUMN "uuid" TEXT;

-- Generate UUIDs for existing bills using PostgreSQL native function
UPDATE "Bill" SET "uuid" = gen_random_uuid()::TEXT;

-- Set NOT NULL and UNIQUE constraints
ALTER TABLE "Bill" ALTER COLUMN "uuid" SET NOT NULL;
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_uuid_key" UNIQUE ("uuid");

-- Add default for new rows (Prisma will handle this at application level via @default(uuid()))
