import { Router } from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { requireOrg } from "../middleware/tenancy";
import multer from "multer";
import { parse } from "csv-parse";
import { Readable } from "stream";

export const equipment = Router();
const isUuid = (v?: string) => !!v && /^[0-9a-f-]{36}$/i.test(v);

// Configure multer for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

/* LIST: equipment + customer name + address */
equipment.get("/", requireAuth, requireOrg, async (req, res) => {
  const orgId = (req as any).orgId;
  const r: any = await db.execute(sql`
    select
      e.id, e.name, e.make, e.model, 
      coalesce(e.serial, e.serial_number) as serial, 
      e.notes,
      e.customer_id,
      coalesce(c.name,'—') as customer_name,
      -- one-line address from customer
      nullif(trim(concat_ws(', ',
        nullif(c.street,''),
        nullif(c.suburb,''),
        nullif(c.state,''),
        nullif(c.postcode,'')
      )), '') as customer_address
    from equipment e
    left join customers c on c.id = e.customer_id
    where e.org_id = ${orgId}::uuid
    order by e.name nulls last, e.created_at desc
  `);
  res.json(r.rows);
});

/* GET ONE */
equipment.get("/:id", requireAuth, requireOrg, async (req, res) => {
  const { id } = req.params;
  const orgId = (req as any).orgId;
  if (!isUuid(id)) return res.status(400).json({ error: "invalid id" });

  const r: any = await db.execute(sql`
    select
      e.id, e.name, e.make, e.model, 
      coalesce(e.serial, e.serial_number) as serial, 
      e.notes, e.customer_id,
      coalesce(c.name,'—') as customer_name,
      nullif(trim(concat_ws(', ',
        nullif(c.street,''),
        nullif(c.suburb,''),
        nullif(c.state,''),
        nullif(c.postcode,'')
      )), '') as customer_address
    from equipment e
    left join customers c on c.id = e.customer_id
    where e.id=${id}::uuid and e.org_id=${orgId}::uuid
  `);
  const row = r.rows?.[0];
  if (!row) return res.status(404).json({ error: "not found" });
  res.json(row);
});

/* CREATE */
equipment.post("/", requireAuth, requireOrg, async (req, res) => {
  const orgId = (req as any).orgId;
  
  // Double-check org existence right before insert
  const ok: any = await db.execute(sql`select 1 from orgs where id=${orgId}::uuid`);
  if (!ok.rows?.length) {
    console.log(`[AUTH] 400 - Invalid org at equipment insert: orgId=${orgId}`);
    return res.status(400).json({ error: "Invalid org" });
  }
  
  let { name, make, model, serial, notes, customerId } = req.body || {};
  if (customerId === "") customerId = null;

  try {
    const r: any = await db.execute(sql`
      insert into equipment (org_id, name, make, model, serial_number, notes, customer_id)
      values (
        ${orgId},
        ${name || null},
        ${make || null},
        ${model || null},
        ${serial || null},
        ${notes || null},
        ${customerId || null}
      )
      returning id
    `);
    res.json({ ok: true, id: r.rows[0].id });
  } catch (error: any) {
    console.error("Equipment creation error:", error);
    res.status(500).json({ error: error?.message || "Failed to create equipment" });
  }
});

/* UPDATE */
equipment.put("/:id", requireAuth, requireOrg, async (req, res) => {
  const { id } = req.params;
  const orgId = (req as any).orgId;
  if (!isUuid(id)) return res.status(400).json({ error: "invalid id" });

  let { name, make, model, serial, notes, customerId } = req.body || {};
  if (customerId === "") customerId = null;

  await db.execute(sql`
    update equipment set
      name         = coalesce(${name}, name),
      make         = coalesce(${make}, make),
      model        = coalesce(${model}, model),
      serial_number = coalesce(${serial}, serial_number),
      notes        = coalesce(${notes}, notes),
      customer_id  = ${customerId ? sql`${customerId}::uuid` : null}
    where id=${id}::uuid and org_id=${orgId}::uuid
  `);
  res.json({ ok: true });
});

/* DELETE (safe: block if linked to jobs) */
equipment.delete("/:id", requireAuth, requireOrg, async (req, res) => {
  const { id } = req.params;
  const orgId = (req as any).orgId;
  if (!isUuid(id)) return res.status(400).json({ error: "invalid id" });

  // Check if this equipment is referenced by any job
  const ref: any = await db.execute(sql`
    select count(*)::int as cnt
    from job_equipment
    where equipment_id=${id}::uuid
  `);
  if ((ref.rows?.[0]?.cnt ?? 0) > 0) {
    return res.status(409).json({ error: "Cannot delete: equipment is linked to one or more jobs." });
  }

  // Delete only within the same org for safety
  await db.execute(sql`
    delete from equipment
    where id=${id}::uuid and org_id=${orgId}::uuid
  `);

  res.json({ ok: true });
});

/* CSV IMPORT */
equipment.post("/import-csv", requireAuth, requireOrg, upload.single('csvFile'), async (req, res) => {
  const orgId = (req as any).orgId;
  console.log("[TRACE] POST /api/equipment/import-csv org=%s", orgId);
  
  if (!req.file) {
    return res.status(400).json({ error: "No CSV file uploaded" });
  }

  try {
    // Double-check org existence
    const ok: any = await db.execute(sql`select 1 from orgs where id=${orgId}::uuid`);
    if (!ok.rows?.length) {
      console.log(`[AUTH] 400 - Invalid org at CSV import: orgId=${orgId}`);
      return res.status(400).json({ error: "Invalid org" });
    }

    const csvContent = req.file.buffer.toString('utf-8');
    const records: any[] = [];
    
    // Parse CSV
    const readable = Readable.from([csvContent]);
    const parser = parse({
      columns: true,
      skip_empty_lines: true,
      trim: true
    });

    readable.pipe(parser);

    for await (const record of parser) {
      records.push(record);
    }

    if (records.length === 0) {
      return res.status(400).json({ error: "No valid records found in CSV" });
    }

    let imported = 0;
    let errors: string[] = [];

    // Process each record
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const rowNum = i + 2; // +2 because CSV header is row 1, data starts at row 2
      
      try {
        const { name, model, serial_number, make, serial, notes, customer_name } = record;
        
        if (!name?.trim()) {
          errors.push(`Row ${rowNum}: Missing required field 'name'`);
          continue;
        }

        let customerId = null;
        
        // Look up customer by name if provided
        if (customer_name?.trim()) {
          const customerResult: any = await db.execute(sql`
            select id from customers 
            where name = ${customer_name} and org_id = ${orgId}::uuid
          `);
          
          if (customerResult.rows.length > 0) {
            customerId = customerResult.rows[0].id;
          } else {
            errors.push(`Row ${rowNum}: Customer '${customer_name}' not found`);
            continue;
          }
        }

        // Insert equipment
        await db.execute(sql`
          insert into equipment (
            org_id, name, model, serial_number, make, serial, notes, customer_id
          ) values (
            ${orgId}::uuid, ${name}, ${model||null}, ${serial_number||null}, 
            ${make||null}, ${serial||null}, ${notes||null}, ${customerId}
          )
        `);

        imported++;
      } catch (error: any) {
        errors.push(`Row ${rowNum}: ${error.message}`);
      }
    }

    res.json({
      ok: true,
      imported,
      total: records.length,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error: any) {
    console.error("POST /api/equipment/import-csv error:", error);
    res.status(500).json({ error: error?.message || "Failed to import CSV" });
  }
});

export default equipment;