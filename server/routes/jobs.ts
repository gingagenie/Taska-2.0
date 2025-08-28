import { Router } from "express";
// import { db } from "../db"; // replaced with req.db for tenant isolation
import { jobs as jobsSchema, customers, equipment, jobPhotos, users, jobAssignments } from "../../shared/schema";
import multer from "multer";
import path from "path";
import fs from "fs";
import { requireAuth } from "../middleware/auth";
import { requireOrg } from "../middleware/tenancy";
import { sql, eq, and } from "drizzle-orm";

export const jobs = Router();

// UUID validation helper
function isUuid(str: string): boolean {
  return /^[0-9a-f-]{36}$/i.test(str);
}

// Timezone-aware scheduled_at normalization
function normalizeScheduledAt(raw: any): string|null {
  if (!raw) return null;
  // If client already sent proper UTC ISO with Z, pass it through
  if (typeof raw === "string" && /Z$/.test(raw)) return raw;
  // If it looks like "YYYY-MM-DDTHH:mm" (datetime-local), it should now be coming pre-converted from client
  // Client should use isoFromLocalInput() to convert Melbourne time to UTC before sending
  if (typeof raw === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(raw)) {
    // Treat as Melbourne time and convert to UTC (subtract 10 hours)
    const localDate = new Date(raw + ":00"); // Add seconds if missing
    const utcDate = new Date(localDate.getTime() - (10 * 60 * 60 * 1000)); // Melbourne is UTC+10
    if (!isNaN(utcDate.valueOf())) return utcDate.toISOString();
  }
  // Fallback: let Postgres parse; but ensure timestamptz column
  return raw;
}

// Configure multer for file uploads
const upload = multer({ dest: "uploads/" });

// Add ping endpoint for health check
jobs.get("/ping", (_req, res) => {
  console.log("[TRACE] GET /api/jobs/ping");
  res.json({ ok: true });
});

// GET /api/jobs/equipment?customerId=uuid - Filter equipment by customer for job creation
jobs.get("/equipment", requireAuth, requireOrg, async (req, res) => {
  const orgId = (req as any).orgId;
  const customerId = (req.query.customerId as string | undefined) || undefined;

  // @ts-ignore
  const client = req.db;
  let query = `
    select id, name
    from equipment
    where org_id = current_setting('app.current_org')::uuid
  `;
  let params: any[] = [];
  
  if (customerId) {
    query += ` and customer_id = $1`;
    params.push(customerId);
  }
  
  query += ` order by name asc`;
  const r: any = await client.query(query, params);
  res.json(r.rows);
});

/* LIST COMPLETED JOBS */
jobs.get("/completed", requireAuth, requireOrg, async (req, res) => {
  const orgId = (req as any).orgId;
  console.log("[TRACE] GET /api/jobs/completed org=%s", orgId);
  
  try {
    const r: any = await (req as any).db.execute(sql`
      SELECT 
        id,
        original_job_id,
        customer_id,
        customer_name,
        title,
        description,
        notes,
        scheduled_at,
        completed_at,
        completed_by,
        original_created_by,
        original_created_at
      FROM completed_jobs
      WHERE org_id = ${orgId}::uuid
      ORDER BY completed_at DESC
    `);
    res.json(r.rows);
  } catch (e: any) {
    console.error("GET /api/jobs/completed error:", e);
    res.status(500).json({ error: e?.message || "Failed to fetch completed jobs" });
  }
});

/* GET INDIVIDUAL COMPLETED JOB */
jobs.get("/completed/:jobId", requireAuth, requireOrg, async (req, res) => {
  const { jobId } = req.params;
  const orgId = (req as any).orgId;
  console.log("[TRACE] GET /api/jobs/completed/%s org=%s", jobId, orgId);
  
  try {
    if (!/^[0-9a-f-]{36}$/i.test(jobId)) {
      return res.status(400).json({ error: "Invalid jobId" });
    }

    const r: any = await (req as any).db.execute(sql`
      SELECT 
        id,
        original_job_id,
        customer_id,
        customer_name,
        title,
        description,
        notes,
        scheduled_at,
        completed_at,
        completed_by,
        original_created_by,
        original_created_at
      FROM completed_jobs
      WHERE id = ${jobId}::uuid AND org_id = ${orgId}::uuid
    `);
    
    if (r.rows.length === 0) {
      return res.status(404).json({ error: "Completed job not found" });
    }
    
    res.json(r.rows[0]);
  } catch (e: any) {
    console.error("GET /api/jobs/completed/%s error:", jobId, e);
    res.status(500).json({ error: e?.message || "Failed to fetch completed job" });
  }
});

