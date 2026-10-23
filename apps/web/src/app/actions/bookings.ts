'use server';

import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { getSession }             from '@/lib/session';
import { revalidatePath }         from 'next/cache';

export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'seated' | 'no_show';

export interface BookingRow {
  id:           string;
  party_size:   number;
  booking_date: string;
  booking_time: string;
  status:       BookingStatus;
  notes:        string | null;
  created_at:   string;
  contact: { name: string | null; phone: string } | null;
}

/** BKG-06: upcoming/recent bookings for the dashboard list — no calendar/day view (not built), just a flat list ordered by date. */
export async function getBookingsAction(): Promise<{ bookings: BookingRow[]; error?: string }> {
  const session = await getSession();
  if (!session) return { bookings: [], error: 'Unauthorized' };

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from('bookings')
    .select('id, party_size, booking_date, booking_time, status, notes, created_at, contact:contacts(name, phone)')
    .eq('tenant_id', session.tenantId)
    .order('booking_date', { ascending: false })
    .order('booking_time', { ascending: false })
    .limit(200);

  if (error) return { bookings: [], error: error.message };
  return { bookings: (data ?? []) as unknown as BookingRow[] };
}

/**
 * BKG-06: seated/no-show only — no confirm/decline action here, since
 * BKG-03's staff-confirm mode isn't built (this project captures and
 * notifies staff only, with no availability/capacity model, per an
 * earlier confirmed decision this session).
 */
export async function updateBookingStatusAction(
  id:     string,
  status: Extract<BookingStatus, 'seated' | 'no_show' | 'cancelled'>,
): Promise<{ error?: string }> {
  if (!id) return { error: 'Missing id' };

  const session = await getSession();
  if (!session) return { error: 'Unauthorized' };

  const admin = getSupabaseAdminClient();
  const { error } = await admin
    .from('bookings')
    .update({ status })
    .eq('id', id)
    .eq('tenant_id', session.tenantId);

  if (error) return { error: error.message };

  revalidatePath('/bookings');
  return {};
}
