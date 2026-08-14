-- Phase 2 — Procurement Outcome Data Foundation
-- Migration 20260810000001_procurement_foundation.sql
-- 12 tables with composite dataset integrity constraints

-- 1. datasets
create table datasets (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null,
  mode        text        not null check (mode in ('LIVE', 'IMPORTED_REAL', 'SAMPLE')),
  description text,
  created_at  timestamptz not null default now(),

  unique (id)
);

create index idx_datasets_mode on datasets (mode);

-- 2. data_sources
create table data_sources (
  id               uuid        primary key default gen_random_uuid(),
  dataset_id       uuid        not null references datasets(id),
  kind             text        not null check (kind in ('EDA', 'CSV', 'JSON', 'EPTTS', 'SAMPLE_GENERATOR')),
  acquisition_mode text        not null check (acquisition_mode in ('MANUAL_ASSISTED', 'AUTOMATED', 'FILE_IMPORT', 'GENERATED')),
  name             text        not null,
  source_url       text,
  status           text        not null default 'NOT_CONNECTED' check (status in ('READY', 'PROCESSING', 'FAILED', 'NOT_CONNECTED')),
  last_ingested_at timestamptz,
  created_at       timestamptz not null default now(),

  unique (dataset_id, id)
);

create index idx_data_sources_dataset_id on data_sources (dataset_id);

