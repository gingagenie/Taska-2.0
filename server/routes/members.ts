import { Router } from "express";
// import { db } from "../db/client"; // replaced with req.db
import { sql } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { requireOrg } from "../middleware/tenancy";
import bcrypt from "bcryptjs";

export const members = Router();
const isUuid = (v: string | undefined) => !!v && /^[0-9a-f-]{36}$/i.test(v);

/* LIST MEMBERS */
members.get("/", requireAuth, requireOrg, async (req, res) => {
  const orgId = (req as any).orgId;
  try {
    // @ts-ignore
    const client = req.db;
    const r: any = await client.query(`
      select id, name, email, role
      from users
      where org_id = current_setting('app.current_org')::uuid
      order by name asc
    `);
    res.json(r.rows);
  } catch (error: any) {
    console.error("GET /api/members error:", error);
    res.status(500).json({ error: error?.message || "Failed to fetch members" });
  }
});

/* ADD MEMBER (creates login too) */
members.post("/", requireAuth, requireOrg, async (req, res) => {
  const orgId = (req as any).orgId;
  const { name, email, role = "technician", password } = req.body || {};
  if (!email || !name) return res.status(400).json({ error: "name and email required" });
  if (!password || password.length < 6) return res.status(400).json({ error: "password must be at least 6 chars" });

  try {
    const existing: any = await db.execute(sql`
      select 1 from users
      where org_id=${orgId}::uuid and lower(email)=lower(${email})
    `);
    if (existing.rows?.length) return res.status(409).json({ error: "email already exists in this org" });

    const hash = await bcrypt.hash(password, 10);

    const ins: any = await db.execute(sql`
      insert into users (org_id, name, email, role, password_hash)
      values (${orgId}::uuid, ${name}, ${email}, ${role}, ${hash})
      returning id, name, email, role
    `);

    res.json({ ok: true, user: ins.rows[0] });
  } catch (error: any) {
    console.error("POST /api/members error:", error);
    res.status(500).json({ error: error?.message || "Failed to create member" });
  }
});

/* EDIT MEMBER */
members.put("/:memberId", requireAuth, requireOrg, async (req, res) => {
  const orgId = (req as any).orgId;
  const { memberId } = req.params;
  const { name, email, role } = req.body || {};
  if (!isUuid(memberId)) return res.status(400).json({ error: "Invalid memberId" });

  try {
    await db.execute(sql`
      update users
      set name  = coalesce(${name}, name),
          email = coalesce(${email}, email),
          role  = coalesce(${role}, role)
      where id=${memberId} and org_id=${orgId}::uuid
    `);

    res.json({ ok: true });
  } catch (error: any) {
    console.error("PUT /api/members error:", error);
    res.status(500).json({ error: error?.message || "Failed to update member" });
  }
});

/* DELETE MEMBER */
members.delete("/:memberId", requireAuth, requireOrg, async (req, res) => {
  const orgId = (req as any).orgId;
  const { memberId } = req.params;
  if (!isUuid(memberId)) return res.status(400).json({ error: "Invalid memberId" });

  try {
    await db.execute(sql`
      delete from users
      where id=${memberId} and org_id=${orgId}::uuid
    `);

    res.json({ ok: true });
  } catch (error: any) {
    console.error("DELETE /api/members error:", error);
    res.status(500).json({ error: error?.message || "Failed to delete member" });
  }
});