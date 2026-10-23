import type { getServerClient } from '@alphabot/database';

type Db = ReturnType<typeof getServerClient>;

export interface BookingRow {
  id:          string;
  partySize:   number;
  bookingDate: string;
  bookingTime: string;
}

export type CreateBookingResult =
  | { ok: true; booking: BookingRow }
  | { ok: false; error: 'invalid_input' | 'create_failed' };

/**
 * Capture-and-notify-staff only — no availability/capacity checking
 * (confirmed decision). Validation here is deliberately minimal since the
 * `bookings` table's own CHECK constraints (party_size 1-50, valid date/time
 * types) are the actual guarantee; this just rejects obviously-missing input
 * before hitting the DB.
 */
export async function createBooking(
  db:             Db,
  tenantId:       string,
  contactId:      string,
  conversationId: string,
  partySize:      number,
  bookingDate:    string,
  bookingTime:    string,
): Promise<CreateBookingResult> {
  if (!Number.isFinite(partySize) || partySize <= 0 || partySize > 50) {
    return { ok: false, error: 'invalid_input' };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(bookingDate) || !/^\d{1,2}:\d{2}(:\d{2})?$/.test(bookingTime)) {
    return { ok: false, error: 'invalid_input' };
  }

  const { data, error } = await db
    .from('bookings')
    .insert({
      tenant_id:       tenantId,
      contact_id:      contactId,
      conversation_id: conversationId,
      party_size:      partySize,
      booking_date:    bookingDate,
      booking_time:    bookingTime,
    })
    .select('id')
    .single();

  if (error || !data) return { ok: false, error: 'create_failed' };

  return {
    ok: true,
    booking: { id: (data as { id: string }).id, partySize, bookingDate, bookingTime },
  };
}

export type CreateBookingFeedbackResult =
  | { ok: true; rating: number }
  | { ok: false; error: 'invalid_rating' | 'already_submitted' | 'create_failed' };

/** BKG-07: records the customer's reply to the post-dining feedback prompt. */
export async function createBookingFeedback(
  db:        Db,
  tenantId:  string,
  bookingId: string,
  contactId: string,
  rating:    number,
): Promise<CreateBookingFeedbackResult> {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { ok: false, error: 'invalid_rating' };
  }

  const { error } = await db
    .from('booking_feedback')
    .insert({ tenant_id: tenantId, booking_id: bookingId, contact_id: contactId, rating });

  if (error) {
    return error.code === '23505' // unique_violation on booking_id — already rated
      ? { ok: false, error: 'already_submitted' }
      : { ok: false, error: 'create_failed' };
  }

  return { ok: true, rating };
}
