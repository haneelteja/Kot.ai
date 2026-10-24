-- CMP: complaint intake, SLA queue, resolution actions.
-- A new table rather than literally extending return_requests (which
-- already has its own distinct, working return/replacement semantics for
-- lifecycle_bot) — cleaner than overloading it, matches the richer model
-- docs/DATA_MODEL.md calls for without risking the existing feature.

create table if not exists complaints (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  contact_id      uuid not null references contacts(id) on delete cascade,
  conversation_id uuid references conversations(id) on delete set null,
  order_id        uuid references orders(id) on delete set null,
  category        text not null check (category in ('wrong_item','missing_item','quality','late','other')),
  description     text,
  photo_url       text,
  status          text not null default 'open' check (status in ('open','in_progress','resolved','rejected')),
  resolution_type text check (resolution_type in ('refund','coupon','redeliver','none')),
  resolution_notes text,
  resolved_by     uuid,
  sla_due_at      timestamptz not null default (now() + interval '24 hours'),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_complaints_tenant_status on complaints(tenant_id, status, sla_due_at);

create trigger complaints_updated_at before update on complaints for each row execute function set_updated_at();

alter table complaints enable row level security;

create policy "complaints_tenant_isolation" on complaints for all
  using (tenant_id in (select tenant_id from tenant_users where user_id = auth.uid()));

grant all on complaints to postgres, anon, authenticated, service_role;
