import { toNextJsHandler } from 'better-auth/next-js'
import { auth } from '@/lib/auth'

// Every /api/auth/* endpoint (sign-up, sign-in, session, sign-out) is served by Better Auth.
export const { GET, POST } = toNextJsHandler(auth)
