import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

// ignore stray PG* envs that Replit might inject
for (const k of ["PGHOST","PGPORT","PGUSER","PGPASSWORD","PGDATABASE"]) {
  delete (process.env as any)[k];
}

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL not set");


const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool);