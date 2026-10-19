// Migrations, run as the OWNER (DATABASE_OWNER_URL). Idempotent; safe to run on every deploy.
//   1. Ensure the restricted app role exists (local dev only: needs APP_USER_PASSWORD).
//   2. Better Auth's own tables, from its schema.
//   3. db/migrations/*.sql in name order, each once, each in a transaction.
//   4. Grant app_user DML on everything, so the app never needs the owner.
import { readdirSync, readFileSync } from 'node:fs'
import pg from 'pg'
import { getMigrations } from 'better-auth/db/migration'

const owner = new pg.Pool({ connectionString: process.env.DATABASE_OWNER_URL })
const dir = new URL('./migrations/', import.meta.url)

if (process.env.APP_USER_PASSWORD) {
  const { rowCount } = await owner.query(`SELECT 1 FROM pg_roles WHERE rolname = 'app_user'`)
  if (!rowCount) {
    const pw = (await owner.query(`SELECT quote_literal($1) AS q`, [process.env.APP_USER_PASSWORD])).rows[0].q
    await owner.query(`CREATE ROLE app_user LOGIN PASSWORD ${pw} NOSUPERUSER NOBYPASSRLS`)
    console.log('created role app_user')
  }
}

const { runMigrations } = await getMigrations({ database: owner, emailAndPassword: { enabled: true } })
await runMigrations()
console.log('better-auth tables ready')

await owner.query(`CREATE TABLE IF NOT EXISTS _migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`)
for (const name of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
  const c = await owner.connect()
  try {
    await c.query('BEGIN')
    // Lock the ledger row so two concurrent deploys can't apply the same file twice.
    const { rowCount } = await c.query(`INSERT INTO _migrations (name) VALUES ($1) ON CONFLICT DO NOTHING`, [name])
    if (rowCount) {
      await c.query(readFileSync(new URL(name, dir), 'utf8'))
      console.log(`applied ${name}`)
    }
    await c.query('COMMIT')
  } catch (e) {
    await c.query('ROLLBACK')
    throw e
  } finally {
    c.release()
  }
}

await owner.query(`
  GRANT USAGE ON SCHEMA public TO app_user;
  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
  GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
  REVOKE ALL ON _migrations FROM app_user;
  -- audit history is append-only for the app
  REVOKE UPDATE, DELETE ON audit_entry FROM app_user;
`)
console.log('grants applied to app_user')
await owner.end()
