import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { me } from "./routes/me";
import { ensureUsersTableShape } from "./db/ensure";
import { db } from "./db/client";
import { sql } from "drizzle-orm";
import fs from "node:fs";
import path from "node:path";

import cors from "cors";

const app = express();

// 1) TRUST the Replit/Proxy so secure cookies survive
app.set("trust proxy", 1);

const isProd = process.env.NODE_ENV === "production";
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || undefined; 
// e.g. "https://your-deploy-client.replit.app" or custom domain

// 2) If your client hits a DIFFERENT origin than the API, enable CORS with credentials
if (CLIENT_ORIGIN) {
  app.use(cors({
    origin: CLIENT_ORIGIN,
    credentials: true,
  }));
}

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// 3) Session store + cookie flags that work in Deploy
import session from "express-session";
import pgSession from "connect-pg-simple";
import { Pool } from "pg";

const PgStore = pgSession(session as any);
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

app.use(
  session({
    store: new PgStore({ pool, tableName: "session" }),
    secret: process.env.SESSION_SECRET || "dev-secret-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      // If cross-origin in production, cookie must be SameSite=None + Secure
      sameSite: (CLIENT_ORIGIN && isProd) ? "none" : "lax",
      secure: (CLIENT_ORIGIN && isProd) ? true : false,
      maxAge: 1000 * 60 * 60 * 24 * 30,
    },
  })
);

// Ensure database schema is up to date
(async () => {
  try {
    await ensureUsersTableShape();
    console.log("Database schema ensured");
  } catch (error) {
    console.error("Failed to ensure database schema:", error);
  }
})();

// Ensure uploads dir exists and serve statically
const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use("/uploads", express.static(uploadsDir, { maxAge: "1y", immutable: true }));

// --- BEGIN tenant guard ---
/**
 * Sets the current tenant for this HTTP request so RLS can do its job.
 * Requires that your auth has already put { org_id: '...' } on req.user
 * (or on req.session.user.org_id). If that's different, adjust the line marked 👇.
 */
async function tenantGuard(req: Request, res: Response, next: NextFunction) {
  try {
    // 👇 get the org from the authenticated user on the server (NOT from headers/localStorage)
    const orgId =
      // prefer whatever your auth sets
      // @ts-ignore
      req.user?.org_id ||
      // fallback if you use sessions
      // @ts-ignore
      req.session?.user?.org_id ||
      // additional fallback for session-based auth
      // @ts-ignore
      req.session?.orgId;

    if (!orgId) {
      return res.status(401).json({ error: "No org on session" });
    }

    // one PG client per request, with a transaction + tenant set
    const client = await pool.connect();
    // @ts-ignore
    req.db = client;

    // Set the tenant context without a transaction to prevent timeouts
    await client.query("SET app.current_org = $1", [orgId]);

    // auto-release when the response ends
    res.on("finish", async () => {
      try { 
        client.release();
      } catch (e) {
        console.error("Error releasing client on finish:", e);
      }
    });
    res.on("close", async () => {
      try { 
        client.release();
      } catch (e) {
        console.error("Error releasing client on close:", e);
      }
    });

    return next();
  } catch (e) {
    console.error("Tenant guard error:", e);
    return res.status(500).json({ error: "Database connection failed" });
  }
}
// --- END tenant guard ---

// Log every API request reaching Express
app.use((req, _res, next) => {
  if (req.path.startsWith("/api")) {
    console.log(`[TRACE] ${req.method} ${req.path}`);
  }
  next();
});

// Remove default header injection - session auth only in production
// In development, allow headers but don't default to demo values

/** Quick health checks (sanity) */
app.get("/health", (_req, res) => res.json({ ok: true }));
app.get("/health/db", async (_req, res) => {
  try {
    // Check database connection and show basic info
    const dbUrl = process.env.DATABASE_URL;
    const dbHost = dbUrl ? new URL(dbUrl).hostname : 'NOT_SET';
    
    // Try simple connection test
    const client = await pool.connect();
    const result = await client.query('SELECT COUNT(*) as user_count FROM users');
    const orgResult = await client.query('SELECT COUNT(*) as org_count FROM orgs');
    client.release();
    
    res.json({ 
      ok: true, 
      user_count: result.rows[0]?.user_count,
      org_count: orgResult.rows[0]?.org_count,
      db_host: dbHost
    });
  } catch (error) {
    res.status(500).json({ 
      ok: false, 
      error: error instanceof Error ? error.message : 'Database connection failed'
    });
  }
}); // replace with real db check later


// Temporarily disable tenant guard to test clean setup
// TODO: Re-enable after converting all routes to use req.db
// mount tenant guard for all API routes (after auth, but exclude auth endpoints)
// app.use("/api", (req, res, next) => {
//   // Skip tenant guard for auth endpoints that work before authentication
//   if (req.path.startsWith("/auth/") || req.path === "/auth") {
//     return next();
//   }
//   return tenantGuard(req, res, next);
// });

/** Mount API routes that aren't part of registerRoutes */
import { members } from "./routes/members";
import auth from "./routes/auth";
import { health } from "./routes/health";
import { debugRouter } from "./routes/debug";
app.use("/api/me", me);
app.use("/api/auth", auth);
app.use("/api/members", members);
app.use("/api/debug", debugRouter);
app.use("/health", health);

// Legacy compatibility endpoint
app.post("/api/teams/add-member", (req, res, next) => {
  req.url = "/_compat/teams-add-member";
  members(req, res, next);
});

/** API request logging (compact) */
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        try {
          logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
        } catch { /* ignore stringify issues */ }
      }
      if (logLine.length > 120) logLine = logLine.slice(0, 119) + "…";
      log(logLine);
    }
  });

  next();
});

(async () => {
  let server: any;

  try {
    // registerRoutes should mount all /api/* routers (jobs, customers, etc.)
    // IMPORTANT: Must be called BEFORE static file serving in production!
    server = await registerRoutes(app);
  } catch (e: any) {
    console.error("registerRoutes failed:", e?.stack || e);
    // If registerRoutes throws, don't crash — create a basic HTTP server so we can see logs/health.
    const http = await import("http");
    server = http.createServer(app);
  }

  // Vite in dev, static in prod
  // IMPORTANT: Static serving must come AFTER API routes to avoid conflicts
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  /** Centralized error handler — DO NOT rethrow (it kills the process) */
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    console.error("Request error:", message, err?.stack || err);
    res.status(status).json({ message });
    // DON'T: throw err;
  });

  // Always bind to PORT (Replit requirement)
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true, // harmless on Node; ignored if unsupported
    },
    () => {
      const dbUrlHash = (process.env.DATABASE_URL || "").slice(0, 24) + "...";
      log(`serving on port ${port} (NODE_ENV=${app.get("env")})`);
      log(`Database: ${dbUrlHash}`);
      log("Health: /health  |  API health: /health/db  |  Jobs: /api/jobs");
    }
  );
})();

/** Bonus: catch unhandled promise rejections so one bad SQL cast doesn't kill the server silently */
process.on("unhandledRejection", (reason) => {
  console.error("UnhandledRejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("UncaughtException:", err);
});