-- 3. ingestion_jobs
create table ingestion_jobs (
  id                uuid        primary key default gen_random_uuid(),
  dataset_id        uuid        not null references datasets(id),
  source_id         uuid,
  kind              text        not null,
  status            text        not null default 'PENDING' check (status in ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')),
  original_filename text,
  storage_path      text,
  file_sha256       text,
  total_rows        integer,
  processed_rows    integer     not null default 0,
  valid_rows        integer     not null default 0,
  error_rows        integer     not null default 0,
  error_message     text,
  started_at        timestamptz,
  finished_at       timestamptz,
  created_at        timestamptz not null default now(),

  unique (dataset_id, id),
  foreign key (dataset_id, source_id) references data_sources(dataset_id, id)
);

create index idx_ingestion_jobs_dataset_id on ingestion_jobs (dataset_id);

-- 4. products
create table products (
  id                      uuid        primary key default gen_random_uuid(),
  dataset_id              uuid        not null references datasets(id),
  external_product_id     text        not null,
  sku                     text,
  name                    text        not null,
  name_normalized         text        not null,
  manufacturer            text,
  manufacturer_normalized text,
  gtin                    text,
  created_at              timestamptz not null default now(),

  unique (dataset_id, external_product_id),
  unique (dataset_id, id)
);

create unique index idx_products_dataset_gtin on products (dataset_id, gtin) where gtin is not null;
create index idx_products_name_normalized on products (name_normalized);

-- 5. pharmacies
create table pharmacies (
  id                   uuid        primary key default gen_random_uuid(),
  dataset_id           uuid        not null references datasets(id),
  external_pharmacy_id text        not null,
  name                 text,
  governorate          text,
  city                 text,
  created_at           timestamptz not null default now(),

  unique (dataset_id, external_pharmacy_id),
  unique (dataset_id, id)
);

-- 6. suppliers
create table suppliers (
  id                   uuid        primary key default gen_random_uuid(),
  dataset_id           uuid        not null references datasets(id),
  external_supplier_id text        not null,
  name                 text        not null,
  name_normalized      text        not null,
  governorate          text,
  city                 text,
  created_at           timestamptz not null default now(),

  unique (dataset_id, external_supplier_id),
  unique (dataset_id, id)
);

-- 7. orders
create table orders (
  id                      uuid        primary key default gen_random_uuid(),
  dataset_id              uuid        not null references datasets(id),
  external_order_id       text        not null,
  pharmacy_id             uuid        not null,
  status                  text        not null,
  placed_at               timestamptz not null,
  source_ingestion_job_id uuid,
  created_at              timestamptz not null default now(),

  unique (dataset_id, external_order_id),
  unique (dataset_id, id),
  foreign key (dataset_id, pharmacy_id) references pharmacies(dataset_id, id),
  foreign key (dataset_id, source_ingestion_job_id) references ingestion_jobs(dataset_id, id)
);

create index idx_orders_pharmacy_id on orders (pharmacy_id);
create index idx_orders_placed_at on orders (placed_at);

-- 8. order_items
create table order_items (
  id            uuid        primary key default gen_random_uuid(),
  dataset_id    uuid        not null references datasets(id),
  order_id      uuid        not null,
  product_id    uuid        not null,
  requested_qty integer     not null check (requested_qty > 0),
  unit          text        not null default 'pack',
  created_at    timestamptz not null default now(),

  unique (order_id, product_id),
  foreign key (dataset_id, order_id) references orders(dataset_id, id),
  foreign key (dataset_id, product_id) references products(dataset_id, id)
);

-- 9. supplier_offers
create table supplier_offers (
  id                      uuid        primary key default gen_random_uuid(),
  dataset_id              uuid        not null references datasets(id),
  external_offer_id       text        not null,
  order_id                uuid        not null,
  supplier_id             uuid        not null,
  product_id              uuid        not null,
  available_qty           integer     not null check (available_qty >= 0),
  unit_price_minor        bigint      not null check (unit_price_minor >= 0),
  discount_bps            integer     not null default 0 check (discount_bps between 0 and 10000),
  promised_delivery_at    timestamptz,
  offered_at              timestamptz not null,
  source_ingestion_job_id uuid,
  created_at              timestamptz not null default now(),

  unique (dataset_id, external_offer_id),
  foreign key (dataset_id, order_id) references orders(dataset_id, id),
  foreign key (dataset_id, supplier_id) references suppliers(dataset_id, id),
  foreign key (dataset_id, product_id) references products(dataset_id, id),
  foreign key (dataset_id, source_ingestion_job_id) references ingestion_jobs(dataset_id, id)
);

create index idx_supplier_offers_order_id on supplier_offers (order_id);
create index idx_supplier_offers_supplier_id on supplier_offers (supplier_id);

-- 10. order_outcomes
create table order_outcomes (
  id                      uuid        primary key default gen_random_uuid(),
  dataset_id              uuid        not null references datasets(id),
  order_id                uuid        not null,
  supplier_id             uuid        not null,
  product_id              uuid        not null,
  filled_qty              integer     not null check (filled_qty >= 0),
  delivered_at            timestamptz,
  cancelled               boolean     not null default false,
  cancellation_reason     text,
  outcome_final           boolean     not null default false,
  source_ingestion_job_id uuid,
  created_at              timestamptz not null default now(),

  unique (dataset_id, order_id, supplier_id, product_id),
  foreign key (dataset_id, order_id) references orders(dataset_id, id),
  foreign key (dataset_id, supplier_id) references suppliers(dataset_id, id),
  foreign key (dataset_id, product_id) references products(dataset_id, id),
  foreign key (dataset_id, source_ingestion_job_id) references ingestion_jobs(dataset_id, id)
);

create index idx_order_outcomes_order_id on order_outcomes (order_id);
create index idx_order_outcomes_supplier_id on order_outcomes (supplier_id);

-- 11. ai_decisions
create table ai_decisions (
  id                      uuid          primary key default gen_random_uuid(),
  dataset_id              uuid          not null references datasets(id),
  external_decision_id    text          not null,
  order_id                uuid          not null,
  selected_supplier_id    uuid          not null,
  decided_at              timestamptz   not null,
  agent_name              text,
  agent_version           text,
  confidence              numeric(5,4)  check (confidence is null or (confidence >= 0 and confidence <= 1)),
  selection_reason        text,
  input_snapshot_json     jsonb,
  source_ingestion_job_id uuid,
  created_at              timestamptz   not null default now(),

  unique (dataset_id, external_decision_id),
  unique (dataset_id, id),
  foreign key (dataset_id, order_id) references orders(dataset_id, id),
  foreign key (dataset_id, selected_supplier_id) references suppliers(dataset_id, id),
  foreign key (dataset_id, source_ingestion_job_id) references ingestion_jobs(dataset_id, id)
);

create index idx_ai_decisions_order_id on ai_decisions (order_id);

-- 12. ai_decision_candidates
create table ai_decision_candidates (
  id                uuid        primary key default gen_random_uuid(),
  dataset_id        uuid        not null references datasets(id),
  decision_id       uuid        not null,
  supplier_id       uuid        not null,
  rank              integer,
  score             numeric,
  feasible          boolean     not null default true,
  infeasible_reason text,
  feature_values    jsonb,
  created_at        timestamptz not null default now(),

  unique (decision_id, supplier_id),
  foreign key (dataset_id, decision_id) references ai_decisions(dataset_id, id),
  foreign key (dataset_id, supplier_id) references suppliers(dataset_id, id)
);

-- Server-only Supabase Data API access. No browser/anon/authenticated grants are made.
grant usage on schema public to service_role;
grant select, insert, update, delete on table
  datasets,
  data_sources,
  ingestion_jobs,
  products,
  pharmacies,
  suppliers,
  orders,
  order_items,
  supplier_offers,
  order_outcomes,
  ai_decisions,
  ai_decision_candidates
to service_role;
