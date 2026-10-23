-- ============================================================================
-- RESTAURANT TABLE BOOKINGS
-- ============================================================================
-- Capture-and-notify-staff only in this slice — no availability/capacity
-- checking (confirmed decision). contact_id/conversation_id are kept NOT
-- NULL, matching the orders table precedent, since every booking here is
-- WhatsApp-sourced and both always exist.

create table if not exists bookings (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  contact_id      uuid not null references contacts(id) on delete cascade,
  conversation_id uuid not null references conversations(id) on delete cascade,
  party_size      integer not null check (party_size > 0 and party_size <= 50),
  booking_date    date not null,
  booking_time    time not null,
  status          text not null default 'pending' check (status in ('pending','confirmed','cancelled')),
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_bookings_tenant_date on bookings(tenant_id, booking_date);

create trigger bookings_updated_at before update on bookings for each row execute function set_updated_at();

alter table bookings enable row level security;

create policy "bookings_tenant_isolation" on bookings for all
  using (tenant_id in (select tenant_id from tenant_users where user_id = auth.uid()));

-- Explicit grants — don't rely solely on ALTER DEFAULT PRIVILEGES from an
-- earlier migration (a missing-grant class of bug already broke 46 tables
-- once this session before being fixed).
grant all on bookings to postgres, anon, authenticated, service_role;
