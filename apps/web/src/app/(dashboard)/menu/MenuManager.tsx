'use client';

import { useState, useTransition } from 'react';
import {
  Plus, Pencil, Trash2, Loader2, Check, X,
  UtensilsCrossed, IndianRupee, Tag, Info, Leaf, Upload,
} from 'lucide-react';
import {
  createMenuItemAction,
  updateMenuItemAction,
  deleteMenuItemAction,
  createMenuCategoryAction,
  deleteMenuCategoryAction,
} from '@/app/actions/menu';
import { MenuBulkImport } from './MenuBulkImport';
import type { MenuCategory, MenuItemRow } from '@alphabot/shared';

// ── helpers ────────────────────────────────────────────────────────────────────

function fmtPaise(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function parseRupees(s: string): number {
  const v = parseFloat(s.replace(/,/g, ''));
  return isNaN(v) || v < 0 ? 0 : v;
}

// ── item form ─────────────────────────────────────────────────────────────────

interface FormState {
  name: string;
  description: string;
  price: string;
  category_id: string;
  is_veg: boolean;
}

function emptyForm(): FormState {
  return { name: '', description: '', price: '', category_id: '', is_veg: true };
}

function MenuItemForm({
  initial,
  categories,
  onSave,
  onCancel,
  saving,
}: {
  initial: FormState;
  categories: MenuCategory[];
  onSave: (f: FormState) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [f, setF] = useState(initial);
  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setF(prev => ({ ...prev, [k]: e.target.value }));

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label className="block text-xs font-semibold text-muted-foreground mb-1">Item name *</label>
        <input
          autoFocus
          value={f.name}
          onChange={set('name')}
          placeholder="e.g. Chicken Biryani"
          className="w-full text-sm border border-line rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/40"
        />
      </div>

      <div>
        <label className="flex items-center gap-1 text-xs font-semibold text-muted-foreground mb-1">
          <Tag size={10} /> Category
        </label>
        <select
          value={f.category_id}
          onChange={set('category_id')}
          className="w-full text-sm border border-line rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/40 bg-surface"
        >
          <option value="">No category</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="flex items-center gap-1 text-xs font-semibold text-muted-foreground mb-1">
          <IndianRupee size={10} /> Price (INR) *
        </label>
        <input
          type="number"
          min={0}
          step={0.01}
          value={f.price}
          onChange={set('price')}
          placeholder="e.g. 320"
          className="w-full text-sm border border-line rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/40"
        />
      </div>

      <div className="flex items-end pb-2">
        <label className="flex items-center gap-2 text-sm text-text cursor-pointer select-none">
          <input
            type="checkbox"
            checked={f.is_veg}
            onChange={e => setF(prev => ({ ...prev, is_veg: e.target.checked }))}
            className="w-4 h-4 accent-done"
          />
          <Leaf size={13} className={f.is_veg ? 'text-done' : 'text-muted-foreground'} />
          Vegetarian
        </label>
      </div>

      <div className="sm:col-span-2">
        <label className="block text-xs font-semibold text-muted-foreground mb-1">Description</label>
        <textarea
          rows={2}
          value={f.description}
          onChange={set('description')}
          placeholder="Short description shown to the bot when describing this item to customers"
          className="w-full text-sm border border-line rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-brand/40"
        />
      </div>

      <div className="sm:col-span-2 flex items-center gap-2">
        <button
          type="button"
          onClick={() => onSave(f)}
          disabled={saving || !f.name.trim() || !f.price.trim()}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-strong text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
          Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-line text-muted-foreground text-sm font-medium hover:bg-sunken transition-colors"
        >
          <X size={13} /> Cancel
        </button>
      </div>
    </div>
  );
}

// ── category strip ──────────────────────────────────────────────────────────

function CategoryStrip({
  categories,
  onAdd,
  onDelete,
}: {
  categories: MenuCategory[];
  onAdd: (name: string) => void;
  onDelete: (id: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName]     = useState('');

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {categories.map(c => (
        <span key={c.id} className="group flex items-center gap-1 text-xs font-medium bg-brand-wash text-brand-strong border border-brand/20 px-2.5 py-1 rounded-full">
          {c.name}
          <button type="button" onClick={() => onDelete(c.id)} className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-problem" title="Delete category">
            <X size={10} />
          </button>
        </span>
      ))}
      {adding ? (
        <div className="flex items-center gap-1">
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && name.trim()) { onAdd(name.trim()); setName(''); setAdding(false); } if (e.key === 'Escape') setAdding(false); }}
            placeholder="Category name"
            className="text-xs border border-line rounded-full px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-brand/40 w-32"
          />
          <button type="button" onClick={() => { if (name.trim()) { onAdd(name.trim()); setName(''); } setAdding(false); }} className="text-done"><Check size={14} /></button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex items-center gap-1 text-xs font-medium text-muted-foreground border border-dashed border-line px-2.5 py-1 rounded-full hover:border-brand/40 hover:text-brand-strong transition-colors"
        >
          <Plus size={11} /> Category
        </button>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function MenuManager({
  initialCategories,
  initialItems,
}: {
  initialCategories: MenuCategory[];
  initialItems: MenuItemRow[];
}) {
  const [categories, setCategories] = useState<MenuCategory[]>(initialCategories);
  const [items, setItems]           = useState<MenuItemRow[]>(initialItems);
  const [showAdd, setShowAdd]       = useState(false);
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError]           = useState<string | null>(null);
  const [, startTransition]         = useTransition();
  const [saving, setSaving]         = useState(false);
  const [toggling, setToggling]     = useState<string | null>(null);
  const [showBulkImport, setShowBulkImport] = useState(false);

  const categoryName = (id: string | null) => categories.find(c => c.id === id)?.name ?? null;

  async function handleAddCategory(name: string) {
    const result = await createMenuCategoryAction({ name });
    if (result.error) { setError(result.error); return; }
    if (result.category) startTransition(() => setCategories(prev => [...prev, result.category!]));
  }

  async function handleDeleteCategory(id: string) {
    const result = await deleteMenuCategoryAction(id);
    if (result.error) { setError(result.error); return; }
    startTransition(() => {
      setCategories(prev => prev.filter(c => c.id !== id));
      setItems(prev => prev.map(i => i.category_id === id ? { ...i, category_id: null } : i));
    });
  }

  async function handleAdd(f: FormState) {
    setSaving(true);
    setError(null);

    const result = await createMenuItemAction({
      name:         f.name.trim(),
      description:  f.description.trim() || undefined,
      price_rupees: parseRupees(f.price),
      category_id:  f.category_id || null,
      is_veg:       f.is_veg,
    });

    setSaving(false);
    if (result.error) { setError(result.error); return; }
    startTransition(() => {
      if (result.item) setItems(prev => [...prev, result.item!]);
      setShowAdd(false);
    });
  }

  async function handleEdit(id: string, f: FormState) {
    setSaving(true);
    setError(null);

    const result = await updateMenuItemAction(id, {
      name:         f.name.trim(),
      description:  f.description.trim() || null,
      price_rupees: parseRupees(f.price),
      category_id:  f.category_id || null,
      is_veg:       f.is_veg,
    });

    setSaving(false);
    if (result.error) { setError(result.error); return; }
    startTransition(() => {
      setItems(prev => prev.map(i =>
        i.id === id
          ? { ...i, name: f.name.trim(), description: f.description.trim() || null, price_paise: Math.round(parseRupees(f.price) * 100), category_id: f.category_id || null, is_veg: f.is_veg }
          : i,
      ));
      setEditingId(null);
    });
  }

  async function handleToggleActive(item: MenuItemRow) {
    setToggling(item.id);
    const result = await updateMenuItemAction(item.id, { active: !item.active });
    setToggling(null);
    if (result.error) { setError(result.error); return; }
    startTransition(() => setItems(prev => prev.map(i => i.id === item.id ? { ...i, active: !i.active } : i)));
  }

  async function handleToggleStock(item: MenuItemRow) {
    setToggling(item.id + '-stock');
    const result = await updateMenuItemAction(item.id, { in_stock: !item.in_stock });
    setToggling(null);
    if (result.error) { setError(result.error); return; }
    startTransition(() => setItems(prev => prev.map(i => i.id === item.id ? { ...i, in_stock: !i.in_stock } : i)));
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    const result = await deleteMenuItemAction(id);
    setDeletingId(null);
    if (result.error) { setError(result.error); return; }
    startTransition(() => setItems(prev => prev.filter(i => i.id !== id)));
  }

  const activeCount = items.filter(i => i.active).length;

  return (
    <div className="space-y-4">

      <div className="flex items-start gap-2.5 bg-brand-wash border border-brand/20 rounded-xl px-4 py-3">
        <Info size={14} className="text-brand mt-0.5 shrink-0" />
        <div className="text-[12px] text-brand-strong space-y-0.5">
          <p><strong>{activeCount} active item{activeCount !== 1 ? 's' : ''}</strong> are visible to the restaurant bot.</p>
          <p>Menu changes may take up to 5 minutes to reach the WhatsApp bot (cached for performance).</p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-problem-bg border border-problem/20 rounded-xl px-4 py-2.5 text-sm text-problem">
          <X size={13} className="shrink-0" />
          {error}
          <button type="button" onClick={() => setError(null)} className="ml-auto"><X size={12} /></button>
        </div>
      )}

      <CategoryStrip categories={categories} onAdd={handleAddCategory} onDelete={handleDeleteCategory} />

      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-text">
          {items.length} item{items.length !== 1 ? 's' : ''}
        </p>
        {!showAdd && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowBulkImport(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-line text-text text-sm font-medium hover:bg-sunken transition-colors"
            >
              <Upload size={13} /> Bulk import
            </button>
            <button
              type="button"
              onClick={() => { setShowAdd(true); setEditingId(null); }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-strong text-white text-sm font-semibold hover:opacity-90 transition-colors"
            >
              <Plus size={14} /> Add item
            </button>
          </div>
        )}
      </div>

      {showBulkImport && <MenuBulkImport onClose={() => setShowBulkImport(false)} />}

      {showAdd && (
        <div className="bg-surface border border-brand/20 rounded-2xl p-4 shadow-float">
          <p className="text-xs font-semibold text-brand-strong mb-3 flex items-center gap-1.5">
            <UtensilsCrossed size={12} /> New menu item
          </p>
          <MenuItemForm
            initial={emptyForm()}
            categories={categories}
            onSave={f => void handleAdd(f)}
            onCancel={() => setShowAdd(false)}
            saving={saving}
          />
        </div>
      )}

      {items.length === 0 && !showAdd ? (
        <div className="bg-surface border border-dashed border-line rounded-2xl px-6 py-12 text-center">
          <UtensilsCrossed size={32} className="mx-auto text-muted-foreground mb-3" />
          <p className="text-sm font-semibold text-muted-foreground">No menu items yet</p>
          <p className="text-xs text-muted-foreground mt-1">Add your first item and the bot will start taking orders.</p>
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-strong text-white text-sm font-semibold hover:opacity-90 transition-colors"
          >
            <Plus size={14} /> Add item
          </button>
        </div>
      ) : (
        <div className="bg-surface border border-line rounded-2xl overflow-hidden shadow-float">
          <div className="divide-y divide-line">
            {items.map((item, i) => (
              <div key={item.id} className={i % 2 === 1 ? 'bg-sunken' : 'bg-surface'}>
                {editingId !== item.id ? (
                  <div className="flex items-center gap-3 px-4 py-3">
                    <button
                      type="button"
                      onClick={() => void handleToggleActive(item)}
                      disabled={toggling === item.id}
                      title={item.active ? 'Click to deactivate' : 'Click to activate'}
                      className={`relative w-9 h-5 rounded-full transition-colors shrink-0 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:ring-offset-1 ${
                        item.active ? 'bg-done' : 'bg-line'
                      } ${toggling === item.id ? 'opacity-50' : ''}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${item.active ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-sm font-semibold truncate ${item.active ? 'text-text' : 'text-muted-foreground'}`}>
                          {item.name}
                        </span>
                        <Leaf size={11} className={item.is_veg ? 'text-done' : 'text-problem'} />
                        {categoryName(item.category_id) && (
                          <span className="text-[10px] bg-brand-wash text-brand-strong border border-brand/20 px-1.5 py-0.5 rounded-full shrink-0">
                            {categoryName(item.category_id)}
                          </span>
                        )}
                        {!item.in_stock && (
                          <span className="text-[10px] bg-problem-bg text-problem px-1.5 py-0.5 rounded-full shrink-0">
                            Out of stock
                          </span>
                        )}
                      </div>
                      {item.description && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{item.description}</p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => void handleToggleStock(item)}
                      disabled={toggling === item.id + '-stock'}
                      className={`text-[10px] font-semibold px-2 py-1 rounded-lg shrink-0 transition-colors ${
                        item.in_stock ? 'text-done hover:bg-done-bg' : 'text-muted-foreground hover:bg-sunken'
                      }`}
                      title={item.in_stock ? 'Mark out of stock' : 'Mark in stock'}
                    >
                      {item.in_stock ? 'In stock' : 'Mark in stock'}
                    </button>

                    <div className="text-sm font-semibold text-done tabular-nums shrink-0 mr-1">
                      {fmtPaise(item.price_paise)}
                    </div>

                    <button
                      type="button"
                      onClick={() => { setEditingId(item.id); setShowAdd(false); }}
                      className="p-1.5 text-muted-foreground hover:text-brand-strong hover:bg-brand-wash rounded-lg transition-colors shrink-0"
                      title="Edit"
                    >
                      <Pencil size={13} />
                    </button>

                    <button
                      type="button"
                      onClick={() => void handleDelete(item.id)}
                      disabled={deletingId === item.id}
                      className="p-1.5 text-muted-foreground hover:text-problem hover:bg-problem-bg rounded-lg transition-colors shrink-0"
                      title="Delete"
                    >
                      {deletingId === item.id
                        ? <Loader2 size={13} className="animate-spin" />
                        : <Trash2 size={13} />
                      }
                    </button>
                  </div>
                ) : (
                  <div className="px-4 py-4 border-l-2 border-brand">
                    <p className="text-xs font-semibold text-brand-strong mb-3 flex items-center gap-1.5">
                      <Pencil size={11} /> Editing: {item.name}
                    </p>
                    <MenuItemForm
                      initial={{
                        name:        item.name,
                        description: item.description ?? '',
                        price:       String(item.price_paise / 100),
                        category_id: item.category_id ?? '',
                        is_veg:      item.is_veg,
                      }}
                      categories={categories}
                      onSave={f => void handleEdit(item.id, f)}
                      onCancel={() => setEditingId(null)}
                      saving={saving}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
