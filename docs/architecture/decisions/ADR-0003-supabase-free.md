# ADR-0003 — Supabase Free tier and Docker-free development

## Status

- **VERIFIED**: Supabase Free tier limits.
- **VERIFIED**: Docker-free development uses hosted DEV Supabase.
- **UNVERIFIED**: CLI `supabase link` to project ref `gcqcbrcmfequnuprrzqc` fails due to account privileges. Requires the CLI token to be added as a project collaborator or login with the owning account.
- **VERIFIED**: HTTP endpoints reachable — Auth `/auth/v1/health` → 200, Storage `/storage/v1/bucket` → 200 with provided key.

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
| Backups | None (manual `db dump` only) |
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
- `pg_cron`/`pg_net` availability: https://crontap.com/guides/supabase-cron-jobs

## Docker-free architecture

- `SUPABASE_DEVELOPMENT_MODE=HOSTED_DEV`
- `LOCAL_SUPABASE_DISABLED=true`
- `DOCKER_REQUIRED=false`
- Development uses a hosted Supabase Free DEV project.
- Production will use a separate hosted Free project, created later.
- No `supabase start`, no Docker, no Podman, no Rancher.

## Implications

- DB budget must stay ≤ 250–300 MB with ≥ 40% headroom (see `db-budget.md`).
- Migrations are the source of truth; no Dashboard SQL Editor for schema changes.
- `pg_cron` + `pg_net` are available on Free for the 15-minute recovery watchdog.
- Free projects pause after 7 days of inactivity; the watchdog must also be hit by an external keep-alive at least weekly.
- Backups are manual (`supabase db dump` to local `backups/` directory, gitignored).
