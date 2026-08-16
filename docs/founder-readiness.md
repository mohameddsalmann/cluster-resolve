# Founder and deployment readiness

## Data provenance

| Product surface | Classification | Source of truth |
|---|---|---|
| Founder Demo pharmacies, suppliers, orders, offers, decisions, and outcomes | **FOUNDER DEMO / SAMPLE** | Deterministic four-file generator and normal signed Storage import flow |
| Founder Demo product names | **PUBLIC MEDICINE REFERENCE** | Pinned CC0 `karem505/egyptian-drug-database` snapshot; see `docs/product-reference-provenance.md` |
| EDA regulatory notices | **OFFICIAL EDA DATA / REAL PUBLIC EXTERNAL DATA** | Persisted only after a successful bounded fetch from official EDA public pages |
| User procurement uploads | **CUSTOMER DATA** | Files uploaded by the user to an isolated `IMPORTED_REAL` dataset |
| Bundled EPTTS CSV/XML examples | **OFFICIAL REFERENCE / TEST — NOT CUSTOMER DATA** | Deterministic files exercising implemented rules; no official approval is claimed |

The Founder Demo intentionally combines public medicine names with synthetic procurement history. It is never described as Cluster or customer transaction history. Pharmacy “Service Risk” describes supplier service experienced by a pharmacy, not pharmacy reliability.

## Try your own procurement CSVs

Open `/imports`, create a new isolated dataset, and upload in this order:

1. Orders — creates canonical orders, pharmacies, and products.
2. Offers — adds supplier quote evidence.
3. Decisions — enables forensic Decision Replay.
4. Outcomes — enables exceptions, supplier reliability, promise fidelity, and pharmacy service risk.

The importer uses flexible column mapping followed by private signed Supabase Storage, canonical persistence, and production evaluation. The small deterministic files in `examples/founder-upload/` exercise this exact sequence; they are sample inputs, not customer data.

## EDA regulatory data

`/regulatory` reads persisted official notices and displays total count, source status, last sync, filters, pagination, and dataset exposure. Sync is an explicit operator action with two bounded official-page requests and a timeout. A bundled reference cache may support parser tests, but it is never persisted or labelled as official data when the live fetch fails.

## EPTTS traceability

`/traceability` accepts CSV and EPCIS XML. Every try action uses private signed Storage before server-side preflight, findings, canonical events, expiry signals, and reconciliation are persisted. Downloadable valid and invalid reference files demonstrate real PASS and FAIL outcomes and are prominently labelled **OFFICIAL REFERENCE / TEST — NOT CUSTOMER DATA**. A PASS means the implemented checks passed; it is not EDA certification or submission approval.

## Hosted Supabase prerequisite

Apply every committed migration, including `supabase/migrations/20260815000002_chunk4_regulatory_traceability.sql`, to the production project before deployment. The application reports regulatory/traceability persistence as unavailable instead of substituting process-memory data when those tables are missing.

## Required production environment variables

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`

`SUPABASE_SERVICE_ROLE_KEY` is supported only as a legacy server-side alternative to `SUPABASE_SECRET_KEY`. None of these variables may use a `NEXT_PUBLIC_` prefix.

## Local verification

```bash
pnpm install --frozen-lockfile
copy .env.example apps/web/.env.local
pnpm supabase:db:push:check
pnpm supabase:db:push
pnpm dev

pnpm lint
pnpm typecheck
pnpm test
pnpm test:db
pnpm build
```

For Vercel, keep the project root at the repository root so workspace packages remain accessible. `vercel.json` installs the locked pnpm workspace, runs the root build, and points Vercel to `apps/web/.next`. Add only the environment variable names above, with production values in Vercel project settings.
