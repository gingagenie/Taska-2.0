// server/index.ts
import express3 from "express";

// server/routes.ts
import { createServer } from "http";
import express from "express";
import cors from "cors";

// server/routes/health.ts
import { Router } from "express";
var health = Router();
health.get("/whoami", (req, res) => {
  res.json({
    env: process.env.NODE_ENV,
    sessionUserId: req.session?.userId || null,
    sessionOrgId: req.session?.orgId || null,
    headerUserId: req.headers["x-user-id"] || null,
    headerOrgId: req.headers["x-org-id"] || null,
    effectiveOrgId: req.orgId || null
    // after requireOrg
  });
});

// server/routes/customers.ts
import { Router as Router2 } from "express";

// server/db/client.ts
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL not set");
var pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
var db = drizzle(pool);

// server/routes/customers.ts
import { sql as sql2 } from "drizzle-orm";

// server/middleware/auth.ts
function header(req, name) {
  return req.headers[name.toLowerCase()] || void 0;
}
function requireAuth(req, res, next) {
  const hUser = header(req, "x-user-id") || header(req, "x-userid") || header(req, "x-user") || req.query.userId;
  if (hUser) {
    req.user = { id: hUser };
    return next();
  }
  const userId = req.session.userId;
  if (!userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  req.user = { id: userId };
  next();
}

// server/middleware/tenancy.ts
import { sql } from "drizzle-orm";
async function requireOrg(req, res, next) {
  const isProd2 = process.env.NODE_ENV === "production";
  const sessOrg = req.session?.orgId;
  const headerOrg = req.headers["x-org-id"] || void 0;
  let chosen = isProd2 ? sessOrg : sessOrg || headerOrg;
  if (!chosen && req.session?.userId) {
    const r = await db.execute(sql`
      select org_id from users where id=${req.session.userId}::uuid
    `);
    chosen = r.rows?.[0]?.org_id;
  }
  if (!chosen) {
    console.log(`[AUTH] 401 - No org found: userId=${req.session?.userId}, sessOrg=${sessOrg}, headerOrg=${headerOrg}`);
    return res.status(401).json({ error: "Not authenticated" });
  }
  if (sessOrg && headerOrg && sessOrg !== headerOrg) {
    console.log(`[AUTH] 400 - Org mismatch: session=${sessOrg}, header=${headerOrg}`);
    return res.status(400).json({ error: "Org mismatch between session and header" });
  }
  req.orgId = chosen;
  next();
}

// server/routes/customers.ts
var customers = Router2();
var isUuid = (v) => !!v && /^[0-9a-f-]{36}$/i.test(v);
customers.get("/", requireAuth, requireOrg, async (req, res) => {
  const orgId = req.orgId;
  console.log("[TRACE] GET /api/customers org=%s", orgId);
  try {
    const r = await db.execute(sql2`
      select id, name, contact_name, email, phone, street, suburb, state, postcode
      from customers
      where org_id=${orgId}::uuid
      order by name asc
    `);
    res.json(r.rows);
  } catch (error) {
    console.error("GET /api/customers error:", error);
    res.status(500).json({ error: error?.message || "Failed to fetch customers" });
  }
});
customers.get("/:id", requireAuth, requireOrg, async (req, res) => {
  const { id } = req.params;
  const orgId = req.orgId;
  console.log("[TRACE] GET /api/customers/%s org=%s", id, orgId);
  if (!isUuid(id)) return res.status(400).json({ error: "invalid id" });
  try {
    const r = await db.execute(sql2`
      select id, name, contact_name, email, phone, street, suburb, state, postcode
      from customers
      where id=${id}::uuid and org_id=${orgId}::uuid
    `);
    const row = r.rows?.[0];
    if (!row) return res.status(404).json({ error: "not found" });
    res.json(row);
  } catch (error) {
    console.error("GET /api/customers/:id error:", error);
    res.status(500).json({ error: error?.message || "Failed to fetch customer" });
  }
});
customers.post("/", requireAuth, requireOrg, async (req, res) => {
  const orgId = req.orgId;
  console.log("[TRACE] POST /api/customers org=%s", orgId);
  const ok = await db.execute(sql2`select 1 from orgs where id=${orgId}::uuid`);
  if (!ok.rows?.length) {
    console.log(`[AUTH] 400 - Invalid org at insert: orgId=${orgId}`);
    return res.status(400).json({ error: "Invalid org" });
  }
  const { name, contact_name, email, phone, street, suburb, state, postcode, notes } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ error: "name required" });
  try {
    const ins = await db.execute(sql2`
      insert into customers (
        org_id, name, contact_name, email, phone, street, suburb, state, postcode, notes
      ) values (
        ${orgId}::uuid, ${name}, ${contact_name || null}, ${email || null}, ${phone || null},
        ${street || null}, ${suburb || null}, ${state || null}, ${postcode || null}, ${notes || null}
      )
      returning id
    `);
    const row = await db.execute(sql2`
      select id, name, contact_name, email, phone, street, suburb, state, postcode, notes, created_at
      from customers where id=${ins.rows[0].id}::uuid
    `);
    res.json({ ok: true, customer: row.rows[0] });
  } catch (error) {
    console.error("POST /api/customers error:", error);
    res.status(500).json({ error: error?.message || "Failed to create customer" });
  }
});
customers.put("/:id", requireAuth, requireOrg, async (req, res) => {
  const orgId = req.orgId;
  const { id } = req.params;
  console.log("[TRACE] PUT /api/customers/%s org=%s", id, orgId);
  if (!isUuid(id)) return res.status(400).json({ error: "invalid id" });
  const { name, contact_name, email, phone, street, suburb, state, postcode } = req.body || {};
  try {
    await db.execute(sql2`
      update customers set
        name         = coalesce(${name}, name),
        contact_name = coalesce(${contact_name}, contact_name),
        email        = coalesce(${email}, email),
        phone        = coalesce(${phone}, phone),
        street       = coalesce(${street}, street),
        suburb       = coalesce(${suburb}, suburb),
        state        = coalesce(${state}, state),
        postcode     = coalesce(${postcode}, postcode)
      where id=${id}::uuid and org_id=${orgId}::uuid
    `);
    res.json({ ok: true });
  } catch (error) {
    console.error("PUT /api/customers/:id error:", error);
    res.status(500).json({ error: error?.message || "Failed to update customer" });
  }
});
customers.delete("/:id", requireAuth, requireOrg, async (req, res) => {
  const { id } = req.params;
  const orgId = req.orgId;
  console.log("[TRACE] DELETE /api/customers/%s org=%s", id, orgId);
  if (!isUuid(id)) return res.status(400).json({ error: "invalid id" });
  try {
    const jobCheck = await db.execute(sql2`
      select count(*) as job_count 
      from jobs 
      where customer_id=${id}::uuid and org_id=${orgId}::uuid
    `);
    const jobCount = parseInt(String(jobCheck.rows[0]?.job_count || "0"));
    if (jobCount > 0) {
      return res.status(400).json({
        error: `Cannot delete customer. They have ${jobCount} associated job${jobCount > 1 ? "s" : ""}.`
      });
    }
    await db.execute(sql2`
      delete from customers
      where id=${id}::uuid and org_id=${orgId}::uuid
    `);
    res.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/customers/:id error:", error);
    res.status(500).json({ error: error?.message || "Failed to delete customer" });
  }
});

// server/routes/equipment.ts
import { Router as Router3 } from "express";

// server/db.ts
import { drizzle as drizzle2 } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL not set");
}
var client = neon(process.env.DATABASE_URL);
var db2 = drizzle2(client);

