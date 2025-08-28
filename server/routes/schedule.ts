import { Router } from "express";
import { db } from "../db/client";
import { sql } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { requireOrg } from "../middleware/tenancy";

export const schedule = Router();

/**
 * GET /api/schedule/range?start=YYYY-MM-DD&end=YYYY-MM-DD&techId=uuid&tz=Area/City
 * start inclusive, end exclusive, dates interpreted in provided tz (defaults to Australia/Melbourne)
 */
schedule.get("/range", requireAuth, requireOrg, async (req, res) => {
  const orgId = (req as any).orgId;
  const { start, end, techId, tz } = req.query as Record<string, string | undefined>;
  
  console.log("[TRACE] GET /api/schedule/range org=%s start=%s end=%s techId=%s tz=%s", orgId, start, end, techId, tz);
  
  if (!start || !end) {
    return res.status(400).json({ error: "start and end required (YYYY-MM-DD)" });
  }

  // Default business timezone; mobile can override with &tz=Australia/Melbourne
  const BIZ_TZ = process.env.BIZ_TZ || "Australia/Melbourne";
  const zone = tz || BIZ_TZ;

  const techFilter = techId ? sql`
    and exists (
      select 1 from job_assignments ja
      where ja.job_id = j.id and ja.user_id = ${techId}
    )
  ` : sql``;

  try {
    const r: any = await db.execute(sql`
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
        and ((j.scheduled_at at time zone ${sql.raw(`'${zone}'`)})::date >= ${start}::date)
        and ((j.scheduled_at at time zone ${sql.raw(`'${zone}'`)})::date <  ${end}::date)
        ${techFilter}
      order by j.scheduled_at asc nulls last, j.created_at desc
    `);

    res.json(r.rows);
  } catch (error: any) {
    console.error("GET /api/schedule/range error:", error);
    res.status(500).json({ error: error?.message || "Failed to fetch schedule" });
  }
});