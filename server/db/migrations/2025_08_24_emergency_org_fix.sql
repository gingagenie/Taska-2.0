-- EMERGENCY PRODUCTION FIX
-- Run this BEFORE applying the FK constraint migration
-- This ensures all referenced org_ids exist in the orgs table

-- Create missing orgs that are referenced by customers
INSERT INTO orgs (id, name, created_at)
SELECT DISTINCT c.org_id, 
       COALESCE(
         (SELECT name FROM organisations WHERE id = c.org_id),
         'Migrated Org - ' || SUBSTRING(c.org_id::text, 1, 8)
       ),
       NOW()
FROM customers c
WHERE c.org_id IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM orgs WHERE id = c.org_id)
ON CONFLICT (id) DO NOTHING;

-- Create missing orgs that are referenced by users
INSERT INTO orgs (id, name, created_at)
SELECT DISTINCT u.org_id,
       COALESCE(
         (SELECT name FROM organisations WHERE id = u.org_id),
         'Migrated Org - ' || SUBSTRING(u.org_id::text, 1, 8)
       ),
       NOW()
FROM users u
WHERE u.org_id IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM orgs WHERE id = u.org_id)
ON CONFLICT (id) DO NOTHING;

-- Clean up any customers with NULL or invalid org_ids
UPDATE customers SET org_id = (
  SELECT id FROM orgs LIMIT 1
) WHERE org_id IS NULL;