# Cluster Resolve — Revised Implementation Plan
## Procurement Reliability + Regulatory Risk Layer for Egyptian Pharmaceutical Operations

**Status:** Phase 0 and Phase 1 are complete and frozen.  
**Next implementation phase:** Phase 2 only.  
**Product type:** Unofficial candidate prototype / founder-facing working product.  
**Primary goal:** Solve a real operational problem with real persisted data, not build an enterprise SaaS platform.

---

# 1. Executive Product Direction

## 1.1 Working product name

**Cluster Resolve**

**Positioning:**

> A procurement reliability and regulatory-risk layer that explains what happened after procurement decisions, detects operational exceptions and supplier deterioration, evaluates decision quality, and connects procurement activity to Egypt-specific regulatory and traceability risks.

The product is **complementary** to the class of procurement platform Cluster publicly operates. It must not rebuild their publicly advertised marketplace, procurement UX, best-price selection, supplier ordering dashboard, shortage detection, Clara-like assistant, or generic forecasting.

The central question Resolve answers is:

> **What actually happened after the procurement decision, what went wrong, why, what is the impact, and what needs attention now?**

---

# 2. What Is Frozen From Phase 0 and Phase 1

Do **not** redo, rebuild, or reinterpret Phase 0 or Phase 1 unless the existing repository demonstrably contradicts one of the frozen items below.

## 2.1 Frozen technical baseline

Keep:

- One Git repository.
- One deployable full-stack **Next.js 16.3 / current pinned version** application.
- React + TypeScript.
- Next.js App Router and Route Handlers.
- `proxy.ts` only for lightweight request-boundary concerns such as headers/request IDs.
- `pnpm` workspaces.
- `apps/web` as the one deployable.
- `packages/core` as pure deterministic domain logic with no DB/HTTP/framework I/O.
- `packages/schemas` for shared Zod contracts.
- `packages/design-tokens` for centralized styling tokens.
- Hosted Supabase development project.
- Docker-free development.
- Supabase Postgres.
- Supabase Storage where it provides direct product value.
- `@supabase/supabase-js` server-only Data API repositories.
- TypeScript database types generated from hosted Supabase.
- Vitest + Playwright.
- Real lint, typecheck, tests, build.
- Local phase-scoped Git commits.
- No GitHub remote or Vercel production deployment until the final deployment phase unless it has already been intentionally connected.
- Public-site-derived Cluster visual language only where verified.
- Persistent **“Unofficial candidate prototype”** labeling.
- No claim of a live Cluster production integration.
- Cluster production source remains:
  - `NOT_CONNECTED`
  - `READY_FOR_INTEGRATION`

## 2.2 Frozen development constraints

- **No Docker.**
- Do not run `supabase start`.
- Do not introduce Podman/Rancher/another container runtime.
- Hosted Supabase is the development DB.
- Schema migrations are source of truth.
- Use:
  - `supabase link`
  - `supabase db push --dry-run`
  - `supabase db push`
  - remote type generation
- Leave `supabase/config.toml` untouched unless it actually blocks hosted CLI work.
- Do not use `supabase config push`.
- Do not add config cleanup to product phases merely for tidiness.

## 2.3 Money representation

All persisted money uses:

**PostgreSQL `BIGINT` integer piastres.**

Examples:

- EGP 125.50 → `12550`
- EGP 8,220.00 → `822000`

Use for:

- unit prices
- order values
- supplier offers
- exposure values
- expiry values
- price regret
- estimated operational regret

TypeScript domain logic uses `bigint`, not floating-point money.

At JSON/API/read-model boundaries, serialize money minor units as **decimal strings**, never unsafe JS floating-point numbers.

UI converts to EGP only at presentation time.

Percentages/rates are separate from money:
- basis points when convenient
- constrained numeric values only when necessary

Define one explicit rounding rule whenever a rate is converted into money.

---

# 3. Major Direction Change From the Old Plan

The old implementation plan was architecturally serious, but it expanded into a general enterprise control-tower platform. The revised product deliberately narrows the surface.

## 3.1 Remove from v1

Do **not** implement:

- Supabase Auth.
- Login/sign-up.
- Organizations.
- `org_members`.
- Multi-tenancy.
- RBAC.
- RLS architecture.
- ADMIN / ANALYST / VIEWER roles.
- Invitation flows.
- API-key management.
- HMAC public webhook framework.
- Enterprise audit authorization.
- Billing.
- Org switcher.
- Full policy-management UI.
- Full generic alert-management platform.
- Generic Forecast QA module.
- Forecast model training.
- A Clara/chatbot clone.
- A supplier order-management dashboard.
- Full automated EDA scraper in v1.
- Full EPTTS / Masar / EPCIS platform.
- EDA submission.
- Barcode scanning app.
- Kafka.
- Redis unless later measured as necessary.
- Microservices.
- Python/FastAPI.
- Kubernetes.
- Vercel Workflows as a default architecture.
- pg_cron watchdog as a default architecture.
- Lease/recovery/job-runner framework before a measured need exists.

## 3.2 Keep the strongest ideas from the old plan

Keep and strengthen:

- real persisted data
- provenance
- deterministic calculations
- decision replay
- supplier reliability
- supplier deterioration
- procurement regret / decision-quality explanation
- real EDA regulatory artifacts
- EDA exposure matching
- EPTTS preflight
- no fake operational metrics
- visible source/data mode
- drill-down to underlying records
- honest `PUBLICLY NOT OBSERVED` wording for Cluster assumptions
- sample data that behaves as a deterministic test fixture rather than fake production data

---

# 4. Final Product Scope

Resolve has one coherent purpose:

> **Detect, explain, and prioritize procurement risk after and around procurement decisions.**

The v1 product consists of six related capabilities.

## 4.1 Order Exception Intelligence

Detect:

- `LATE_DELIVERY`
- `PARTIAL_FILL`
- `CANCELLED`
- `UNFULFILLED`
- `PROMISE_MISS`
- repeated recent pharmacy incidents
- data-insufficient state when an outcome cannot be evaluated safely

Every exception must show:

- order
- affected product(s)
- supplier
- requested quantity
- fulfilled quantity
- promised time if available
- actual delivery time if available
- source records
- deterministic reason code

## 4.2 Supplier Reliability + Deterioration

Calculate from realized outcomes:

- fill rate
- OTIF
- cancellation rate
- partial-fill rate
- actual lead-time median
- actual lead-time P95
- evaluated order count
- recent-vs-baseline change

The product must answer:

> Which supplier is becoming operationally risky, why, and which recent orders/decisions were affected?

Do **not** rebuild generic supplier order management.

## 4.3 Decision Replay

For a procurement decision, reconstruct:

1. order context
2. requested products/quantities
3. supplier offers available **at decision time**
4. candidate suppliers
5. selected supplier
6. optional agent metadata
7. actual outcome
8. feasible alternative(s)
9. decision-quality evaluation
10. evidence/provenance

