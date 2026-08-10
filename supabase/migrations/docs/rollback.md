# Migration rollback notes

## 0001_extensions_helpers
- Rollback: `drop function if exists set_updated_at() cascade; drop extension if exists pg_trgm; drop extension if exists citext;`
- Do NOT drop pgcrypto (other objects may depend on gen_random_uuid).
