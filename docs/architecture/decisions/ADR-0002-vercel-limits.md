# ADR-0002 — Vercel Hobby limits

## Status

- **VERIFIED**: Vercel Function max duration on Hobby with Fluid Compute / current function configuration is 300 seconds.
- **VERIFIED**: Request/response body size limit is 4.5 MB.
- **VERIFIED**: Hobby cron is restricted to one fire per day.
- **VERIFIED**: Vercel Workflows is available on Hobby with 50,000 events/month and 1 GB data written.
- **NEEDS_VERIFICATION**: Exact Workflow Data Retention period on Hobby (check at deployment against official Vercel docs).

## Sources

- Vercel Hobby plan: https://vercel.com/docs/plans/hobby
- Vercel Functions limitations: https://vercel.com/docs/functions/limitations
- Vercel function duration: https://vercel.com/docs/functions/configuring-functions/duration
- Vercel cron docs: https://vercel.com/docs/cron-jobs
- Vercel cron frequency note (third-party illustration only): https://cronpreview.com/guides/vercel-cron-hobby-vs-pro
- Vercel Workflows pricing: https://vercel.com/docs/workflows/pricing
- Vercel Workflows overview: https://vercel.com/docs/workflows

## Important caveats

- The 300-second function duration depends on Fluid Compute / current function configuration. Re-verify at deployment.
- Cron minimum frequency on Hobby is once per day. Third-party sources are used only for illustration; verify with `vercel.json` at deploy time.
- Vercel Workflows retention: the official page lists paid retention; the exact Hobby retention period should be confirmed from the Vercel dashboard/docs at deployment. This does not affect architecture because Postgres is authoritative state.

## Implications

- `vercel.json` must use a single daily cron schedule (`0 3 * * *`).
- The daily cron enqueues both `EDA_SYNC` and `MAINTENANCE` jobs.
- Functions that run ingestion or workflow steps must cap at `maxDuration: 300`.
- Read-only functions can use `maxDuration: 60` to reduce exposure.
- 4.5 MB body limit makes Supabase Storage the only path for large CSV uploads.
- Vercel Workflows budget must be tracked against 50,000 events/month; later demo must include an events-per-month estimate.
- Postgres remains authoritative job/business state.
