-- PRC-01: server-side bill calculator — tax + packing charge, applied to
-- every checkout. tax_rate_bp is basis points (500 = 5%); both default to
-- 0 so existing tenants' bills are unchanged until they configure this.

alter table tenants add column if not exists tax_rate_bp integer not null default 0
  check (tax_rate_bp >= 0 and tax_rate_bp <= 10000);
alter table tenants add column if not exists packing_charge_paise integer not null default 0
  check (packing_charge_paise >= 0);

alter table checkout_drafts add column if not exists subtotal_paise bigint;
alter table checkout_drafts add column if not exists tax_paise bigint not null default 0;
alter table checkout_drafts add column if not exists packing_charge_paise bigint not null default 0;
update checkout_drafts set subtotal_paise = total_paise where subtotal_paise is null;
alter table checkout_drafts alter column subtotal_paise set not null;

alter table orders add column if not exists subtotal_paise bigint;
alter table orders add column if not exists tax_paise bigint not null default 0;
alter table orders add column if not exists packing_charge_paise bigint not null default 0;
update orders set subtotal_paise = total_paise where subtotal_paise is null and total_paise is not null;
