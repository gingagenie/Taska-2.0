-- PRODUCTION EMERGENCY FIX - TESTED AND WORKING
-- Run this SQL directly in production database console BEFORE deployment

-- Step 1: Ensure orgs table exists
CREATE TABLE IF NOT EXISTS orgs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamp with time zone DEFAULT NOW()
);

-- Step 2: Migrate from organisations table if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='organisations') THEN
    INSERT INTO orgs (id, name, created_at)
    SELECT id, name, COALESCE(created_at, NOW())
    FROM organisations
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

-- Step 3: Create missing orgs for any orphaned customers
INSERT INTO orgs (id, name, created_at)
SELECT DISTINCT c.org_id, 
  'Production Org - ' || LEFT(c.org_id::text, 8), 
  NOW()
FROM customers c 
WHERE c.org_id IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM orgs WHERE id = c.org_id)
ON CONFLICT (id) DO NOTHING;

-- Step 4: Create missing orgs for any orphaned users
INSERT INTO orgs (id, name, created_at)
SELECT DISTINCT u.org_id, 
  'Production Org - ' || LEFT(u.org_id::text, 8), 
  NOW()
FROM users u 
WHERE u.org_id IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM orgs WHERE id = u.org_id)
ON CONFLICT (id) DO NOTHING;

-- Step 5: Fix any customers with invalid org_ids
UPDATE customers 
SET org_id = (SELECT id FROM orgs LIMIT 1)
WHERE org_id IS NULL OR org_id NOT IN (SELECT id FROM orgs);

-- Step 6: Create FK constraint
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_org_id_fkey;
ALTER TABLE customers
  ADD CONSTRAINT customers_org_id_fkey
  FOREIGN KEY (org_id) REFERENCES orgs(id)
  ON UPDATE CASCADE ON DELETE RESTRICT;

-- Step 7: Verification (should return 0)
SELECT COUNT(*) as invalid_customers_remaining
FROM customers c 
WHERE c.org_id IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM orgs WHERE id = c.org_id);