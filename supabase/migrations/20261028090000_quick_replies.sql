-- HND-04: canned responses staff can insert into the reply box during takeover.
create table if not exists quick_replies (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete cascade,
  label      text not null,
  message    text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_quick_replies_tenant on quick_replies(tenant_id, created_at);
alter table quick_replies enable row level security;
create policy "quick_replies_tenant_isolation" on quick_replies for all
  using (tenant_id in (select tenant_id from tenant_users where user_id = auth.uid()));
grant all on quick_replies to postgres, anon, authenticated, service_role;