/* LIST (now includes description) */
jobs.get("/", requireAuth, requireOrg, async (req, res) => {
  const orgId = (req as any).orgId;
  console.log("[TRACE] GET /api/jobs org=%s", orgId);
  
  try {
    const r: any = await (req as any).db.execute(sql`
      select
        j.id,
        j.title,
        j.description,             -- added
        j.status,
        to_char(j.scheduled_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as scheduled_at,
        j.customer_id,
        coalesce(c.name,'—') as customer_name
      from jobs j
      left join customers c on c.id = j.customer_id
      where j.org_id=${orgId}::uuid
      order by j.created_at desc
    `);
    res.json(r.rows);
  } catch (error: any) {
    console.error("GET /api/jobs error:", error);
    res.status(500).json({ error: error?.message || "Failed to fetch jobs" });
  }
});

// --- TECH FILTER SOURCE ---
// Return technicians in this org (id + name). Query from actual users/memberships.
jobs.get("/technicians", requireAuth, requireOrg, async (req, res) => {
  const orgId = (req as any).orgId;
  console.log("[TRACE] GET /api/jobs/technicians org=%s", orgId);
  
  try {
    const r: any = await (req as any).db.execute(sql`
      select id, name, email, role
      from users
      where org_id = ${orgId}::uuid
      order by name asc
    `);
    res.json(r.rows);
  } catch (error: any) {
    console.error("GET /api/jobs/technicians error:", error);
    res.status(500).json({ error: error?.message || "Failed to fetch technicians" });
  }
});

// --- RANGE with optional techId filter ---
jobs.get("/range", requireAuth, requireOrg, async (req, res) => {
  const orgId = (req as any).orgId;
  const { start, end, techId } = req.query as { start?: string; end?: string; techId?: string };

  if (!start || !end) return res.status(400).json({ error: "start and end are required (ISO strings)" });

  try {
    // Build the query with optional technician filtering
    let query = sql`
      select j.id, j.title, j.status, 
             to_char(j.scheduled_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as scheduled_at,
             j.customer_id, coalesce(c.name,'—') as customer_name
      from jobs j
      left join customers c on c.id = j.customer_id
    `;
    
    // Add technician filter if specified
    if (techId && techId !== "" && techId !== "none") {
      query = sql`
        select j.id, j.title, j.status, 
               to_char(j.scheduled_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as scheduled_at,
               j.customer_id, coalesce(c.name,'—') as customer_name
        from jobs j
        left join customers c on c.id = j.customer_id
        inner join job_assignments ja on ja.job_id = j.id
        where j.org_id = ${orgId}::uuid
          and ja.user_id = ${techId}
          and j.scheduled_at is not null
          and j.scheduled_at >= ${start}::timestamptz
          and j.scheduled_at <  ${end}::timestamptz
        order by j.scheduled_at asc
      `;
    } else {
      query = sql`
        select j.id, j.title, j.status, 
               to_char(j.scheduled_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as scheduled_at,
               j.customer_id, coalesce(c.name,'—') as customer_name
        from jobs j
        left join customers c on c.id = j.customer_id
        where j.org_id = ${orgId}::uuid
          and j.scheduled_at is not null
          and j.scheduled_at >= ${start}::timestamptz
          and j.scheduled_at <  ${end}::timestamptz
        order by j.scheduled_at asc
      `;
    }

    const r: any = await (req as any).db.execute(query);
    res.json(r.rows);
  } catch (error: any) {
    console.error("GET /api/jobs/range error:", error);
    res.status(500).json({ error: error?.message || "Failed to fetch jobs" });
  }
});

// GET /customers - Return dropdown data by org
jobs.get("/customers", requireAuth, requireOrg, async (req, res) => {
  try {
    const orgId = (req as any).orgId;
    console.log("[TRACE] GET /api/jobs/customers org=%s", orgId);
    
    const result = await (req as any).db
      .select({
        id: customers.id,
        name: customers.name,
      })
      .from(customers)
      .where(eq(customers.orgId, orgId));

    res.json(result);
  } catch (error: any) {
    console.error("GET /api/jobs/customers error:", error);
    res.status(500).json({ error: error?.message || "Failed to fetch customers" });
  }
});

