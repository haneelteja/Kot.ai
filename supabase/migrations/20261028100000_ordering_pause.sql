-- OWN-03/BR-03 (partial): temporary ordering pause. Null = not paused.
-- A full per-branch pause model needs BR-01 (branches table, not built in
-- this codebase) — this is the single-location equivalent: one flag per
-- tenant, enough for the "PAUSE <minutes>" / "RESUME" owner commands and
-- the current single-location product.
alter table tenants add column if not exists ordering_paused_until timestamptz;
