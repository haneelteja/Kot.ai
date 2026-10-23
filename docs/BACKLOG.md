# KOT.ai — Backlog (Phase 0)

Format per brief §22. `Status` starts `todo` for everything; update in place as work proceeds (`todo` / `in-progress` / `done` / `blocked`). `Phase` matches `docs/PLAN.md`. Every story must be traceable from `docs/TRACEABILITY.md`.

---

## SET — Environments, accounts, CI/CD, secrets, seed data, SETUP.md

### SET-01 Local dev environment
Epic: SET · Phase: 1 · Priority: P0 · Status: in-progress · Depends on: —
Note: docs/SETUP.md written and docker-compose/seed script exist; not yet executed end-to-end by a human against a real local Supabase instance.
As a developer, I want a documented local setup so I can run the full stack without guessing.
Acceptance criteria:
- Given a fresh clone, `docs/SETUP.md`'s steps (Node 22, Supabase CLI, Docker, `npm install`, `.env` from `.env.example`) produce a running API + web + local Postgres/Redis.
- Given the seed script, a demo tenant "Demo Biryani House" with 2 branches, menu, offers, staff users exists.
Tests: manual verification checklist in `docs/SETUP.md`
Brief refs: §20.1, §20.2
Reuse: `docker-compose.yml`, `.env.example` (extend, don't replace)

### SET-02 Staging environment
Epic: SET · Phase: 1 · Priority: P0 · Status: in-progress · Depends on: SET-01
Note: Vercel (`kot-ai` project) + Supabase (`qogsclmwnthienjxkjbu`, Singapore) are live and connected — but as one environment serving as Vercel's "Production," not a separate staging tier per the brief's three-environment model. No WhatsApp number connected yet, so the actual Phase 1 gate ("a test WhatsApp message reaches staging and is stored") is still open. apps/api isn't deployed anywhere yet (Render pending).
As the team, I want a staging environment so changes are verified before production.
Acceptance criteria:
- Given staging Supabase/Render/Vercel projects, a test WhatsApp message reaches staging and is stored (Phase 1 gate).
- Given staging Easebuzz test mode and partner sandboxes/mocks, no staging call touches a real payment or delivery partner.
Tests: staging smoke test (manual, scripted in RUNBOOK)
Brief refs: §20.1
Reuse: `render.yaml`, Vercel project (extend)

### SET-03 CI pipeline
Epic: SET · Phase: 1 · Priority: P0 · Status: in-progress · Depends on: —
Note: lint step and a migration-filename-convention check added to .github/workflows/ci.yml; not yet observed passing on a real CI run.
As a developer, I want CI to catch regressions before merge.
Acceptance criteria:
- Given a push, lint/type-check/unit/integration tests run via GitHub Actions.
- Given a migrations change, a gated migrations-check step runs before deploy.
Tests: CI itself (meta)
Brief refs: §19, §20.2
Reuse: `.github/workflows/*` (extend existing ci.yml/deploy-render.yml)

### SET-04 .env.example completeness
Epic: SET · Phase: 1 · Priority: P1 · Status: done · Depends on: —
As a developer, I want every required env var documented so setup never silently fails.
Acceptance criteria:
- Given any new integration credential introduced in later phases, `.env.example` gains a documented entry in the same PR.
Tests: lint rule or manual review checklist
Brief refs: §20.2
Reuse: `.env.example` (extend)

### SET-05 Seed data script
Epic: SET · Phase: 1 · Priority: P0 · Status: in-progress · Depends on: BR-01, MENU-01
Note: `packages/database/src/seed.ts` seeds a demo tenant + restaurant_bot product + placeholder WhatsApp number now; branches/menu/offers wait on BR-01/MENU-01 (Phase 3).
As a developer, I want realistic seed data so every later story can be tested against a believable tenant.
Acceptance criteria:
- Given the seed script runs, "Demo Biryani House" has 2 branches with hours, a menu with variants/add-ons, offers, and staff users with roles.
Tests: integration (seed script runs idempotently)
Brief refs: §20.2
Reuse: none — net-new

### SET-06 Secrets rotation procedure
Epic: SET · Phase: 13 · Priority: P1 · Status: done · Depends on: SEC-02
As the platform operator, I want a documented rotation procedure so a leaked credential doesn't require guesswork under pressure.
Acceptance criteria:
- Given `docs/RUNBOOK.md`, rotating the signed-link secret, Easebuzz platform fallback key, and Supabase service key each have a documented step list.
Tests: tabletop walkthrough (manual)
Brief refs: §17
Reuse: none — net-new

---

## AUD — Repo audit, architecture, ADRs

### AUD-01 Repo audit document
Epic: AUD · Phase: 0 · Priority: P0 · Status: done · Depends on: —
As the engineering team, I want a verified audit of the inherited codebase so later stories don't re-discover what already exists.
Acceptance criteria:
- Given the pruned repo, `docs/AUDIT.md` lists every reuse candidate's real path, verified by direct inspection, with keep/extend/replace/remove and a reason.
Tests: — (documentation)
Brief refs: §4, §0A.1
Reuse: n/a

### AUD-02 Reuse map
Epic: AUD · Phase: 0 · Priority: P0 · Status: done · Depends on: AUD-01
As the engineering team, I want the brief's reuse table corrected against reality so future sessions don't trust stale paths.
Acceptance criteria:
- Given `docs/REUSE_MAP.md`, every row's path is verified; corrections to the brief's assumptions are called out explicitly.
Tests: — (documentation)
Brief refs: §0A.1
Reuse: n/a

### AUD-03 Architecture document
Epic: AUD · Phase: 0 · Priority: P0 · Status: done · Depends on: AUD-01
As the engineering team, I want request-flow and module-layout diagrams so new contributors don't have to reverse-engineer the system.
Acceptance criteria:
- Given `docs/ARCHITECTURE.md`, the WhatsApp inbound flow and external-webhook flow are diagrammed in Mermaid and match the actual (pruned) code paths.
Tests: — (documentation)
Brief refs: §5
Reuse: n/a

### AUD-04 Architecture decision records
Epic: AUD · Phase: 0 · Priority: P0 · Status: done · Depends on: AUD-03
As the engineering team, I want key technical decisions written down so they aren't re-litigated every session.
Acceptance criteria:
- Given `docs/adr/`, ADRs exist for queue choice (0001), module layout (0002), signed-link token design (0003), and the repo-bootstrap approach (0004).
Tests: — (documentation)
Brief refs: §0, §21 Phase 0 row
Reuse: n/a

---

## SEC — Webhook signatures, RLS tests, credential encryption, rate limits, role checks, audit

### SEC-01 Meta webhook signature verification
Epic: SEC · Phase: 2 · Priority: P0 · Status: todo · Depends on: —
As the platform, I want inbound Meta webhooks verified so forged requests can't inject fake orders or messages.
Acceptance criteria:
- Given a POST to `/api/webhook/:tenantId/:productType` without a valid `X-Hub-Signature-256`, the request is rejected with 401 before any processing.
- Given a valid signature, processing proceeds unchanged.
Tests: unit (HMAC verification), integration (reject/accept)
Brief refs: §4 issue 1, §17
Reuse: extends `routes/webhook/index.ts`

### SEC-02 Per-tenant encrypted integration credentials
Epic: SEC · Phase: 2 · Priority: P0 · Status: todo · Depends on: —
As a restaurant owner, I want my Easebuzz/POS/delivery credentials isolated from other tenants and never stored in plaintext.
Acceptance criteria:
- Given a tenant saves Easebuzz credentials, they are envelope-encrypted at rest in `integration_credentials`, never logged, masked in the UI.
- Given two tenants, tenant A's credentials are never readable via tenant B's session (API or direct DB).
Tests: unit (encrypt/decrypt round-trip), security test (cross-tenant read attempt)
Brief refs: §4 issue 4, §17
Reuse: "follow the per-tenant credential pattern used for Exotel" (brief) — verify that pattern in Phase 2 and reuse its shape

### SEC-03 RLS cross-tenant isolation test suite
Epic: SEC · Phase: 2 · Priority: P0 · Status: todo · Depends on: —
As the platform, I want automated proof that tenant data can't leak across tenants.
Acceptance criteria:
- Given tenant A and tenant B fixtures, an automated test attempts cross-tenant reads/writes on every tenant-scoped table and asserts all are denied by RLS.
Tests: security/integration suite, run in CI
Brief refs: §17
Reuse: existing RLS policies (verify coverage, add tests)

### SEC-04 Rate limiting per sender and IP
Epic: SEC · Phase: 2 · Priority: P1 · Status: todo · Depends on: —
As the platform, I want flood protection so a single abusive sender can't degrade service for other tenants.
Acceptance criteria:
- Given a sender exceeds the configured rate, further requests are throttled with a clear error, not a silent drop.
Tests: integration (rate-limit trigger)
Brief refs: §17
Reuse: `@fastify/rate-limit` (already configured in `server.ts`) — extend keying to cover new webhook sources

### SEC-05 Role checks for money/credential/export actions
Epic: SEC · Phase: 6 · Priority: P0 · Status: todo · Depends on: SEC-02
As a restaurant owner, I want only authorized roles to issue refunds, change credentials, or export customer data.
Acceptance criteria:
- Given a Staff-role user attempts a refund or credential change, the action is denied with an audit log entry.
- Given an Owner/Manager performs the same action, it succeeds and is audited.
Tests: unit (role matrix), integration (denied/allowed paths)
Brief refs: §12, §17
Reuse: existing role model (`tenant_users.role`) — extend checks to new restaurant actions

### SEC-06 Signature/hash verification on all external webhooks
Epic: SEC · Phase: 6-8 · Priority: P0 · Status: todo · Depends on: PAY-03, POS-05, DLV-05
As the platform, I want every external webhook (Easebuzz, Petpooja, delivery partners) verified so forged events can't corrupt order state.
Acceptance criteria:
- Given a webhook without a valid signature/hash (where the provider supports one), it is rejected and logged.
Tests: integration, per-provider
Brief refs: §17
Reuse: `services/payment/easebuzz.ts`'s existing hash verification pattern, extended to POS/delivery

---

## QUE — Durable queue, webhook event store, DLQ, replay

### QUE-01 BullMQ queue infrastructure
Epic: QUE · Phase: 2 · Priority: P0 · Status: todo · Depends on: —
As the platform, I want inbound processing durable across crashes so no customer message or payment event is silently lost.
Acceptance criteria:
- Given the API acks a webhook with 200, the actual processing job survives a process restart before completion.
- Given a job fails, it retries with backoff per ADR 0001's configuration.
Tests: integration (kill process mid-job, verify resumption)
Brief refs: §4 issue 6, §21 Phase 2
Reuse: existing Redis (`lib/redis.ts`); new BullMQ wiring per ADR 0001

### QUE-02 webhook_events idempotency store
Epic: QUE · Phase: 2 · Priority: P0 · Status: todo · Depends on: QUE-01
As the platform, I want duplicate webhook deliveries to be no-ops so retries from Meta/Easebuzz/Petpooja/partners never double-process an event.
Acceptance criteria:
- Given the same external event id arrives twice, the second delivery is a recorded no-op.
Tests: unit (idempotency check), integration (duplicate delivery)
Brief refs: §16 "Duplicate webhook"
Reuse: net-new table, pattern follows existing `whatsapp_msg_id` dedupe

### QUE-03 Dead-letter queue and replay
Epic: QUE · Phase: 2 · Priority: P1 · Status: todo · Depends on: QUE-01
As a platform operator, I want failed jobs visible and replayable so I can recover from a transient outage without data loss.
Acceptance criteria:
- Given a job exhausts its retries, it lands in a DLQ visible in the platform console with a replay action.
Tests: integration (force failure, replay)
Brief refs: §13, §18
Reuse: `@bull-board/api` (brief §0A.2)

### QUE-04 Bull Board behind platform auth
Epic: QUE · Phase: 1 · Priority: P1 · Status: todo · Depends on: QUE-01
As a platform operator, I want to inspect queue health without exposing it publicly.
Acceptance criteria:
- Given an unauthenticated request to the Bull Board route, it is rejected.
- Given a platform-admin session, the board renders queue depth/age.
Tests: integration (auth gate)
Brief refs: §20.2
Reuse: `@bull-board/api`

---

## BRD — Logo assets, tokens, UI kit, light/dark, restaurant theming

### BRD-01 Brand package and design tokens
Epic: BRD · Phase: 1 · Priority: P0 · Status: done · Depends on: —
As a designer/developer, I want KOT.ai's tokens in one place so every screen stays visually consistent.
Acceptance criteria:
- Given `packages/brand`, CSS variables for the Ink/Paper/Saffron palette and status colours (from `docs/DESIGN.md`, which supersedes brief §14 where they differ) are defined for light and dark.
- Given `apps/web`'s Tailwind config, it consumes `packages/brand`'s tokens rather than redefining them.
Tests: visual check (Storybook or a token-preview page)
Brief refs: §14 (superseded in detail by `docs/DESIGN.md`)
Reuse: none existing — net-new package

### BRD-02 Logo assets
Epic: BRD · Phase: 1 · Priority: P0 · Status: done · Depends on: BRD-01
As the platform, I want the full logo asset set (light/dark, mark-only, favicons, app icon, WhatsApp profile, OG image) available for every surface that needs it.
Acceptance criteria:
- Given `packages/brand/assets/`, light/dark logo, tagline variants, mark, app icon, favicon, and WhatsApp profile files are present per `docs/DESIGN.md` §2's file list.
Tests: — (asset presence check)
Brief refs: §14.1
Reuse: full set extracted from `Design/kotai-brand.zip` into `packages/brand/assets/` (18 files) and `apps/web/public/` (5 files, favicons/app icons/apple-touch-icon per `docs/DESIGN.md` §13's placement note)

### BRD-03 UI kit component skeleton
Epic: BRD · Phase: 1 · Priority: P0 · Status: in-progress · Depends on: BRD-01
As a developer, I want a shared component set so dashboard screens don't each reinvent buttons/cards/tables.
Acceptance criteria:
- Given `packages/brand` (or a sibling `packages/ui`), Button, Input, Select, Toggle, Badge/StatusPill, Card, Drawer, Tabs, Table, EmptyState, Toast, Countdown, Stat, Timeline exist and are themed.
Tests: visual check — live at `/platform/design`
Brief refs: §14.2
Reuse: `shadcn/ui` copy-in pattern (brief §0A.2)
Note: built in `apps/web/src/components/kot-ui/` rather than a separate `packages/ui` workspace — apps/web is currently the only consumer, so a cross-package build/tsconfig setup (React/JSX types, a second workspace) added risk without benefit; the component API is portable if/when a second consumer appears. First 7 components done (Button, StatusPill, TicketCard, Countdown, Card, EmptyState, Input); Select/Toggle/Drawer/Tabs/Table/Toast/Stat/Timeline still open — built as each screen that needs them is implemented (DSH/WEB epics).

### BRD-04 TicketCard motif
Epic: BRD · Phase: 10 · Priority: P1 · Status: done · Depends on: BRD-03
As a restaurant staff member, I want live order cards to read instantly as kitchen tickets.
Acceptance criteria:
- Given the Live Orders kanban, each card uses the zigzag-edge TicketCard component with mono order ref, status pill, and acceptance countdown.
Tests: visual check
Brief refs: §14.3
Reuse: BRD-03's component set
Note: component built (`apps/web/src/components/kot-ui/TicketCard.tsx`) and previewed at `/platform/design`; wiring it into the actual Live Orders kanban happens with ORD-06 (Phase 10).

---

## CFG — Settings model, platform defaults/limits, tenant overrides, resolver, audit

### CFG-01 Two-level settings schema
Epic: CFG · Phase: 3 · Priority: P0 · Status: todo · Depends on: —
As the platform, I want platform defaults/limits and tenant overrides modeled separately so a tenant can't exceed platform-set bounds.
Acceptance criteria:
- Given `platform_settings_defaults` and `tenant_settings`, every setting in brief §11's table has a platform default (+ min/max where listed) and a tenant override column.
Tests: unit (schema validation)
Brief refs: §11
Reuse: none — net-new

### CFG-02 Config resolver
Epic: CFG · Phase: 3 · Priority: P0 · Status: todo · Depends on: CFG-01
As a developer, I want one function that returns the effective value for any setting so no code path re-implements the override logic.
Acceptance criteria:
- Given a tenant override exists and is within platform min/max, the resolver returns the override.
- Given no override exists, the resolver returns the platform default.
- Given an override outside min/max, the resolver clamps and logs a warning.
Tests: unit (all three branches)
Brief refs: §11
Reuse: none — net-new

### CFG-03 Platform defaults/limits console UI
Epic: CFG · Phase: 11 · Priority: P0 · Status: todo · Depends on: CFG-02
As a platform operator, I want to set defaults and limits without a deploy.
Acceptance criteria:
- Given the platform console's settings screen, every brief §11 row is editable with min/max enforcement in the form.
Tests: E2E (set a default, verify resolver picks it up)
Brief refs: §13
Reuse: `components/platform/TenantGuardrailsForm.tsx` pattern

### CFG-04 Tenant settings UI
Epic: CFG · Phase: 10 · Priority: P0 · Status: todo · Depends on: CFG-02
As a restaurant owner, I want to adjust my own settings within the platform's allowed range.
Acceptance criteria:
- Given the tenant dashboard's settings screen, every tenant-adjustable row from brief §11 is editable, with out-of-range values rejected client- and server-side.
Tests: E2E
Brief refs: §12
Reuse: `components/dashboard/NotificationSettings.tsx` pattern

### CFG-05 Settings change audit
Epic: CFG · Phase: 3 · Priority: P1 · Status: todo · Depends on: CFG-02
As a platform operator, I want every settings change audited so disputes about "who changed the cancellation policy" are resolvable.
Acceptance criteria:
- Given any settings write (platform or tenant level), an `audit_logs` row records actor, old value, new value, timestamp.
Tests: integration
Brief refs: §11 "All settings changes are audited"
Reuse: existing `audit_logs` table/pattern

---

## BR — Branches, hours, shifts, closures, cut-offs, pause

### BR-01 Branch CRUD
Epic: BR · Phase: 3 · Priority: P0 · Status: todo · Depends on: —
As a restaurant owner, I want to register my branches with address, location, and POS mapping.
Acceptance criteria:
- Given a new branch, name/address/lat-lng/phone/timezone/delivery_radius_m/pos_provider/pos_store_ref are stored and RLS-scoped to the tenant.
Tests: integration (CRUD)
Brief refs: §6 `branches`
Reuse: none — net-new

### BR-02 Branch hours and split shifts
Epic: BR · Phase: 3 · Priority: P0 · Status: todo · Depends on: BR-01
As a restaurant owner, I want to set opening hours including split shifts (e.g. lunch/dinner) and weekly offs.
Acceptance criteria:
- Given a branch with two shifts on a day, the hours resolver correctly reports "open" only during either shift window, including midnight-crossing shifts.
Tests: unit (hours resolver, incl. midnight crossover)
Brief refs: §6 `branch_hours`, §19
Reuse: extends `lib/business-hours.ts`

### BR-03 Ad-hoc closures and kitchen-busy pause
Epic: BR · Phase: 3 · Priority: P0 · Status: todo · Depends on: BR-02
As a restaurant staff member, I want a one-tap pause for "kitchen is too busy" with auto-resume.
Acceptance criteria:
- Given staff taps "pause ordering" with a resume time, new orders are blocked until that time, then automatically re-enabled.
Tests: integration (pause/auto-resume)
Brief refs: §6 `branch_runtime_status`, §11
Reuse: none — net-new

### BR-04 Order cut-off resolver
Epic: BR · Phase: 3 · Priority: P0 · Status: todo · Depends on: BR-02
As a restaurant owner, I want a configurable last-order cut-off per branch so the kitchen isn't blindsided near closing.
Acceptance criteria:
- Given a branch closes at 11pm with a 30-min cut-off, ordering is blocked after 10:30pm with a clear "reopens at X" message.
Tests: unit
Brief refs: §11, §16 "Closed / cut-off passed"
Reuse: extends BR-02's resolver

### BR-05 Out-of-hours behaviour
Epic: BR · Phase: 3 · Priority: P1 · Status: todo · Depends on: BR-04
As a restaurant owner, I want to choose what happens when a customer messages outside hours.
Acceptance criteria:
- Given the tenant setting is "take booking", an out-of-hours customer is offered table booking instead of ordering.
- Given the tenant has pre-orders enabled, the bot states the next opening time and offers to take a pre-order for then, instead of just declining.
Tests: conversation test
Brief refs: §11, §16 — pre-order branch added per Restaurant OS Flow Map "Order and pay" flow
Reuse: CFG-02 resolver

---

## MENU — Menu model, variants, add-ons, availability windows, stock, images, search

### MENU-01 Menu data model
Epic: MENU · Phase: 3 · Priority: P0 · Status: todo · Depends on: BR-01
As a restaurant owner, I want categories, items, variants, and add-on groups modeled so the bot and web page can both read one source of truth.
Acceptance criteria:
- Given `menu_categories`/`menu_items`/`item_variants`/`addon_groups`/`addons`, prices are paise, tax_rate_bp and packing_charge_paise are present, and min/max select rules exist on add-on groups.
Tests: unit (schema), integration (CRUD)
Brief refs: §6
Reuse: none — net-new (brief's claimed Alphabot "catalogue" is the closest existing UI, reused for the editor shell only)

### MENU-02 Item availability windows and stock toggles
Epic: MENU · Phase: 3 · Priority: P0 · Status: todo · Depends on: MENU-01
As a restaurant staff member, I want to mark an item out of stock or time-limited without deleting it.
Acceptance criteria:
- Given an item outside its `available_from`/`available_to` window or toggled out of stock, it's excluded from `search_menu` results and shown greyed on the web page.
Tests: unit
Brief refs: §6, §8.4
Reuse: none — net-new

### MENU-03 Menu search (pg_trgm)
Epic: MENU · Phase: 4 · Priority: P0 · Status: todo · Depends on: MENU-01
As a customer, I want to type a dish name loosely and have the bot find it.
Acceptance criteria:
- Given "biriyani" (misspelled), `search_menu` returns "Chicken Biryani" as a top match.
Tests: unit (fuzzy match cases)
Brief refs: §0A.2, §9 `search_menu` tool
Reuse: Postgres `pg_trgm` (brief preference over client-side fuse.js for server-side search)

### MENU-04 Menu editor UI
Epic: MENU · Phase: 10 · Priority: P0 · Status: todo · Depends on: MENU-01
As a restaurant owner, I want to edit the menu from the dashboard when there's no POS, or review the POS-synced menu read-only.
Acceptance criteria:
- Given a manual-adapter branch, all menu fields are editable; given a Petpooja-synced branch, POS-sourced fields are read-only with a "synced from POS" indicator.
Tests: E2E
Brief refs: §12 "Menu & stock"
Reuse: `(dashboard)/catalogue` pattern, adapted

### MENU-05 Petpooja menu sync
Epic: MENU · Phase: 3 · Priority: P0 · Status: todo · Depends on: MENU-01, POS-02
As a restaurant owner using Petpooja, I want my POS menu to populate KOT.ai automatically.
Acceptance criteria:
- Given a Petpooja menu push, items/variations/add-ons/taxes map correctly into `menu_items`/`item_variants`/`addon_groups`.
Tests: integration (mock Petpooja payload)
Brief refs: §10 Petpooja `syncMenu`/`onMenuPush`
Reuse: none — net-new

### MENU-06 Menu item images
Epic: MENU · Phase: 10 · Priority: P2 · Status: todo · Depends on: MENU-04
As a restaurant owner, I want to upload item photos to make the ordering page more appealing.
Acceptance criteria:
- Given an image upload, it's stored in Supabase Storage and served resized/lazy-loaded on the ordering page.
Tests: integration (upload + resize)
Brief refs: §8.4
Reuse: Supabase Storage (existing)

### MENU-07 Bulk menu import with change preview
Epic: MENU · Phase: 3 · Priority: P1 · Status: todo · Depends on: MENU-01
As a restaurant owner, I want to upload a spreadsheet of menu changes and see exactly what will change before it goes live.
Acceptance criteria:
- Given an uploaded sheet, every changed price and every added/removed item is shown as a diff; nothing is applied until the owner explicitly approves the preview.
- Given approval, the change is applied atomically and logged the same way a single-item edit is (MENU-02's change log).
Tests: integration (diff generation, atomic apply)
Brief refs: net-new, derived from Restaurant OS Flow Map "Menu, stock and prices" flow
Reuse: MENU-01 data model

---

## POS — Adapter interface, Petpooja, manual, menu sync, order push, callbacks, health

### POS-01 PosAdapter interface
Epic: POS · Phase: 3 · Priority: P0 · Status: todo · Depends on: —
As a developer, I want one interface so Petpooja and manual (and future POS providers) are interchangeable from the order service's perspective.
Acceptance criteria:
- Given the interface (`syncMenu`, `onMenuPush`, `pushOrder`, `cancelOrder`, `updateOrder`, `onStatusCallback`, `onStockUpdate`, `onStoreToggle`, `healthCheck`), both Petpooja and manual adapters implement it fully.
Tests: unit (interface conformance per adapter)
Brief refs: §10
Reuse: none — net-new

### POS-02 Petpooja adapter — menu sync and order push
Epic: POS · Phase: 3 · Priority: P0 · Status: todo · Depends on: POS-01
As a restaurant owner using Petpooja, I want paid orders to appear in my POS automatically.
Acceptance criteria:
- Given a paid order, `pushOrder` sends it to Petpooja marked prepaid/online-paid with delivery/packing charges and customer details.
Tests: integration (mock Petpooja API, doc version recorded in `docs/integrations/petpooja.md`)
Brief refs: §10
Reuse: none — net-new, verify current docs before implementing (brief §0 rule)

### POS-03 Petpooja status callbacks
Epic: POS · Phase: 7 · Priority: P0 · Status: todo · Depends on: POS-02
As a restaurant owner, I want Petpooja's accept/reject/food-ready events to drive the order state machine.
Acceptance criteria:
- Given a Petpooja "Food Ready" callback, the order transitions to `food_ready` and delivery booking is triggered (D4).
Tests: integration (mock callback)
Brief refs: §10, §7 Order state machine
Reuse: none — net-new

### POS-04 Petpooja order-edit fallback
Epic: POS · Phase: 7 · Priority: P1 · Status: todo · Depends on: POS-02
As a restaurant staff member, I want a documented fallback if Petpooja doesn't support editing a pushed order for an unavailable item.
Acceptance criteria:
- Given Petpooja's current API doesn't support order edits (verify in Phase 3), the item-unavailable flow uses cancel-and-repush or a staff note instead, documented in `docs/integrations/petpooja.md`.
Tests: integration
Brief refs: §10, §16 "Item unavailable after payment"
Reuse: none — net-new

### POS-05 Manual POS adapter
Epic: POS · Phase: 3 · Priority: P0 · Status: todo · Depends on: POS-01
As a restaurant without a POS, I want dashboard buttons to accept/reject/mark food ready.
Acceptance criteria:
- Given a manual-adapter branch, staff actions on the dashboard drive the same order state machine as Petpooja callbacks would.
Tests: integration
Brief refs: §10
Reuse: none — net-new

### POS-06 POS health check and down-switch
Epic: POS · Phase: 7 · Priority: P1 · Status: todo · Depends on: POS-02, POS-05
As a restaurant owner, I want orders to keep flowing even if Petpooja is down.
Acceptance criteria:
- Given Petpooja's `healthCheck` fails repeatedly, the branch switches to manual-adapter behaviour and both restaurant and platform are alerted.
Tests: integration (simulated outage)
Brief refs: §16 "POS down"
Reuse: none — net-new

---

## AGT — Restaurant agent, prompt builder, tools, guardrails, logging, language handling

### AGT-01 Claude tool-use agent scaffold
Epic: AGT · Phase: 4 · Priority: P0 · Status: todo · Depends on: —
As a developer, I want a real tool-calling agent (not text markers) so the model can't silently set a price or status.
Acceptance criteria:
- Given a tool call, the model receives a structured result and must use it verbatim for any price/availability claim.
- Given the agent runs for an existing Alphabot bot's old marker-based flow, it's unaffected (that pipeline isn't touched; those bots were removed).
Tests: unit (tool dispatch), conversation tests
Brief refs: §4 issue 2, §9
Reuse: extends `lib/anthropic.ts`/`lib/llm-router.ts`; new tool-use execution path

### AGT-02 Restaurant tool set
Epic: AGT · Phase: 4-9 · Priority: P0 · Status: todo · Depends on: AGT-01
As the restaurant agent, I need the full tool set from brief §9 to handle discovery, ordering, and booking.
Acceptance criteria:
- Given the tool registry, all of `get_restaurant_info` through `set_marketing_consent` (brief §9's list) are registered and permission-scoped per tenant.
Tests: unit (per tool), integration (tenant scoping)
Brief refs: §9
Reuse: extends `lib/tool-registry.ts`

### AGT-03 System prompt builder
Epic: AGT · Phase: 4 · Priority: P0 · Status: todo · Depends on: AGT-01, CFG-02
As a restaurant owner, I want the bot's tone and policies to reflect my brand, not a generic default.
Acceptance criteria:
- Given a tenant+branch, the system prompt includes brand voice, hours, branches, policies, offers summary, and guardrails — the full menu is never dumped into the prompt.
Tests: unit (prompt assembly)
Brief refs: §9
Reuse: none — net-new

### AGT-04 Guardrails: no invented prices/items, injection defence
Epic: AGT · Phase: 4 · Priority: P0 · Status: todo · Depends on: AGT-02
As a customer, I want to trust that the bot never makes up a price or item.
Acceptance criteria:
- Given a prompt-injection attempt in customer text, the agent treats it as data, not instructions, and doesn't deviate from tool-verified facts.
- Given any question involving allergens or health safety, the agent never answers from its own knowledge or an approved KB entry — it always escalates per CONV-06, with no exceptions.
Tests: conversation tests (injection transcripts, allergy-question escalation)
Brief refs: §9, §19 — allergy rule made explicit per Restaurant OS Flow Map "Questions and handoff" flow
Reuse: none — net-new

### AGT-05 Language handling
Epic: AGT · Phase: 4 · Priority: P1 · Status: todo · Depends on: AGT-01
As a customer, I want to message in Telugu/Hindi/mixed and be understood.
Acceptance criteria:
- Given a confident language detection, the agent replies in that language; given low confidence, it replies in English.
Tests: conversation tests (mixed-language transcripts)
Brief refs: §9
Reuse: none — net-new (templates stay English-only for MVP per brief)

### AGT-06 AI call logging and cost tracking
Epic: AGT · Phase: 4 · Priority: P0 · Status: todo · Depends on: AGT-01
As a platform operator, I want per-tenant AI cost visibility so a runaway conversation doesn't surprise anyone.
Acceptance criteria:
- Given any agent call, `ai_calls` records tokens/cost/latency/tools-used; the platform console surfaces monthly cost per tenant.
Tests: unit (logging), integration (console display)
Brief refs: §9, §13
Reuse: extends `lib/llm-cost.ts`

### AGT-07 WhatsApp copy file
Epic: AGT · Phase: 4 · Priority: P0 · Status: todo · Depends on: AGT-03
As a restaurant owner, I want every bot message drafted once in a tenant-overridable file rather than hardcoded per flow.
Acceptance criteria:
- Given `docs/copy/whatsapp.md`, every message in brief §15.3's list has a drafted default, and the system prompt builder (AGT-03) can substitute a tenant override where one exists.
Tests: unit (override substitution)
Brief refs: §15.2, §15.3
Reuse: none — net-new (added during Phase 0 traceability check, `docs/TRACEABILITY.md`)

---

## CONV — Greeting, knowledge, branch finder, location request, address capture, voice notes

### CONV-01 Greeting and main menu
Epic: CONV · Phase: 4 · Priority: P0 · Status: todo · Depends on: AGT-01
As a first-time customer, I want a clear entry point into ordering, booking, or asking questions.
Acceptance criteria:
- Given a first message, the bot greets with an interactive list (Order food / Book a table / Menu & prices / Branches & timings / Talk to us) and a one-line privacy notice.
Tests: conversation test
Brief refs: §8.1
Reuse: `services/whatsapp/gateway.ts` interactive list support

### CONV-02 Knowledge answers from KB + structured data
Epic: CONV · Phase: 4 · Priority: P0 · Status: todo · Depends on: AGT-02
As a customer, I want accurate answers about hours/menu/policies, never invented ones.
Acceptance criteria:
- Given a question the KB/structured data can't answer confidently, the bot offers human handoff instead of guessing.
Tests: conversation tests
Brief refs: §8.2
Reuse: `services/kb/*`

### CONV-03 Branch finder by location
Epic: CONV · Phase: 4 · Priority: P0 · Status: todo · Depends on: SRV-01
As a customer, I want the bot to find my nearest branch from a shared pin or typed address.
Acceptance criteria:
- Given a shared WhatsApp location, the nearest serviceable branch is identified and confirmed.
- Given a typed address instead, geocoding resolves it with a confirmation step.
Tests: unit (nearest-branch calc), conversation test
Brief refs: §8.3
Reuse: extracted nearest-branch logic from the old webhook multi-routing branch (per `docs/REUSE_MAP.md`)

### CONV-04 Delivery address capture
Epic: CONV · Phase: 4 · Priority: P0 · Status: todo · Depends on: CONV-03
As a customer ordering delivery, I want to save my address with a landmark so the rider can find me.
Acceptance criteria:
- Given a pin + flat/house number + landmark, it's saved to `customer_addresses` and offered again on the next order.
Tests: conversation test
Brief refs: §8.3
Reuse: none — net-new

### CONV-05 Voice note transcription
Epic: CONV · Phase: 4 · Priority: P1 · Status: todo · Depends on: AGT-01
As a customer, I want to send a voice note and have the bot understand my order.
Acceptance criteria:
- Given a voice note, it's transcribed via Sarvam before the agent acts on it, and the bot reads back its understanding before proceeding with an order.
- Given transcription fails, the bot asks the customer to type instead.
Tests: integration (mock Sarvam success/failure)
Brief refs: §8.5, §10, §16 "Voice note"
Reuse: `services/voice/providers/stt/sarvam.ts` (STT-only, outbound calling removed per `docs/AUDIT.md`)

### CONV-06 Human handoff triggers
Epic: CONV · Phase: 4 · Priority: P0 · Status: todo · Depends on: HND-01
As a customer, I want a real person when the bot can't help.
Acceptance criteria:
- Given "talk to human", angry sentiment, refund/complaint keywords, an allergy or health-safety question, or two failed understanding attempts, the conversation escalates to the inbox with the recent chat attached — the bot never guesses on an allergen question.
- Given a staff reply doesn't arrive within the tenant's configured window (default 5 minutes), a second alert fires and the customer gets a short holding message.
Tests: conversation tests (each trigger), timer-driven (no-reply escalation)
Brief refs: §8.12, §16 "Human takeover" — allergy trigger and no-reply escalation added per Restaurant OS Flow Map "Questions and handoff" flow
Reuse: `services/escalation/index.ts`, `services/sentiment/detector.ts` — re-point call sites per `docs/AUDIT.md` §4 (previously wired to lead-scoring/outbound-calling, now to handoff)

---

## SRV — Serviceability (radius, partner coverage, hours)

### SRV-01 Radius + hours serviceability check
Epic: SRV · Phase: 4 · Priority: P0 · Status: todo · Depends on: BR-02
As a customer, I want to know immediately if a branch can deliver to me, before building a cart.
Acceptance criteria:
- Given an address outside `delivery_radius_m`, outside hours, or with ordering paused, the bot explains clearly and offers takeaway/another branch/booking.
Tests: unit (radius calc via `@turf/distance`), conversation test
Brief refs: §2 D10, §8.3
Reuse: `@turf/distance` (brief §0A.2)

### SRV-02 Delivery partner coverage check
Epic: SRV · Phase: 8 · Priority: P0 · Status: todo · Depends on: SRV-01, DLV-02
As a customer, I want serviceability to also reflect whether a delivery partner actually covers my area.
Acceptance criteria:
- Given a branch within radius but outside the configured delivery partner's coverage polygon, serviceability returns false with a clear reason.
Tests: unit (`@turf/boolean-point-in-polygon`)
Brief refs: §8.3, §10
Reuse: `@turf/boolean-point-in-polygon`

### SRV-03 Re-check at payment time
Epic: SRV · Phase: 6 · Priority: P0 · Status: todo · Depends on: SRV-01, PRC-03
As the platform, I want serviceability re-verified right before payment, since conditions can change mid-conversation.
Acceptance criteria:
- Given serviceability was true 10 minutes ago but the branch just closed or paused, checkout re-checks and blocks payment-link creation with an explanation.
Tests: integration
Brief refs: §2 D10
Reuse: SRV-01/SRV-02 checks, called again at checkout

### SRV-04 Serviceability unit test suite
Epic: SRV · Phase: 4 · Priority: P0 · Status: todo · Depends on: SRV-01, SRV-02
As a developer, I want confidence the serviceability logic is correct across edge cases (boundary radius, overlapping branches, midnight hours).
Acceptance criteria:
- Given boundary and overlap cases, unit tests assert the expected serviceable/not-serviceable result.
Tests: unit suite
Brief refs: §19
Reuse: n/a

### SRV-05 Geocoding adapter
Epic: SRV · Phase: 4 · Priority: P0 · Status: todo · Depends on: —
As the platform, I want a single geocoding interface so address capture and serviceability don't each call Google Maps differently.
Acceptance criteria:
- Given a typed address, forward geocoding returns lat/lng with a confidence signal; given a Google Maps link pasted by a customer, it's parsed to lat/lng; results are cached.
Tests: unit (parsing), integration (mocked Google API)
Brief refs: §5, §10
Reuse: none — net-new, Google Maps Geocoding/Places behind an adapter interface (added during Phase 0 traceability check, `docs/TRACEABILITY.md`)

---

## CART — Server-side cart shared by chat and web

### CART-01 Server-side cart model
Epic: CART · Phase: 5 · Priority: P0 · Status: todo · Depends on: MENU-01
As a customer, I want my cart to be the same whether I'm in chat or on the web page.
Acceptance criteria:
- Given an item added in chat, it appears in the web ordering page's cart for the same conversation/session, and vice versa.
- Given a tenant/contact/branch combination, only one active cart exists at a time.
Tests: integration (cross-surface sync)
Brief refs: §6 `carts`/`cart_items`, §8.4
Reuse: none — net-new

### CART-02 Cart mutation tools
Epic: CART · Phase: 5 · Priority: P0 · Status: todo · Depends on: CART-01, AGT-02
As the restaurant agent, I need `add_to_cart`/`update_cart_item`/`remove_from_cart`/`get_cart` tools backed by validated server logic.
Acceptance criteria:
- Given an add-on group's min/max rule is violated, the tool call is rejected with a specific error the agent can relay.
Tests: unit
Brief refs: §9
Reuse: none — net-new

### CART-03 Cart summary and confirmation UX
Epic: CART · Phase: 5 · Priority: P0 · Status: todo · Depends on: CART-02
As a customer, I want to see and confirm my full order before paying.
Acceptance criteria:
- Given a cart, the bot always reads back the full order and bill before creating a payment link (brief §8.5).
Tests: conversation test
Brief refs: §8.5
Reuse: none — net-new

### CART-04 Quantity parsing
Epic: CART · Phase: 5 · Priority: P1 · Status: todo · Depends on: CART-02
As a customer, I want "2 biryani", "biryani x2", "two biryani" to all work the same way.
Acceptance criteria:
- Given each phrasing variant (incl. from voice transcription), the parsed quantity matches intent.
Tests: unit (parser test table covering all documented formats)
Brief refs: §8.5, §19
Reuse: none — net-new

---

## PRC — Bill calculator, taxes, packing, delivery fee rules, offers engine, price lock

### PRC-01 Server-side bill calculator
Epic: PRC · Phase: 5 · Priority: P0 · Status: todo · Depends on: CART-01, MENU-01
As the platform, I want totals always computed server-side in paise so no client can tamper with a price.
Acceptance criteria:
- Given a cart, the bill is computed from current menu prices + tax_rate_bp + packing charges + delivery fee − discount, entirely server-side, in integer paise.
- Given a client-supplied total, it's ignored.
Tests: unit (calculator, all fee/tax combinations)
Brief refs: §2 D13, §4 issue 3, §6
Reuse: none — net-new, replaces `routes/orders/index.ts`'s client-trusted total

### PRC-02 Offers engine
Epic: PRC · Phase: 5 · Priority: P0 · Status: todo · Depends on: PRC-01
As a restaurant owner, I want to create coupons (percent/flat/free-delivery) with usage limits.
Acceptance criteria:
- Given a coupon at its usage limit, applying it again is rejected atomically (no race-condition double-redeem).
- Given one-offer-per-order default, a second offer is rejected unless the tenant enables stacking.
Tests: unit, concurrency test (atomic usage limit)
Brief refs: §6 `offers`, §8.11, §11
Reuse: none — net-new

### PRC-03 Delivery fee rules and quotes
Epic: PRC · Phase: 8 · Priority: P0 · Status: todo · Depends on: PRC-01, DLV-01
As a restaurant owner, I want to choose pass-through / markup / free-above-₹X delivery pricing.
Acceptance criteria:
- Given a delivery quote from the partner adapter, the final customer-facing fee reflects the tenant's chosen rule.
Tests: unit
Brief refs: §11
Reuse: none — net-new

### PRC-04 Price lock (quotes)
Epic: PRC · Phase: 5 · Priority: P0 · Status: todo · Depends on: PRC-01, PRC-03
As the platform, I want a cart+pricing snapshot with an expiry so a stale price can never be paid.
Acceptance criteria:
- Given a quote older than its `expires_at`, checkout re-quotes before creating a payment link.
Tests: unit, integration (expired quote path)
Brief refs: §6 `quotes`, §8.4
Reuse: none — net-new

### PRC-05 Minimum/maximum order value guard
Epic: PRC · Phase: 5 · Priority: P1 · Status: todo · Depends on: PRC-01, CFG-02
As a restaurant owner, I want to set delivery/takeaway minimums and a sanity-check maximum.
Acceptance criteria:
- Given an order below the configured minimum, checkout is blocked with a friendly message stating the minimum.
Tests: unit
Brief refs: §8.11
Reuse: CFG-02 resolver

### PRC-06 Pricing unit test suite
Epic: PRC · Phase: 5 · Priority: P0 · Status: todo · Depends on: PRC-01, PRC-02, PRC-03
As a developer, I want full coverage of the bill calculator's edge cases before it ever touches real money.
Acceptance criteria:
- Given every combination of tax/packing/delivery/offer/stacking, unit tests assert the exact paise total.
Tests: unit suite
Brief refs: §19
Reuse: n/a

---

## WEB — Ordering page, signed links, checkout, return pages, tracking page, performance

### WEB-01 Signed ordering link
Epic: WEB · Phase: 5 · Priority: P0 · Status: todo · Depends on: CART-01
As a customer, I want a one-tap "View menu & order" link that already knows who I am.
Acceptance criteria:
- Given the CTA URL button, the token (per ADR 0003) carries tenant/branch/contact/conversation/fulfilment-type and expires per `docs/PLAN.md`'s open-question default.
Tests: unit (token issue/verify), integration (expiry)
Brief refs: §8.4, ADR 0003
Reuse: `jose` (brief §0A.2)

### WEB-02 Ordering page — browse and cart
Epic: WEB · Phase: 5 · Priority: P0 · Status: todo · Depends on: WEB-01, CART-02, MENU-02
As a customer, I want to browse the menu, add items with variants/add-ons, and see a live cart — mobile-first.
Acceptance criteria:
- Given an out-of-stock item, it's shown greyed with "Unavailable now".
- Given veg/non-veg markers, they use shape + colour (not colour alone), per accessibility rule.
Tests: E2E (Playwright: browse → add → cart)
Brief refs: §8.4, §15.1
Reuse: none — net-new (restaurant-branded, "Powered by KOT.ai" footer)

### WEB-03 Checkout and bill breakdown
Epic: WEB · Phase: 5 · Priority: P0 · Status: todo · Depends on: WEB-02, PRC-04
As a customer, I want to see the full bill breakdown and cancellation policy before paying.
Acceptance criteria:
- Given "Pay ₹X", the server re-validates stock/hours/serviceability and re-quotes delivery if the quote expired, before creating the payment link.
Tests: E2E
Brief refs: §8.4
Reuse: none — net-new

### WEB-04 Payment return pages
Epic: WEB · Phase: 6 · Priority: P0 · Status: todo · Depends on: WEB-03, PAY-02
As a customer, I want clear success/failure/pending states after paying, with a path back to WhatsApp.
Acceptance criteria:
- Given each payment outcome, the return page renders the matching state and a "Back to WhatsApp" deep link; WhatsApp also receives confirmation independently.
Tests: E2E (mock payment outcomes)
Brief refs: §8.4, §8.7
Reuse: existing `payment/status/[paymentId]` page pattern, adapted

### WEB-05 Order tracking page
Epic: WEB · Phase: 7 · Priority: P0 · Status: todo · Depends on: ORD-02
As a customer, I want a live tracking page with the order timeline and rider details.
Acceptance criteria:
- Given a signed tracking key (ADR 0003), the page shows the order timeline and a help button, with no login required.
Tests: E2E
Brief refs: §8.8
Reuse: none — net-new, Supabase Realtime for live updates (brief §0A.2)

### WEB-06 Ordering page performance
Epic: WEB · Phase: 13 · Priority: P1 · Status: todo · Depends on: WEB-02
As a customer on 4G, I want the ordering page to load fast.
Acceptance criteria:
- Given a Lighthouse run on the ordering page, first contentful paint is under 2s on a throttled 4G profile; menu is cached, images lazy-loaded and resized.
Tests: Lighthouse CI
Brief refs: §8.4
Reuse: none — net-new

---

## ORD — Order service, state machine, order refs, notifications

### ORD-01 Order state machine
Epic: ORD · Phase: 5 · Priority: P0 · Status: todo · Depends on: PRC-01
As the platform, I want order transitions validated, audited, and idempotent.
Acceptance criteria:
- Given every transition in brief §7's delivery/takeaway state machines, an explicit typed transition table rejects invalid transitions and emits a domain event on valid ones.
Tests: unit (every transition, valid and invalid)
Brief refs: §7, §19
Reuse: `xstate` or a typed transition table — decided in an ADR during Phase 5 implementation

### ORD-02 Order creation at checkout
Epic: ORD · Phase: 5 · Priority: P0 · Status: todo · Depends on: ORD-01, PRC-04
As the platform, I want an order row created only when payment is actually confirmed — never earlier — so the kitchen and dashboard never see an order that was never paid.
Acceptance criteria:
- Given a payment link is generated, no `orders` row exists yet — the cart/checkout lives as a chat-only draft (new `checkout_drafts`-style tracking, not yet in `docs/DATA_MODEL.md`) until the payment webhook confirms success.
- Given payment confirms, the order row is created exactly once from the draft, with the bill/address snapshot immutable even if the menu or the customer's saved address later changes.
- Given the payment link expires unpaid (PAY-02) or the customer never pays, the draft closes with reason `unpaid` and counts toward DSH-01's "left before paying" figure — no `orders` row is ever created for it.
Tests: integration (paid vs. unpaid-expired paths), unit (immutable snapshot)
Brief refs: §6, §7 — **revised** against Restaurant OS Flow Map "Order and pay" flow: the original wording created the order row at link-generation time; the flow map requires the order to not exist at all pre-payment
Reuse: extends `routes/orders/index.ts`

### ORD-03 Gap-free order references
Epic: ORD · Phase: 5 · Priority: P0 · Status: todo · Depends on: ORD-02
As a restaurant owner, I want human-readable order refs like `KOT-HYD1-000123` that are concurrency-safe.
Acceptance criteria:
- Given concurrent checkouts on the same branch, no two orders ever receive the same ref, and no ref is skipped.
Tests: concurrency test (parallel checkouts)
Brief refs: §6 `order_ref_sequences`
Reuse: none — net-new

### ORD-04 Order status notifications
Epic: ORD · Phase: 7 · Priority: P0 · Status: todo · Depends on: ORD-01
As a customer, I want a WhatsApp message at every major status change, always including the order ref.
Acceptance criteria:
- Given a transition to accepted/preparing/food_ready/rider_assigned/picked_up/delivered, a WhatsApp message fires per `docs/copy/whatsapp.md`'s template for that state.
Tests: integration
Brief refs: §8.8, §15.2
Reuse: `services/whatsapp/gateway.ts`

### ORD-05 Order history and filters (dashboard)
Epic: ORD · Phase: 10 · Priority: P0 · Status: todo · Depends on: ORD-01
As a restaurant staff member, I want to search/filter past orders.
Acceptance criteria:
- Given filters (date, branch, status, source, payment) and a search by order ref/phone, results match and CSV export works.
Tests: E2E
Brief refs: §12 "Order history"
Reuse: existing orders dashboard route pattern

### ORD-06 Live orders kanban
Epic: ORD · Phase: 10 · Priority: P0 · Status: todo · Depends on: ORD-01, BRD-04
As a restaurant staff member, I want a real-time kanban of active orders by status.
Acceptance criteria:
- Given a new order, it appears with a sound + browser notification already in `preparing` (auto-accepted per FUL-02 — there is no manual Accept/Reject step); "Problem" (FUL-03) and "Food Ready" actions drive the remaining state transitions.
Tests: E2E
Brief refs: §12 "Live orders" — **revised** per FUL-02's auto-accept model
Reuse: Supabase Realtime, BRD-04's TicketCard

### ORD-07 Post-delivery feedback capture
Epic: ORD · Phase: 7 · Priority: P2 · Status: todo · Depends on: ORD-04
As a restaurant owner, I want a quick 1–5 rating + optional comment after delivery/collection so I can track satisfaction.
Acceptance criteria:
- Given an order reaches `delivered`/`collected`, a feedback prompt (1–5 tappable buttons, not open text) is sent once; a response is stored in `order_feedback`.
- Given a 1 or 2 star rating, an OWN-01 owner alert fires immediately with the order and a "Call customer" action — a low rating is never just a silent data point.
Tests: integration
Brief refs: §6 `order_feedback`, §8.8 — rating mechanism and low-rating alert per Restaurant OS Flow Map "Prepare and hand over" flow
Reuse: none — net-new (added during Phase 0 traceability check, `docs/TRACEABILITY.md`)

---

## PAY — Easebuzz adapter, links, webhooks, reconciliation, late payments, refunds

### PAY-01 PaymentAdapter interface + Easebuzz per-tenant
Epic: PAY · Phase: 6 · Priority: P0 · Status: todo · Depends on: SEC-02
As a restaurant owner, I want my own Easebuzz merchant account used for my customers' payments.
Acceptance criteria:
- Given a tenant's encrypted credentials, payment links are created against that tenant's Easebuzz account, not a shared platform account.
Tests: integration (per-tenant credential resolution)
Brief refs: §2 D1/D2, §4 issue 4
Reuse: extends `services/payment/easebuzz.ts`

### PAY-02 Payment link creation with order ref
Epic: PAY · Phase: 6 · Priority: P0 · Status: todo · Depends on: PAY-01, ORD-03
As a customer, I want a payment link that clearly states my order ref, total, and expiry.
Acceptance criteria:
- Given a payment link, `udf` fields carry the order ref; the WhatsApp message states total and expiry.
- Given the tenant's configured expiry (default 30 minutes), one reminder is sent once at the configured offset before expiry (default 10 minutes before); past expiry the draft closes per ORD-02 — no second reminder is sent.
Tests: integration
Brief refs: §8.7, §10 — timer defaults per Restaurant OS Flow Map "Order and pay" flow
Reuse: `services/payment/easebuzz.ts`

### PAY-03 Server-to-server webhook with amount verification
Epic: PAY · Phase: 6 · Priority: P0 · Status: todo · Depends on: PAY-02
As the platform, I want payment confirmation from a verified server callback, not a browser redirect.
Acceptance criteria:
- Given a webhook whose amount doesn't match the order's expected total, it's rejected and flagged, not silently accepted.
Tests: integration (mismatch case)
Brief refs: §4 issue 5
Reuse: `services/payment/easebuzz.ts`'s existing hash verification, extended

### PAY-04 Idempotent webhook processing
Epic: PAY · Phase: 6 · Priority: P0 · Status: todo · Depends on: PAY-03, QUE-02
As the platform, I want a duplicate payment webhook to never double-charge logic or double-notify.
Acceptance criteria:
- Given the same txnid delivered twice, the second delivery is a no-op; unique constraint on (provider, txnid) enforces this at the DB level.
Tests: integration (duplicate delivery)
Brief refs: §4 issue 5, §6 `payments`
Reuse: QUE-02's idempotency pattern

### PAY-05 Reconciliation poll job
Epic: PAY · Phase: 6 · Priority: P0 · Status: todo · Depends on: PAY-03
As the platform, I want pending payments reconciled even if a webhook is missed.
Acceptance criteria:
- Given a payment pending beyond a threshold, a scheduled job polls Easebuzz's transaction status API and updates state accordingly.
Tests: integration (mock poll)
Brief refs: §10
Reuse: `jobs/scheduler.ts`

### PAY-06 Late payment / expired order auto-refund
Epic: PAY · Phase: 6 · Priority: P0 · Status: todo · Depends on: PAY-04
As a customer, I want an automatic refund if my payment succeeds after the link expired or the order was already cancelled.
Acceptance criteria:
- Given a late success event on a cancelled/expired order, a refund is auto-initiated and the customer is informed; the dashboard is alerted.
Tests: integration
Brief refs: §16 "Payment success after link expiry"
Reuse: none — net-new

### PAY-07 Full and partial refunds
Epic: PAY · Phase: 6 · Priority: P0 · Status: todo · Depends on: PAY-01, SEC-05
As a restaurant owner/manager, I want to issue full or partial refunds with a reason, tracked to completion.
Acceptance criteria:
- Given a refund request, it's tracked through `requested → processing → success|failed`, retried on failure, and alerted if it ultimately fails.
Tests: integration (success and failure paths)
Brief refs: §7 Refund state machine
Reuse: none — net-new

---

## FUL — Push to POS, acceptance timeout, reject, item-unavailable flow, KOT print

### FUL-01 Push paid order to POS
Epic: FUL · Phase: 7 · Priority: P0 · Status: todo · Depends on: POS-02, POS-05, PAY-04
As a restaurant owner, I want a paid order to reach my kitchen (POS or manual queue) immediately.
Acceptance criteria:
- Given a successful payment, the order is pushed via the tenant's configured adapter within seconds.
Tests: integration
Brief refs: §2 D4, §7
Reuse: POS-01 adapter interface

### FUL-02 Automatic order acceptance
Epic: FUL · Phase: 7 · Priority: P0 · Status: todo · Depends on: FUL-01
As a customer, I want my paid order accepted automatically — I shouldn't have to wait on the restaurant to tap Accept.
Acceptance criteria:
- Given an order reaches `new` (payment confirmed), it transitions to `preparing` automatically after a configured delay (default 10 seconds) — no staff action required to accept it.
- Given the order is not marked Food Ready within the tenant's configured alert time after auto-accepting (default 25 minutes), an OWN-01 owner alert fires — this is an operational "stuck order" alert, not a refund trigger.
Tests: integration (timer-driven auto-accept), integration (stuck-order alert)
Brief refs: §11, §16 — **revised**: Restaurant OS Flow Map "Prepare and hand over" flow removes the manual-accept/auto-refund-on-no-response model this story originally described (every paid order is accepted; there is no "restaurant never responds" case any more)
Reuse: `jobs/scheduler.ts`

### FUL-03 Item-unavailable "Problem" flow — swap or refund
Epic: FUL · Phase: 7 · Priority: P0 · Status: todo · Depends on: FUL-01, PAY-07, WAB-06
As a restaurant staff member, I want to flag that a paid item can't be made, and let the owner choose to offer a swap (with the customer's OK) or refund it — not reject the whole order.
Acceptance criteria:
- Given kitchen taps "Problem" on the ticket (via the kitchen WhatsApp number, WAB-06, or the dashboard), the owner is alerted via OWN-01 with the order and item, and chooses "Offer a swap" or "Refund order".
- Given "Offer a swap", the bot proposes a substitute to the customer and only proceeds on their explicit OK; given "Refund order", PAY-07's refund flow runs and the customer is informed; the rider (if any) is never booked until resolved.
Tests: integration (both resolution paths)
Brief refs: §16 "Restaurant rejects a paid order" / "Item unavailable after payment" — **revised**: replaces the original whole-order "rejection with mandatory reason" design per Restaurant OS Flow Map "Prepare and hand over" flow; see FUL-04
Reuse: PAY-07 (refund)

### FUL-04 Item-unavailable flow
Epic: FUL · Phase: 7 · Priority: P0 · Status: **consolidated into FUL-03** · Depends on: FUL-03
**Consolidated into FUL-03.** The Restaurant OS Flow Map models "item unavailable after payment" as one single kitchen-"Problem" → owner-decides (swap or refund) flow, not a separate customer-facing replace/remove/cancel menu with its own timeout default. Kept as a story ID for traceability; implement under FUL-03.
Brief refs: §16 "Item unavailable after payment"

### FUL-05 KOT print view
Epic: FUL · Phase: 10 · Priority: P2 · Status: todo · Depends on: FUL-01
As a restaurant staff member, I want a printable kitchen order ticket for an order.
Acceptance criteria:
- Given an order detail view, a "print KOT" action renders a thermal-printer-friendly layout.
Tests: visual check
Brief refs: §12 "Live orders"
Reuse: BRD-04 TicketCard styling

---

## DLV — Delivery adapters, quotes, booking at food ready, fallback, tracking, fee log

### DLV-01 DeliveryAdapter interface
Epic: DLV · Phase: 8 · Priority: P0 · Status: todo · Depends on: —
As a developer, I want one interface so Shadowfax/Borzo/Porter/manual are interchangeable.
Acceptance criteria:
- Given the interface (`checkServiceability`, `getQuote`, `createTask`, `cancelTask`, `getStatus`, `onWebhook`), all four adapters implement it.
Tests: unit (conformance)
Brief refs: §10
Reuse: none — net-new

### DLV-02 First delivery partner adapter
Epic: DLV · Phase: 8 · Priority: P0 · Status: todo · Depends on: DLV-01
As a restaurant owner, I want my delivery partner's API wired up for quotes and booking.
Acceptance criteria:
- Given a quote request, the adapter returns a real (or sandbox) quote within a documented timeout.
Tests: integration (sandbox), doc recorded in `docs/integrations/<partner>.md`
Brief refs: §10; partner TBD per `docs/PLAN.md` open question #3
Reuse: none — net-new, verify current API docs before implementing (brief §0 rule)

### DLV-03 Manual delivery adapter
Epic: DLV · Phase: 8 · Priority: P0 · Status: todo · Depends on: DLV-01
As a restaurant without an integrated delivery partner, I want a dashboard-driven manual delivery flow.
Acceptance criteria:
- Given a manual-adapter branch, staff manually record rider assignment/pickup/delivery, driving the same delivery_tasks state machine.
Tests: integration
Brief refs: §10
Reuse: none — net-new

### DLV-04 Booking at Food Ready
Epic: DLV · Phase: 8 · Priority: P0 · Status: todo · Depends on: DLV-02, POS-03
As the platform, I want a rider requested only when food is actually ready, never at payment time.
Acceptance criteria:
- Given a Food Ready event (POS callback or manual button), `createTask` is called; given payment success alone, it is not.
Tests: integration
Brief refs: §2 D4
Reuse: none — net-new

### DLV-05 Partner fallback and manual escalation
Epic: DLV · Phase: 8 · Priority: P0 · Status: todo · Depends on: DLV-02, DLV-03
As a restaurant owner, I want a backup plan when no rider is found.
Acceptance criteria:
- Given no rider assigned within the configured search timeout, the next partner by priority is tried; given all partners fail, the restaurant is alerted to deliver manually or cancel with refund.
Tests: integration (simulated no-rider scenario)
Brief refs: §11, §16 "No rider available"
Reuse: none — net-new

### DLV-06 Delivery status sync and fee log
Epic: DLV · Phase: 8 · Priority: P0 · Status: todo · Depends on: DLV-02
As a restaurant owner, I want to see quoted vs. actual delivery fee per order.
Acceptance criteria:
- Given a delivery completes, `delivery_tasks.quote_paise` and `actual_fee_paise` are both recorded and visible in the dashboard's delivery log.
Tests: integration
Brief refs: §6 `delivery_tasks`, §12 "Delivery"
Reuse: none — net-new

---

## BKG — Table booking, availability, modes, reminders, reschedule, seated/no-show

### BKG-01 Booking data model and capacity
Epic: BKG · Phase: 9 · Priority: P0 · Status: todo · Depends on: BR-01
As a restaurant owner, I want booking slots with capacity that can never be double-booked.
Acceptance criteria:
- Given concurrent booking requests for the last available slot, exactly one succeeds (transaction or exclusion constraint).
- Given a slot is fully booked, the customer is offered the nearest alternative times or a waitlist join; a cancellation frees seats and offers them to the next waitlisted customer in order.
Tests: concurrency test, integration (waitlist offer on cancellation)
Brief refs: §6 `bookings`/`booking_slots`, §6 integrity rules — waitlist behaviour added per Restaurant OS Flow Map "Table booking" flow
Reuse: none — net-new

### BKG-02 Booking conversation flow
Epic: BKG · Phase: 9 · Priority: P0 · Status: todo · Depends on: BKG-01, AGT-02
As a customer, I want to book a table via WhatsApp with branch, date, time, party size, occasion, and special requests.
Acceptance criteria:
- Given available slots, the bot shows them as buttons; confirmation includes branch address/map link and cancel/reschedule buttons.
Tests: conversation test
Brief refs: §8.9
Reuse: none — net-new

### BKG-03 Auto-confirm vs staff-confirm modes
Epic: BKG · Phase: 9 · Priority: P0 · Status: todo · Depends on: BKG-01, CFG-02
As a restaurant owner, I want to choose whether bookings auto-confirm against capacity or need staff approval.
Acceptance criteria:
- Given staff-confirm mode, a new booking is `requested` until a staff action confirms or declines it.
- Given a party size over the tenant's configured threshold (default 8 guests), the booking always requires host approval before confirming, even in auto-confirm mode.
Tests: integration (both modes, large-party override)
Brief refs: §2 D8, §11 — large-party override added per Restaurant OS Flow Map "Table booking" flow
Reuse: CFG-02 resolver

### BKG-04 Booking reminders
Epic: BKG · Phase: 9 · Priority: P0 · Status: todo · Depends on: BKG-02
As a customer, I want a reminder before my reservation.
Acceptance criteria:
- Given the tenant's configured reminder offset (default 3h, per Restaurant OS Flow Map — was 2h), a reminder fires at that offset before `booking_at`, asking the customer to confirm or cancel.
- Given the customer hasn't messaged in the last 24 hours (the usual case for a reminder), it's sent as an approved WhatsApp template, not free text.
- Given no reply to the reminder, the booking stays held and staff see a "Call" action next to it — it is not auto-cancelled.
Tests: integration (timer-driven, template-vs-free-text branching)
Brief refs: §8.9, §11
Reuse: `jobs/scheduler.ts`, `services/scheduled-messages/`

### BKG-05 Cancel and reschedule
Epic: BKG · Phase: 9 · Priority: P0 · Status: todo · Depends on: BKG-02
As a customer, I want to cancel or reschedule my booking by button or text.
Acceptance criteria:
- Given a reschedule request, availability is re-checked for the new slot before confirming.
Tests: conversation test
Brief refs: §8.9
Reuse: none — net-new

### BKG-06 Seated / no-show dashboard actions
Epic: BKG · Phase: 10 · Priority: P0 · Status: todo · Depends on: BKG-01
As a restaurant staff member, I want to mark a booking seated or no-show from the dashboard.
Acceptance criteria:
- Given the bookings calendar/day view, staff can confirm/decline (staff mode) and mark seated/no-show, with capacity indicators visible.
- Given a no-show, it's recorded on the customer record (visible on DSH-11's Customers screen), and the released table is offered to the next waitlisted customer (BKG-01).
Tests: E2E
Brief refs: §12 "Bookings" — no-show tracking added per Restaurant OS Flow Map "Table booking" flow
Reuse: none — net-new

### BKG-07 Post-dining feedback capture
Epic: BKG · Phase: 9 · Priority: P2 · Status: todo · Depends on: BKG-06
As a restaurant owner, I want a quick 1–5 rating after a booking is seated, the same way ORD-07 captures it for orders.
Acceptance criteria:
- Given a booking is marked seated and the dining window has passed, a feedback prompt (1–5 tappable buttons) is sent once; a response is stored against the booking and the customer record.
- Given a 1 or 2 star rating, an OWN-01 owner alert fires, same as ORD-07.
Tests: integration
Brief refs: net-new, derived from Restaurant OS Flow Map "Table booking" flow — parity with ORD-07
Reuse: ORD-07's pattern

---

## HND — Human takeover, inbox, auto-resume

### HND-01 Takeover mechanics
Epic: HND · Phase: 12 · Priority: P0 · Status: todo · Depends on: —
As a staff member, I want to take over a conversation and have the bot pause for it.
Acceptance criteria:
- Given a staff "take over" action, the bot stops auto-replying to that conversation until released or an idle timeout passes.
Tests: integration
Brief refs: §16 "Human takeover"
Reuse: `services/escalation/index.ts` (`claimEscalation`/`releaseToBot`, already present)

### HND-02 Inbox with order/booking context
Epic: HND · Phase: 12 · Priority: P0 · Status: todo · Depends on: HND-01, ORD-01, BKG-01
As a staff member, I want to see a customer's linked order/booking right next to the conversation.
Acceptance criteria:
- Given a conversation linked to an order or booking, a side panel shows its current status and quick actions.
Tests: E2E
Brief refs: §12 "Inbox"
Reuse: `components/RecentConversations.tsx`, `conversation-messages.tsx` (extend)

### HND-03 Auto-resume after close or idle
Epic: HND · Phase: 12 · Priority: P1 · Status: todo · Depends on: HND-01
As a staff member, I don't want to have to manually hand every conversation back to the bot.
Acceptance criteria:
- Given a conversation marked resolved, or idle beyond the configured timeout, control returns to the bot automatically.
Tests: integration
Brief refs: §11, §16
Reuse: none — net-new

### HND-04 Quick replies
Epic: HND · Phase: 12 · Priority: P2 · Status: todo · Depends on: HND-02
As a staff member, I want canned responses for common questions during takeover.
Acceptance criteria:
- Given the inbox, a quick-reply picker inserts a tenant-configured message into the reply box.
Tests: E2E
Brief refs: §12 "Inbox"
Reuse: none — net-new

---

## CMP — Complaints and resolutions

### CMP-01 Complaint intake
Epic: CMP · Phase: 12 · Priority: P0 · Status: todo · Depends on: ORD-01
As a customer, I want to report a wrong/missing/quality/late order issue easily.
Acceptance criteria:
- Given a complaint, order ref auto-fills from the customer's last order; category and an optional photo are captured.
Tests: conversation test
Brief refs: §8.12, §16 "Complaint"
Reuse: extends `return_requests` → `complaints` per `docs/DATA_MODEL.md`

### CMP-02 SLA-timed complaint queue
Epic: CMP · Phase: 12 · Priority: P0 · Status: todo · Depends on: CMP-01
As a restaurant staff member, I want complaints visible with an SLA timer so none go stale.
Acceptance criteria:
- Given an open complaint past its SLA, it's visually flagged in the dashboard queue.
Tests: E2E
Brief refs: §12 "Complaints"
Reuse: none — net-new

### CMP-03 Resolution actions
Epic: CMP · Phase: 12 · Priority: P0 · Status: todo · Depends on: CMP-01, PAY-07
As a restaurant staff member, I want to resolve a complaint with refund/coupon/redeliver/none and have the customer informed.
Acceptance criteria:
- Given a resolution action, the customer receives a WhatsApp message stating the outcome.
Tests: integration (each resolution type)
Brief refs: §7 Complaint state machine, §16
Reuse: PAY-07 (refund), PRC-02 (coupon)

### CMP-04 Complaint feedback loop
Epic: CMP · Phase: 12 · Priority: P2 · Status: todo · Depends on: CMP-03
As a restaurant owner, I want to see complaint resolution rates in analytics.
Acceptance criteria:
- Given resolved complaints, the analytics screen shows resolution-type breakdown.
Tests: E2E
Brief refs: §12 "Analytics"
Reuse: ANL epic

---

## CAN — Customer cancellation and policies

### CAN-01 Pre-acceptance free cancellation
Epic: CAN · Phase: 7 · Priority: P0 · Status: todo · Depends on: ORD-01, PAY-07
As a customer, I want to cancel for free before the restaurant accepts.
Acceptance criteria:
- Given a cancellation before `accepted`, a full refund is automatic.
Tests: integration
Brief refs: §16 "Customer cancels"
Reuse: none — net-new

### CAN-02 Post-acceptance cancellation policy
Epic: CAN · Phase: 7 · Priority: P0 · Status: todo · Depends on: CAN-01, CFG-02
As a restaurant owner, I want to set whether post-acceptance cancellation is allowed and at what refund %.
Acceptance criteria:
- Given the tenant's policy, a post-acceptance cancellation request is accepted/rejected and refunded accordingly; the policy is shown to the customer before payment.
Tests: integration
Brief refs: §8.4, §11, §16
Reuse: CFG-02 resolver

### CAN-03 Post-pickup cancellation becomes a complaint
Epic: CAN · Phase: 7 · Priority: P1 · Status: todo · Depends on: CAN-02, CMP-01
As the platform, I want a cancellation attempt after pickup redirected into the complaint flow instead.
Acceptance criteria:
- Given a cancellation request on a `picked_up` order, the customer is routed to CMP-01 instead of a cancellation.
Tests: conversation test
Brief refs: §16 "Customer cancels"
Reuse: CMP-01

---

## MKT — Opt-in, opt-out, consent records, marketing template

### MKT-01 Marketing opt-in capture
Epic: MKT · Phase: 12 · Priority: P0 · Status: todo · Depends on: —
As a customer, I want marketing messages only if I explicitly agreed.
Acceptance criteria:
- Given no explicit opt-in button press, no marketing message is ever sent; order updates are never classified as marketing.
Tests: unit (classification), conversation test
Brief refs: §16 "Marketing"
Reuse: none — net-new, respects existing `lib/suppression.ts` opt-out semantics

### MKT-02 Opt-out / STOP handling
Epic: MKT · Phase: 12 · Priority: P0 · Status: todo · Depends on: MKT-01
As a customer, I want STOP honoured immediately.
Acceptance criteria:
- Given a STOP message, marketing sends to that contact cease immediately and a confirmation is sent once.
Tests: integration
Brief refs: §16 "Marketing"
Reuse: `lib/suppression.ts`

### MKT-03 Consent records
Epic: MKT · Phase: 12 · Priority: P0 · Status: todo · Depends on: MKT-01
As the platform, I want a durable record of when/how consent was granted or withdrawn.
Acceptance criteria:
- Given an opt-in or opt-out event, a `consents` row records purpose, timestamp, channel.
Tests: integration
Brief refs: §6 `consents`, §17 DPDP
Reuse: none — net-new

### MKT-04 Offer announcement template
Epic: MKT · Phase: 12 · Priority: P2 · Status: todo · Depends on: MKT-01, TPL-01
As a restaurant owner, I want to send an approved marketing template to opted-in customers.
Acceptance criteria:
- Given no approved marketing template exists for a tenant, the send is blocked with a clear reason, not silently dropped.
Tests: integration
Brief refs: §15.4
Reuse: TPL-01

---

## PRV — DPDP notice, retention, export/delete, DPA template

### PRV-01 Privacy notice on first contact
Epic: PRV · Phase: 12 · Priority: P0 · Status: todo · Depends on: CONV-01
As a customer, I want to know how my data is used the first time I message.
Acceptance criteria:
- Given a first-time contact, a one-line privacy notice with a link is sent alongside the greeting.
Tests: conversation test
Brief refs: §8.1, §17
Reuse: none — net-new

### PRV-02 Retention periods
Epic: PRV · Phase: 12 · Priority: P1 · Status: todo · Depends on: —
As the platform, I want configurable retention for chats/addresses/payment payloads so data isn't kept indefinitely.
Acceptance criteria:
- Given a configured retention period, a scheduled job purges or anonymizes data past that age.
Tests: integration
Brief refs: §17
Reuse: `jobs/scheduler.ts`

### PRV-03 Data export/delete workflow
Epic: PRV · Phase: 12 · Priority: P0 · Status: todo · Depends on: —
As a customer, I want to request my data exported or deleted.
Acceptance criteria:
- Given a delete request, all customer PII is removed or anonymized within the documented SLA, with an audit trail.
Tests: integration
Brief refs: §12 "Customers", §17
Reuse: none — net-new

### PRV-04 DPA template
Epic: PRV · Phase: 12 · Priority: P2 · Status: todo · Depends on: —
As the platform, I want a data-processing agreement template for restaurants, since they're the data fiduciary and KOT.ai is the processor.
Acceptance criteria:
- Given a new tenant, a DPA template is available in onboarding, flagged for legal review before first use (brief §17 "flag anything needing legal review").
Tests: — (document)
Brief refs: §17
Reuse: none — net-new; legal review required, not an engineering sign-off

---

## WAB — WhatsApp number onboarding, routing, throughput, quality monitoring

### WAB-01 Embedded Signup / Tech Provider onboarding
Epic: WAB · Phase: 11 · Priority: P0 · Status: todo · Depends on: —
As a restaurant owner, I want to connect my own WhatsApp number to KOT.ai without manual Meta support tickets.
Acceptance criteria:
- Given the onboarding wizard, a restaurant completes Embedded Signup (or the current equivalent Tech Provider route — verify against current Meta docs per brief §0) and their number becomes active.
Tests: integration (sandbox/test WABA)
Brief refs: §2 D14, §10
Reuse: `components/dashboard/WhatsAppNumbersManager.tsx`, `components/platform/WhatsAppNumberSection.tsx`

### WAB-02 Routing by phone_number_id
Epic: WAB · Phase: 2 · Priority: P0 · Status: todo · Depends on: WAB-01
As the platform, I want inbound messages routed to the correct tenant/branch/bot by phone_number_id.
Acceptance criteria:
- Given a message on a KOT.ai-onboarded number, it routes to the restaurant agent, not any remaining Alphabot routing path.
Tests: integration
Brief refs: §5, §10
Reuse: `services/routing/router.ts`, `services/bot-context.ts`

### WAB-03 Send throughput management
Epic: WAB · Phase: 11 · Priority: P1 · Status: todo · Depends on: WAB-01
As the platform, I want sends to respect Meta's per-number throughput limits.
Acceptance criteria:
- Given a burst of outbound sends, they're queued/paced to stay under the number's messaging limit.
Tests: integration (simulated burst)
Brief refs: §10
Reuse: QUE-01 infrastructure

### WAB-04 Number quality/limit monitoring
Epic: WAB · Phase: 13 · Priority: P1 · Status: todo · Depends on: WAB-01
As a platform operator, I want to know before a number's quality rating drops enough to cause a block.
Acceptance criteria:
- Given a quality-rating degradation webhook/poll, the dashboard and console show a warning and marketing sends auto-pause.
Tests: integration
Brief refs: §16 "WhatsApp send failures / number quality drop"
Reuse: none — net-new

### WAB-05 Per-tenant number config
Epic: WAB · Phase: 11 · Priority: P0 · Status: todo · Depends on: WAB-01
As a restaurant owner, I want my number's display name, status, and webhook config visible and manageable.
Acceptance criteria:
- Given the dashboard's WhatsApp settings, number status (active/pending/failed) is accurate and actionable.
Tests: E2E
Brief refs: §12 "Settings"
Reuse: `components/dashboard/WhatsAppSetupSection.tsx`

### WAB-06 Multi-role WhatsApp numbers per restaurant
Epic: WAB · Phase: 11 · Priority: P0 · Status: todo · Depends on: WAB-01
As a restaurant owner, I want separate WhatsApp numbers for customers, the kitchen, and ops/owner alerts — not one number doing everything.
Acceptance criteria:
- Given a tenant, up to three `whatsapp_numbers` rows can be assigned distinct roles (`customer`, `kitchen`, `ops`) for the same restaurant bot instance; routing and outbound sends pick the correct number per role.
- Given a tenant with only one number configured, all three roles fall back to it, so the feature is optional, not required.
Tests: integration (role routing, single-number fallback)
Brief refs: net-new, derived from the Restaurant OS Flow Map's three-number architecture (Customer number / Kitchen number / Ops number)
Reuse: extends `whatsapp_numbers`, currently scoped by `product_slug` only per `20250101000043_multi_bot_instances.sql` — needs a new `role` column; feeds FUL-03's kitchen ticket delivery and OWN-01/02/03's ops-number use

---

## TPL — WhatsApp templates per tenant, submission status

### TPL-01 Template submission and status tracking
Epic: TPL · Phase: 11 · Priority: P0 · Status: todo · Depends on: WAB-01
As a restaurant owner, I want to submit utility templates (order_update, payment_reminder, refund_processed, booking_confirmed, booking_reminder, booking_cancelled, complaint_update, restaurant_new_order_alert) and see their approval status.
Acceptance criteria:
- Given a submitted template, its Meta approval status is visible in both the tenant dashboard and platform console.
Tests: integration (mock Meta template API)
Brief refs: §15.4
Reuse: `routes/button-templates/`, `(dashboard)/button-templates` (repurposed per `docs/AUDIT.md` §4 — extended for utility/marketing templates rather than removed)

### TPL-02 Out-of-window fallback behaviour
Epic: TPL · Phase: 12 · Priority: P0 · Status: todo · Depends on: TPL-01
As the platform, I want a graceful fallback when an update is due outside the 24h window and no approved template exists.
Acceptance criteria:
- Given this scenario, the event is logged and shown in the dashboard rather than silently dropped.
Tests: integration
Brief refs: §16 "Customer outside the 24-hour window"
Reuse: none — net-new

### TPL-03 Template category/pricing verification
Epic: TPL · Phase: 11 · Priority: P1 · Status: todo · Depends on: TPL-01
As the platform, I want current Meta template categories and pricing recorded before budgeting.
Acceptance criteria:
- Given current Meta docs (verified per brief §0's rule, not memory), `docs/integrations/meta-whatsapp.md` records the doc version/date used.
Tests: — (documentation)
Brief refs: §15.4
Reuse: none — net-new

---

## LNK — Share links, QR codes, source attribution

### LNK-01 Per-branch share links
Epic: LNK · Phase: 10 · Priority: P1 · Status: todo · Depends on: BR-01
As a restaurant owner, I want ready-made wa.me links with prefilled text for Order/Book/Menu per branch.
Acceptance criteria:
- Given a branch, each purpose generates a correctly prefilled wa.me URL with a source/utm tag.
Tests: unit
Brief refs: §6 `share_links`, §12 "Share links & QR codes"
Reuse: none — net-new

### LNK-02 QR code generation
Epic: LNK · Phase: 10 · Priority: P1 · Status: todo · Depends on: LNK-01
As a restaurant owner, I want downloadable QR codes for table tents and flyers.
Acceptance criteria:
- Given a share link, a QR code image is generated and downloadable.
Tests: unit (QR encodes the correct URL)
Brief refs: §12
Reuse: `qrcode` (brief §0A.2)

### LNK-03 Source attribution in analytics
Epic: LNK · Phase: 13 · Priority: P1 · Status: todo · Depends on: LNK-01, ANL-01
As a restaurant owner, I want to know which link (GBP, Instagram, table QR) brought each order.
Acceptance criteria:
- Given an order sourced from a tagged link, the analytics funnel attributes it to that source.
Tests: integration
Brief refs: §12 "Analytics"
Reuse: ANL-01

---

## TKW — Takeaway flow, ready time, collection, uncollected orders

### TKW-01 Takeaway selection and ready-time estimate
Epic: TKW · Phase: 7 · Priority: P0 · Status: todo · Depends on: ORD-01, BR-02
As a customer, I want to choose takeaway and see an estimated ready time.
Acceptance criteria:
- Given a takeaway order, the estimate reflects prep time plus current kitchen load, and the branch address/map link is shown.
Tests: conversation test
Brief refs: §8.10
Reuse: none — net-new

### TKW-02 Food Ready notification with optional OTP
Epic: TKW · Phase: 7 · Priority: P0 · Status: todo · Depends on: TKW-01, FUL-01
As a customer, I want to know when my takeaway order is ready, and optionally a pickup code.
Acceptance criteria:
- Given the tenant enables pickup OTP, the Food Ready message includes a code; staff verify it before marking collected.
Tests: integration
Brief refs: §8.10, §11
Reuse: none — net-new

### TKW-03 Uncollected order handling
Epic: TKW · Phase: 7 · Priority: P1 · Status: todo · Depends on: TKW-02, CFG-02
As a restaurant staff member, I want uncollected orders to get a reminder and a closing policy, not sit open forever.
Acceptance criteria:
- Given an order uncollected past the configured time, a reminder fires; staff can close it as collected/no-show per tenant policy (no refund by default).
Tests: integration
Brief refs: §8.10, §11
Reuse: `jobs/scheduler.ts`

### TKW-04 Collection confirmation UI
Epic: TKW · Phase: 10 · Priority: P0 · Status: todo · Depends on: TKW-02
As a restaurant staff member, I want to mark an order collected after checking the order ref/OTP.
Acceptance criteria:
- Given the live orders view, a "mark collected" action requires the correct order ref/OTP if enabled.
Tests: E2E
Brief refs: §12 "Live orders"
Reuse: none — net-new

---

## DSH — Tenant dashboard screens (one story per screen minimum)

### DSH-01 Today screen
Epic: DSH · Phase: 10 · Priority: P0 · Status: todo · Depends on: ORD-01, BKG-01
As a restaurant owner, I want an at-a-glance view of today's business and what needs attention.
Acceptance criteria:
- Given today's data, GMV, orders by status, bookings, a needs-attention list (timeouts, rider failures, open complaints, payment failures, POS/partner health), and the total value of checkout drafts abandoned before payment ("left before paying", per ORD-02) are all visible on one screen.
Tests: E2E
Brief refs: §12 "Today"
Reuse: none — net-new

### DSH-02 Live orders screen
Epic: DSH · Phase: 10 · Priority: P0 · Status: todo · Depends on: ORD-06
(See ORD-06 — same screen, cross-referenced here for brief §12 traceability.)
Brief refs: §12 "Live orders"

### DSH-03 Order history screen
Epic: DSH · Phase: 10 · Priority: P0 · Status: todo · Depends on: ORD-05
(See ORD-05.)
Brief refs: §12 "Order history"

### DSH-04 Inbox screen
Epic: DSH · Phase: 10 · Priority: P0 · Status: todo · Depends on: HND-02
(See HND-02.)
Brief refs: §12 "Inbox"

### DSH-05 Bookings screen
Epic: DSH · Phase: 10 · Priority: P0 · Status: todo · Depends on: BKG-06
(See BKG-06.)
Brief refs: §12 "Bookings"

### DSH-06 Menu & stock screen
Epic: DSH · Phase: 10 · Priority: P0 · Status: todo · Depends on: MENU-04
(See MENU-04.)
Brief refs: §12 "Menu & stock"

### DSH-07 Branches & hours screen
Epic: DSH · Phase: 10 · Priority: P0 · Status: todo · Depends on: BR-01, BR-02, BR-03
As a restaurant owner, I want to manage hours, shifts, closures, cut-offs, and delivery radius on a map, all per branch.
Acceptance criteria:
- Given the delivery radius editor, dragging the radius on a map updates `delivery_radius_m` live.
Tests: E2E
Brief refs: §12 "Branches & hours"
Reuse: none — net-new

### DSH-08 Delivery screen
Epic: DSH · Phase: 10 · Priority: P0 · Status: todo · Depends on: DLV-02, DLV-06
As a restaurant owner, I want to manage delivery partner credentials, priority, fee rule, and see the quote-vs-actual log.
Acceptance criteria:
- Given saved partner credentials, a "Test connection" action confirms they work before going live.
Tests: E2E
Brief refs: §12 "Delivery"
Reuse: none — net-new

### DSH-09 Payments & refunds screen
Epic: DSH · Phase: 10 · Priority: P0 · Status: todo · Depends on: PAY-07
As a restaurant owner/manager, I want to see transactions and initiate refunds with the amount always shown before confirming.
Acceptance criteria:
- Given a refund action, a confirmation dialog shows the exact amount before it's irreversible.
Tests: E2E
Brief refs: §12 "Payments & refunds", §15.1
Reuse: none — net-new

### DSH-10 Offers screen
Epic: DSH · Phase: 10 · Priority: P1 · Status: todo · Depends on: PRC-02
As a restaurant owner, I want to create/edit coupons and see usage stats.
Acceptance criteria:
- Given a coupon's usage stats, redemption count and remaining uses are visible.
Tests: E2E
Brief refs: §12 "Offers"
Reuse: none — net-new

### DSH-11 Customers screen
Epic: DSH · Phase: 10 · Priority: P0 · Status: todo · Depends on: PRV-03
As a restaurant owner, I want a customer list with order count, last order, spend, opt-in status, and addresses, plus export/delete handling.
Acceptance criteria:
- Given a data export/delete request, the screen surfaces it as an actionable item for the owner.
Tests: E2E
Brief refs: §12 "Customers"
Reuse: none — net-new (the removed CRM contacts/groups UI doesn't map to this model, per `docs/AUDIT.md`)

### DSH-12 Complaints screen
Epic: DSH · Phase: 10 · Priority: P0 · Status: todo · Depends on: CMP-02
(See CMP-02.)
Brief refs: §12 "Complaints"

### DSH-13 Analytics screen
Epic: DSH · Phase: 10 · Priority: P1 · Status: todo · Depends on: ANL-01
(See ANL-01.)
Brief refs: §12 "Analytics"

### DSH-14 Share links & QR codes screen
Epic: DSH · Phase: 10 · Priority: P1 · Status: todo · Depends on: LNK-02
(See LNK-02.)
Brief refs: §12 "Share links & QR codes"

### DSH-15 Settings screen
Epic: DSH · Phase: 10 · Priority: P0 · Status: todo · Depends on: CFG-04, WAB-05
As a restaurant owner, I want profile/branding, number status, Easebuzz/POS connections, notifications, team/roles, and policies all in one settings area.
Acceptance criteria:
- Given a policy change (e.g. cancellation policy text), it's reflected immediately in the web checkout page's policy one-liner.
Tests: E2E
Brief refs: §12 "Settings"
Reuse: existing settings page structure (heavily pruned this session — rebuilt for restaurant settings)

---

## OWN — Owner WhatsApp command interface, alerts, night summary

Net-new epic, derived from the Restaurant OS Flow Map's "Owner alerts and reports" flow (not present in the original brief-derived draft). Distinct from OBS (engineering/infra alerting to the platform operator) and ANL/DSH (dashboard screens) — this is business-event alerting and a lightweight admin surface for the restaurant owner, delivered entirely over WhatsApp.

### OWN-01 Instant owner alerts with action buttons
Epic: OWN · Phase: 10 · Priority: P0 · Status: todo · Depends on: ORD-01, BKG-01, WAB-06, FUL-03, ORD-07, BKG-07, BKG-03
As a restaurant owner, I want to be alerted immediately on the ops number for anything needing a decision — a low rating, a kitchen-reported problem, a booking needing approval, a stuck order — with buttons to act right there.
Acceptance criteria:
- Given a trigger event (1–2 star rating, kitchen "Problem" tap, a booking over the staff-approval threshold, an order not ready within the configured alert time), a WhatsApp message fires to the tenant's ops number within seconds, with action buttons appropriate to that event.
- Given no action is taken within the configured re-alert window, the alert repeats once to a configured fallback number.
Tests: integration (each trigger type), timer-driven (no-action repeat)
Brief refs: net-new, derived from Restaurant OS Flow Map "Owner alerts and reports" flow
Reuse: `services/whatsapp/gateway.ts`; feeds from FUL-03, ORD-07, BKG-07, BKG-03's large-party override

### OWN-02 Nightly business summary
Epic: OWN · Phase: 10 · Priority: P0 · Status: todo · Depends on: ORD-01, ANL-02, WAB-06
As a restaurant owner, I want a daily summary on WhatsApp at a configured time: orders, revenue, top dish, the total left before paying, bookings, and issue count.
Acceptance criteria:
- Given the tenant's configured summary time (default 11:00 PM), a scheduled job sends the day's summary as a WhatsApp message with an "Open dashboard" button.
Tests: integration (timer-driven), unit (summary figures match underlying data)
Brief refs: net-new, derived from Restaurant OS Flow Map "Owner alerts and reports" flow
Reuse: `jobs/scheduler.ts`; the existing `daily_report_settings` table (pre-existing Alphabot feature, `20250101000047_daily_report_settings.sql`/`20260927010000_daily_report_settings.sql`) as a starting schema if its shape fits

### OWN-03 Owner WhatsApp command parser
Epic: OWN · Phase: 10 · Priority: P1 · Status: todo · Depends on: MENU-02, BR-03, OWN-02
As a restaurant owner, I want to run short commands on the ops number instead of opening the dashboard — sales today, open orders, mark a dish out/back, pause/resume ordering.
Acceptance criteria:
- Given a recognised command (`sales today`, `open orders`, `OUT <dish name>`, `BACK <dish name>`, `PAUSE <minutes>`, `RESUME`), the matching action runs and a confirmation — including an undo instruction where relevant, e.g. "Send BACK <dish> to restore it" — is sent back.
- Given an unrecognised command, the bot replies with the list of valid commands rather than silently failing.
Tests: unit (parser, per command), integration (each command's side effect)
Brief refs: net-new, derived from Restaurant OS Flow Map "Owner alerts and reports" flow
Reuse: MENU-02 (stock toggle) and BR-03 (pause/resume) as the underlying actions — this story is just the WhatsApp text-command surface over them

---

## CON — Platform console screens, onboarding wizard

### CON-01 Tenants list with health indicators
Epic: CON · Phase: 11 · Priority: P0 · Status: todo · Depends on: WAB-01, PAY-01, POS-06, DLV-05
As a platform operator, I want to see every tenant's plan, status, integration health, and AI cost at a glance.
Acceptance criteria:
- Given a tenant with a failing POS health check, the list surfaces it without opening the tenant.
Tests: E2E
Brief refs: §13 "Tenants"
Reuse: existing `(platform)/platform/clients` list pattern

### CON-02 Onboarding wizard
Epic: CON · Phase: 11 · Priority: P0 · Status: todo · Depends on: WAB-01, PAY-01, POS-01, BR-01, MENU-01, DLV-01, TPL-01
As a platform operator, I want a guided checklist to take a new restaurant from signup to live.
Acceptance criteria:
- Given the wizard's steps (business details → number → Easebuzz test → POS/manual → branches/hours → menu → delivery test → policies → templates → test order → go live), each step's completion is tracked and gates the next.
- Given a menu PDF/Excel/photo at the menu step, an AI-assisted extraction drafts the structured menu (name, price, veg/non-veg) for the team to verify line-by-line before the owner approves it — this does not replace manual entry, it drafts a starting point.
- Given all prior steps are complete, "go live" is gated on a test order, a test booking, and a test handoff each succeeding with the owner present — not just on config being filled in.
- Given go-live, the first 7 days are flagged on the checklist for daily chat/failure review, closed out explicitly rather than assumed done.
Tests: E2E (full wizard walkthrough, including the AI-extraction review step and the go-live test gate)
Brief refs: §13 "Onboarding wizard" — AI-assisted extraction, go-live test gate, and first-week review added per Restaurant OS Flow Map "Onboarding a new restaurant" flow
Reuse: `tenant-intake.html`/`TENANT_MASTER_SPEC.template.md`'s field list as a reference for required fields (the files themselves were removed per `docs/AUDIT.md` §3 — fields are reused, not the Alphabot-specific tooling)

### CON-03 Integration health & webhook explorer
Epic: CON · Phase: 13 · Priority: P0 · Status: todo · Depends on: QUE-03
(See QUE-03.)
Brief refs: §13 "Integration health & logs"

### CON-04 Template approval status
Epic: CON · Phase: 11 · Priority: P1 · Status: todo · Depends on: TPL-01
As a platform operator, I want to see every tenant's template approval status in one place.
Acceptance criteria:
- Given a tenant with a rejected template, it's flagged with Meta's rejection reason if available.
Tests: E2E
Brief refs: §13 "Templates"
Reuse: TPL-01

### CON-05 AI cost and QA console
Epic: CON · Phase: 13 · Priority: P1 · Status: todo · Depends on: AGT-06
As a platform operator, I want to see AI cost per tenant/order and review transcripts for QA.
Acceptance criteria:
- Given a cost spike for a tenant, it's visually flagged against the plan's cost cap.
Tests: E2E
Brief refs: §13 "AI"
Reuse: AGT-06's logging

### CON-06 Billing console
Epic: CON · Phase: 11 · Priority: P1 · Status: todo · Depends on: —
As a platform operator, I want to manage KOT.ai SaaS plans and subscriptions.
Acceptance criteria:
- Given an existing Alphabot plan structure, the decision to reuse vs. redefine (per `docs/PLAN.md` open question #6) is implemented here once answered.
Tests: E2E
Brief refs: §13 "Billing"
Reuse: `components/platform/BillingManager.tsx`, existing subscription routes

### CON-07 Audit log and read-only impersonation
Epic: CON · Phase: 13 · Priority: P1 · Status: todo · Depends on: —
As a platform operator, I want to view a tenant's dashboard read-only for support, with the view itself audited.
Acceptance criteria:
- Given an impersonation session, every write action is disabled and the session start/end is audited.
Tests: integration (write-blocking check)
Brief refs: §13 "Audit log and impersonate"
Reuse: existing `audit_logs` pattern

---

## ANL — Analytics and funnel metrics

### ANL-01 Conversion funnel
Epic: ANL · Phase: 13 · Priority: P1 · Status: todo · Depends on: ORD-01, WEB-02
As a restaurant owner, I want to see conversations → menu views → carts → checkouts → paid, by source.
Acceptance criteria:
- Given funnel data, conversion rate between each stage is shown, broken down by source (LNK-01's tags).
Tests: integration
Brief refs: §12 "Analytics"
Reuse: none — net-new (the removed sales-funnel analytics components don't map to order funnel data)

### ANL-02 Item and AOV analytics
Epic: ANL · Phase: 13 · Priority: P1 · Status: todo · Depends on: ORD-01
As a restaurant owner, I want top items, AOV trend, and repeat rate.
Acceptance criteria:
- Given order history, top items and AOV trend render correctly over a selectable date range.
Tests: integration
Brief refs: §12 "Analytics"
Reuse: none — net-new

### ANL-03 Operational SLA analytics
Epic: ANL · Phase: 13 · Priority: P1 · Status: todo · Depends on: ORD-01, DLV-06, BKG-01
As a restaurant owner, I want SLA timings (accept, prepare, pickup, deliver), rejection rate, failed deliveries, and booking no-show rate.
Acceptance criteria:
- Given order/delivery/booking event timestamps, each SLA metric is computed correctly.
Tests: integration
Brief refs: §12 "Analytics"
Reuse: none — net-new

### ANL-04 Bot vs human handling share
Epic: ANL · Phase: 13 · Priority: P2 · Status: todo · Depends on: HND-01
As a restaurant owner, I want to know what share of conversations needed human takeover.
Acceptance criteria:
- Given conversation data, the bot-handled vs. human-handled ratio is shown.
Tests: integration
Brief refs: §12 "Analytics"
Reuse: none — net-new

---

## OBS — Logging, Sentry, metrics, alerts, health checks

### OBS-01 Correlation-id structured logging
Epic: OBS · Phase: 13 · Priority: P0 · Status: todo · Depends on: QUE-01
As an engineer debugging an incident, I want one correlation id traceable from webhook through job through external call.
Acceptance criteria:
- Given any request, a correlation id is attached to every log line it produces across the webhook→queue→handler chain.
Tests: integration (trace a request end-to-end)
Brief refs: §18
Reuse: none — net-new (extends existing Pino logging)

### OBS-02 Alerting thresholds
Epic: OBS · Phase: 13 · Priority: P0 · Status: todo · Depends on: OBS-01
As a platform operator, I want to be alerted on webhook failure rate, queue depth/age, payment pending > N min, acceptance timeouts, rider search failures, POS/partner errors, AI error rate/cost spikes, and WhatsApp send failures.
Acceptance criteria:
- Given each threshold is breached, an alert fires to the configured channel.
Tests: integration (simulated breach per metric)
Brief refs: §18
Reuse: Sentry (existing)

### OBS-03 Health endpoints
Epic: OBS · Phase: 1 · Priority: P0 · Status: todo · Depends on: —
As a platform operator, I want `/health` to reflect real dependency status.
Acceptance criteria:
- Given Redis or Supabase is down, `/health` reports `degraded` with the specific failing check.
Tests: integration
Brief refs: §18
Reuse: existing `/health` route (extend with queue status once QUE-01 lands)

### OBS-04 Graceful plan-limit handling
Epic: OBS · Phase: 2 · Priority: P0 · Status: todo · Depends on: CFG-02
As a customer, I want a graceful reply even if the tenant's plan limit is hit, not silence.
Acceptance criteria:
- Given a plan-limit breach, the customer gets a polite reply and both tenant and platform are alerted.
Tests: integration
Brief refs: §4 issue 7, §16 "Plan limit reached"
Reuse: none — net-new (fixes a known Alphabot gap)

### OBS-05 Dead-letter replay from console
Epic: OBS · Phase: 13 · Priority: P1 · Status: todo · Depends on: QUE-03
(See QUE-03.)
Brief refs: §18

---

## TST — Test suites (unit, integration, conversation, E2E, load, regression)

### TST-01 Unit test coverage for core calculators
Epic: TST · Phase: 3-9 · Priority: P0 · Status: todo · Depends on: PRC-06, SRV-04, BR-02
As a developer, I want pricing/offers/quantity-parsing/hours/serviceability/state-machine/config-resolver/token-signing fully unit tested before they touch money or customer-facing flows.
Acceptance criteria:
- Given CI, each listed module has a passing unit suite with edge cases (brief §19's list) covered.
Tests: this story is the test suite
Brief refs: §19
Reuse: n/a

### TST-02 Adapter integration tests with mocks/sandboxes
Epic: TST · Phase: 3-8 · Priority: P0 · Status: todo · Depends on: POS-01, DLV-01, PAY-01
As a developer, I want every external adapter tested against a mock and, where available, a real sandbox.
Acceptance criteria:
- Given `msw` (brief §0A.2), Meta/Easebuzz/Petpooja/delivery APIs are mockable in tests without hitting real endpoints.
Tests: this story is the test suite
Brief refs: §19
Reuse: `msw`, `vitest`

### TST-03 Webhook idempotency and ordering tests
Epic: TST · Phase: 2 · Priority: P0 · Status: todo · Depends on: QUE-02
As a developer, I want duplicate and out-of-order webhook events proven safe.
Acceptance criteria:
- Given duplicate and out-of-order delivery simulations, state never ends up inconsistent.
Tests: this story is the test suite
Brief refs: §19
Reuse: QUE-02

### TST-04 Conversation test transcripts
Epic: TST · Phase: 4-9 · Priority: P0 · Status: todo · Depends on: AGT-01
As a developer, I want scripted transcripts for every flow, including mistakes, changes of mind, voice notes, and injection attempts, asserting tool calls and final state rather than exact wording.
Acceptance criteria:
- Given each documented flow (brief §8), a transcript test exists and passes.
Tests: this story is the test suite
Brief refs: §9, §19
Reuse: n/a

### TST-05 E2E suite (Playwright)
Epic: TST · Phase: 5-9 · Priority: P0 · Status: todo · Depends on: WEB-03, ORD-06, BKG-02
As a developer, I want browse→cart→checkout→mock-payment→confirmation, dashboard accept/reject/food-ready, and booking flow tested end-to-end.
Acceptance criteria:
- Given CI, these E2E suites run on main/staging per brief §19.
Tests: this story is the test suite
Brief refs: §19
Reuse: `@playwright/test`

### TST-06 Load test (lunch-peak simulation)
Epic: TST · Phase: 13 · Priority: P1 · Status: todo · Depends on: QUE-01
As the platform, I want confidence the system holds up under a realistic peak (e.g. 50 concurrent conversations per tenant, several tenants — exact targets confirmed in Phase 13).
Acceptance criteria:
- Given the load test, p95 latency and error rate stay within the targets agreed before this story closes.
Tests: this story is the test suite
Brief refs: §19
Reuse: n/a

---

## DEP — Staging/prod deploys, domains, runbook, go-live

### DEP-01 Staging deploy pipeline
Epic: DEP · Phase: 1 · Priority: P0 · Status: todo · Depends on: SET-02, SET-03
(See SET-02/SET-03 — deploy automation specifically.)
Brief refs: §20.2

### DEP-02 Production deploy pipeline with gated migrations
Epic: DEP · Phase: 14 · Priority: P0 · Status: todo · Depends on: DEP-01
As the platform, I want production deploys gated on migrations running cleanly first.
Acceptance criteria:
- Given a tagged release, migrations run as a gated CI step before the API/web deploy proceeds.
Tests: CI (meta)
Brief refs: §20.2
Reuse: `.github/workflows/deploy-render.yml` (extend)

### DEP-03 Domain and HTTPS setup
Epic: DEP · Phase: 14 · Priority: P0 · Status: todo · Depends on: —
As the platform, I want api/app/ordering domains live with HTTPS before pilot.
Acceptance criteria:
- Given the domains from `docs/PLAN.md` open question #1 (once answered), each resolves over HTTPS to the correct service.
Tests: manual verification
Brief refs: §20.2
Reuse: none — net-new, blocked on domain-name decision

### DEP-04 Runbook
Epic: DEP · Phase: 14 · Priority: P0 · Status: todo · Depends on: SET-06, OBS-02
As an on-call engineer, I want a runbook covering incident response for the alerting thresholds in OBS-02.
Acceptance criteria:
- Given `docs/RUNBOOK.md`, each OBS-02 alert type has a documented first-response step.
Tests: tabletop walkthrough
Brief refs: §20, §18
Reuse: none — net-new

### DEP-05 Go-live checklist execution
Epic: DEP · Phase: 14 · Priority: P0 · Status: todo · Depends on: DEP-02, DEP-03, DEP-04
As the platform operator, I want the brief's go-live checklist executed and signed off before any real pilot payment.
Acceptance criteria:
- Given the checklist (brief §21 "Go-live checklist (pilot)"), every item is checked and recorded before pilot go-live approval.
Tests: — (checklist, manual)
Brief refs: §21
Reuse: none — net-new

---

## CAT — WhatsApp catalog sync and multi-product messages (Phase 15)

### CAT-01 Meta commerce catalog sync
Epic: CAT · Phase: 15 · Priority: P2 · Status: todo · Depends on: MENU-01
As a restaurant owner, I want my menu synced to a Meta commerce catalog per tenant.
Acceptance criteria:
- Given a menu change, the catalog sync reflects it within a documented SLA.
Tests: integration (mock catalog API)
Brief refs: §8.6
Reuse: none — net-new

### CAT-02 Single/multi-product messages
Epic: CAT · Phase: 15 · Priority: P2 · Status: todo · Depends on: CAT-01
As a customer, I want to receive and interact with catalog product messages.
Acceptance criteria:
- Given a catalog order webhook, it feeds into the same cart (CART-01) as chat/web orders.
Tests: integration
Brief refs: §8.6
Reuse: CART-01

### CAT-03 Ordering mode toggle
Epic: CAT · Phase: 15 · Priority: P2 · Status: todo · Depends on: CAT-02
As a restaurant owner, I want to enable/disable catalog ordering per brief §11's ordering-modes setting.
Acceptance criteria:
- Given the toggle is off, no catalog messages are sent even if synced.
Tests: integration
Brief refs: §11, §21 Phase 15 gate
Reuse: CFG-02

---

## FLW — WhatsApp Flows checkout (Phase 15)

### FLW-01 Flow-based checkout
Epic: FLW · Phase: 15 · Priority: P2 · Status: todo · Depends on: CART-01, PRC-04
As a customer, I want an optional native WhatsApp Flow for checkout/address instead of the web page.
Acceptance criteria:
- Given a Flow submission, the same pricing and order services (PRC-01, ORD-02) are used — no parallel pricing logic.
Tests: integration
Brief refs: §8.6
Reuse: PRC-01, ORD-02

### FLW-02 Flow toggle per tenant
Epic: FLW · Phase: 15 · Priority: P2 · Status: todo · Depends on: FLW-01
As a restaurant owner, I want to choose whether Flow checkout is offered.
Acceptance criteria:
- Given the toggle is off, the CTA always points to the web ordering page instead.
Tests: integration
Brief refs: §11, §21 Phase 15 gate
Reuse: CFG-02

---

## Summary

Total stories: 198 across 38 epics (SET 6, AUD 4, SEC 6, QUE 4, BRD 4, CFG 5, BR 5, MENU 7, POS 6, AGT 7, CONV 6, SRV 5, CART 4, PRC 6, WEB 6, ORD 7, PAY 7, FUL 5, DLV 6, BKG 7, HND 4, CMP 4, CAN 3, MKT 4, PRV 4, WAB 6, TPL 3, LNK 3, TKW 4, DSH 15, OWN 3, CON 7, ANL 4, OBS 5, TST 6, DEP 5, CAT 3, FLW 2) — counted directly from the file (`grep -c '^### [A-Z]\+-[0-9]\+'`/`'^## [A-Z]'`) rather than hand-tracked, since this line's previous value (145 across 34 epics) had already drifted from reality before this pass (the real prior count was 192 across 37 epics) and nothing here checks it automatically.

ORD-07, SRV-05, and AGT-07 were added after the initial draft to close gaps found during the Phase 0 traceability check (`docs/TRACEABILITY.md`): post-delivery feedback, the geocoding adapter itself, and the WhatsApp copy file brief §15.3 requires.

Note: DSH-02/03/04/05/06/12/13/14 and CON-03 are cross-references to stories already fully specified under their originating epic (ORD, HND, BKG, MENU, CMP, ANL, LNK, QUE) — brief §12/§13 require "one story per screen minimum," satisfied here without duplicating acceptance criteria.

### Restaurant OS Flow Map update (this pass)

A detailed, timer-and-copy-level flow map (`Restaurant OS Flow Map.html`, 8 flows: Order and pay, Prepare and hand over, Table booking, Questions and handoff, Menu/stock/prices, Owner alerts/reports, Offers/win-back, Onboarding) was reviewed against this backlog and used to both add missing scope and tighten acceptance criteria with concrete values. Changes:

- **New epic OWN** (3 stories: OWN-01/02/03) — an owner-facing WhatsApp command/alert/summary interface with no prior home in this backlog; distinct from OBS (engineering alerting) and DSH/ANL (dashboard screens).
- **New stories**: MENU-07 (bulk menu import with change preview), WAB-06 (separate customer/kitchen/ops WhatsApp numbers per restaurant), BKG-07 (post-dining feedback, parity with ORD-07).
- **Behavioural change, not just detail — flag for review**: FUL-02 is rewritten from "acceptance timeout → auto-refund if the restaurant never responds" to "automatic acceptance after a fixed delay (default 10s), no manual accept step at all." FUL-03 is narrowed from "whole-order rejection with a mandatory reason" to "item-level 'Problem' → owner picks swap or refund." FUL-04 is marked **consolidated into FUL-03** rather than deleted, to preserve its ID for traceability. ORD-06's kanban description is updated to match (no Accept/Reject action).
- **Behavioural change, not just detail — flag for review**: ORD-02 is rewritten so the `orders` row is created only on confirmed payment, not at payment-link generation — the pre-payment state is a chat-only draft, tracked separately (a `checkout_drafts`-style concept not yet reflected in `docs/DATA_MODEL.md`). DSH-01 gained a "left before paying" figure sourced from this.
- **Concrete defaults added or corrected** against existing placeholder/approximate values: PAY-02 (30 min link expiry, 10 min reminder), FUL-02 (10s auto-accept, 25 min stuck-order alert), BKG-04 (reminder default corrected from 2h to 3h), CONV-06 (5 min no-reply re-alert on handoff), BKG-03 (8-guest host-approval threshold), BKG-01 (waitlist on a full slot).
- **Enriched, same scope**: BKG-06 (no-show recorded on the customer record), CONV-06/AGT-04 (allergy/health questions are an explicit, unconditional human-escalation trigger — the bot never guesses), BR-05 (pre-order offered when fully closed), CON-02 (AI-assisted menu extraction during onboarding, a go-live test gate, a first-week review checklist item).
- These timer/threshold defaults (10s, 25min, 45min no-show, 3h booking reminder, 8-guest threshold, 30min payment expiry, 10min payment reminder, 11pm summary time, 5min handoff re-alert) are concrete enough that they belong in brief §11's settings table (CFG-01) as tenant-overridable values, not hardcoded — not yet synced into `KOTAI_BUILD_BRIEF.md` itself; flagged here for whoever next edits that doc.
