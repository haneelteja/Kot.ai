-- ============================================================================
-- FIX: service_role missing INSERT/UPDATE/DELETE on 46 of 74 public tables
-- ============================================================================
-- Discovered live: a brand-new project bootstrapped from this repo's
-- migrations left service_role with only SELECT/TRUNCATE/REFERENCES/TRIGGER
-- on most tables (contacts, conversations, messages, orders, payments,
-- tenants, tenant_users, whatsapp_numbers, ...) — every INSERT from
-- apps/api (which runs entirely as service_role) would have failed with
-- "permission denied for table X" once deployed. service_role already
-- bypasses RLS by design (BYPASSRLS), so granting full table privileges
-- here restores intended behaviour, not a security downgrade.
--
-- ALTER DEFAULT PRIVILEGES ensures tables created by *future* migrations
-- get the same grants automatically, so this class of bug can't recur.

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
