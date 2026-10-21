# KOT.ai — Repo Audit (Phase 0)

Audit of the copied Alphabot baseline (commit `0665674`), deciding what KOT.ai keeps as-is, extends, replaces, or removes. This is the source of truth for the Step 1.3 prune commit. Verified against the actual code in this session (not assumed from the brief).

Legend: **KEEP** reuse unchanged · **EXTEND** reuse + add restaurant-specific behavior · **REPLACE** same area, new implementation (old code removed) · **REMOVE** not needed for KOT.ai MVP, deleted from this repo.

## 1. Known issues confirmed in the inherited code (fix in Phase 2, before payments)

| # | Issue | Evidence | Fix |
|---|---|---|---|
| 1 | No `X-Hub-Signature-256` verification on inbound Meta webhook | `apps/api/src/routes/webhook/index.ts` only checks the GET `hub.verify_token` challenge; no HMAC check on POST body | Add HMAC-SHA256 over raw body with app secret; reject on mismatch (SEC epic) |
| 2 | AI layer uses text markers (`[STAGE:x]`, `[BUTTONS:name]`, `CONFIDENCE:0.xx`) instead of tool calls | `services/ai/claude.ts` and webhook handler parse these markers from model output | New restaurant agent uses real Claude tool use (AGT epic); existing bots' marker-based pipeline is left alone since those bots are being removed anyway (§3 below) |
| 3 | `/api/orders` trusts client-supplied `total` and stores floats | `routes/orders/index.ts` inserts `items`/`total` from the request body verbatim, `.toFixed(2)` | Server-side pricing in paise, recomputed from menu+offers+delivery (PRC, ORD epics) |
| 4 | Easebuzz credentials are platform-wide env vars | `services/payment/easebuzz.ts` reads `EASEBUZZ_MERCHANT_KEY`/`EASEBUZZ_SALT` from `process.env` once at module load | Per-tenant encrypted credentials via `integration_credentials` table (SEC, PAY epics) |
| 5 | Easebuzz callback not idempotent, no amount check, relies on browser `surl` redirect | `services/payment/easebuzz.ts` `verifyEasebuzzCallback` | Server-to-server webhook, amount verification, idempotency key, reconciliation poll job (PAY epic) |
| 6 | Webhook processing runs in-process after the 200 ack, no durable queue | `routes/webhook/index.ts` sends `reply.status(200)` then `await handleWebhookPost(...)` synchronously; no BullMQ despite Redis being present | Durable queue (ADR 0001) for inbound, payment, POS, delivery events (QUE epic) |
| 7 | Plan-limit overflow silently drops replies | (present in webhook handler plan-limit branch) | Graceful customer reply + tenant/platform alert (OBS, CFG epics) |
| 8 | Hardcoded tenant strings (e.g. "Elma Industries") in payment descriptions | `services/payment/easebuzz.ts` | Must come from `restaurant_profiles`/tenant data (PAY epic) |

No dedicated migration files exist for `orders`/`payments`/`return_requests` matching the brief's description — `orders` is a generic table from `001_initial_schema.sql` (floats, no variants/menu model), `payments` is PhonePe/Easebuzz-subscription-oriented, `return_requests` is a simple return/replacement ticket with no SLA/photos. All three get **new KOT.ai schema** (DATA_MODEL.md), not a straight reuse.

## 2. Platform/infrastructure layer — KEEP or EXTEND (verified to exist)