// GET /equipment - Return dropdown data by org
jobs.get("/equipment", requireAuth, requireOrg, async (req, res) => {
  try {
    const orgId = (req as any).orgId;
    console.log("[TRACE] GET /api/jobs/equipment org=%s", orgId);
    
    const result = await (req as any).db
      .select({
        id: equipment.id,
        name: equipment.name,
      })
      .from(equipment)
      .where(eq(equipment.orgId, orgId));

    res.json(result);
  } catch (error: any) {
    console.error("GET /api/jobs/equipment error:", error);
    res.status(500).json({ error: error?.message || "Failed to fetch equipment" });
  }
});

// GET /:jobId - Return specific job with details
jobs.get("/:jobId", requireAuth, requireOrg, async (req, res) => {
  try {
    const { jobId } = req.params;
    const orgId = (req as any).orgId;
    console.log("[TRACE] GET /api/jobs/%s org=%s", jobId, orgId);

    if (!/^[0-9a-f-]{36}$/i.test(jobId)) {
      return res.status(400).json({ error: "Invalid jobId" });
    }

    const jr: any = await (req as any).db.execute(sql`
      select
        j.id, j.title, j.description, j.status, j.notes,
        to_char(j.scheduled_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as scheduled_at,
        j.customer_id,
        coalesce(c.name,'—') as customer_name,
        c.address as customer_address,
        c.phone as customer_phone
      from jobs j
      left join customers c on c.id = j.customer_id
      where j.id=${jobId}::uuid and j.org_id=${orgId}::uuid
    `);
    
    const result = jr.rows;

    if (!result.length) {
      return res.status(404).json({ error: "Job not found" });
    }

    const job = result[0];

    // Fetch assigned technicians
    const techniciansResult: any = await (req as any).db.execute(sql`
      select u.id, u.name, u.email
      from job_assignments ja
      join users u on u.id = ja.user_id
      where ja.job_id = ${jobId}::uuid
    `);

    // Fetch assigned equipment
    const equipmentResult: any = await (req as any).db.execute(sql`
      select e.id, e.name, e.make, e.model
      from job_equipment je
      join equipment e on e.id = je.equipment_id
      where je.job_id = ${jobId}::uuid
    `);

    // Add the arrays to the job object
    job.technicians = techniciansResult.rows || [];
    job.equipment = equipmentResult.rows || [];

    res.json(job);
  } catch (error: any) {
    console.error("GET /api/jobs/:id error:", error);
    res.status(500).json({ error: error?.message || "Failed to fetch job" });
  }
});

// POST /create - Insert new job
jobs.post("/create", requireAuth, requireOrg, async (req, res) => {
  const orgId = (req as any).orgId;
  const userId = (req as any).user?.id || null;

  let { title, description, customerId, scheduledAt, equipmentId, assignedTechIds } = req.body || {};
  if (!title) return res.status(400).json({ error: "title required" });

  // normalize inputs
  if (customerId === "") customerId = null;
  if (equipmentId === "") equipmentId = null;

  // Use the new timezone normalization function
  const scheduled = normalizeScheduledAt(scheduledAt);

  try {
    console.log("[DEBUG] Creating job with values:", {
      orgId: orgId,
      customerId: customerId || null,
      title: title,
      description: description || null,
      scheduledAt: scheduledAt,
      status: 'new',
      createdBy: userId || null,
    });
    
    const result = await (req as any).db.execute(sql`
      INSERT INTO jobs (org_id, customer_id, title, description, scheduled_at, status, created_by)
      VALUES (
        ${orgId},
        ${customerId || null},
        ${title},
        ${description || null},
        ${scheduled || null},
        'new',
        ${userId || null}
      )
      RETURNING id
    `);
    
    const jobId = (result as any).rows[0].id;

    if (equipmentId) {
      await (req as any).db.execute(sql`
        insert into job_equipment (job_id, equipment_id)
        values (${jobId}::uuid, ${equipmentId}::uuid)
        on conflict do nothing
      `);
    }

    // create job assignments if provided
    if (Array.isArray(assignedTechIds) && assignedTechIds.length > 0) {
      for (const uid of assignedTechIds) {
        if (!uid) continue;
        await (req as any).db.execute(sql`
          insert into job_assignments (job_id, user_id)
          values (${jobId}::uuid, ${uid}::uuid)
          on conflict do nothing
        `);
      }
    }

    res.json({ ok: true, id: jobId });
  } catch (e: any) {
    console.error("POST /api/jobs/create error:", e);
    res.status(500).json({ error: e?.message || "create failed" });
  }
});

