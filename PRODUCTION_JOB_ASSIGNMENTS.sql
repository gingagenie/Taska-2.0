-- PRODUCTION SAFE: Job Assignments Table Creation
-- Idempotent - safe to run multiple times on production

-- Create the job_assignments pivot table
CREATE TABLE IF NOT EXISTS job_assignments (
  job_id     uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  user_id    varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_at timestamptz DEFAULT now(),
  PRIMARY KEY (job_id, user_id)
);

-- Add indexes for performance (guarded to prevent duplicate creation errors)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'job_assignments_job_idx') THEN
    CREATE INDEX job_assignments_job_idx ON job_assignments(job_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'job_assignments_user_idx') THEN
    CREATE INDEX job_assignments_user_idx ON job_assignments(user_id);
  END IF;
END $$;

-- Verify the table was created correctly
SELECT 
  table_name, 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'job_assignments'
ORDER BY ordinal_position;