# ADR-0002 — Vercel Hobby limits

## Status

- **VERIFIED**: Vercel Function max duration on Hobby is 300 seconds.
- **VERIFIED**: Request/response body size limit is 4.5 MB.
- **VERIFIED**: Hobby cron is restricted to one fire per day.
- **VERIFIED**: Vercel Workflows is available on Hobby with 50,000 events/month and 1 GB data written.
- **VERIFIED**: Workflow Data Retention on Hobby is 1 day after run completion.

## Sources

- Vercel Hobby plan: https://vercel.com/docs/plans/hobby
- Vercel Functions limitations: https://vercel.com/docs/functions/limitations
- Vercel function duration: https://vercel.com/docs/functions/configuring-functions/duration
- Vercel cron Hobby limits (third-party guide): https://cronpreview.com/guides/vercel-cron-hobby-vs-pro
- Vercel Workflows pricing: https://vercel.com/docs/workflows/pricing
- Vercel Workflows overview: https://vercel.com/docs/workflows

## Implications

- `vercel.json` must use a single daily cron schedule (`0 3 * * *`).
- The daily cron enqueues both `EDA_SYNC` and `MAINTENANCE` jobs.
- Functions that run ingestion or workflow steps must cap at `maxDuration: 300`.
- Read-only functions can use `maxDuration: 60` to reduce exposure.
- 4.5 MB body limit makes Supabase Storage the only path for large CSV uploads.
- Vercel Workflows budget must be tracked against 50,000 events/month; later demo must include an events-per-month estimate.
