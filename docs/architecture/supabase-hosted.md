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
DATABASE_URL=postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres
DIRECT_URL=postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres
SUPABASE_DEVELOPMENT_MODE=HOSTED_DEV
LOCAL_SUPABASE_DISABLED=true
DOCKER_REQUIRED=false
```

Never commit `.env.local`.

## Phase 1 verification

Phase 1 verified:
- Supabase CLI v2.109.1 installed
- Provided project URL reachable (`https://gcqcbrcmfequnuprrzqc.supabase.co`)
- Auth endpoint reachable (`/auth/v1/health` → 200)
- Storage buckets endpoint reachable with a valid Authorization header (`/storage/v1/bucket` → 200)

Unverified / Phase 0 blocker:
- CLI `supabase link --project-ref gcqcbrcmfequnuprrzqc` failed with
  `"Your account does not have the necessary privileges to access this endpoint"`.
  The current Supabase CLI token does not have access to the supplied project.
  This is a Phase 0 finding, not a Phase 1 code defect.

## Phase 2 workflow

1. Confirm the linked project ref is the DEV project.
2. `supabase db push --dry-run` against DEV.
3. `supabase db push` to apply `supabase/migrations/`.
4. `supabase gen types typescript --project-id <ref>` into `apps/web/lib/db/generated-types.ts`.
5. Run RLS/auth integration tests against the DEV project.

Production Supabase and Vercel are not connected until the deployment phase.