Historical evaluation must never use today’s supplier state as if it were known at decision time.

## 4.4 Procurement Regret / Decision Quality

Lead with explainable components:

- price difference
- unfilled quantity
- lateness
- cancellation impact
- service-level miss
- best feasible alternative at decision time
- confidence / data sufficiency

An optional estimated monetary operational regret may be computed only from an explicit transparent policy.

It must be labeled as:

**Estimated operational regret**

Never as accounting truth.

## 4.5 Regulatory Exposure + Expiry Recovery

Use **real official EDA artifacts**.

Resolve should:

- ingest an official EDA notice/PDF
- normalize the notice
- match it against products
- find potentially exposed:
  - orders
  - pharmacies
  - suppliers
  - units/value
- preserve exact source provenance

Also support an Egypt-specific **Expiry Recovery** view:

- already expired
- expiry < 30 days
- expiry 30–90 days
- value exposure
- supplier grouping
- downloadable recovery-preparation CSV

Do not claim reimbursement eligibility or submit anything to EDA.

## 4.6 EPTTS Preflight

Focused file validator only.

Flow:

`upload → parse → verified rules → cross-row checks → findings → prototype preflight verdict → report`

Only `VERIFIED` rules can block the verdict.

`NEEDS_VERIFICATION` rules:
- appear separately
- never convert PASS to FAIL
- never claim official compliance impact

Never display:
- “EDA approved”
- “EDA compliant”
- “EDA will reject”

Use:
- “Prototype EPTTS preflight”
- “Fails preflight under the verified rules implemented by this prototype”
- “No blocking findings detected under the verified rule set”

---

# 5. Final Architecture

```text
                               BROWSER
                                  │
                                  ▼
                     NEXT.JS 16 FULL-STACK APP
                 ┌────────────────────────────────┐
                 │ Responsive UI                  │
                 │ Server Components              │
                 │ Route Handlers                 │
                 │ Read-model builders            │
                 └───────────────┬────────────────┘
                                 │
                                 ▼
                      SERVER-SIDE APPLICATION
                 ┌────────────────────────────────┐
                 │ repositories                   │
                 │ ingestion services             │
                 │ EDA manual-assisted adapter    │
                 │ Storage helpers                │
                 └───────────────┬────────────────┘
                                 │
                 ┌───────────────┴───────────────┐
                 │                               │
                 ▼                               ▼
          packages/core                  Supabase Storage
   ┌─────────────────────────┐          CSV / PDF / EPTTS
   │ exception engine        │
   │ supplier reliability    │
   │ deterioration           │
   │ decision replay math    │
   │ regret                  │
   │ regulatory matching     │
   │ expiry                  │
   │ EPTTS rules             │
   └─────────────┬───────────┘
                 │
                 ▼
          SUPABASE POSTGRES
       authoritative persisted state
```

## 5.1 Request model

### Reads

Prefer Server Components/repository calls directly on the server where practical.

Do not self-fetch from the same Next.js application unless a client interaction genuinely needs an HTTP API.

### Writes

Use straightforward Next.js Route Handlers for:
- uploads
- imports
- evaluation actions
- EDA document ingestion
- EPTTS validation

No login/session requirement in v1.

### Secrets

Keep:
- DB credentials server-only
- Supabase service-role server-only
- `.env*` ignored
- no service-role import into client bundles

These are basic implementation correctness requirements, not a user-authentication feature.

## 5.2 Background processing rule

**Do not implement Vercel Workflows yet.**

First benchmark the real tasks using normal Node.js Route Handlers.

Only introduce Vercel Workflows if measured evidence shows a real production/demo workload cannot safely fit Vercel execution limits.

Do not pre-build:
- workflow abstraction
- watchdog
- lease engine
- recovery scheduler
- queue framework
- worker framework

Keep only a simple `ingestion_jobs` persistence model so the UI can show import/processing result and failures.

---

# 6. Real Data Honesty Model

Every dataset has one explicit mode:

- `LIVE`
- `IMPORTED_REAL`
- `SAMPLE`

Definitions:

### LIVE
Real official external source data, e.g. official EDA notice.

The UI must additionally show acquisition mode:
- `MANUAL_ASSISTED`
- `AUTOMATED`

Therefore an uploaded official EDA PDF can be:

- data mode: `LIVE`
- acquisition mode: `MANUAL_ASSISTED`

This prevents “live” from falsely implying automatic scraping.

### IMPORTED_REAL
Authorized operational data uploaded by the user, such as anonymized pharmacy procurement records.

### SAMPLE
Deterministic generated test/demo data.

Rules:

- SAMPLE must always have a visible banner/chip.
- Sample records can never be called Cluster production records.
- Cluster production can never be shown as connected without authorization.
- Every displayed operational number must originate from persisted rows.
- Empty DB means empty states, not fake KPI values.

---

# 7. Simplified Repository Direction

Preserve the current repository. Do not rebuild it.

Target shape:

```text
apps/
  web/
    app/
      page.tsx                         Resolve / Operations
      orders/
      decisions/[id]/
      suppliers/
      regulatory/
      traceability/
      api/
        health/
        uploads/
        imports/
        orders/
        decisions/
        suppliers/
        regulatory/
        eptts/
    components/
      resolve/
      orders/
      decisions/
      suppliers/
      regulatory/
      eptts/
      shared/
    lib/
      db/
        repositories/
      ingestion/
      integrations/
        eda/
      storage/
      read-models/
      config/

packages/
  core/
    exceptions/
    supplier/
    regret/
    regulatory/
    expiry/
    eptts/
    util/
  schemas/
    imports/
    api/
    eptts/
  design-tokens/

supabase/
  migrations/
  seed/

fixtures/
  imports/
  eda/
  eptts/

docs/
  architecture/
  data-contracts/
  eptts/
  demo/
```

Do not create framework layers until a real feature needs them.

---

# 8. Database Conventions

## 8.1 Common conventions

Unless a table has a strong reason otherwise:

- `id uuid primary key default gen_random_uuid()`
- `created_at timestamptz not null default now()`
- times stored UTC
- UI displays `Africa/Cairo`
- money = `bigint` piastres
- quantities = integer packs/units with explicit unit where needed
- foreign keys used for real relationships
- indexes only for demonstrated/obvious read paths
- no `organization_id`
- no `user_id`
- no RLS policies
- no tenant tables

## 8.2 Source traceability

Business rows that come from imports should carry one of:
- `dataset_id`
- `source_ingestion_job_id`
- `source_document_id`

so a user can always answer:

> Where did this record come from?

---

# 9. Revised Implementation Phases

# PHASE 0 — COMPLETE / FROZEN

Do not rerun.

Treat existing research, corrections, Docker-free strategy, Next.js version work, EPTTS source verification, Supabase constraints, and public Cluster research as historical baseline.

