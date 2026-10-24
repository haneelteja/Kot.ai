'use server';

import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { getSession } from '@/lib/session';

export interface CustomerRow {
  id:              string;
  name:            string | null;
  phone:           string | null;
  created_at:      string;
  order_count:     number;
  total_spend:     number; // rupees
  last_order_at:   string | null;
  marketing_optin: boolean;
}

/**
 * DSH-11: customer list with order count/spend/last order/opt-in status.
 * No per-contact `addresses` field exists in this schema (pickup-only flow,
 * no delivery addresses yet — same gap noted for PRV-02), so that column
 * from the brief's acceptance criteria has nothing to show today.
 *
 * Aggregates orders/consents in JS rather than a DB-side GROUP BY (no RPC
 * for this exists, and current tenant data volumes are small) — same
 * pattern this session's other list screens already use.
 */
export async function getCustomersAction(): Promise<{ customers: CustomerRow[]; error?: string }> {
  const session = await getSession();
  if (!session) return { customers: [], error: 'Unauthorized' };

  const admin = getSupabaseAdminClient();
  const tenantId = session.tenantId;

  const [{ data: contacts, error: contactsErr }, { data: orders }, { data: consents }] = await Promise.all([
    admin.from('contacts').select('id, name, phone, created_at').eq('tenant_id', tenantId)
      .order('created_at', { ascending: false }).limit(200),
    admin.from('orders').select('contact_id, total, status, created_at').eq('tenant_id', tenantId),
    admin.from('consents').select('contact_id, action, created_at').eq('tenant_id', tenantId).eq('purpose', 'marketing')
      .order('created_at', { ascending: false }),
  ]);

  if (contactsErr) return { customers: [], error: contactsErr.message };

  const orderAgg = new Map<string, { count: number; spend: number; lastAt: string | null }>();
  for (const o of (orders ?? []) as Array<{ contact_id: string; total: number; status: string; created_at: string }>) {
    const agg = orderAgg.get(o.contact_id) ?? { count: 0, spend: 0, lastAt: null };
    agg.count += 1;
    if (o.status !== 'cancelled') agg.spend += Number(o.total) || 0;
    if (!agg.lastAt || o.created_at > agg.lastAt) agg.lastAt = o.created_at;
    orderAgg.set(o.contact_id, agg);
  }

  const optinByContact = new Map<string, boolean>();
  for (const c of (consents ?? []) as Array<{ contact_id: string; action: string }>) {
    if (!optinByContact.has(c.contact_id)) optinByContact.set(c.contact_id, c.action === 'opt_in');
  }

  const customers: CustomerRow[] = ((contacts ?? []) as Array<{ id: string; name: string | null; phone: string | null; created_at: string }>)
    .map(c => {
      const agg = orderAgg.get(c.id);
      return {
        id:              c.id,
        name:            c.name,
        phone:           c.phone,
        created_at:      c.created_at,
        order_count:     agg?.count ?? 0,
        total_spend:     agg?.spend ?? 0,
        last_order_at:   agg?.lastAt ?? null,
        marketing_optin: optinByContact.get(c.id) ?? false,
      };
    });

  return { customers };
}
