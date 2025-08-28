-- Migration: Fix item_presets unique index (uuid + case-insensitive name)
-- Date: 2025-08-26
-- Purpose: Ensure correct composite unique index on (org_id, lower(name))

-- Ensure the correct unique index exists for (org_id, lower(name))
DO $$
BEGIN
  -- Drop any existing index with this name (regardless of definition)
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'item_presets_org_name_unique') THEN
    DROP INDEX item_presets_org_name_unique;
  END IF;

  -- Create correct composite unique index (uuid + expression)
  EXECUTE $ix$
    CREATE UNIQUE INDEX item_presets_org_name_unique
    ON item_presets (org_id, LOWER(name))
  $ix$;
END
$$;