Where an old Phase-0 assumption conflicts with this revised product architecture, the **revised architecture wins** without re-running Phase 0.

Examples:
- Vercel Workflows are no longer a required v1 component.
- Auth/RLS is no longer a v1 goal.
- automated EDA scraping is no longer required for the demo.

---

# PHASE 1 — COMPLETE / FROZEN

Do not rebuild.

Preserve the already-working foundation:
- Next.js
- pnpm workspaces
- lint
- typecheck
- tests
- build
- Proxy
- hosted Supabase development
- Docker-free workflow
- local Git history
- existing design-token and package boundaries

If an old Phase-1 document says local Supabase/Docker, treat that line as superseded by the already-adopted hosted DEV strategy.

---

# PHASE 2 — PROCUREMENT OUTCOME DATA FOUNDATION

## Goal

Build the smallest real persistent model needed by Resolve.

## Why this phase exists

Every later feature needs one consistent procurement outcome model. This is the foundation for:
- exceptions
- supplier reliability
- replay
- regret
- regulatory exposure
- expiry recovery

## Dependencies

- Frozen Phase 0
- Frozen Phase 1
- linked hosted Supabase DEV

## Migrations

Create only the migrations required for the following tables.

### `datasets`

Fields:

- `id`
- `name`
- `mode` check:
  - `LIVE`
  - `IMPORTED_REAL`
  - `SAMPLE`
- `description` nullable
- `created_at`

### `data_sources`

Fields:

- `id`
- `dataset_id`
- `kind`:
  - `EDA`
  - `CSV`
  - `JSON`
  - `EPTTS`
  - `SAMPLE_GENERATOR`
- `acquisition_mode`:
  - `MANUAL_ASSISTED`
  - `AUTOMATED`
  - `FILE_IMPORT`
  - `GENERATED`
- `name`
- `source_url` nullable
- `status`:
  - `READY`
  - `PROCESSING`
  - `FAILED`
  - `NOT_CONNECTED`
- `last_ingested_at` nullable
- `created_at`

### `ingestion_jobs`

Fields:

- `id`
- `dataset_id`
- `source_id` nullable
- `kind`
- `status`:
  - `PENDING`
  - `PROCESSING`
  - `COMPLETED`
  - `FAILED`
- `original_filename` nullable
- `storage_path` nullable
- `file_sha256` nullable
- `total_rows` nullable
- `processed_rows`
- `valid_rows`
- `error_rows`
- `error_message` nullable
- `started_at`
- `finished_at`
- `created_at`

### `products`

- `id`
- `dataset_id`
- `external_product_id`
- `sku` nullable
- `name`
- `name_normalized`
- `manufacturer` nullable
- `manufacturer_normalized` nullable
- `gtin` nullable
- `created_at`

Unique:
- `(dataset_id, external_product_id)`
- optional unique GTIN per dataset when present

### `pharmacies`

- `id`
- `dataset_id`
- `external_pharmacy_id`
- `name` nullable
- `governorate` nullable
- `city` nullable
- `created_at`

Unique:
- `(dataset_id, external_pharmacy_id)`

No patient-level columns.

### `suppliers`

- `id`
- `dataset_id`
- `external_supplier_id`
- `name`
- `name_normalized`
- `governorate` nullable
- `city` nullable
- `created_at`

Unique:
- `(dataset_id, external_supplier_id)`

### `orders`

- `id`
- `dataset_id`
- `external_order_id`
- `pharmacy_id`
- `status`
- `placed_at`
- `source_ingestion_job_id`
- `created_at`

Unique:
- `(dataset_id, external_order_id)`

### `order_items`

- `id`
- `order_id`
- `product_id`
- `requested_qty`
- `unit`
- `created_at`

Unique:
- `(order_id, product_id)`

### `supplier_offers`

- `id`
- `dataset_id`
- `external_offer_id`
- `order_id`
- `supplier_id`
- `product_id`
- `available_qty`
- `unit_price_minor bigint`
- `discount_bps`
- `promised_delivery_at` nullable
- `offered_at`
- `source_ingestion_job_id`
- `created_at`

### `order_outcomes`

For v1 prefer a normalized latest/final outcome row instead of an event-sourcing platform.

- `id`
- `dataset_id`
- `order_id`
- `supplier_id`
- `product_id`
- `filled_qty`
- `delivered_at` nullable
- `cancelled`
- `cancellation_reason` nullable
- `outcome_final`
- `source_ingestion_job_id`
- `created_at`

Unique:
- `(dataset_id, order_id, supplier_id, product_id)`

### `ai_decisions`

- `id`
- `dataset_id`
- `external_decision_id`
- `order_id`
- `selected_supplier_id`
- `decided_at`
- `agent_name` nullable
- `agent_version` nullable
- `confidence` nullable
- `selection_reason` nullable
- `input_snapshot_json` nullable
- `source_ingestion_job_id`
- `created_at`

Unique:
- `(dataset_id, external_decision_id)`

### `ai_decision_candidates`

- `id`
- `decision_id`
- `supplier_id`
- `rank` nullable
- `score` nullable
- `feasible`
- `infeasible_reason` nullable
- `feature_values jsonb`
- `created_at`

Unique:
- `(decision_id, supplier_id)`

## Files/modules

Create or complete:

- `apps/web/lib/db/pool.ts`
- `apps/web/lib/db/generated-types.ts`
- `apps/web/lib/db/repositories/datasets.ts`
- `products.ts`
- `pharmacies.ts`
- `suppliers.ts`
- `orders.ts`
- `offers.ts`
- `outcomes.ts`
- `decisions.ts`
- `packages/core/util/money.ts`
- `packages/core/util/normalize.ts`

## API

Only minimal proof endpoints:

- `GET /api/health/ready`
- `GET /api/datasets`
- optional `GET /api/datasets/:id`

Do not build business UI yet.

## Algorithms

- Arabic/English name normalization
- GTIN structural validation if already verified/required
- EGP ↔ piastres conversion helpers
- money JSON serialization helper

## Tests

- migrations apply to hosted DEV
- uniqueness constraints
- negative quantities rejected
- money helper exactness
- normalization tests
- server-side dataset insert/read
- persistence survives app restart/refresh
- data mode enum enforced

## Manual verification

1. `supabase db push --dry-run`
2. review exact migration list
3. `supabase db push`
4. generate remote types
5. create one dataset via server code
6. query it back
7. restart Next.js
8. verify row remains

## Acceptance

Phase 2 is PASS only when:

- remote migrations applied
- required tables exist
- server can write/read real rows
- `LIVE / IMPORTED_REAL / SAMPLE` enforced
- no Auth/RLS/org tables introduced
- lint PASS
- typecheck PASS
- tests PASS
- build PASS
- local Phase-2 Git commit exists

## Not yet

