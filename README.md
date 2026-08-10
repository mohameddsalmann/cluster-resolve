# Cluster AI Supply Chain Control Tower

> **Unofficial candidate prototype.** Not affiliated with, endorsed by, or connected to Cluster's production systems.

An unofficial, candidate-built reliability/observability layer around pharmaceutical AI procurement decisions, built as one Next.js + TypeScript app on Vercel Hobby with Supabase Postgres, where every displayed metric is traceable back to a persisted source record.

## What this is

A single full-stack Next.js (App Router, TypeScript) application that ingests real data from three explicitly labelled classes of source (live public EDA regulatory data, user-imported anonymized CSV/JSON, clearly-labelled synthetic demo data) and produces deterministic reliability metrics over pharmaceutical procurement:

- AI decision observability and replay
- Procurement regret
- Supplier reliability and drift
- Forecast QA
- Regulatory exposure
- EPTTS Phase-1 preflight validation

## What this is not

We do not rebuild Cluster's marketplace, Clara, procurement UX, forecasting model, or supplier catalogue. We do not claim any connection to Cluster production systems. The Cluster Production Integration source ships permanently as `NOT_CONNECTED / READY_FOR_INTEGRATION`.

## Stack

- **Framework**: Next.js 16 (App Router, TypeScript strict)
- **Database**: Supabase Postgres (Free tier) with RLS on every table
- **Deployment**: Vercel Hobby (one project)
- **Job orchestration**: Vercel Workflows (primary) + pg_cron recovery watchdog (15 min)
- **Monorepo**: pnpm workspaces (no Turborepo)
- **Tests**: Vitest (unit/integration), Playwright (E2E)

## Getting started

```bash
# Install dependencies
pnpm install

# Start local Supabase stack
pnpm supabase:start

# Run migrations
pnpm supabase:db:push

# Start dev server
pnpm dev

# Run CI locally
pnpm ci:local
```

## Project structure

```
apps/web/          — the ONE deployable (Next.js)
packages/core/     — pure domain math (no I/O imports)
packages/schemas/  — Zod contracts
packages/design-tokens/ — brand tokens → CSS vars + Tailwind theme
packages/config/   — shared ESLint, TS, Vitest configs
supabase/          — migrations, seed, tests
fixtures/          — test fixtures (EPTTS, CSV, EDA)
docs/              — architecture, runbooks, API docs
```

## Honesty constraints

- No fake data: every metric is traceable to persisted source rows
- No EPTTS verdict claims an official EDA outcome — it is a prototype preflight
- Unverified rules are displayed separately and never affect the verdict
- Sample data is always bannered
