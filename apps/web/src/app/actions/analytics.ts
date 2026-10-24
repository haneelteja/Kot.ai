'use server';

import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { getSession } from '@/lib/session';

export interface FunnelStage {
  stage: string;
  count: number;
}

export interface FunnelBySource {
  source: string; // 'whatsapp_bot' | 'weblink'
  stages: FunnelStage[];
}

export interface TopItem {
  name:        string;
  quantity:    number;
  revenuePaise: number;
}

export interface AovPoint {
  date:      string; // YYYY-MM-DD
  orders:    number;
  revenuePaise: number;
}

export interface AnalyticsSummary {
  funnel:            FunnelBySource[];
  topItems:          TopItem[];
  aovTrend:          AovPoint[];
  repeatCustomerRate: number; // 0-1, share of customers with 2+ orders
  botOnlyShare:       number; // 0-1, conversations never escalated
  totalConversations: number;
  escalatedConversations: number;
}

/**
 * ANL-02/04 fully; ANL-01 approximated (conversations -> cart started ->
 * checkout -> paid, by source) since no "menu view" event is instrumented
 * anywhere in this codebase — that funnel stage from the brief's exact
 * wording has nothing to compute it from today. "By source" uses
 * checkout_drafts.source (whatsapp_bot/weblink), which already exists,
 * rather than LNK-01 UTM-style tags, which the share links don't carry.
 * ANL-03 (SLA timings, delivery/booking-dependent) is skipped - blocked on
 * DLV-06 (no delivery epic) and a real booking capacity model (not built,
 * per the earlier capture-only decision).
 */
export async function getAnalyticsSummaryAction(daysBack = 30): Promise<{ summary?: AnalyticsSummary; error?: string }> {
  const session = await getSession();
  if (!session) return { error: 'Unauthorized' };

  const admin    = getSupabaseAdminClient();
  const tenantId = session.tenantId;
  const sinceIso = new Date(Date.now() - daysBack * 86_400_000).toISOString();

  const [
    { data: conversations },
    { data: carts },
    { data: drafts },
    { data: orders },
    { data: orderItems },
  ] = await Promise.all([
    admin.from('conversations').select('id, status').eq('tenant_id', tenantId).eq('product_type', 'restaurant_bot').gte('created_at', sinceIso),
    admin.from('carts').select('id, created_at').eq('tenant_id', tenantId).gte('created_at', sinceIso),
    admin.from('checkout_drafts').select('id, source, created_at').eq('tenant_id', tenantId).gte('created_at', sinceIso),
    admin.from('orders').select('id, source, total, total_paise, contact_id, created_at').eq('tenant_id', tenantId).in('source', ['whatsapp_bot', 'weblink']).gte('created_at', sinceIso),
    admin.from('order_items').select('order_id, name, quantity, line_total_paise, orders!inner(tenant_id, created_at, source)').eq('orders.tenant_id', tenantId).gte('orders.created_at', sinceIso),
  ]);

  // ── Funnel, split by source ──────────────────────────────────────────────
  const draftsBySource = new Map<string, number>();
  for (const d of (drafts ?? []) as Array<{ source: string }>) {
    draftsBySource.set(d.source, (draftsBySource.get(d.source) ?? 0) + 1);
  }
  const ordersBySource = new Map<string, number>();
  for (const o of (orders ?? []) as Array<{ source: string }>) {
    ordersBySource.set(o.source, (ordersBySource.get(o.source) ?? 0) + 1);
  }
  const sources = [...new Set([...draftsBySource.keys(), ...ordersBySource.keys()])];
  const cartsCount = (carts ?? []).length;
  const conversationsCount = (conversations ?? []).length;

  const funnel: FunnelBySource[] = sources.length > 0
    ? sources.map(source => ({
        source,
        stages: [
          { stage: 'Conversations', count: source === 'whatsapp_bot' ? conversationsCount : 0 }, // web orders have no conversation of their own
          { stage: 'Cart started',  count: source === 'whatsapp_bot' ? cartsCount : 0 },
          { stage: 'Checkout',      count: draftsBySource.get(source) ?? 0 },
          { stage: 'Paid',          count: ordersBySource.get(source) ?? 0 },
        ],
      }))
    : [{ source: 'whatsapp_bot', stages: [
        { stage: 'Conversations', count: conversationsCount },
        { stage: 'Cart started',  count: cartsCount },
        { stage: 'Checkout',      count: 0 },
        { stage: 'Paid',          count: 0 },
      ] }];

  // ── Top items ─────────────────────────────────────────────────────────────
  const itemAgg = new Map<string, { quantity: number; revenuePaise: number }>();
  for (const i of (orderItems ?? []) as Array<{ name: string; quantity: number; line_total_paise: number }>) {
    const agg = itemAgg.get(i.name) ?? { quantity: 0, revenuePaise: 0 };
    agg.quantity += i.quantity;
    agg.revenuePaise += i.line_total_paise;
    itemAgg.set(i.name, agg);
  }
  const topItems: TopItem[] = [...itemAgg.entries()]
    .map(([name, agg]) => ({ name, ...agg }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 10);

  // ── AOV trend (daily) ────────────────────────────────────────────────────
  const aovByDay = new Map<string, { orders: number; revenuePaise: number }>();
  for (const o of (orders ?? []) as Array<{ created_at: string; total_paise: number | null; total: number }>) {
    const day = o.created_at.slice(0, 10);
    const agg = aovByDay.get(day) ?? { orders: 0, revenuePaise: 0 };
    agg.orders += 1;
    agg.revenuePaise += o.total_paise ?? Math.round(o.total * 100);
    aovByDay.set(day, agg);
  }
  const aovTrend: AovPoint[] = [...aovByDay.entries()]
    .map(([date, agg]) => ({ date, ...agg }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // ── Repeat customer rate ─────────────────────────────────────────────────
  const ordersByContact = new Map<string, number>();
  for (const o of (orders ?? []) as Array<{ contact_id: string }>) {
    ordersByContact.set(o.contact_id, (ordersByContact.get(o.contact_id) ?? 0) + 1);
  }
  const totalCustomers = ordersByContact.size;
  const repeatCustomers = [...ordersByContact.values()].filter(c => c >= 2).length;
  const repeatCustomerRate = totalCustomers > 0 ? repeatCustomers / totalCustomers : 0;

  // ── Bot vs human handling share (ANL-04) — escalations table is the
  // precise "was this conversation ever escalated" source, since a
  // conversation's own status (resolved/bot_paused) doesn't retain that
  // history once it's moved on. ─────────────────────────────────────────────
  const conversationIds = (conversations ?? []).map(c => (c as { id: string }).id);
  const { data: escalations } = conversationIds.length > 0
    ? await admin.from('escalations').select('conversation_id').in('conversation_id', conversationIds)
    : { data: [] };
  const escalatedConversations = new Set((escalations ?? []).map(e => (e as { conversation_id: string }).conversation_id)).size;
  const botOnlyShare = conversationsCount > 0 ? 1 - (escalatedConversations / conversationsCount) : 1;

  return {
    summary: {
      funnel,
      topItems,
      aovTrend,
      repeatCustomerRate,
      botOnlyShare,
      totalConversations: conversationsCount,
      escalatedConversations,
    },
  };
}