No importer.
No exception engine.
No supplier metrics.
No decision evaluation.
No EDA.
No EPTTS.
No UI redesign.

## Exit gate

A stable persisted procurement schema exists on hosted Supabase.

---

# PHASE 3 — REAL INGESTION + DATA QUALITY

## Goal

Turn real CSV/JSON files into persisted procurement records.

## Founder-visible value

A user can give Resolve actual operational data and get deterministic processing rather than viewing hardcoded demo cards.

## Primary import contracts

### `orders.csv`

Minimum logical fields:

- order_id
- pharmacy_id
- pharmacy_name optional
- placed_at
- product_id
- product_name
- manufacturer optional
- requested_qty

### `offers.csv`

- offer_id
- order_id
- supplier_id
- supplier_name
- product_id
- available_qty
- unit_price_egp
- discount_percent optional
- promised_delivery_at optional
- offered_at

### `outcomes.csv`

- order_id
- supplier_id
- product_id
- filled_qty
- delivered_at optional
- cancelled
- cancellation_reason optional
- outcome_final

### `decisions.csv`

- decision_id
- order_id
- selected_supplier_id
- decided_at
- agent_name optional
- agent_version optional
- confidence optional
- selection_reason optional

Optional later:
- `decision_candidates.csv`

If explicit candidate data is absent, derive the available candidate set from offers that existed at or before `decided_at`, and clearly label the derivation method.

## Additional migration

### `ingestion_errors`

- `id`
- `job_id`
- `row_number`
- `field` nullable
- `code`
- `message`
- `raw_value` nullable
- `created_at`

## Processing flow

```text
choose dataset
→ upload file
→ Storage when useful
→ create ingestion_job
→ parse
→ Zod validate
→ normalize
→ persist valid rows
→ persist row errors
→ finalize counts
→ show result
```

For larger files, upload directly to Storage rather than sending the full file body through a Vercel Function.

## Idempotency

Use:

- dataset + file SHA-256 for duplicate-file detection
- record-level unique keys from Phase 2
- deterministic upsert rules

Do not create a general event-sourcing framework.

## Data quality outputs

Show:

- rows processed
- rows accepted
- rows rejected
- unknown products/suppliers
- orphan references
- outcomes without matching orders
- decisions without outcome coverage
- percentage of orders evaluable for supplier metrics
- percentage of decisions evaluable for replay

## Tests

- valid file imports exact expected rows
- malformed dates rejected
- malformed money rejected
- duplicate file does not double-insert
- duplicate rows do not duplicate records
- invalid rows create `ingestion_errors`
- imported records persist after refresh
- 4-file fixture produces known relationship counts

## Benchmark

Benchmark realistic founder-demo files.

Do not introduce Workflows unless measured processing shows real risk of the function limit.

## Acceptance

A real CSV import changes persisted row counts and subsequent queries.

No hardcoded operational number is used to fake a successful import.

## Exit gate

Procurement data can enter Resolve end-to-end.

---

# PHASE 4 — ORDER EXCEPTIONS + SUPPLIER RELIABILITY

## Goal

Turn realized outcomes into actionable operational problems.

## New tables

### `order_exceptions`

- `id`
- `dataset_id`
- `order_id`
- `supplier_id` nullable
- `product_id` nullable
- `type`
- `severity`
- `engine_version`
- `evidence_json`
- `detected_at`

Unique:
- `(order_id, product_id, type, engine_version)` where appropriate

### `supplier_reliability_snapshots`

One compact persisted table instead of multiple enterprise rollup/drift tables.

- `id`
- `dataset_id`
- `supplier_id`
- `as_of_date`
- `window_days`
- `n_orders`
- `fill_rate_bps`
- `otif_rate_bps`
- `cancellation_rate_bps`
- `partial_fill_rate_bps`
- `lead_time_p50_minutes`
- `lead_time_p95_minutes`
- `baseline_n_orders`
- `baseline_fill_rate_bps` nullable
- `baseline_otif_rate_bps` nullable
- `baseline_cancellation_rate_bps` nullable
- `baseline_partial_fill_rate_bps` nullable
- `baseline_p95_minutes` nullable
- `status`
- `triggers_json`
- `engine_version`
- `computed_at`

Status:
- `HEALTHY`
- `WATCH`
- `HIGH`
- `INSUFFICIENT_DATA`

## Order exception rules

### CANCELLED

When final outcome explicitly indicates cancellation.

### PARTIAL_FILL

`0 < total_filled < total_requested`

### UNFULFILLED

Final outcome and total filled = 0.

### LATE_DELIVERY

Delivery exists and:

`delivered_at > selected_supplier_promised_delivery_at`

Only calculate when a valid promise exists.

### PROMISE_MISS

Use only when a final outcome explicitly proves the promised service was missed.

Do not infer a miss merely because data is missing.

### REPEATED_PHARMACY_INCIDENT

Context flag, not necessarily a standalone critical exception.

Example:
- 3+ exception-affected orders for the same pharmacy in rolling 30 days

## Supplier metrics

### Fill Rate

`sum(filled_qty) / sum(requested_qty)`

### OTIF

Order is OTIF only if:
- required quantity fully filled
- and delivered on/before valid promised delivery timestamp

Exclude orders without sufficient promise/outcome data from the OTIF denominator.

### Cancellation Rate

`cancelled evaluated orders / evaluated orders`

### Partial Fill Rate

`partially fulfilled evaluated orders / evaluated orders`

### Lead Time

`delivered_at - placed_at`

Compute P50 and P95 directly from underlying order rows.

Do not average daily percentiles.

## Deterioration policy v1

Use an understandable deterministic recent-vs-baseline policy.

Suggested initial windows:

- recent = 14 days
- baseline = preceding 28 days

Minimum samples:
- recent ≥ 10 evaluated orders
- baseline ≥ 20 evaluated orders

Otherwise:
- `INSUFFICIENT_DATA`

Trigger examples:

- fill-rate drop ≥ 10 percentage points
- OTIF drop ≥ 10 percentage points
- cancellation increase ≥ 5 percentage points
- partial-fill increase ≥ 10 percentage points
- P95 lead time ≥ 1.5× baseline AND at least +120 minutes

Risk:

### WATCH
one meaningful trigger

### HIGH
two or more meaningful triggers

or one severe trigger such as:
- fill-rate drop ≥ 20 points
- cancellation increase ≥ 10 points

Keep thresholds in one versioned TypeScript policy file, not a policy-management database/UI.

## Core modules

- `packages/core/exceptions/*`
- `packages/core/supplier/metrics.ts`
- `packages/core/supplier/deterioration.ts`
- `packages/core/supplier/policy-v1.ts`

Pure functions only.

## API/read models

- `GET /api/orders`
- `GET /api/orders/:id`
- `GET /api/suppliers`
- `GET /api/suppliers/:id`
- `POST /api/evaluate/exceptions`
- `POST /api/evaluate/suppliers`

