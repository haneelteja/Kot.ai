'use server';

import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { getSession } from '@/lib/session';

export interface TodaySummary {
  gmv:                    number; // rupees
  ordersByStatus:         Record<string, number>;
  bookingsToday:          number;
  openComplaints:         number;
  overdueComplaints:      number;
  stuckOrders:            number;
  uncollectedOrders:      number;
  abandonedCheckoutValue: number; // rupees
  abandonedCheckoutCount: number;
  orderingPaused:         boolean;
  orderingPausedUntil:    string | null;
}

/** IST midnight (today), returned as a UTC ISO timestamp — this platform has no per-tenant timezone setting, and IST is the practical default (brief/₹ context). */
function startOfTodayUtcForIst(): string {
  const now = new Date();
  const istNow = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  const y = istNow.getUTCFullYear(), m = istNow.getUTCMonth(), d = istNow.getUTCDate();
  const istMidnightUtcMs = Date.UTC(y, m, d, 0, 0, 0) - 5.5 * 60 * 60 * 1000;
  return new Date(istMidnightUtcMs).toISOString();
}

function todayDateIst(): string {
  const now = new Date();
  return new Date(now.getTime() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** DSH-01: "Today" at-a-glance summary — GMV, orders by status, bookings, a needs-attention list, and abandoned-checkout value. */
export async function getTodaySummaryAction(): Promise<{ summary?: TodaySummary; error?: string }> {
  const session = await getSession();
  if (!session) return { error: 'Unauthorized' };

  const admin     = getSupabaseAdminClient();
  const tenantId  = session.tenantId;
  const sinceIso  = startOfTodayUtcForIst();
  const todayDate = todayDateIst();

  const [
    { data: orders },
    { count: bookingsCount },
    { data: complaints },
    { data: drafts },
    { data: tenantRow },
  ] = await Promise.all([
    admin.from('orders').select('status, total').eq('tenant_id', tenantId).gte('created_at', sinceIso),
    admin.from('bookings').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('booking_date', todayDate),
    admin.from('complaints').select('status, sla_due_at').eq('tenant_id', tenantId).in('status', ['open', 'in_progress']),
    admin.from('checkout_drafts').select('total_paise').eq('tenant_id', tenantId).gte('created_at', sinceIso).neq('status', 'paid'),
    admin.from('tenants').select('ordering_paused_until').eq('id', tenantId).single(),
  ]);

  const pausedUntilRaw = (tenantRow as { ordering_paused_until: string | null } | null)?.ordering_paused_until ?? null;
  const orderingPaused = pausedUntilRaw !== null && new Date(pausedUntilRaw).getTime() > Date.now();

  const ordersByStatus: Record<string, number> = {};
  let gmv = 0;
  for (const o of (orders ?? []) as Array<{ status: string; total: number }>) {
    ordersByStatus[o.status] = (ordersByStatus[o.status] ?? 0) + 1;
    if (o.status !== 'cancelled') gmv += Number(o.total) || 0;
  }

  const complaintRows = (complaints ?? []) as Array<{ status: string; sla_due_at: string }>;
  const overdueComplaints = complaintRows.filter(c => new Date(c.sla_due_at).getTime() < Date.now()).length;

  const draftRows = (drafts ?? []) as Array<{ total_paise: number }>;
  const abandonedCheckoutValue = draftRows.reduce((sum, d) => sum + (Number(d.total_paise) || 0), 0) / 100;

  const [{ count: stuckOrders }, { count: uncollectedOrders }] = await Promise.all([
    admin.from('orders').select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId).eq('status', 'preparing').not('stuck_alert_sent_at', 'is', null).gte('created_at', sinceIso),
    admin.from('orders').select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId).eq('status', 'ready').not('uncollected_alert_sent_at', 'is', null).gte('created_at', sinceIso),
  ]);

  return {
    summary: {
      gmv,
      ordersByStatus,
      bookingsToday:          bookingsCount ?? 0,
      openComplaints:         complaintRows.length,
      overdueComplaints,
      stuckOrders:            stuckOrders ?? 0,
      uncollectedOrders:      uncollectedOrders ?? 0,
      abandonedCheckoutValue,
      abandonedCheckoutCount: draftRows.length,
      orderingPaused,
      orderingPausedUntil:    orderingPaused ? pausedUntilRaw : null,
    },
  };
}
