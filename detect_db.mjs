import { Pool } from 'pg';
const url = process.env.DATABASE_URL;
if (!url) { console.error('No DATABASE_URL set.'); process.exit(2); }
const pool = new Pool({ connectionString: url });

async function q(sql,p=[]) { const c=await pool.connect(); try{ return await c.query(sql,p);} finally{ c.release(); } }
async function tableExists(name){ const [s,t]=name.includes('.')?name.split('.'):['public',name];
  const {rows}=await q(`SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema=$1 AND table_name=$2) AS ex`,[s,t]); return !!rows[0]?.ex; }

(async () => {
  console.log('Using DATABASE_URL:', url.replace(/:\/\/[^@]+@/,'://***:***@'));
  const candidates = ['public.orgs','public.organisations'];
  let orgTable = null;
  for (const t of candidates) if (await tableExists(t)) { orgTable = t; break; }
  if (!orgTable) { console.error('No org table found (tried public.orgs/organisations).'); process.exit(1); }
  console.log('Org table:', orgTable);
  const { rows } = await q(`SELECT id, name, created_at FROM ${orgTable} ORDER BY created_at NULLS LAST, name LIMIT 50`);
  console.table(rows);
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
