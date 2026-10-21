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
| Pruning Alphabot verticals broke a hidden shared dependency | Verified via `tsc --noEmit` on every workspace after the Phase 0 prune (clean); re-verify after each further deletion in later phases |
| No durable queue today despite Redis being present | ADR 0001 (BullMQ) scheduled for Phase 2, before any payment work |
| Petpooja order-edit support (post-payment item removal) unverified | Flag in `docs/integrations/petpooja.md` during Phase 3; document cancel-and-repush fallback if unsupported |
| Per-tenant Easebuzz/POS/delivery credential encryption doesn't exist yet | Phase 2 gate explicitly requires this before Phase 6 (payments) starts |
| Brand/token package is net-new, no existing `packages/ui` to extend | `docs/DESIGN.md` (already provided, see note below) is the source of truth — build `packages/brand` directly from it in Phase 1, not from brief §14 alone |
| Design assets (`Design/kotai-brand.zip`, DESIGN.md) appeared in the working directory outside normal file operations | `docs/DESIGN.md` is now the canonical copy (moved from `Design/`); the two already-extracted logo files were copied into `packages/brand/assets/`. The zip itself exceeds the repo's 100KB pre-commit file-size limit — left untracked in `Design/`; unzip and place remaining assets (dark variants, app icons, favicons, WhatsApp profile image) into `packages/brand/assets/` manually, or move the zip to external storage per the hook's suggestion |

## Open questions (brief §24 — batched, answer before Phase 1 unless noted)

1. **Production domains** for API, dashboard, and ordering pages — not yet provided.
2. **Hosting region** — Alphabot currently runs Render Singapore (`render.yaml`); confirm whether KOT.ai keeps that or needs an India region for data residency.
3. **First delivery partner** to integrate (Shadowfax / Borzo / Porter) and whether a pilot restaurant already holds an account with it.
4. **Pilot restaurant details** — name, branch count, Petpooja status, menu export availability, WhatsApp number readiness. Blocks Phase 3 menu sync and Phase 14 pilot readiness, not Phase 0–2.
5. **Default values** for acceptance timeout, order cut-off buffer, payment link expiry, booking reminder offset, cancellation policy — brief §11 has the setting list; needs actual numbers. Can ship Phase 1–2 with placeholder defaults, must be confirmed before Phase 6 (payments) go-live.
6. **SaaS plan structure** — reuse Alphabot's existing subscription/billing tiers or define new KOT.ai-specific plans.
7. **Staff alert channel** — restaurant staff WhatsApp number, dashboard-only, or both, for new-order/booking alerts.
8. **Logo/theme feedback** — appears largely resolved: `docs/DESIGN.md` (kitchen-pass concept, Ink/Paper/Saffron palette) already supersedes brief §14's token table per its own header note. Confirm no further changes wanted before `packages/brand` is built in Phase 1.
9. **Meta Tech Provider / business verification status** for KOT.ai's own Meta app — needed before any restaurant's WhatsApp number can be onboarded (Phase 11/14).
10. **Existing number migration vs. fresh numbers** — do pilot restaurants' current WhatsApp Business App numbers move to the Cloud API (losing regular-app access) or do they provision new numbers?

None of these block Phase 0's approval gate (producing this plan + backlog), but #1, #2, #6, #7, #9, #10 should be answered before Phase 1 starts, and #4, #5 before Phase 3/6 respectively.