// server/routes/equipment.ts
import { sql as sql3 } from "drizzle-orm";
var equipment = Router3();
var isUuid2 = (v) => !!v && /^[0-9a-f-]{36}$/i.test(v);
equipment.get("/", requireAuth, requireOrg, async (req, res) => {
  const orgId = req.orgId;
  const r = await db2.execute(sql3`
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
equipment.get("/:id", requireAuth, requireOrg, async (req, res) => {
  const { id } = req.params;
  const orgId = req.orgId;
  if (!isUuid2(id)) return res.status(400).json({ error: "invalid id" });
  const r = await db2.execute(sql3`
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
equipment.post("/", requireAuth, requireOrg, async (req, res) => {
  const orgId = req.orgId;
  const ok = await db2.execute(sql3`select 1 from orgs where id=${orgId}::uuid`);
  if (!ok.rows?.length) {
    console.log(`[AUTH] 400 - Invalid org at equipment insert: orgId=${orgId}`);
    return res.status(400).json({ error: "Invalid org" });
  }
  let { name, make, model, serial, notes, customerId } = req.body || {};
  if (customerId === "") customerId = null;
  try {
    const r = await db2.execute(sql3`
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
  } catch (error) {
    console.error("Equipment creation error:", error);
    res.status(500).json({ error: error?.message || "Failed to create equipment" });
  }
});
equipment.put("/:id", requireAuth, requireOrg, async (req, res) => {
  const { id } = req.params;
  const orgId = req.orgId;
  if (!isUuid2(id)) return res.status(400).json({ error: "invalid id" });
  let { name, make, model, serial, notes, customerId } = req.body || {};
  if (customerId === "") customerId = null;
  await db2.execute(sql3`
    update equipment set
      name         = coalesce(${name}, name),
      make         = coalesce(${make}, make),
      model        = coalesce(${model}, model),
      serial_number = coalesce(${serial}, serial_number),
      notes        = coalesce(${notes}, notes),
      customer_id  = ${customerId ? sql3`${customerId}::uuid` : null}
    where id=${id}::uuid and org_id=${orgId}::uuid
  `);
  res.json({ ok: true });
});
equipment.delete("/:id", requireAuth, requireOrg, async (req, res) => {
  const { id } = req.params;
  const orgId = req.orgId;
  if (!isUuid2(id)) return res.status(400).json({ error: "invalid id" });
  const ref = await db2.execute(sql3`
    select count(*)::int as cnt
    from job_equipment
    where equipment_id=${id}::uuid
  `);
  if ((ref.rows?.[0]?.cnt ?? 0) > 0) {
    return res.status(409).json({ error: "Cannot delete: equipment is linked to one or more jobs." });
  }
  await db2.execute(sql3`
    delete from equipment
    where id=${id}::uuid and org_id=${orgId}::uuid
  `);
  res.json({ ok: true });
});
var equipment_default = equipment;

// server/routes/teams.ts
import { Router as Router4 } from "express";
import { sql as sql4 } from "drizzle-orm";
var teams = Router4();
teams.get("/", requireAuth, requireOrg, async (req, res) => {
  const orgId = req.orgId;
  const r = await db.execute(sql4`select id,name from teams where org_id=${orgId}::uuid order by created_at asc`);
  res.json(r.rows);
});
teams.post("/add-member", requireAuth, requireOrg, async (req, res) => {
  const orgId = req.orgId;
  const { email, name, teamId } = req.body || {};
  if (!email || !name) return res.status(400).json({ error: "email and name required" });
  await db.execute(sql4`insert into users (email,name) values (${email},${name}) on conflict (email) do nothing;`);
  await db.execute(sql4`insert into memberships (user_id,org_id,role) select id,${orgId}::uuid,'member' from users where email=${email} on conflict do nothing;`);
  if (teamId) await db.execute(sql4`insert into team_members (team_id,user_id) select ${teamId}::uuid,id from users where email=${email} on conflict do nothing;`);
  res.json({ ok: true });
});

// server/routes/jobs.ts
import { Router as Router5 } from "express";

// shared/schema.ts
import { sql as sql5 } from "drizzle-orm";
import { pgTable, varchar, text, timestamp, decimal, boolean, jsonb, uuid, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
var organizations = pgTable("orgs", {
  id: uuid("id").primaryKey().default(sql5`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow()
});
var organisations = pgTable("organisations", {
  id: uuid("id").primaryKey().default(sql5`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow()
});
var users = pgTable("users", {
  id: uuid("id").primaryKey().default(sql5`gen_random_uuid()`),
  orgId: uuid("org_id").references(() => organizations.id),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  role: varchar("role", { length: 100 }),
  phone: varchar("phone", { length: 50 }),
  avatarUrl: varchar("avatar_url", { length: 500 }),
  createdAt: timestamp("created_at").defaultNow()
});
var memberships = pgTable("memberships", {
  id: uuid("id").primaryKey().default(sql5`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id),
  orgId: uuid("org_id").references(() => organizations.id),
  role: varchar("role", { length: 50 }).default("member"),
  createdAt: timestamp("created_at").defaultNow()
});
var teams2 = pgTable("teams", {
  id: uuid("id").primaryKey().default(sql5`gen_random_uuid()`),
  orgId: uuid("org_id").references(() => organizations.id).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow()
});
var teamMembers = pgTable("team_members", {
  id: uuid("id").primaryKey().default(sql5`gen_random_uuid()`),
  teamId: uuid("team_id").references(() => teams2.id),
  userId: uuid("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow()
});
var customers2 = pgTable("customers", {
  id: uuid("id").primaryKey().default(sql5`gen_random_uuid()`),
  orgId: uuid("org_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  contactName: text("contact_name"),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  address: text("address"),
  // Keep for backward compatibility
  street: text("street"),
  suburb: text("suburb"),
  state: text("state"),
  postcode: text("postcode"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow()
});
var equipment2 = pgTable("equipment", {
  id: uuid("id").primaryKey().default(sql5`gen_random_uuid()`),
  orgId: uuid("org_id").notNull(),
  // FK reference removed - nuclear option like customers
  customerId: uuid("customer_id").references(() => customers2.id),
  name: varchar("name", { length: 255 }).notNull(),
  make: varchar("make", { length: 255 }),
  model: varchar("model", { length: 255 }),
  serial: varchar("serial", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow()
});
var jobs = pgTable("jobs", {
  id: uuid("id").primaryKey().default(sql5`gen_random_uuid()`),
  orgId: uuid("org_id").notNull(),
  // FK reference removed - nuclear option
  customerId: uuid("customer_id").references(() => customers2.id),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  status: varchar("status", { length: 50 }).default("new"),
  scheduledAt: timestamp("scheduled_at"),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});
var jobAssignments = pgTable("job_assignments", {
  jobId: uuid("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  assignedAt: timestamp("assigned_at", { withTimezone: true }).defaultNow()
}, (t) => ({
  pk: primaryKey({ columns: [t.jobId, t.userId] })
}));
var jobEquipment = pgTable("job_equipment", {
  id: uuid("id").primaryKey().default(sql5`gen_random_uuid()`),
  jobId: uuid("job_id").references(() => jobs.id).notNull(),
  equipmentId: uuid("equipment_id").references(() => equipment2.id).notNull(),
  createdAt: timestamp("created_at").defaultNow()
});
var jobPhotos = pgTable("job_photos", {
  id: uuid("id").primaryKey().default(sql5`gen_random_uuid()`),
  jobId: uuid("job_id").references(() => jobs.id, { onDelete: "cascade" }).notNull(),
  orgId: uuid("org_id").references(() => organizations.id).notNull(),
  url: text("url").notNull(),
  createdAt: timestamp("created_at").defaultNow()
});
var entitlements = pgTable("entitlements", {
  id: uuid("id").primaryKey().default(sql5`gen_random_uuid()`),
  orgId: uuid("org_id").references(() => organizations.id).notNull().unique(),
  plan: varchar("plan", { length: 50 }).default("free"),
  active: boolean("active").default(false),
  updatedAt: timestamp("updated_at").defaultNow()
});
var quotes = pgTable("quotes", {
  id: uuid("id").primaryKey().default(sql5`gen_random_uuid()`),
  orgId: uuid("org_id").references(() => organizations.id).notNull(),
  customerId: uuid("customer_id").references(() => customers2.id),
  title: varchar("title", { length: 255 }).notNull(),
  notes: text("notes"),
  items: jsonb("items").default([]),
  currency: varchar("currency", { length: 3 }).default("USD"),
  total: decimal("total", { precision: 10, scale: 2 }).default("0"),
  status: varchar("status", { length: 50 }).default("draft"),
  createdAt: timestamp("created_at").defaultNow()
});
var invoices = pgTable("invoices", {
  id: uuid("id").primaryKey().default(sql5`gen_random_uuid()`),
  orgId: uuid("org_id").references(() => organizations.id).notNull(),
  jobId: uuid("job_id").references(() => jobs.id),
  customerId: uuid("customer_id").references(() => customers2.id),
  items: jsonb("items").default([]),
  currency: varchar("currency", { length: 3 }).default("USD"),
  total: decimal("total", { precision: 10, scale: 2 }).default("0"),
  status: varchar("status", { length: 50 }).default("draft"),
  issuedAt: timestamp("issued_at"),
  dueAt: timestamp("due_at"),
  createdAt: timestamp("created_at").defaultNow()
});
var insertCustomerSchema = createInsertSchema(customers2).omit({ id: true, createdAt: true });
var insertJobSchema = createInsertSchema(jobs).omit({ id: true, createdAt: true, updatedAt: true });
var insertJobPhotoSchema = createInsertSchema(jobPhotos).omit({ id: true, createdAt: true });
var insertEquipmentSchema = createInsertSchema(equipment2).omit({ id: true, createdAt: true });
var insertQuoteSchema = createInsertSchema(quotes).omit({ id: true, createdAt: true });
var insertInvoiceSchema = createInsertSchema(invoices).omit({ id: true, createdAt: true });

// server/routes/jobs.ts
import multer from "multer";
import path from "path";
import fs from "fs";
import { sql as sql6, eq } from "drizzle-orm";
var jobs2 = Router5();
function isUuid3(str) {
  return /^[0-9a-f-]{36}$/i.test(str);
}
function normalizeScheduledAt(raw) {
  if (!raw) return null;
  if (typeof raw === "string" && /Z$/.test(raw)) return raw;
  if (typeof raw === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(raw)) {
    const d = new Date(raw);
    if (!isNaN(d.valueOf())) return d.toISOString();
  }
  return raw;
}
var upload = multer({ dest: "uploads/" });
jobs2.get("/ping", (_req, res) => {
  console.log("[TRACE] GET /api/jobs/ping");
  res.json({ ok: true });
});
jobs2.get("/equipment", requireAuth, requireOrg, async (req, res) => {
  const orgId = req.orgId;
  const customerId = req.query.customerId || void 0;
  const r = await db2.execute(sql6`
    select id, name
    from equipment
    where org_id=${orgId}::uuid
      ${customerId ? sql6`and customer_id=${customerId}::uuid` : sql6``}
    order by name asc
  `);
  res.json(r.rows);
});
jobs2.get("/", requireAuth, requireOrg, async (req, res) => {
  const orgId = req.orgId;
  console.log("[TRACE] GET /api/jobs org=%s", orgId);
  try {
    const r = await db2.execute(sql6`
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
  } catch (error) {
    console.error("GET /api/jobs error:", error);
    res.status(500).json({ error: error?.message || "Failed to fetch jobs" });
  }
});
jobs2.get("/technicians", requireAuth, requireOrg, async (req, res) => {
  const orgId = req.orgId;
  const mockTechnicians = [
    { id: "tech-001", name: "John Smith", email: "john@example.com" },
    { id: "tech-002", name: "Sarah Johnson", email: "sarah@example.com" },
    { id: "tech-003", name: "Mike Wilson", email: "mike@example.com" },
    { id: "tech-004", name: "Lisa Chen", email: "lisa@example.com" }
  ];
  res.json(mockTechnicians);
});
jobs2.get("/range", requireAuth, requireOrg, async (req, res) => {
  const orgId = req.orgId;
  const { start, end, techId } = req.query;
  if (!start || !end) return res.status(400).json({ error: "start and end are required (ISO strings)" });
  try {
    if (techId && techId !== "" && techId !== "none") {
      res.json([]);
      return;
    }
    const r = await db2.execute(sql6`
      select j.id, j.title, j.status, 
             to_char(j.scheduled_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as scheduled_at,
             j.customer_id, coalesce(c.name,'—') as customer_name
      from jobs j
      left join customers c on c.id = j.customer_id
      where j.org_id=${orgId}::uuid
        and j.scheduled_at is not null
        and j.scheduled_at >= ${start}::timestamptz
        and j.scheduled_at <  ${end}::timestamptz
      order by j.scheduled_at asc
    `);
    res.json(r.rows);
  } catch (error) {
    console.error("GET /api/jobs/range error:", error);
    res.status(500).json({ error: error?.message || "Failed to fetch jobs" });
  }
});
jobs2.get("/customers", requireAuth, requireOrg, async (req, res) => {
  try {
    const orgId = req.orgId;
    console.log("[TRACE] GET /api/jobs/customers org=%s", orgId);
    const result = await db2.select({
      id: customers2.id,
      name: customers2.name
    }).from(customers2).where(eq(customers2.orgId, orgId));
    res.json(result);
  } catch (error) {
    console.error("GET /api/jobs/customers error:", error);
    res.status(500).json({ error: error?.message || "Failed to fetch customers" });
  }
});
jobs2.get("/equipment", requireAuth, requireOrg, async (req, res) => {
  try {
    const orgId = req.orgId;
    console.log("[TRACE] GET /api/jobs/equipment org=%s", orgId);
    const result = await db2.select({
      id: equipment2.id,
      name: equipment2.name
    }).from(equipment2).where(eq(equipment2.orgId, orgId));
    res.json(result);
  } catch (error) {
    console.error("GET /api/jobs/equipment error:", error);
    res.status(500).json({ error: error?.message || "Failed to fetch equipment" });
  }
});
jobs2.get("/:jobId", requireAuth, requireOrg, async (req, res) => {
  try {
    const { jobId } = req.params;
    const orgId = req.orgId;
    console.log("[TRACE] GET /api/jobs/%s org=%s", jobId, orgId);
    if (!/^[0-9a-f-]{36}$/i.test(jobId)) {
      return res.status(400).json({ error: "Invalid jobId" });
    }
    const jr = await db2.execute(sql6`
      select
        j.id, j.title, j.description, j.status, 
        to_char(j.scheduled_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as scheduled_at,
        j.customer_id,
        coalesce(c.name,'—') as customer_name,
        c.address as customer_address
      from jobs j
      left join customers c on c.id = j.customer_id
      where j.id=${jobId}::uuid and j.org_id=${orgId}::uuid
    `);
    const result = jr.rows;
    if (!result.length) {
      return res.status(404).json({ error: "Job not found" });
    }
    res.json(result[0]);
  } catch (error) {
    console.error("GET /api/jobs/:id error:", error);
    res.status(500).json({ error: error?.message || "Failed to fetch job" });
  }
});
jobs2.post("/create", requireAuth, requireOrg, async (req, res) => {
  const orgId = req.orgId;
  const userId = req.user?.id || null;
  let { title, description, customerId, scheduledAt, equipmentId, assignedTechIds } = req.body || {};
  if (!title) return res.status(400).json({ error: "title required" });
  if (customerId === "") customerId = null;
  if (equipmentId === "") equipmentId = null;
  const scheduled = normalizeScheduledAt(scheduledAt);
  try {
    console.log("[DEBUG] Creating job with values:", {
      orgId,
      customerId: customerId || null,
      title,
      description: description || null,
      scheduledAt,
      status: "new",
      createdBy: userId || null
    });
    const result = await db2.execute(sql6`
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
    const jobId = result.rows[0].id;
    if (equipmentId) {
      await db2.execute(sql6`
        insert into job_equipment (job_id, equipment_id)
        values (${jobId}::uuid, ${equipmentId}::uuid)
        on conflict do nothing
      `);
    }
    if (Array.isArray(assignedTechIds) && assignedTechIds.length > 0) {
      for (const uid of assignedTechIds) {
        if (!uid) continue;
        await db2.execute(sql6`
          insert into job_assignments (job_id, user_id)
          values (${jobId}::uuid, ${uid}::uuid)
          on conflict do nothing
        `);
      }
    }
    res.json({ ok: true, id: jobId });
  } catch (e) {
    console.error("POST /api/jobs/create error:", e);
    res.status(500).json({ error: e?.message || "create failed" });
  }
});
jobs2.patch("/:jobId/schedule", requireAuth, requireOrg, async (req, res) => {
  const { jobId } = req.params;
  const orgId = req.orgId;
  const { scheduledAt } = req.body || {};
  if (!jobId || !/^[0-9a-f-]{36}$/i.test(jobId)) return res.status(400).json({ error: "invalid jobId" });
  if (!scheduledAt) return res.status(400).json({ error: "scheduledAt required (ISO)" });
  await db2.execute(sql6`
    update jobs set scheduled_at = ${scheduledAt}::timestamptz
    where id=${jobId}::uuid and org_id=${orgId}::uuid
  `);
  res.json({ ok: true });
});
jobs2.put("/:jobId", requireAuth, requireOrg, async (req, res) => {
  const { jobId } = req.params;
  const orgId = req.orgId;
  if (!/^[0-9a-f-]{36}$/i.test(jobId)) {
    return res.status(400).json({ error: "Invalid jobId" });
  }
  let { title, description, status, scheduledAt, customerId } = req.body || {};
  if (customerId === "") customerId = null;
  const scheduled = normalizeScheduledAt(scheduledAt);
  console.log("PUT /api/jobs/%s org=%s body=%o", jobId, orgId, {
    title,
    description,
    status,
    scheduledAt: scheduled,
    customerId
  });
  try {
    const result = await db2.execute(sql6`
      UPDATE jobs SET 
        title = coalesce(${title}, title),
        description = coalesce(${description}, description),
        status = coalesce(${status}, status),
        scheduled_at = coalesce(${scheduled}, scheduled_at),
        customer_id = ${customerId}
      WHERE id = ${jobId}::uuid AND org_id = ${orgId}::uuid
      RETURNING id
    `);
    if (!result.rows.length) {
      console.warn("PUT /api/jobs/%s -> no match for org=%s", jobId, orgId);
      return res.status(404).json({ error: "Job not found" });
    }
    console.log("PUT /api/jobs/%s -> ok", jobId);
    res.json({ ok: true });
  } catch (error) {
    console.error("PUT /api/jobs/%s error:", jobId, error);
    res.status(500).json({ error: error?.message || "Update failed" });
  }
});
jobs2.get("/:jobId/photos", requireAuth, requireOrg, async (req, res) => {
  try {
    const { jobId } = req.params;
    const orgId = req.orgId;
    console.log("[TRACE] GET /api/jobs/%s/photos org=%s", jobId, orgId);
    const result = await db2.execute(sql6`
      SELECT id, url, created_at
      FROM job_photos
      WHERE job_id = ${jobId}::uuid AND org_id = ${orgId}::uuid
      ORDER BY created_at DESC
    `);
    res.json(result.rows || []);
  } catch (error) {
    console.error("GET /api/jobs/%s/photos error:", req.params.jobId, error);
    res.status(500).json({ error: error?.message || "Failed to fetch photos" });
  }
});
jobs2.post("/:jobId/photos", requireAuth, requireOrg, upload.single("photo"), async (req, res) => {
  try {
    const { jobId } = req.params;
    const orgId = req.orgId;
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: "No file provided" });
    }
    const filename = `${Date.now()}-${file.originalname}`;
    const destPath = path.join("uploads", filename);
    fs.renameSync(file.path, destPath);
    const url = `/uploads/${filename}`;
    console.log("[TRACE] POST /api/jobs/%s/photos org=%s file=%s", jobId, orgId, filename);
    const result = await db2.execute(sql6`
      INSERT INTO job_photos (job_id, org_id, url)
      VALUES (${jobId}::uuid, ${orgId}::uuid, ${url})
      RETURNING id, url, created_at
    `);
    const photo = result.rows[0];
    res.json(photo);
  } catch (error) {
    console.error("POST /api/jobs/%s/photos error:", req.params.jobId, error);
    res.status(500).json({ error: error?.message || "Failed to upload photo" });
  }
});
jobs2.delete("/:jobId/photos/:photoId", requireAuth, requireOrg, async (req, res) => {
  try {
    const { jobId, photoId } = req.params;
    const orgId = req.orgId;
    console.log("[TRACE] DELETE /api/jobs/%s/photos/%s org=%s", jobId, photoId, orgId);
    const photoResult = await db2.execute(sql6`
      SELECT url FROM job_photos 
      WHERE id = ${photoId}::uuid AND job_id = ${jobId}::uuid AND org_id = ${orgId}::uuid
    `);
    const photos = photoResult.rows || [];
    if (photos.length > 0) {
      const photoUrl = photos[0].url;
      const filePath = path.join(".", photoUrl);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    await db2.execute(sql6`
      DELETE FROM job_photos 
      WHERE id = ${photoId}::uuid AND job_id = ${jobId}::uuid AND org_id = ${orgId}::uuid
    `);
    res.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/jobs/%s/photos/%s error:", req.params.jobId, req.params.photoId, error);
    res.status(500).json({ error: error?.message || "Failed to delete photo" });
  }
});
jobs2.get("/:jobId/notes", requireAuth, requireOrg, async (req, res) => {
  const { jobId } = req.params;
  const orgId = req.orgId;
  try {
    const r = await db2.execute(sql6`
      select id, text, created_at
      from job_notes
      where job_id=${jobId}::uuid and org_id=${orgId}::uuid
      order by created_at desc
    `);
    res.json(r.rows);
  } catch (e) {
    console.error("GET /api/jobs/:jobId/notes error:", e);
    res.status(500).json({ error: e?.message || "Failed to fetch notes" });
  }
});
jobs2.post("/:jobId/notes", requireAuth, requireOrg, async (req, res) => {
  const { jobId } = req.params;
  const orgId = req.orgId;
  const { text: text2 } = req.body || {};
  if (!text2?.trim()) return res.status(400).json({ error: "text required" });
  try {
    const r = await db2.execute(sql6`
      insert into job_notes (job_id, org_id, text)
      values (${jobId}::uuid, ${orgId}::uuid, ${text2})
      returning id, text, created_at
    `);
    res.json(r.rows[0]);
  } catch (e) {
    console.error("POST /api/jobs/:jobId/notes error:", e);
    res.status(500).json({ error: e?.message || "Failed to add note" });
  }
});
jobs2.get("/:jobId/charges", requireAuth, requireOrg, async (req, res) => {
  const { jobId } = req.params;
  const orgId = req.orgId;
  try {
    const r = await db2.execute(sql6`
      select id, kind, description, quantity, unit_price, total, created_at
      from job_charges
      where job_id=${jobId}::uuid and org_id=${orgId}::uuid
      order by created_at desc
    `);
    res.json(r.rows);
  } catch (e) {
    console.error("GET /api/jobs/:jobId/charges error:", e);
    res.status(500).json({ error: e?.message || "Failed to fetch charges" });
  }
});
jobs2.post("/:jobId/charges", requireAuth, requireOrg, async (req, res) => {
  const { jobId } = req.params;
  const orgId = req.orgId;
  let { kind, description, quantity, unitPrice } = req.body || {};
  if (!description?.trim()) return res.status(400).json({ error: "description required" });
  kind = kind || "labour";
  quantity = Number(quantity) || 0;
  unitPrice = Number(unitPrice) || 0;
  const total = quantity * unitPrice;
  try {
    const r = await db2.execute(sql6`
      insert into job_charges (job_id, org_id, kind, description, quantity, unit_price, total)
      values (${jobId}::uuid, ${orgId}::uuid, ${kind}, ${description}, ${quantity}, ${unitPrice}, ${total})
      returning id, kind, description, quantity, unit_price, total, created_at
    `);
    res.json(r.rows[0]);
  } catch (e) {
    console.error("POST /api/jobs/:jobId/charges error:", e);
    res.status(500).json({ error: e?.message || "Failed to add charge" });
  }
});
jobs2.delete("/:jobId", requireAuth, requireOrg, async (req, res) => {
  const { jobId } = req.params;
  const orgId = req.orgId;
  if (!isUuid3(jobId)) return res.status(400).json({ error: "Invalid jobId" });
  await db2.execute(sql6`
    delete from jobs
    where id=${jobId}::uuid and org_id=${orgId}::uuid
  `);
  res.json({ ok: true });
});
var jobs_default = jobs2;

// server/routes/quotes.ts
import { Router as Router6 } from "express";
import { sql as sql7 } from "drizzle-orm";
var isUuid4 = (v) => !!v && /^[0-9a-f-]{36}$/i.test(v);
var router = Router6();
router.get("/", requireAuth, requireOrg, async (req, res) => {
  const orgId = req.orgId;
  const r = await db.execute(sql7`
    select q.id, q.title, q.status, q.created_at, q.customer_id, c.name as customer_name
    from quotes q
    join customers c on c.id = q.customer_id
    where q.org_id=${orgId}::uuid
    order by q.created_at desc
  `);
  res.json(r.rows);
});
router.post("/", requireAuth, requireOrg, async (req, res) => {
  const orgId = req.orgId;
  const userId = req.user?.id || null;
  const { title, customerId, jobId, notes } = req.body || {};
  if (!title || !customerId) return res.status(400).json({ error: "title & customerId required" });
  const ins = await db.execute(sql7`
    insert into quotes (org_id, customer_id, job_id, title, notes, created_by)
    values (${orgId}::uuid, ${customerId}::uuid, ${jobId || null}, ${title}, ${notes || null}, ${userId})
    returning id
  `);
  res.json({ ok: true, id: ins.rows[0].id });
});
router.get("/:id", requireAuth, requireOrg, async (req, res) => {
  const { id } = req.params;
  const orgId = req.orgId;
  if (!isUuid4(id)) return res.status(400).json({ error: "invalid id" });
  const q = await db.execute(sql7`
    select q.*, c.name as customer_name
    from quotes q join customers c on c.id=q.customer_id
    where q.id=${id}::uuid and q.org_id=${orgId}::uuid
  `);
  const quote = q.rows?.[0];
  if (!quote) return res.status(404).json({ error: "not found" });
  const items = await db.execute(sql7`
    select * from quote_items where quote_id=${id}::uuid order by created_at nulls last, id
  `);
  const subtotal = items.rows.reduce((s, it) => s + Number(it.quantity) * Number(it.unit_price), 0);
  res.json({ ...quote, items: items.rows, subtotal, total: subtotal });
});
router.put("/:id", requireAuth, requireOrg, async (req, res) => {
  const { id } = req.params;
  const orgId = req.orgId;
  if (!isUuid4(id)) return res.status(400).json({ error: "invalid id" });
  const { title, notes, status, customerId, jobId } = req.body || {};
  await db.execute(sql7`
    update quotes
      set title=coalesce(${title}, title),
          notes=coalesce(${notes}, notes),
          status=coalesce(${status}, status),
          customer_id=coalesce(${customerId}::uuid, customer_id),
          job_id=coalesce(${jobId}::uuid, job_id),
          updated_at=now()
    where id=${id}::uuid and org_id=${orgId}::uuid
  `);
  res.json({ ok: true });
});
router.post("/:id/items", requireAuth, requireOrg, async (req, res) => {
  const { id } = req.params;
  const { description, quantity, unit_price } = req.body || {};
  if (!description) return res.status(400).json({ error: "description required" });
  const ins = await db.execute(sql7`
    insert into quote_items (quote_id, description, quantity, unit_price)
    values (${id}::uuid, ${description}, ${quantity || 1}, ${unit_price || 0})
    returning id
  `);
  res.json({ ok: true, id: ins.rows[0].id });
});
router.put("/:id/items/:itemId", requireAuth, requireOrg, async (req, res) => {
  const { id, itemId } = req.params;
  const { description, quantity, unit_price } = req.body || {};
  await db.execute(sql7`
    update quote_items
      set description=coalesce(${description}, description),
          quantity=coalesce(${quantity}, quantity),
          unit_price=coalesce(${unit_price}, unit_price)
    where id=${itemId}::uuid and quote_id=${id}::uuid
  `);
  res.json({ ok: true });
});
router.delete("/:id/items/:itemId", requireAuth, requireOrg, async (req, res) => {
  const { id, itemId } = req.params;
  await db.execute(sql7`delete from quote_items where id=${itemId}::uuid and quote_id=${id}::uuid`);
  res.json({ ok: true });
});
router.post("/:id/accept", requireAuth, requireOrg, async (req, res) => {
  const { id } = req.params;
  await db.execute(sql7`update quotes set status='accepted', updated_at=now() where id=${id}::uuid`);
  res.json({ ok: true });
});
router.post("/:id/convert", requireAuth, requireOrg, async (req, res) => {
  const { id } = req.params;
  const orgId = req.orgId;
  const userId = req.user?.id || null;
  const q = await db.execute(sql7`select * from quotes where id=${id}::uuid and org_id=${orgId}::uuid`);
  const quote = q.rows?.[0];
  if (!quote) return res.status(404).json({ error: "quote not found" });
  const jr = await db.execute(sql7`
    insert into jobs (org_id, customer_id, title, description, status, created_by, scheduled_at)
    values (${orgId}::uuid, ${quote.customer_id}::uuid, ${quote.title}, ${quote.notes || null}, 'new', ${userId}, null)
    returning id
  `);
  await db.execute(sql7`update quotes set status='converted', job_id=${jr.rows[0].id}::uuid where id=${id}::uuid`);
  res.json({ ok: true, jobId: jr.rows[0].id });
});
var quotes_default = router;

// server/routes/invoices.ts
import { Router as Router7 } from "express";
import { sql as sql8 } from "drizzle-orm";
var isUuid5 = (v) => !!v && /^[0-9a-f-]{36}$/i.test(v);
var router2 = Router7();
router2.get("/", requireAuth, requireOrg, async (req, res) => {
  const orgId = req.orgId;
  const r = await db.execute(sql8`
    select i.id, i.title, i.status, i.created_at, i.customer_id, c.name as customer_name
    from invoices i join customers c on c.id = i.customer_id
    where i.org_id=${orgId}::uuid
    order by i.created_at desc
  `);
  res.json(r.rows);
});
router2.post("/", requireAuth, requireOrg, async (req, res) => {
  const orgId = req.orgId;
  const userId = req.user?.id || null;
  const { title, customerId, jobId, notes } = req.body || {};
  if (!title || !customerId) return res.status(400).json({ error: "title & customerId required" });
  const ins = await db.execute(sql8`
    insert into invoices (org_id, customer_id, job_id, title, notes, created_by)
    values (${orgId}::uuid, ${customerId}::uuid, ${jobId || null}, ${title}, ${notes || null}, ${userId})
    returning id
  `);
  res.json({ ok: true, id: ins.rows[0].id });
});
router2.get("/:id", requireAuth, requireOrg, async (req, res) => {
  const { id } = req.params;
  const orgId = req.orgId;
  if (!isUuid5(id)) return res.status(400).json({ error: "invalid id" });
  const r = await db.execute(sql8`
    select i.*, c.name as customer_name
    from invoices i join customers c on c.id=i.customer_id
    where i.id=${id}::uuid and i.org_id=${orgId}::uuid
  `);
  const inv = r.rows?.[0];
  if (!inv) return res.status(404).json({ error: "not found" });
  const items = await db.execute(sql8`
    select * from invoice_items where invoice_id=${id}::uuid order by created_at nulls last, id
  `);
  const subtotal = items.rows.reduce((s, it) => s + Number(it.quantity) * Number(it.unit_price), 0);
  res.json({ ...inv, items: items.rows, subtotal, total: subtotal });
});
router2.put("/:id", requireAuth, requireOrg, async (req, res) => {
  const { id } = req.params;
  const orgId = req.orgId;
  const { title, notes, status, customerId, jobId } = req.body || {};
  await db.execute(sql8`
    update invoices
      set title=coalesce(${title}, title),
          notes=coalesce(${notes}, notes),
          status=coalesce(${status}, status),
          customer_id=coalesce(${customerId}::uuid, customer_id),
          job_id=coalesce(${jobId}::uuid, job_id),
          updated_at=now()
    where id=${id}::uuid and org_id=${orgId}::uuid
  `);
  res.json({ ok: true });
});
router2.post("/:id/items", requireAuth, requireOrg, async (req, res) => {
  const { id } = req.params;
  const { description, quantity, unit_price } = req.body || {};
  if (!description) return res.status(400).json({ error: "description required" });
  const ins = await db.execute(sql8`
    insert into invoice_items (invoice_id, description, quantity, unit_price)
    values (${id}::uuid, ${description}, ${quantity || 1}, ${unit_price || 0})
    returning id
  `);
  res.json({ ok: true, id: ins.rows[0].id });
});
router2.put("/:id/items/:itemId", requireAuth, requireOrg, async (req, res) => {
  const { id, itemId } = req.params;
  const { description, quantity, unit_price } = req.body || {};
  await db.execute(sql8`
    update invoice_items
      set description=coalesce(${description}, description),
          quantity=coalesce(${quantity}, quantity),
          unit_price=coalesce(${unit_price}, unit_price)
    where id=${itemId}::uuid and invoice_id=${id}::uuid
  `);
  res.json({ ok: true });
});
router2.delete("/:id/items/:itemId", requireAuth, requireOrg, async (req, res) => {
  const { id, itemId } = req.params;
  await db.execute(sql8`delete from invoice_items where id=${itemId}::uuid and invoice_id=${id}::uuid`);
  res.json({ ok: true });
});
router2.post("/:id/pay", requireAuth, requireOrg, async (req, res) => {
  const { id } = req.params;
  await db.execute(sql8`update invoices set status='paid', updated_at=now() where id=${id}::uuid`);
  res.json({ ok: true });
});
var invoices_default = router2;

// server/routes/schedule.ts
import { Router as Router8 } from "express";
import { sql as sql9 } from "drizzle-orm";
var schedule = Router8();
schedule.get("/range", requireAuth, requireOrg, async (req, res) => {
  const orgId = req.orgId;
  const { start, end, techId, tz } = req.query;
  console.log("[TRACE] GET /api/schedule/range org=%s start=%s end=%s techId=%s tz=%s", orgId, start, end, techId, tz);
  if (!start || !end) {
    return res.status(400).json({ error: "start and end required (YYYY-MM-DD)" });
  }
  const BIZ_TZ = process.env.BIZ_TZ || "Australia/Melbourne";
  const zone = tz || BIZ_TZ;
  const techFilter = techId ? sql9`
    and exists (
      select 1 from job_assignments ja
      where ja.job_id = j.id and ja.user_id = ${techId}
    )
  ` : sql9``;
  try {
    const r = await db.execute(sql9`
      select
        j.id, j.title, j.description, j.status, 
        to_char(j.scheduled_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as scheduled_at,
        j.customer_id, coalesce(c.name,'—') as customer_name,
        (
          select json_agg(json_build_object('id', u.id, 'name', u.name) order by u.name)
          from job_assignments ja
          join users u on u.id = ja.user_id
          where ja.job_id = j.id
        ) as technicians
      from jobs j
      left join customers c on c.id = j.customer_id
      where j.org_id = ${orgId}::uuid
        and ((j.scheduled_at at time zone ${sql9.raw(`'${zone}'`)})::date >= ${start}::date)
        and ((j.scheduled_at at time zone ${sql9.raw(`'${zone}'`)})::date <  ${end}::date)
        ${techFilter}
      order by j.scheduled_at asc nulls last, j.created_at desc
    `);
    res.json(r.rows);
  } catch (error) {
    console.error("GET /api/schedule/range error:", error);
    res.status(500).json({ error: error?.message || "Failed to fetch schedule" });
  }
});

// server/routes/members.ts
import { Router as Router9 } from "express";
import { sql as sql10 } from "drizzle-orm";
import bcrypt from "bcryptjs";
var members = Router9();
var isUuid6 = (v) => !!v && /^[0-9a-f-]{36}$/i.test(v);
members.get("/", requireAuth, requireOrg, async (req, res) => {
  const orgId = req.orgId;
  try {
    const r = await db.execute(sql10`
      select id, name, email, role
      from users
      where org_id = ${orgId}::uuid
      order by name asc
    `);
    res.json(r.rows);
  } catch (error) {
    console.error("GET /api/members error:", error);
    res.status(500).json({ error: error?.message || "Failed to fetch members" });
  }
});
members.post("/", requireAuth, requireOrg, async (req, res) => {
  const orgId = req.orgId;
  const { name, email, role = "technician", password } = req.body || {};
  if (!email || !name) return res.status(400).json({ error: "name and email required" });
  if (!password || password.length < 6) return res.status(400).json({ error: "password must be at least 6 chars" });
  try {
    const existing = await db.execute(sql10`
      select 1 from users
      where org_id=${orgId}::uuid and lower(email)=lower(${email})
    `);
    if (existing.rows?.length) return res.status(409).json({ error: "email already exists in this org" });
    const hash = await bcrypt.hash(password, 10);
    const ins = await db.execute(sql10`
      insert into users (org_id, name, email, role, password_hash)
      values (${orgId}::uuid, ${name}, ${email}, ${role}, ${hash})
      returning id, name, email, role
    `);
    res.json({ ok: true, user: ins.rows[0] });
  } catch (error) {
    console.error("POST /api/members error:", error);
    res.status(500).json({ error: error?.message || "Failed to create member" });
  }
});
members.put("/:memberId", requireAuth, requireOrg, async (req, res) => {
  const orgId = req.orgId;
  const { memberId } = req.params;
  const { name, email, role } = req.body || {};
  if (!isUuid6(memberId)) return res.status(400).json({ error: "Invalid memberId" });
  try {
    await db.execute(sql10`
      update users
      set name  = coalesce(${name}, name),
          email = coalesce(${email}, email),
          role  = coalesce(${role}, role)
      where id=${memberId} and org_id=${orgId}::uuid
    `);
    res.json({ ok: true });
  } catch (error) {
    console.error("PUT /api/members error:", error);
    res.status(500).json({ error: error?.message || "Failed to update member" });
  }
});
members.delete("/:memberId", requireAuth, requireOrg, async (req, res) => {
  const orgId = req.orgId;
  const { memberId } = req.params;
  if (!isUuid6(memberId)) return res.status(400).json({ error: "Invalid memberId" });
  try {
    await db.execute(sql10`
      delete from users
      where id=${memberId} and org_id=${orgId}::uuid
    `);
    res.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/members error:", error);
    res.status(500).json({ error: error?.message || "Failed to delete member" });
  }
});

// server/routes.ts
async function registerRoutes(app2) {
  app2.use(cors());
  app2.use(express.json({ limit: "2mb" }));
  app2.use("/health", health);
  app2.use("/api/customers", customers);
  console.log("[mount] /api/customers");
  app2.use("/api/equipment", equipment_default);
  console.log("[mount] /api/equipment");
  app2.use("/api/teams", teams);
  app2.use("/api/jobs", jobs_default);
  console.log("[mount] /api/jobs");
  app2.use("/api/schedule", schedule);
  console.log("[mount] /api/schedule");
  app2.use("/api/members", members);
  console.log("[mount] /api/members");
  app2.use("/api/quotes", quotes_default);
  app2.use("/api/invoices", invoices_default);
  app2.get("/api", (_req, res) => res.json({ ok: true, name: "Taska 2.0 API" }));
  const httpServer = createServer(app2);
  return httpServer;
}

// server/vite.ts
import express2 from "express";
import fs2 from "fs";
import path3 from "path";
import { createServer as createViteServer, createLogger } from "vite";

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path2 from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...process.env.NODE_ENV !== "production" && process.env.REPL_ID !== void 0 ? [
      await import("@replit/vite-plugin-cartographer").then(
        (m) => m.cartographer()
      )
    ] : []
  ],
  resolve: {
    alias: {
      "@": path2.resolve(import.meta.dirname, "client", "src"),
      "@shared": path2.resolve(import.meta.dirname, "shared"),
      "@assets": path2.resolve(import.meta.dirname, "attached_assets")
    }
  },
  root: path2.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path2.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"]
    }
  }
});

// server/vite.ts
import { nanoid } from "nanoid";
var viteLogger = createLogger();
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
async function setupVite(app2, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      }
    },
    server: serverOptions,
    appType: "custom"
  });
  app2.use(vite.middlewares);
  app2.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path3.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html"
      );
      let template = await fs2.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app2) {
  const distPath = path3.resolve(import.meta.dirname, "public");
  if (!fs2.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express2.static(distPath));
  app2.use("*", (_req, res) => {
    res.sendFile(path3.resolve(distPath, "index.html"));
  });
}

// server/routes/me.ts
import { Router as Router10 } from "express";

// server/middleware/upload.ts
import multer2 from "multer";
var upload2 = multer2({
  storage: multer2.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
  // 5MB
});

// server/routes/me.ts
import { nanoid as nanoid2 } from "nanoid";
import fs3 from "node:fs/promises";
import path4 from "node:path";
var me = Router10();
me.get("/", requireAuth, requireOrg, async (req, res) => {
  try {
    const user = req.user;
    const orgId = req.orgId;
    const mockUser = {
      id: user?.id || "315e3119-1b17-4dee-807f-bbc1e4d5c5b6",
      email: "user@taska.com",
      name: "John Smith",
      role: "Administrator",
      phone: "+61 400 123 456",
      avatar_url: null,
      avatar_seed: null,
      avatar_variant: null
    };
    const mockOrg = {
      id: orgId,
      name: "Taska Field Services",
      abn: "12 345 678 901",
      street: "123 Main Street",
      suburb: "Melbourne",
      state: "VIC",
      postcode: "3000",
      default_labour_rate_cents: 12500,
      // $125.00/hr
      plan: "pro",
      plan_renews_at: "2025-12-31T00:00:00Z"
    };
    res.json({
      user: mockUser,
      org: mockOrg
    });
  } catch (error) {
    console.error("GET /api/me error:", error);
    res.status(500).json({ error: error?.message || "Failed to fetch user info" });
  }
});
me.put("/profile", requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const { name, role, phone, avatar_url, avatar_seed, avatar_variant } = req.body || {};
    console.log("Profile update:", { userId, name, role, phone, avatar_url, avatar_seed, avatar_variant });
    res.json({ ok: true });
  } catch (error) {
    console.error("PUT /api/me/profile error:", error);
    res.status(500).json({ error: error?.message || "Failed to update profile" });
  }
});
me.put("/", requireAuth, requireOrg, async (req, res) => {
  try {
    const userId = req.user?.id;
    const { name, phone, avatar_url, avatar_seed, avatar_variant } = req.body || {};
    console.log("Profile update (PUT /):", { userId, name, phone, avatar_url, avatar_seed, avatar_variant });
    res.json({ ok: true });
  } catch (error) {
    console.error("PUT /api/me error:", error);
    res.status(500).json({ error: error?.message || "Failed to update profile" });
  }
});
me.post("/change-password", requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const { currentPassword, newPassword } = req.body || {};
    if (!newPassword) {
      return res.status(400).json({ error: "newPassword required" });
    }
    console.log("Password change request for user:", userId);
    res.json({ ok: true });
  } catch (error) {
    console.error("POST /api/me/change-password error:", error);
    res.status(500).json({ error: error?.message || "Failed to change password" });
  }
});
me.put("/org", requireAuth, requireOrg, async (req, res) => {
  try {
    const orgId = req.orgId;
    const { name, abn, street, suburb, state, postcode, defaultLabourRateCents } = req.body || {};
    console.log("Organization update:", { orgId, name, abn, street, suburb, state, postcode, defaultLabourRateCents });
    res.json({ ok: true });
  } catch (error) {
    console.error("PUT /api/me/org error:", error);
    res.status(500).json({ error: error?.message || "Failed to update organization" });
  }
});
me.post("/avatar", requireAuth, upload2.single("file"), async (req, res) => {
  const userId = req.user.id;
  if (!req.file) return res.status(400).json({ error: "file required" });
  const okTypes = ["image/png", "image/jpeg", "image/webp", "image/gif"];
  if (!okTypes.includes(req.file.mimetype)) {
    return res.status(415).json({ error: "unsupported file type" });
  }
  const ext = req.file.mimetype.split("/")[1] || "bin";
  const fname = `${nanoid2(16)}.${ext}`;
  const outPath = path4.join(process.cwd(), "uploads", fname);
  await fs3.writeFile(outPath, req.file.buffer);
  const publicUrl = `/uploads/${fname}`;
  console.log(`Avatar uploaded for user ${userId}: ${publicUrl}`);
  res.json({ ok: true, url: publicUrl });
});

