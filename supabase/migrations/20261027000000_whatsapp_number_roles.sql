-- WAB-06: separate customer/kitchen/ops WhatsApp numbers per restaurant.
-- Additive-only, defaults every existing row to 'customer' so nothing
-- changes for tenants with only one number configured (the required
-- fallback behaviour — see lib/number-roles.ts).
alter table whatsapp_numbers
  add column if not exists role text not null default 'customer'
    check (role in ('customer', 'kitchen', 'ops'));

create index if not exists idx_whatsapp_numbers_role
  on whatsapp_numbers(tenant_id, product_slug, role) where active = true;
