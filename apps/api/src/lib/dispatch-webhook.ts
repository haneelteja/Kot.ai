import { createHmac } from 'crypto';
import { getServerClient } from '@alphabot/database';
import { isUrlSafeForOutbound } from './webhook-security.js';

export type OutboundWebhookEvent = 'order.created' | 'order.paid' | 'order.status_changed';

const DELIVERY_TIMEOUT_MS = 8000;

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

async function deliverOne(
  db: ReturnType<typeof getServerClient>,
  webhook: { id: string; url: string; secret: string },
  eventType: string,
  payload: string,
): Promise<void> {
  const startedAt = Date.now();
  const safety = await isUrlSafeForOutbound(webhook.url);

  if (!safety.safe) {
    await logDelivery(db, webhook.id, eventType, { errorMessage: `blocked by SSRF guard: ${safety.error}` });
    return;
  }

  const signature = createHmac('sha256', webhook.secret).update(payload).digest('hex');

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
    await logDelivery(db, webhook.id, eventType, {
      statusCode:     res.status,
      responseTimeMs: Date.now() - startedAt,
      responseBody:   responseBody.slice(0, 2000),
    });
  } catch (err) {
    await logDelivery(db, webhook.id, eventType, {
      responseTimeMs: Date.now() - startedAt,
      errorMessage:   err instanceof Error ? err.message : String(err),
    });
  }
}

async function logDelivery(
  db: ReturnType<typeof getServerClient>,
  webhookId: string,
  eventType: string,
  fields: { statusCode?: number; responseTimeMs?: number; responseBody?: string; errorMessage?: string },
): Promise<void> {
  await db.from('outbound_webhook_deliveries').insert({
    webhook_id:       webhookId,
    event_type:       eventType,
    status_code:      fields.statusCode ?? null,
    response_time_ms: fields.responseTimeMs ?? null,
    response_body:    fields.responseBody ?? null,
    error_message:    fields.errorMessage?.slice(0, 2000) ?? null,
  }).then(() => {}, () => {});
}
