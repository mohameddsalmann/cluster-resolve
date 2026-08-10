-- Initial migration — extensions and helper functions
-- Migration 0001

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";
create extension if not exists "citext";

-- gen_random_uuid() is provided by pgcrypto

-- Helper: updated_at trigger
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
