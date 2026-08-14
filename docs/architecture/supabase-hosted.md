# Docker-free Supabase development architecture

## Status

- `SUPABASE_DEVELOPMENT_MODE=HOSTED_DEV`
- `LOCAL_SUPABASE_DISABLED=true`
- `DOCKER_REQUIRED=false`

## Decision

This project does **not** run a local Supabase stack. Docker, Docker Desktop,
Podman, Rancher Desktop, and any other container runtime are intentionally not
used. Disk space is constrained and the development environment is kept
container-free.

## Development topology

```
Windows + Node.js + pnpm + Next.js 16.3
            |
            | HTTPS / Postgres
            v
    Supabase Cloud Free DEV
```

## Tools

- **Supabase CLI** — installed locally (`supabase --version`)
- **Supabase project** — `cluster-control-dev` (or the linked Free project)
- **No local Postgres**
- **No Docker**

## Scripts (root `package.json`)

- `pnpm supabase:link` — link CLI to the DEV project ref
- `pnpm supabase:db:push:check` — `supabase db push --dry-run`
- `pnpm supabase:db:push` — apply migrations to the linked DEV project
- `pnpm supabase:types` — generate TypeScript types from the hosted project

## Not used

```text
supabase start
supabase db start
supabase db reset          # local reset
docker ...
docker compose ...
podman ...
rancher ...
```

## Schema source of truth

All migrations live in `supabase/migrations/` in Git. The Dashboard Table Editor
and SQL Editor are not used for normal schema changes. `supabase db pull` is not
part of the normal workflow because migrations are the source of truth.

## Environment variables (`.env.local`)

```text
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SECRET_KEY=<server-only-sb-secret-key>

# Legacy fallback only when an sb_secret key is unavailable:
# SUPABASE_SERVICE_ROLE_KEY=<server-only-service-role>
```

Never commit `.env.local`.

## Runtime connection notes

- Local Next.js and Vercel use the server-only Supabase JavaScript client and hosted Data API.
- The application does not require a PostgreSQL connection string, local PostgreSQL, or a database password.
- `SUPABASE_SECRET_KEY` must never be exposed through a `NEXT_PUBLIC_` variable or browser client.

## Phase 1 verification

- Supabase CLI v2.109.1 installed
- Project linked to `gcqcbrcmfequnuprrzqc`
- `supabase db push --dry-run` reports "Remote database is up to date"
- Provided project URL reachable (`https://gcqcbrcmfequnuprrzqc.supabase.co`)
- Auth endpoint reachable (`/auth/v1/health` → 200)
- Storage buckets endpoint reachable with a valid Authorization header (`/storage/v1/bucket` → 200)

## Backups

- `supabase db dump` is NOT used because it requires a Docker container.
- Production backup automation is deferred.
- Never commit dumps.
- Do not install Docker.

## Inactivity / keep-alive

- Free projects may pause after 7 days of inactivity.
- No external keep-alive service is added.
- Use the founder/demo readiness procedure to wake and verify the project before a demo.
- No keep-alive watchdog is part of the application architecture.

## Phase 2 workflow

1. Confirm the linked project ref is the DEV project.
2. `supabase db push --dry-run` against DEV.
3. `supabase db push` to apply `supabase/migrations/`.
4. `supabase gen types typescript --project-id <ref>` into `apps/web/lib/db/generated-types.ts`.
5. Run RLS/auth integration tests against the DEV project.

Production Supabase and Vercel are not connected until the deployment phase.
