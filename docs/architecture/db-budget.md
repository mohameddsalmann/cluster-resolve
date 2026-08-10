# Database size budget

## Constraint

Supabase Free tier: **500 MB database size per project**.

## Target

Keep the candidate demo database **≤ 250 MB**.

## Strategy

- Use small, deterministic demo datasets.
- Large synthetic or performance-scale tests run as pure TypeScript/local tests where possible.
- DB size telemetry is added later.
- Warn when approaching 250–300 MB; do not hard-block writes in Phase 2.

## Assumptions for candidate demo

- Reference data: EPTTS rule versions, ingestion_sources, policy_versions (~1 MB).
- EDA archived notices: extracted text only, source PDFs in Supabase Storage (~5 MB).
- CSV imports: source files stored in Supabase Storage; DB retains only parsed rows and summaries.
- Demo org: small data set (≤ 1,000 orders, ≤ 5,000 order items, ≤ 6 months of rollups).
- Raw job logs, audit events, and rollups use short retention (30–90 days).

## Rough projection

| Table / category | Estimated rows | Avg row bytes | Total |
|---|---:|---:|---:|
| Reference data | 500 | 2 KB | 1 MB |
| Organizations/members | 50 | 1 KB | 0.05 MB |
| Products, suppliers, pharmacies | 500 | 2 KB | 1 MB |
| Orders + items + offers + outcomes | 10,000 | 1 KB | 10 MB |
| Raw events (30 days) | 10,000 | 0.5 KB | 5 MB |
| Ingestion errors + idempotency keys | 10,000 | 0.5 KB | 5 MB |
| Job logs (30 days) | 20,000 | 0.5 KB | 10 MB |
| Audit events (90 days) | 20,000 | 0.5 KB | 10 MB |
| Supplier metrics rollups (6 months) | 10,000 | 1 KB | 10 MB |
| Forecasts/alert rollups | 2,000 | 1 KB | 2 MB |
| Indexes/overhead | — | — | ~10 MB |
| **Total** | | | **~65 MB** |

## Budget guards

- Target: ≤ 250 MB.
- Warn: at ~300 MB.
- Supabase Free limit: 500 MB.
- Demo seed must refuse to run in `production`.
- Use native `pg_dump` (if installed) before risky operations.

## Status

- **VERIFIED**: Supabase Free is 500 MB.
- **ESTIMATED**: projection is a rough order-of-magnitude; actual sizes depend on row width and index choices.
