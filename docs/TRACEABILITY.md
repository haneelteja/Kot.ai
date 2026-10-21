# KOT.ai — Traceability Matrix (Phase 0, mandatory per brief §22)

Maps every brief section/bullet to backlog IDs in `docs/BACKLOG.md`. Section-level mapping for narrative sections; row-level for §2, §6 integrity rules, §11, and §16 as the brief requires.

## §1 Product summary
Covered by the full backlog (every bullet maps to CONV/BKG/ORD/PAY/POS/FUL/DLV epics below).

## §2 Decisions already made

| Row | Decision | Backlog |
|---|---|---|
| D1 | Restaurant-owned channel model | PAY-01, WAB-01 |
| D2 | Easebuzz, per-tenant, link-based | PAY-01, PAY-02 |
| D3 | Restaurant holds delivery partner account | DLV-01, DLV-02 |
| D4 | Rider booked at Food Ready, not payment | DLV-04 |
| D5 | Petpooja + manual POS, generic adapter | POS-01, POS-02, POS-05 |
| D6 | Configurable hours/cut-offs per branch | BR-02, BR-04 |
| D7 | Configurable acceptance timeout | FUL-02, CFG-02 |
| D8 | Booking mode configurable | BKG-03 |
| D9 | Web link + chat first, catalog/Flows later | WEB-01, CONV-*, CAT-*, FLW-* |
| D10 | Serviceability checked before cart and before payment | SRV-01, SRV-03 |
| D11 | Alphabot stack reused (reinterpreted as copy-and-prune) | ADR 0004, AUD-01/02 |
| D12 | Edge-case defaults implemented before payments live | TST-04, FUL-02/03/04, DLV-05, CAN-* |
| D13 | Single payment into restaurant's account, platform never holds funds | PAY-01, PRC-01 |
| D14 | WhatsApp onboarding via restaurant's own WABA | WAB-01 |

## §3 Scope
MVP scope = the full backlog below (every epic in-scope list maps). "Later" exclusions (loyalty, own POS, multi-language templates, scheduled future-day orders, COD) are explicitly out of backlog — noted as non-goals, not gaps.

## §4 Existing codebase — audit first
AUD-01 (full audit), AUD-02 (reuse map). Known issues 1–8 individually: SEC-01 (issue 1), AGT-01 (issue 2), PRC-01 (issue 3), SEC-02/PAY-01 (issue 4), PAY-03/PAY-04 (issue 5), QUE-01 (issue 6), OBS-04 (issue 7), PAY-02 (issue 8, tenant data not hardcoded).

## §5 Architecture
AUD-03 (architecture doc), ADR 0001 (queue), ADR 0002 (module layout). Request flow: WAB-02 (routing), AGT-01 (agent), CART-02/PRC-01 (tool-backed services).

## §6 Data model

| Area | Backlog |
|---|---|
| `restaurant_profiles` | PAY-02 (tenant data in receipts), WAB-05 |
| `branches`, `branch_hours`, `branch_closures`, `branch_runtime_status` | BR-01, BR-02, BR-03 |
| `menu_*`, `item_variants`, `addon_groups`, `addons` | MENU-01 |
| `offers` | PRC-02 |
| `customers`/`customer_addresses` | CONV-04, DSH-11 |
| `carts`/`cart_items` | CART-01 |
| `quotes` | PRC-04 |
| `orders`/`order_items` | ORD-02 |
| `payments` | PAY-01, PAY-02 |
| `refunds` | PAY-07 |
| `pos_orders`/`pos_events` | POS-02, POS-03 |
| `delivery_tasks`/`delivery_events` | DLV-04, DLV-06 |
| `bookings`/`booking_slots` | BKG-01 |
| `complaints` | CMP-01 |
| `conversation_takeovers` | HND-01 |
| `tenant_settings`/`platform_settings_defaults` | CFG-01 |
| `integration_credentials` | SEC-02 |
| `webhook_events` | QUE-02 |
| `notifications_log` | OBS-02 (alerts), ORD-04 |
| `audit_logs` | SEC-05, CFG-05 |
| `ai_calls` | AGT-06 |
| `consents` | MKT-03 |
| `order_feedback` | (net-new, not yet in backlog — **gap, see below**) |
| `share_links` | LNK-01 |
| `order_ref_sequences` | ORD-03 |

