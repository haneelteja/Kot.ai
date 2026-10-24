-- PRC-02: offers engine. One coupon per order (the "one-offer-per-order
-- default" from the acceptance criteria) — there's no multi-coupon-apply
-- flow to stack against, so the "tenant enables stacking" toggle doesn't
-- apply yet and isn't built here.

create table if not exists coupons (
  id                     uuid primary key default gen_random_uuid(),
  tenant_id              uuid not null references tenants(id) on delete cascade,
  code                   text not null,
  type                   text not null check (type in ('percent','flat','free_delivery')),
  value                  integer not null check (value >= 0), -- percent: basis points (1000=10%); flat: paise; free_delivery: unused
  max_uses               integer check (max_uses is null or max_uses > 0),
  uses_count             integer not null default 0,
  min_order_value_paise  integer not null default 0 check (min_order_value_paise >= 0),
  active                 boolean not null default true,
  expires_at             timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (tenant_id, code)
);

create index if not exists idx_coupons_tenant_active on coupons(tenant_id, active);
create trigger coupons_updated_at before update on coupons for each row execute function set_updated_at();

alter table coupons enable row level security;
create policy "coupons_tenant_isolation" on coupons for all
  using (tenant_id in (select tenant_id from tenant_users where user_id = auth.uid()));
grant all on coupons to postgres, anon, authenticated, service_role;

alter table checkout_drafts add column if not exists coupon_code text;
alter table checkout_drafts add column if not exists discount_paise bigint not null default 0;

alter table orders add column if not exists coupon_code text;
alter table orders add column if not exists discount_paise bigint not null default 0;
