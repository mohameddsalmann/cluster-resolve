-- Chunk 4 — Regulatory Intelligence + EPTTS Preflight + Expiry + Traceability Reconciliation
-- 20260815000002_chunk4_regulatory_traceability.sql
-- Additive only: official EDA notices (global), exposures (dataset-scoped),
-- traceability imports, findings, canonical events, GTIN crosswalks, and order reconciliations.

-- 1. regulatory_notices (Global repository of public EDA notices)
create table if not exists regulatory_notices (
  id                      uuid        primary key default gen_random_uuid(),
  notice_number           text        not null,
  title                   text        not null,
  year                    integer     not null check (year between 2000 and 2100),
  notice_type             text        not null check (notice_type in ('RECALL', 'ALERT', 'COMMERCIAL_FRAUD', 'AWARENESS', 'OTHER')),
  recall_class            text        check (recall_class in ('CLASS_I', 'CLASS_II', 'CLASS_III')),
  product_name            text        not null,
  product_name_normalized text        not null,
  manufacturer            text,
  manufacturer_normalized text,
  batch_numbers           text[]      not null default '{}',
  registration_number     text,
  reason                  text,
  source_url              text        not null,
  source_authority        text        not null default 'Egyptian Drug Authority',
  source_doc_code         text,
  source_version          text,
  source_checksum         text,
  retrieved_at            timestamptz not null default now(),
  created_at              timestamptz not null default now(),

  unique (notice_number, year)
);

create index if not exists idx_reg_notices_year on regulatory_notices (year desc);
create index if not exists idx_reg_notices_prod_norm on regulatory_notices (product_name_normalized);

-- 2. regulatory_exposures (Dataset-scoped exposure findings)
create table if not exists regulatory_exposures (
  id                      uuid        primary key default gen_random_uuid(),
  dataset_id              uuid        not null references datasets(id) on delete cascade,
  notice_id               uuid        not null references regulatory_notices(id) on delete cascade,
  match_status            text        not null check (match_status in ('EXACT', 'POSSIBLE', 'UNMATCHED')),
  match_reason            text        not null,
  matched_product_id      uuid,
  affected_orders_count   integer     not null default 0 check (affected_orders_count >= 0),
  affected_pharmacies_count integer   not null default 0 check (affected_pharmacies_count >= 0),
  affected_suppliers_count  integer   not null default 0 check (affected_suppliers_count >= 0),
  requested_units         integer     not null default 0 check (requested_units >= 0),
  filled_units            integer     not null default 0 check (filled_units >= 0),
  historical_value_minor  bigint      not null default 0 check (historical_value_minor >= 0),
  evidence_json           jsonb       not null default '{}'::jsonb,
  evaluated_at            timestamptz not null default now(),
  created_at              timestamptz not null default now(),

  unique (dataset_id, notice_id),
  foreign key (dataset_id, matched_product_id) references products(dataset_id, id) on delete set null
);

create index if not exists idx_reg_exp_dataset_status on regulatory_exposures (dataset_id, match_status);

-- 3. traceability_imports (Dataset-scoped file uploads and preflight summaries)
create table if not exists traceability_imports (
  id                      uuid        primary key default gen_random_uuid(),
  dataset_id              uuid        not null references datasets(id) on delete cascade,
  filename                text        not null,
  format                  text        not null check (format in ('CSV', 'XML_BARE', 'XML_SOAP')),
  storage_path            text        not null,
  file_sha256             text        not null,
  file_size_bytes         integer     not null check (file_size_bytes >= 0),
  preflight_status        text        not null check (preflight_status in ('PASS', 'FAIL')),
  total_rows              integer     not null default 0 check (total_rows >= 0),
  event_count             integer     not null default 0 check (event_count >= 0),
  serial_count            integer     not null default 0 check (serial_count >= 0),
  batch_count             integer     not null default 0 check (batch_count >= 0),
  finding_count           integer     not null default 0 check (finding_count >= 0),
  rules_version           text        not null,
  instance_identifier     text,
  sender_gln              text,
  receiver_gln            text,
  created_at              timestamptz not null default now(),

  unique (dataset_id, file_sha256)
);

create index if not exists idx_trace_imports_dataset on traceability_imports (dataset_id, created_at desc);

