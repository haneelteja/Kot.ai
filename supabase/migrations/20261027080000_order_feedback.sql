-- ORD-07: post-pickup feedback capture, parity with BKG-07's booking_feedback.
alter table orders
  add column if not exists feedback_requested_at timestamptz;

create table if not exists order_feedback (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete cascade,
  order_id   uuid not null unique references orders(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  rating     smallint not null check (rating >= 1 and rating <= 5),
  comment    text,
  created_at timestamptz not null default now()
);

create index if not exists idx_order_feedback_tenant on order_feedback(tenant_id, created_at desc);

alter table order_feedback enable row level security;

create policy "order_feedback_tenant_isolation" on order_feedback for all
  using (tenant_id in (select tenant_id from tenant_users where user_id = auth.uid()));

grant all on order_feedback to postgres, anon, authenticated, service_role;
