'use client';

import { useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

interface Props {
  initialMinutes: number;
}

/** CONV-06: minutes before an unclaimed escalation gets a one-time re-alert + customer holding message. */
export function EscalationReminderSettings({ initialMinutes }: Props) {
  const [minutes, setMinutes] = useState(initialMinutes.toString());
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const supabase = getSupabaseBrowserClient();

  async function handleSave() {
    setError(null);
    const value = Math.floor(Number(minutes));
    if (!Number.isFinite(value) || value <= 0) {
      setError('Enter a positive number of minutes');
      return;
    }

    setSaving(true);
    setSaved(false);
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token ?? '';

    await fetch(
      `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/api/settings/escalation-reminder`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ escalation_reminder_minutes: value }),
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
          If no staff member claims an escalated conversation within this many minutes, a second alert fires once and the customer gets a short holding message.
        </p>
      </div>

      <div className="px-5 py-4 space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Re-alert after (minutes)</p>
        <input
          type="number"
          min={1}
          value={minutes}
          onChange={e => setMinutes(e.target.value)}
          className="w-32 rounded-xl border border-line bg-sunken px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
        />
        {error && <p className="text-xs text-problem">{error}</p>}
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