## Tests

Create deterministic fixtures:

- healthy order
- cancelled order
- late order
- partial fill
- zero fill
- healthy supplier
- deteriorating supplier
- low-sample supplier

Expected scenario → exact expected detection.

## Acceptance

A founder can click a deteriorating supplier and see:
- which metric changed
- recent vs baseline
- the exact affected orders

## Exit gate

Resolve can identify operational problems from real persisted outcomes.

---

# PHASE 5 — DECISION REPLAY + PROCUREMENT REGRET

## Goal

Explain procurement decision quality after the actual outcome is known.

## New table

### `decision_evaluations`

- `id`
- `dataset_id`
- `decision_id`
- `engine_version`
- `evaluation_status`
- `price_regret_minor bigint`
- `unfilled_qty`
- `lateness_minutes`
- `cancelled`
- `best_alternative_supplier_id` nullable
- `alternative_method`
- `estimated_operational_regret_minor bigint` nullable
- `confidence`
- `assumptions_json`
- `evidence_json`
- `evaluated_at`

Unique:
- `(decision_id, engine_version)`

## Point-in-time integrity

Evaluation may use:

- imported `input_snapshot_json`
- candidate `feature_values`
- supplier offers with `offered_at <= decided_at`
- realized outcome after decision

It must not use today’s supplier performance as if it were known at decision time.

## Candidate reconstruction

Preferred order:

1. explicit imported decision candidates
2. else candidate set derived from supplier offers available for the order at/before `decided_at`

Persist/display:

`candidate_source = EXPLICIT | DERIVED_FROM_OFFERS`

## Feasible alternative

For v1, an alternative is feasible if:
- it existed at decision time
- candidate marked feasible, or derived offers can cover the required lines according to the defined v1 rule
- it is not the selected supplier

Never invent candidate availability.

## Decision-quality components

### Price difference

Compare selected supplier’s available offer total against the best feasible alternative.

### Fill regret

`requested_qty - realized_filled_qty`

### Delivery regret

`max(0, delivered_at - promised_delivery_at)`

### Cancellation

Explicit outcome signal.

### Estimated operational regret

Optional.

Only show when a transparent policy supplies:
- per-unfilled-unit penalty
- late-hour penalty
- cancellation penalty if desired

Policy lives in:
- `packages/core/regret/policy-v1.ts`

The UI must show the exact assumptions.

Default founder demo should lead with component regret, not a magic money score.

## Replay screen composition

1. decision header
2. order context
3. what was known at decision time
4. candidate suppliers
5. selected supplier
6. selection reason, if provided
7. actual outcome
8. operational exceptions
9. best feasible alternative
10. regret / decision-quality explanation
11. affected supplier deterioration context
12. source/provenance links

## Core modules

- `packages/core/regret/evaluate.ts`
- `packages/core/regret/counterfactual.ts`
- `packages/core/regret/policy-v1.ts`

## Tests

- chosen cheapest but late/partial
- chosen expensive but reliable
- no alternative available
- missing candidate data
- no outcome
- point-in-time test proving a later offer is excluded
- recomputation produces identical output

## Acceptance

A reviewer can answer:

> Why was this decision considered suboptimal?

without needing a developer to explain the code.

## Exit gate

The central “post-decision feedback loop” exists end-to-end.

---

# PHASE 6 — EDA REGULATORY EXPOSURE + EXPIRY RECOVERY

## Goal

Connect official Egyptian regulatory signals and expiry risk to procurement records.

## EDA acquisition strategy

**Hybrid architecture, manual-assisted implementation now.**

### V1 supported path

```text
official EDA public notice/PDF
→ operator downloads/selects it
→ uploads artifact to Resolve
→ provides official source URL
→ Resolve hashes/stores artifact
→ extracts text
→ normalizes fields
→ operator confirms extracted fields when needed
→ Resolve matches products
→ Resolve calculates possible exposure
```

This is **real EDA data**.

Only the acquisition step is manual.

### Future optional adapter

Design one small interface so a later automated discoverer can be added without changing:
- document persistence
- parsing
- normalization
- matching
- exposure
- UI

Do not implement scraper automation now.

Do not build:
- CAPTCHA bypass
- headless browser bot
- DOM recovery framework
- scraper scheduler

## New tables

### `regulatory_documents`

- `id`
- `dataset_id`
- `source_url`
- `content_hash`
- `storage_path`
- `mime_type`
- `byte_size`
- `raw_text` nullable
- `extraction_status`
- `uploaded_at`

Unique:
- `(content_hash)`

### `regulatory_notices`

- `id`
- `document_id`
- `notice_number` nullable
- `notice_type`
- `recall_class` nullable
- `published_at` nullable
- `product_name_raw`
- `product_name_normalized`
- `manufacturer_raw` nullable
- `manufacturer_normalized` nullable
- `batch_numbers text[]`
- `reason_raw` nullable
- `corrective_action_raw` nullable
- `normalization_status`
- `created_at`

### `regulatory_matches`

- `id`
- `notice_id`
- `product_id` nullable
- `match_level`
- `match_basis`
- `similarity` nullable
- `evidence_json`
- `created_at`

Match levels:

- `EXACT`
- `POSSIBLE`
- `UNMATCHED`

A fuzzy match is never automatically promoted to exact.

### `regulatory_exposures`

- `id`
- `notice_id`
- `product_id`
- `order_id` nullable
- `pharmacy_id` nullable
- `supplier_id` nullable
- `exposure_qty`
- `exposure_value_minor bigint` nullable
- `match_level`
- `created_at`

### `inventory_lots`

For expiry analysis.

- `id`
- `dataset_id`
- `pharmacy_id` nullable
- `product_id`
- `supplier_id` nullable
- `batch_number`
- `expiry_date`
- `quantity`
- `unit_value_minor bigint`
- `source_order_item_id` nullable
- `source_ingestion_job_id`
- `created_at`

## EDA extraction

Start with embedded PDF text extraction.

No OCR unless a measured real notice cannot provide usable text and OCR is then deliberately added.

If extraction is incomplete:
- keep real artifact
- show raw extracted text
- allow operator field confirmation
- never fabricate fields

## Matching

Priority:

1. exact GTIN if present and trustworthy
2. exact normalized product name + manufacturer
3. exact name
4. fuzzy normalized name → `POSSIBLE`
5. batch-number evidence strengthens, but does not compensate for clearly wrong product identity

Persist match basis.

## Exposure

For matched products, show potentially affected:
- orders
- pharmacies
- suppliers
- units
- approximate procurement value when source data supports it

Separate EXACT and POSSIBLE exposure.

Never merge them into one “confirmed affected” figure.

## Expiry buckets

Using current Cairo date:

- `EXPIRED`: expiry < today
- `LT_30_DAYS`: 0–29 days
- `DAYS_30_90`: 30–90 days
- `GT_90_DAYS`: >90 days

