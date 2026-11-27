-- Prepare legacy tables so TypeORM synchronize can add NOT NULL columns safely.

-- users: add fullName with default, then backfill
ALTER TABLE users ADD COLUMN IF NOT EXISTS "fullName" character varying(255);
UPDATE users SET "fullName" = COALESCE(NULLIF("fullName", ''), split_part(email, '@', 1)) WHERE "fullName" IS NULL;
ALTER TABLE users ALTER COLUMN "fullName" SET DEFAULT '';
UPDATE users SET "fullName" = COALESCE("fullName", '') WHERE "fullName" IS NULL;
ALTER TABLE users ALTER COLUMN "fullName" SET NOT NULL;

ALTER TABLE users ADD COLUMN IF NOT EXISTS username character varying(64);
UPDATE users SET username = COALESCE(username, split_part(email, '@', 1)) WHERE username IS NULL;

ALTER TABLE users ADD COLUMN IF NOT EXISTS mobile character varying(20);

-- products extended catalog fields
ALTER TABLE products ADD COLUMN IF NOT EXISTS company character varying(128);
ALTER TABLE products ADD COLUMN IF NOT EXISTS size character varying(32);
ALTER TABLE products ADD COLUMN IF NOT EXISTS color character varying(32);
ALTER TABLE products ADD COLUMN IF NOT EXISTS "hsnCode" character varying(16);
ALTER TABLE products ADD COLUMN IF NOT EXISTS category character varying(128);
ALTER TABLE products ADD COLUMN IF NOT EXISTS brand character varying(128);
ALTER TABLE products ADD COLUMN IF NOT EXISTS "subCategory" character varying(128);
ALTER TABLE products ADD COLUMN IF NOT EXISTS unit character varying(32);
ALTER TABLE products ADD COLUMN IF NOT EXISTS "gstPercent" numeric(5,2) NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS "saleRate" numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS mrp numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS "purchaseRate" numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS "minStock" integer NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS "maxStock" integer NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS "imageUrl" character varying(512);
ALTER TABLE products ADD COLUMN IF NOT EXISTS "showOnEcommerce" boolean NOT NULL DEFAULT false;

-- sync_event_log enum extensions (safe if already present)
DO $$ BEGIN
  ALTER TYPE sync_event_log_eventtype_enum ADD VALUE IF NOT EXISTS 'SUPPLIER_PAYMENT';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE sync_event_log_eventtype_enum ADD VALUE IF NOT EXISTS 'EXPENSE';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