| Area | Path | Decision |
|---|---|---|
| WhatsApp gateway + providers | `apps/api/src/services/whatsapp/gateway.ts`, `providers/meta.ts`, `providers/twilio.ts` | KEEP; EXTEND with location-request, order-confirmation, template helpers |
| Webhook entry + tenant/number routing | `routes/webhook/index.ts`, `services/routing/router.ts`, `services/bot-context.ts` | KEEP routing/resolution; EXTEND to add signature verification and route KOT.ai numbers to the new restaurant agent |
| Business hours/days | `lib/business-hours.ts`, `lib/business-days.ts` | EXTEND for split shifts, cut-offs, closures (BR epic) |
| Phone, retry, Redis, locks | `lib/phone.ts`, `lib/retry.ts`, `lib/redis.ts`, `lib/fire-forget.ts` | KEEP |
| LLM calls, cost tracking, model routing | `lib/anthropic.ts`, `lib/llm-router.ts`, `lib/llm-cost.ts`, `services/ai/*` | KEEP; EXTEND with a tool-use execution path for the restaurant agent (new, doesn't touch the marker-based path since old bots are removed) |
| Tool registry | `lib/tool-registry.ts` | EXTEND with the restaurant tool set (§9 of brief) |
| Knowledge base (RAG) | `services/kb/*` | KEEP for restaurant FAQs/policies |
| Contact memory | `services/contact/memory.ts`, `fact-extractor.ts` | KEEP (preferences, saved addresses context) |
| Escalation | `services/escalation/index.ts` | KEEP for human handoff triggers (strip only the sales-lead-notification part of it, keep the bot-pause/handoff mechanics) |
| Sentiment detection | `services/sentiment/detector.ts` | KEEP — brief Section 16 uses "angry sentiment" as a handoff trigger; re-point its usage from lead-scoring to handoff-triggering |
| Suppression/opt-out | `lib/suppression.ts` | KEEP for marketing STOP (MKT epic) |
| Scheduler + scheduled messages | `jobs/scheduler.ts`, `services/scheduled-messages/sender.ts`, `routes/scheduled-messages/` | KEEP — needed for booking reminders, payment-link reminders, acceptance-timeout checks, reconciliation polling |
| Voice transcription (STT only) | `services/voice/providers/stt/sarvam.ts`, `deepgram.ts` | KEEP only the STT provider files for transcribing inbound WhatsApp voice notes. **REMOVE** the outbound AI-calling pipeline (`services/voice/` call-manager/dispatch, `routes/voice/`, `routes/call-triggers`-equivalents) — KOT.ai doesn't make outbound sales calls |
| Easebuzz payment link + verification | `services/payment/easebuzz.ts` | EXTEND — per-tenant creds, server webhook, idempotency, refunds (PAY epic); see issue #4/#5 above |
| Orders route | `routes/orders/index.ts` | REPLACE pricing/trust logic (issue #3); keep the route shell/pattern |
| Invoice/receipt generator | `services/invoice/generator.ts` | KEEP for payment receipts |
| Return/complaint flow | `return_requests` migration + handling | EXTEND into the richer `complaints` model (categories, photos, SLA) — brief §6 |
| Daily report, insights, notifications inbox | `lib/email/daily-report.ts`, `services/insights/generator.ts`, notifications migrations (045–047) | KEEP for owner summaries and alerts |
| Internal/staff numbers | `tenant_internal_numbers` table + inline webhook logic (no `InternalNumbersManager` class exists) | EXTEND — extract the inline logic into a proper service when building staff order/booking alerts (brief's claim of an existing manager class doesn't hold) |
| Audit logs | `audit_logs` migration (042) | KEEP |
| Dashboard shell, nav, auth, team invites | `components/dashboard-shell.tsx`, `topbar.tsx`, `platform-nav.tsx`, `components/dashboard/TeamInviteForm.tsx`, `components/platform/InviteUserForm.tsx`, `app/(auth)/*` | KEEP; re-theme with KOT.ai brand tokens |
| Conversations inbox | `components/RecentConversations.tsx`, `conversation-messages.tsx`, `conversation-actions.tsx` | EXTEND with an order/booking side panel and takeover controls |
| WhatsApp number setup UI | `components/dashboard/WhatsAppNumbersManager.tsx`, `WhatsAppSetupSection.tsx`, `components/platform/WhatsAppNumberSection.tsx` | KEEP, reuse in the onboarding wizard |
| Notifications/persona/guardrails settings UI | `components/dashboard/NotificationSettings.tsx`, `PersonaEditor.tsx`, `components/platform/TenantGuardrailsForm.tsx` | KEEP |
| Billing/plans UI | `components/platform/BillingManager.tsx`, subscription routes | KEEP for KOT.ai SaaS plans |
| Monorepo tooling | npm workspaces + Turborepo, Node 22.15.0, `turbo.json`, `tsconfig.base.json` | KEEP as-is |
| packages/shared, packages/database | TS types, Supabase client (`getServerClient`, `getTenantClient`) | KEEP; types get a `restaurant.ts` addition, RLS pattern reused for new tables |

No `packages/brand`/`packages/ui` exists — KOT.ai's brand/token package (brief §14) is **net-new**, built fresh rather than extracted from `apps/web`'s local Tailwind config.

## 3. Sales/lifecycle/campaign vertical — REMOVE

These are specific to Alphabot's sales-lead and marketing-campaign bots, which KOT.ai does not need to keep working (per the user's decision to fork rather than build inside Alphabot). Verified by direct exploration of `apps/api/src/routes`, `apps/api/src/services`, and `apps/web/src/app`.

**API routes removed:** `routes/broadcast/`, `routes/campaigns/`, `routes/inbound/` (Zapier/Make lead webhook), `routes/voice/`, `routes/integrations/` (entirely CRM inbound/outbound webhooks — on inspection there was no separate POS/delivery/payment-credential logic in this file to preserve; KOT.ai's credential management routes are net-new, built in Phase 3+). The outbound-call auto-dispatch helper inside `services/escalation/index.ts` and the call-trigger block inside `routes/webhook/index.ts` were also removed (they called the now-deleted `services/voice/call-manager.ts`).

**API services removed:** `services/broadcast/`, `services/campaign/`, `services/outbound/` (CRM webhook push), the call-manager/dispatch portions of `services/voice/` (STT provider files are kept, see §2).

**Web dashboard removed:** `(dashboard)/campaigns/`, `(dashboard)/leads/`, `(dashboard)/follow-ups/`, `(dashboard)/groups/`, `(dashboard)/call-triggers/`, `(dashboard)/voice/` (outbound calling UI), `(dashboard)/button-templates/` (evaluate for reuse as WhatsApp template management — see §4), `(dashboard)/agency-billing/`, `(dashboard)/agency-clients/` (agency-reseller model out of scope for KOT.ai MVP), `(dashboard)/contacts/` if purely CRM/segment-oriented (customer list is rebuilt per brief §12 "Customers" screen using the `customers`/`contacts` data model, not this CRM UI).

**Web actions removed:** `actions/leads.ts`, `lifecycle.ts`, `sales-config.ts`, `stage-funnel.ts`, `outcome-analytics.ts`, `followup-analytics.ts`, `follow-up.ts`, `broadcasts.ts`, `call-triggers.ts`, `agency.ts`.

**Web pages removed:** `prospect-advisor/` (sales-pitch tool for prospects).

**Platform console removed:** `(platform)/platform/voice-providers/`, `(platform)/platform/margin/` (agency margin — out of scope), `(platform)/platform/bot-guardrails/` if fully superseded by the generalized `guardrails` page.

**Root-level marketing collateral removed:** `Marketing/` (entire folder), `AI_COACH_INGEST.md`, `ALPHABOT_ADVISOR.md`, `Alphabot — Bot Use Cases by Industry.mhtml`, `Alphabot_Product_Deck_V5_Final_v2.pptx`, `ROI_MODEL.md`, `alphabot-roi-builder.html`, `alphabot-improvements.pdf`, `tenant-intake.html`, `TENANT_MASTER_SPEC.template.md`, `tenant-master-spec.schema.json` — these are Alphabot's own sales pitch/onboarding-intake tooling for prospecting new Alphabot customers across arbitrary industries; not needed once KOT.ai is its own product with its own onboarding wizard (brief §13).

## 4. Needs a decision before pruning (flagged, not auto-removed)

- **`button-templates` (route + dashboard page):** currently framed as marketing broadcast button templates. Brief §15.4 needs per-tenant WhatsApp template submission/status tracking (TPL epic) for `order_update`, `payment_reminder`, etc. **Decision: EXTEND, don't remove** — repurpose this infra for KOT.ai's utility/marketing template set rather than building template management from scratch.
- **`services/sentiment/detector.ts`:** exploration flagged it as "lead-scoring oriented" in its current call sites. **Decision: KEEP the detector, REPLACE its call sites** — wire it into the human-handoff trigger (brief §16) instead of lead scoring.
- **`services/escalation/index.ts`:** mixes handoff mechanics with sales-lead notification. **Decision: KEEP the handoff/bot-pause mechanics, REMOVE the lead-notification-specific branch**, confirmed during Phase 2 hardening.
- **`(dashboard)/contacts/`, `(dashboard)/groups/`:** need a closer read in Phase 3 before final deletion — if any part is a generic customer list (not broadcast-segment-specific), keep that part and rebuild the rest per brief §12.

## 5. Net-new for KOT.ai (brief has no Alphabot equivalent)

Restaurant domain modules (`modules/restaurant/*`: menu, cart, pricing, bookings, serviceability, hours extensions), POS adapters (Petpooja, manual), delivery adapters (Shadowfax, Borzo, Porter, manual), geocoding adapter, brand/token package (`packages/brand`), public ordering page (`/o/...`) and tracking page (`/t/...`), signed-link tokens, durable queue wiring, per-tenant encrypted credentials, all restaurant data model tables (§6 of brief), the restaurant agent's tool-calling path, WhatsApp catalog/Flows (Phase 15).

## 6. Risks carried forward

- Stripping sales/campaign code may have hidden shared dependencies (e.g., `suppression.ts` used by both opt-out and campaign unsubscribe) — the Step 1.3 prune commit must be followed by a type-check/build pass (see plan's Verification section) to catch dangling imports before anything else is built on top.
- No existing durable-queue usage despite Redis being present — ADR 0001 decides BullMQ vs. Postgres-backed queue before Phase 2 work starts.
- Petpooja's support for order edits (post-payment item removal) is unverified against current docs — flagged for `docs/integrations/petpooja.md` in Phase 3, with a documented fallback (cancel-and-repush or staff note) if edits aren't supported.