Value:

`quantity * unit_value_minor`

## Recovery export

Generate CSV grouped/sortable by supplier:

- supplier
- product
- batch
- expiry
- quantity
- estimated value
- source order/invoice reference when available

Wording:

“Recovery preparation list”

Never:
“EDA reimbursement approved”

## UI

Regulatory page tabs:

- EDA Alerts
- Exposure
- Expiry Recovery

## Tests

- same official PDF uploaded twice → no duplicate document
- parse fixture
- exact product match
- fuzzy-only result → POSSIBLE
- POSSIBLE never becomes confirmed exposure
- known order set yields expected exposure counts
- expiry boundary tests
- recovery export exact totals

## Acceptance

At least one real official EDA artifact goes through:
artifact → normalized notice → match → exposure.

## Exit gate

Resolve contains a genuine Egypt-specific external signal, not only sample procurement data.

---

# PHASE 7 — EPTTS PREFLIGHT

## Goal

Build a narrow, deterministic preflight validator using the verified EDA/EPTTS rules already documented in the repository.

## Scope

This is only a preflight validator.

Not:
- full EPTTS
- Masar integration
- EPCIS platform
- submission client
- scanning app

## Verified header baseline

Use the current repository’s verified source material.

Expected Phase-1 header:

`seqNo,Bizstep,eventTime,timeOffset,readPointGLN,bizLocationGLN,epc,Parent,import,expiryDate,manufDate`

Header case matters.

Supported v1 business steps from the verified guide:

- `commissioning`
- `packing`

Comma delimiter is treated as VERIFIED according to the latest project research.

Encoding stays `NEEDS_VERIFICATION` unless a primary source in the repo proves it.

## New tables

### `eptts_files`

- `id`
- `dataset_id`
- `ingestion_job_id`
- `storage_path`
- `file_sha256`
- `spec_version`
- `status`
- `total_rows`
- `blocking_findings`
- `advisory_findings`
- `unverified_findings`
- `preflight_verdict`
- `created_at`
- `completed_at`

Verdict:
- `PASS`
- `FAIL`
- `NOT_EVALUATED`

### `eptts_findings`

- `id`
- `file_id`
- `row_number` nullable
- `rule_id`
- `severity`
- `verification_status`
- `field` nullable
- `actual` nullable
- `expected` nullable
- `message`
- `source_reference`
- `created_at`

## Rule implementation

Store rule metadata and implementation in TypeScript under:

`packages/core/eptts/rules/<spec-version>/`

Every rule includes:

- `rule_id`
- `title`
- `verification_status`
- `severity`
- `source_reference`
- deterministic evaluator

Only:
`verification_status = VERIFIED`
and
`severity = BLOCKING`
may fail the preflight.

## Minimum high-value checks

Only implement checks supported by the verified project sources, for example:

- exact header and order
- allowed `Bizstep`
- row/event ordering where verified
- serial uniqueness
- file serial-number limit
- commissioning batch limit
- expiry-format requirement
- required-field checks
- parent-child / packing consistency where the verified guide defines it
- other explicitly verified Phase-1 rules

Do not invent a rule because it “sounds like GS1.”

## Processing architecture

Use:

- Storage upload
- Node streaming parser where useful
- in-memory Set/Map or efficient query for cross-row uniqueness/parent checks
- persist findings + summary

Do not persist all parsed JSON forever.

Benchmark an official-max-scale-style fixture up to the documented row/serial limit.

If measured runtime cannot fit the Vercel function envelope, **then** propose Workflows as a Phase-7 implementation amendment.

Not before.

## UI

Traceability screen:

- file upload
- processing status
- prototype verdict
- finding counts
- filter findings
- row context
- rules catalogue
- download report

## Tests

- valid fixture
- incorrect header case
- duplicate serial
- invalid business step
- invalid expiry format
- cross-row parent failure if verified
- verified blocking rule fails verdict
- unverified rule does not fail verdict

## Acceptance

A real uploaded file is evaluated row by row with exact finding provenance.

## Exit gate

EPTTS preflight is founder-demo ready and honest about rule verification.

---

# PHASE 8 — CLUSTER RESOLVE PRODUCT UI

## Goal

Turn the engines into a focused founder-facing product that is understandable in under three minutes.

## UI principle

Every main screen begins with:

> What needs attention and why?

Not generic dashboard decoration.

No hardcoded operational KPI values.

## Primary screens

## Screen 1 — Resolve / Operations `/`

Purpose:
**What needs attention now?**

Show compact actionable items:

- order exceptions
- deteriorating suppliers
- high-regret decisions
- EDA exposures
- expiry exposure

Example cards/list rows:

- “Order #10942 — partial fill + supplier deterioration”
- “Supplier S-18 — fill rate down 15 points”
- “EDA notice — 12 possible exposed orders”
- “EGP 18,420 near-expiry value”

Every item drills down.

## Screen 2 — Orders `/orders`

Columns:

- order
- pharmacy
- placed time
- selected supplier
- requested vs filled
- delivery
- exception status
- decision-quality status
- regulatory exposure status

Filters:

- healthy
- late
- partial
- cancelled
- high regret
- regulatory exposure

## Screen 3 — Decision Replay `/decisions/[id]`

This is the hero technical page.

Sections follow Phase 5.

The page must explain the decision without a developer narrating the database.

## Screen 4 — Suppliers `/suppliers` and detail

List:

- supplier
- status
- n evaluated orders
- fill
- OTIF
- cancellation
- partial fill
- P95 lead time
- recent-vs-baseline change

Detail:

- reliability summary
- deterioration triggers
- recent vs baseline
- affected orders
- affected decisions

No supplier stock/order-management recreation.

## Screen 5 — Regulatory `/regulatory`

Tabs:

- EDA Alerts
- Exposure
- Expiry Recovery

Clearly label EDA source acquisition:

- `Official EDA`
- `Manual-assisted ingestion`

Do not imply automatic sync.

## Screen 6 — Traceability `/traceability`

EPTTS preflight experience.

## Data/source area

Do not necessarily add a seventh primary nav screen.

A data/source drawer, settings area, or secondary `/data` page may show:

- current dataset
- mode
- data sources
- import jobs
- coverage
- sample/live/imported labeling

## Branding

Use public-site-derived Cluster visual language only where verified.

Keep:
- clean
- light
- responsive
- mobile-friendly
- high contrast
- restrained cards
- actionable hierarchy

Do not clone a private UI you do not have.

Do not convert the app to React Native.

Keep responsive Next.js so:
- desktop works
- mobile viewport feels natural
- one Vercel deployment remains possible

Display:
**Unofficial candidate prototype**

persistently but unobtrusively.

## Shared UI contracts

### Data mode chip

- LIVE
- IMPORTED REAL
- SAMPLE

