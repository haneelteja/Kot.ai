'use client';

import { useState } from 'react';
import { AlertTriangle, Clock, CheckCircle2 } from 'lucide-react';
import {
  resolveComplaintAction,
  type ComplaintRow,
  type ComplaintStatus,
  type ResolutionType,
} from '@/app/actions/complaints';

const STATUS_STYLES: Record<ComplaintStatus, string> = {
  open:        'bg-amber-50 text-amber-700 ring-amber-200',
  in_progress: 'bg-progress-bg text-progress ring-progress/30',
  resolved:    'bg-done-bg text-done ring-done/30',
  rejected:    'bg-neutral-bg text-neutral ring-line',
};

const CATEGORY_LABELS: Record<string, string> = {
  wrong_item:    'Wrong item',
  missing_item:  'Missing item',
  quality:       'Quality',
  late:          'Late',
  other:         'Other',
};

const RESOLUTION_OPTIONS: Array<{ value: ResolutionType; label: string }> = [
  { value: 'refund',    label: 'Refund (processed manually)' },
  { value: 'coupon',    label: 'Coupon' },
  { value: 'redeliver', label: 'Redeliver' },
  { value: 'none',      label: 'No action' },
];

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

function ResolveForm({ id, onDone }: { id: string; onDone: (resolution: ResolutionType, notes: string | null) => void }) {
  const [resolution, setResolution] = useState<ResolutionType>('refund');
  const [notes, setNotes]           = useState('');
  const [busy, setBusy]             = useState(false);
  const [error, setError]           = useState<string | null>(null);

  async function handleSubmit() {
    setBusy(true);
    setError(null);
    const result = await resolveComplaintAction(id, resolution, notes.trim() || undefined);
    setBusy(false);
    if (result.error) { setError(result.error); return; }
    onDone(resolution, notes.trim() || null);
  }

  return (
    <div className="mt-3 pt-3 border-t border-line space-y-2">
      <div className="flex items-center gap-2">
        <select
          value={resolution}
          onChange={e => setResolution(e.target.value as ResolutionType)}
          className="text-xs rounded-lg border border-line px-2 py-1.5 bg-surface text-text"
        >
          {RESOLUTION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <button
          type="button"
          disabled={busy}
          onClick={handleSubmit}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-done hover:bg-done-bg disabled:opacity-50"
        >
          <CheckCircle2 size={13} /> Resolve &amp; notify customer
        </button>
      </div>
      <textarea
        value={notes}
        onChange={e => setNotes(e.target.value)}
        placeholder="Optional note to include in the customer's message"
        rows={2}
        className="w-full text-xs rounded-lg border border-line px-2 py-1.5 bg-surface text-text placeholder:text-muted-foreground"
      />
      {error && <p className="text-xs text-problem">{error}</p>}
    </div>
  );
}

export function ComplaintsManager({ initialComplaints }: { initialComplaints: ComplaintRow[] }) {
  const [complaints, setComplaints] = useState(initialComplaints);
  const [filter, setFilter]         = useState<'open' | 'all'>('open');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const now = Date.now();
  const visible = filter === 'open'
    ? complaints.filter(c => c.status === 'open' || c.status === 'in_progress')
    : complaints;

  function handleResolved(id: string, resolutionType: ResolutionType, notes: string | null) {
    setComplaints(prev => prev.map(c => c.id === id ? { ...c, status: 'resolved', resolution_type: resolutionType, resolution_notes: notes } : c));
    setExpandedId(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {([{ value: 'open', label: 'Open' }, { value: 'all', label: 'All' }] as const).map(f => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
              filter === f.value ? 'bg-brand-strong text-white' : 'bg-sunken text-muted-foreground hover:text-text'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="bg-surface border border-line rounded-2xl p-8 text-center">
          <p className="text-sm text-muted-foreground">No {filter === 'open' ? 'open ' : ''}complaints.</p>
        </div>
      ) : (
        <div className="bg-surface border border-line rounded-2xl divide-y divide-line">
          {visible.map(c => {
            const isOverdue = (c.status === 'open' || c.status === 'in_progress') && new Date(c.sla_due_at).getTime() < now;
            return (
              <div key={c.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium text-text">{c.contact?.name ?? c.contact?.phone ?? 'Unknown'}</span>
                      <span className="text-xs text-muted-foreground">{CATEGORY_LABELS[c.category] ?? c.category}</span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ring-1 capitalize ${STATUS_STYLES[c.status]}`}>
                        {c.status.replace('_', ' ')}
                      </span>
                      {isOverdue && (
                        <span className="flex items-center gap-0.5 text-[10px] font-semibold px-2 py-0.5 rounded-full ring-1 bg-problem-bg text-problem ring-problem/30">
                          <AlertTriangle size={10} /> SLA overdue
                        </span>
                      )}
                    </div>
                    {c.description && <p className="text-xs text-muted-foreground mt-1">{c.description}</p>}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                      {c.order?.order_ref && <span>Order #{c.order.order_ref}</span>}
                      <span className="flex items-center gap-1"><Clock size={11} /> {fmtDate(c.created_at)}</span>
                    </div>
                    {c.status === 'resolved' && c.resolution_type && (
                      <p className="text-xs text-done mt-1">Resolved: {c.resolution_type}{c.resolution_notes ? ` — ${c.resolution_notes}` : ''}</p>
                    )}
                  </div>

                  {(c.status === 'open' || c.status === 'in_progress') && (
                    <button
                      type="button"
                      onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
                      className="shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-medium text-brand-strong hover:bg-sunken"
                    >
                      {expandedId === c.id ? 'Cancel' : 'Resolve'}
                    </button>
                  )}
                </div>

                {expandedId === c.id && (
                  <ResolveForm id={c.id} onDone={(resolution, notes) => handleResolved(c.id, resolution, notes)} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
