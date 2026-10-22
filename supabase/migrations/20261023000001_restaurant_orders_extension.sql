-- ============================================================================
-- RESTAURANT ORDERS EXTENSION
-- ============================================================================
-- Additive-only changes to the existing `orders` table (never drop/rename —
-- the existing manual lifecycle_bot order + Easebuzz flow depends on the
-- original columns and must keep working unchanged) plus a real normalized
-- order_items table, finally fixing the client-trusted-total gap for
-- restaurant-bot-sourced orders specifically.

create table if not exists order_items (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null references orders(id) on delete cascade,
  menu_item_id     uuid references menu_items(id) on delete set null,
  name             text not null,            -- snapshot: survives menu edits/deletes
  unit_price_paise bigint not null check (unit_price_paise >= 0),
  quantity         integer not null check (quantity > 0),
  line_total_paise bigint not null check (line_total_paise >= 0),
  created_at       timestamptz not null default now()
);

create index if not exists idx_order_items_order on order_items(order_id);

alter table orders
  add column if not exists source      text not null default 'manual' check (source in ('manual','whatsapp_bot')),
  add column if not exists total_paise bigint,
  add column if not exists order_ref   text;

create unique index if not exists idx_orders_order_ref on orders(order_ref) where order_ref is not null;

-- Gap-free, concurrency-safe per-tenant order ref counter.
create table if not exists order_ref_counters (
  tenant_id   uuid primary key references tenants(id) on delete cascade,
  next_value  bigint not null default 1
);

create or replace function allocate_order_ref(p_tenant_id uuid)
returns text language plpgsql as $$
declare v bigint;
begin
  insert into order_ref_counters (tenant_id, next_value) values (p_tenant_id, 2)
  on conflict (tenant_id) do update set next_value = order_ref_counters.next_value + 1
  returning next_value - 1 into v;
  return 'ORD-' || upper(substr(replace(p_tenant_id::text, '-', ''), 1, 4)) || '-' || lpad(v::text, 6, '0');
end;
$$;

alter table order_items        enable row level security;
alter table order_ref_counters enable row level security;

create policy "order_items_tenant_isolation" on order_items for all
  using (order_id in (select id from orders where tenant_id in (select tenant_id from tenant_users where user_id = auth.uid())));
create policy "order_ref_counters_tenant_isolation" on order_ref_counters for all
  using (tenant_id in (select tenant_id from tenant_users where user_id = auth.uid()));

grant all on order_items        to postgres, anon, authenticated, service_role;
grant all on order_ref_counters to postgres, anon, authenticated, service_role;
grant execute on function allocate_order_ref(uuid) to service_role, authenticated;