**Integrity rules**: booking capacity atomic → BKG-01; offer usage atomic → PRC-02; one active cart per (tenant, contact, branch) → CART-01; BSUID support → CONV-04 note, DSH-11.

**Gap found during traceability**: `order_feedback` (post-delivery 1–5 rating + comment, brief §8.8) has no backlog story. **Fixed below as ORD-07.**

## §7 State machines
ORD-01 (order), PAY-01/PAY-03 (payment transitions embedded in PAY-03/04), PAY-07 (refund state machine), DLV-01/DLV-04 (delivery task state machine), BKG-01/BKG-03 (booking state machine), CMP-03 (complaint state machine).

## §8 Customer journeys

| Sub-section | Backlog |
|---|---|
| 8.1 Entry/greeting | CONV-01 |
| 8.2 Knowledge | CONV-02 |
| 8.3 Branch/location | CONV-03, CONV-04, SRV-01 |
| 8.4 Web ordering | WEB-01–WEB-04 |
| 8.5 Conversational ordering | CART-02, CART-03, CART-04 |
| 8.6 Catalog & Flows | CAT-01–03, FLW-01–02 |
| 8.7 Payment | PAY-02 |
| 8.8 After payment | ORD-04, WEB-05, **ORD-07 (feedback — added)** |
| 8.9 Table booking | BKG-02, BKG-04, BKG-05 |
| 8.10 Takeaway | TKW-01–04 |
| 8.11 Order limits | PRC-02 (stacking), PRC-05 |
| 8.12 Support | CONV-06 |

## §9 AI agent
AGT-01–06 (scaffold, tool set, prompt builder, guardrails, language, logging).

## §10 Integrations
Meta: WAB-01–05, TPL-01–03. Easebuzz: PAY-01–07. Petpooja: POS-01–06. Manual POS: POS-05. Delivery adapters: DLV-01–06. Geocoding: SRV-01/02 (consumers), **GEO-01 gap — see below**. Sarvam STT: CONV-05.

**Gap found**: brief §10's geocoding adapter itself (forward/reverse geocoding, Google Maps link parsing, result caching) has no dedicated story — SRV-01/02 only cover the *consuming* serviceability logic. **Fixed below as SRV-05.**

## §11 Configuration model

Every row maps to CFG-01 (schema) + CFG-02 (resolver) + CFG-03/CFG-04 (UIs), with the specific behavior implemented in its owning epic: hours/shifts/offs → BR-02; cut-off → BR-04; closure/pause → BR-03; out-of-hours behaviour → BR-05; acceptance timeout → FUL-02; item-unavailable window → FUL-04; cancellation policy → CAN-02; booking mode/slots/capacity/lead-time/reminder → BKG-01/03/04; delivery radius/fee/priority/timeout → PRC-03, DLV-05; payment link expiry/reminder → WEB-01, PAY-02; min/max order value → PRC-05; takeaway OTP/reminder/closing → TKW-02/03; offer stacking → PRC-02; ordering modes enabled → WEB-01/CAT-03/FLW-02; handoff triggers/auto-resume → CONV-06/HND-03; web link token expiry → WEB-01 (ADR 0003); plan limits → OBS-04.

