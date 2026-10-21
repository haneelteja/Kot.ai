# ADR 0001: Durable queue for inbound/payment/POS/delivery processing

## Status
Accepted

## Context
The pruned Alphabot webhook handler sends a 200 ack to Meta and then processes the message in-process, in the same request lifecycle, with no durable job handoff (`docs/AUDIT.md` issue #6). Redis is already present in the stack but unused for queueing. KOT.ai adds payment, POS, and delivery webhooks on top of WhatsApp — all of which need the same durability guarantee: a crash between the ack and the handler finishing must not silently drop an order event.

## Decision
Use **BullMQ on the existing Redis instance** for all four event sources (inbound WhatsApp, Easebuzz payment events, Petpooja/manual POS events, delivery partner events), rather than a Postgres-backed queue.

Reasoning:
- Redis is already provisioned and used for rate-limiting and job locks (`lib/redis.ts`, `withJobLock`) — no new infrastructure.
- `bullmq` + `@bull-board/api` are already on the brief's preferred-library list (§0A.2) and pair with the existing Redis setup.
- A Postgres-backed queue would add write load to the primary database for a high-frequency, low-value-per-row workload (webhook events), where Redis is a better fit.
- BullMQ's built-in retry/backoff and dead-letter handling map directly to the platform console's "integration health & logs" screen (brief §13).

## Consequences
- `webhook_events` (Postgres) still stores the raw payload + `external_id` for idempotency and audit — BullMQ is the processing queue, not the system of record.
- Redis becoming unavailable degrades queueing; the health check (`/health`) must report Redis status (already partially done) and alert (OBS epic).
- Bull Board is exposed behind platform-admin auth only (brief §20.2).
