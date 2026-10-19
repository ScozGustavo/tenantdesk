import { body, handle } from '@/lib/api'
import { renameProject } from '@/lib/projects'

type Params = { params: Promise<{ slug: string; id: string }> }

export async function PATCH(req: Request, { params }: Params) {
  const { slug, id } = await params
  return handle(req, async (userId) => renameProject(userId, slug, id, await body(req)))
}
