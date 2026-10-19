import type { PoolClient } from 'pg'
import { z } from 'zod'
import { pool } from './db'

export type Role = 'admin' | 'editor' | 'viewer'
export type Project = { id: string; name: string; createdAt: string; updatedAt: string }
type Ctx = { client: PoolClient; tenantId: string; tenantName: string; role: Role }

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

const projectInput = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80, 'Name must be 80 characters or fewer'),
})
const projectId = z.uuid()

const canWrite = (role: Role) => role === 'admin' || role === 'editor'

// one transaction with app.user_id set, so RLS sees who is asking
async function tx<T>(userId: string, fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(`SELECT set_config('app.user_id', $1, true)`, [userId])
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (e) {
    await client.query('ROLLBACK')
    throw toHttpError(e)
  } finally {
    client.release()
  }
}

// The tenant slug is only a request: it resolves only through the user's own membership.
// Missing and forbidden tenants both give 404.
function inTenant<T>(userId: string, slug: string, fn: (ctx: Ctx) => Promise<T>): Promise<T> {
  return tx(userId, async (client) => {
    const { rows } = await client.query<{ id: string; name: string; role: Role }>(
      `SELECT t.id, t.name, m.role FROM tenant t JOIN membership m ON m.tenant_id = t.id
       WHERE t.slug = $1 AND m.user_id = $2`,
      [slug, userId],
    )
    if (!rows[0]) throw new HttpError(404, 'Not found')
    await client.query(`SELECT set_config('app.tenant_id', $1, true)`, [rows[0].id])
    return fn({ client, tenantId: rows[0].id, tenantName: rows[0].name, role: rows[0].role })
  })
}

function toHttpError(e: unknown): unknown {
  if (e instanceof HttpError) return e
  const code = (e as { code?: string }).code
  if (code === '23505') return new HttpError(409, 'A project with that name already exists')
  if (code === '42501') return new HttpError(403, 'You can only read projects in this organization')
  return e
}

const select = `SELECT id, name, created_at AS "createdAt", updated_at AS "updatedAt" FROM project`

export function listMyTenants(userId: string) {
  return tx(userId, async (client) => {
    const { rows } = await client.query<{ slug: string; name: string; role: Role }>(
      `SELECT t.slug, t.name, m.role FROM membership m JOIN tenant t ON t.id = m.tenant_id
       WHERE m.user_id = $1 ORDER BY t.name`,
      [userId],
    )
    return rows
  })
}

export function listProjects(userId: string, slug: string) {
  return inTenant(userId, slug, async ({ client, tenantId, tenantName, role }) => {
    const { rows } = await client.query<Project>(
      `${select} WHERE tenant_id = $1 ORDER BY created_at DESC, id LIMIT 100`,
      [tenantId],
    )
    return { tenantName, role, projects: rows }
  })
}

export function createProject(userId: string, slug: string, input: unknown) {
  return inTenant(userId, slug, async ({ client, tenantId, role }) => {
    if (!canWrite(role)) throw new HttpError(403, 'You can only read projects in this organization')
    const { name } = parse(projectInput, input)
    const { rows } = await client.query<Project>(
      `INSERT INTO project (tenant_id, name) VALUES ($1, $2)
       RETURNING id, name, created_at AS "createdAt", updated_at AS "updatedAt"`,
      [tenantId, name],
    )
    // same transaction as the insert: both commit or neither does
    await audit(client, tenantId, userId, 'project.create', rows[0].id, { name })
    return rows[0]
  })
}

export function renameProject(userId: string, slug: string, id: string, input: unknown) {
  return inTenant(userId, slug, async ({ client, tenantId, role }) => {
    if (!canWrite(role)) throw new HttpError(403, 'You can only read projects in this organization')
    if (!projectId.safeParse(id).success) throw new HttpError(404, 'Not found')
    const { name } = parse(projectInput, input)
    const { rows } = await client.query<Project & { oldName: string }>(
      `UPDATE project p SET name = $3, updated_at = now()
       FROM (SELECT id, name FROM project WHERE id = $1 AND tenant_id = $2 FOR UPDATE) old
       WHERE p.id = old.id
       RETURNING p.id, p.name, p.created_at AS "createdAt", p.updated_at AS "updatedAt", old.name AS "oldName"`,
      [id, tenantId, name],
    )
    if (!rows[0]) throw new HttpError(404, 'Not found')
    const { oldName, ...project } = rows[0]
    if (oldName !== name) await audit(client, tenantId, userId, 'project.rename', project.id, { from: oldName, to: name })
    return project
  })
}

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const r = schema.safeParse(input)
  if (!r.success) throw new HttpError(400, r.error.issues[0]?.message ?? 'Invalid input')
  return r.data
}

async function audit(client: PoolClient, tenantId: string, userId: string, action: string, projectId: string, detail: object) {
  await client.query(
    `INSERT INTO audit_entry (tenant_id, actor_user_id, action, project_id, detail) VALUES ($1, $2, $3, $4, $5)`,
    [tenantId, userId, action, projectId, JSON.stringify(detail)],
  )
}
