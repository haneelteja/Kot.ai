-- Webhook delivery retry tracking + tenant-scoped API keys for programmatic access.

alter table outbound_webhook_deliveries
  add column if not exists attempt integer not null default 1;

create table if not exists api_keys (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  name         text not null,
  key_hash     text not null unique,
  key_prefix   text not null,
  scopes       text[] not null default '{}',
  last_used_at timestamptz,
  created_at   timestamptz not null default now(),
  revoked_at   timestamptz
);
create index if not exists idx_api_keys_tenant on api_keys(tenant_id) where revoked_at is null;
create index if not exists idx_api_keys_hash on api_keys(key_hash) where revoked_at is null;

alter table api_keys enable row level security;

drop policy if exists "tenant_api_keys_select" on api_keys;
create policy "tenant_api_keys_select" on api_keys for select
  using (tenant_id in (select tenant_id from tenant_users where user_id = auth.uid()));

drop policy if exists "tenant_api_keys_insert" on api_keys;
create policy "tenant_api_keys_insert" on api_keys for insert
  with check (tenant_id in (select tenant_id from tenant_users where user_id = auth.uid()));

drop policy if exists "tenant_api_keys_update" on api_keys;
create policy "tenant_api_keys_update" on api_keys for update
  using (tenant_id in (select tenant_id from tenant_users where user_id = auth.uid()));

drop policy if exists "tenant_api_keys_delete" on api_keys;
create policy "tenant_api_keys_delete" on api_keys for delete
  using (tenant_id in (select tenant_id from tenant_users where user_id = auth.uid()));

grant all on api_keys to postgres, anon, authenticated, service_role;
