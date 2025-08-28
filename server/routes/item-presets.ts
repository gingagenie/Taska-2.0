import { Router } from "express";
import { db } from "../db/client";
import { sql } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { requireOrg } from "../middleware/tenancy";

export const itemPresets = Router();

/** GET /api/item-presets?search=lab */
itemPresets.get("/", requireAuth, requireOrg, async (req, res) => {
  const orgId = (req as any).orgId;
  const q = String(req.query.search || "").trim();
  const r: any = await db.execute(sql`
    select id, name, unit_amount, tax_rate
    from item_presets
    where org_id=${orgId}::uuid
      and (${q === ""} or lower(name) like ${"%" + q.toLowerCase() + "%"})
    order by name asc
    limit 20
  `);
  res.json(r.rows);
});

/** POST /api/item-presets  { name, unit_amount, tax_rate }  (manual add in Settings) */
itemPresets.post("/", requireAuth, requireOrg, async (req, res) => {
  const orgId = (req as any).orgId;
  const { name, unit_amount, tax_rate } = req.body || {};
  if (!name || String(name).trim() === "") {
    return res.status(400).json({ error: "name required" });
  }
  
  try {
    // First try to insert new record
    const r: any = await db.execute(sql`
      insert into item_presets (org_id, name, unit_amount, tax_rate)
      values (${orgId}::uuid, ${name.trim()}, ${Number(unit_amount) || 0}, ${Number(tax_rate) ?? 0})
      returning id, name, unit_amount, tax_rate
    `);
    res.json(r.rows[0]);
  } catch (error: any) {
    // If conflict (duplicate), update existing record
    if (error.message?.includes('duplicate') || error.message?.includes('unique')) {
      const r: any = await db.execute(sql`
        update item_presets 
        set unit_amount = ${Number(unit_amount) || 0}, tax_rate = ${Number(tax_rate) ?? 0}
        where org_id = ${orgId}::uuid and lower(name) = ${name.trim().toLowerCase()}
        returning id, name, unit_amount, tax_rate
      `);
      res.json(r.rows[0]);
    } else {
      console.error("Error creating item preset:", error);
      res.status(500).json({ error: "Failed to create preset" });
    }
  }
});

/** POST /api/item-presets/ensure  { name, unit_amount, tax_rate }
 * Creates if not exists (used by auto-save on first use)
 */
itemPresets.post("/ensure", requireAuth, requireOrg, async (req, res) => {
  const orgId = (req as any).orgId;
  const { name, unit_amount, tax_rate } = req.body || {};
  if (!name || String(name).trim() === "") {
    return res.status(400).json({ error: "name required" });
  }
  const r: any = await db.execute(sql`
    insert into item_presets (org_id, name, unit_amount, tax_rate)
    values (${orgId}::uuid, ${name.trim()}, ${Number(unit_amount) || 0}, ${Number(tax_rate) ?? 0})
    on conflict (org_id, lower(name)) do nothing
    returning id, name, unit_amount, tax_rate
  `);
  if (r.rows?.[0]) return res.json(r.rows[0]);

  // existed — return existing
  const e: any = await db.execute(sql`
    select id, name, unit_amount, tax_rate
    from item_presets
    where org_id=${orgId}::uuid and lower(name)=${name.trim().toLowerCase()}
    limit 1
  `);
  res.json(e.rows?.[0]);
});

/** DELETE /api/item-presets/:id */
itemPresets.delete("/:id", requireAuth, requireOrg, async (req, res) => {
  const orgId = (req as any).orgId;
  const { id } = req.params;
  
  if (!id) {
    return res.status(400).json({ error: "ID required" });
  }

  const r: any = await db.execute(sql`
    delete from item_presets
    where id=${id}::uuid and org_id=${orgId}::uuid
    returning id, name
  `);
  
  if (r.rows?.length === 0) {
    return res.status(404).json({ error: "Preset not found" });
  }
  
  res.json({ deleted: true, id, name: r.rows[0].name });
});