import type { getServerClient } from '@alphabot/database';
import { WhatsAppGateway } from '../services/whatsapp/gateway.js';
import { resolveNumberForRole } from './number-roles.js';

type Db = ReturnType<typeof getServerClient>;

const STUCK_THRESHOLD_MS = 25 * 60 * 1000; // FUL-02 default: 25 minutes after auto-accept

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
      const [opsWn, settingsRes] = await Promise.all([
        resolveNumberForRole(db, order.tenant_id, 'restaurant_bot', 'ops'),
        db.from('tenant_notification_settings').select('lead_notification_wa_numbers').eq('tenant_id', order.tenant_id).maybeSingle(),
      ]);
      const ownerNumbers = (settingsRes.data?.lead_notification_wa_numbers as string[] | null) ?? [];

      if (opsWn && ownerNumbers.length > 0) {
        const gateway = new WhatsAppGateway(opsWn.provider as 'meta_cloud' | 'twilio' | 'interakt' | 'wati' | 'gupshup');
        const text = `⏱️ Order ${order.order_ref ?? order.id} is 25 minutes old and not yet marked Ready.`;
        await Promise.allSettled(
          ownerNumbers.map(number =>
            gateway.sendMessage(opsWn.phone_number_id, opsWn.access_token, { type: 'text', to: number, text })
          ),
        );
      }

      await db.from('orders').update({ stuck_alert_sent_at: new Date().toISOString() }).eq('id', order.id);
    } catch (err) {
      log.warn({ orderId: order.id, err }, '[FUL-02] stuck-order alert failed for one order — continuing');
    }
  }
}
