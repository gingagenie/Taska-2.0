-- PRODUCTION FK FIX - Run this SQL directly in production database BEFORE deployment
-- This systematic approach ensures clean FK constraint deployment

-- Step 1: Normalize org_id column type (handles varchar → uuid conversion safely)
BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'customers'
      AND column_name = 'org_id'
      AND data_type <> 'uuid'
  ) THEN
    UPDATE customers
       SET org_id = NULL
     WHERE org_id IS NOT NULL
       AND (org_id::text !~ '^[0-9a-f-]{8}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{12}$');

    ALTER TABLE customers
      ALTER COLUMN org_id TYPE uuid USING NULLIF(org_id::text,'')::uuid;
  END IF;
END$$;

COMMIT;

-- Step 2: Remove customers with invalid org_id references
BEGIN;

DELETE FROM customers c
USING (
  SELECT c.id
  FROM customers c
  LEFT JOIN orgs o ON o.id = c.org_id
  WHERE c.org_id IS NOT NULL AND o.id IS NULL
) bad
WHERE c.id = bad.id;

COMMIT;

-- Step 3: Fix FK constraint to point to orgs(id)
BEGIN;

ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_org_id_fkey;

ALTER TABLE customers
  ADD CONSTRAINT customers_org_id_fkey
  FOREIGN KEY (org_id) REFERENCES orgs(id)
  ON UPDATE CASCADE ON DELETE RESTRICT;

COMMIT;

-- Verification: All should return 0
SELECT 'customers_with_invalid_orgs' as check_name, COUNT(*) as count
FROM customers c
WHERE c.org_id IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM orgs WHERE id = c.org_id);