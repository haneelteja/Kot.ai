# ADR 0002: Restaurant domain module layout

## Status
Accepted

## Context
The pruned `apps/api/src` has flat `routes/` and `services/` directories inherited from Alphabot. The restaurant domain (menu, cart, pricing, orders, bookings, serviceability, hours, complaints, refunds) and its external integrations (POS, delivery, payments, geocoding) are a large, cohesive net-new surface that doesn't fit the existing flat structure without becoming hard to navigate.

## Decision
Introduce two new top-level directories under `apps/api/src`, per brief §5:

- `modules/restaurant/{agent,menu,cart,pricing,orders,bookings,serviceability,hours,complaints,refunds}/` — domain logic, one subfolder per backlog epic (AGT, MENU, CART, PRC, ORD, BKG, SRV, BR, CMP, PAY's refund half).
- `integrations/{pos,delivery,payments,geo}/` — adapter interfaces plus one subfolder per provider (`petpooja/`, `manual/`, `shadowfax/`, `borzo/`, `porter/`, `easebuzz/`, `google/`).

Existing reused infrastructure (`services/whatsapp/`, `services/ai/`, `services/kb/`, `services/escalation/`, `services/contact/`, `lib/*`, `routes/webhook/`, `routes/orders/`) stays where it is — this ADR only governs net-new restaurant code, to avoid a large, risky rename of working code during Phase 0/1.

## Consequences
- Each adapter interface (`PosAdapter`, `DeliveryAdapter`, `PaymentAdapter`, `GeocodingAdapter`) lives in its integration folder with a `mock/` sibling for tests, per brief §10's "real adapter, sandbox config, mock" rule.
- `routes/orders/index.ts` is extended to call into `modules/restaurant/orders/` rather than containing pricing logic directly (closes AUDIT issue #3).
- Future consolidation (e.g. moving `services/kb/` under a `modules/` tree) is out of scope here — revisit only if it becomes a real navigation problem.