### Evidence affordance

Every major metric/result should have:
- “Show underlying records”
or equivalent drill-down.

### Empty state honesty

Examples:

- “No outcome data imported yet.”
- “Supplier reliability cannot be calculated until outcomes exist.”
- “No EDA documents have been ingested.”
- “No decisions can be evaluated without candidate/offers data.”

Never show `0` when the real state is “no data.”

## Tests

Playwright:

- empty DB shows no fake KPIs
- SAMPLE banner present for sample dataset
- import changes UI
- supplier drill-down reaches underlying orders
- decision replay arithmetic consistent
- official EDA artifact visible with provenance
- EPTTS finding reaches correct row
- mobile viewport has no unusable navigation/layout

## Acceptance

A co-founder can understand:
- the problem
- the evidence
- the action
within three minutes.

## Exit gate

All founder-visible features are connected to real persisted data paths.

---

# PHASE 9 — FOUNDER-READY E2E, DEPLOYMENT, AND DEMO

## Goal

Prove the product actually works end-to-end on the target hosting stack.

## 9.1 Deterministic demo dataset

Build a deterministic sample generator.

Do not create random pretty numbers.

Seed known scenarios:

- healthy supplier
- deteriorating supplier
- cancellation spike
- late-delivery pattern
- partial-fill pattern
- healthy decision
- selected-cheapest-but-bad-outcome decision
- selected-more-expensive-but-good-outcome decision
- no-alternative decision
- low-data decision
- expiry-risk lots

Create a benchmark manifest with expected detections.

Examples:

- `SUP-DETERIORATION-01` expected `HIGH`
- `ORDER-PARTIAL-01` expected `PARTIAL_FILL`
- `DECISION-REGRET-01` expected unfilled qty = known value

Tests must prove expected detections.

## 9.2 Real-data proof points

The final deployment must demonstrate:

### Real official public data
At least one official EDA notice/PDF is ingested with:
- source URL
- archived artifact
- normalized fields
- match result
- exposure result

### Real file processing
A real CSV/JSON file goes through the normal import pipeline.

### Real EPTTS processing
An uploaded fixture/file is actually parsed and findings cite actual rows.

## 9.3 Performance benchmark

Measure:

- founder-demo import size
- supplier evaluation
- decision evaluation
- EDA PDF parsing
- EPTTS realistic/max-style file

Only if a measured task threatens function duration/memory:

create a documented amendment proposing Vercel Workflows for that task alone.

Do not globally introduce workflow infrastructure.

## 9.4 Deployment

Final target:

```text
GitHub
   ↓
one Vercel project
   ↓
full-stack Next.js
   ↓
Supabase hosted Postgres + Storage
```

During Phases 2–8:
- continue using currently linked hosted DEV project

At Phase 9:
- prefer a separate clean Supabase demo/production project if a free project slot is available
- otherwise do not block the demo merely for environment purity; use the linked demo project after a deliberate reset/seed procedure and document it honestly

Apply migrations only from files.

No manual schema drift.

## 9.5 Git workflow

For Phases 2–8:
- local phase-scoped commits
- no need for remote PR workflow

Phase 9:
- secret scan
- add/verify GitHub remote
- push full history
- run GitHub Actions
- connect one Vercel project
- deploy
- run production smoke tests

## 9.6 Founder demo flow — target under 3 minutes

### 0:00–0:20 — Problem

> “Cluster already optimizes procurement. Resolve is the reliability layer around what happens after the decision.”

### 0:20–0:50 — Resolve

Show:
- one critical order exception
- one deteriorating supplier
- one regulatory/expiry item

### 0:50–1:30 — Decision Replay

Show:
- candidates
- selected supplier
- actual outcome
- why result was bad
- alternative
- regret components

### 1:30–1:55 — Supplier deterioration

Open supplier:
- recent vs baseline
- affected orders/decisions

### 1:55–2:20 — EDA

Show a real official EDA document:
- source
- normalized notice
- matched products
- potential exposure

### 2:20–2:40 — Expiry Recovery

Show:
- expired/near-expiry value
- supplier recovery-preparation export

### 2:40–3:00 — EPTTS

Upload invalid file:
- deterministic finding
- row
- verified rule/source

Close:

> “The procurement dataset can be sample or imported real data, the EDA artifact is official public data, every result is persisted and traceable, and I did not rebuild the functionality Cluster already publicly advertises.”

## 9.7 Final acceptance checklist

Project is DONE only if all are true:

- [ ] Phase 0 and 1 remain intact.
- [ ] No Docker dependency exists.
- [ ] No Auth/RBAC/multi-tenancy was added.
- [ ] No fake Cluster production connection exists.
- [ ] Sample data is visibly SAMPLE.
- [ ] Imported real data is visibly IMPORTED_REAL.
- [ ] Official EDA data is identified as official and acquisition mode is visible.
- [ ] Refresh does not erase operational state.
- [ ] Redeploy does not erase operational state.
- [ ] CSV/JSON import changes persisted records.
- [ ] Order exceptions derive from outcomes.
- [ ] Supplier deterioration links to underlying orders.
- [ ] Decision Replay uses decision-time data.
- [ ] Regret components are reproducible.
- [ ] Estimated monetary regret displays assumptions.
- [ ] EDA fuzzy matches remain POSSIBLE.
- [ ] Exposure distinguishes exact vs possible matches.
- [ ] Expiry recovery totals are derived from inventory-lot rows.
- [ ] EPTTS only lets verified blocking rules fail preflight.
- [ ] Every EPTTS finding cites a row/rule/source.
- [ ] No screen shows hardcoded operational metrics.
- [ ] Empty DB produces honest empty states.
- [ ] Mobile viewport is usable.
- [ ] lint PASS.
- [ ] typecheck PASS.
- [ ] tests PASS.
- [ ] build PASS.
- [ ] production smoke PASS.
- [ ] full commit history pushed.
- [ ] live Vercel URL works.

---

# 10. Phase Dependency Graph

```text
P0 COMPLETE
   ↓
P1 COMPLETE
   ↓
P2 Data Foundation
   ↓
P3 Real Ingestion
   ↓
P4 Exceptions + Supplier Reliability
   ↓
P5 Decision Replay + Regret
   ↓
P6 EDA Exposure + Expiry Recovery
   ↓
P7 EPTTS Preflight
   ↓
P8 Resolve Product UI
   ↓
P9 E2E + Deploy + Founder Demo
```

P6 and P7 may be developed in either order after P3 if useful, but the recommended single-implementer path above keeps focus on the core procurement-reliability story first.

---

# 11. Critical Path

The critical founder-value path is:

```text
P2
→ P3
→ P4
→ P5
→ P8
→ P9
```

This proves the core statement:

> Resolve knows what went wrong after procurement decisions and can explain the business impact.

EDA / Expiry and EPTTS are important differentiators but should not delay the core loop if a blocker occurs.

