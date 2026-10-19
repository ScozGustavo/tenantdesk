import { body, handle } from '@/lib/api'
import { createProject, listProjects } from '@/lib/projects'

type Params = { params: Promise<{ slug: string }> }

export async function GET(req: Request, { params }: Params) {
  const { slug } = await params
  return handle(req, (userId) => listProjects(userId, slug))
}

export async function POST(req: Request, { params }: Params) {
  const { slug } = await params
  return handle(req, async (userId) => createProject(userId, slug, await body(req)), 201)
}
