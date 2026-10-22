'use client';

import { useState, useTransition } from 'react';
import { Plus, Trash2, Phone, Ban } from 'lucide-react';
import { addBlockedNumber, removeBlockedNumber } from '@/app/actions/automation';
import type { BlockedNumber } from '@/app/actions/automation';

export function BlockedNumbersManager({
  initialNumbers,
}: {
  initialNumbers: BlockedNumber[];
}) {
  const [numbers, setNumbers] = useState<BlockedNumber[]>(initialNumbers);
  const [phone, setPhone]     = useState('');
  const [reason, setReason]   = useState('');
  const [error, setError]     = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleAdd() {
    setError(null);
    startTransition(async () => {
      const res = await addBlockedNumber(phone, reason);
      if (res.error) { setError(res.error); return; }
      setNumbers(prev => [...prev, res.number!]);
      setPhone('');
      setReason('');
    });
  }

  function handleRemove(id: string) {
    const prev = numbers;
    setNumbers(cur => cur.filter(n => n.id !== id));
    startTransition(async () => {
      const res = await removeBlockedNumber(id);
      if (res.error) setNumbers(prev);
    });
  }

  return (
    <div className="divide-y divide-line">
      <div className="px-5 py-4 flex items-start gap-3 bg-problem-bg">
        <Ban size={14} className="text-problem mt-0.5 shrink-0" />
        <p className="text-xs text-problem leading-relaxed">
          Messages from these numbers are <strong>silently dropped</strong> — no bot reply at all. Use this to stop an abusive or spam number from reaching your bot. Takes up to 5 minutes to apply (cached).
        </p>
      </div>

      {numbers.length > 0 && (
        <div className="divide-y divide-line">
          {numbers.map(n => (
            <div key={n.id} className="flex items-center gap-3 px-5 py-3">
              <div className="w-8 h-8 rounded-full bg-sunken flex items-center justify-center shrink-0">
                <Phone size={13} className="text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text font-mono">{n.phone}</p>
                {n.reason && <p className="text-xs text-muted-foreground truncate">{n.reason}</p>}
              </div>
              <button
                onClick={() => handleRemove(n.id)}
                disabled={isPending}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-problem-bg hover:text-problem transition-colors disabled:opacity-40"
                title="Unblock"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {numbers.length === 0 && (
        <div className="px-5 py-6 text-center">
          <p className="text-xs text-muted-foreground">No blocked numbers.</p>
        </div>
      )}

      <div className="px-5 py-4 space-y-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="+919876543210"
            className="flex-1 text-sm border border-line rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand font-mono"
          />
          <input
            type="text"
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Reason (optional)"
            className="flex-1 text-sm border border-line rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand"
          />
          <button
            onClick={handleAdd}
            disabled={isPending || !phone.trim()}
            className="flex items-center gap-1.5 px-3 py-2 bg-brand-strong text-white text-xs font-semibold rounded-lg hover:opacity-90 disabled:opacity-40 transition-colors shrink-0"
          >
            <Plus size={13} />
            Block
          </button>
        </div>
        {error && <p className="text-xs text-problem">{error}</p>}
      </div>
    </div>
  );
}
