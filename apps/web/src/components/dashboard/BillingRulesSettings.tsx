'use client';

import { useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

interface Props {
  initialTaxRateBp:          number;
  initialPackingChargePaise: number;
  initialMinOrderValuePaise: number;
  initialMaxOrderValuePaise: number | null;
}

/** PRC-01/PRC-05: tax rate, packing charge, and min/max order value — all server-side, never client-trusted, applied to every checkout. */
export function BillingRulesSettings({ initialTaxRateBp, initialPackingChargePaise, initialMinOrderValuePaise, initialMaxOrderValuePaise }: Props) {
  const [taxPercent, setTaxPercent] = useState((initialTaxRateBp / 100).toString());
  const [packingRupees, setPackingRupees] = useState((initialPackingChargePaise / 100).toString());
  const [minOrderRupees, setMinOrderRupees] = useState((initialMinOrderValuePaise / 100).toString());
  const [maxOrderRupees, setMaxOrderRupees] = useState(initialMaxOrderValuePaise !== null ? (initialMaxOrderValuePaise / 100).toString() : '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const supabase = getSupabaseBrowserClient();

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError(null);

    const taxRateBp = Math.round(Number(taxPercent) * 100);
    const packingChargePaise = Math.round(Number(packingRupees) * 100);
    const minOrderValuePaise = Math.round(Number(minOrderRupees) * 100);
    const maxOrderValuePaise = maxOrderRupees.trim() === '' ? null : Math.round(Number(maxOrderRupees) * 100);
    if (!Number.isFinite(taxRateBp) || taxRateBp < 0 || taxRateBp > 10000) {
      setSaving(false);
      setError('Tax rate must be between 0% and 100%');
      return;
    }
    if (!Number.isFinite(packingChargePaise) || packingChargePaise < 0) {
      setSaving(false);
      setError('Packing charge must be 0 or more');
      return;
    }
    if (!Number.isFinite(minOrderValuePaise) || minOrderValuePaise < 0) {
      setSaving(false);
      setError('Minimum order value must be 0 or more');
      return;
    }
    if (maxOrderValuePaise !== null && (!Number.isFinite(maxOrderValuePaise) || maxOrderValuePaise <= 0)) {
      setSaving(false);
      setError('Maximum order value must be greater than 0, or left blank');
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token ?? '';

    await fetch(
      `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/api/settings/billing`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          tax_rate_bp: taxRateBp, packing_charge_paise: packingChargePaise,
          min_order_value_paise: minOrderValuePaise, max_order_value_paise: maxOrderValuePaise,
        }),
      }
    );

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div className="divide-y divide-line">
      <div className="px-5 py-4">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Both apply automatically to every order and payment link — in WhatsApp and on your web ordering page. Leave at 0 if you don&apos;t charge these separately.
        </p>
      </div>

      <div className="px-5 py-4 space-y-3">
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Tax rate (%)</p>
          <input
            type="number"
            min={0}
            max={100}
            step="0.01"
            value={taxPercent}
            onChange={e => setTaxPercent(e.target.value)}
            className="w-32 rounded-xl border border-line bg-sunken px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
          />
        </div>
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Packing charge (₹ per order)</p>
          <input
            type="number"
            min={0}
            step="0.01"
            value={packingRupees}
            onChange={e => setPackingRupees(e.target.value)}
            className="w-32 rounded-xl border border-line bg-sunken px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
          />
        </div>
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Minimum order value (₹)</p>
          <input
            type="number"
            min={0}
            step="0.01"
            value={minOrderRupees}
            onChange={e => setMinOrderRupees(e.target.value)}
            placeholder="0 = no minimum"
            className="w-32 rounded-xl border border-line bg-sunken px-3 py-2 text-sm text-text placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
          />
        </div>
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Maximum order value (₹, sanity check)</p>
          <input
            type="number"
            min={0}
            step="0.01"
            value={maxOrderRupees}
            onChange={e => setMaxOrderRupees(e.target.value)}
            placeholder="Blank = no limit"
            className="w-32 rounded-xl border border-line bg-sunken px-3 py-2 text-sm text-text placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
          />
        </div>
      </div>

      {error && <p className="px-5 py-2 text-xs text-problem">{error}</p>}

      <div className="px-5 py-4 flex items-center justify-between">
        <p className={`text-xs transition-opacity ${saved ? 'text-done opacity-100' : 'opacity-0'}`}>Saved successfully</p>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2 rounded-xl bg-brand-strong text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}
