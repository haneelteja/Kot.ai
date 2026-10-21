# KOT.ai — Data Model (Phase 0)

From brief Section 6, mapped against what exists in the pruned repo (see `docs/AUDIT.md` §1–2). All new tables: `tenant_id` + RLS (new-style policy, per `docs/AUDIT.md`'s convention note), money as `bigint` paise, timestamps `timestamptz` UTC, branch-local timezone stored separately (default `Asia/Kolkata`). Full column-level DDL is written as migrations in Phase 3 (BR/MENU/ORD/PAY/BKG/CMP epics) — this doc fixes the shape and the reuse/replace decision per table so those migrations aren't designed twice.

| Table | Status | Notes |
|---|---|---|
| `restaurant_profiles` | net-new | brand_name, logo_url, brand colours, gstin, fssai, support_phone, privacy_notice_url, ordering_modes_enabled, booking_mode |
| `branches` | net-new | name, address, lat/lng, phone, timezone, delivery_radius_m, is_active, pos_provider, pos_store_ref, delivery_partner_priority[] |
| `branch_hours`, `branch_closures`, `branch_runtime_status` | net-new | split shifts, ad-hoc closures, kitchen_busy_until/ordering_paused |
| `menu_categories`, `menu_items`, `item_variants`, `addon_groups`, `addons` | net-new | pos_item_ref for POS mapping, price_paise, tax_rate_bp, packing_charge_paise, prep_time_min, availability windows |
| `offers` | net-new | code, type, min/max, applies_to, usage limits, validity, branch scope |
| `customers` | EXTEND `contacts` | reuse existing `contacts` table (phone, bsuid, memory_json); add `customer_addresses`, `marketing_opt_in`/`opt_in_at`/`opt_out_at` |
| `customer_addresses` | net-new | label, line1, flat/house, landmark, lat/lng, geocode_source |
| `carts`, `cart_items` | net-new | server-side, linked to conversation + web session; one active cart per (tenant, contact, branch) |
| `quotes` | net-new | cart snapshot, delivery quote, offer applied, bill breakdown, expires_at — the price lock |
| `orders` | REPLACE | existing `orders` table (from `001_initial_schema.sql`) stores floats and a client-trusted total with no variants/menu model — net-new schema: order_ref, fulfilment_type, status, branch, customer, address snapshot, bill snapshot, per-status timestamps, cancellation_reason, source |
| `order_items` | net-new | snapshot of name/variant/addons/unit price/qty, unavailable flag, refunded_paise |
| `payments` | REPLACE | existing `payments` table is PhonePe/Easebuzz-subscription-oriented — net-new schema: provider, txnid, provider_ref, amount_paise, status, link_url/expiry, raw payloads; unique on (provider, txnid) |
| `refunds` | net-new | payment_id, amount_paise, reason, status, provider_refund_id, initiated_by |
| `pos_orders`, `pos_events` | net-new | |
| `delivery_tasks`, `delivery_events` | net-new | quote_paise vs actual_fee_paise |
| `bookings`, `booking_slots` | net-new | party_size, booking_at, duration_min, occasion, special_requests, status; capacity enforced via transaction or exclusion constraint (no double-booking) |
| `complaints` | EXTEND `return_requests` | existing table is a simple return/replacement ticket with no SLA/photos/categories — extend into the richer model brief §6 describes |
| `conversation_takeovers` | net-new | |
| `tenant_settings`, `platform_settings_defaults` | net-new | two-level config per brief §11, with min/max limits |
| `integration_credentials` | net-new | tenant_id, provider, encrypted blob, status, last_tested_at — replaces the platform-wide Easebuzz env-var pattern |
| `webhook_events` | net-new | source, external_id unique, payload, processed_at, error — backs the durable-queue idempotency (ADR 0001) |
| `notifications_log` | EXTEND | existing notifications inbox (migrations 045–047) reused for owner summaries/alerts |
| `audit_logs` | KEEP | migration 042, reused as-is |
| `ai_calls` | net-new | inputs hash, tools called, tokens, cost, latency — for the restaurant agent's tool-use path |
| `consents` | net-new | purpose, granted_at, withdrawn_at, channel (DPDP) |
| `order_feedback` | net-new | rating 1–5, comment |
| `share_links` | net-new | branch_id, purpose, wa.me URL, QR image, source tag |
| `order_ref_sequences` | net-new | per-branch, gap-free, concurrency-safe |

## Integrity rules (brief §6, carried forward verbatim)

- Booking capacity enforced in a transaction or exclusion constraint — no double booking.
- Offer usage limits enforced atomically.
- One active cart per (tenant, contact, branch).
- Customers may be identified by a business-scoped user id (BSUID) instead of a phone number — the existing `contacts.bsuid` column already supports this; never assume a phone number is present when extending `contacts`.

## RLS convention

New tables follow the simpler policy style already adopted by the newest Alphabot migrations (`return_requests`, `tenant_internal_numbers`): `tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())`, rather than the older per-table helper-function style from `001_initial_schema.sql`. A cross-tenant isolation test (SEC epic) is required before any of these tables carry real data.
