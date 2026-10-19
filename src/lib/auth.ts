import { betterAuth } from 'better-auth'
import { nextCookies } from 'better-auth/next-js'
import { pool } from './db'

// Better Auth server instance: email + password, sessions in Postgres.
// The auth tables (user, session, account, verification) sit outside tenant RLS: sign-in has to
// resolve who the user is before any tenant context exists. Tenant data lives in its own tables.
// BETTER_AUTH_SECRET and BETTER_AUTH_URL come from the env (see .env.example).
export const auth = betterAuth({
  database: pool,
  // accounts are seeded by db/seed.mjs; public sign-up is off
  emailAndPassword: { enabled: true, autoSignIn: true, disableSignUp: true },
  plugins: [nextCookies()],
})
