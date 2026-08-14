-- Phase 3 — Real Ingestion + Data Quality
-- Additive only: one public table, missing import provenance, file idempotency,
-- and one private raw-import Storage bucket. Quality remains TypeScript-only.

create table ingestion_errors (
  id         uuid        primary key default gen_random_uuid(),
  job_id     uuid        not null references ingestion_jobs(id) on delete cascade,
  row_number integer     not null check (row_number >= 2),
  field      text,
  code       text        not null,
  message    text        not null,
  raw_value  text,
  created_at timestamptz not null default now()
);

create index idx_ingestion_errors_job_row
  on ingestion_errors (job_id, row_number);

-- Identical bytes may legitimately use different canonical import contracts.
-- Failed jobs are excluded so a subsequent controlled retry can claim the hash.
create unique index idx_ingestion_jobs_successful_file
  on ingestion_jobs (dataset_id, kind, file_sha256)
  where file_sha256 is not null and status in ('PROCESSING', 'COMPLETED');

alter table products
  add column source_ingestion_job_id uuid;
alter table products
  add constraint products_dataset_source_job_fkey
  foreign key (dataset_id, source_ingestion_job_id)
  references ingestion_jobs(dataset_id, id);

alter table pharmacies
  add column source_ingestion_job_id uuid;
alter table pharmacies
  add constraint pharmacies_dataset_source_job_fkey
  foreign key (dataset_id, source_ingestion_job_id)
  references ingestion_jobs(dataset_id, id);

alter table suppliers
  add column source_ingestion_job_id uuid;
alter table suppliers
  add constraint suppliers_dataset_source_job_fkey
  foreign key (dataset_id, source_ingestion_job_id)
  references ingestion_jobs(dataset_id, id);

alter table order_items
  add column source_ingestion_job_id uuid;
alter table order_items
  add constraint order_items_dataset_source_job_fkey
  foreign key (dataset_id, source_ingestion_job_id)
  references ingestion_jobs(dataset_id, id);

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
) values (
  'procurement-imports',
  'procurement-imports',
  false,
  10485760,
  array['text/csv', 'application/csv', 'application/vnd.ms-excel', 'text/plain']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

grant select, insert, update, delete on table ingestion_errors to service_role;
