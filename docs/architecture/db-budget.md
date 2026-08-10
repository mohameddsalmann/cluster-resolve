# Database size budget

## Constraint

Supabase Free tier: **500 MB database size per project**.

## Target

Keep the demo/development database ≤ 250–300 MB with ≥ 40% headroom.

## Assumptions

- Reference data: EPTTS rule versions, ingestion_sources, policy_versions (~1 MB).
- EDA archived notices: 10–20 PDFs; extracted text stored, not raw PDFs (~5 MB).
- CSV imports: retained as `ingestion_errors` and `raw_events` summaries; source files live in Supabase Storage, not DB.
- User-imported data: 1,000–5,000 orders per test org in the worst case.
- Business table rows per test org: products (~100), suppliers (~50), pharmacies (~50), orders (~5,000), order_items (~20,000), offers (~10,000), outcomes (~5,000).
- Rollups (`supplier_daily_metrics`, `supplier_window_metrics`, `ops_daily_stats`) are the main size drivers.
- Retention rule: rollups kept for 2 years; raw job logs retained for 30 days; audit events retained for 1 year.

## Rough projection

| Table / category | Estimated rows | Avg row bytes | Total |
|---|---:|---:|---:|
| Reference data | 500 | 2 KB | 1 MB |
| Organizations/members | 50 | 1 KB | 0.05 MB |
| Products, suppliers, pharmacies | 500 | 2 KB | 1 MB |
| Orders + items + offers + outcomes | 100,000 | 1 KB | 100 MB |
| Raw events (30 days) | 50,000 | 0.5 KB | 25 MB |
| Ingestion errors + idempotency keys | 50,000 | 0.5 KB | 25 MB |
| Job logs (30 days) | 100,000 | 0.5 KB | 50 MB |
| Audit events (1 year) | 100,000 | 0.5 KB | 50 MB |
| Supplier metrics rollups (2 years) | 50,000 | 1 KB | 50 MB |
| Forecasts/alert rollups | 10,000 | 1 KB | 10 MB |
| Indexes/overhead | — | — | ~50 MB |
| **Total** | | | **~360 MB** |

## Budget guards

- `DB_BUDGET_WARN_PCT=70` (warn at 350 MB)
- `DB_BUDGET_BLOCK_PCT=85` (stop writes at 425 MB)
- Demo seed must refuse to run in `production`.
- `pnpm db:dump` before risky migrations and before demos.

## Status

- **VERIFIED**: Supabase Free is 500 MB.
- **ESTIMATED**: projection is a rough order-of-magnitude; actual sizes depend on row width and index choices to be measured in Phase 3–5.
