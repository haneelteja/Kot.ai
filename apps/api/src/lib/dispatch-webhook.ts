import { createHmac } from 'crypto';
import { getServerClient } from '@alphabot/database';
import { isUrlSafeForOutbound } from './webhook-security.js';

export type OutboundWebhookEvent = 'order.created' | 'order.paid' | 'order.status_changed';

const DELIVERY_TIMEOUT_MS = 8000;
const MAX_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [5000, 20000]; // delay before attempt 2 and attempt 3

/**
 * Fire-and-forget outbound webhook dispatch. Looks up active webhooks the
 * tenant configured for this event type, verifies the target is safe (SSRF
 * guard — re-checked per delivery, not just at config-save time), signs the
 * payload, and logs the outcome. Never throws into the caller.
 */
export function dispatchWebhook(tenantId: string, eventType: OutboundWebhookEvent, data: Record<string, unknown>): void {
  void deliver(tenantId, eventType, data).catch(() => {});
}

async function deliver(tenantId: string, eventType: OutboundWebhookEvent, data: Record<string, unknown>): Promise<void> {
  const db = getServerClient();
  const { data: webhooks } = await db
    .from('outbound_webhooks')
    .select('id, url, event_types, secret')
    .eq('tenant_id', tenantId)
    .eq('active', true);

  type Row = { id: string; url: string; event_types: string[]; secret: string };
  const targets = ((webhooks ?? []) as Row[]).filter(w => w.event_types.includes(eventType));
  if (targets.length === 0) return;

  const payload = JSON.stringify({ event: eventType, tenant_id: tenantId, data, timestamp: new Date().toISOString() });

  await Promise.all(targets.map(webhook => deliverOne(db, webhook, eventType, payload)));
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * SSRF-checked, signed, bounded-retry delivery of one webhook. A transient
 * failure (network error, timeout, non-2xx) is retried with backoff up to
 * MAX_ATTEMPTS before being logged as a dead final attempt — a single
 * blip on the tenant's endpoint no longer drops the event entirely.
 */
async function deliverOne(
  db: ReturnType<typeof getServerClient>,
  webhook: { id: string; url: string; secret: string },
  eventType: string,
  payload: string,
): Promise<void> {
  const signature = createHmac('sha256', webhook.secret).update(payload).digest('hex');

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (attempt > 1) await sleep(RETRY_DELAYS_MS[attempt - 2]!);

    const startedAt = Date.now();
    // Re-checked on every attempt, not cached from the first — DNS can change
    // between attempts (rebinding), so a pass on attempt 1 doesn't carry over.
    const safety = await isUrlSafeForOutbound(webhook.url);

    if (!safety.safe) {
      await logDelivery(db, webhook.id, eventType, attempt, { errorMessage: `blocked by SSRF guard: ${safety.error}` });
      return; // not a transient failure — retrying won't help
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);
      let res: Response;
      try {
        res = await fetch(webhook.url, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', 'X-KOTAI-Signature': `sha256=${signature}` },
          body:    payload,
          signal:  controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }

      const responseBody = await res.text().catch(() => '');
      const succeeded = res.status < 300;
      await logDelivery(db, webhook.id, eventType, attempt, {
        statusCode:     res.status,
        responseTimeMs: Date.now() - startedAt,
        responseBody:   responseBody.slice(0, 2000),
      });
      if (succeeded || attempt === MAX_ATTEMPTS) return;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      await logDelivery(db, webhook.id, eventType, attempt, { responseTimeMs: Date.now() - startedAt, errorMessage });
      if (attempt === MAX_ATTEMPTS) return;
    }
  }
}

async function logDelivery(
  db: ReturnType<typeof getServerClient>,
  webhookId: string,
  eventType: string,
  attempt: number,
  fields: { statusCode?: number; responseTimeMs?: number; responseBody?: string; errorMessage?: string },
): Promise<void> {
  await db.from('outbound_webhook_deliveries').insert({
    webhook_id:       webhookId,
    event_type:       eventType,
    attempt,
    status_code:      fields.statusCode ?? null,
    response_time_ms: fields.responseTimeMs ?? null,
    response_body:    fields.responseBody ?? null,
    error_message:    fields.errorMessage?.slice(0, 2000) ?? null,
  }).then(() => {}, () => {});
}
