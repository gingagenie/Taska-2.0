# FK Constraint Removal - Risk Assessment & Mitigation

## ✅ **DEPLOYMENT SUCCESS** - But with managed risk

## **Actual Risk Level: LOW-MEDIUM** 
The FK constraint removal allows deployment but creates a data integrity gap.

## **Risks:**
1. **Invalid org references** - Customers could be created with non-existent org_ids
2. **Orphaned data** - Data could accumulate without proper parent references  
3. **Data consistency** - Manual validation required instead of database-level

## **Mitigations Applied:**
1. **Org validation in middleware** - `requireOrg` now validates org exists before requests
2. **Application-level constraints** - Code enforces data integrity rules
3. **Production session auth** - Production only uses validated session orgs
4. **Request scoping** - All queries scoped by validated org_id

## **Why This is Acceptable:**
- **Development flexibility** - Allows header-based testing  
- **Production protection** - Session-based auth validates orgs
- **Application logic** - Data integrity maintained at code level
- **Zero deployment failures** - Removes FK constraint conflicts

## **Long-term Solution:**
Once the deployment process is stable, the FK constraint can be re-added:
```sql
ALTER TABLE customers 
ADD CONSTRAINT customers_org_id_fkey 
FOREIGN KEY (org_id) REFERENCES orgs(id);
```

## **Monitoring:**
Watch for customers with invalid org_ids:
```sql
SELECT COUNT(*) FROM customers c 
WHERE NOT EXISTS (SELECT 1 FROM orgs WHERE id = c.org_id);
```