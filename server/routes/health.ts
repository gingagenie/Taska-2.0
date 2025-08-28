import { Router } from "express";

export const health = Router();

health.get("/whoami", (req, res) => {
  res.json({
    env: process.env.NODE_ENV,
    sessionUserId: (req.session as any)?.userId || null,
    sessionOrgId: (req.session as any)?.orgId || null,
    headerUserId: req.headers["x-user-id"] || null,
    headerOrgId: req.headers["x-org-id"] || null,
    effectiveOrgId: (req as any).orgId || null, // after requireOrg
  });
});