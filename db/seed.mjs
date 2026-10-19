// Seed: two tenants, four users, memberships, one project each. Runs as the OWNER; idempotent.
//   roberto@tenantdesk.test  admin of t1 only
//   patrick@tenantdesk.test  admin of t2 only
//   caio@tenantdesk.test     viewer of t1 only
//   gustavo@tenantdesk.test  editor of t1 only
// The password comes from SEED_PASSWORD so it never lands in the repo. Re-running the seed
// resets existing users to the current SEED_PASSWORD.
import pg from 'pg'
import { betterAuth } from 'better-auth'
import { hashPassword } from 'better-auth/crypto'

const password = process.env.SEED_PASSWORD
if (!password || password.length < 8) throw new Error('set SEED_PASSWORD (8+ chars)')

const owner = new pg.Pool({ connectionString: process.env.DATABASE_OWNER_URL })
const auth = betterAuth({ database: owner, emailAndPassword: { enabled: true } })

const users = [
  { email: 'roberto@tenantdesk.test', name: 'Roberto', tenant: 't1', role: 'admin' },
  { email: 'patrick@tenantdesk.test', name: 'Patrick', tenant: 't2', role: 'admin' },
  { email: 'caio@tenantdesk.test', name: 'Caio', tenant: 't1', role: 'viewer' },
  { email: 'gustavo@tenantdesk.test', name: 'Gustavo', tenant: 't1', role: 'editor' },
]
const tenants = [
  { slug: 't1', name: 'Tenant 1', project: 'Old' },
  { slug: 't2', name: 'Tenant 2', project: 'Other tenant' },
]

// owner bypasses RLS (superuser locally, BYPASSRLS on Neon); fail loudly if not
const { rows: [me] } = await owner.query(`SELECT rolsuper OR rolbypassrls AS ok FROM pg_roles WHERE rolname = current_user`)
if (!me.ok) throw new Error('seed must run as a role that bypasses RLS')

for (const t of tenants) {
  await owner.query(`INSERT INTO tenant (slug, name) VALUES ($1, $2) ON CONFLICT (slug) DO NOTHING`, [t.slug, t.name])
  await owner.query(
    `INSERT INTO project (tenant_id, name) SELECT id, $2 FROM tenant WHERE slug = $1
     ON CONFLICT DO NOTHING`,
    [t.slug, t.project],
  )
}

for (const u of users) {
  let { rows } = await owner.query(`SELECT id FROM "user" WHERE email = $1`, [u.email])
  if (!rows.length) {
    await auth.api.signUpEmail({ body: { email: u.email, password, name: u.name } })
    ;({ rows } = await owner.query(`SELECT id FROM "user" WHERE email = $1`, [u.email]))
  } else {
    await owner.query(`UPDATE account SET password = $1, "updatedAt" = now() WHERE "userId" = $2 AND "providerId" = 'credential'`,
      [await hashPassword(password), rows[0].id])
  }
  await owner.query(
    `INSERT INTO membership (tenant_id, user_id, role) SELECT id, $2, $3 FROM tenant WHERE slug = $1
     ON CONFLICT (tenant_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
    [u.tenant, rows[0].id, u.role],
  )
  console.log(`seeded ${u.email} as ${u.role} of ${u.tenant}`)
}
await owner.end()
