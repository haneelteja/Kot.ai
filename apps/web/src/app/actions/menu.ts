'use server';

import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { getSession }             from '@/lib/session';
import type { MenuCategory, MenuItemRow } from '@alphabot/shared';

// ── Categories ────────────────────────────────────────────────────────────────

export async function getMenuCategoriesAction(): Promise<{ categories: MenuCategory[]; error?: string }> {
  const session = await getSession();
  if (!session) return { categories: [], error: 'Unauthorized' };

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from('menu_categories')
    .select('*')
    .eq('tenant_id', session.tenantId)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) return { categories: [], error: error.message };
  return { categories: (data ?? []) as MenuCategory[] };
}

export async function createMenuCategoryAction(input: { name: string }): Promise<{ category?: MenuCategory; error?: string }> {
  if (!input.name?.trim()) return { error: 'Name is required' };

  const session = await getSession();
  if (!session) return { error: 'Unauthorized' };

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from('menu_categories')
    .insert({ tenant_id: session.tenantId, name: input.name.trim() })
    .select()
    .single();

  if (error) return { error: error.message };
  return { category: data as MenuCategory };
}

export async function updateMenuCategoryAction(
  id:    string,
  input: Partial<{ name: string; active: boolean; sort_order: number }>,
): Promise<{ error?: string }> {
  if (!id) return { error: 'Missing id' };

  const session = await getSession();
  if (!session) return { error: 'Unauthorized' };

  const admin = getSupabaseAdminClient();
  const { error } = await admin
    .from('menu_categories')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('tenant_id', session.tenantId);

  if (error) return { error: error.message };
  return {};
}

export async function deleteMenuCategoryAction(id: string): Promise<{ error?: string }> {
  if (!id) return { error: 'Missing id' };

  const session = await getSession();
  if (!session) return { error: 'Unauthorized' };

  const admin = getSupabaseAdminClient();
  const { error } = await admin
    .from('menu_categories')
    .delete()
    .eq('id', id)
    .eq('tenant_id', session.tenantId);

  if (error) return { error: error.message };
  return {};
}

// ── Menu items ───────────────────────────────────────────────────────────────
// Price is handled in rupees at the UI boundary and converted to/from
// price_paise here — the DB (and everything downstream: cart, orders,
// webhook) only ever deals in paise, never floats.

function toPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

export async function getMenuItemsAction(): Promise<{ items: MenuItemRow[]; error?: string }> {
  const session = await getSession();
  if (!session) return { items: [], error: 'Unauthorized' };

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from('menu_items')
    .select('*')
    .eq('tenant_id', session.tenantId)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) return { items: [], error: error.message };
  return { items: (data ?? []) as MenuItemRow[] };
}

export async function createMenuItemAction(input: {
  name:          string;
  description?:  string;
  price_rupees:  number;
  category_id?:  string | null;
  is_veg:        boolean;
  image_url?:    string;
}): Promise<{ item?: MenuItemRow; error?: string }> {
  if (!input.name?.trim()) return { error: 'Name is required' };
  if (!(input.price_rupees >= 0)) return { error: 'A valid price is required' };

  const session = await getSession();
  if (!session) return { error: 'Unauthorized' };

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from('menu_items')
    .insert({
      tenant_id:   session.tenantId,
      name:        input.name.trim(),
      description: input.description?.trim() || null,
      price_paise: toPaise(input.price_rupees),
      category_id: input.category_id || null,
      is_veg:      input.is_veg,
      image_url:   input.image_url?.trim() || null,
    })
    .select()
    .single();

  if (error) return { error: error.message };
  return { item: data as MenuItemRow };
}

export async function updateMenuItemAction(
  id:    string,
  input: Partial<{
    name:         string;
    description:  string | null;
    price_rupees: number;
    category_id:  string | null;
    is_veg:       boolean;
    in_stock:     boolean;
    active:       boolean;
    image_url:    string | null;
  }>,
): Promise<{ error?: string }> {
  if (!id) return { error: 'Missing id' };

  const session = await getSession();
  if (!session) return { error: 'Unauthorized' };

  const { price_rupees, ...rest } = input;
  const patch: Record<string, unknown> = { ...rest, updated_at: new Date().toISOString() };
  if (price_rupees !== undefined) patch['price_paise'] = toPaise(price_rupees);

  const admin = getSupabaseAdminClient();
  const { error } = await admin
    .from('menu_items')
    .update(patch)
    .eq('id', id)
    .eq('tenant_id', session.tenantId);

  if (error) return { error: error.message };
  return {};
}

export async function deleteMenuItemAction(id: string): Promise<{ error?: string }> {
  if (!id) return { error: 'Missing id' };

  const session = await getSession();
  if (!session) return { error: 'Unauthorized' };

  const admin = getSupabaseAdminClient();
  const { error } = await admin
    .from('menu_items')
    .delete()
    .eq('id', id)
    .eq('tenant_id', session.tenantId);

  if (error) return { error: error.message };
  return {};
}
