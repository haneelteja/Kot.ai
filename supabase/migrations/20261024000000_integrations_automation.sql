-- ============================================================================
-- INTEGRATIONS + AUTOMATION
-- ============================================================================
-- Four net-new, independent capabilities, inspired by a reverse-engineering
-- pass over an external WhatsApp gateway repo (WA-AKG) and adapted to KOT.ai's
-- actual multi-tenant model:
--   1. ai_calls        — structured logging for every LLM call (provider,
--      model, latency, tokens, error) — turns "grep Render logs" into a SQL
--      query for diagnosing OpenRouter reliability issues.
--   2. auto_replies     — zero-LLM keyword fast-path, checked before the AI
--      pipeline runs at all, to cut latency + free-tier daily-quota burn on
--      common literal queries ("hi", "hours").
--   3. blocked_numbers  — staff-side block list, independent of the existing
--      customer-initiated opt-out (suppression.ts).
--   4. outbound_webhooks / outbound_webhook_deliveries — outbound event dispatch to tenant-configured
--      URLs (order.created / order.paid / order.status_changed), HMAC-signed,
--      with a full delivery log. SSRF-guarded at the application layer
--      (apps/api/src/lib/webhook-security.ts), not the database.

-- ── 1. AI call logging ──────────────────────────────────────────────────────
create table if not exists ai_calls (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  product_slug  text,
  provider      text not null,
  model         text not null,
  status        text not null check (status in ('success','error')),
  latency_ms    integer not null,
  input_tokens  integer,
  output_tokens integer,
  error_message text,
  created_at    timestamptz not null default now()
);
create index if not exists idx_ai_calls_tenant on ai_calls(tenant_id, created_at desc);

-- ── 2. Auto-reply keyword fast-path ─────────────────────────────────────────
create table if not exists auto_replies (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  product_slug text,  -- null = applies to every bot type for this tenant
  keyword      text not null,
  match_type   text not null default 'contains' check (match_type in ('exact','contains','regex')),
  reply_text   text not null,
  active       boolean not null default true,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_auto_replies_tenant on auto_replies(tenant_id, active, sort_order);
create trigger auto_replies_updated_at before update on auto_replies for each row execute function set_updated_at();

-- ── 3. Staff-side block list ────────────────────────────────────────────────
create table if not exists blocked_numbers (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete cascade,
  phone      text not null,
  reason     text,
  created_at timestamptz not null default now(),
  unique (tenant_id, phone)
);

-- ── 4. Outbound webhook dispatch ────────────────────────────────────────────
create table if not exists outbound_webhooks (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  url         text not null,
  event_types text[] not null default '{}',
  secret      text not null,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_webhooks_tenant on outbound_webhooks(tenant_id, active);
create trigger webhooks_updated_at before update on outbound_webhooks for each row execute function set_updated_at();

create table if not exists outbound_webhook_deliveries (
  id               uuid primary key default gen_random_uuid(),
  webhook_id       uuid not null references outbound_webhooks(id) on delete cascade,
  event_type       text not null,
  status_code      integer,
  response_time_ms integer,
  response_body    text,
  error_message    text,
  created_at       timestamptz not null default now()
);
create index if not exists idx_webhook_logs_webhook on outbound_webhook_deliveries(webhook_id, created_at desc);

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table ai_calls        enable row level security;
alter table auto_replies    enable row level security;
alter table blocked_numbers enable row level security;
alter table outbound_webhooks        enable row level security;
alter table outbound_webhook_deliveries    enable row level security;

create policy "ai_calls_tenant_isolation" on ai_calls for all
  using (tenant_id in (select tenant_id from tenant_users where user_id = auth.uid()));
create policy "auto_replies_tenant_isolation" on auto_replies for all
  using (tenant_id in (select tenant_id from tenant_users where user_id = auth.uid()));
create policy "blocked_numbers_tenant_isolation" on blocked_numbers for all
  using (tenant_id in (select tenant_id from tenant_users where user_id = auth.uid()));
create policy "webhooks_tenant_isolation" on outbound_webhooks for all
  using (tenant_id in (select tenant_id from tenant_users where user_id = auth.uid()));
create policy "webhook_logs_tenant_isolation" on outbound_webhook_deliveries for all
  using (webhook_id in (select id from outbound_webhooks where tenant_id in (select tenant_id from tenant_users where user_id = auth.uid())));

-- ── Grants (explicit — don't rely solely on ALTER DEFAULT PRIVILEGES) ───────
grant all on ai_calls        to postgres, anon, authenticated, service_role;
grant all on auto_replies    to postgres, anon, authenticated, service_role;
grant all on blocked_numbers to postgres, anon, authenticated, service_role;
grant all on outbound_webhooks        to postgres, anon, authenticated, service_role;
grant all on outbound_webhook_deliveries    to postgres, anon, authenticated, service_role;