// --- DRAG-TO-RESCHEDULE (just update scheduled_at) ---
jobs.patch("/:jobId/schedule", requireAuth, requireOrg, async (req, res) => {
  const { jobId } = req.params;
  const orgId = (req as any).orgId;
  const { scheduledAt } = req.body || {};
  if (!jobId || !/^[0-9a-f-]{36}$/i.test(jobId)) return res.status(400).json({ error: "invalid jobId" });
  if (!scheduledAt) return res.status(400).json({ error: "scheduledAt required (ISO)" });

  await (req as any).db.execute(sql`
    update jobs set scheduled_at = ${scheduledAt}::timestamptz
    where id=${jobId}::uuid and org_id=${orgId}::uuid
  `);

  res.json({ ok: true });
});

// PUT /:jobId - Update job
jobs.put("/:jobId", requireAuth, requireOrg, async (req, res) => {
  const { jobId } = req.params;
  const orgId = (req as any).orgId;

  // Validate ID quickly
  if (!/^[0-9a-f-]{36}$/i.test(jobId)) {
    return res.status(400).json({ error: "Invalid jobId" });
  }

  let { title, description, status, scheduledAt, customerId } = req.body || {};
  if (customerId === "") customerId = null;

  // Use the new timezone normalization function
  const scheduled = normalizeScheduledAt(scheduledAt);

  // Always log what we received (so we know the route is hit)
  console.log("PUT /api/jobs/%s org=%s body=%o", jobId, orgId, {
    title, description, status, scheduledAt: scheduled, customerId
  });

  try {
    // Use SQL for update with timezone-aware scheduled_at
    const result = await (req as any).db.execute(sql`
      UPDATE jobs SET 
        title = coalesce(${title}, title),
        description = coalesce(${description}, description),
        status = coalesce(${status}, status),
        scheduled_at = coalesce(${scheduled}, scheduled_at),
        customer_id = ${customerId}
      WHERE id = ${jobId}::uuid AND org_id = ${orgId}::uuid
      RETURNING id
    `);

    if (!(result as any).rows.length) {
      console.warn("PUT /api/jobs/%s -> no match for org=%s", jobId, orgId);
      return res.status(404).json({ error: "Job not found" });
    }

    console.log("PUT /api/jobs/%s -> ok", jobId);
    res.json({ ok: true });
  } catch (error: any) {
    console.error("PUT /api/jobs/%s error:", jobId, error);
    res.status(500).json({ error: error?.message || "Update failed" });
  }
});

// Photo routes

// GET /:jobId/photos - List photos for a job
jobs.get("/:jobId/photos", requireAuth, requireOrg, async (req, res) => {
  try {
    const { jobId } = req.params;
    const orgId = (req as any).orgId;
    
    console.log("[TRACE] GET /api/jobs/%s/photos org=%s", jobId, orgId);
    
    const result = await (req as any).db.execute(sql`
      SELECT id, url, created_at
      FROM job_photos
      WHERE job_id = ${jobId}::uuid AND org_id = ${orgId}::uuid
      ORDER BY created_at DESC
    `);
    
    res.json((result as any).rows || []);
  } catch (error: any) {
    console.error("GET /api/jobs/%s/photos error:", req.params.jobId, error);
    res.status(500).json({ error: error?.message || "Failed to fetch photos" });
  }
});

// POST /:jobId/photos - Upload photo for a job
jobs.post("/:jobId/photos", requireAuth, requireOrg, upload.single("photo"), async (req, res) => {
  try {
    const { jobId } = req.params;
    const orgId = (req as any).orgId;
    const file = req.file;
    
    if (!file) {
      return res.status(400).json({ error: "No file provided" });
    }
    
    // Create unique filename
    const filename = `${Date.now()}-${file.originalname}`;
    const destPath = path.join("uploads", filename);
    
    // Move file from temp location to uploads folder
    fs.renameSync(file.path, destPath);
    
    const url = `/uploads/${filename}`;
    
    console.log("[TRACE] POST /api/jobs/%s/photos org=%s file=%s", jobId, orgId, filename);
    
    // Insert into database
    const result = await (req as any).db.execute(sql`
      INSERT INTO job_photos (job_id, org_id, url)
      VALUES (${jobId}::uuid, ${orgId}::uuid, ${url})
      RETURNING id, url, created_at
    `);
    
    const photo = (result as any).rows[0];
    res.json(photo);
  } catch (error: any) {
    console.error("POST /api/jobs/%s/photos error:", req.params.jobId, error);
    res.status(500).json({ error: error?.message || "Failed to upload photo" });
  }
});

