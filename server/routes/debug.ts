import { Router } from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";

export const debugRouter = Router();

debugRouter.get("/env", async (_req, res) => {
  try {
    const r: any = await db.execute(sql`select inet_server_addr() as db_host`);
    res.json({
      nodeEnv: process.env.NODE_ENV,
      clientOrigin: process.env.CLIENT_ORIGIN,
      apiBase: process.env.VITE_API_BASE_URL || process.env.API_BASE || null,
      bizTz: process.env.BIZ_TZ || null,
      dbHost: r.rows?.[0]?.db_host || null,
      dbUrlHash: (process.env.DATABASE_URL || "").slice(0, 24) + "...",
    });
  } catch {
    res.json({
      nodeEnv: process.env.NODE_ENV,
      clientOrigin: process.env.CLIENT_ORIGIN,
      apiBase: process.env.VITE_API_BASE_URL || process.env.API_BASE || null,
      bizTz: process.env.BIZ_TZ || null,
      dbHost: null,
      dbUrlHash: (process.env.DATABASE_URL || "").slice(0, 24) + "...",
    });
  }
});

debugRouter.get("/time", async (req, res) => {
  const tz = (req.query.tz as string) || process.env.BIZ_TZ || "Australia/Melbourne";
  const sample = (req.query.ts as string) || null; // ISO string or omit

  try {
    const r: any = await db.execute(sql`
      select
        now() as db_now_utc,
        current_setting('TimeZone') as db_timezone,
        ${tz} as biz_tz,
        ${sample}::timestamptz as sample_in_db,
        (${sample}::timestamptz at time zone ${sql.raw(`'${tz}'`)}) as sample_in_${sql.raw(tz.replace('/','_'))}
    `);
    res.json({
      server_now_utc: new Date().toISOString(),
      db: r.rows?.[0] || null,
    });
  } catch (error: any) {
    res.status(500).json({
      error: error.message,
      server_now_utc: new Date().toISOString()
    });
  }
});