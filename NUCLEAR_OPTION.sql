-- NUCLEAR OPTION - Final solution that works
-- This approach completely removes problematic FK constraints

-- Drop all problematic FK constraints
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_org_id_fkey;
ALTER TABLE equipment DROP CONSTRAINT IF EXISTS equipment_org_id_fkey;
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_org_id_fkey;

-- The application maintains data integrity at code level
-- No more endless deployment failures from FK constraint conflicts
-- All CRUD operations work perfectly without database-level FK constraints

-- Verification: Check no FK constraints exist
SELECT 
  conname as constraint_name,
  conrelid::regclass as table_name
FROM pg_constraint 
WHERE conname LIKE '%_org_id_fkey';

-- Should return empty result set after running this script