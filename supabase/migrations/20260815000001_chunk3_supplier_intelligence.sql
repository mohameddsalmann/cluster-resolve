-- Chunk 3 — Advanced Supplier Intelligence
-- 20260815000001_chunk3_supplier_intelligence.sql
-- Additive only: new table for per-product reliability snapshots,
-- plus a promise_risk_json column on the existing supplier snapshots table.

-- 1. Per-supplier-per-product reliability snapshots
create table supplier_product_reliability_snapshots (
  id                              uuid        primary key default gen_random_uuid(),
  dataset_id                      uuid        not null references datasets(id),
  supplier_id                     uuid        not null,
  product_id                      uuid        not null,
  as_of_date                      date        not null,
  recent_window_days              integer     not null check (recent_window_days > 0),
  baseline_window_days            integer     not null check (baseline_window_days > 0),
  recent_evaluated_orders         integer     not null check (recent_evaluated_orders >= 0),
  baseline_evaluated_orders       integer     not null check (baseline_evaluated_orders >= 0),
  recent_fill_rate_bps            integer     check (recent_fill_rate_bps between 0 and 10000),
  baseline_fill_rate_bps          integer     check (baseline_fill_rate_bps between 0 and 10000),
  recent_otif_rate_bps            integer     check (recent_otif_rate_bps between 0 and 10000),
  baseline_otif_rate_bps          integer     check (baseline_otif_rate_bps between 0 and 10000),
  recent_cancellation_rate_bps    integer     check (recent_cancellation_rate_bps between 0 and 10000),
  baseline_cancellation_rate_bps  integer     check (baseline_cancellation_rate_bps between 0 and 10000),
  recent_partial_fill_rate_bps    integer     check (recent_partial_fill_rate_bps between 0 and 10000),
  baseline_partial_fill_rate_bps  integer     check (baseline_partial_fill_rate_bps between 0 and 10000),
  recent_lead_time_p50_minutes    integer     check (recent_lead_time_p50_minutes >= 0),
  recent_lead_time_p95_minutes    integer     check (recent_lead_time_p95_minutes >= 0),
  baseline_lead_time_p95_minutes  integer     check (baseline_lead_time_p95_minutes >= 0),
  status                          text        not null check (status in ('HEALTHY', 'WATCH', 'HIGH', 'INSUFFICIENT_DATA')),
  triggers_json                   jsonb       not null default '[]'::jsonb,
  engine_version                  text        not null,
  computed_at                     timestamptz not null,
  created_at                      timestamptz not null default now(),

  unique (dataset_id, supplier_id, product_id, as_of_date, recent_window_days, baseline_window_days, engine_version),
  foreign key (dataset_id, supplier_id) references suppliers(dataset_id, id) on delete cascade,
  foreign key (dataset_id, product_id) references products(dataset_id, id) on delete cascade
);

create index idx_supp_prod_reliability_supplier
  on supplier_product_reliability_snapshots (dataset_id, supplier_id, as_of_date desc);

create index idx_supp_prod_reliability_product
  on supplier_product_reliability_snapshots (dataset_id, product_id, as_of_date desc);

-- 2. Promise risk signal on the existing per-supplier snapshot table
--    promise_risk_json stores: { promiseGivenCount, promiseHonouredCount, promiseHonouredBps, promiseRiskLevel }
alter table supplier_reliability_snapshots
  add column if not exists promise_risk_json jsonb not null default '{}'::jsonb;

-- 3. Grants
grant select, insert, update, delete on table
  supplier_product_reliability_snapshots
to service_role;
