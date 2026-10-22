import type { getServerClient } from '@alphabot/database';
import { cacheGetOrFetch } from './redis.js';

type Db = ReturnType<typeof getServerClient>;

const TTL = 300; // 5 min — same staleness tradeoff as menu-cache.ts/product-cache.ts

/**
 * Staff-side block list — independent of the customer-initiated opt-out in
 * suppression.ts. Lets staff block a specific abusive number from reaching
 * the bot at all, without affecting that number's ability to message other
 * tenants or requiring the customer to have opted out themselves.
 */
export async function isNumberBlocked(db: Db, tenantId: string, phone: string): Promise<boolean> {
  const blocked = await cacheGetOrFetch(`blocked_numbers:${tenantId}`, async () => {
    const { data } = await db.from('blocked_numbers').select('phone').eq('tenant_id', tenantId);
    return (data ?? []).map(r => (r as { phone: string }).phone);
  }, TTL);
  return blocked.includes(phone);
}
