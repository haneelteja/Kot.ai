'use client';

import { useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

interface Props {
  initialUrl: string;
}

/** PRV-01: the link included in the one-time privacy notice sent on a contact's first-ever message. */
export function PrivacyNoticeSettings({ initialUrl }: Props) {
  const [url, setUrl]       = useState(initialUrl);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);

  const supabase = getSupabaseBrowserClient();

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
        body: JSON.stringify({ privacy_notice_url: url.trim() || null }),
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
          A one-line privacy notice is sent automatically on a customer&apos;s very first message, with this link included. Leave blank to send the notice without a link.
        </p>
      </div>

      <div className="px-5 py-4 space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Privacy notice URL</p>
        <input
          type="url"
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder="https://yourrestaurant.com/privacy"
          className="w-full rounded-xl border border-line bg-sunken px-3 py-2 text-sm text-text placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
        />
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
