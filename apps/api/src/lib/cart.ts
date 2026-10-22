import type { getServerClient } from '@alphabot/database';

type Db = ReturnType<typeof getServerClient>;

export interface CartSummaryItem {
  menuItemId:     string;
  name:           string;
  unitPricePaise: number;
  quantity:       number;
  lineTotalPaise: number;
}

export interface CartSummary {
  cartId:     string;
  items:      CartSummaryItem[];
  totalPaise: number;
}

/** Returns the active cart id for (tenant, contact), creating one if none exists. */
export async function getOrCreateActiveCart(db: Db, tenantId: string, contactId: string): Promise<string> {
  const { data: existing } = await db
    .from('carts')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('contact_id', contactId)
    .eq('status', 'active')
    .maybeSingle();

  if (existing) return (existing as { id: string }).id;

  const { data: created, error } = await db
    .from('carts')
    .insert({ tenant_id: tenantId, contact_id: contactId, status: 'active' })
    .select('id')
    .single();

  if (error || !created) {
    // Race: another concurrent call created the active cart first (partial
    // unique index would reject our insert) — just re-read it.
    const { data: raced } = await db
      .from('carts')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('contact_id', contactId)
      .eq('status', 'active')
      .single();
    if (raced) return (raced as { id: string }).id;
    throw new Error(`Failed to create or find active cart: ${error?.message ?? 'unknown error'}`);
  }

  return (created as { id: string }).id;
}

/**
 * Cart summary — ALWAYS re-joins live menu_items.price_paise. A cart_item
 * only ever stores (cart_id, menu_item_id, quantity); the price shown here
 * is never read from a stored/cached value and never trusts anything the AI
 * said — this is the "code decides" half of the ordering feature.
 */
export async function getCartSummary(db: Db, tenantId: string, contactId: string): Promise<CartSummary> {
  const { data: cart } = await db
    .from('carts')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('contact_id', contactId)
    .eq('status', 'active')
    .maybeSingle();

  if (!cart) return { cartId: '', items: [], totalPaise: 0 };

  const cartId = (cart as { id: string }).id;
  const { data: rows } = await db
    .from('cart_items')
    .select('menu_item_id, quantity, menu_items(name, price_paise, active)')
    .eq('cart_id', cartId);

  type Row = {
    menu_item_id: string; quantity: number;
    menu_items: { name: string; price_paise: number; active: boolean } | { name: string; price_paise: number; active: boolean }[] | null;
  };

  const items: CartSummaryItem[] = [];
  for (const r of (rows ?? []) as Row[]) {
    const mi = Array.isArray(r.menu_items) ? r.menu_items[0] : r.menu_items;
    if (!mi || !mi.active) continue; // menu item deactivated since being added — drop silently from the live summary
    const lineTotal = mi.price_paise * r.quantity;
    items.push({ menuItemId: r.menu_item_id, name: mi.name, unitPricePaise: mi.price_paise, quantity: r.quantity, lineTotalPaise: lineTotal });
  }

  return { cartId, items, totalPaise: items.reduce((s, i) => s + i.lineTotalPaise, 0) };
}

export type AddItemResult =
  | { ok: true; summary: CartSummary }
  | { ok: false; error: 'not_found' | 'out_of_stock' | 'invalid_quantity' };

/** Adds qty of a menu item to the active cart, incrementing if already present. */
export async function addItemToCart(db: Db, tenantId: string, contactId: string, menuItemId: string, quantity: number): Promise<AddItemResult> {
  if (!Number.isFinite(quantity) || quantity <= 0) return { ok: false, error: 'invalid_quantity' };

  const { data: menuItem } = await db
    .from('menu_items')
    .select('id, active, in_stock')
    .eq('id', menuItemId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (!menuItem || !(menuItem as { active: boolean }).active) return { ok: false, error: 'not_found' };
  if (!(menuItem as { in_stock: boolean }).in_stock) return { ok: false, error: 'out_of_stock' };

  const cartId = await getOrCreateActiveCart(db, tenantId, contactId);

  const { data: existingLine } = await db
    .from('cart_items')
    .select('id, quantity')
    .eq('cart_id', cartId)
    .eq('menu_item_id', menuItemId)
    .maybeSingle();

  if (existingLine) {
    await db.from('cart_items').update({ quantity: (existingLine as { quantity: number }).quantity + quantity }).eq('id', (existingLine as { id: string }).id);
  } else {
    await db.from('cart_items').insert({ cart_id: cartId, menu_item_id: menuItemId, quantity });
  }

  return { ok: true, summary: await getCartSummary(db, tenantId, contactId) };
}

export async function removeItemFromCart(db: Db, tenantId: string, contactId: string, menuItemId: string): Promise<CartSummary> {
  const { data: cart } = await db
    .from('carts')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('contact_id', contactId)
    .eq('status', 'active')
    .maybeSingle();

  if (cart) {
    await db.from('cart_items').delete().eq('cart_id', (cart as { id: string }).id).eq('menu_item_id', menuItemId);
  }

  return getCartSummary(db, tenantId, contactId);
}

export async function clearCart(db: Db, tenantId: string, contactId: string): Promise<void> {
  const { data: cart } = await db
    .from('carts')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('contact_id', contactId)
    .eq('status', 'active')
    .maybeSingle();

  if (cart) {
    await db.from('cart_items').delete().eq('cart_id', (cart as { id: string }).id);
  }
}
