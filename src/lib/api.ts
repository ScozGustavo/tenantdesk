import { auth } from './auth'
import { HttpError } from './projects'

// Identity comes from the session cookie, resolved on the server. No session, 401.
export async function handle(req: Request, fn: (userId: string) => Promise<unknown>, status = 200) {
  try {
    const session = await auth.api.getSession({ headers: req.headers })
    if (!session) throw new HttpError(401, 'Sign in required')
    return Response.json(await fn(session.user.id), { status })
  } catch (e) {
    if (e instanceof HttpError) return Response.json({ error: e.message }, { status: e.status })
    console.error(e)
    return Response.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

export async function body(req: Request): Promise<unknown> {
  try {
    return await req.json()
  } catch {
    throw new HttpError(400, 'Invalid JSON')
  }
}