// DELETE /:jobId/photos/:photoId - Delete a photo
jobs.delete("/:jobId/photos/:photoId", requireAuth, requireOrg, async (req, res) => {
  try {
    const { jobId, photoId } = req.params;
    const orgId = (req as any).orgId;
    
    console.log("[TRACE] DELETE /api/jobs/%s/photos/%s org=%s", jobId, photoId, orgId);
    
    // Get photo info before deleting to remove file
    const photoResult = await (req as any).db.execute(sql`
      SELECT url FROM job_photos 
      WHERE id = ${photoId}::uuid AND job_id = ${jobId}::uuid AND org_id = ${orgId}::uuid
    `);
    
    const photos = (photoResult as any).rows || [];
    if (photos.length > 0) {
      const photoUrl = photos[0].url;
      // Remove file from filesystem if it exists
      const filePath = path.join(".", photoUrl);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    
    // Delete from database
    await (req as any).db.execute(sql`
      DELETE FROM job_photos 
      WHERE id = ${photoId}::uuid AND job_id = ${jobId}::uuid AND org_id = ${orgId}::uuid
    `);
    
    res.json({ ok: true });
  } catch (error: any) {
    console.error("DELETE /api/jobs/%s/photos/%s error:", req.params.jobId, req.params.photoId, error);
    res.status(500).json({ error: error?.message || "Failed to delete photo" });
  }
});

/* NOTES */
jobs.get("/:jobId/notes", requireAuth, requireOrg, async (req, res) => {
  const { jobId } = req.params; 
  const orgId = (req as any).orgId;
  try {
    const r: any = await (req as any).db.execute(sql`
      select id, text, created_at
      from job_notes
      where job_id=${jobId}::uuid and org_id=${orgId}::uuid
      order by created_at desc
    `);
    res.json(r.rows);
  } catch (e: any) {
    console.error("GET /api/jobs/:jobId/notes error:", e);
    res.status(500).json({ error: e?.message || "Failed to fetch notes" });
  }
});

jobs.post("/:jobId/notes", requireAuth, requireOrg, async (req, res) => {
  const { jobId } = req.params; 
  const orgId = (req as any).orgId;
  const { text } = req.body || {};
  if (!text?.trim()) return res.status(400).json({ error: "text required" });
  try {
    const r: any = await (req as any).db.execute(sql`
      insert into job_notes (job_id, org_id, text)
      values (${jobId}::uuid, ${orgId}::uuid, ${text})
      returning id, text, created_at
    `);
    res.json(r.rows[0]);
  } catch (e: any) {
    console.error("POST /api/jobs/:jobId/notes error:", e);
    res.status(500).json({ error: e?.message || "Failed to add note" });
  }
});

jobs.put("/:jobId/notes", requireAuth, requireOrg, async (req, res) => {
  const { jobId } = req.params; 
  const orgId = (req as any).orgId;
  const { notes } = req.body || {};
  try {
    await (req as any).db.execute(sql`
      update jobs 
      set notes = ${notes || ''}, updated_at = now()
      where id = ${jobId}::uuid and org_id = ${orgId}::uuid
    `);
    res.json({ ok: true });
  } catch (e: any) {
    console.error("PUT /api/jobs/:jobId/notes error:", e);
    res.status(500).json({ error: e?.message || "Failed to save notes" });
  }
});

/* CHARGES */
jobs.get("/:jobId/charges", requireAuth, requireOrg, async (req, res) => {
  const { jobId } = req.params; 
  const orgId = (req as any).orgId;
  try {
    const r: any = await (req as any).db.execute(sql`
      select id, kind, description, quantity, unit_price, total, created_at
      from job_charges
      where job_id=${jobId}::uuid and org_id=${orgId}::uuid
      order by created_at desc
    `);
    res.json(r.rows);
  } catch (e: any) {
    console.error("GET /api/jobs/:jobId/charges error:", e);
    res.status(500).json({ error: e?.message || "Failed to fetch charges" });
  }
});

jobs.post("/:jobId/charges", requireAuth, requireOrg, async (req, res) => {
  const { jobId } = req.params; 
  const orgId = (req as any).orgId;
  let { kind, description, quantity, unitPrice } = req.body || {};
  if (!description?.trim()) return res.status(400).json({ error: "description required" });
  kind = kind || "labour";
  quantity = Number(quantity) || 0;
  unitPrice = Number(unitPrice) || 0;
  const total = quantity * unitPrice;

  try {
    const r: any = await (req as any).db.execute(sql`
      insert into job_charges (job_id, org_id, kind, description, quantity, unit_price, total)
      values (${jobId}::uuid, ${orgId}::uuid, ${kind}, ${description}, ${quantity}, ${unitPrice}, ${total})
      returning id, kind, description, quantity, unit_price, total, created_at
    `);
    res.json(r.rows[0]);
  } catch (e: any) {
    console.error("POST /api/jobs/:jobId/charges error:", e);
    res.status(500).json({ error: e?.message || "Failed to add charge" });
  }
});

/* COMPLETE JOB - Move job to completed_jobs table */
jobs.post("/:jobId/complete", requireAuth, requireOrg, async (req, res) => {
  const { jobId } = req.params;
  const orgId = (req as any).orgId;
  const userId = (req as any).user?.id;
  
  if (!isUuid(jobId)) return res.status(400).json({ error: "Invalid jobId" });

  try {
    // First, get the job details from the jobs table
    const jobResult: any = await (req as any).db.execute(sql`
      SELECT j.*, c.name as customer_name
      FROM jobs j
      LEFT JOIN customers c ON j.customer_id = c.id
      WHERE j.id = ${jobId}::uuid AND j.org_id = ${orgId}::uuid
    `);

    if (jobResult.rows.length === 0) {
      return res.status(404).json({ error: "Job not found" });
    }

    const job = jobResult.rows[0];

    // Insert into completed_jobs table
    const completedResult: any = await (req as any).db.execute(sql`
      INSERT INTO completed_jobs (
        org_id, original_job_id, customer_id, customer_name, title, description, notes,
        scheduled_at, completed_by, original_created_by, original_created_at
      )
      VALUES (
        ${orgId}::uuid, ${jobId}::uuid, ${job.customer_id}::uuid, ${job.customer_name},
        ${job.title}, ${job.description}, ${job.notes}, ${job.scheduled_at},
        ${userId}, ${job.created_by}, ${job.created_at}
      )
      RETURNING id, completed_at
    `);

    // Copy job charges to preserve them (since they'll be deleted by CASCADE when job is deleted)
    // Create the table if it doesn't exist first
    await (req as any).db.execute(sql`
      CREATE TABLE IF NOT EXISTS completed_job_charges (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        completed_job_id uuid NOT NULL,
        original_job_id uuid NOT NULL,
        org_id uuid NOT NULL,
        kind text NOT NULL,
        description text NOT NULL,
        quantity numeric NOT NULL DEFAULT 0,
        unit_price numeric NOT NULL DEFAULT 0,
        total numeric NOT NULL DEFAULT 0,
        created_at timestamptz DEFAULT now()
      )
    `);

    // Copy existing charges to the completed job charges table (if any)
    await (req as any).db.execute(sql`
      INSERT INTO completed_job_charges (
        completed_job_id, original_job_id, org_id, kind, description, quantity, unit_price, total, created_at
      )
      SELECT 
        ${completedResult.rows[0].id}::uuid,
        ${jobId}::uuid,
        org_id,
        kind,
        description,
        quantity,
        unit_price,
        total,
        created_at
      FROM job_charges
      WHERE job_id = ${jobId}::uuid
    `);

    // Copy hours to completed job hours table
    await (req as any).db.execute(sql`
      INSERT INTO completed_job_hours (
        completed_job_id, original_job_id, org_id, hours, description, created_at
      )
      SELECT 
        ${completedResult.rows[0].id}::uuid,
        ${jobId}::uuid,
        org_id,
        hours,
        description,
        created_at
      FROM job_hours
      WHERE job_id = ${jobId}::uuid
    `);

    // Copy parts to completed job parts table
    await (req as any).db.execute(sql`
      INSERT INTO completed_job_parts (
        completed_job_id, original_job_id, org_id, part_name, quantity, created_at
      )
      SELECT 
        ${completedResult.rows[0].id}::uuid,
        ${jobId}::uuid,
        org_id,
        part_name,
        quantity,
        created_at
      FROM job_parts
      WHERE job_id = ${jobId}::uuid
    `);

    // Delete related records first, but preserve job_charges for the completed job
    await (req as any).db.execute(sql`
      DELETE FROM job_notifications
      WHERE job_id = ${jobId}::uuid
    `);
    
    await (req as any).db.execute(sql`
      DELETE FROM job_assignments
      WHERE job_id = ${jobId}::uuid
    `);
    
    await (req as any).db.execute(sql`
      DELETE FROM job_equipment
      WHERE job_id = ${jobId}::uuid
    `);
    
    await (req as any).db.execute(sql`
      DELETE FROM job_photos
      WHERE job_id = ${jobId}::uuid
    `);

    // NOTE: We don't delete job_charges here so they remain accessible via original_job_id
    // Finally delete the job from the jobs table
    await (req as any).db.execute(sql`
      DELETE FROM jobs
      WHERE id = ${jobId}::uuid AND org_id = ${orgId}::uuid
    `);

    res.json({ 
      ok: true, 
      completed_job_id: completedResult.rows[0].id,
      completed_at: completedResult.rows[0].completed_at
    });
  } catch (e: any) {
    console.error("POST /api/jobs/:jobId/complete error:", e);
    res.status(500).json({ error: e?.message || "Failed to complete job" });
  }
});

/* ADD HOURS TO JOB */
jobs.post("/:jobId/hours", requireAuth, requireOrg, async (req, res) => {
  const { jobId } = req.params;
  const { hours, description } = req.body;
  const orgId = (req as any).orgId;
  
  if (!isUuid(jobId)) return res.status(400).json({ error: "Invalid jobId" });
  if (!hours || typeof hours !== 'number' || hours % 0.5 !== 0) {
    return res.status(400).json({ error: "Hours must be in 0.5 increments" });
  }

  try {
    const r: any = await (req as any).db.execute(sql`
      INSERT INTO job_hours (job_id, org_id, hours, description)
      VALUES (${jobId}::uuid, ${orgId}::uuid, ${hours}, ${description || ''})
      RETURNING id, hours, description, created_at
    `);
    res.json(r.rows[0]);
  } catch (e: any) {
    console.error("POST /api/jobs/:jobId/hours error:", e);
    res.status(500).json({ error: e?.message || "Failed to add hours" });
  }
});

/* ADD PARTS TO JOB */
jobs.post("/:jobId/parts", requireAuth, requireOrg, async (req, res) => {
  const { jobId } = req.params;
  const { partName, quantity } = req.body;
  const orgId = (req as any).orgId;
  
  if (!isUuid(jobId)) return res.status(400).json({ error: "Invalid jobId" });
  if (!partName || typeof partName !== 'string') {
    return res.status(400).json({ error: "Part name is required" });
  }
  if (!quantity || !Number.isInteger(quantity) || quantity <= 0) {
    return res.status(400).json({ error: "Quantity must be a positive whole number" });
  }

  try {
    const r: any = await (req as any).db.execute(sql`
      INSERT INTO job_parts (job_id, org_id, part_name, quantity)
      VALUES (${jobId}::uuid, ${orgId}::uuid, ${partName}, ${quantity})
      RETURNING id, part_name, quantity, created_at
    `);
    res.json(r.rows[0]);
  } catch (e: any) {
    console.error("POST /api/jobs/:jobId/parts error:", e);
    res.status(500).json({ error: e?.message || "Failed to add part" });
  }
});

/* GET HOURS FOR JOB */
jobs.get("/:jobId/hours", requireAuth, requireOrg, async (req, res) => {
  const { jobId } = req.params;
  const orgId = (req as any).orgId;
  
  try {
    const r: any = await (req as any).db.execute(sql`
      SELECT id, hours, description, created_at
      FROM job_hours
      WHERE job_id = ${jobId}::uuid AND org_id = ${orgId}::uuid
      ORDER BY created_at DESC
    `);
    res.json(r.rows);
  } catch (e: any) {
    console.error("GET /api/jobs/:jobId/hours error:", e);
    res.status(500).json({ error: e?.message || "Failed to fetch hours" });
  }
});

/* GET PARTS FOR JOB */
jobs.get("/:jobId/parts", requireAuth, requireOrg, async (req, res) => {
  const { jobId } = req.params;
  const orgId = (req as any).orgId;
  
  try {
    const r: any = await (req as any).db.execute(sql`
      SELECT id, part_name, quantity, created_at
      FROM job_parts
      WHERE job_id = ${jobId}::uuid AND org_id = ${orgId}::uuid
      ORDER BY created_at DESC
    `);
    res.json(r.rows);
  } catch (e: any) {
    console.error("GET /api/jobs/:jobId/parts error:", e);
    res.status(500).json({ error: e?.message || "Failed to fetch parts" });
  }
});

/* GET CHARGES FOR COMPLETED JOB */
jobs.get("/completed/:completedJobId/charges", requireAuth, requireOrg, async (req, res) => {
  const { completedJobId } = req.params;
  const orgId = (req as any).orgId;
  
  try {
    const r: any = await (req as any).db.execute(sql`
      SELECT id, kind, description, quantity, unit_price, total, created_at
      FROM completed_job_charges
      WHERE completed_job_id = ${completedJobId}::uuid AND org_id = ${orgId}::uuid
      ORDER BY created_at DESC
    `);
    res.json(r.rows);
  } catch (e: any) {
    console.error("GET /api/jobs/completed/:completedJobId/charges error:", e);
    res.status(500).json({ error: e?.message || "Failed to fetch completed job charges" });
  }
});

/* GET HOURS FOR COMPLETED JOB */
jobs.get("/completed/:completedJobId/hours", requireAuth, requireOrg, async (req, res) => {
  const { completedJobId } = req.params;
  const orgId = (req as any).orgId;
  
  try {
    const r: any = await (req as any).db.execute(sql`
      SELECT id, hours, description, created_at
      FROM completed_job_hours
      WHERE completed_job_id = ${completedJobId}::uuid AND org_id = ${orgId}::uuid
      ORDER BY created_at DESC
    `);
    res.json(r.rows);
  } catch (e: any) {
    console.error("GET /api/jobs/completed/:completedJobId/hours error:", e);
    res.status(500).json({ error: e?.message || "Failed to fetch completed job hours" });
  }
});

/* GET PARTS FOR COMPLETED JOB */
jobs.get("/completed/:completedJobId/parts", requireAuth, requireOrg, async (req, res) => {
  const { completedJobId } = req.params;
  const orgId = (req as any).orgId;
  
  try {
    const r: any = await (req as any).db.execute(sql`
      SELECT id, part_name, quantity, created_at
      FROM completed_job_parts
      WHERE completed_job_id = ${completedJobId}::uuid AND org_id = ${orgId}::uuid
      ORDER BY created_at DESC
    `);
    res.json(r.rows);
  } catch (e: any) {
    console.error("GET /api/jobs/completed/:completedJobId/parts error:", e);
    res.status(500).json({ error: e?.message || "Failed to fetch completed job parts" });
  }
});

/* CONVERT COMPLETED JOB TO INVOICE */
jobs.post("/completed/:completedJobId/convert-to-invoice", requireAuth, requireOrg, async (req, res) => {
  const { completedJobId } = req.params;
  const orgId = (req as any).orgId;
  
  if (!isUuid(completedJobId)) return res.status(400).json({ error: "Invalid completedJobId" });

  try {
    // Get the completed job details
    const completedJobResult: any = await (req as any).db.execute(sql`
      SELECT * FROM completed_jobs
      WHERE id = ${completedJobId}::uuid AND org_id = ${orgId}::uuid
    `);

    if (completedJobResult.rows.length === 0) {
      return res.status(404).json({ error: "Completed job not found" });
    }

    const completedJob = completedJobResult.rows[0];

    // Check if customer exists
    if (!completedJob.customer_id) {
      return res.status(400).json({ error: "Cannot create invoice: job has no customer" });
    }

    // Create invoice from completed job
    const invoiceResult: any = await (req as any).db.execute(sql`
      INSERT INTO invoices (org_id, customer_id, title, notes, status, sub_total, tax_total, grand_total)
      VALUES (
        ${orgId}::uuid, 
        ${completedJob.customer_id}::uuid, 
        ${`Invoice for: ${completedJob.title}`},
        ${completedJob.notes || ''},
        'draft',
        0,
        0,
        0
      )
      RETURNING id
    `);

    const invoiceId = invoiceResult.rows[0].id;

    // Add a default line item for the completed work
    await (req as any).db.execute(sql`
      INSERT INTO invoice_lines (org_id, invoice_id, position, description, quantity, unit_amount, tax_rate)
      VALUES (
        ${orgId}::uuid,
        ${invoiceId}::uuid,
        0,
        ${completedJob.description || `Work completed: ${completedJob.title}`},
        1,
        0,
        0.10
      )
    `);

    res.json({ 
      ok: true, 
      invoiceId: invoiceId,
      message: "Invoice created successfully. Please edit the invoice to add pricing details."
    });

  } catch (e: any) {
    console.error("POST /api/jobs/completed/:completedJobId/convert-to-invoice error:", e);
    res.status(500).json({ error: e?.message || "Failed to convert to invoice" });
  }
});

/* DELETE */
jobs.delete("/:jobId", requireAuth, requireOrg, async (req, res) => {
  const { jobId } = req.params;
  const orgId = (req as any).orgId;
  if (!isUuid(jobId)) return res.status(400).json({ error: "Invalid jobId" });

  await (req as any).db.execute(sql`
    delete from jobs
    where id=${jobId}::uuid and org_id=${orgId}::uuid
  `);

  res.json({ ok: true });
});



export default jobs;