import { Router } from "express"; import { db } from "../db/client"; import { sql } from "drizzle-orm";
import { requireAuth } from "../middleware/auth"; import { requireOrg } from "../middleware/tenancy";
export const teams = Router();
teams.get("/", requireAuth, requireOrg, async (req,res)=> {
  const orgId = (req as any).orgId;
  const r:any = await db.execute(sql`select id,name from teams where org_id=${orgId}::uuid order by created_at asc`);
  res.json(r.rows);
});
teams.post("/add-member", requireAuth, requireOrg, async (req,res)=> {
  const orgId = (req as any).orgId; const { email,name,teamId } = req.body||{};
  if(!email||!name) return res.status(400).json({ error:"email and name required" });
  await db.execute(sql`insert into users (email,name) values (${email},${name}) on conflict (email) do nothing;`);
  await db.execute(sql`insert into memberships (user_id,org_id,role) select id,${orgId}::uuid,'member' from users where email=${email} on conflict do nothing;`);
  if (teamId) await db.execute(sql`insert into team_members (team_id,user_id) select ${teamId}::uuid,id from users where email=${email} on conflict do nothing;`);
  res.json({ ok:true });
});