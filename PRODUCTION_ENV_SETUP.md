# Production Environment Setup Guide

## Environment Variables for Production Deployment

Set these environment variables in your Replit Deployment configuration:

```
NODE_ENV=production
CLIENT_ORIGIN=https://taska.info
VITE_API_BASE_URL=https://taska.info
DATABASE_URL=<your-neon-production-database-url>
SESSION_SECRET=<generate-random-long-string>
BIZ_TZ=Australia/Melbourne
```

## Database Migration for Production

Run this SQL on your production Neon database:

```sql
-- PRODUCTION SAFE: Job Assignments Table Creation
-- Idempotent - safe to run multiple times

-- Create the job_assignments pivot table
CREATE TABLE IF NOT EXISTS job_assignments (
  job_id     uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  user_id    varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_at timestamptz DEFAULT now(),
  PRIMARY KEY (job_id, user_id)
);

-- Add indexes for performance
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'job_assignments_job_idx') THEN
    CREATE INDEX job_assignments_job_idx ON job_assignments(job_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'job_assignments_user_idx') THEN
    CREATE INDEX job_assignments_user_idx ON job_assignments(user_id);
  END IF;
END $$;
```

## Production Features Enabled

✅ **Mobile Schedule Timezone Fix**
- Server API accepts `tz=Australia/Melbourne` parameter
- Mobile dates calculated using Australian timezone
- No more blank mobile schedule screens

✅ **Job Assignments System**
- Complete technician assignment workflow
- FK constraints ensure data integrity
- Schedule displays assigned technicians

✅ **Production Authentication**
- Session-based authentication (no development headers)
- Secure cookies with proper CORS configuration
- Compatible with custom domain (taska.info)

## Verification Steps

1. Deploy the application
2. Run the SQL migration on production database
3. Check `https://taska.info/api/debug/env` shows:
   - `nodeEnv: "production"`
   - `clientOrigin: "https://taska.info"`
   - Production database connection

## Build Commands

- Development: `npm run dev`
- Production build: `npm run build`  
- Production start: `npm run start`