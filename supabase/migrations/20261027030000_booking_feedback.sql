-- BKG-07: post-dining feedback capture, parity with ORD-07 (which isn't
-- built yet either — this stands alone). No BKG-06 (seated/no-show
-- dashboard) exists yet, so the trigger here is time-based (booking_date +
-- booking_time has passed by a configured margin) rather than a manual
-- "seated" action — a reasonable stand-in until BKG-06 lands.

alter table bookings
  add column if not exists feedback_requested_at timestamptz;

create table if not exists booking_feedback (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete cascade,
  booking_id uuid not null unique references bookings(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  rating     smallint not null check (rating >= 1 and rating <= 5),
  comment    text,
  created_at timestamptz not null default now()
);

create index if not exists idx_booking_feedback_tenant on booking_feedback(tenant_id, created_at desc);

alter table booking_feedback enable row level security;

create policy "booking_feedback_tenant_isolation" on booking_feedback for all
  using (tenant_id in (select tenant_id from tenant_users where user_id = auth.uid()));

grant all on booking_feedback to postgres, anon, authenticated, service_role;
