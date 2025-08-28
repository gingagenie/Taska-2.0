-- FINAL PRODUCTION FIX - Nuclear option that will definitely work
-- This completely rebuilds the FK constraint from scratch

-- Step 1: Drop the problematic constraint entirely
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_org_id_fkey;

-- Step 2: Make org_id nullable to avoid constraint violations during fix
ALTER TABLE customers ALTER COLUMN org_id DROP NOT NULL;

-- Step 3: Ensure orgs table exists with default org
CREATE TABLE IF NOT EXISTS orgs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamp with time zone DEFAULT NOW()
);

-- Step 4: Create a default org if none exist
INSERT INTO orgs (id, name, created_at)
SELECT gen_random_uuid(), 'Default Organization', NOW()
WHERE NOT EXISTS (SELECT 1 FROM orgs)
LIMIT 1;

-- Step 5: Migrate any data from organisations table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='organisations') THEN
    INSERT INTO orgs (id, name, created_at)
    SELECT id, name, COALESCE(created_at, NOW())
    FROM organisations
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

-- Step 6: Fix all customers to have valid org_ids
UPDATE customers 
SET org_id = (SELECT id FROM orgs LIMIT 1)
WHERE org_id IS NULL 
   OR NOT EXISTS (SELECT 1 FROM orgs WHERE id = customers.org_id);

-- Step 7: Make org_id NOT NULL again
ALTER TABLE customers ALTER COLUMN org_id SET NOT NULL;

-- Step 8: Create the FK constraint (this should work now)
ALTER TABLE customers
  ADD CONSTRAINT customers_org_id_fkey
  FOREIGN KEY (org_id) REFERENCES orgs(id)
  ON UPDATE CASCADE ON DELETE RESTRICT;

-- Step 9: Verify success (should return 0)
SELECT COUNT(*) as problematic_customers
FROM customers c 
WHERE NOT EXISTS (SELECT 1 FROM orgs WHERE id = c.org_id);