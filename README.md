# TenantDesk

A tiny multi-tenant project tracker. Next.js 15 (App Router) · React 19 · TypeScript · Node · PostgreSQL (Neon in production) · Better Auth.

## Run locally

```bash
cp .env.example .env          # set BETTER_AUTH_SECRET and SEED_PASSWORD
docker compose up -d          # Postgres 17 on :5566
pnpm install
pnpm db:migrate               # app_user role, auth tables, db/migrations/*.sql, grants
pnpm db:seed                  # two tenants, three users, memberships, one project each
pnpm dev                      # http://localhost:3000/sign-in
pnpm test                     # integration tests against the real database
```

## Test logins

All four share the password given privately to the reviewer (`SEED_PASSWORD`, never committed).

| User | Tenant 1 (`/t/t1`) | Tenant 2 (`/t/t2`) |
|---|---|---|
| `roberto@tenantdesk.test` | admin | — |
| `patrick@tenantdesk.test` | — | admin |
| `caio@tenantdesk.test` | viewer | — |
| `gustavo@tenantdesk.test` | editor | — |

Seeded projects: "Old" in t1, "Other tenant" in t2.

Public sign-up is disabled; accounts exist only through `db/seed.mjs`.

## How isolation works

- **Identity** comes from the Better Auth session cookie, resolved on the server (`auth.api.getSession`). No session, 401.
- **The tenant in the URL is a request.** `/t/[slug]` and `/api/t/[slug]/...` resolve the slug only through the caller's own membership row. Not a member, 404, the same as a tenant that doesn't exist.
- **Both layers, on purpose.** The app checks membership and role and filters by `tenant_id`. Postgres RLS (`ENABLE` + `FORCE`) checks again: each transaction sets `app.user_id` and `app.tenant_id` with `set_config(..., true)`, and the policies require the active tenant *and* a membership for that user, with role `admin`/`editor` for writes. A viewer write is refused by the database even if the app check were removed. The app connects as `app_user`, which has no `BYPASSRLS` and owns nothing.
- **Atomic audit.** Each create/rename and its `audit_entry` row run in one transaction. `audit_entry` references `(tenant_id, project_id)`, so it can't point across tenants, and the app has no `UPDATE`/`DELETE` on it.
- **Tenant-aware constraints and indexes.** Project names are unique per tenant (`(tenant_id, lower(name))`); lists use `(tenant_id, created_at DESC, id)`.

## API

| Method | Path | Who |
|---|---|---|
| `GET` | `/api/t/:slug/projects` | any member |
| `POST` | `/api/t/:slug/projects` `{ name }` | admin, editor |
| `PATCH` | `/api/t/:slug/projects/:id` `{ name }` | admin, editor |

Status codes: 401 not signed in, 404 not a member / not found, 403 viewer write, 400 invalid input, 409 duplicate name.

## Limitations

- No pagination beyond the first 100 projects, no delete, no audit history view.
- Tests run serially against one shared, seeded database; they add projects with run-unique names and don't clean up.

## Provenance

Prepared **before** the assessment clock started (a clean framework and auth starter, no feature code):

- `create-next-app` (TypeScript, App Router, Tailwind, ESLint), plus `pg`, `zod`, `vitest`.
- Better Auth email + password: `src/lib/auth.ts`, `src/lib/auth-client.ts`, `src/app/api/auth/[...all]`, a minimal `/sign-in` page and the signed-in home page.
- `src/lib/db.ts` (one `pg` pool as `app_user`) and `db/migrate.mjs` (owner-run migrations and grants).
- Local Postgres via `docker-compose.yml`. A Neon project with a restricted `app_user` role (no superuser, no `BYPASSRLS`); RLS behaviour over the pooled connection was checked with a throwaway table, since dropped.
- `CLAUDE.md` (the working standard) and an empty `PROMPTS.md`.

Everything else, including every tenant table, policy, route, page and test, was built during the assessment.
