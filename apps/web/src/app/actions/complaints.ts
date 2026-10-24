'use server';

import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { getSession }             from '@/lib/session';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { revalidatePath }         from 'next/cache';

export type ComplaintStatus = 'open' | 'in_progress' | 'resolved' | 'rejected';
export type ComplaintCategory = 'wrong_item' | 'missing_item' | 'quality' | 'late' | 'other';
export type ResolutionType = 'refund' | 'coupon' | 'redeliver' | 'none';

export interface ComplaintRow {
  id:               string;
  category:         ComplaintCategory;
  description:       string | null;
  status:            ComplaintStatus;
  resolution_type:   ResolutionType | null;
  resolution_notes:  string | null;
  sla_due_at:        string;
  created_at:        string;
  contact: { name: string | null; phone: string } | null;
  order:   { order_ref: string } | null;
}

/** CMP-02: full complaint queue for the dashboard — read-only, no WhatsApp side effect, so this reads Supabase directly rather than going through apps/api. */
export async function getComplaintsAction(): Promise<{ complaints: ComplaintRow[]; error?: string }> {
  const session = await getSession();
  if (!session) return { complaints: [], error: 'Unauthorized' };

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from('complaints')
    .select('id, category, description, status, resolution_type, resolution_notes, sla_due_at, created_at, contact:contacts(name, phone), order:orders(order_ref)')
    .eq('tenant_id', session.tenantId)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) return { complaints: [], error: error.message };
  return { complaints: (data ?? []) as unknown as ComplaintRow[] };
}

/**
 * CMP-03: resolve a complaint. Routed through apps/api (not a direct
 * Supabase write) because resolving sends the customer a WhatsApp message —
 * same reasoning as app/actions/orders.ts's updateOrderStatusAction.
 */
export async function resolveComplaintAction(
  id:               string,
  resolutionType:   ResolutionType,
  resolutionNotes?: string,
): Promise<{ error?: string }> {
  if (!id) return { error: 'Missing id' };

  const apiBase = process.env['NEXT_PUBLIC_API_URL'] ?? '';
  if (!apiBase) return { error: 'API URL not configured' };

  const supabase = await getSupabaseServerClient();
  const { data: { session: authSession } } = await supabase.auth.getSession();
  if (!authSession) return { error: 'Not authenticated' };

  try {
    const res = await fetch(`${apiBase}/api/complaints/${id}/resolve`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authSession.access_token}` },
      body: JSON.stringify({ resolutionType, resolutionNotes }),
    });

    const data = await res.json() as { error?: string };
    if (!res.ok || data.error) return { error: data.error ?? 'Failed to resolve complaint' };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Network error' };
  }

  revalidatePath('/complaints');
  return {};
}
