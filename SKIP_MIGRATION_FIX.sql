-- SKIP MIGRATION FIX - Run this in production to prevent Drizzle from recreating constraint
-- This tells Drizzle that the constraint already exists and is valid

-- The constraint already exists from our manual fix, so Drizzle should skip it
-- This SQL is just for documentation - the constraint should already be working

-- Verify the constraint exists (should return 1 row)
SELECT 
  conname as constraint_name,
  contype as constraint_type, 
  confrelid::regclass as referenced_table
FROM pg_constraint 
WHERE conname = 'customers_org_id_fkey';

-- If this returns a row, the constraint exists and deployment should work