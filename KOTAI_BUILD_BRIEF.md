KOT.ai — Build Brief for Claude Code

Place this file at the repo root as KOTAI_BUILD_BRIEF.md. It is the single source of truth for the KOT.ai build. If anything in the code, other docs or a later message conflicts with this brief, stop and ask before proceeding.

0. Your role and how you must work

You are the lead engineer building KOT.ai, a multi-tenant WhatsApp ordering and table-booking product for restaurants, on top of the existing Alphabot monorepo (https://github.com/haneelteja/WhatsApp-Agent).

> Session note (2026-10-20): this build is executed as its own repo, `KOT.ai`, bootstrapped by copying the Alphabot monorepo (`WhatsApp AI Agent/`) and then pruning what isn't needed, rather than developing inside the original Alphabot repo. The "reuse before build" principle below still applies in full — it now means "keep/extend the copied Alphabot code," not "import across repos." See `docs/AUDIT.md` and `docs/adr/0004-repo-bootstrap-approach.md`.

Work rules (non-negotiable):

Plan before code. Phase 0 produces the plan, architecture and full backlog. Do not write feature code until I approve Phase 0.
Work in gated phases (Section 21). At the end of each phase, stop, summarise what was done, show test results, list open issues, and wait for my "go".
Backlog is the contract. Maintain docs/BACKLOG.md. Every requirement in this brief must map to at least one backlog item (Section 22 explains the traceability check). Update item status as you work (todo / in-progress / done / blocked).
One story at a time. Small, focused commits referencing the backlog ID (e.g. feat(ORD-07): server-side price recompute). Never mix unrelated changes.
Never break existing Alphabot features (support, sales and lifecycle bots, campaigns, voice). Add regression tests before touching shared code.
Money is integers in paise. Never floats. All totals are computed on the server.
The AI proposes, the code decides. The model never sets prices, totals, payment status, order status or refunds; it calls tools that do.
No secrets in the repo. Use environment variables and per-tenant encrypted credentials.
Missing credentials are not a blocker. Build behind adapter interfaces with mock/sandbox implementations, flag the gap in docs/SETUP.md, and keep going.
Verify external APIs against current official docs (Meta WhatsApp Cloud API, Easebuzz, Petpooja, delivery partners, Sarvam, Google Maps). Do not rely on memory for endpoints, payloads or limits. Record the doc version/date you used in docs/integrations/<name>.md.
Ask when ambiguous. Batch questions; never guess on money, legal, or data-privacy behaviour.
Write decisions down as short ADRs in docs/adr/NNNN-title.md.
Reuse before you build — follow Section 0A for every story. Generalise Alphabot code instead of duplicating it, and keep existing Alphabot behaviour intact.

0A. Reuse first: Alphabot code, open source, and token efficiency

The goal is to ship fast with the fewest tokens. Writing new code is the last resort. For every backlog item, look for an existing implementation in this order:

Alphabot code in this repo — reuse as-is, extend, or generalise.
Battle-tested open-source libraries (permissive licences only) — install, don't re-implement.
Open-source reference projects — read for patterns; copy code only when the licence allows (rules below).
Only then write new code.

0A.1 Alphabot reuse map (start here — verify each in Phase 0)

KOT.ai lives inside the Alphabot monorepo, so "importing" means reusing and extending these modules directly, not copying them into a new project.

Need in KOT.ai	Reuse from Alphabot	Action
Send/receive WhatsApp, interactive lists/buttons/CTA URL	apps/api/src/services/whatsapp/gateway.ts, providers/meta.ts	Reuse; add location-request, order, template helpers if missing
Webhook entry, tenant + number resolution, multi-bot routing	apps/api/src/routes/webhook/index.ts, services/routing/router.ts, bot-context.ts	Reuse routing; add signature check; route KOT.ai numbers to the new restaurant agent
Nearest branch from shared location	Location handling inside the multi-routing branch of the webhook	Extract into a shared geo/nearest-branch service and reuse
Business hours / working days	apps/api/src/lib/business-hours.ts, lib/business-days.ts	Extend for split shifts, cut-offs, closures
Phone normalisation, retries, Redis, locks	lib/phone.ts, lib/retry.ts, lib/redis.ts, lib/fire-forget.ts	Reuse
LLM calls, cost tracking, per-tenant model config	lib/anthropic.ts, lib/llm-router.ts, lib/llm-cost.ts, services/ai/*	Reuse; add a tool-use path for the restaurant agent
Tool registry per bot	lib/tool-registry.ts	Extend with the restaurant tools (§9)
Knowledge base RAG	services/kb/*	Reuse for restaurant FAQs and policies
Contact memory	services/contact/memory.ts, fact-extractor.ts	Reuse (preferences, saved context)
Escalation, sentiment	services/escalation/*, services/sentiment/detector.ts	Reuse for handoff triggers
Opt-out / suppression	lib/suppression.ts	Reuse for marketing STOP
Scheduler and scheduled messages	jobs/scheduler.ts, services/scheduled-messages/*	Reuse for reminders, reconciliation, timeouts
Voice note transcription	services/voice/providers/stt/sarvam.ts	Reuse for WhatsApp audio
Easebuzz link + hash verification	services/payment/easebuzz.ts	Reuse; make per-tenant; add webhook, status API, refunds
Orders/payments tables and routes	existing orders, payments migrations, routes/orders/index.ts	Extend schema; replace pricing logic (server-side, paise)
Receipts / PDFs	services/invoice/generator.ts	Reuse for payment receipts
Return/complaint flow	return-requests migration and webhook handling	Generalise into complaints
Daily reports, insights, notifications inbox	lib/email/daily-report.ts, services/insights/*, notifications migrations	Reuse for owner summaries and alerts
Staff/internal numbers	InternalNumbersManager, internal-numbers migrations	Reuse for restaurant staff alert numbers
Audit logs	audit_logs migrations, AuditLogTable.tsx	Reuse
Dashboard shell, nav, auth, team invites, roles	apps/web/src/components/dashboard-shell.tsx, topbar.tsx, platform-nav.tsx, TeamInviteForm.tsx, InviteUserForm.tsx, auth routes	Reuse; apply KOT.ai theme
Conversations inbox, message view, actions	RecentConversations.tsx, conversation-messages.tsx, conversation-actions.tsx	Extend with order/booking side panel and takeover
WhatsApp number setup UI	WhatsAppNumbersManager.tsx, WhatsAppSetupSection.tsx, platform/WhatsAppNumberSection.tsx	Reuse in onboarding wizard
Integrations, notifications, persona, guardrails settings	IntegrationsClient.tsx, NotificationSettings.tsx, PersonaEditor.tsx, TenantGuardrailsForm.tsx	Reuse
Billing / plans	BillingManager.tsx, subscription migrations, routes/subscriptions	Reuse for KOT.ai SaaS plans
Analytics components	leads/SalesAnalytics.tsx, AutoRefresh.tsx	Reuse patterns for order analytics
Tenant onboarding intake	tenant-intake.html, TENANT_MASTER_SPEC.template.md, tenant-master-spec.schema.json	Reuse fields for the onboarding wizard
Dashboard Copilot	CopilotWidgetMount.tsx, copilot migrations	Optional: let owners ask "how many orders today?"

Phase 0 must produce docs/REUSE_MAP.md: the table above, verified against the code, with reuse / extend / replace / new for each item and the reason for any "replace" or "new".

0A.2 Open-source libraries to prefer (verify current versions and licences)

Use these instead of hand-writing equivalents (confirm each is still maintained; pick versions at least two weeks old):

Validation & types: zod; openapi-typescript to generate types from any partner's published OpenAPI spec (verify against the official docs).
State machines: xstate, or a small typed transition table if simpler — decide in an ADR.
Queue & monitoring: bullmq, @bull-board/api (already aligned with the Redis setup).
Auth tokens for links: jose (signed, expiring JWTs).
Dates, time zones, hours: date-fns + date-fns-tz (or luxon).
Phone numbers: libphonenumber-js.
Geo: @turf/distance and @turf/boolean-point-in-polygon for radius and zone checks.
Menu search: Postgres pg_trgm full-text/trigram search first; fuse.js only for client-side fuzzy search.
UI: shadcn/ui (copy-in components on Radix UI) themed with the KOT.ai tokens; @tanstack/react-table, @tanstack/react-query, react-hook-form, recharts, lucide-react icons.
Realtime live orders: Supabase Realtime (already in the stack) before adding anything else.
QR codes: qrcode.
Testing: vitest, msw (mock Meta, Easebuzz, Petpooja and delivery APIs), @playwright/test.
Official SDKs where they exist (e.g. @anthropic-ai/sdk); for providers without one, a thin typed client.

0A.3 Open-source reference projects
Search GitHub for open-source WhatsApp ordering bots, restaurant online-ordering apps, and KOT/kitchen display systems to borrow patterns (menu modelling with variants/add-ons, cart UX, order kanban, delivery status mapping).
Licence rules: copy code only from MIT, Apache-2.0, BSD or ISC projects, keep their notices, and record each in THIRD_PARTY_NOTICES.md. Never copy from GPL/AGPL/LGPL, unlicensed or "source-available" repositories — read for ideas only. When in doubt, ask.
Never vendor a whole project; take the smallest piece that solves the story.

0A.4 Token-efficient working rules for Claude Code
Keep a short CLAUDE.md at the repo root (conventions, commands, where things live, links to this brief and the backlog) so each session starts with minimal context.
Explore with search (grep/glob) and read only the files and line ranges you need; never re-read files you just wrote; never print whole files back.
Use sub-agents (or separate sessions) for broad exploration and for independent stories, so the main context stays small.
Work one backlog story per session where possible; at the end write a 5–10 line handoff note in docs/PROGRESS.md (done, next, open issues) and start the next session from that note instead of the full history.
Prefer generating repetitive code (CRUD routes, migrations, typed clients, UI forms) from existing Alphabot patterns or generators rather than writing each by hand.
Don't paste API docs into the context; fetch only the endpoint you are implementing and summarise it in docs/integrations/<name>.md once, then reference that summary.
Run only the tests relevant to the change while iterating; the full suite runs in CI and at phase gates.

1. Product summary

KOT.ai gives each restaurant its own WhatsApp ordering line. Customers message the restaurant's WhatsApp number (linked from its Google Business Profile, Instagram, website, table QR codes). An AI agent handles the whole conversation:

Know the restaurant — branches, hours, menu, prices, offers, FAQs.
Book a table — guests, date/time, occasion/purpose, special requests.
Order online for delivery or takeaway — browse the menu (web link, chat, or WhatsApp catalog), build a cart, share location, see delivery fee and offers, pay via Easebuzz.
After payment — the order is pushed to the restaurant's POS (Petpooja first), the restaurant accepts, and when food is ready a rider is booked with the restaurant's delivery partner. The customer gets live status on WhatsApp.

Restaurants get a tenant dashboard (orders, payments, customers, conversations, bookings, menu, settings, analytics). We (the platform) get a platform console to onboard and manage tenants, set defaults and limits, and monitor health and cost.

Product name: KOT.ai (KOT = Kitchen Order Ticket). Tagline: "Orders, straight to the kitchen."

2. Decisions already made (do not reopen)
#	Decision
D1	Restaurant-owned channel model. Each restaurant uses its own WhatsApp number and display name, its own Easebuzz merchant account, and its own GSTIN on receipts. KOT.ai is a SaaS provider, not the seller and not a payment aggregator.
D2	Payment gateway: Easebuzz, per-tenant merchant credentials (encrypted). Payment by link (hosted page).
D3	Delivery: the restaurant holds the delivery partner account (Shadowfax / Borzo / Porter, more later). We store the restaurant's API credentials and book riders on its behalf. The partner bills the restaurant directly.
D4	Rider is booked at Food Ready (Petpooja "Food Ready" status or dashboard button), never at payment time.
D5	POS: pilot with Petpooja only, behind a generic POS adapter interface. A manual adapter (dashboard Accept / Food Ready buttons, manual menu) supports restaurants without a POS and is the fallback when the POS is down.
D6	Opening hours, closing times, cut-offs are configurable per branch in the application.
D7	Restaurant acceptance timeout is configurable per tenant (platform sets defaults and min/max; tenant adjusts within them).
D8	Table booking mode (auto-confirm against slot capacity vs staff-confirm) is configurable per tenant.
D9	Ordering surfaces: web link (primary, default for all restaurants), conversational ordering in chat, and WhatsApp catalog / Flows. Tenant chooses which are enabled. Build order: web link + chat first, catalog and Flows later (Section 21).
D10	Serviceability is checked before the customer builds a cart and re-checked before the payment link is created.
D11	Stack is the existing Alphabot stack (Section 5). KOT.ai is a new product vertical inside the same monorepo, sharing platform and tenant layers.
D12	Detailed behaviour for edge cases (Section 16) is refined during implementation, but the defaults listed there must be implemented before payments go live.
D13	Money flow: the customer pays food + packing + taxes + delivery fee − discount as one total into the restaurant's Easebuzz account. The restaurant settles with its delivery partner directly. KOT.ai never holds customer money; it earns only its SaaS fee.
D14	WhatsApp onboarding: each restaurant's number lives in the restaurant's own WhatsApp Business Account, connected to the KOT.ai Meta app (Embedded Signup as a Meta Tech Provider, or the closest currently supported route — verify). Message charges are billed to the restaurant's WABA.

> Session note: D11 is interpreted as "share the platform/tenant architecture pattern via the copied-and-pruned KOT.ai repo," not "literally the same repo as Alphabot" — see the 2026-10-20 session note under Section 0.

3. Scope
In scope (MVP)
Restaurant knowledge assistant (branches, hours, menu, prices, FAQs, offers).
Branch finder by shared location / typed area.
Table booking with reminders, cancel and reschedule.
Online ordering: delivery and takeaway; web-link ordering page; conversational ordering; cart; variants and add-ons; offers/coupons; delivery quote; bill breakdown.
Easebuzz payment links, webhooks, status reconciliation, full and partial refunds.
POS integration: Petpooja adapter + manual adapter.
Restaurant acceptance flow with timeout and auto-refund.
Item-unavailable flow after payment.
Delivery partner adapters (Shadowfax, Borzo, Porter, manual) with serviceability, quote, book, cancel, track, status webhooks.
Customer order tracking on WhatsApp and on a tracking web page.
Human takeover from the tenant inbox; complaints; customer cancellation; voice-note transcription; marketing opt-in; DPDP basics.
Tenant dashboard and platform console (Sections 12–13).
Message templates for out-of-window notifications.
Brand, logo, theme and design system (Section 14).
Environments, CI/CD, deployment, monitoring, runbook.

Later (keep architecture ready, not in MVP)

Staff desks (attendance, tickets, leave), kitchen wastage/costing, procurement, payroll, own POS/billing, loyalty programme, multi-language templates (Telugu/Hindi) beyond voice input, scheduled orders for future days (design the data model to allow it), cash on delivery.

4. Existing codebase — audit first

The Alphabot repo is an npm-workspaces + Turborepo monorepo:

apps/api — Fastify 4, Node 22, TypeScript: webhook handler, AI pipeline, scheduler, routes (orders, broadcast, campaigns, kb, voice, integrations, subscriptions …), services (ai, whatsapp gateway with Meta + Twilio providers, payment/easebuzz, routing, voice with Sarvam/Deepgram STT, invoice, escalation …).
apps/web — Next.js 14 App Router dashboard, Tailwind, (platform) console and (dashboard) tenant routes.
packages/shared — shared types; packages/database — Supabase client + base migrations; supabase/migrations — incremental migrations.
Hosting: API on Render, web on Vercel; Supabase (Postgres + RLS + pgvector + Auth + Storage); Redis; Sentry; Resend.

Known issues found in review — fix in Phase 2 before any payment work:

Inbound Meta webhook POST does not verify X-Hub-Signature-256. Add HMAC-SHA256 verification over the raw body with the app secret; reject on failure.
The AI layer uses text markers ([STAGE:x], [BUTTONS:name], [SALES_LEAD], CONFIDENCE:0.xx) instead of tool calling. KOT.ai needs real Claude tool use (Section 9). Keep the existing bots working as they are.
POST /api/orders trusts a client-supplied total and stores rupees as floats. Replace with server-side pricing in paise.
Easebuzz key/salt are platform-wide env vars. Move to per-tenant encrypted credentials (follow the per-tenant credential pattern used for Exotel).
Easebuzz callback is not idempotent, does not check the amount, and relies on the browser surl redirect. Add the server-to-server webhook, amount verification, idempotency, and a status-poll reconciliation job.
Webhook processing runs in-process after the 200 response with no durable queue. Move inbound processing, payment events, POS and delivery events to a durable queue (BullMQ on the existing Redis, or a Postgres-backed queue — decide in an ADR).
On reaching the plan limit the bot silently drops replies. Replace with a graceful reply to the customer and an alert to the tenant and platform.
Hardcoded strings such as — Elma Industries in payment descriptions must come from tenant data.

In Phase 0, read the whole repo and produce docs/AUDIT.md: what can be reused as-is, what needs refactoring, what is missing, and risks. Reuse candidates include: multi-tenancy and RLS, platform console, tenant dashboard shell, WhatsApp gateway, interactive buttons/lists, nearest-branch-by-location routing, contact memory, escalation, return/complaint flow, scheduler, audit logs, notification settings, Sarvam STT, LLM cost tracking.

5. Architecture
Stack (keep it)
Layer	Technology
API / workers	Fastify 4, Node 22, TypeScript (apps/api)
Web	Next.js 14 App Router, Tailwind (apps/web)
DB / Auth / Storage	Supabase Postgres + RLS (+ pgvector for KB)
Queue / locks / cache	Redis + BullMQ (or Postgres queue per ADR)
AI	Anthropic Claude with tool use (model configurable per tenant via existing llm-config; do not hardcode model names)
WhatsApp	Meta WhatsApp Cloud API
Payments	Easebuzz (per tenant)
POS	Petpooja adapter, manual adapter
Delivery	Shadowfax, Borzo, Porter adapters + manual adapter
Geocoding	Google Maps Geocoding / Places (behind an interface)
Voice notes	Sarvam STT (existing provider)
Email	Resend · Errors: Sentry
Hosting	Render (API + workers), Vercel (web) — confirm region choice in Phase 0

Request flow
WhatsApp event → POST /webhook/:tenantId → verify signature → persist raw event (dedupe on WhatsApp message id) → enqueue → return 200 immediately.
Worker resolves phone_number_id → tenant, number, branch scope; sender → contact; loads conversation state.
Voice notes are transcribed first (Sarvam), then treated as text.
The restaurant agent runs Claude with tenant/branch context and only the tools allowed for that tenant.
Tools call domain services (menu, cart, pricing, booking, orders, payments, serviceability). Services change the DB and emit domain events.
Replies go out via the WhatsApp gateway (text, interactive list/buttons, CTA URL, location request, templates).
External webhooks (Easebuzz, Petpooja, delivery partners) → verify → persist → enqueue → idempotent handlers → state machine transitions → notifications.

Module layout (proposal — confirm in Phase 0)
apps/api/src/
  modules/restaurant/
    agent/           # system prompt builder, tool definitions, tool handlers
    menu/            # menu read model, availability, search
    cart/            # cart service (server-side)
    pricing/         # bill calculator, offers engine
    orders/          # order service + state machine
    bookings/        # table booking service + state machine
    serviceability/  # radius + partner coverage checks
    hours/           # branch hours, cut-offs, closures
    complaints/
    refunds/
  integrations/
    pos/             # PosAdapter interface, petpooja/, manual/
    delivery/        # DeliveryAdapter interface, shadowfax/, borzo/, porter/, manual/
    payments/        # PaymentAdapter interface, easebuzz/
    geo/             # GeocodingAdapter, google/
  queue/             # job definitions, workers
apps/web/src/app/
  (dashboard)/restaurant/...   # tenant screens (Section 12)
  (platform)/restaurant/...    # platform console screens (Section 13)
  o/[tenant]/[branch]/...      # public ordering page (Section 8.4)
  t/[orderRef]/...             # public order tracking page

6. Data model (minimum — refine in Phase 0)

All tenant tables carry tenant_id with RLS. Money in paise (bigint). Times in UTC (timestamptz); branch time zone stored (default Asia/Kolkata). Unique constraints for idempotency on every external id.

restaurant_profiles (tenant_id, brand_name, logo_url, brand colours, gstin, fssai, support_phone, privacy_notice_url, ordering_modes_enabled, booking_mode …)
branches (name, address, lat, lng, phone, timezone, delivery_radius_m, is_active, pos_provider, pos_store_ref, delivery_partner_priority[])
branch_hours (branch_id, weekday, open_time, close_time, shift_no) · branch_closures (date/time ranges, reason) · branch_runtime_status (kitchen_busy_until, ordering_paused)
menu_categories, menu_items (pos_item_ref, name, description, image_url, is_veg, price_paise, tax_rate_bp, packing_charge_paise, prep_time_min, available_from/to, in_stock), item_variants, addon_groups (min/max select), addons
offers (code, type percent/flat/free_delivery, min_order_paise, max_discount_paise, applies_to food/delivery/total, first_order_only, usage limits, valid_from/to, branches)
customers = existing contacts extended: saved addresses in customer_addresses (label, line1, flat/house, landmark, lat, lng, geocode_source), marketing_opt_in, opt_in_at, opt_out_at
carts, cart_items (server-side; linked to conversation and web session)
quotes (cart snapshot, delivery quote, offer applied, bill breakdown, expires_at) — the price lock
orders (order_ref human-readable e.g. KOT-HYD1-000123, fulfilment_type delivery/takeaway, status, branch, customer, address snapshot, bill snapshot, timestamps per status, cancellation_reason, source: web/chat/catalog/flow)
order_items (snapshot of name, variant, addons, unit price, qty, unavailable flag, refunded_paise)
payments (tenant_id, order_id, provider, txnid, provider_ref, amount_paise, status, link_url, link_expires_at, raw payloads) — unique on (provider, txnid)
refunds (payment_id, amount_paise, reason, status, provider_refund_id, initiated_by)
pos_orders (order_id, provider, pos_order_ref, status, raw) · pos_events
delivery_tasks (order_id, partner, partner_task_id, quote_paise, actual_fee_paise, rider_name, rider_phone, tracking_url, status, failure_reason) · delivery_events
bookings (branch, customer, party_size, booking_at, duration_min, occasion, special_requests, status, table_ref optional, source) · booking_slots / capacity config
complaints (order_id, category, description, photos[], status, resolution type refund/coupon/redeliver/none, resolved_by)
conversation_takeovers (conversation_id, taken_by, started_at, ended_at, reason)
tenant_settings (key/value or typed columns) and platform_settings_defaults with min/max limits (Section 11)
integration_credentials (tenant_id, provider, encrypted blob, status, last_tested_at)
webhook_events (source, external_id unique, payload, processed_at, error)
notifications_log, audit_logs (existing), ai_calls (inputs hash, tools called, tokens, cost, latency)
consents (customer_id, purpose, granted_at, withdrawn_at, channel)
order_feedback (order_id, rating 1–5, comment, created_at)
share_links (branch_id, purpose order/booking/menu, wa.me URL with prefilled text, QR image, utm/source tag) — for GBP, Instagram, table QR codes
order_ref_sequences (per branch, gap-free, concurrency-safe)

Integrity rules: booking capacity enforced in a transaction or exclusion constraint (no double booking); offer usage limits enforced atomically; one active cart per (tenant, contact, branch); customers may be identified by a business-scoped user id instead of a phone number — follow the repo's existing BSUID support and never assume a phone number is present.

7. State machines (implement as explicit, tested transition tables)

Carts and quotes are separate entities (§6); an order row is created at checkout when the payment link is generated.

Order (delivery): awaiting_payment → paid → sent_to_restaurant → accepted → preparing → food_ready → rider_requested → rider_assigned → picked_up → delivered → completed Branches: payment_failed, payment_expired, rejected_by_restaurant, acceptance_timeout, cancelled_by_customer, cancelled_by_restaurant, delivery_failed, refund_pending → refunded / partially_refunded. Order (takeaway): … → food_ready → collected → completed.

Payment: created → link_sent → pending → success | failed | expired; late success after expiry → flag + auto-refund or honour (configurable, default auto-refund if order already cancelled).

Refund: requested → processing → success | failed (retry, then alert).

Delivery task: quote_requested → quoted → booking_requested → searching_rider → rider_assigned → at_pickup → picked_up → at_drop → delivered | cancelled | failed | returned. Fallback to next partner by priority if no rider within configured time; final fallback alerts the restaurant to arrange delivery manually (manual adapter).

Booking: requested → confirmed (auto/staff) → reminded → seated → completed | cancelled_by_customer | cancelled_by_restaurant | declined | no_show.

Complaint: open → in_progress → resolved | rejected.

Every transition: validated, timestamped, audited, emits a domain event, idempotent.

8. Customer journeys (functional spec)
8.1 Entry and greeting
Customer arrives via wa.me link/QR/GBP. First message → greeting with restaurant name and an interactive list: Order food · Book a table · Menu & prices · Branches & timings · Talk to us.
First-time customers get a one-line privacy notice with a link (DPDP).
Free text works everywhere; buttons are shortcuts, never the only path.
8.2 Knowledge
Answers from tenant KB + structured data (menu, hours, branches, offers). Never invent items, prices or policies. Low confidence → offer human handoff.
8.3 Branch and location
If the tenant has multiple branches, determine the branch: shared location (send a location request message), typed area/address (geocode + confirm), or pick from list.
For delivery: capture pin + flat/house number + landmark; offer saved addresses for returning customers.
Serviceability check (branch radius + partner coverage + branch open + not paused). If not serviceable: explain clearly and offer takeaway, another branch, or booking.
8.4 Ordering — web link (primary)
Bot sends a CTA URL button "View menu & order". URL: /o/{tenantSlug}/{branchSlug}?t={signedToken}; token (HMAC/JWT) carries tenant, branch, contact, conversation, fulfilment type, address id; expires (default 60 min, configurable).
Page UX (mobile-first, restaurant-branded, "Powered by KOT.ai" footer):
Header: restaurant logo, branch, open/closing status, delivery/takeaway toggle, ETA.
Sticky category tabs + search; veg/non-veg markers (shape + colour, not colour alone); bestseller tags from data only.
Item card: image (optional), name, short description, price, "Add". Out-of-stock items greyed with "Unavailable now".
Variant/add-on bottom sheet with required/optional groups, min/max validation, live price.
Sticky cart bar: item count, subtotal, "View cart".
Cart & checkout: items with qty steppers, offer code field + available offers list, address confirmation (map pin preview + flat/landmark), bill breakdown (items, packing, taxes, delivery fee, discount, total), cancellation policy one-liner, "Pay ₹X" button.
On "Pay": server re-validates stock, hours, serviceability, re-quotes delivery if quote expired, recomputes total, creates order + Easebuzz link, redirects to payment.
Return page: success / failure / pending states, "Back to WhatsApp" deep link. WhatsApp also receives the confirmation.
Cart is server-side and shared with chat: items added in chat appear on the page and vice versa.
Performance: first contentful paint < 2 s on 4G; menu cached; images lazy-loaded and resized.
8.5 Ordering — conversational
Customer can say "2 chicken biryani and 1 paneer tikka x2". The agent resolves items via search_menu, asks for required variants/add-ons, shows a cart summary with buttons Confirm · Edit · Add more.
Quantity parsing must handle "2 x item", "item x2", "item 2", words ("two"), and mixed languages from voice notes. Unit-tested.
Always read back the full order and bill before creating the payment link.
8.6 Ordering — WhatsApp catalog & Flows (later milestone)
Sync menu to a Meta commerce catalog per tenant; send single/multi-product messages; handle order webhooks into the same cart.
WhatsApp Flow for checkout/address as an option. Same pricing and order services. Tenant toggles.
8.7 Payment
Payment link message with order ref, total and expiry. Reminder before expiry (within 24-h window). Expired → cancel quote, offer "Get new link".
On success: confirm on WhatsApp with order ref + receipt link; push to POS.
8.8 After payment
Customer receives status updates: Accepted (with ETA) → Preparing → Food ready → Rider assigned (name, phone, tracking link) → Picked up → Delivered. Then a short feedback prompt (1–5 + optional comment).
Tracking page /t/{orderRef}?k={key} shows timeline, rider details and help button.
8.9 Table booking
Collect: branch, date, time, party size, occasion/purpose (birthday, anniversary, business, casual, other), special requests (high chair, seating preference), name.
Show available slots (buttons). Auto-confirm or staff-confirm per tenant setting. Confirmation includes branch address/map link and "Cancel / Reschedule" buttons.
Reminder (configurable, default 2 h before) via template. Cancel/reschedule by button or text.
Staff marks seated / no-show in the dashboard.
8.10 Takeaway
Customer picks takeaway (or is offered it when delivery is not serviceable). Show the branch address, map link and estimated ready time (prep time + current load).
On Food Ready, notify the customer with the order ref; staff mark Collected in the dashboard after checking the order ref (optional pickup OTP per tenant).
Uncollected orders: reminder after a configurable time; staff can close as collected/no-show (no refund by default; tenant policy).
8.11 Order limits
Per-branch minimum order value (delivery and takeaway separately) and a maximum order value guard (configurable) with a friendly message.
One offer per order by default; the offers engine supports a stacking flag for later.
8.12 Support
"Talk to us", angry sentiment, refund/complaint keywords, or two failed understanding attempts → handoff (Section 16).

9. AI agent (restaurant agent)
New agent path using Claude tool use; existing Alphabot bots keep their current pipeline.
System prompt built per tenant + branch: brand voice, hours, branches, policies, offers summary, guardrails. Menu is accessed via tools, not dumped in full.
Tools (minimum): get_restaurant_info, list_branches, find_nearest_branch, check_serviceability, search_menu, get_item_details, get_cart, add_to_cart, update_cart_item, remove_from_cart, list_offers, apply_offer, get_delivery_quote, get_bill, send_order_link, create_payment_link, get_order_status, cancel_order, check_booking_availability, create_booking, modify_booking, cancel_booking, raise_complaint, request_human, save_address, set_marketing_consent.
Tool handlers enforce tenant scope, permissions, state-machine rules and validation; they return structured results the model must use verbatim for prices.
Guardrails: no invented items/prices; explicit confirmation before payment; prompt-injection defence (customer text is data); stay on-topic; polite refusal for unrelated requests; hand off on low confidence or upset customers.
Interactive output: the agent requests buttons/lists/CTA URLs through a structured reply tool or response schema, not text markers.
Languages: understand English, Telugu, Hindi and mixes; reply in the customer's language when confident, else English. Templates English-only for MVP.
Log every call to ai_calls (tokens, cost, latency, tools used). Per-tenant monthly AI cost visible in the platform console.
Conversation tests: scripted transcripts covering every flow, mistakes, changes of mind, voice notes, injection attempts.

10. Integrations

Each integration lives behind an interface with: real adapter, sandbox config, and a mock for tests. Document each in docs/integrations/.

Meta WhatsApp Cloud API — tenant onboarding per D14 (Embedded Signup / Tech Provider requirements, display-name approval, payment method on the restaurant's WABA); one app-level webhook endpoint routing by phone_number_id (check whether per-WABA callback overrides are needed); send queue that respects per-number throughput limits; monitor number quality rating and messaging limits; signature verification; message types (text, interactive list/button, CTA URL, location request, image, audio, location, order); status webhooks; templates (Section 15.4); 24-hour window awareness; per-tenant number config.

Easebuzz — per-tenant credentials; payment link creation with order ref in udf fields; server webhook + surl/furl; hash verification; amount check; idempotency; transaction status API for reconciliation (job every few minutes for pending payments); refund API (full/partial) with status tracking; settlement report import (later).

Petpooja (PosAdapter) — interface: syncMenu, onMenuPush, pushOrder (marked as prepaid/online-paid, with delivery and packing charges and the customer's details), cancelOrder, updateOrder (for removed/unavailable items — verify whether Petpooja supports order edits; if not, document the fallback, e.g. cancel-and-repush or a staff note), onStatusCallback (accept/reject/food ready/etc.), onStockUpdate, onStoreToggle, healthCheck. Map Petpooja items/variations/add-ons/taxes to our model. Store raw payloads. When a POS is connected, the POS bill is the tax invoice; KOT.ai sends the customer a payment receipt that references it.

Manual PosAdapter — dashboard Accept/Reject/Food Ready buttons, manual menu and stock management, WhatsApp alert to the restaurant's staff number on new orders.

DeliveryAdapter (Shadowfax, Borzo, Porter, Manual) — checkServiceability, getQuote, createTask, cancelTask, getStatus, onWebhook. Partner priority and fallback per branch. Store quote vs actual fee per order. Verify each partner's API access requirements early and record findings.

Geocoding — forward and reverse geocoding, Google Maps link parsing; cache results.

Sarvam STT — reuse existing provider for WhatsApp voice notes; fall back to "please type" if transcription fails.

11. Configuration model

Two levels: platform defaults + min/max limits (platform console) and tenant/branch overrides (tenant dashboard, within limits). A resolver returns the effective value.

Setting	Platform	Tenant / branch
Opening hours, split shifts, weekly offs, holidays	—	per branch
Last-order cut-off for delivery / takeaway	default buffer	per branch
Ad-hoc closure, kitchen busy pause	—	one-tap toggle with auto-resume time
Out-of-hours behaviour (closed message / take booking / scheduled order later)	default	choose
Acceptance timeout: alert after X min, auto-cancel + refund after Y min	default + min/max	adjust
Item-unavailable default action + customer reply window	default	adjust
Cancellation policy (free until accepted; after accepted: allowed/not, refund %)	default	adjust
Booking mode (auto/staff), slot length, capacity per slot, max party size, lead time, reminder offset	default	set
Delivery radius, fee rule (pass-through / markup / free above ₹X), partner priority, rider search timeout	default	set
Payment link expiry, reminder timing	default + limits	adjust
Minimum order value (delivery / takeaway), maximum order value guard	default	per branch
Takeaway: pickup OTP on/off, uncollected-order reminder and closing policy	default	adjust
Offer stacking (one per order by default)	default	—
Ordering modes enabled (web / chat / catalog / flow)	allowed modes	choose
Bot handoff triggers, auto-resume after takeover	default	toggle
Web link token expiry	default	—
Plan limits (orders, conversations, AI cost cap)	per plan	read-only

All settings changes are audited.

12. Tenant dashboard (restaurant)

Roles: Owner, Manager, Staff (orders + inbox only). Branch-scoped access. Mobile-friendly (owners use phones); desktop-optimised for the order screen at the counter.

Screens:

Today — orders today, GMV today, paid vs refunded, average order value, active orders by status, bookings today, needs-attention list (orders waiting for acceptance with countdown, rider search failing, complaints open, payment failures, POS/partner health).
Live orders — kanban by status, cards styled as KOT tickets (Section 14), new-order sound + browser notification, Accept/Reject with reason, mark items unavailable, Food Ready, order detail drawer with timeline (payment, POS, delivery events), print KOT.
Order history — filters (date, branch, status, source, payment), search by order ref/phone, export CSV.
Inbox — all conversations, linked orders/bookings shown alongside, Take over / Return to bot, quick replies, unread and needs-human filters.
Bookings — calendar/day view by slot, confirm/decline (staff mode), seated/no-show, capacity indicators.
Menu & stock — synced from POS (read-only fields marked) or manual; stock toggles; item availability windows; images.
Branches & hours — hours, shifts, closures, cut-offs, pause ordering, delivery radius on a map.
Delivery — partner credentials (Test connection), priority, fee rule, per-order quote vs actual fee log.
Payments & refunds — transactions, statuses, refunds (initiate with reason; owner/manager only), reconciliation view.
Offers — create/edit coupons with rules and usage stats.
Customers — list, order count, last order, spend, opt-in status, addresses; data export/delete request handling.
Complaints — queue with SLA timer, resolution actions.
Analytics — funnel (conversations → menu views → carts → checkouts → paid), conversion by source, top items, AOV trend, repeat rate, SLA timings (accept, prepare, pickup, deliver), rejections, failed deliveries, booking no-show rate, bot vs human handling share.
Share links & QR codes — per-branch wa.me links with prefilled text for Order / Book / Menu, downloadable QR codes (table tents, counter, flyers) and the link to paste into the Google Business Profile and Instagram; source tags so analytics shows which link brought the order.
Settings — profile/branding, WhatsApp number status, Easebuzz credentials, POS connection, notifications, team & roles, policies (cancellation, privacy notice), bot persona and handoff rules.

13. Platform console (us)
Tenants — list with plan, status, health (WhatsApp, Easebuzz, POS, delivery), orders/GMV, AI cost.
Onboarding wizard + checklist per tenant: business details → WhatsApp number & display name → Easebuzz merchant credentials (test) → POS mapping or manual → branches & hours → menu sync/import → delivery partner credentials (test) → policies → templates approved → test order end-to-end → go live.
Defaults & limits (Section 11) and per-tenant overrides.
Integration health & logs — webhook event explorer with replay, failed jobs, dead-letter queue.
Templates — status of Meta template approvals per tenant.
AI — model config, cost per tenant/order, tool error rates, conversation transcripts for QA.
Billing — SaaS plans and subscription (reuse existing subscription/billing features).
Audit log and impersonate (read-only) tenant view for support, with audit.

14. Brand, logo and theme
14.1 Logo
Mark: a kitchen order ticket (rounded top, torn zigzag bottom edge) with printed order lines, and a saffron circular badge on the top-right corner containing three "typing" dots — "a chat that becomes a kitchen ticket".
Wordmark: KOT in ink + .ai in saffron, Bricolage Grotesque ExtraBold (800), tight tracking (−0.04em).
Tagline: "Orders, straight to the kitchen" in IBM Plex Mono 500, uppercase, letter-spacing 0.16em.
Reference SVG (viewBox 0 -4 130 136; light version — swap ticket/line colours for dark):
```svg
<svg viewBox="0 -4 130 136" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="KOT.ai">
  <path d="M16 20 Q16 8 28 8 H94 Q106 8 106 20 V108 L96 118 L86 108 L76 118 L66 108 L56 118 L46 108 L36 118 L26 108 L16 118 Z" fill="#16181D"/>
  <rect x="30" y="28" width="38" height="9" rx="4.5" fill="#F5F5F3"/>
  <rect x="30" y="52" width="60" height="6" rx="3" fill="#F5F5F3"/>
  <rect x="30" y="68" width="46" height="6" rx="3" fill="#F5F5F3"/>
  <rect x="30" y="84" width="54" height="6" rx="3" fill="#F5F5F3"/>
  <circle cx="104" cy="22" r="20" fill="#E8590C" stroke="#F5F5F3" stroke-width="6"/>
  <circle cx="95" cy="22" r="3.2" fill="#FFFFFF"/>
  <circle cx="104" cy="22" r="3.2" fill="#FFFFFF"/>
  <circle cx="113" cy="22" r="3.2" fill="#FFFFFF"/>
</svg>
```
Deliverables: packages/brand/ with SVG logo (light, dark, mark-only), app icon (rounded square, ink background), WhatsApp profile picture (saffron circle), favicons (simplified mark: 2 lines, badge without dots at ≤ 48 px), OG image, email header.
Never use WhatsApp green as a brand colour.

14.2 Design tokens (KOT.ai dashboard and console)
Token	Light	Dark
--bg	#F5F5F3	#16181D
--surface	#FFFFFF	#1F2228
--text	#16181D	#F5F5F3
--muted	#565A62	#A9ADB5
--line	#E3E3DF	#2E3239
--brand (mark, highlights, large text)	#E8590C	#F07A33
--brand-strong (buttons with white text)	#C2410C	#F07A33 with ink text
--success	#15803D	#4ADE80
--warning	#B45309	#FBBF24
--danger	#B91C1C	#F87171
--info	#1D4ED8	#93C5FD

Type: Bricolage Grotesque (display/headings), IBM Plex Sans (UI/body), IBM Plex Mono (order refs, KOT tickets, prices in tables with tabular numerals). Load via next/font.
Radii 8 / 12 / 20; 4-px spacing scale; subtle 1-px borders over heavy shadows.
Light and dark mode; respect prefers-color-scheme with a manual toggle.
Implement as Tailwind theme + CSS variables in packages/brand (or packages/ui), with a small component library: Button, IconButton, Input, Select, Toggle, Badge/StatusPill, Card, TicketCard, Drawer, BottomSheet, Tabs, Table, EmptyState, Toast, Countdown, Stat, Timeline.

14.3 Signature motif
TicketCard: live order cards look like KOT slips — mono order ref, zigzag bottom edge, status pill, countdown for acceptance. Use the motif sparingly (orders only).

14.4 Restaurant-branded surfaces
The public ordering and tracking pages use the restaurant's logo and accent colour (from restaurant_profiles), with neutral KOT.ai base styles and a small "Powered by KOT.ai" footer. Validate tenant accent contrast; fall back to a safe shade if it fails WCAG.

15. UX principles and copy
15.1 Principles
Mobile-first everywhere; touch targets ≥ 44 px; WCAG 2.1 AA contrast; keyboard navigable dashboards; real buttons/links/labels.
Status is always visible: what happened, what happens next, and when.
Destructive or money actions (reject, refund, cancel) need confirmation with the amount shown.
Empty, loading and error states designed for every screen.
Indian formatting: ₹ with Indian digit grouping (₹1,23,450), 12-hour times with am/pm, dates like "Mon, 19 Oct".
15.2 WhatsApp copy rules
Short messages (≤ 3 short lines where possible), one question at a time, buttons for choices (max 3 reply buttons; lists for more).
Use the restaurant's voice from tenant persona settings; no emoji overload (max one per message, optional per tenant).
Always include the order ref in order messages.
15.3 Key message set (draft and keep in docs/copy/whatsapp.md, tenant-overridable)

Greeting, branch selection, location request, not serviceable, cart summary, bill summary, payment link, payment reminder, payment success, payment failed, link expired, order accepted, item unavailable choice, order rejected + refund, acceptance timeout + refund, preparing, food ready (takeaway), rider assigned, picked up, delivered, feedback, booking slots, booking confirmed, booking reminder, booking cancelled, handoff to human, back to bot, complaint received, complaint resolved, closed / out of hours, kitchen busy, opt-in request, opt-out confirmation, privacy notice.

15.4 Templates (out-of-window, per tenant, submit early)

Utility: order_update (generic status with order ref), payment_reminder, refund_processed, booking_confirmed, booking_reminder, booking_cancelled, complaint_update, restaurant_new_order_alert (to staff number). Marketing (opt-in only): offer_announcement. Verify categories and current pricing with Meta before budgeting.

16. Edge cases and graceful handling

Implement these defaults (configurable per Section 11); refine details during implementation and record decisions in ADRs.

Case	Default behaviour
Restaurant does not accept	Alert at X min (dashboard sound + WhatsApp to staff number), auto-cancel + full refund at Y min, apologise to customer.
Restaurant rejects a paid order	Mandatory reason; full refund automatically; customer informed with refund timeline.
Item unavailable after payment	Restaurant marks items → customer gets choices: replace (suggested items) / remove and refund the item / cancel and full refund. No reply within N min → remove and refund. Rider not booked until resolved.
Item goes out of stock during checkout	Re-validate before payment link; inform and update cart.
Payment success after link expiry / order cancelled	Auto-refund and inform; alert in dashboard.
Duplicate webhook	Idempotent no-op.
No rider available	Try next partner by priority; after timeout alert restaurant to deliver manually or cancel with refund; keep customer informed.
Rider cancels / delivery fails	Re-book or escalate; record partner and reason.
Customer cancels	Free before acceptance (full refund); after acceptance per tenant policy; not after pickup (becomes a complaint). Policy shown before payment.
Complaint (wrong/missing/quality/late)	Collect order ref (auto from last order), category, photo; ticket with SLA; resolution refund/coupon/redeliver; customer informed.
Human takeover	Triggers: "talk to human", angry sentiment, refund/complaint keywords, two failed understandings, staff click. Bot pauses for that conversation; staff replies from Inbox; auto-resume after close or idle timeout.
Voice note	Transcribe; read back understanding before acting on orders; on failure ask to type.
Closed / cut-off passed / kitchen busy	Tell customer when ordering reopens; offer booking.
Address outside radius / partner coverage	Offer takeaway, another branch, or booking.
POS down	Switch branch to manual adapter flow, alert restaurant and platform.
Plan limit reached	Customer still gets a graceful reply; tenant and platform alerted.
WhatsApp send failures / number quality drop / messaging limit reached	Retry with backoff; surface in dashboard and console; alert platform; pause marketing sends automatically.
Customer outside the 24-hour window when an update is due	Use the approved utility template; if none is approved, log and show in dashboard.
Customer sends unrelated/abusive content	Polite boundary; abusive → handoff/flag.
Marketing	Only with explicit opt-in (button); STOP/unsubscribe honoured immediately; order updates are not marketing.

17. Security, privacy and compliance
Signature/hash verification on every inbound webhook (Meta, Easebuzz, Petpooja, delivery partners where supported) + IP allow-listing where offered.
RLS on every tenant table; automated test that tenant A cannot read or write tenant B (API and direct DB).
Role checks in code for refunds, settings, credentials, exports; audit log for all of them.
Per-tenant credentials encrypted at rest (envelope encryption with a platform key); never logged; masked in UI.
Signed, expiring tokens for ordering and tracking links.
Rate limiting per sender and per IP; flood protection.
Prompt-injection defence; tools enforce permissions.
DPDP: privacy notice on first contact; purpose-limited collection; consent records for marketing; retention periods (configurable: chats, addresses, payment payloads); customer data export and deletion workflow; data-processing agreement template for restaurants (restaurant = fiduciary, KOT.ai = processor). Flag to me anything needing legal review.
Receipts carry the restaurant's legal name and GSTIN; tax rates come from POS/menu data, never hardcoded.
Backups, tested restore, secrets rotation procedure.

18. Observability
Structured logs with tenant_id, order_ref, conversation_id, correlation id across webhook → job → external call.
Sentry for errors (API, workers, web). Health endpoints for API and workers.
Dashboards/alerts: webhook failure rate, queue depth and age, payment pending > N min, acceptance timeouts, rider search failures, POS/partner errors, AI error rate and cost spikes, WhatsApp send failures.
Dead-letter queue with replay from the platform console.

19. Testing strategy
Unit: pricing/bill calculator, offers engine, quantity parsing, hours/cut-off resolver (incl. split shifts and midnight crossover), serviceability, every state machine transition, config resolver, token signing.
Integration: each adapter against mocks and, where available, sandboxes; webhook idempotency; duplicate and out-of-order events; late payment after expiry.
Conversation tests: scripted transcripts for every flow, mixed languages, mistakes, injection attempts; assert tool calls and final state, not exact wording.
E2E (Playwright): web ordering page (browse → cart → checkout → mock payment → confirmation), dashboard accept/reject/food ready, booking flow.
Security tests: RLS isolation, role permissions, signature rejection.
Regression: existing Alphabot bots keep working.
Load: a lunch-peak simulation (e.g. 50 concurrent conversations per tenant, several tenants) — confirm targets in Phase 0.
CI runs lint, type-check, unit and integration tests on every push; E2E on main/staging.

20. Environments, setup and deployment

Produce docs/SETUP.md (step-by-step, copy-pasteable) and docs/RUNBOOK.md.

20.1 Environments

local (Docker Compose: Postgres via Supabase CLI, Redis), staging (separate Supabase project, Render + Vercel preview/staging, test WhatsApp number, Easebuzz test mode, partner sandboxes/mocks), production.

20.2 Setup steps to document and script
Prerequisites (Node 22, npm, Supabase CLI, Docker, Render/Vercel CLIs).
Clone, install, .env files from .env.example (update the example with every new variable, documented).
Supabase: create projects, link, run migrations (supabase db push), seed (demo tenant "Demo Biryani House" with 2 branches, menu with variants/add-ons, offers, staff users), storage buckets, auth settings.
Redis: local + managed instance; queue dashboard (Bull Board) protected behind platform admin auth.
Meta: business verification of the KOT.ai company, app, Tech Provider / Embedded Signup setup (verify current requirements), test WABA and number, system user token, webhook URL registration and verify token, subscribe to messages; document the per-restaurant onboarding steps in the console wizard.
Easebuzz: test credentials per tenant via console, webhook URL registration.
Petpooja: sandbox credentials request, callback URLs.
Delivery partners: sandbox/test accounts, webhook URLs; mock adapter until available.
Google Maps key with restrictions; Sarvam key.
Domains + HTTPS: API (api.<domain>), dashboard (app.<domain>), ordering pages (order.<domain> or path-based).
CI/CD: GitHub Actions — lint, type-check, test, migrations check; deploy API/workers to Render and web to Vercel on main → staging, tag → production; migrations run as a gated step.
Monitoring: Sentry projects, uptime checks, alert channels.
Go-live checklist (Section 21, Phase 14).

21. Execution plan — phases and gates

Stop at each gate for my approval.

Phase	Output	Gate
0. Discovery & plan	CLAUDE.md, docs/REUSE_MAP.md, docs/AUDIT.md, docs/ARCHITECTURE.md (diagrams in Mermaid), docs/DATA_MODEL.md, docs/PLAN.md (milestones, sequencing, risks), docs/BACKLOG.md (complete), ADRs for queue choice, module layout, token design; list of questions	Approve plan & backlog
1. Environment & foundations	Local setup working, staging Supabase/Redis/Render/Vercel, CI pipeline, .env.example, SETUP.md, brand package + design tokens + UI kit skeleton, seed data	A test WhatsApp message reaches staging and is stored
2. Platform hardening	Section 4 fixes 1–8, durable queue, per-tenant encrypted credentials, tool-calling agent infrastructure, regression tests	All existing bot tests pass; security tests pass
3. Restaurant domain core	Data model + migrations + RLS, config resolver (Section 11), branches/hours/closures, menu model, POS adapter interface + Petpooja + manual adapters, menu sync	Demo tenant menu synced; hours resolver tests green
4. Conversation & AI agent	Restaurant agent with tools, greeting/knowledge, branch finder, location capture, geocoding, serviceability, voice notes	Conversation tests for discovery flows pass
5. Ordering	Server-side cart, pricing & offers engine, price lock/quotes, web ordering page, conversational ordering	Customer can build a cart in chat and web with correct bill
6. Payments	Easebuzz adapter, links, webhooks, reconciliation job, refunds (full/partial)	Test order paid end-to-end in sandbox; idempotency tests pass
7. Fulfilment	Push to POS, acceptance timeout, reject, item-unavailable flow, status messages, tracking page	Accept/reject/timeout/unavailable scenarios pass
8. Delivery	Delivery adapters, quote at checkout, booking at Food Ready, fallback, status sync, fee log	Mock/sandbox delivery completes end-to-end
9. Table booking	Availability, auto/staff modes, reminders, cancel/reschedule, seated/no-show	Booking scenarios pass
10. Tenant dashboard	Section 12 screens	UAT walkthrough with demo tenant
11. Platform console	Section 13 screens, onboarding wizard	New tenant onboarded via wizard in staging
12. Graceful handling & notifications	Takeover, complaints, cancellations, opt-in, DPDP workflows, templates submitted	Edge-case suite (Section 16) passes
13. Observability, performance, security review	Dashboards, alerts, load test, security checklist	All checklist items ticked
14. Pilot readiness	Pilot tenant onboarding, real small payment + refund test, one-day dry run, RUNBOOK, go-live checklist	Go-live approval
15. Catalog & Flows	WhatsApp catalog sync, multi-product messages, Flow checkout	Tenant can switch ordering mode

Go-live checklist (pilot)

WhatsApp number verified and display name approved · templates approved · Easebuzz live credentials tested with a real ₹1–10 payment and refund · POS mapping verified by restaurant · menu, prices, taxes, hours checked and signed off by owner · delivery partner live credentials tested with a real delivery · privacy notice live · staff trained on dashboard · monitoring + alerts live with named on-call · rollback plan documented.

22. Backlog — seed epics (expand into stories)

In Phase 0 expand every epic into stories in docs/BACKLOG.md using this format:

### ORD-07 Server-side price recompute at checkout
Epic: ORD · Phase: 5 · Priority: P0 · Status: todo · Depends on: PRC-01, CART-03
As a restaurant owner, I want totals computed on the server so that customers can never pay a tampered amount.
Acceptance criteria:
- Given a cart, when checkout is requested, then the total is recomputed from current menu, offers and delivery quote in paise.
- Given a client-supplied total, it is ignored.
- Given an expired quote, a new delivery quote is fetched before the payment link is created.
Tests: unit (pricing), integration (checkout endpoint)
Brief refs: §2 D10, §8.4, §17
Reuse: extends services/payment/easebuzz.ts (Alphabot); zod for request validation

Seed epics (each must be fully expanded; add more as needed):

SET — Environments, accounts, CI/CD, secrets, seed data, SETUP.md
AUD — Repo audit, architecture, ADRs
SEC — Webhook signatures, RLS tests, credential encryption, rate limits, role checks, audit
QUE — Durable queue, webhook event store, DLQ, replay
BRD — Logo assets, tokens, UI kit, light/dark, restaurant theming
CFG — Settings model, platform defaults/limits, tenant overrides, resolver, audit
BR — Branches, hours, shifts, closures, cut-offs, pause
MENU — Menu model, variants, add-ons, availability windows, stock, images, search
POS — Adapter interface, Petpooja, manual, menu sync, order push, callbacks, health
AGT — Restaurant agent, prompt builder, tools, guardrails, logging, language handling
CONV — Greeting, knowledge, branch finder, location request, address capture, voice notes
SRV — Serviceability (radius, partner coverage, hours)
CART — Server-side cart shared by chat and web
PRC — Bill calculator, taxes, packing, delivery fee rules, offers engine, price lock
WEB — Ordering page, signed links, checkout, return pages, tracking page, performance
ORD — Order service, state machine, order refs, notifications
PAY — Easebuzz adapter, links, webhooks, reconciliation, late payments, refunds
FUL — Push to POS, acceptance timeout, reject, item-unavailable flow, KOT print
DLV — Delivery adapters, quotes, booking at food ready, fallback, tracking, fee log
BKG — Table booking, availability, modes, reminders, reschedule, seated/no-show
HND — Human takeover, inbox, auto-resume
CMP — Complaints and resolutions
CAN — Customer cancellation and policies
MKT — Opt-in, opt-out, consent records, marketing template
PRV — DPDP notice, retention, export/delete, DPA template
WAB — WhatsApp number onboarding (Embedded Signup / Tech Provider), routing by phone_number_id, send throughput, quality and limit monitoring
TPL — WhatsApp templates per tenant, submission status
LNK — Share links, QR codes, source attribution
TKW — Takeaway flow, ready time, collection, uncollected orders
DSH — Tenant dashboard screens (Section 12, one story per screen minimum)
CON — Platform console screens, onboarding wizard (Section 13)
ANL — Analytics and funnel metrics
OBS — Logging, Sentry, metrics, alerts, health checks
TST — Test suites (unit, integration, conversation, E2E, load, regression)
DEP — Staging/prod deploys, domains, runbook, go-live
CAT — WhatsApp catalog sync and multi-product messages (Phase 15)
FLW — WhatsApp Flows checkout (Phase 15)

Traceability check (mandatory at end of Phase 0): produce docs/TRACEABILITY.md — a table mapping every section and bullet of this brief (§1–§21, every row of §2, §6 integrity rules, §11, §16) to backlog IDs. Any unmapped requirement is a defect in the backlog; fix it before asking for approval.

23. Definition of done (every story)
Code + migrations + RLS (if tenant data) + tests written and passing in CI.
Acceptance criteria demonstrably met (note how in the commit/PR).
No secrets, no floats for money, no hardcoded tenant data.
Errors handled and logged with correlation ids; user-facing failure states designed.
Docs updated (SETUP, integration notes, ADR if a decision was made, copy file if messages changed).
Reuse checked first: the story notes which Alphabot module or open-source library it reused, or why new code was needed; any copied third-party code is recorded in THIRD_PARTY_NOTICES.md.
Backlog status updated; docs/PROGRESS.md handoff note written.

24. Questions to ask me before or during Phase 0

Ask these (and any others you find) in one batch:

Production domain name(s) for API, dashboard and ordering pages.
Hosting region preference (Render Singapore today vs an India region) and data-residency requirements.
Which delivery partner to integrate first, and whether pilot restaurants already have accounts.
Pilot restaurant: name, branches, Petpooja status, menu export, WhatsApp number readiness.
Default values for timeouts, cut-offs, link expiry, reminder offsets, cancellation policy.
SaaS plan structure for KOT.ai tenants (reuse existing Alphabot plans or new).
Whether order and booking notifications to restaurant staff should go to a staff WhatsApp number, the dashboard only, or both.
Any feedback on the logo/theme before building the UI kit.
Status of KOT.ai's Meta business verification and Tech Provider application.
Whether pilot restaurants' existing WhatsApp numbers will be migrated to the Cloud API (they stop working in the regular WhatsApp Business app) or fresh numbers will be used.

Start now with Phase 0. Read the entire repository first, then produce the Phase 0 documents and the complete backlog, then stop and wait for my approval.
