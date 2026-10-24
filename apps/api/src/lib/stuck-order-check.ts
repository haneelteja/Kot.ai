import type { getServerClient } from '@alphabot/database';
import { WhatsAppGateway } from '../services/whatsapp/gateway.js';
import { resolveNumberForRole } from './number-roles.js';

type Db = ReturnType<typeof getServerClient>;

const STUCK_THRESHOLD_MS      = 25 * 60 * 1000; // FUL-02 default: 25 minutes after auto-accept
const UNCOLLECTED_THRESHOLD_MS = 45 * 60 * 1000; // TKW-03 default: 45 minutes after Ready

interface AlertButton {
  id:    string;
  title: string;
}

/** OWN-01: plain-text alert when no buttons are given, an interactive button alert otherwise — same recipient-resolution either way. */
async function alertOwner(db: Db, tenantId: string, text: string, buttons?: AlertButton[]): Promise<void> {
  const [opsWn, settingsRes] = await Promise.all([
    resolveNumberForRole(db, tenantId, 'restaurant_bot', 'ops'),
    db.from('tenant_notification_settings').select('lead_notification_wa_numbers').eq('tenant_id', tenantId).maybeSingle(),
  ]);
  const ownerNumbers = (settingsRes.data?.lead_notification_wa_numbers as string[] | null) ?? [];
  if (!opsWn || ownerNumbers.length === 0) return;

  const gateway = new WhatsAppGateway(opsWn.provider as 'meta_cloud' | 'twilio' | 'interakt' | 'wati' | 'gupshup');
  await Promise.allSettled(
    ownerNumbers.map(number =>
      buttons && buttons.length > 0
        ? gateway.sendMessage(opsWn.phone_number_id, opsWn.access_token, {
            type: 'interactive', interactiveType: 'button', to: number, body: text,
            buttons: buttons.map(b => ({ type: 'reply' as const, reply: { id: b.id, title: b.title } })),
          })
        : gateway.sendMessage(opsWn.phone_number_id, opsWn.access_token, { type: 'text', to: number, text })
    ),
  );
}

/**
 * FUL-02: alerts the owner once if a restaurant order is still 'preparing'
 * (never marked Ready by the kitchen) 25 minutes after auto-accepting.
 * One alert per order, guarded by orders.stuck_alert_sent_at.
 */
export async function checkStuckOrders(db: Db, log: { warn: (o: unknown, m: string) => void }): Promise<void> {
  const cutoff = new Date(Date.now() - STUCK_THRESHOLD_MS).toISOString();

  const { data: stuck } = await db
    .from('orders')
    .select('id, tenant_id, order_ref, accepted_at')
    .eq('status', 'preparing')
    .in('source', ['whatsapp_bot', 'weblink'])
    .is('stuck_alert_sent_at', null)
    .lte('accepted_at', cutoff);

  for (const order of stuck ?? []) {
    try {
      await alertOwner(
        db, order.tenant_id,
        `⏱️ Order ${order.order_ref ?? order.id} is 25 minutes old and not yet marked Ready.`,
        [{ id: `own_mark_ready:${order.id}`, title: 'Mark Ready' }],
      );
      await db.from('orders').update({ stuck_alert_sent_at: new Date().toISOString() }).eq('id', order.id);
    } catch (err) {
      log.warn({ orderId: order.id, err }, '[FUL-02] stuck-order alert failed for one order — continuing');
    }
  }
}

/**
 * TKW-03: alerts the owner once if a Ready order sits uncollected for 45
 * minutes. One alert per order, guarded by orders.uncollected_alert_sent_at.
 */
export async function checkUncollectedOrders(db: Db, log: { warn: (o: unknown, m: string) => void }): Promise<void> {
  const cutoff = new Date(Date.now() - UNCOLLECTED_THRESHOLD_MS).toISOString();

  const { data: uncollected } = await db
    .from('orders')
    .select('id, tenant_id, order_ref, ready_at')
    .eq('status', 'ready')
    .in('source', ['whatsapp_bot', 'weblink'])
    .is('uncollected_alert_sent_at', null)
    .lte('ready_at', cutoff);

  for (const order of uncollected ?? []) {
    try {
      await alertOwner(
        db, order.tenant_id,
        `🧍 Order ${order.order_ref ?? order.id} has been ready for 45 minutes and hasn't been collected.`,
        [{ id: `own_mark_collected:${order.id}`, title: 'Mark Collected' }],
      );
      await db.from('orders').update({ uncollected_alert_sent_at: new Date().toISOString() }).eq('id', order.id);
    } catch (err) {
      log.warn({ orderId: order.id, err }, '[TKW-03] uncollected-order alert failed for one order — continuing');
    }
  }
}
