# KOT.ai — Plan (Phase 0)

## Milestones and sequencing

Follows brief Section 21's phase table exactly (phase numbers below match the brief and `docs/BACKLOG.md`'s `Phase:` field):

0. **Discovery & plan** (this document and its siblings) → gate: approve plan & backlog.
1. **Environment & foundations** — local/staging setup, CI, brand package + UI kit skeleton, seed data → gate: a test WhatsApp message reaches staging and is stored.
2. **Platform hardening** — fix `docs/AUDIT.md` issues #1–8 (signature verification, durable queue, per-tenant credentials, tool-calling agent infra), regression tests → gate: all tests pass, security tests pass.
3. **Restaurant domain core** — data model/migrations/RLS, config resolver, branches/hours, menu model, POS adapters → gate: demo tenant menu synced, hours resolver tests green.
4. **Conversation & AI agent** — restaurant agent with tools, discovery flows, location/geocoding/serviceability, voice notes → gate: conversation tests pass.
5. **Ordering** — server-side cart, pricing/offers engine, price lock, web ordering page, conversational ordering → gate: correct bill in chat and web.
6. **Payments** — Easebuzz adapter, links, webhooks, reconciliation, refunds → gate: sandbox end-to-end order paid, idempotency tests pass.
7. **Fulfilment** — POS push, acceptance timeout, reject, item-unavailable flow, tracking page → gate: accept/reject/timeout/unavailable scenarios pass.
8. **Delivery** — adapters, quotes, booking at Food Ready, fallback → gate: mock/sandbox delivery completes end-to-end.
9. **Table booking** — availability, modes, reminders, reschedule → gate: booking scenarios pass.
10. **Tenant dashboard** — brief §12 screens → gate: UAT walkthrough with demo tenant.
11. **Platform console** — brief §13 screens, onboarding wizard → gate: new tenant onboarded via wizard in staging.
12. **Graceful handling & notifications** — takeover, complaints, cancellations, opt-in, DPDP, templates submitted → gate: edge-case suite (brief §16) passes.
13. **Observability, performance, security review** → gate: checklist ticked.
14. **Pilot readiness** → gate: go-live approval.
15. **Catalog & Flows** (post-MVP) → gate: tenant can switch ordering mode.

Each phase ends with a stop-and-summarize gate per brief §0 — no phase starts without explicit approval of the previous one's output.

## Key risks

| Risk | Mitigation |
|---|---|
| `packages/database/migrations` and `supabase/migrations` are **not** a 1:1 mirror | **Resolved.** `supabase/migrations` was missing the base schema entirely (it assumed tables like `messages`/`tenants` already existed). Copied all of `packages/database/migrations` 001–048 into `supabase/migrations` with early (2025-01-01) timestamps so they apply first, found and fixed two real bugs surfaced only by actually running it end-to-end against a fresh database: (1) `035_batch_and_indexes.sql` referenced a column (`conversations.lead_follow_up_count`) not created until a much later migration — moved to the very end of the sequence; (2) two files used `CREATE INDEX CONCURRENTLY`, which the Supabase CLI's batched push can't run after the first statement in a multi-statement file — changed to plain `CREATE INDEX` (no downside for a from-scratch bootstrap with no live traffic). `supabase/migrations` (92 files) is now the proven, complete, single source of truth; applied clean against the real KOT.ai Supabase project (`qogsclmwnthienjxkjbu`, Southeast Asia/Singapore) 2026-10-21. `packages/database/migrations` is kept as the historical numbered reference but still has the 035 ordering bug uncorrected there (moot since its own `db:migrate` script is non-functional, per the other row below). |
| `packages/database`'s `npm run db:migrate` script has no `src/migrate.ts` — it will fail if run | Use `supabase db push` as the real migration path (documented in `docs/SETUP.md`) until this is fixed or the dead script is removed |
| Pruning Alphabot verticals broke a hidden shared dependency | Verified via `tsc --noEmit` on every workspace after the Phase 0 prune (clean); re-verify after each further deletion in later phases |
| No durable queue today despite Redis being present | ADR 0001 (BullMQ) scheduled for Phase 2, before any payment work |
| Petpooja order-edit support (post-payment item removal) unverified | Flag in `docs/integrations/petpooja.md` during Phase 3; document cancel-and-repush fallback if unsupported |
| Per-tenant Easebuzz/POS/delivery credential encryption doesn't exist yet | Phase 2 gate explicitly requires this before Phase 6 (payments) starts |
| Brand/token package is net-new, no existing `packages/ui` to extend | `docs/DESIGN.md` (already provided, see note below) is the source of truth — build `packages/brand` directly from it in Phase 1, not from brief §14 alone |
| Design assets (`Design/kotai-brand.zip`, DESIGN.md) appeared in the working directory outside normal file operations | Resolved: `docs/DESIGN.md` is the canonical copy; the full asset set (18 files) was extracted from the zip into `packages/brand/assets/`, and the 5 web-facing icons (favicons, apple-touch-icon, PWA icon) into `apps/web/public/`. The zip itself is `.gitignore`d (`*.zip`, exceeds the 100KB hook limit) and left in `Design/` for reference only — not needed going forward since every file it contained is now extracted and tracked |

