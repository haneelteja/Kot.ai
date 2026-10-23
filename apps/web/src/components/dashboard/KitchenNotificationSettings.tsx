'use client';

import { useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { X, Plus } from 'lucide-react';

interface Props {
  initialWaNumbers: string[];
}

/** FUL-01: the actual kitchen staff phone(s) that receive order tickets, sent from the tenant's 'kitchen'-role WhatsApp number. */
export function KitchenNotificationSettings({ initialWaNumbers }: Props) {
  const [waNumbers, setWaNumbers] = useState<string[]>(initialWaNumbers);
  const [waInput, setWaInput]     = useState('');
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);

  const supabase = getSupabaseBrowserClient();

  function addWa() {
    const val = waInput.trim();
    if (!val || waNumbers.includes(val)) return;
    setWaNumbers(prev => [...prev, val]);
    setWaInput('');
  }

  function removeWa(number: string) {
    setWaNumbers(prev => prev.filter(n => n !== number));
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token ?? '';

    await fetch(
      `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/api/settings/notifications`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ kitchen_notification_wa_numbers: waNumbers }),
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
          New paid orders send a ticket with Ready/Problem buttons to these numbers, from your dedicated Kitchen WhatsApp number (set its role in WhatsApp Numbers above). Without a Kitchen number configured, no ticket is sent.
        </p>
      </div>

      <div className="px-5 py-4 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Kitchen phone numbers</p>
        <p className="text-xs text-muted-foreground">Include country code, e.g. +919XXXXXXXXX</p>
        <div className="flex flex-wrap gap-2">
          {waNumbers.map(num => (
            <span key={num} className="flex items-center gap-1.5 text-xs bg-sunken text-text px-2.5 py-1 rounded-full font-mono">
              {num}
              <button type="button" onClick={() => removeWa(num)} className="text-muted-foreground hover:text-red-500 transition-colors">
                <X size={11} />
              </button>
            </span>
          ))}
          {waNumbers.length === 0 && <p className="text-xs text-muted-foreground italic">No numbers configured</p>}
        </div>
        <div className="flex gap-2">
          <input
            type="tel"
            value={waInput}
            onChange={e => setWaInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addWa())}
            placeholder="+919XXXXXXXXX"
            className="flex-1 rounded-xl border border-line bg-sunken px-3 py-2 text-sm text-text placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent font-mono"
          />
          <button
            type="button"
            onClick={addWa}
            className="w-9 h-9 rounded-xl bg-brand-strong text-white flex items-center justify-center hover:opacity-90 transition-colors shrink-0"
          >
            <Plus size={15} />
          </button>
        </div>
      </div>

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
