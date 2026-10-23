'use client';

import { useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { X, Plus } from 'lucide-react';

interface Props {
  initialEmails:    string[];
  initialWaNumbers: string[];
  /** UTC hour (0-23) the report sends at; null = platform default (8 AM UTC). */
  initialHourUtc?:  number | null;
  /** Show the send-time picker — only meaningful for restaurant tenants (OWN-02); others keep the fixed default. */
  showTimeField?:   boolean;
}

const DEFAULT_HOUR_UTC            = 8;  // platform default (non-restaurant tenants)
const DEFAULT_RESTAURANT_HOUR_UTC = 17; // ≈ 10:30 PM IST, close to the flow map's "11 PM" at this job's hour-only granularity

export function DailyReportSettings({ initialEmails, initialWaNumbers, initialHourUtc, showTimeField }: Props) {
  const [emails, setEmails]       = useState<string[]>(initialEmails);
  const [waNumbers, setWaNumbers] = useState<string[]>(initialWaNumbers);
  const [emailInput, setEmailInput] = useState('');
  const [waInput, setWaInput]       = useState('');
  const [hourUtc, setHourUtc]       = useState<number>(
    initialHourUtc ?? (showTimeField ? DEFAULT_RESTAURANT_HOUR_UTC : DEFAULT_HOUR_UTC),
  );
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
          daily_report_emails:     emails,
          daily_report_wa_numbers: waNumbers,
          ...(showTimeField ? { daily_report_hour_utc: hourUtc } : {}),
        }),
      }
    );

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  // Label each UTC hour with its approximate IST equivalent (UTC+5:30, shown
  // on the half-hour since the job runs on the UTC hour) — this audience is
  // India-based restaurants, so IST is the useful frame of reference even
  // though the value stored/sent is plain UTC.
  const hourOptions = Array.from({ length: 24 }, (_, utcHour) => {
    const istHour = (utcHour + 5) % 24;
    const istLabel = `${((istHour % 12) || 12)}:30 ${istHour < 12 ? 'AM' : 'PM'} IST`;
    return { utcHour, label: istLabel };
  });

  return (
    <div className="divide-y divide-line">
      {/* Hint */}
      <div className="px-5 py-4">
        <p className="text-xs text-muted-foreground leading-relaxed">
          The report includes new conversations, open/escalated/resolved counts, leads captured, and
          pending escalations{showTimeField ? ' — plus, for restaurants, orders, revenue, top dish, and bookings' : ''}.
          If no emails are configured, it falls back to the workspace admin.
        </p>
      </div>

      {showTimeField && (
        <div className="px-5 py-4 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Send time</p>
          <select
            aria-label="Daily report send time"
            value={hourUtc}
            onChange={e => setHourUtc(Number(e.target.value))}
            className="w-full max-w-xs rounded-xl border border-line bg-sunken px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-brand"
          >
            {hourOptions.map(o => (
              <option key={o.utcHour} value={o.utcHour}>{o.label}</option>
            ))}
          </select>
          <p className="text-[11px] text-muted-foreground">Default is close to end-of-service (11 PM IST).</p>
        </div>
      )}

      {/* Emails */}
      <div className="px-5 py-4 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Report emails</p>
        <div className="flex flex-wrap gap-2">
          {emails.map(email => (
            <span key={email} className="flex items-center gap-1.5 text-xs bg-sunken text-text px-2.5 py-1 rounded-full">
              {email}
              <button type="button" onClick={() => removeEmail(email)} className="text-muted-foreground hover:text-red-500 transition-colors">
                <X size={11} />
              </button>
            </span>
          ))}
          {emails.length === 0 && <p className="text-xs text-muted-foreground italic">Falls back to workspace admin</p>}
        </div>
        <div className="flex gap-2">
          <input
            type="email"
            value={emailInput}
            onChange={e => setEmailInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addEmail())}
            placeholder="manager@company.com"
            className="flex-1 rounded-xl border border-line bg-sunken px-3 py-2 text-sm text-text placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
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
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Report WhatsApp numbers</p>
        <p className="text-xs text-muted-foreground">Receives a compact daily summary. Include country code, e.g. +919XXXXXXXXX</p>
        <div className="flex flex-wrap gap-2">
          {waNumbers.map(num => (
            <span key={num} className="flex items-center gap-1.5 text-xs bg-sunken text-text px-2.5 py-1 rounded-full font-mono">
              {num}
              <button type="button" onClick={() => removeWa(num)} className="text-muted-foreground hover:text-red-500 transition-colors">
                <X size={11} />
              </button>
            </span>
          ))}
          {waNumbers.length === 0 && <p className="text-xs text-muted-foreground italic">No WhatsApp numbers configured</p>}
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
