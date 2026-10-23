import type { getServerClient } from '@alphabot/database';
import { WhatsAppGateway } from '../services/whatsapp/gateway.js';
import { resolveNumberForRole } from './number-roles.js';

type Db = ReturnType<typeof getServerClient>;

/**
 * ORD-07: sends a one-time feedback prompt once an order is marked
 * delivered/collected (TKW-04). Parity with lib/booking-feedback.ts.
 */
export async function sendDueOrderFeedbackPrompts(db: Db, log: { warn: (o: unknown, m: string) => void }): Promise<void> {
  const { data: candidates } = await db
    .from('orders')
    .select('id, tenant_id, contact_id, order_ref, contact:contacts(phone)')
    .eq('status', 'delivered')
    .in('source', ['whatsapp_bot', 'weblink'])
    .is('feedback_requested_at', null);

  for (const row of candidates ?? []) {
    try {
      const contact = row.contact as unknown as { phone: string } | { phone: string }[] | null;
      const phone = (Array.isArray(contact) ? contact[0]?.phone : contact?.phone) ?? null;
      if (!phone) continue;

      const wn = await resolveNumberForRole(db, row.tenant_id, 'restaurant_bot', 'customer');
      if (!wn) continue;

      const gateway = new WhatsAppGateway(wn.provider as 'meta_cloud' | 'twilio' | 'interakt' | 'wati' | 'gupshup');
      await gateway.sendMessage(wn.phone_number_id, wn.access_token, {
        type:            'interactive',
        interactiveType: 'list',
        to:              phone,
        body:            `Thanks for your order${row.order_ref ? ` (${row.order_ref})` : ''}! How was it?`,
        listButtonLabel: 'Rate your order',
        listSections: [{
          title: 'Rate 1-5',
          rows: [1, 2, 3, 4, 5].map(n => ({
            id:    `ordfb:${row.id}:${n}`,
            title: '⭐'.repeat(n),
          })),
        }],
      });

      await db.from('orders').update({ feedback_requested_at: new Date().toISOString() }).eq('id', row.id);
    } catch (err) {
      log.warn({ orderId: row.id, err }, '[OrderFeedback] failed to send prompt for one order — continuing');
    }
  }
}