// server/db/ensure.ts
import { sql as sql11 } from "drizzle-orm";
async function ensureUsersTableShape() {
  await db2.execute(sql11`
    alter table users
      add column if not exists email text,
      add column if not exists role text,
      add column if not exists org_id uuid,
      add column if not exists phone text,
      add column if not exists avatar_url text,
      add column if not exists avatar_seed text,
      add column if not exists avatar_variant text,
      add column if not exists created_at timestamptz default now()
  `);
  await db2.execute(sql11`
    create unique index if not exists users_org_email_unique
      on users (org_id, lower(email))
  `);
  await db2.execute(sql11`create index if not exists users_org_idx on users(org_id)`);
}

// server/index.ts
import fs4 from "node:fs";
import path5 from "node:path";
import cors2 from "cors";
import session from "express-session";
import pgSession from "connect-pg-simple";
import { Pool as Pool2 } from "pg";

// server/routes/auth.ts
import { Router as Router11 } from "express";
import { sql as sql12 } from "drizzle-orm";
import bcrypt2 from "bcryptjs";
var router3 = Router11();
router3.post("/register", async (req, res) => {
  const { orgName, name, email, password } = req.body || {};
  if (!orgName || !email || !password) {
    return res.status(400).json({ error: "orgName, email, password required" });
  }
  try {
    const orgIns = await db.execute(sql12`
      insert into organisations (name) values (${orgName}) returning id
    `);
    const orgId = orgIns.rows[0].id;
    const hash = await bcrypt2.hash(password, 10);
    const userIns = await db.execute(sql12`
      insert into users (org_id, name, email, password_hash, role)
      values (${orgId}, ${name || "Owner"}, ${email}, ${hash}, 'admin')
      returning id, name, email, role
    `);
    const user = userIns.rows[0];
    req.session.regenerate((err) => {
      if (err) return res.status(500).json({ error: "session error" });
      req.session.userId = user.id;
      req.session.orgId = orgId;
      req.session.save((err2) => {
        if (err2) return res.status(500).json({ error: "session save error" });
        res.json({ ok: true, orgId, user });
      });
    });
  } catch (error) {
    console.error("Register error:", error);
    if (error.message?.includes("duplicate key")) {
      return res.status(400).json({ error: "Email already exists" });
    }
    res.status(500).json({ error: "Failed to create account" });
  }
});
router3.post("/login", async (req, res) => {
  const { email, password, orgId } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "email & password required" });
  }
  try {
    console.log("[DEBUG] Login attempt for email:", email);
    const r = await db.execute(sql12`
      select id, org_id, email, password_hash, name, role
      from users
      where lower(email) = lower(${email})
      ${orgId ? sql12`and org_id = ${orgId}` : sql12``}
      order by created_at asc
      limit 1
    `);
    const user = r.rows?.[0];
    console.log("[DEBUG] User found:", !!user, user ? { id: user.id, email: user.email, hasPassword: !!user.password_hash } : null);
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const ok = await bcrypt2.compare(password, user.password_hash || "");
    console.log("[DEBUG] Password verification:", ok);
    if (!ok) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    await db.execute(sql12`update users set last_login_at = now() where id = ${user.id}`);
    req.session.regenerate((err) => {
      if (err) return res.status(500).json({ error: "session error" });
      req.session.userId = user.id;
      req.session.orgId = user.org_id;
      req.session.save((err2) => {
        if (err2) return res.status(500).json({ error: "session save error" });
        res.json({
          ok: true,
          orgId: user.org_id,
          user: { id: user.id, name: user.name, email: user.email, role: user.role }
        });
      });
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
});
router3.post("/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});
router3.get("/me", async (req, res) => {
  const userId = req.session?.userId;
  const orgId = req.session?.orgId;
  if (!userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  try {
    const r = await db.execute(sql12`
      select id, name, email, role, avatar_url, avatar_seed, avatar_variant
      from users 
      where id = ${userId}
    `);
    const user = r.rows?.[0];
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar_url: user.avatar_url,
      avatar_seed: user.avatar_seed,
      avatar_variant: user.avatar_variant,
      orgId
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ error: "Failed to fetch user" });
  }
});
var auth_default = router3;

// server/routes/debug.ts
import { Router as Router12 } from "express";
import { sql as sql13 } from "drizzle-orm";
var debugRouter = Router12();
debugRouter.get("/env", async (_req, res) => {
  try {
    const r = await db2.execute(sql13`select inet_server_addr() as db_host`);
    res.json({
      nodeEnv: process.env.NODE_ENV,
      clientOrigin: process.env.CLIENT_ORIGIN,
      apiBase: process.env.VITE_API_BASE_URL || process.env.API_BASE || null,
      bizTz: process.env.BIZ_TZ || null,
      dbHost: r.rows?.[0]?.db_host || null,
      dbUrlHash: (process.env.DATABASE_URL || "").slice(0, 24) + "..."
    });
  } catch {
    res.json({
      nodeEnv: process.env.NODE_ENV,
      clientOrigin: process.env.CLIENT_ORIGIN,
      apiBase: process.env.VITE_API_BASE_URL || process.env.API_BASE || null,
      bizTz: process.env.BIZ_TZ || null,
      dbHost: null,
      dbUrlHash: (process.env.DATABASE_URL || "").slice(0, 24) + "..."
    });
  }
});
debugRouter.get("/time", async (req, res) => {
  const tz = req.query.tz || process.env.BIZ_TZ || "Australia/Melbourne";
  const sample = req.query.ts || null;
  try {
    const r = await db2.execute(sql13`
      select
        now() as db_now_utc,
        current_setting('TimeZone') as db_timezone,
        ${tz} as biz_tz,
        ${sample}::timestamptz as sample_in_db,
        (${sample}::timestamptz at time zone ${sql13.raw(`'${tz}'`)}) as sample_in_${sql13.raw(tz.replace("/", "_"))}
    `);
    res.json({
      server_now_utc: (/* @__PURE__ */ new Date()).toISOString(),
      db: r.rows?.[0] || null
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      server_now_utc: (/* @__PURE__ */ new Date()).toISOString()
    });
  }
});

// server/index.ts
var app = express3();
app.set("trust proxy", 1);
var isProd = process.env.NODE_ENV === "production";
var CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || void 0;
if (CLIENT_ORIGIN) {
  app.use(cors2({
    origin: CLIENT_ORIGIN,
    credentials: true
  }));
}
app.use(express3.json());
app.use(express3.urlencoded({ extended: false }));
var PgStore = pgSession(session);
var pool2 = new Pool2({ connectionString: process.env.DATABASE_URL });
app.use(
  session({
    store: new PgStore({ pool: pool2, tableName: "session" }),
    secret: process.env.SESSION_SECRET || "dev-secret-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      // If cross-origin in production, cookie must be SameSite=None + Secure
      sameSite: CLIENT_ORIGIN && isProd ? "none" : "lax",
      secure: CLIENT_ORIGIN && isProd ? true : false,
      maxAge: 1e3 * 60 * 60 * 24 * 30
    }
  })
);
(async () => {
  try {
    await ensureUsersTableShape();
    console.log("Database schema ensured");
  } catch (error) {
    console.error("Failed to ensure database schema:", error);
  }
})();
var uploadsDir = path5.join(process.cwd(), "uploads");
if (!fs4.existsSync(uploadsDir)) fs4.mkdirSync(uploadsDir, { recursive: true });
app.use("/uploads", express3.static(uploadsDir, { maxAge: "1y", immutable: true }));
app.use((req, _res, next) => {
  if (req.path.startsWith("/api")) {
    console.log(`[TRACE] ${req.method} ${req.path}`);
  }
  next();
});
app.get("/health", (_req, res) => res.json({ ok: true }));
app.get("/health/db", (_req, res) => res.json({ ok: true }));
app.use("/api/me", me);
app.use("/api/auth", auth_default);
app.use("/api/members", members);
app.use("/api/debug", debugRouter);
app.use("/health", health);
app.post("/api/teams/add-member", (req, res, next) => {
  req.url = "/_compat/teams-add-member";
  members(req, res, next);
});
app.use((req, res, next) => {
  const start = Date.now();
  const path6 = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path6.startsWith("/api")) {
      let logLine = `${req.method} ${path6} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        try {
          logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
        } catch {
        }
      }
      if (logLine.length > 120) logLine = logLine.slice(0, 119) + "\u2026";
      log(logLine);
    }
  });
  next();
});
(async () => {
  let server;
  try {
    server = await registerRoutes(app);
  } catch (e) {
    console.error("registerRoutes failed:", e?.stack || e);
    const http = await import("http");
    server = http.createServer(app);
  }
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    console.error("Request error:", message, err?.stack || err);
    res.status(status).json({ message });
  });
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true
      // harmless on Node; ignored if unsupported
    },
    () => {
      const dbUrlHash = (process.env.DATABASE_URL || "").slice(0, 24) + "...";
      log(`serving on port ${port} (NODE_ENV=${app.get("env")})`);
      log(`Database: ${dbUrlHash}`);
      log("Health: /health  |  API health: /health/db  |  Jobs: /api/jobs");
    }
  );
})();
process.on("unhandledRejection", (reason) => {
  console.error("UnhandledRejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("UncaughtException:", err);
});
