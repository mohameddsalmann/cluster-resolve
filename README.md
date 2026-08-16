# Cluster AI Supply Chain Control Tower

> **Unofficial candidate prototype.** Not affiliated with, endorsed by, or connected to Cluster's production systems.

An unofficial, candidate-built reliability and evidence layer around pharmaceutical procurement decisions, built as one Next.js + TypeScript app with Supabase Postgres.

## What this is

A single full-stack Next.js application that ingests explicitly labelled customer CSV uploads, public reference data, official public EDA notices, and deterministic sample data. It produces reproducible procurement evidence and reliability metrics from persisted source records:

- AI decision observability and replay
- Procurement regret
- Supplier reliability and drift
- Forecast QA
- Regulatory exposure
- EPTTS Phase-1 preflight validation

## What this is not

We do not rebuild Cluster's marketplace, Clara, procurement UX, forecasting model, or supplier catalogue. We do not claim any connection to Cluster production systems. The Cluster Production Integration source ships permanently as `NOT_CONNECTED / READY_FOR_INTEGRATION`.

## Stack

- **Framework**: Next.js 16.3.0 (App Router, TypeScript strict)
- **Database**: Supabase Postgres (Free tier) with RLS on every table
- **Deployment**: Vercel Hobby (one project)
- **Monorepo**: pnpm workspaces (no Turborepo)
- **Tests**: Vitest (unit/integration), Playwright (E2E)

## Getting started

```bash
# Install dependencies
pnpm install

# Link to the hosted DEV Supabase project
pnpm supabase:link

# Review pending migrations
pnpm supabase:db:push:check

# Apply migrations to the linked project before starting the app
pnpm supabase:db:push

# Start dev server
pnpm dev

# Run CI locally
pnpm ci:local
```

The exact founder try flow, data provenance, required environment variable names, and deployment prerequisites are in [`docs/founder-readiness.md`](docs/founder-readiness.md).

## Architecture notes

- **Docker-free**: no local Supabase stack, no Docker Desktop, no Podman.
- Development uses a hosted Supabase Free DEV project.
- See `docs/architecture/supabase-hosted.md` for the full Docker-free Supabase
  architecture.

## Project structure

```
apps/web/          — the ONE deployable (Next.js)
packages/core/     — pure domain math (no I/O imports)
packages/schemas/  — Zod contracts
packages/design-tokens/ — semantic status colors (brand tokens deferred to Phase 0)
supabase/          — migrations, seed, tests
fixtures/          — test fixtures (EPTTS, CSV, EDA)
docs/              — architecture, runbooks, API docs
```

## Honesty constraints

- Founder Demo procurement is deterministic SAMPLE data and is labelled as such
- Public medicine reference data is not customer data
- Official EDA notices are persisted only after a successful bounded official-source fetch
- No EPTTS verdict claims an official EDA outcome — it is a deterministic preflight
- Unverified rules are displayed separately and never affect the verdict