## Open questions (brief §24 — batched, answer before Phase 1 unless noted)

1. **Production domains** — default Vercel domain `kot-ai-rust.vercel.app` is live; a custom domain hasn't been attached yet.
2. **Hosting region** — resolved for the web+DB tier: Vercel project `kot-ai` (team `haneel-tejas-projects`) + Supabase project `qogsclmwnthienjxkjbu` (Southeast Asia/Singapore, `ap-southeast-1`), both live as of 2026-10-21. `apps/api` is not deployed anywhere yet — still needs Render (or a decision to also move it to Vercel, which would require the scheduler rework flagged earlier). Note: this is currently **one environment**, not the brief's local/staging/production three-tier split (SET-02) — the user deployed straight to what Vercel calls "Production." Revisit whether a separate staging Supabase project is wanted before real customer data touches this.
3. **First delivery partner** to integrate (Shadowfax / Borzo / Porter) and whether a pilot restaurant already holds an account with it.
4. **Pilot restaurant details** — name, branch count, Petpooja status, menu export availability, WhatsApp number readiness. Blocks Phase 3 menu sync and Phase 14 pilot readiness, not Phase 0–2.
5. **Default values** for acceptance timeout, order cut-off buffer, payment link expiry, booking reminder offset, cancellation policy — brief §11 has the setting list; needs actual numbers. Can ship Phase 1–2 with placeholder defaults, must be confirmed before Phase 6 (payments) go-live.
6. **SaaS plan structure** — reuse Alphabot's existing subscription/billing tiers or define new KOT.ai-specific plans.
7. **Staff alert channel** — restaurant staff WhatsApp number, dashboard-only, or both, for new-order/booking alerts.
8. **Logo/theme feedback** — resolved: the user confirmed `Design/DESIGN.md` (now `docs/DESIGN.md`) is the design source of truth for all UI/UX, with an explicit bar that the product should "look great." All brand assets are extracted and in place (BRD-02, done). Phase 1's UI kit (BRD-03) and every later screen story must be built and reviewed against `docs/DESIGN.md` §8 (components) and §9 (per-screen specs), not a generic interpretation of brief §14.
9. **Meta Tech Provider / business verification status** for KOT.ai's own Meta app — needed before any restaurant's WhatsApp number can be onboarded (Phase 11/14).
10. **Existing number migration vs. fresh numbers** — do pilot restaurants' current WhatsApp Business App numbers move to the Cloud API (losing regular-app access) or do they provision new numbers?

None of these block Phase 0's approval gate (producing this plan + backlog), but #1, #2, #6, #7, #9, #10 should be answered before Phase 1 starts, and #4, #5 before Phase 3/6 respectively.