Priority order if time becomes constrained:

1. real ingestion
2. order exceptions
3. supplier deterioration
4. decision replay
5. regret
6. EDA exposure
7. expiry recovery
8. EPTTS
9. extra polish

Do not cut data honesty, persistence, or traceability.

---

# 12. Anti-Over-Engineering Rules

Before adding any table, abstraction, package, dependency, job system, API layer, or service, ask:

> Does this directly enable a founder-visible product flow in P2–P9?

If NO:
do not add it.

Specific rules:

- One simple table is preferable to three normalized “future proof” tables if the extra tables add no current value.
- Do not persist derived data that is cheap and safe to compute on demand unless persistence improves traceability/performance.
- Do not build generic policy-management UI.
- Do not build a framework for one implementation.
- Do not build Workflows because Vercel offers them.
- Do not build a scraper because automation sounds impressive.
- Do not build ML where deterministic logic solves the problem.
- Do not add statistical significance machinery where a clear operational threshold is more understandable.
- Do not build multi-tenancy before a second tenant exists.
- Do not add “enterprise” labels/features just to make the project look mature.

Strong engineering here means:
- correct data
- deterministic logic
- traceable results
- good error handling
- testable code
- fast understandable UI
- real deployment

---

# 13. Anti-Hallucination Rules

Every claim must be one of:

- `VERIFIED`
- `PUBLICLY NOT OBSERVED`
- `NEEDS_VERIFICATION`

Regarding Cluster:

Allowed:
> “I could not find this capability in the researched public product/materials.”

Not allowed:
> “Cluster definitely does not have this internally.”

Regarding EDA/EPTTS:

- only primary/verified project sources can define blocking rules
- no invented rule
- no invented source URL
- no invented match
- no fake “live sync”
- manual-assisted acquisition must be labeled manual-assisted

Regarding application completion:

Never claim:
- migration applied
- test passed
- Git commit exists
- source connected
- data imported
unless command/data evidence exists.

---

# 14. Data / Sample Matrix

| Data | Mode | Real? | Acquisition | Founder demo use |
|---|---|---:|---|---|
| Deterministic procurement demo dataset | SAMPLE | No, synthetic | generator | Core flows before real Cluster data exists |
| Authorized pharmacy procurement CSV | IMPORTED_REAL | Yes | file import | Best optional proof |
| Official EDA notice/PDF | LIVE | Yes | MANUAL_ASSISTED | Real external proof |
| Future EDA automatic discovery | LIVE | Yes | AUTOMATED | Deferred |
| EPTTS uploaded file | LIVE or IMPORTED_REAL depending source | Real file processing | file upload | Rule-validation proof |
| Cluster production | N/A | Not connected | none | Always NOT_CONNECTED / READY_FOR_INTEGRATION |

---

# 15. Open Risks

## R1 — Real Cluster order data is unavailable

Mitigation:
- deterministic sample benchmark
- real import contracts
- optional authorized pharmacy dataset
- no fake Cluster claims

## R2 — Decision candidate history is incomplete

Mitigation:
- explicit candidates when available
- fallback derivation from offers at/before decision time
- `candidate_source` shown
- lower confidence rather than fabrication

## R3 — Monetary regret feels arbitrary

Mitigation:
- lead with component metrics
- optional monetary estimate
- show exact policy assumptions
- do not call estimate ground truth

## R4 — Supplier deterioration false positives

Mitigation:
- minimum sample sizes
- transparent thresholds
- WATCH tier
- underlying-order drill-down

## R5 — EDA PDF parsing is inconsistent

Mitigation:
- archive real artifact
- deterministic text extraction first
- manual field confirmation
- no invented values
- OCR only after measured need

## R6 — EDA acquisition cannot be automated reliably

Not a v1 blocker.

Manual-assisted is the supported v1 path.

## R7 — EPTTS rule ambiguity

Mitigation:
- VERIFIED vs NEEDS_VERIFICATION
- only verified blocking rules affect verdict

## R8 — File processing approaches Vercel limits

Mitigation:
- benchmark first
- direct Storage upload
- streaming parse
- only then introduce Workflow for the specific task

## R9 — Scope expands again

Mitigation:
- P2–P9 only
- one phase at a time
- no forecast module
- no auth
- no enterprise job framework

---

# 16. Exact Next Action

**Do not implement the old Phase 2.**

The old Phase 2 (Auth/RLS/tenancy) is obsolete for this product.

The next task is:

# PHASE 2 — PROCUREMENT OUTCOME DATA FOUNDATION

Before writing code:

1. inspect the current repository
2. confirm Phase 0/1 working files are present
3. identify any leftover old-plan artifacts that would conflict with P2
4. do not delete harmless unused files merely for cleanup
5. produce an exact Phase-2 execution checklist:
   - migration filenames
   - exact table definitions
   - repository files
   - test files
   - commands
   - acceptance evidence
6. then implement **Phase 2 only**
7. stop before Phase 3

At Phase-2 completion return evidence for:

- `supabase db push --dry-run`
- migration apply
- remote tables
- generated types
- dataset write/read
- lint
- typecheck
- tests
- build
- git status
- `git log -1 --oneline`

Final required status:

```text
PHASE 0: FROZEN / COMPLETE
PHASE 1: FROZEN / COMPLETE
PHASE 2: PASS / FAIL
PHASE 3: NOT STARTED

AUTH IMPLEMENTED: NO
RLS IMPLEMENTED: NO
MULTI-TENANCY IMPLEMENTED: NO
DOCKER USED: NO
VERCEL WORKFLOWS IMPLEMENTED: NO
MOCK OPERATIONAL KPI VALUES: NO
```

---

# 17. Instructions for a New Coding Agent / Antigravity Plan Mode

Use the following rules when taking over the repository:

1. Read this plan first.
2. Inspect the repository before proposing changes.
3. Treat Phase 0 and Phase 1 as frozen completed work.
4. Do not attempt to “repair” the old enterprise plan.
5. This revised document supersedes the old plan from Phase 2 onward.
6. Preserve working Phase-0/1 code unless it directly conflicts with this document.
7. Never rebuild the repository from scratch.
8. Never introduce Docker.
9. Do not implement Auth/RLS/multi-tenancy.
10. Do not implement Workflows/watchdog until measured evidence requires them.
11. Keep the product centered on procurement reliability, decision quality, EDA exposure, expiry recovery and EPTTS preflight.
12. Use real/persisted data flows.
13. Keep SAMPLE clearly labeled.
14. Do not claim Cluster lacks an internal feature; use `PUBLICLY NOT OBSERVED`.
15. Implement one phase at a time and stop at each exit gate.
16. Do not silently expand scope.
17. If a conflict appears between the old plan and this plan, **this revised plan wins for Phase 2 onward**.

**Current next phase: PHASE 2 ONLY.**
