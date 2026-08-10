# Vercel Workflows events budget

## Constraint

Vercel Hobby Workflows: **50,000 events/month included**, **1 GB data written/month**.

## Pricing

- $0.02 per 1,000 events over 50,000.
- $0.50 per GB data written over 1 GB.

## Retention

- Exact Workflow Data Retention on Hobby is **NEEDS_VERIFICATION** from an official Vercel source at deployment time.
- This does not affect architecture because Postgres is authoritative state.

## Demo workload estimate

Assumptions:
- 1 daily cron run.
- Each run starts one workflow.
- Each workflow processes a batch of ingestion jobs.
- Each job has ~5 steps (enqueue, parse, validate, insert, summarize).
- Each step emits 3 events (start, complete, log).

| Scenario | Daily runs | Jobs/run | Steps/job | Events/step | Events/month |
|---|---:|---:|---:|---:|---:|
| Light (synthetic test) | 1 | 2 | 5 | 3 | ~900 |
| Demo (1 EDA sync + 1 CSV import) | 1 | 5 | 5 | 3 | ~2,250 |
| Stress (weekly benchmark) | 0.14 | 50 | 5 | 3 | ~3,150 |
| Manual re-runs/dev | — | — | — | — | ~2,000 |
| **Total** | | | | | **~8,300** |

## Headroom

- 8,300 / 50,000 ≈ 17% of monthly events budget.
- 50,000 events = ~160 demo runs per month if a single workflow emits 3 events/step × 5 steps × 5 jobs.
- **Conclusion**: comfortably inside the Hobby allowance.

## Mitigations

- Batch work into larger chunks to reduce event count.
- Avoid per-row workflow steps; prefer SQL bulk operations inside a single step.
- Do not use Workflows for high-frequency background polling.
- Monitor Workflows usage in Vercel dashboard.

## Status

- **VERIFIED**: Vercel Workflows Hobby allowance is 50,000 events/month, 1 GB data written, 1-day retention.
