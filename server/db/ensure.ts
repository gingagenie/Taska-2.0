import { db } from "../db";
import { sql } from "drizzle-orm";

export async function ensureUsersTableShape() {
  await db.execute(sql`
    alter table users
      add column if not exists email text,
      add column if not exists role text,
      add column if not exists org_id uuid,
      add column if not exists phone text,
      add column if not exists avatar_url text,
      add column if not exists avatar_seed text,
      add column if not exists avatar_variant text,
      add column if not exists created_at timestamptz default now()
  `);

  await db.execute(sql`
    create unique index if not exists users_org_email_unique
      on users (org_id, lower(email))
  `);
  await db.execute(sql`create index if not exists users_org_idx on users(org_id)`);
}