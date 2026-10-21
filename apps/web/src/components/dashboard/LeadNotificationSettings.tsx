'use client';

import { useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { X, Plus } from 'lucide-react';

interface Props {
  initialEmails: string[];
  initialWaNumbers: string[];
}

export function LeadNotificationSettings({ initialEmails, initialWaNumbers }: Props) {
  const [emails, setEmails]       = useState<string[]>(initialEmails);
  const [waNumbers, setWaNumbers] = useState<string[]>(initialWaNumbers);
  const [emailInput, setEmailInput] = useState('');
  const [waInput, setWaInput]       = useState('');
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);

  const supabase = getSupabaseBrowserClient();

  function addEmail() {
    const val = emailInput.trim().toLowerCase();
    if (!val || emails.includes(val)) return;
    setEmails(prev => [...prev, val]);
    setEmailInput('');
  }

  function removeEmail(email: string) {
    setEmails(prev => prev.filter(e => e !== email));
  }

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
        body: JSON.stringify({
          lead_notification_emails:     emails,
          lead_notification_wa_numbers: waNumbers,
        }),
      }
    );

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div className="divide-y divide-gray-100">
      {/* Emails */}
      <div className="px-5 py-4 space-y-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Alert emails</p>
        <div className="flex flex-wrap gap-2">
          {emails.map(email => (
            <span key={email} className="flex items-center gap-1.5 text-xs bg-gray-100 text-gray-700 px-2.5 py-1 rounded-full">
              {email}
              <button type="button" onClick={() => removeEmail(email)} className="text-gray-400 hover:text-red-500 transition-colors">
                <X size={11} />
              </button>
            </span>
          ))}
          {emails.length === 0 && <p className="text-xs text-gray-400 italic">No emails configured</p>}
        </div>
        <div className="flex gap-2">
          <input
            type="email"
            value={emailInput}
            onChange={e => setEmailInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addEmail())}
            placeholder="sales@company.com"
            className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
          />
          <button
            type="button"
            onClick={addEmail}
            className="w-9 h-9 rounded-xl bg-brand-strong text-white flex items-center justify-center hover:opacity-90 transition-colors shrink-0"
          >
            <Plus size={15} />
          </button>
        </div>
      </div>

      {/* WhatsApp numbers */}
      <div className="px-5 py-4 space-y-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Alert WhatsApp numbers</p>
        <p className="text-xs text-gray-400">Include country code, e.g. +919XXXXXXXXX</p>
        <div className="flex flex-wrap gap-2">
          {waNumbers.map(num => (
            <span key={num} className="flex items-center gap-1.5 text-xs bg-gray-100 text-gray-700 px-2.5 py-1 rounded-full font-mono">
              {num}
              <button type="button" onClick={() => removeWa(num)} className="text-gray-400 hover:text-red-500 transition-colors">
                <X size={11} />
              </button>
            </span>
          ))}
          {waNumbers.length === 0 && <p className="text-xs text-gray-400 italic">No numbers configured</p>}
        </div>
        <div className="flex gap-2">
          <input
            type="tel"
            value={waInput}
            onChange={e => setWaInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addWa())}
            placeholder="+919XXXXXXXXX"
            className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent font-mono"
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

      {/* Save */}
      <div className="px-5 py-4 flex items-center justify-between">
        <p className={`text-xs transition-opacity ${saved ? 'text-done opacity-100' : 'opacity-0'}`}>
          Saved successfully
        </p>
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
