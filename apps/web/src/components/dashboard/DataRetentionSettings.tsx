'use client';

import { useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

interface Props {
  initialDays: number | null;
}

/** PRV-02: null (default) means no purge — opt-in per tenant, never silently enabled. */
export function DataRetentionSettings({ initialDays }: Props) {
  const [enabled, setEnabled] = useState(initialDays !== null);
  const [days, setDays]       = useState(initialDays ?? 365);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);

  const supabase = getSupabaseBrowserClient();

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token ?? '';

    await fetch(
      `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/api/settings/retention`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ chat_retention_days: enabled ? days : null }),
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
          When enabled, a daily job replaces the text of chat messages older than this many days with a redacted placeholder. Conversation records themselves are kept (for order/booking history) — only the message content is anonymized.
        </p>
      </div>

      <div className="px-5 py-4 space-y-3">
        <label className="flex items-center gap-2 text-sm text-text">
          <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} className="rounded border-line" />
          Automatically anonymize old chat messages
        </label>
        {enabled && (
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              value={days}
              onChange={e => setDays(Math.max(1, Number(e.target.value) || 1))}
              className="w-24 rounded-xl border border-line bg-sunken px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
            />
            <span className="text-sm text-muted-foreground">days</span>
          </div>
        )}
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
