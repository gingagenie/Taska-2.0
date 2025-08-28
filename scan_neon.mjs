import { Pool } from 'pg';
const urls = process.argv.slice(2);
if (!urls.length) { console.error("Usage: node scan_neon.mjs '<url1>' '<url2>' ..."); process.exit(2); }
async function tableExists(pool,fq){const[s,t]=fq.includes('.')?fq.split('.'):['public',fq];
  const {rows}=await pool.query(`SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema=$1 AND table_name=$2) AS ex`,[s,t]); return !!rows[0]?.ex; }
async function listTables(pool){ const {rows}=await pool.query(`SELECT table_schema,table_name FROM information_schema.tables WHERE table_type='BASE TABLE' ORDER BY 1,2 LIMIT 200`); return rows; }
async function check(url){
  console.log('\n==============================================');
  console.log('URL:', url.replace(/:\/\/[^@]+@/,'://***:***@'));
  const pool = new Pool({ connectionString: url });
  try{
    await pool.query('SET statement_timeout=3000');
    const hasOrgs = await tableExists(pool,'public.orgs');
    const hasOrganisations = await tableExists(pool,'public.organisations');
    if (hasOrgs || hasOrganisations){
      const table = hasOrgs ? 'public.orgs' : 'public.organisations';
      console.log('Org table:', table);
      const { rows } = await pool.query(`SELECT id,name,created_at FROM ${table} ORDER BY created_at NULLS LAST, name LIMIT 50`);
      console.table(rows);
    } else {
      console.log('No orgs/organisations table. Listing first 200 tables:');
      console.table(await listTables(pool));
    }
  } catch(e){ console.error('Error:', e.message); }
  finally { await pool.end(); }
}
for (const u of urls) await check(u);
