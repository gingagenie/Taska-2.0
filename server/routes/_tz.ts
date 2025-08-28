import { Router } from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { formatInTimeZone } from "date-fns-tz";

const r = Router();

r.get("/debug", async (_req, res) => {
  try {
    const result = await db.execute(sql`SELECT now() AT TIME ZONE 'UTC' as now_db`);
    const now_db = result.rows[0]?.now_db;
    const nowServer = new Date();
    const mel = formatInTimeZone(nowServer, "Australia/Melbourne", "yyyy-LL-dd HH:mm:ssXXX");
    const utc = nowServer.toISOString();

    res.json({
      envTZ: process.env.TZ,
      defaultTz: process.env.DEFAULT_TIMEZONE,
      server_now_iso: utc,
      server_now_melbourne: mel,
      db_now_utc: now_db, // should be close to server_now_iso
    });
  } catch (error) {
    console.error("Timezone debug error:", error);
    res.status(500).json({ error: "Failed to get timezone info" });
  }
});

export default r;