-- 4. traceability_findings (Preflight findings & rule violations)
create table if not exists traceability_findings (
  id                      uuid        primary key default gen_random_uuid(),
  dataset_id              uuid        not null references datasets(id) on delete cascade,
  import_id               uuid        not null references traceability_imports(id) on delete cascade,
  code                    text        not null,
  severity                text        not null check (severity in ('ERROR', 'WARNING')),
  row_or_event_index      integer,
  field                   text,
  message                 text        not null,
  evidence                text,
  official_rule_reference text        not null,
  created_at              timestamptz not null default now()
);

create index if not exists idx_trace_findings_import on traceability_findings (import_id);

-- 5. traceability_events (Canonical serialized events from valid files)
create table if not exists traceability_events (
  id                      uuid        primary key default gen_random_uuid(),
  dataset_id              uuid        not null references datasets(id) on delete cascade,
  import_id               uuid        not null references traceability_imports(id) on delete cascade,
  event_type              text        not null check (event_type in ('COMMISSIONING', 'PACKING', 'SHIPPING')),
  event_time              timestamptz not null,
  timezone_offset         text,
  epc                     text        not null,
  gtin                    text,
  serial                  text,
  sscc                    text,
  batch                   text,
  expiry_date             date,
  manufacturing_date      date,
  parent_epc              text,
  read_point_gln          text        not null,
  biz_location_gln        text        not null,
  source_gln              text,
  destination_gln         text,
  biz_transaction_ref     text,
  source_format           text        not null check (source_format in ('CSV', 'XML_BARE', 'XML_SOAP')),
  source_index            integer     not null,
  created_at              timestamptz not null default now(),

  unique (dataset_id, import_id, source_index)
);

create index if not exists idx_trace_events_dataset_gtin on traceability_events (dataset_id, gtin);
create index if not exists idx_trace_events_dataset_epc on traceability_events (dataset_id, epc);
create index if not exists idx_trace_events_dataset_expiry on traceability_events (dataset_id, expiry_date);

-- 6. traceability_product_links (Product <-> GTIN crosswalk)
create table if not exists traceability_product_links (
  id                      uuid        primary key default gen_random_uuid(),
  dataset_id              uuid        not null references datasets(id) on delete cascade,
  product_id              uuid        not null,
  gtin                    text        not null,
  status                  text        not null check (status in ('CONFIRMED', 'SUGGESTED')),
  confidence_reason       text        not null,
  created_at              timestamptz not null default now(),

  unique (dataset_id, product_id, gtin),
  foreign key (dataset_id, product_id) references products(dataset_id, id) on delete cascade
);

create index if not exists idx_trace_prod_links_gtin on traceability_product_links (dataset_id, gtin);

-- 7. traceability_reconciliations (Order <-> Traceability reconciliation results)
create table if not exists traceability_reconciliations (
  id                      uuid        primary key default gen_random_uuid(),
  dataset_id              uuid        not null references datasets(id) on delete cascade,
  order_id                uuid        not null,
  product_id              uuid        not null,
  reconciliation_status   text        not null check (reconciliation_status in ('MATCH', 'MISMATCH', 'INSUFFICIENT_LINKAGE', 'INSUFFICIENT_TRACEABILITY_DATA')),
  operational_qty         integer     not null default 0 check (operational_qty >= 0),
  traceability_qty        integer     not null default 0 check (traceability_qty >= 0),
  difference_qty          integer     not null default 0,
  business_ref            text,
  linked_import_id        uuid        references traceability_imports(id) on delete set null,
  evidence_json           jsonb       not null default '{}'::jsonb,
  reconciled_at           timestamptz not null default now(),
  created_at              timestamptz not null default now(),

  unique (dataset_id, order_id, product_id),
  foreign key (dataset_id, order_id) references orders(dataset_id, id) on delete cascade,
  foreign key (dataset_id, product_id) references products(dataset_id, id) on delete cascade
);

create index if not exists idx_trace_rec_status on traceability_reconciliations (dataset_id, reconciliation_status);

-- 8. Storage bucket for traceability uploads
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'traceability-imports',
  'traceability-imports',
  false,
  20971520,
  array['text/csv', 'application/csv', 'text/xml', 'application/xml', 'text/plain']
)
on conflict (id) do update set
  public = false,
  file_size_limit = 20971520,
  allowed_mime_types = array['text/csv', 'application/csv', 'text/xml', 'application/xml', 'text/plain'];

-- 9. Grants for service_role
grant select, insert, update, delete on table
  regulatory_notices,
  regulatory_exposures,
  traceability_imports,
  traceability_findings,
  traceability_events,
  traceability_product_links,
  traceability_reconciliations
to service_role;
