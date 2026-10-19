// Integration tests against a real Postgres, through the real route handlers and real
// Better Auth sessions. The app pool connects as app_user, so RLS applies.
// Needs: pnpm db:migrate && SEED_PASSWORD=... pnpm db:seed
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { auth } from '@/lib/auth'
import { pool } from '@/lib/db'
import { GET, POST } from '@/app/api/t/[slug]/projects/route'
import { PATCH } from '@/app/api/t/[slug]/projects/[id]/route'

const BASE = process.env.BETTER_AUTH_URL ?? 'http://localhost:3000'
const owner = new pg.Pool({ connectionString: process.env.DATABASE_OWNER_URL })
const run = `${process.pid}-${Math.floor(performance.now())}`
const cookies: Record<string, string> = {}
let t1ProjectId = ''
let t2ProjectId = ''

async function signIn(email: string) {
  const res = await auth.handler(
    new Request(`${BASE}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: BASE },
      body: JSON.stringify({ email, password: process.env.SEED_PASSWORD }),
    }),
  )
  expect(res.status).toBe(200)
  return res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ')
}

function req(method: string, path: string, who?: string, body?: unknown) {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (who) headers.cookie = cookies[who]
  return new Request(`${BASE}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
}
const list = (slug: string, who?: string) => GET(req('GET', `/api/t/${slug}/projects`, who), { params: Promise.resolve({ slug }) })
const create = (slug: string, who: string | undefined, body: unknown) =>
  POST(req('POST', `/api/t/${slug}/projects`, who, body), { params: Promise.resolve({ slug }) })
const rename = (slug: string, id: string, who: string | undefined, body: unknown) =>
  PATCH(req('PATCH', `/api/t/${slug}/projects/${id}`, who, body), { params: Promise.resolve({ slug, id }) })

async function projectName(id: string) {
  const { rows } = await owner.query(`SELECT name FROM project WHERE id = $1`, [id])
  return rows[0]?.name
}

beforeAll(async () => {
  for (const u of ['roberto@tenantdesk.test', 'patrick@tenantdesk.test', 'caio@tenantdesk.test', 'gustavo@tenantdesk.test']) cookies[u] = await signIn(u)
  const { rows } = await owner.query(
    `SELECT t.slug, p.id FROM project p JOIN tenant t ON t.id = p.tenant_id WHERE p.name IN ('Old', 'Other tenant')`,
  )
  t1ProjectId = rows.find((r) => r.slug === 't1').id
  t2ProjectId = rows.find((r) => r.slug === 't2').id
})

afterAll(async () => {
  await owner.end()
  await pool.end()
})

describe('unauthenticated', () => {
  it('cannot list, create or rename', async () => {
    expect((await list('t1')).status).toBe(401)
    expect((await create('t1', undefined, { name: 'x' })).status).toBe(401)
    expect((await rename('t1', t1ProjectId, undefined, { name: 'x' })).status).toBe(401)
  })
})

describe('missing and forbidden look the same', () => {
  it('a tenant that exists but is not yours matches one that does not exist', async () => {
    const forbidden = await list('t2', 'roberto@tenantdesk.test')
    const missing = await list('no-such-tenant', 'roberto@tenantdesk.test')
    expect([forbidden.status, await forbidden.json()]).toEqual([missing.status, await missing.json()])
  })

  it("another tenant's project id matches a random id", async () => {
    const other = await rename('t1', t2ProjectId, 'roberto@tenantdesk.test', { name: 'x' })
    const random = await rename('t1', '00000000-0000-4000-8000-000000000000', 'roberto@tenantdesk.test', { name: 'x' })
    expect([other.status, await other.json()]).toEqual([random.status, await random.json()])
  })
})

describe('cross-tenant', () => {
  it('Roberto (t1) cannot read t2', async () => {
    const res = await list('t2', 'roberto@tenantdesk.test')
    expect(res.status).toBe(404)
  })

  it("Roberto only sees t1 projects in t1", async () => {
    const res = await list('t1', 'roberto@tenantdesk.test')
    const { projects } = await res.json()
    expect(projects.map((p: { id: string }) => p.id)).toContain(t1ProjectId)
    expect(projects.map((p: { id: string }) => p.id)).not.toContain(t2ProjectId)
  })

  it("Roberto cannot rename a t2 project, through the t2 URL or the t1 URL", async () => {
    expect((await rename('t2', t2ProjectId, 'roberto@tenantdesk.test', { name: 'pwned' })).status).toBe(404)
    expect((await rename('t1', t2ProjectId, 'roberto@tenantdesk.test', { name: 'pwned' })).status).toBe(404)
    expect(await projectName(t2ProjectId)).toBe('Other tenant')
  })

  it('Patrick (t2 admin) cannot create in t1', async () => {
    expect((await create('t1', 'patrick@tenantdesk.test', { name: `patrick-${run}` })).status).toBe(404)
    const { rowCount } = await owner.query(`SELECT 1 FROM project WHERE name = $1`, [`patrick-${run}`])
    expect(rowCount).toBe(0)
  })
})

describe('viewer', () => {
  it('can read', async () => {
    expect((await list('t1', 'caio@tenantdesk.test')).status).toBe(200)
  })

  it('cannot create or rename, and nothing is written', async () => {
    expect((await create('t1', 'caio@tenantdesk.test', { name: `caio-${run}` })).status).toBe(403)
    expect((await rename('t1', t1ProjectId, 'caio@tenantdesk.test', { name: `caio-${run}` })).status).toBe(403)
    const { rowCount } = await owner.query(`SELECT 1 FROM project WHERE name = $1`, [`caio-${run}`])
    expect(rowCount).toBe(0)
  })
})

describe('editor', () => {
  it('can create and rename', async () => {
    const res = await create('t1', 'gustavo@tenantdesk.test', { name: `Gustavo ${run}` })
    expect(res.status).toBe(201)
    const { id } = await res.json()
    expect((await rename('t1', id, 'gustavo@tenantdesk.test', { name: `Gustavo v2 ${run}` })).status).toBe(200)
  })
})

describe('invalid input', () => {
  it('is rejected with 400', async () => {
    for (const body of [{}, { name: '' }, { name: '   ' }, { name: 'x'.repeat(81) }, { name: 42 }]) {
      expect((await create('t1', 'roberto@tenantdesk.test', body)).status).toBe(400)
    }
  })

  it('is rejected with 400 on rename too, and the name is unchanged', async () => {
    for (const body of [{}, { name: '' }, { name: 'x'.repeat(81) }, { name: 42 }]) {
      expect((await rename('t1', t1ProjectId, 'roberto@tenantdesk.test', body)).status).toBe(400)
    }
    expect(await projectName(t1ProjectId)).toBe('Old')
  })

  it('a malformed project id is 404, not 500', async () => {
    expect((await rename('t1', 'not-a-uuid', 'roberto@tenantdesk.test', { name: 'x' })).status).toBe(404)
  })

  it('a duplicate name in the same tenant is 409', async () => {
    expect((await create('t1', 'roberto@tenantdesk.test', { name: 'old' })).status).toBe(409)
  })

  it('names are unique per tenant, not globally', async () => {
    const name = `Shared ${run}`
    expect((await create('t1', 'roberto@tenantdesk.test', { name })).status).toBe(201)
    expect((await create('t2', 'patrick@tenantdesk.test', { name })).status).toBe(201)
  })
})

describe('atomic write', () => {
  it('if the audit insert fails, the project is not created', async () => {
    const name = `Atomic ${run}`
    await owner.query(`REVOKE INSERT ON audit_entry FROM app_user`)
    try {
      expect((await create('t1', 'roberto@tenantdesk.test', { name })).status).not.toBe(201)
    } finally {
      await owner.query(`GRANT INSERT ON audit_entry TO app_user`)
    }
    const { rowCount } = await owner.query(`SELECT 1 FROM project WHERE name = $1`, [name])
    expect(rowCount).toBe(0)
  })
})

describe('authorized write', () => {
  it('creates and renames, each with its audit entry', async () => {
    const res = await create('t1', 'roberto@tenantdesk.test', { name: `  Roadmap ${run}  ` })
    expect(res.status).toBe(201)
    const project = await res.json()
    expect(project.name).toBe(`Roadmap ${run}`)

    const renamed = await rename('t1', project.id, 'roberto@tenantdesk.test', { name: `Roadmap v2 ${run}` })
    expect(renamed.status).toBe(200)
    expect(await projectName(project.id)).toBe(`Roadmap v2 ${run}`)

    const { rows } = await owner.query(
      `SELECT a.action, a.detail, t.slug, u.email FROM audit_entry a
       JOIN tenant t ON t.id = a.tenant_id JOIN "user" u ON u.id = a.actor_user_id
       WHERE a.project_id = $1 ORDER BY a.id`,
      [project.id],
    )
    expect(rows).toEqual([
      { action: 'project.create', detail: { name: `Roadmap ${run}` }, slug: 't1', email: 'roberto@tenantdesk.test' },
      { action: 'project.rename', detail: { from: `Roadmap ${run}`, to: `Roadmap v2 ${run}` }, slug: 't1', email: 'roberto@tenantdesk.test' },
    ])
  })
})

// the second layer: even if the app's checks were skipped, Postgres refuses as app_user
describe('row-level security as app_user', () => {
  async function asApp<T>(settings: Record<string, string>, fn: (c: pg.PoolClient) => Promise<T>) {
    const c = await pool.connect()
    try {
      await c.query('BEGIN')
      for (const [k, v] of Object.entries(settings)) await c.query(`SELECT set_config($1, $2, true)`, [k, v])
      return await fn(c)
    } finally {
      await c.query('ROLLBACK')
      c.release()
    }
  }
  const ids = async (email: string) => {
    const { rows } = await owner.query(
      `SELECT u.id AS "userId", (SELECT id FROM tenant WHERE slug = 't1') AS t1, (SELECT id FROM tenant WHERE slug = 't2') AS t2
       FROM "user" u WHERE u.email = $1`,
      [email],
    )
    return rows[0]
  }

  it('no tenant set returns nothing', async () => {
    const { rowCount } = await asApp({}, (c) => c.query(`SELECT * FROM project`))
    expect(rowCount).toBe(0)
  })

  it("Roberto setting t2 as the tenant still sees nothing", async () => {
    const a = await ids('roberto@tenantdesk.test')
    const { rowCount } = await asApp({ 'app.user_id': a.userId, 'app.tenant_id': a.t2 }, (c) => c.query(`SELECT * FROM project`))
    expect(rowCount).toBe(0)
  })

  it('a viewer insert is refused by the database', async () => {
    const v = await ids('caio@tenantdesk.test')
    await expect(
      asApp({ 'app.user_id': v.userId, 'app.tenant_id': v.t1 }, (c) =>
        c.query(`INSERT INTO project (tenant_id, name) VALUES ($1, 'sneaky')`, [v.t1]),
      ),
    ).rejects.toThrow(/row-level security/)
  })

  it('a viewer update is refused by the database', async () => {
    const v = await ids('caio@tenantdesk.test')
    const { rowCount } = await asApp({ 'app.user_id': v.userId, 'app.tenant_id': v.t1 }, (c) =>
      c.query(`UPDATE project SET name = 'sneaky' WHERE tenant_id = $1`, [v.t1]),
    )
    expect(rowCount).toBe(0)
    expect(await projectName(t1ProjectId)).toBe('Old')
  })

  it('audit entries cannot be changed by the app', async () => {
    const a = await ids('roberto@tenantdesk.test')
    await expect(
      asApp({ 'app.user_id': a.userId, 'app.tenant_id': a.t1 }, (c) => c.query(`DELETE FROM audit_entry`)),
    ).rejects.toThrow(/permission denied/)
  })
})
