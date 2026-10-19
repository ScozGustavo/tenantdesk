# CLAUDE.md

Read this first, every session. It is the standard for this repo.

## What this is

A multi-tenant Next.js app on Postgres. Tenant isolation is the property that matters most: a user of one tenant must never read or change another tenant's data, and that has to hold under an adversarial test, not just in the happy path. The starter (auth, database, migrations) existed before the feature work; see [README.md](README.md#provenance).

## Layout

- `src/app` — App Router pages, Server Actions and route handlers. `api/auth/[...all]` is Better Auth.
- `src/lib/db.ts` — the one `pg` pool, connected as the restricted `app_user`.
- `src/lib/auth.ts` / `auth-client.ts` — Better Auth (email + password, sessions in Postgres).
- `db/migrate.mjs` — runs as the owner: Better Auth tables, then `db/migrations/*.sql` in order (each once, in a transaction), then grants to `app_user`.
- `PROMPTS.md` — the build log: acceptance criteria, prompts, corrections, verification evidence.

## Standards (non-negotiable)

- **Strict TypeScript.** No `any` at a trust boundary; a cast is not validation.
- **Validate at the boundary.** Every Server Action and route handler parses its input with `zod` before use.
- **Identity and tenant come from the session**, via `auth.api.getSession({ headers })`. Never from the request body, a query string or a URL segment the caller controls.
- **Authorize every mutation server-side**, inside the action or handler itself. A page check or a hidden button is not authorization.
- **Tenant isolation in two layers.** Every query filters by `tenant_id`, **and** every tenant table has row-level security, `ENABLE` and `FORCE`, with a policy on `current_setting('app.tenant_id', true)`. Set the tenant per transaction: `BEGIN; SELECT set_config('app.tenant_id', $1, true); …; COMMIT`. Never a session-level `SET`: the production pooler is transaction-mode and would leak it to the next client.
- **The app connects only as `app_user`** (no superuser, no `BYPASSRLS`, owns nothing). The table owner bypasses RLS unless forced; `DATABASE_OWNER_URL` is for `db/migrate.mjs` only.
- **Missing and forbidden look the same.** A record in another tenant returns the same 404 as one that does not exist.
- **Plain SQL with `pg`, parameterized** (`$1`), never string-built. Schema changes go in a new `db/migrations/NNNN-name.sql`, never by hand.
- **Races are settled by the database**: unique constraints and transactions, not check-then-write.
- **Honest `.env.example`.** Every key documented, no real secrets. Never print or commit `.env`.

## Testing floor

- **Mandatory:** integration tests for tenant isolation, run as `app_user` against a real Postgres: two tenants with distinct users; cross-tenant read, update and delete must fail; no tenant set must return nothing.
- Unit tests for non-trivial logic: authorization rules, validation edges.
- UI glue may go untested. Test where a bug leaks a tenant or loses data.

## How work lands

1. **Acceptance criteria first**, numbered, in `PROMPTS.md`, including at least one cross-tenant attack. Agree on them before writing code.
2. **Narrowest vertical slice** that meets them: one migration, one server path, one page.
3. **Verify**: tests green, plus the slice driven in a real browser. Read the diff before moving on.
4. **Log it**: each prompt, each correction to the AI and how it was verified goes in `PROMPTS.md`.
5. **Deploy and prove it**: run migrations on the production database, then smoke-test the live URL (one success, one cross-tenant 404) and record the evidence in `PROMPTS.md`.

Definition of done: build green, tests green, the slice driven end to end locally and on the deployed URL, `PROMPTS.md` up to date.

## Commands

```bash
docker compose up -d   # local Postgres 17 on localhost:5566
pnpm db:migrate        # owner: auth tables, db/migrations/*.sql, grants (idempotent)
pnpm dev               # http://localhost:3000
pnpm test              # vitest
pnpm build             # production build
```

Production: Neon Postgres (`app_user` over the pooled connection), hosted on Railway. Run `pnpm db:migrate` with `DATABASE_OWNER_URL` set to Neon's direct owner URL before each deploy.

## Workspace boundary

This repo sits beside unrelated projects in the parent folder. Never read, edit or run anything outside it, and never open another project's `.env`.
