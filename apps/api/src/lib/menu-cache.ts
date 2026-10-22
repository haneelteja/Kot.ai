import { getServerClient } from '@alphabot/database';
import { cacheGetOrFetch, cacheDel } from './redis.js';

const TTL = 300; // 5 min — same staleness tradeoff product-cache.ts already accepts

export interface CachedMenuItem {
  id:            string;
  name:          string;
  description:   string | null;
  price_paise:   number;
  category_name: string | null;
  is_veg:        boolean;
  in_stock:      boolean;
}

/** Live, per-tenant restaurant menu — Redis cache-through, mirrors product-cache.ts. */
export async function getMenu(tenantId: string): Promise<CachedMenuItem[]> {
  return cacheGetOrFetch(`menu:${tenantId}`, async () => {
    const db = getServerClient();
    const { data } = await db
      .from('menu_items')
      .select('id, name, description, price_paise, is_veg, in_stock, menu_categories(name)')
      .eq('tenant_id', tenantId)
      .eq('active', true)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    type Row = {
      id: string; name: string; description: string | null; price_paise: number;
      is_veg: boolean; in_stock: boolean;
      menu_categories: { name: string } | { name: string }[] | null;
    };

    return ((data ?? []) as Row[]).map(r => {
      const cat = Array.isArray(r.menu_categories) ? r.menu_categories[0] : r.menu_categories;
      return {
        id: r.id, name: r.name, description: r.description, price_paise: r.price_paise,
        category_name: cat?.name ?? null, is_veg: r.is_veg, in_stock: r.in_stock,
      };
    });
  }, TTL);
}

export async function invalidateMenuCache(tenantId: string): Promise<void> {
  await cacheDel(`menu:${tenantId}`);
}
