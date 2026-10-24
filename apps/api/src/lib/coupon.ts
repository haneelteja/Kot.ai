import type { getServerClient } from '@alphabot/database';

type Db = ReturnType<typeof getServerClient>;

export type CouponType = 'percent' | 'flat' | 'free_delivery';

export type CouponRedeemResult =
  | { ok: true; code: string; discountPaise: number }
  | { ok: false; error: 'not_found' | 'inactive' | 'expired' | 'below_minimum' | 'usage_limit_reached' };

interface CouponRow {
  id:                    string;
  type:                  CouponType;
  value:                 number;
  max_uses:               number | null;
  uses_count:             number;
  min_order_value_paise:  number;
  active:                 boolean;
  expires_at:             string | null;
}

/**
 * PRC-02: validates a coupon and atomically claims one use. The claim is a
 * compare-and-swap on uses_count (re-checking the usage cap in the same
 * WHERE clause) — a concurrent redeemer racing the same coupon either wins
 * the update or gets 0 rows back and is told the limit is reached, so
 * usage can never exceed max_uses even under concurrent requests. Claimed
 * eagerly at checkout-draft creation (not payment confirmation) — an
 * abandoned/expired draft does not release its claimed use back; a minor
 * conservative tradeoff, not a correctness bug.
 */
export async function redeemCoupon(
  db:             Db,
  tenantId:       string,
  codeRaw:        string,
  subtotalPaise:  number,
): Promise<CouponRedeemResult> {
  const code = codeRaw.trim().toUpperCase();

  const { data } = await db
    .from('coupons')
    .select('id, type, value, max_uses, uses_count, min_order_value_paise, active, expires_at')
    .eq('tenant_id', tenantId)
    .eq('code', code)
    .maybeSingle();

  if (!data) return { ok: false, error: 'not_found' };
  const coupon = data as CouponRow;

  if (!coupon.active) return { ok: false, error: 'inactive' };
  if (coupon.expires_at && new Date(coupon.expires_at).getTime() < Date.now()) return { ok: false, error: 'expired' };
  if (subtotalPaise < coupon.min_order_value_paise) return { ok: false, error: 'below_minimum' };

  let claimQuery = db
    .from('coupons')
    .update({ uses_count: coupon.uses_count + 1 })
    .eq('id', coupon.id)
    .eq('uses_count', coupon.uses_count);
  if (coupon.max_uses !== null) claimQuery = claimQuery.lt('uses_count', coupon.max_uses);

  const { data: claimed } = await claimQuery.select('id').maybeSingle();
  if (!claimed) return { ok: false, error: 'usage_limit_reached' };

  const discountPaise = coupon.type === 'percent'
    ? Math.min(subtotalPaise, Math.round(subtotalPaise * coupon.value / 10000))
    : coupon.type === 'flat'
    ? Math.min(subtotalPaise, coupon.value)
    : 0; // free_delivery: no delivery fee exists in this platform yet, so this has no effect today

  return { ok: true, code, discountPaise };
}
