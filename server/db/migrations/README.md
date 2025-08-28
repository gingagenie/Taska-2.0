# Database Migrations

## 2025-08-24: FK Constraint Fix

**File**: `2025_08_24_fix_customers_org_id_fkey.sql`

**Purpose**: Fixes the customers_org_id_fkey constraint to properly reference orgs(id) instead of organisations(id).

**What it does**:
1. Creates orgs table if missing
2. Migrates data from organisations → orgs table 
3. Creates missing org records for any dangling references
4. Handles both varchar and uuid org_id column types
5. Safely drops and recreates FK constraint
6. Uses NOT VALID + VALIDATE pattern for zero-downtime deployment

**Safety features**:
- Handles missing tables gracefully
- Preserves existing data by copying from organisations table
- Creates placeholder orgs for missing references
- Uses ON CONFLICT DO NOTHING to prevent duplicates
- Validates all data before applying constraint

**Production deployment**:
This migration is designed to be safe for production deployment and handles all edge cases that could cause FK constraint violations.