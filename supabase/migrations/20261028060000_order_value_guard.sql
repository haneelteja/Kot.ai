-- PRC-05: minimum (takeaway/pickup) order value + an optional sanity-check
-- maximum. Both default to "no restriction" (min 0, max null) so existing
-- tenants are unaffected until they configure this.
alter table tenants add column if not exists min_order_value_paise integer not null default 0
  check (min_order_value_paise >= 0);
alter table tenants add column if not exists max_order_value_paise integer
  check (max_order_value_paise is null or max_order_value_paise > 0);
