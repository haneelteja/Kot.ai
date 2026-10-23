import type { getServerClient } from '@alphabot/database';
import { WhatsAppGateway } from '../services/whatsapp/gateway.js';
import { resolveNumberForRole } from './number-roles.js';

type Db = ReturnType<typeof getServerClient>;

const DINING_WINDOW_MARGIN_MS = 2 * 60 * 60 * 1000; // assume dining is over 2h after the booked time

/**
 * BKG-07: finds confirmed bookings whose dining window has passed and sends
 * a one-time feedback prompt. Time-based stand-in for the "seated" trigger
 * BKG-06 would normally provide (not built yet). Called on a schedule from
 * jobs/scheduler.ts.
 */
export async function sendDueBookingFeedbackPrompts(db: Db, log: { warn: (o: unknown, m: string) => void }): Promise<void> {
  const cutoff = new Date(Date.now() - DINING_WINDOW_MARGIN_MS);
  const cutoffDate = cutoff.toISOString().slice(0, 10);

  // Coarse DB-side filter (booking_date on or before the cutoff date), then
  // an exact date+time check in JS — avoids needing a Postgres function to
  // combine the two columns for comparison.
  // No BKG-03 (auto/staff-confirm) exists yet, so every booking stays
  // 'pending' indefinitely today — only 'cancelled' is reachable besides
  // that. Treat 'pending' as "happened" too, or this would never fire.
  const { data: candidates } = await db
    .from('bookings')
    .select('id, tenant_id, contact_id, booking_date, booking_time, conversations(product_type)')
    .in('status', ['pending', 'confirmed'])
    .is('feedback_requested_at', null)
    .lte('booking_date', cutoffDate);

  for (const row of candidates ?? []) {
    try {
      const diningAt = new Date(`${row.booking_date}T${row.booking_time}`);
      if (diningAt > cutoff) continue;

      const conv = row.conversations as unknown as { product_type: string } | { product_type: string }[] | null;
      const productSlug = (Array.isArray(conv) ? conv[0]?.product_type : conv?.product_type) ?? 'restaurant_bot';

      const [contactRes, wn] = await Promise.all([
        db.from('contacts').select('phone').eq('id', row.contact_id).single(),
        resolveNumberForRole(db, row.tenant_id, productSlug, 'customer'),
      ]);

      const phone = contactRes.data?.phone as string | undefined;
      if (!phone || !wn) continue;

      const gateway = new WhatsAppGateway(wn.provider as 'meta_cloud' | 'twilio' | 'interakt' | 'wati' | 'gupshup');
      await gateway.sendMessage(wn.phone_number_id, wn.access_token, {
        type:            'interactive',
        interactiveType: 'list',
        to:              phone,
        body:            'Thanks for dining with us! How was your evening?',
        listButtonLabel: 'Rate your visit',
        listSections: [{
          title: 'Rate 1-5',
          rows: [1, 2, 3, 4, 5].map(n => ({
            id:    `bkgfb:${row.id}:${n}`,
            title: '⭐'.repeat(n),
          })),
        }],
      });

      await db.from('bookings').update({ feedback_requested_at: new Date().toISOString() }).eq('id', row.id);
    } catch (err) {
      log.warn({ bookingId: row.id, err }, '[BookingFeedback] failed to send prompt for one booking — continuing');
    }
  }
}
