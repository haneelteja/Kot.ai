-- TKW-02/03/04: a pickup verification code shown to the customer when their
-- order is marked Ready, and tracking for the "uncollected" alert. Always
-- generated — not configurable in this slice (a tenant that doesn't care
-- can just ignore it; a toggle wasn't worth the extra settings surface).
alter table orders
  add column if not exists pickup_code text,
  add column if not exists ready_at    timestamptz,
  add column if not exists uncollected_alert_sent_at timestamptz;
