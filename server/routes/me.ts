import { Router } from "express";
// import { db } from "../db/client"; // replaced with req.db
import { sql } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { requireOrg } from "../middleware/tenancy";
import { upload } from "../middleware/upload";
import { nanoid } from "nanoid";
import fs from "node:fs/promises";
import path from "node:path";

export const me = Router();

/** Who am I + my org (read) */
me.get("/", requireAuth, requireOrg, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const orgId = (req as any).orgId;

    // @ts-ignore
    const client = req.db;
    
    // Fetch user data from database
    const userResult = await client.query(`
      SELECT id, email, name, role, phone 
      FROM users 
      WHERE id = $1
    `, [userId]);
    
    // Fetch organization data from database
    const orgResult = await client.query(`
      SELECT id, name, abn, street, suburb, state, postcode, logo_url, default_labour_rate_cents
      FROM orgs 
      WHERE id = current_setting('app.current_org')::uuid
    `);

    const user = userResult.rows[0] || {
      id: userId,
      email: "user@taska.com",
      name: "John Smith",
      role: "Administrator",
      phone: "+61 400 123 456",
    };

    const org = orgResult.rows[0] || {
      id: orgId,
      name: "Taska Field Services",
      abn: "12 345 678 901",
      street: "123 Main Street",
      suburb: "Melbourne",
      state: "VIC",
      postcode: "3000",
      logo_url: null,
      default_labour_rate_cents: 12500, // $125.00/hr
    };

    res.json({
      user: user,
      org: { ...org, plan: "pro", plan_renews_at: "2025-12-31T00:00:00Z" }
    });
  } catch (error: any) {
    console.error("GET /api/me error:", error);
    res.status(500).json({ error: error?.message || "Failed to fetch user info" });
  }
});

/** Update profile */
me.put("/profile", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const { name, role, phone } = req.body || {};
    
    console.log("Profile update:", { userId, name, role, phone });
    
    // Update user in database
    await db.execute(sql`
      UPDATE users SET 
        name = COALESCE(${name}, name),
        role = COALESCE(${role}, role),
        phone = COALESCE(${phone}, phone)
      WHERE id = ${userId}
    `);
    
    res.json({ ok: true });
  } catch (error: any) {
    console.error("PUT /api/me/profile error:", error);
    res.status(500).json({ error: error?.message || "Failed to update profile" });
  }
});

/** Update just the profile (new endpoint for avatar fields) */
me.put("/", requireAuth, requireOrg, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const { name, phone } = req.body || {};
    
    console.log("Profile update (PUT /):", { userId, name, phone });
    
    // Update user in database
    await db.execute(sql`
      UPDATE users SET
        name = COALESCE(${name}, name),
        phone = COALESCE(${phone}, phone)
      WHERE id = ${userId}
    `);
    
    res.json({ ok: true });
  } catch (error: any) {
    console.error("PUT /api/me error:", error);
    res.status(500).json({ error: error?.message || "Failed to update profile" });
  }
});

/** Change password (very basic stub; replace with real hashing/validation) */
me.post("/change-password", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const { currentPassword, newPassword } = req.body || {};
    
    if (!newPassword) {
      return res.status(400).json({ error: "newPassword required" });
    }

    console.log("Password change request for user:", userId);
    
    // Mock implementation - in reality would verify current password and hash new one
    res.json({ ok: true });
  } catch (error: any) {
    console.error("POST /api/me/change-password error:", error);
    res.status(500).json({ error: error?.message || "Failed to change password" });
  }
});

/** Update organization */
me.put("/org", requireAuth, requireOrg, async (req, res) => {
  try {
    const orgId = (req as any).orgId;
    const { name, abn, street, suburb, state, postcode, logo_url, default_labour_rate_cents } = req.body || {};
    
    console.log("Organization update:", { orgId, name, abn, street, suburb, state, postcode, logo_url, default_labour_rate_cents });
    
    // Update organization in database
    await db.execute(sql`
      UPDATE orgs SET 
        name = COALESCE(${name}, name),
        abn = COALESCE(${abn}, abn),
        street = COALESCE(${street}, street),
        suburb = COALESCE(${suburb}, suburb),
        state = COALESCE(${state}, state),
        postcode = COALESCE(${postcode}, postcode),
        logo_url = COALESCE(${logo_url}, logo_url),
        default_labour_rate_cents = COALESCE(${default_labour_rate_cents}, default_labour_rate_cents)
      WHERE id = ${orgId}
    `);
    
    res.json({ ok: true });
  } catch (error: any) {
    console.error("PUT /api/me/org error:", error);
    res.status(500).json({ error: error?.message || "Failed to update organization" });
  }
});

export default me;