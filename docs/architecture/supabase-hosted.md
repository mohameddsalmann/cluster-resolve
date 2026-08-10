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
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<server-only-service-role>
SUPABASE_PROJECT_REF=<project-ref>

# Serverless runtime / Shared Pooler (Supavisor TRANSACTION mode)
DATABASE_URL=postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true

# Migrations and native PostgreSQL tools (direct IPv6 endpoint, may not work from all serverless runtimes)
DIRECT_URL=postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres

SUPABASE_DEVELOPMENT_MODE=HOSTED_DEV
LOCAL_SUPABASE_DISABLED=true
DOCKER_REQUIRED=false
```

Never commit `.env.local`.

## Connection notes

- **DATABASE_URL** must use the Supabase Shared Pooler / Supavisor `TRANSACTION` mode endpoint on port 6543. Copy the exact `DATABASE_URL` from Supabase Dashboard > Connect > Node.js/Postgres. Do not invent region/hostname.
- **DIRECT_URL** is the direct Postgres endpoint on port 5432. Free-tier direct endpoints are IPv6 by default. They may not be reachable from Vercel/serverless runtimes or older network stacks. Use `DATABASE_URL` for the application.

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
- Manual logical dumps, when needed, use a native locally installed `pg_dump` binary against `DIRECT_URL`.
- Never commit dumps.
- Do not install Docker.

## Inactivity / keep-alive

- Free projects may pause after 7 days of inactivity.
- No external keep-alive service is added.
- Use the founder/demo readiness procedure to wake and verify the project before a demo.
- `pg_cron` watchdog is a LATER recovery feature, not Phase 2.

## Phase 2 workflow

1. Confirm the linked project ref is the DEV project.
2. `supabase db push --dry-run` against DEV.
3. `supabase db push` to apply `supabase/migrations/`.
4. `supabase gen types typescript --project-id <ref>` into `apps/web/lib/db/generated-types.ts`.
5. Run RLS/auth integration tests against the DEV project.

Production Supabase and Vercel are not connected until the deployment phase.
