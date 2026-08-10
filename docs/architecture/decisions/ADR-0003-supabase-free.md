# ADR-0003 — Supabase Free tier and Docker-free development

## Status

- **VERIFIED**: Supabase Free tier limits.
- **VERIFIED**: Docker-free development uses hosted DEV Supabase.
- **VERIFIED**: CLI `supabase link --project-ref gcqcbrcmfequnuprrzqc` succeeds.
- **VERIFIED**: `supabase db push --dry-run` reports "Remote database is up to date."

## Supabase Free tier limits

| Resource | Free tier |
|---|---|
| Database size | 500 MB |
| Storage | 1 GB |
| Egress | 5 GB + 5 GB cached |
| Monthly active users | 50,000 |
| Edge Function invocations | 500,000 |
| Realtime messages | 2 million |
| Realtime peak connections | 200 |
| Backups | None (Supabase-managed daily backups are a paid feature) |
| PITR | Not available |
| Branching | Not available |
| Pausing | After 1 week of inactivity |
| Active projects | 2 per organization |

## Sources

- Supabase pricing: https://supabase.com/pricing
- Supabase backups docs: https://supabase.com/docs/guides/platform/backups
- Supabase billing/usage: https://supabase.com/docs/guides/platform/billing-on-supabase
- Supabase Cron: https://supabase.com/features/supabase-cron
- Supabase Vault: https://supabase.com/features/vault
- `pg_cron` availability on Supabase: https://supabase.com/features/supabase-cron

## Docker-free architecture

- `SUPABASE_DEVELOPMENT_MODE=HOSTED_DEV`
- `LOCAL_SUPABASE_DISABLED=true`
- `DOCKER_REQUIRED=false`
- Development uses a hosted Supabase Free DEV project.
- Production will use a separate hosted Free project, created later.
- No `supabase start`, no Docker, no Podman, no Rancher.

## Backups

- Production backup automation is deferred.
- `supabase db dump` is NOT used (it invokes `pg_dump` through a container and violates the no-Docker architecture).
- If a manual logical dump is needed, use a native locally installed PostgreSQL `pg_dump` binary against the appropriate direct database connection (`DIRECT_URL` from `.env.local`).
- Never commit dump files.
- Do not install Docker.

## Inactivity / keep-alive

- Free projects may pause after 7 days of inactivity.
- No external keep-alive service or third-party scheduler is added solely to prevent pausing.
- Demo readiness procedure: before a demo, verify the DEV/PROD project is awake, run health checks, warm required data, and verify Storage/Auth/DB.
- `pg_cron` + `pg_net` are available on Free and may be used later for a recovery watchdog when there are real background jobs to protect. The 15-minute watchdog is NOT implemented in Phase 2.

## Implications

- DB budget target is ≤ 250 MB with 50% headroom on the 500 MB Free limit (see `db-budget.md`).
- Migrations are the source of truth; no Dashboard SQL Editor for schema changes.
- Backups are manual and optional until a paid plan or backup provider is adopted.
