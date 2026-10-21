# KOT.ai — Runbook

Incident response and operational procedures. Pairs with `docs/SETUP.md` (getting a working environment) and `docs/OBS` alert definitions (OBS epic, written once alerting exists in Phase 13).

## General triage

1. Check `/health` on the API (`{status, checks: {database, redis}}`).
2. Check Sentry for the error's first occurrence and frequency.
3. Check `git log` on `master` for anything deployed around the same time.
4. If customer-facing (WhatsApp replies broken, payments stuck), post a status update before deep-diving — visibility first, root cause second.

## Common incidents (filled in as each system goes live)

### API won't start
- Check Render build logs first — `npm ci` strict-install failures usually mean `package-lock.json` is out of sync with a `package.json` change that wasn't committed together.
- Check required env vars are set (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY` at minimum — see `.env.example`).

### `/health` reports `database: error`
- Supabase project may be paused (free tier pauses after inactivity) — the scheduler's keep-alive ping (`jobs/scheduler.ts`) should prevent this in normal operation; if it still happened, check the scheduler is actually running (look for `[KeepAlive]` log lines).
- Check `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` haven't rotated without updating the deployed env.

### `/health` reports `redis: error` or `not_configured`
- Non-fatal by design — rate limiting falls back to in-memory and the queue (once QUE-01 lands) can't process jobs. Check `REDIS_URL` and that the Redis instance is reachable from Render's network.

### WhatsApp messages not arriving / not being replied to
- Confirm the Meta webhook is still subscribed (Meta App Dashboard → WhatsApp → Configuration) and the callback URL matches the current API URL.
- Check for `[Webhook]` error logs around the timestamp of the missed message.
- Once SEC-01 (signature verification) lands: a sudden spike in 401s on the webhook route means either a misconfigured `META_APP_SECRET` after rotation, or Meta changed something — check both before assuming an attack.

### Payment stuck in `pending`
- The reconciliation job (PAY-05, Phase 6) polls Easebuzz's transaction status API — check it's running on schedule.
- Manually check the transaction in the Easebuzz merchant dashboard as a cross-reference before taking any customer-facing action.

### Queue backing up (once QUE-01/Bull Board exist)
- Open Bull Board (platform-admin only route) to see depth/age per queue.
- Check Redis memory/connection limits haven't been hit.
- Dead-letter entries can be replayed from the platform console (QUE-03) once built — don't manually re-fire webhooks from provider dashboards unless you've confirmed idempotency (QUE-02) is working, to avoid double-processing.

## Secrets rotation

| Secret | Rotation impact | Procedure |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | API/workers lose DB access until updated | Rotate in Supabase dashboard → update Render env var → redeploy |
| `META_APP_SECRET` | Webhook signature verification starts rejecting everything (once SEC-01 lands) until updated everywhere | Rotate in Meta App Dashboard → update API env var → redeploy; do this during a low-traffic window |
| Easebuzz per-tenant credentials | That tenant's payment links stop working until updated | Tenant updates via dashboard Settings → Payments (once PAY-01/SEC-02 land); platform can force-expire a tenant's cached credentials via the platform console |
| Signed-link signing secret (ADR 0003) | All outstanding ordering/tracking links become invalid immediately | Only rotate if compromised — this breaks every in-flight order/tracking link. Communicate to active tenants before rotating if possible |

## Go-live checklist (pilot)

See brief §21 "Go-live checklist (pilot)" / `docs/BACKLOG.md`'s DEP-05 for the authoritative checklist. Do not skip the real ₹1–10 payment + refund test — it's the only way to catch a credential or hash-verification mistake before a real customer does.

## Rollback

- API/workers: Render keeps previous deploys — use "Rollback to previous deploy" in the Render dashboard.
- Web: Vercel keeps every deployment immutable — promote a previous deployment to production from the Vercel dashboard.
- Database: migrations are additive-only by convention in this repo (no destructive migrations without a separate backup step) — if a migration needs reverting, write a new migration that undoes it rather than editing history.
