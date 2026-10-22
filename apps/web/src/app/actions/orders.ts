'use server';

import { getSupabaseServerClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export type OrderStatus = 'pending' | 'confirmed' | 'dispatched' | 'delivered' | 'cancelled';

export interface OrderItem {
  name: string;
  quantity: number;
  price: number;
  sku?: string;
}

// Both actions below call apps/api rather than writing to Supabase directly —
// that's where the WhatsApp status-notification copy and the order.* outbound
// webhook dispatch live (apps/api/src/routes/orders/index.ts), so routing
// through it keeps notification + webhook logic in one place instead of
// duplicating it here.
async function getAccessToken(): Promise<string | null> {
  const supabase = await getSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

export async function createOrderAction(
  tenantId: string,
  contactId: string,
  conversationId: string,
  items: OrderItem[],
  total: number,
  sendLink: boolean,
  provider: 'easebuzz' = 'easebuzz',
): Promise<{ ok: true; orderId: string; linkUrl: string | null } | { error: string }> {
  const apiBase = process.env['NEXT_PUBLIC_API_URL'] ?? '';
  if (!apiBase) return { error: 'API URL not configured' };

  const token = await getAccessToken();
  if (!token) return { error: 'Not authenticated' };

  try {
    const res = await fetch(`${apiBase}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ tenantId, contactId, conversationId, items, total, sendLink, provider }),
    });

    const data = await res.json() as { order?: { id: string }; linkUrl?: string | null; error?: string };
    if (!res.ok || data.error) return { error: data.error ?? 'Failed to create order' };

    revalidatePath('/orders');
    return { ok: true, orderId: data.order?.id ?? '', linkUrl: data.linkUrl ?? null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Network error' };
  }
}

export async function updateOrderStatusAction(
  orderId: string,
  status: OrderStatus,
): Promise<{ ok: true } | { error: string }> {
  const apiBase = process.env['NEXT_PUBLIC_API_URL'] ?? '';
  if (!apiBase) return { error: 'API URL not configured' };

  const token = await getAccessToken();
  if (!token) return { error: 'Not authenticated' };

  try {
    const res = await fetch(`${apiBase}/api/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status }),
    });

    const data = await res.json() as { error?: string };
    if (!res.ok || data.error) return { error: data.error ?? 'Failed to update status' };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Network error' };
  }

  revalidatePath('/orders');
  return { ok: true };
}
