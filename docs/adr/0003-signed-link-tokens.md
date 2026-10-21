# ADR 0003: Signed, expiring tokens for ordering and tracking links

## Status
Accepted

## Context
Brief §8.4 and §8.8 require the public ordering page (`/o/{tenantSlug}/{branchSlug}?t={token}`) and tracking page (`/t/{orderRef}?k={key}`) to carry signed, expiring tokens — the ordering token encodes tenant/branch/contact/conversation/fulfilment-type/address-id and expires (default 60 min, tenant-configurable); the tracking key is a longer-lived, narrower-scoped credential for a single order.

## Decision
Use **`jose`** (already on the brief's preferred-library list, §0A.2) to issue signed JWTs for both link types, verified server-side on every request to `/o/*` and `/t/*`:

- Ordering token: short expiry (default 60 min), HMAC-signed (`HS256`) with a platform-held secret, claims = `{tenantId, branchId, contactId, conversationId, fulfilmentType, addressId?, exp}`.
- Tracking key: longer expiry (order lifetime + a grace window), scoped to a single `orderId`, no contact/conversation claims — safe to share in a WhatsApp message without re-exposing conversation context.

Both expiry windows are tenant-configurable within platform-set min/max limits (brief §11's "Web link token expiry" row).

## Consequences
- No session/cookie state needed for either public page — the token is the entire auth context, matching how WhatsApp delivers one-shot links.
- Token verification failures (expired/tampered) must render a friendly "link expired, get a new one" state (brief §8.4), not a generic error.
- Rotating the signing secret invalidates all outstanding links — document the rotation procedure in `docs/SETUP.md`/`docs/RUNBOOK.md` (brief §17's "secrets rotation procedure").
