-- Migration: Fix customers_org_id_fkey constraint - comprehensive production-ready approach
-- Date: 2025-08-24
-- Purpose: Ensure customers.org_id properly references orgs(id) for production deployment
-- Handles all edge cases: varchar→uuid conversion, missing orgs, legacy data

-- 1) Ensure customers.org_id is uuid (junk -> NULL so the cast won't explode)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='customers' AND column_name='org_id' AND data_type <> 'uuid'
  ) THEN
    UPDATE customers
       SET org_id = NULL
     WHERE org_id IS NOT NULL
       AND (org_id::text !~ '^[0-9a-f-]{8}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{12}$');

    ALTER TABLE customers
      ALTER COLUMN org_id TYPE uuid USING NULLIF(org_id::text,'')::uuid;
  END IF;
END $$;

-- 2) Create any missing orgs referenced by users/customers (and optionally mirror from organisations)
-- 2a) From users
INSERT INTO orgs (id, name, created_at)
SELECT DISTINCT u.org_id, COALESCE(NULLIF(u.name, ''), 'Imported Org'), NOW()
FROM users u
LEFT JOIN orgs o ON o.id = u.org_id
WHERE u.org_id IS NOT NULL AND o.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- 2b) From customers
INSERT INTO orgs (id, name, created_at)
SELECT DISTINCT c.org_id, 'Imported Org', NOW()
FROM customers c
LEFT JOIN orgs o ON o.id = c.org_id
WHERE c.org_id IS NOT NULL AND o.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- 2c) If legacy table "organisations" exists, mirror anything missing
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='organisations') THEN
    INSERT INTO orgs (id, name, created_at)
    SELECT o.id, COALESCE(NULLIF(o.name,''),'Imported Org'), NOW()
    FROM organisations o
    LEFT JOIN orgs g ON g.id = o.id
    WHERE g.id IS NULL
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

-- 3) Drop any existing FK on customers.org_id (wrong target/definition)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name='customers' AND constraint_name='customers_org_id_fkey'
      AND constraint_type='FOREIGN KEY'
  ) THEN
    EXECUTE 'ALTER TABLE customers DROP CONSTRAINT customers_org_id_fkey';
  END IF;
END $$;

-- 4) Add FK to orgs(id) as NOT VALID so it won't block on legacy rows
ALTER TABLE customers
  ADD CONSTRAINT customers_org_id_fkey
  FOREIGN KEY (org_id) REFERENCES orgs(id)
  ON UPDATE CASCADE ON DELETE RESTRICT
  NOT VALID;

-- 5) Try to validate; if it fails, null any offenders then validate again
DO $$
DECLARE
  bad_count int;
BEGIN
  BEGIN
    ALTER TABLE customers VALIDATE CONSTRAINT customers_org_id_fkey;
  EXCEPTION WHEN foreign_key_violation THEN
    -- Null org_id for rows pointing to non-existent orgs, then validate again
    UPDATE customers c
       SET org_id = NULL
     WHERE c.org_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM orgs o WHERE o.id = c.org_id);

    -- Second attempt should pass now
    ALTER TABLE customers VALIDATE CONSTRAINT customers_org_id_fkey;
  END;
END $$;