import { Request, Response, NextFunction } from "express";
import { db } from "../db/client";
import { sql } from "drizzle-orm";

export async function requireOrg(req: Request, res: Response, next: NextFunction) {
  const isProd = process.env.NODE_ENV === "production";
  const sessOrg = (req.session as any)?.orgId as string | undefined;
  const headerOrg = (req.headers["x-org-id"] as string | undefined) || undefined;

  // 🚫 In production, ignore header org completely
  let chosen = isProd ? sessOrg : (sessOrg || headerOrg);

  // Fallback from user row if we have a session user
  if (!chosen && (req.session as any)?.userId) {
    const r: any = await db.execute(sql`
      select org_id from users where id=${(req.session as any).userId}::uuid
    `);
    chosen = r.rows?.[0]?.org_id;
  }

  if (!chosen) {
    console.log(`[AUTH] 401 - No org found: userId=${(req.session as any)?.userId}, sessOrg=${sessOrg}, headerOrg=${headerOrg}`);
    return res.status(401).json({ error: "Not authenticated" });
  }

  // Safety: if both present and conflict, reject
  if (sessOrg && headerOrg && sessOrg !== headerOrg) {
    console.log(`[AUTH] 400 - Org mismatch: session=${sessOrg}, header=${headerOrg}`);
    return res.status(400).json({ error: "Org mismatch between session and header" });
  }

  (req as any).orgId = chosen;
  next();
}