## §12 Tenant dashboard
DSH-01 through DSH-15 (one per screen, cross-referencing the owning epic where the screen's logic already has a story).

## §13 Platform console
CON-01 through CON-07.

## §14 Brand, logo, theme
BRD-01–04. Superseded in detail by `docs/DESIGN.md` per that file's own header note — tracked, not a gap.

## §15 UX principles and copy
15.1 Principles → WEB-02 (accessibility markers), DSH-09 (confirm-before-destructive). 15.2 WhatsApp copy rules → AGT-03 (persona), CONV-*. 15.3 Message set → **COPY-01 gap — see below**. 15.4 Templates → TPL-01.

**Gap found**: brief §15.3's full message-set draft (`docs/copy/whatsapp.md`, tenant-overridable) has no dedicated story — individual flows reference "a message fires" but nothing owns authoring the base copy file. **Fixed below as AGT-07.**

## §16 Edge cases and graceful handling

| Case | Backlog |
|---|---|
| Restaurant does not accept | FUL-02 |
| Restaurant rejects a paid order | FUL-03 |
| Item unavailable after payment | FUL-04 |
| Item out of stock during checkout | WEB-03 (re-validate at "Pay") |
| Payment success after expiry/cancel | PAY-06 |
| Duplicate webhook | QUE-02 |
| No rider available | DLV-05 |
| Rider cancels/delivery fails | DLV-05 |
| Customer cancels | CAN-01, CAN-02, CAN-03 |
| Complaint | CMP-01, CMP-03 |
| Human takeover | HND-01, CONV-06 |
| Voice note | CONV-05 |
| Closed/cut-off/kitchen busy | BR-04, BR-05 |
| Address outside radius/coverage | SRV-01, SRV-02 |
| POS down | POS-06 |
| Plan limit reached | OBS-04 |
| WhatsApp send failures/quality drop | WAB-04 |
| Outside 24h window | TPL-02 |
| Unrelated/abusive content | AGT-04 |
| Marketing opt-in/opt-out | MKT-01, MKT-02 |

## §17 Security, privacy, compliance
SEC-01–06, PRV-01–04. DPA → PRV-04 (flagged for legal review per brief's own instruction).

## §18 Observability
OBS-01–05.

## §19 Testing strategy
TST-01–06.

## §20 Environments, setup, deployment
SET-01–06, DEP-01–05.

## §21 Execution plan — phases and gates
`docs/PLAN.md`'s milestone table mirrors this section exactly, phase-by-phase; every backlog story's `Phase:` field maps to a row here.

## §22 Backlog traceability check
This document.

## §23 Definition of done
Not a backlog item — a process rule applied to every story's closure (enforced via PR template/checklist, to be added in SET-03's CI work).

## §24 Questions to ask
Captured in `docs/PLAN.md`'s "Open questions" section, not the backlog (they're inputs to stories, not stories themselves).

---

## Gaps found during this traceability pass (added to `docs/BACKLOG.md` conceptually; append as new entries before Phase 1 starts)

### ORD-07 Post-delivery feedback capture
Epic: ORD · Phase: 7 · Priority: P2 · Status: todo · Depends on: ORD-04
As a restaurant owner, I want a quick 1–5 rating + optional comment after delivery/collection so I can track satisfaction.
Acceptance criteria:
- Given an order reaches `delivered`/`collected`, a feedback prompt is sent once; a response is stored in `order_feedback`.
Tests: integration
Brief refs: §6 `order_feedback`, §8.8
Reuse: none — net-new

### SRV-05 Geocoding adapter
Epic: SRV · Phase: 4 · Priority: P0 · Status: todo · Depends on: —
As the platform, I want a single geocoding interface so address capture and serviceability don't each call Google Maps differently.
Acceptance criteria:
- Given a typed address, forward geocoding returns lat/lng with a confidence signal; given a Google Maps link pasted by a customer, it's parsed to lat/lng; results are cached.
Tests: unit (parsing), integration (mocked Google API)
Brief refs: §5, §10
Reuse: none — net-new, Google Maps Geocoding/Places behind an adapter interface

### AGT-07 WhatsApp copy file
Epic: AGT · Phase: 4 · Priority: P0 · Status: todo · Depends on: AGT-03
As a restaurant owner, I want every bot message drafted once in a tenant-overridable file rather than hardcoded per flow.
Acceptance criteria:
- Given `docs/copy/whatsapp.md`, every message in brief §15.3's list has a drafted default, and the system prompt builder (AGT-03) can substitute a tenant override where one exists.
Tests: unit (override substitution)
Brief refs: §15.2, §15.3
Reuse: none — net-new

These three stories have been added to `docs/BACKLOG.md` (ORD-07, SRV-05, AGT-07) per brief §22: "any unmapped requirement is a defect in the backlog; fix it before asking for approval." Total backlog count after the fix: 145.
