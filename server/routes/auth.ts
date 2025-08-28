import { Router } from "express";
import { db } from "../db/client";
import { sql } from "drizzle-orm";
import bcrypt from "bcryptjs";

declare module 'express-session' {
  interface SessionData {
    userId?: string;
    orgId?: string;
  }
}

const router = Router();

router.post("/register", async (req, res) => {
  const { orgName, name, email, password } = req.body || {};
  if (!orgName || !email || !password) {
    return res.status(400).json({ error: "orgName, email, password required" });
  }

  try {
    // Create organization
    const orgIns: any = await db.execute(sql`
      insert into organisations (name) values (${orgName}) returning id
    `);
    const orgId = orgIns.rows[0].id;

    // Hash password and create user
    const hash = await bcrypt.hash(password, 10);
    const userIns: any = await db.execute(sql`
      insert into users (org_id, name, email, password_hash, role)
      values (${orgId}, ${name || 'Owner'}, ${email}, ${hash}, 'admin')
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
  } catch (error: any) {
    console.error("Register error:", error);
    if (error.message?.includes("duplicate key")) {
      return res.status(400).json({ error: "Email already exists" });
    }
    res.status(500).json({ error: "Failed to create account" });
  }
});

router.post("/login", async (req, res) => {
  const { email, password, orgId } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "email & password required" });
  }

  try {
    console.log("[DEBUG] Login attempt for email:", email);
    
    // Find user by email (optionally scoped to org)
    const r: any = await db.execute(sql`
      select id, org_id, email, password_hash, name, role
      from users
      where lower(email) = lower(${email})
      ${orgId ? sql`and org_id = ${orgId}` : sql``}
      order by created_at asc
      limit 1
    `);
    const user = r.rows?.[0];
    console.log("[DEBUG] User found:", !!user, user ? { id: user.id, email: user.email, hasPassword: !!user.password_hash } : null);
    
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Verify password
    const ok = await bcrypt.compare(password, user.password_hash || "");
    console.log("[DEBUG] Password verification:", ok);
    
    if (!ok) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Update last login
    await db.execute(sql`update users set last_login_at = now() where id = ${user.id}`);

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
  } catch (error: any) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

router.get("/me", async (req, res) => {
  const userId = req.session?.userId;
  const orgId = req.session?.orgId;
  
  if (!userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  
  try {
    // Fetch full user info from database
    const r: any = await db.execute(sql`
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
      orgId: orgId
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

export default router;