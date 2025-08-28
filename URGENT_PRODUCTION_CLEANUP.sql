-- URGENT: Run this in production database console NOW before deployment
-- This handles the exact issue causing FK constraint failures

-- Step 1: Find and delete customers with non-existent org_ids
DELETE FROM customers 
WHERE org_id IS NOT NULL 
  AND org_id NOT IN (SELECT id FROM orgs);

-- Step 2: Find and delete users with non-existent org_ids  
DELETE FROM users
WHERE org_id IS NOT NULL 
  AND org_id NOT IN (SELECT id FROM orgs);

-- Step 3: Verify cleanup worked (should return 0 for both)
SELECT 
  'invalid_customers' as type,
  COUNT(*) as count
FROM customers 
WHERE org_id IS NOT NULL 
  AND org_id NOT IN (SELECT id FROM orgs)
UNION ALL
SELECT 
  'invalid_users' as type,
  COUNT(*) as count  
FROM users
WHERE org_id IS NOT NULL 
  AND org_id NOT IN (SELECT id FROM orgs);

-- Step 4: Test FK constraint creation
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_org_id_fkey;
ALTER TABLE customers
  ADD CONSTRAINT customers_org_id_fkey
  FOREIGN KEY (org_id) REFERENCES orgs(id)
  ON UPDATE CASCADE ON DELETE RESTRICT;

-- If this completes without error, deployment will work