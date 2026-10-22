-- ============================================================================
-- RESTAURANT MENU + CART
-- ============================================================================
-- First real menu/ordering data model for restaurant_bot. Net-new tables,
-- paise-based prices (never floats), single-location for this slice (no
-- branch_id — tenant_id is the only scope needed). See docs/adr/0005 for the
-- marker-based-actions decision this schema supports.

create table if not exists menu_categories (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  name        text not null,
  sort_order  integer not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists menu_items (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  category_id  uuid references menu_categories(id) on delete set null,
  name         text not null,
  description  text,
  price_paise  bigint not null check (price_paise >= 0),
  is_veg       boolean not null default true,
  in_stock     boolean not null default true,
  image_url    text,
  sort_order   integer not null default 0,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_menu_categories_tenant on menu_categories(tenant_id, active, sort_order);
create index if not exists idx_menu_items_tenant      on menu_items(tenant_id, active, in_stock, sort_order);
create index if not exists idx_menu_items_category    on menu_items(category_id);

-- One active cart per (tenant, contact) — no branch scoping in this slice.
create table if not exists carts (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  contact_id  uuid not null references contacts(id) on delete cascade,
  status      text not null default 'active' check (status in ('active','converted','abandoned')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Partial unique index (not a table-level UNIQUE) so multiple historical
-- 'converted'/'abandoned' carts per contact remain possible — only one
-- 'active' cart is ever enforced.
create unique index if not exists idx_carts_one_active_per_contact
  on carts(tenant_id, contact_id) where status = 'active';

create table if not exists cart_items (
  id           uuid primary key default gen_random_uuid(),
  cart_id      uuid not null references carts(id) on delete cascade,
  menu_item_id uuid not null references menu_items(id) on delete cascade,
  quantity     integer not null check (quantity > 0),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (cart_id, menu_item_id)
);

create index if not exists idx_carts_tenant_contact on carts(tenant_id, contact_id, status);
create index if not exists idx_cart_items_cart       on cart_items(cart_id);

create trigger menu_categories_updated_at before update on menu_categories for each row execute function set_updated_at();
create trigger menu_items_updated_at      before update on menu_items      for each row execute function set_updated_at();
create trigger carts_updated_at           before update on carts           for each row execute function set_updated_at();
create trigger cart_items_updated_at      before update on cart_items      for each row execute function set_updated_at();

alter table menu_categories enable row level security;
alter table menu_items      enable row level security;
alter table carts           enable row level security;
alter table cart_items      enable row level security;

create policy "menu_categories_tenant_isolation" on menu_categories for all
  using (tenant_id in (select tenant_id from tenant_users where user_id = auth.uid()));
create policy "menu_items_tenant_isolation" on menu_items for all
  using (tenant_id in (select tenant_id from tenant_users where user_id = auth.uid()));
create policy "carts_tenant_isolation" on carts for all
  using (tenant_id in (select tenant_id from tenant_users where user_id = auth.uid()));
-- cart_items has no tenant_id column (FK-only by design) — isolate via parent cart
create policy "cart_items_tenant_isolation" on cart_items for all
  using (cart_id in (select id from carts where tenant_id in (select tenant_id from tenant_users where user_id = auth.uid())));

-- Explicit grants — don't rely solely on ALTER DEFAULT PRIVILEGES from an
-- earlier migration (that only covers tables created by the same role that
-- ran it; a missing-grant class of bug already broke 46 tables once this
-- session before being fixed).
grant all on menu_categories to postgres, anon, authenticated, service_role;
grant all on menu_items      to postgres, anon, authenticated, service_role;
grant all on carts           to postgres, anon, authenticated, service_role;
grant all on cart_items      to postgres, anon, authenticated, service_role;
