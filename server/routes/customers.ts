import { Router } from "express";
import { db } from "../db/client";
import { sql } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { requireOrg } from "../middleware/tenancy";
import multer from "multer";
import { parse } from "csv-parse";
import { Readable } from "stream";

export const customers = Router();
const isUuid = (v?: string) => !!v && /^[0-9a-f-]{36}$/i.test(v);

// Configure multer for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

/* LIST */
customers.get("/", requireAuth, requireOrg, async (req, res) => {
  const orgId = (req as any).orgId;
  console.log("[TRACE] GET /api/customers org=%s", orgId);
  
  try {
    // @ts-ignore
    const client = req.db;
    const r: any = await client.query(`
      select id, name, contact_name, email, phone, street, suburb, state, postcode
      from customers
      order by name asc
    `);
    res.json(r.rows);
  } catch (error: any) {
    console.error("GET /api/customers error:", error);
    res.status(500).json({ error: error?.message || "Failed to fetch customers" });
  }
});

/* GET ONE */
customers.get("/:id", requireAuth, requireOrg, async (req, res) => {
  const { id } = req.params;
  const orgId = (req as any).orgId;
  console.log("[TRACE] GET /api/customers/%s org=%s", id, orgId);
  
  if (!isUuid(id)) return res.status(400).json({ error: "invalid id" });
  
  try {
    // @ts-ignore
    const client = req.db;
    const r: any = await client.query(
      `select id, name, contact_name, email, phone, street, suburb, state, postcode
       from customers
       where id=$1 and org_id = current_setting('app.current_org')::uuid`,
      [id]
    );
    const row = r.rows?.[0];
    if (!row) return res.status(404).json({ error: "not found" });
    res.json(row);
  } catch (error: any) {
    console.error("GET /api/customers/:id error:", error);
    res.status(500).json({ error: error?.message || "Failed to fetch customer" });
  }
});

/* CREATE */
customers.post("/", requireAuth, requireOrg, async (req, res) => {
  const orgId = (req as any).orgId; // guaranteed after requireOrg
  console.log("[TRACE] POST /api/customers org=%s", orgId);
  
  // Org validation handled by tenant guard
  
  const { name, contact_name, email, phone, street, suburb, state, postcode, notes } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ error: "name required" });

  try {
    // @ts-ignore
    const client = req.db;
    const ins: any = await client.query(`
      insert into customers (
        org_id, name, contact_name, email, phone, street, suburb, state, postcode, notes
      ) values (
        current_setting('app.current_org')::uuid, $1, $2, $3, $4, $5, $6, $7, $8, $9
      )
      returning id
    `, [name, contact_name||null, email||null, phone||null, street||null, suburb||null, state||null, postcode||null, notes||null]);

    const row: any = await client.query(`
      select id, name, contact_name, email, phone, street, suburb, state, postcode, notes, created_at
      from customers where id=$1
    `, [ins.rows[0].id]);

    res.json({ ok: true, customer: row.rows[0] });
  } catch (error: any) {
    console.error("POST /api/customers error:", error);
    res.status(500).json({ error: error?.message || "Failed to create customer" });
  }
});

/* UPDATE */
customers.put("/:id", requireAuth, requireOrg, async (req, res) => {
  const orgId = (req as any).orgId;
  const { id } = req.params;
  console.log("[TRACE] PUT /api/customers/%s org=%s", id, orgId);
  
  if (!isUuid(id)) return res.status(400).json({ error: "invalid id" });

  const { name, contact_name, email, phone, street, suburb, state, postcode } = req.body || {};
  
  try {
    // @ts-ignore
    const client = req.db;
    await client.query(`
      update customers set
        name         = coalesce($2, name),
        contact_name = coalesce($3, contact_name),
        email        = coalesce($4, email),
        phone        = coalesce($5, phone),
        street       = coalesce($6, street),
        suburb       = coalesce($7, suburb),
        state        = coalesce($8, state),
        postcode     = coalesce($9, postcode)
      where id=$1 and org_id = current_setting('app.current_org')::uuid
    `, [id, name, contact_name, email, phone, street, suburb, state, postcode]);
    res.json({ ok: true });
  } catch (error: any) {
    console.error("PUT /api/customers/:id error:", error);
    res.status(500).json({ error: error?.message || "Failed to update customer" });
  }
});

/* DELETE */
customers.delete("/:id", requireAuth, requireOrg, async (req, res) => {
  const { id } = req.params;
  const orgId = (req as any).orgId;
  console.log("[TRACE] DELETE /api/customers/%s org=%s", id, orgId);
  
  if (!isUuid(id)) return res.status(400).json({ error: "invalid id" });

  try {
    // Check if customer has any associated jobs
    // @ts-ignore
    const client = req.db;
    const jobCheck = await client.query(`
      select count(*) as job_count 
      from jobs 
      where customer_id=$1 and org_id = current_setting('app.current_org')::uuid
    `, [id]);
    
    const jobCount = parseInt(String(jobCheck.rows[0]?.job_count || "0"));
    
    if (jobCount > 0) {
      return res.status(400).json({ 
        error: `Cannot delete customer. They have ${jobCount} associated job${jobCount > 1 ? 's' : ''}.` 
      });
    }

    // Safe to delete - no associated jobs
    await client.query(`
      delete from customers
      where id=$1 and org_id = current_setting('app.current_org')::uuid
    `, [id]);

    res.json({ ok: true });
  } catch (error: any) {
    console.error("DELETE /api/customers/:id error:", error);
    res.status(500).json({ error: error?.message || "Failed to delete customer" });
  }
});

/* CSV IMPORT */
customers.post("/import-csv", requireAuth, requireOrg, upload.single('csvFile'), async (req, res) => {
  const orgId = (req as any).orgId;
  console.log("[TRACE] POST /api/customers/import-csv org=%s", orgId);
  
  if (!req.file) {
    return res.status(400).json({ error: "No CSV file uploaded" });
  }

  try {
    // Org validation handled by tenant guard
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
        const { name, email, phone, address, contact_name, street, suburb, state, postcode, notes } = record;
        
        if (!name?.trim()) {
          errors.push(`Row ${rowNum}: Missing required field 'name'`);
          continue;
        }

        // Insert customer
        // @ts-ignore
        const client = req.db;
        await client.query(`
          insert into customers (
            org_id, name, contact_name, email, phone, address, street, suburb, state, postcode, notes
          ) values (
            current_setting('app.current_org')::uuid, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
          )
        `, [name, contact_name||null, email||null, phone||null, address||null, street||null, suburb||null, state||null, postcode||null, notes||null]);

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
    console.error("POST /api/customers/import-csv error:", error);
    res.status(500).json({ error: error?.message || "Failed to import CSV" });
  }
});

export { customers as default };