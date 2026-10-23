'use server';

import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { getSession }             from '@/lib/session';
import { writeAuditLog }          from '@/lib/audit';
import { revalidatePath }         from 'next/cache';
import type { MenuCategory, MenuItemRow } from '@alphabot/shared';
import { parseMenuCsv, buildMenuImportDiff, type MenuImportDiff } from '@/lib/menu-csv';

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

// ── MENU-07: bulk import with a change preview ─────────────────────────────
// Nothing is written to the DB during preview — it's a pure diff against
// the tenant's current menu, computed by lib/menu-csv.ts (shared with apply
// so the two can never disagree about what counts as a change).

export async function previewMenuImportAction(csvText: string): Promise<{ diff?: MenuImportDiff; parseErrors?: string[]; error?: string }> {
  const session = await getSession();
  if (!session) return { error: 'Unauthorized' };

  const { rows, errors } = parseMenuCsv(csvText);
  if (rows.length === 0) return { error: errors[0] ?? 'No valid rows found in the file' };

  const admin = getSupabaseAdminClient();
  const [itemsRes, categoriesRes] = await Promise.all([
    admin.from('menu_items').select('*').eq('tenant_id', session.tenantId),
    admin.from('menu_categories').select('*').eq('tenant_id', session.tenantId),
  ]);

  const diff = buildMenuImportDiff(
    rows,
    (itemsRes.data ?? []) as MenuItemRow[],
    (categoriesRes.data ?? []) as MenuCategory[],
  );

  return { diff, parseErrors: errors.length > 0 ? errors : undefined };
}

export async function applyMenuImportAction(csvText: string): Promise<{ added?: number; updated?: number; error?: string }> {
  const session = await getSession();
  if (!session) return { error: 'Unauthorized' };

  const { rows } = parseMenuCsv(csvText);
  if (rows.length === 0) return { error: 'No valid rows found in the file' };

  const admin = getSupabaseAdminClient();
  const [itemsRes, categoriesRes] = await Promise.all([
    admin.from('menu_items').select('*').eq('tenant_id', session.tenantId),
    admin.from('menu_categories').select('*').eq('tenant_id', session.tenantId),
  ]);

  let categories = (categoriesRes.data ?? []) as MenuCategory[];
  const diff = buildMenuImportDiff(rows, (itemsRes.data ?? []) as MenuItemRow[], categories);

  // Create any new categories first so added/changed rows can resolve a category_id.
  if (diff.newCategoryNames.length > 0) {
    const { data: created, error } = await admin
      .from('menu_categories')
      .insert(diff.newCategoryNames.map(name => ({ tenant_id: session.tenantId, name })))
      .select();
    if (error) return { error: `Failed to create categories: ${error.message}` };
    categories = [...categories, ...((created ?? []) as MenuCategory[])];
  }
  const categoryIdByName = new Map(categories.map(c => [c.name.toLowerCase(), c.id]));

  if (diff.added.length > 0) {
    const { error } = await admin.from('menu_items').insert(
      diff.added.map(row => ({
        tenant_id:   session.tenantId,
        name:        row.name,
        description: row.description,
        price_paise: Math.round(row.priceRupees * 100),
        category_id: row.category ? categoryIdByName.get(row.category.toLowerCase()) ?? null : null,
        is_veg:      row.isVeg,
      })),
    );
    if (error) return { error: `Failed to add items: ${error.message}` };
  }

  for (const { row, existing, fields } of diff.changed) {
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (fields.includes('price'))       patch['price_paise'] = Math.round(row.priceRupees * 100);
    if (fields.includes('veg'))         patch['is_veg']       = row.isVeg;
    if (fields.includes('description')) patch['description']  = row.description;
    if (fields.includes('category') && row.category) patch['category_id'] = categoryIdByName.get(row.category.toLowerCase()) ?? null;

    const { error } = await admin.from('menu_items').update(patch).eq('id', existing.id);
    if (error) return { error: `Failed to update "${existing.name}": ${error.message}` };
  }

  void writeAuditLog({
    tenantId:    session.tenantId,
    actorId:     session.userId,
    actorEmail:  session.userEmail,
    action:      'menu.bulk_import',
    entityType:  'menu_items',
    description: `Bulk menu import: ${diff.added.length} added, ${diff.changed.length} updated`,
    metadata:    { added: diff.added.length, updated: diff.changed.length, newCategories: diff.newCategoryNames },
  });

  revalidatePath('/menu');
  return { added: diff.added.length, updated: diff.changed.length };
}
