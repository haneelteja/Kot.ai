'use client';

import { useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { Plus, Trash2 } from 'lucide-react';

interface QuickReply {
  id:      string;
  label:   string;
  message: string;
}

/** HND-04: canned responses staff can insert into the reply box during a takeover. */
export function QuickRepliesSettings({ initialReplies }: { initialReplies: QuickReply[] }) {
  const [replies, setReplies] = useState(initialReplies);
  const [label, setLabel]     = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy]       = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const supabase = getSupabaseBrowserClient();
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

  async function getToken() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? '';
  }

  async function handleAdd() {
    setError(null);
    if (!label.trim() || !message.trim()) { setError('Both a label and a message are required'); return; }

    setBusy(true);
    const token = await getToken();
    const res = await fetch(`${apiBase}/api/quick-replies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ label: label.trim(), message: message.trim() }),
    });
    setBusy(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: string };
      setError(body.error ?? 'Failed to add quick reply');
      return;
    }
    const data = await res.json() as { quickReply: QuickReply };
    setReplies(prev => [...prev, data.quickReply]);
    setLabel(''); setMessage('');
  }

  async function handleDelete(id: string) {
    setBusy(true);
    const token = await getToken();
    await fetch(`${apiBase}/api/quick-replies/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    setBusy(false);
    setReplies(prev => prev.filter(r => r.id !== id));
  }

  return (
    <div className="divide-y divide-line">
      <div className="px-5 py-4">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Canned responses staff can insert into the reply box while handling a conversation manually.
        </p>
      </div>

      {replies.length > 0 && (
        <div className="divide-y divide-line">
          {replies.map(r => (
            <div key={r.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-medium text-text">{r.label}</p>
                <p className="text-xs text-muted-foreground truncate">{r.message}</p>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(r.id)}
                disabled={busy}
                className="p-1.5 rounded-lg text-problem hover:bg-problem-bg disabled:opacity-50 shrink-0"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="px-5 py-4 space-y-2">
        <input
          type="text"
          value={label}
          onChange={e => setLabel(e.target.value)}
          placeholder="Label, e.g. &quot;Order delay&quot;"
          className="w-full rounded-xl border border-line bg-sunken px-3 py-2 text-sm text-text placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
        />
        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="The message text to insert"
          rows={2}
          className="w-full rounded-xl border border-line bg-sunken px-3 py-2 text-sm text-text placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
        />
        {error && <p className="text-xs text-problem">{error}</p>}
        <button
          type="button"
          onClick={handleAdd}
          disabled={busy}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-brand-strong text-white hover:opacity-90 disabled:opacity-50"
        >
          <Plus size={13} /> Add quick reply
        </button>
      </div>
    </div>
  );
}
