import type { getServerClient } from '@alphabot/database';
import { WhatsAppGateway } from '../services/whatsapp/gateway.js';
import { resolveNumberForRole } from './number-roles.js';

type Db = ReturnType<typeof getServerClient>;

const REMINDER_OFFSET_MS = 10 * 60 * 1000; // PAY-02 default: 10 minutes before expiry

/**
 * PAY-02 (revised): a single reminder near expiry, then the draft closes —
 * no `orders` row is ever created for an unpaid draft (ORD-02). Only
 * whatsapp_bot drafts get a reminder message; weblink drafts have no chat
 * to remind in.
 */
export async function processCheckoutDraftReminders(db: Db, log: { warn: (o: unknown, m: string) => void }): Promise<void> {
  const now = new Date();
  const reminderCutoff = new Date(now.getTime() + REMINDER_OFFSET_MS).toISOString();

  const { data: dueForReminder } = await db
    .from('checkout_drafts')
    .select('id, tenant_id, contact_id, link_url, total_paise')
    .eq('status', 'awaiting_payment')
    .eq('source', 'whatsapp_bot')
    .is('reminder_sent_at', null)
    .lte('expires_at', reminderCutoff);

  for (const draft of dueForReminder ?? []) {
    try {
      const [contactRes, wn] = await Promise.all([
        db.from('contacts').select('phone').eq('id', draft.contact_id).single(),
        resolveNumberForRole(db, draft.tenant_id, 'restaurant_bot', 'customer'),
      ]);
      const phone = contactRes.data?.phone as string | undefined;

      if (wn && phone && draft.link_url) {
        const gateway = new WhatsAppGateway(wn.provider as 'meta_cloud' | 'twilio' | 'interakt' | 'wati' | 'gupshup');
        const text = `Your order is waiting. Pay ₹${((draft.total_paise as number) / 100).toFixed(2)} here to confirm it:\n${draft.link_url}`;
        await gateway.sendMessage(wn.phone_number_id, wn.access_token, { type: 'text', to: phone, text });
      }

      await db.from('checkout_drafts').update({ reminder_sent_at: new Date().toISOString() }).eq('id', draft.id);
    } catch (err) {
      log.warn({ draftId: draft.id, err }, '[PAY-02] reminder failed for one draft — continuing');
    }
  }

  // Close expired drafts — no order is ever created for these.
  await db.from('checkout_drafts')
    .update({ status: 'expired' })
    .eq('status', 'awaiting_payment')
    .lte('expires_at', now.toISOString());
}
