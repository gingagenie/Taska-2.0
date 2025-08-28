-- Add notes column if it doesn't exist
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS notes text;