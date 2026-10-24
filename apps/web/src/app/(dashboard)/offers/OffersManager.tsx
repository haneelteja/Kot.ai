'use client';

import { useState } from 'react';
import { Plus, Trash2, Tag } from 'lucide-react';
import {
  createCouponAction,
  toggleCouponActiveAction,
  deleteCouponAction,
  getCouponsAction,
  type Coupon,
  type CouponType,
} from '@/app/actions/coupons';

function formatValue(coupon: Coupon): string {
  if (coupon.type === 'percent') return `${(coupon.value / 100).toFixed(0)}% off`;
  if (coupon.type === 'flat') return `₹${(coupon.value / 100).toFixed(0)} off`;
  return 'Free delivery';
}

function CreateForm({ onCreated }: { onCreated: () => void }) {
  const [code, setCode]           = useState('');
  const [type, setType]           = useState<CouponType>('percent');
  const [value, setValue]         = useState('');
  const [maxUses, setMaxUses]     = useState('');
  const [minOrder, setMinOrder]   = useState('');
  const [busy, setBusy]           = useState(false);
  const [error, setError]         = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    if (!code.trim()) { setError('Enter a coupon code'); return; }

    const rawValue = Number(value);
    const apiValue = type === 'percent' ? Math.round(rawValue * 100) : type === 'flat' ? Math.round(rawValue * 100) : 0;
    if (type !== 'free_delivery' && (!Number.isFinite(apiValue) || apiValue < 0)) {
      setError('Enter a valid value');
      return;
    }

    setBusy(true);
    const result = await createCouponAction({
      code: code.trim(),
      type,
      value: apiValue,
      maxUses: maxUses.trim() ? Math.max(1, Math.floor(Number(maxUses))) : null,
      minOrderValuePaise: minOrder.trim() ? Math.round(Number(minOrder) * 100) : 0,
      expiresAt: null,
    });
    setBusy(false);
    if (result.error) { setError(result.error); return; }

    setCode(''); setValue(''); setMaxUses(''); setMinOrder('');
    onCreated();
  }

  return (
    <div className="bg-surface border border-line rounded-2xl p-4 space-y-3">
      <p className="text-sm font-semibold text-text">New coupon</p>
      <div className="grid grid-cols-2 gap-2">
        <input
          type="text"
          value={code}
          onChange={e => setCode(e.target.value)}
          placeholder="CODE10"
          className="rounded-lg border border-line bg-sunken px-3 py-2 text-sm text-text uppercase placeholder:normal-case placeholder:text-muted-foreground"
        />
        <select
          value={type}
          onChange={e => setType(e.target.value as CouponType)}
          className="rounded-lg border border-line bg-sunken px-3 py-2 text-sm text-text"
        >
          <option value="percent">Percent off</option>
          <option value="flat">Flat amount off</option>
          <option value="free_delivery">Free delivery</option>
        </select>
        {type !== 'free_delivery' && (
          <input
            type="number"
            min={0}
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder={type === 'percent' ? 'e.g. 10 for 10%' : 'e.g. 50 for ₹50'}
            className="rounded-lg border border-line bg-sunken px-3 py-2 text-sm text-text placeholder:text-muted-foreground"
          />
        )}
        <input
          type="number"
          min={1}
          value={maxUses}
          onChange={e => setMaxUses(e.target.value)}
          placeholder="Max uses (blank = unlimited)"
          className="rounded-lg border border-line bg-sunken px-3 py-2 text-sm text-text placeholder:text-muted-foreground"
        />
        <input
          type="number"
          min={0}
          value={minOrder}
          onChange={e => setMinOrder(e.target.value)}
          placeholder="Min order value ₹ (blank = none)"
          className="rounded-lg border border-line bg-sunken px-3 py-2 text-sm text-text placeholder:text-muted-foreground col-span-2"
        />
      </div>
      {error && <p className="text-xs text-problem">{error}</p>}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={busy}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-brand-strong text-white hover:opacity-90 disabled:opacity-50"
      >
        <Plus size={13} /> Create coupon
      </button>
    </div>
  );
}

export function OffersManager({ initialCoupons }: { initialCoupons: Coupon[] }) {
  const [coupons, setCoupons]   = useState(initialCoupons);
  const [showForm, setShowForm] = useState(false);
  const [busyId, setBusyId]     = useState<string | null>(null);

  async function refresh() {
    setShowForm(false);
    const { coupons: fresh } = await getCouponsAction();
    setCoupons(fresh);
  }

  async function handleToggle(id: string, active: boolean) {
    setBusyId(id);
    await toggleCouponActiveAction(id, active);
    setBusyId(null);
    setCoupons(prev => prev.map(c => c.id === id ? { ...c, active } : c));
  }

  async function handleDelete(id: string) {
    setBusyId(id);
    const result = await deleteCouponAction(id);
    setBusyId(null);
    if (!result.error) await refresh();
  }

  return (
    <div className="space-y-4">
      {showForm ? (
        <CreateForm onCreated={refresh} />
      ) : (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-brand-strong text-white hover:opacity-90"
        >
          <Plus size={13} /> New coupon
        </button>
      )}

      {coupons.length === 0 ? (
        <div className="bg-surface border border-line rounded-2xl p-8 text-center">
          <p className="text-sm text-muted-foreground">No coupons yet.</p>
        </div>
      ) : (
        <div className="bg-surface border border-line rounded-2xl divide-y divide-line">
          {coupons.map(c => (
            <div key={c.id} className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="min-w-0 flex items-center gap-3">
                <Tag size={14} className={c.active ? 'text-brand-strong' : 'text-muted-foreground'} />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-text">{c.code}</span>
                    <span className="text-xs text-muted-foreground">{formatValue(c)}</span>
                    {!c.active && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-neutral-bg text-neutral ring-1 ring-line">Inactive</span>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {c.uses_count} used{c.max_uses !== null ? ` / ${c.max_uses} max` : ''}
                    {c.min_order_value_paise > 0 ? ` · min ₹${(c.min_order_value_paise / 100).toFixed(0)}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  disabled={busyId === c.id}
                  onClick={() => handleToggle(c.id, !c.active)}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:bg-sunken disabled:opacity-50"
                >
                  {c.active ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  type="button"
                  disabled={busyId === c.id}
                  onClick={() => handleDelete(c.id)}
                  title={c.uses_count > 0 ? 'Already used — will be deactivated instead of deleted' : 'Delete'}
                  className="p-1.5 rounded-lg text-problem hover:bg-problem-bg disabled:opacity-50"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
