# System overview

## Purpose

A single full-stack Next.js application that ingests real data from explicitly
labelled sources and produces deterministic reliability metrics for
pharmaceutical procurement decisions.

## Deployment topology

```
Local development (Windows, Node.js, pnpm, no Docker)
            |
            | HTTPS / Postgres
            v
    Supabase Cloud Free DEV

Production later:
GitHub -> Vercel Hobby -> Supabase Cloud Free PROD
```

## Core components

| Component | Responsibility |
|---|---|
| `apps/web` | Next.js 16.3 app, Route Handlers, pages, SSR clients |
| `packages/core` | Pure domain math, no I/O imports |
| `packages/schemas` | Zod contracts for imports, API, DB rows |
| `packages/design-tokens` | Semantic status colors only (brand tokens deferred) |
| `supabase/migrations` | Forward-only schema migrations, source of truth |

## Data sources

| Source | Label | Status |
|---|---|---|
| EDA public pages/PDFs | `EDA_RECALLS`, `EDA_FRAUD` | scraper/importer, `robots.txt` respected |
| User CSV/JSON upload | `CSV_IMPORT` | user-imported, anonymized |
| Synthetic demo data | `SAMPLE` | clearly bannered |
| Cluster production | `CLUSTER_PROD` | `NOT_CONNECTED / READY_FOR_INTEGRATION` |

## Honesty constraints

- No fake data presented as real.
- Every metric traceable to a persisted source row.
- EPTTS preflight never claims an official EDA outcome.
- Unverified rules displayed separately, never affect verdict.
- Sample data always bannered.

## Stack

- Next.js 16.3.0 (App Router, TypeScript strict)
- React 19.2.8
- Tailwind CSS 4
- Supabase Postgres Free (hosted, no Docker)
- pnpm workspaces
- Vitest + Playwright
- Vercel Hobby (production later)

## Verified architecture decisions

- Next.js 16.3.0 with `proxy.ts` replacing `middleware.ts`.
- Vercel Hobby: 300s max function duration, 4.5 MB body, daily cron only.
- Vercel Workflows: 50,000 events/month, 1 GB data written, 1-day retention.
- Supabase Free: 500 MB DB, 1 GB storage, no backups/PITR/branching, pauses after 7 days.
- Docker-free development; hosted DEV project.

## Unresolved Phase 0 items

- Supabase CLI link to project ref `gcqcbrcmfequnuprrzqc` requires account privileges.
- EPTTS exact CSV delimiter/encoding and full event state machine need official sample file.
- Cluster brand extraction pending official guidelines.
