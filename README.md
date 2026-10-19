# Multi-tenant app

Next.js 15 (App Router) · React 19 · TypeScript · Node · PostgreSQL (Neon in production) · Better Auth.

## Run locally

```bash
cp .env.example .env          # then set BETTER_AUTH_SECRET
docker compose up -d          # Postgres 17 on :5566
pnpm install
pnpm db:migrate               # creates app_user, auth tables, migrations, grants
pnpm dev                      # http://localhost:3000/sign-in
pnpm test
```

## Provenance

Prepared **before** the assessment clock started (a clean framework and auth starter, no feature code):

- `create-next-app` (TypeScript, App Router, Tailwind, ESLint), plus `pg`, `zod`, `vitest`.
- Better Auth email + password: `src/lib/auth.ts`, `src/lib/auth-client.ts`, `src/app/api/auth/[...all]`, a minimal `/sign-in` page and the signed-in home page.
- `src/lib/db.ts` (one `pg` pool as `app_user`) and `db/migrate.mjs` (owner-run migrations and grants).
- Local Postgres via `docker-compose.yml`. A Neon project with a restricted `app_user` role (no superuser, no `BYPASSRLS`); RLS behaviour over the pooled connection was checked with a throwaway table, since dropped.
- `CLAUDE.md` (the working standard) and an empty `PROMPTS.md`.

Everything else, including every tenant table, policy, action, page and test, was built during the assessment and is logged in [PROMPTS.md](PROMPTS.md). The git history shows the boundary: every commit before the first feature commit is setup.
