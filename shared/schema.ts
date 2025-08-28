import { sql } from "drizzle-orm";
import { pgTable, varchar, text, timestamp, integer, decimal, boolean, jsonb, uuid, primaryKey, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Organizations - using 'orgs' table name for consistency
export const organizations = pgTable("orgs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull(),
  abn: varchar("abn", { length: 50 }),
  street: varchar("street", { length: 255 }),
  suburb: varchar("suburb", { length: 100 }),
  state: varchar("state", { length: 50 }),
  postcode: varchar("postcode", { length: 10 }),
  logoUrl: varchar("logo_url", { length: 500 }),
  defaultLabourRateCents: integer("default_labour_rate_cents").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// Legacy organizations table reference (deprecated)
export const organisations = pgTable("organisations", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Users
export const users = pgTable("users", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: uuid("org_id").references(() => organizations.id),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  role: varchar("role", { length: 100 }),
  phone: varchar("phone", { length: 50 }),
  avatarUrl: varchar("avatar_url", { length: 500 }),
  createdAt: timestamp("created_at").defaultNow(),
});

// Memberships (user-org relationship)
export const memberships = pgTable("memberships", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id),
  orgId: uuid("org_id").references(() => organizations.id),
  role: varchar("role", { length: 50 }).default("member"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Teams
export const teams = pgTable("teams", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: uuid("org_id").references(() => organizations.id).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Team members
export const teamMembers = pgTable("team_members", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: uuid("team_id").references(() => teams.id),
  userId: uuid("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Customers
export const customers = pgTable("customers", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: uuid("org_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  contactName: text("contact_name"),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  address: text("address"), // Keep for backward compatibility
  street: text("street"),
  suburb: text("suburb"),
  state: text("state"),
  postcode: text("postcode"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Equipment
export const equipment = pgTable("equipment", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: uuid("org_id").notNull(), // FK reference removed - nuclear option like customers
  customerId: uuid("customer_id").references(() => customers.id),
  name: varchar("name", { length: 255 }).notNull(),
  make: varchar("make", { length: 255 }),
  model: varchar("model", { length: 255 }),
  serial: varchar("serial", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow(),
});

// Jobs
export const jobs = pgTable("jobs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: uuid("org_id").notNull(), // FK reference removed - nuclear option
  customerId: uuid("customer_id").references(() => customers.id),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  status: varchar("status", { length: 50 }).default("new"),
  notes: text("notes"), // Work performed notes
  scheduledAt: timestamp("scheduled_at"),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Job assignments
export const jobAssignments = pgTable("job_assignments", {
  jobId: uuid("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  assignedAt: timestamp("assigned_at", { withTimezone: true }).defaultNow(),
}, (t) => ({
  pk: primaryKey({ columns: [t.jobId, t.userId] }),
}));

// Job equipment
export const jobEquipment = pgTable("job_equipment", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: uuid("job_id").references(() => jobs.id).notNull(),
  equipmentId: uuid("equipment_id").references(() => equipment.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Job photos
export const jobPhotos = pgTable("job_photos", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: uuid("job_id").references(() => jobs.id, { onDelete: "cascade" }).notNull(),
  orgId: uuid("org_id").references(() => organizations.id).notNull(),
  url: text("url").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Completed jobs - stores jobs that have been marked as completed
export const completedJobs = pgTable("completed_jobs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: uuid("org_id").notNull(),
  originalJobId: uuid("original_job_id").notNull(), // Reference to original job that was completed
  customerId: uuid("customer_id"),
  customerName: varchar("customer_name", { length: 255 }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  notes: text("notes"), // Work performed notes
  scheduledAt: timestamp("scheduled_at"),
  completedAt: timestamp("completed_at").defaultNow().notNull(),
  completedBy: uuid("completed_by").references(() => users.id),
  originalCreatedBy: uuid("original_created_by").references(() => users.id),
  originalCreatedAt: timestamp("original_created_at"),
});

// Job hours tracking (0.5 hour increments)
export const jobHours = pgTable("job_hours", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: uuid("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  orgId: uuid("org_id").notNull(),
  hours: decimal("hours", { precision: 4, scale: 1 }).notNull(), // e.g., 1.5, 2.0, 0.5
  description: text("description"), // Optional description of work performed
  createdAt: timestamp("created_at").defaultNow(),
});

// Job parts used tracking  
export const jobParts = pgTable("job_parts", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: uuid("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  orgId: uuid("org_id").notNull(),
  partName: text("part_name").notNull(), // e.g., "Exhaust", "Air Filter"
  quantity: integer("quantity").notNull().default(1), // Whole numbers only
  createdAt: timestamp("created_at").defaultNow(),
});

// Completed job hours (preserved when job completed)
export const completedJobHours = pgTable("completed_job_hours", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  completedJobId: uuid("completed_job_id").notNull(),
  originalJobId: uuid("original_job_id").notNull(),
  orgId: uuid("org_id").notNull(),
  hours: decimal("hours", { precision: 4, scale: 1 }).notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Completed job parts (preserved when job completed)
export const completedJobParts = pgTable("completed_job_parts", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  completedJobId: uuid("completed_job_id").notNull(),
  originalJobId: uuid("original_job_id").notNull(),
  orgId: uuid("org_id").notNull(),
  partName: text("part_name").notNull(),
  quantity: integer("quantity").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Entitlements (for pro features)
export const entitlements = pgTable("entitlements", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: uuid("org_id").references(() => organizations.id).notNull().unique(),
  plan: varchar("plan", { length: 50 }).default("free"),
  active: boolean("active").default(false),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Quotes
export const quotes = pgTable("quotes", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: uuid("org_id").references(() => organizations.id).notNull(),
  customerId: uuid("customer_id").references(() => customers.id),
  title: varchar("title", { length: 255 }).notNull(),
  notes: text("notes"),
  items: jsonb("items").default([]),
  currency: varchar("currency", { length: 3 }).default("USD"),
  total: decimal("total", { precision: 10, scale: 2 }).default("0"),
  status: varchar("status", { length: 50 }).default("draft"),
  xeroId: varchar("xero_id", { length: 255 }), // Xero Quote ID
  createdAt: timestamp("created_at").defaultNow(),
});

// Invoices
export const invoices = pgTable("invoices", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: uuid("org_id").references(() => organizations.id).notNull(),
  jobId: uuid("job_id").references(() => jobs.id),
  customerId: uuid("customer_id").references(() => customers.id),
  items: jsonb("items").default([]),
  currency: varchar("currency", { length: 3 }).default("USD"),
  total: decimal("total", { precision: 10, scale: 2 }).default("0"),
  status: varchar("status", { length: 50 }).default("draft"),
  issuedAt: timestamp("issued_at"),
  dueAt: timestamp("due_at"),
  xeroId: varchar("xero_id", { length: 255 }), // Xero Invoice ID
  createdAt: timestamp("created_at").defaultNow(),
});

// Job notifications for SMS logging and tracking
export const jobNotifications = pgTable("job_notifications", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: uuid("org_id").notNull(),
  jobId: uuid("job_id").references(() => jobs.id),
  channel: varchar("channel", { length: 50 }).notNull(), // 'sms', 'email', etc.
  toAddr: varchar("to_addr", { length: 255 }).notNull(), // phone number or email
  body: text("body"),
  providerId: varchar("provider_id", { length: 255 }), // Twilio SID, etc.
  direction: varchar("direction", { length: 10 }).notNull(), // 'in' or 'out'
  status: varchar("status", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow(),
});

// Organization integrations (for Xero, QuickBooks, etc.)
export const orgIntegrations = pgTable("org_integrations", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: uuid("org_id").references(() => organizations.id).notNull(),
  provider: varchar("provider", { length: 50 }).notNull(), // 'xero', 'quickbooks', etc.
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  tokenExpiresAt: timestamp("token_expires_at"),
  tenantId: varchar("tenant_id", { length: 255 }), // Xero tenant ID
  tenantName: varchar("tenant_name", { length: 255 }),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Item presets (for billing line items)
export const itemPresets = pgTable("item_presets", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  unitAmount: decimal("unit_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  taxRate: decimal("tax_rate", { precision: 5, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => ({
  // ✅ composite unique on (org_id, name) - case sensitive for now
  orgNameUnique: uniqueIndex("item_presets_org_name_unique").on(
    t.orgId,
    t.name
  ),
}));

// Create insert schemas
export const insertCustomerSchema = createInsertSchema(customers).omit({ id: true, createdAt: true });
export const insertJobSchema = createInsertSchema(jobs).omit({ id: true, createdAt: true, updatedAt: true });
export const insertJobPhotoSchema = createInsertSchema(jobPhotos).omit({ id: true, createdAt: true });
export const insertEquipmentSchema = createInsertSchema(equipment).omit({ id: true, createdAt: true });
export const insertQuoteSchema = createInsertSchema(quotes).omit({ id: true, createdAt: true });
export const insertInvoiceSchema = createInsertSchema(invoices).omit({ id: true, createdAt: true });
export const insertJobNotificationSchema = createInsertSchema(jobNotifications).omit({ id: true, createdAt: true });
export const insertOrgIntegrationSchema = createInsertSchema(orgIntegrations).omit({ id: true, createdAt: true, updatedAt: true });
export const insertItemPresetSchema = createInsertSchema(itemPresets).omit({ id: true, createdAt: true });
export const insertCompletedJobSchema = createInsertSchema(completedJobs).omit({ id: true, completedAt: true });
export const insertJobHoursSchema = createInsertSchema(jobHours).omit({ id: true, createdAt: true });
export const insertJobPartsSchema = createInsertSchema(jobParts).omit({ id: true, createdAt: true });

// Create types
export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;

export type Job = typeof jobs.$inferSelect;
export type InsertJob = z.infer<typeof insertJobSchema>;

export type Equipment = typeof equipment.$inferSelect;
export type InsertEquipment = z.infer<typeof insertEquipmentSchema>;

export type Quote = typeof quotes.$inferSelect;
export type InsertQuote = z.infer<typeof insertQuoteSchema>;

export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;

export type JobPhoto = typeof jobPhotos.$inferSelect;
export type InsertJobPhoto = z.infer<typeof insertJobPhotoSchema>;

export type JobNotification = typeof jobNotifications.$inferSelect;
export type InsertJobNotification = z.infer<typeof insertJobNotificationSchema>;

export type OrgIntegration = typeof orgIntegrations.$inferSelect;
export type InsertOrgIntegration = z.infer<typeof insertOrgIntegrationSchema>;

export type ItemPreset = typeof itemPresets.$inferSelect;
export type InsertItemPreset = z.infer<typeof insertItemPresetSchema>;

export type CompletedJob = typeof completedJobs.$inferSelect;
export type InsertCompletedJob = z.infer<typeof insertCompletedJobSchema>;

export type JobHours = typeof jobHours.$inferSelect;
export type InsertJobHours = z.infer<typeof insertJobHoursSchema>;

export type JobParts = typeof jobParts.$inferSelect;
export type InsertJobParts = z.infer<typeof insertJobPartsSchema>;