'use client';

import { useMemo, useState } from 'react';
import { Minus, Plus, ShoppingCart, Loader2 } from 'lucide-react';

export interface PublicMenuItem {
  id:            string;
  name:          string;
  description:   string | null;
  price_paise:   number;
  category_name: string | null;
  is_veg:        boolean;
  in_stock:      boolean;
}

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

export function MenuOrderClient({ tenantId, menu }: { tenantId: string; menu: PublicMenuItem[] }) {
  const [qty, setQty]           = useState<Record<string, number>>({});
  const [phone, setPhone]       = useState('');
  const [name, setName]         = useState('');
  const [submitting, setSubmit] = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const categories = useMemo(() => {
    const groups = new Map<string, PublicMenuItem[]>();
    for (const item of menu) {
      const key = item.category_name ?? 'Menu';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    }
    return [...groups.entries()];
  }, [menu]);

  const cartLines = useMemo(
    () => menu.filter(m => (qty[m.id] ?? 0) > 0).map(m => ({ item: m, quantity: qty[m.id]! })),
    [menu, qty],
  );
  const totalPaise = cartLines.reduce((sum, l) => sum + l.item.price_paise * l.quantity, 0);

  function setItemQty(id: string, next: number) {
    setQty(prev => ({ ...prev, [id]: Math.max(0, Math.min(20, next)) }));
  }

  async function handleCheckout() {
    setError(null);
    if (cartLines.length === 0) { setError('Add at least one item to your order.'); return; }
    if (!/^\+?[0-9]{8,15}$/.test(phone.trim())) { setError('Enter a valid phone number.'); return; }

    setSubmit(true);
    try {
      const res = await fetch(`${API_URL}/api/public/orders`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          phone: phone.trim(),
          name:  name.trim() || undefined,
          items: cartLines.map(l => ({ menuItemId: l.item.id, quantity: l.quantity })),
        }),
      });
      const data = await res.json() as { error?: string; linkUrl?: string | null; orderRef?: string };
      if (!res.ok || data.error) {
        setError(data.error ?? 'Could not place your order — please try again.');
        setSubmit(false);
        return;
      }
      if (data.linkUrl) {
        window.location.href = data.linkUrl;
      } else {
        setError(null);
        setSubmit(false);
        setQty({});
        alert(`Order ${data.orderRef} placed! Our team will reach out shortly to arrange payment.`);
      }
    } catch {
      setError('Network error — please try again.');
      setSubmit(false);
    }
  }

  return (
    <div className="space-y-5">
      {categories.map(([category, items]) => (
        <div key={category} className="bg-surface border border-line rounded-2xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-line bg-sunken/60">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{category}</p>
          </div>
          <div className="divide-y divide-line">
            {items.map(item => (
              <div key={item.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`inline-block w-2.5 h-2.5 rounded-sm ${item.is_veg ? 'bg-emerald-500' : 'bg-red-500'}`} aria-hidden="true" />
                    <p className="text-sm font-medium text-text truncate">{item.name}</p>
                    {!item.in_stock && <span className="text-[10px] text-muted-foreground">(Out of stock)</span>}
                  </div>
                  {item.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.description}</p>}
                  <p className="text-sm font-semibold text-text mt-1">₹{(item.price_paise / 100).toFixed(2)}</p>
                </div>
                {item.in_stock && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      aria-label={`Decrease ${item.name} quantity`}
                      onClick={() => setItemQty(item.id, (qty[item.id] ?? 0) - 1)}
                      className="w-7 h-7 rounded-lg border border-line flex items-center justify-center text-muted-foreground hover:bg-sunken"
                    >
                      <Minus size={13} />
                    </button>
                    <span className="w-5 text-center text-sm font-medium text-text">{qty[item.id] ?? 0}</span>
                    <button
                      type="button"
                      aria-label={`Increase ${item.name} quantity`}
                      onClick={() => setItemQty(item.id, (qty[item.id] ?? 0) + 1)}
                      className="w-7 h-7 rounded-lg border border-line flex items-center justify-center text-muted-foreground hover:bg-sunken"
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {cartLines.length > 0 && (
        <div className="bg-surface border border-line rounded-2xl p-4 space-y-4 sticky bottom-4 shadow-float">
          <div className="flex items-center gap-2">
            <ShoppingCart size={15} className="text-brand-strong" />
            <p className="text-sm font-semibold text-text">Your Order</p>
          </div>
          <div className="space-y-1">
            {cartLines.map(l => (
              <div key={l.item.id} className="flex justify-between text-sm text-muted-foreground">
                <span>{l.quantity}× {l.item.name}</span>
                <span>₹{((l.item.price_paise * l.quantity) / 100).toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between text-sm font-semibold text-text border-t border-line pt-3">
            <span>Total</span>
            <span>₹{(totalPaise / 100).toFixed(2)}</span>
          </div>

          <div className="space-y-2">
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="Phone number (for order updates)"
              className="w-full text-sm border border-line rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand"
            />
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Name (optional)"
              className="w-full text-sm border border-line rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <button
            type="button"
            onClick={handleCheckout}
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 bg-brand-strong text-white font-semibold text-sm py-2.5 rounded-lg hover:opacity-90 disabled:opacity-60"
          >
            {submitting ? <Loader2 size={15} className="animate-spin" /> : null}
            {submitting ? 'Placing order…' : `Place order — ₹${(totalPaise / 100).toFixed(2)}`}
          </button>
        </div>
      )}
    </div>
  );
}
