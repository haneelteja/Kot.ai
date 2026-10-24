'use server';

import { getSupabaseServerClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export type CouponType = 'percent' | 'flat' | 'free_delivery';

export interface Coupon {
  id:                    string;
  code:                  string;
  type:                  CouponType;
  value:                 number; // percent: basis points; flat: paise
  max_uses:               number | null;
  uses_count:             number;
  min_order_value_paise:  number;
  active:                 boolean;
  expires_at:             string | null;
  created_at:             string;
}

// All actions call apps/api — coupons.uses_count is incremented atomically
// server-side on redemption, so the dashboard shouldn't write this table
// directly (same reasoning as app/actions/orders.ts).
async function getAccessToken(): Promise<string | null> {
  const supabase = await getSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? '';

export async function getCouponsAction(): Promise<{ coupons: Coupon[]; error?: string }> {
  if (!API_BASE) return { coupons: [], error: 'API URL not configured' };
  const token = await getAccessToken();
  if (!token) return { coupons: [], error: 'Not authenticated' };

  try {
    const res = await fetch(`${API_BASE}/api/coupons`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json() as { coupons?: Coupon[]; error?: string };
    if (!res.ok) return { coupons: [], error: data.error ?? 'Failed to load coupons' };
    return { coupons: data.coupons ?? [] };
  } catch (err) {
    return { coupons: [], error: err instanceof Error ? err.message : 'Network error' };
  }
}

export async function createCouponAction(input: {
  code: string; type: CouponType; value: number;
  maxUses: number | null; minOrderValuePaise: number; expiresAt: string | null;
}): Promise<{ error?: string }> {
  if (!API_BASE) return { error: 'API URL not configured' };
  const token = await getAccessToken();
  if (!token) return { error: 'Not authenticated' };

  try {
    const res = await fetch(`${API_BASE}/api/coupons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        code: input.code, type: input.type, value: input.value,
        max_uses: input.maxUses, min_order_value_paise: input.minOrderValuePaise, expires_at: input.expiresAt,
      }),
    });
    const data = await res.json() as { error?: string };
    if (!res.ok) return { error: data.error ?? 'Failed to create coupon' };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Network error' };
  }

  revalidatePath('/offers');
  return {};
}

export async function toggleCouponActiveAction(id: string, active: boolean): Promise<{ error?: string }> {
  if (!API_BASE) return { error: 'API URL not configured' };
  const token = await getAccessToken();
  if (!token) return { error: 'Not authenticated' };

  try {
    const res = await fetch(`${API_BASE}/api/coupons/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ active }),
    });
    const data = await res.json() as { error?: string };
    if (!res.ok) return { error: data.error ?? 'Failed to update coupon' };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Network error' };
  }

  revalidatePath('/offers');
  return {};
}

export async function deleteCouponAction(id: string): Promise<{ error?: string }> {
  if (!API_BASE) return { error: 'API URL not configured' };
  const token = await getAccessToken();
  if (!token) return { error: 'Not authenticated' };

  try {
    const res = await fetch(`${API_BASE}/api/coupons/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json() as { error?: string };
    if (!res.ok) return { error: data.error ?? 'Failed to delete coupon' };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Network error' };
  }

  revalidatePath('/offers');
  return {};
}
