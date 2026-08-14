-- Phase 4 — Order Exceptions + Supplier Reliability
-- Additive only: deterministic derived exceptions and compact versioned snapshots.

create table order_exceptions (
  id             uuid        primary key default gen_random_uuid(),
  dataset_id     uuid        not null references datasets(id),
  order_id       uuid        not null,
  supplier_id    uuid,
  product_id     uuid,
  type           text        not null check (type in ('CANCELLED', 'PARTIAL_FILL', 'UNFULFILLED', 'LATE_DELIVERY')),
  severity       text        not null check (severity in ('MEDIUM', 'HIGH')),
  engine_version text        not null,
  evidence_json  jsonb       not null,
  detected_at    timestamptz not null,
  created_at     timestamptz not null default now(),

  foreign key (dataset_id, order_id) references orders(dataset_id, id) on delete cascade,
  foreign key (dataset_id, supplier_id) references suppliers(dataset_id, id) on delete cascade,
  foreign key (dataset_id, product_id) references products(dataset_id, id) on delete cascade
);

create unique index idx_order_exceptions_engine_identity
  on order_exceptions (dataset_id, order_id, supplier_id, product_id, type, engine_version)
  nulls not distinct;
create index idx_order_exceptions_dataset_order
  on order_exceptions (dataset_id, order_id);
create index idx_order_exceptions_dataset_supplier
  on order_exceptions (dataset_id, supplier_id);

create table supplier_reliability_snapshots (
  id                              uuid        primary key default gen_random_uuid(),
  dataset_id                      uuid        not null references datasets(id),
  supplier_id                     uuid        not null,
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

  unique (dataset_id, supplier_id, as_of_date, recent_window_days, baseline_window_days, engine_version),
  foreign key (dataset_id, supplier_id) references suppliers(dataset_id, id) on delete cascade
);

create index idx_supplier_reliability_dataset_status
  on supplier_reliability_snapshots (dataset_id, status, as_of_date desc);

grant select, insert, update, delete on table
  order_exceptions,
  supplier_reliability_snapshots
to service_role;
