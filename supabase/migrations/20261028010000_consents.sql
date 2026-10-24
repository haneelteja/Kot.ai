-- MKT-03: append-only consent ledger — one row per opt-in/opt-out event,
-- never updated/overwritten, so there's always a durable record of when/how
-- consent was granted or withdrawn (DPDP, brief §17).

create table if not exists consents (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  purpose    text not null check (purpose in ('marketing')),
  action     text not null check (action in ('opt_in','opt_out')),
  channel    text not null check (channel in ('whatsapp_button','whatsapp_keyword','dashboard')),
  created_at timestamptz not null default now()
);

create index if not exists idx_consents_tenant_contact on consents(tenant_id, contact_id, purpose, created_at desc);
alter table consents enable row level security;
create policy "consents_tenant_isolation" on consents for all
  using (tenant_id in (select tenant_id from tenant_users where user_id = auth.uid()));
grant all on consents to postgres, anon, authenticated, service_role;
