import { Pool } from 'pg'

// The app's only connection: DATABASE_URL is the restricted `app_user` role, never the owner,
// so Postgres row-level security applies to every query. The owner URL is for db/migrate.mjs only.
const globalForPool = globalThis as unknown as { pool?: Pool }

export const pool = globalForPool.pool ?? new Pool({ connectionString: process.env.DATABASE_URL })

// Reuse one pool across Next.js dev hot reloads.
if (process.env.NODE_ENV !== 'production') globalForPool.pool = pool
