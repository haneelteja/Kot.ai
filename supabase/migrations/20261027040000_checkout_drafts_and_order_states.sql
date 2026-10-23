-- ORD-02 + FUL-02/03 (revised, see docs/BACKLOG.md's flow-map update note):
-- orders are now created only when payment is confirmed, never at
-- link-generation time. Pre-payment state lives in a new checkout_drafts
-- table instead of a 'pending' orders row.

create table if not exists checkout_drafts (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  contact_id      uuid not null references contacts(id) on delete cascade,
  conversation_id uuid not null references conversations(id) on delete cascade,
  source          text not null check (source in ('whatsapp_bot','weblink')),
  items_json      jsonb not null,
  total_paise     bigint not null check (total_paise >= 0),
  status          text not null default 'awaiting_payment'
                    check (status in ('awaiting_payment','paid','expired','cancelled')),
  order_id        uuid references orders(id) on delete set null,
  link_url        text,
  created_at      timestamptz not null default now(),
  expires_at      timestamptz not null,
  reminder_sent_at timestamptz
);

create index if not exists idx_checkout_drafts_pending
  on checkout_drafts(tenant_id, status, expires_at) where status = 'awaiting_payment';

alter table checkout_drafts enable row level security;

create policy "checkout_drafts_tenant_isolation" on checkout_drafts for all
  using (tenant_id in (select tenant_id from tenant_users where user_id = auth.uid()));

grant all on checkout_drafts to postgres, anon, authenticated, service_role;

-- FUL-02/03: widen orders.status for the restaurant kitchen flow
-- (auto-accept → preparing, kitchen marks ready) without touching the
-- existing pending/confirmed/dispatched/delivered/cancelled states the
-- lifecycle_bot manual-order flow already depends on.
alter table orders drop constraint if exists orders_status_check;
alter table orders add constraint orders_status_check
  check (status in ('pending','confirmed','preparing','ready','dispatched','delivered','cancelled'));

alter table orders
  add column if not exists accepted_at         timestamptz,
  add column if not exists stuck_alert_sent_at  timestamptz;
