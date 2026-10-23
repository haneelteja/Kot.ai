'use client';

import { useState, useTransition } from 'react';
import { Users, Calendar, Clock, CheckCircle2, XCircle, Ban } from 'lucide-react';
import { updateBookingStatusAction, type BookingRow, type BookingStatus } from '@/app/actions/bookings';

const STATUS_STYLES: Record<BookingStatus, string> = {
  pending:   'bg-amber-50 text-amber-700 ring-amber-200',
  confirmed: 'bg-progress-bg text-progress ring-progress/30',
  cancelled: 'bg-red-50 text-red-600 ring-red-200',
  seated:    'bg-done-bg text-done ring-done/30',
  no_show:   'bg-neutral-bg text-neutral ring-line',
};

const FILTERS: Array<{ value: 'upcoming' | 'all'; label: string }> = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'all',      label: 'All' },
];

function fmtDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function BookingsManager({ initialBookings }: { initialBookings: BookingRow[] }) {
  const [bookings, setBookings] = useState(initialBookings);
  const [filter, setFilter]     = useState<'upcoming' | 'all'>('upcoming');
  const [busyId, setBusyId]     = useState<string | null>(null);
  const [error, setError]       = useState<string | null>(null);
  const [, startTransition]     = useTransition();

  const today = new Date().toISOString().slice(0, 10);
  const visible = filter === 'upcoming'
    ? bookings.filter(b => b.booking_date >= today && !['cancelled', 'no_show'].includes(b.status))
    : bookings;

  async function handleStatus(id: string, status: 'seated' | 'no_show' | 'cancelled') {
    setBusyId(id);
    setError(null);
    const result = await updateBookingStatusAction(id, status);
    setBusyId(null);
    if (result.error) { setError(result.error); return; }
    startTransition(() => setBookings(prev => prev.map(b => b.id === id ? { ...b, status } : b)));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {FILTERS.map(f => (
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

      {error && <p className="text-sm text-problem">{error}</p>}

      {visible.length === 0 ? (
        <div className="bg-surface border border-line rounded-2xl p-8 text-center">
          <p className="text-sm text-muted-foreground">No bookings {filter === 'upcoming' ? 'upcoming' : 'yet'}.</p>
        </div>
      ) : (
        <div className="bg-surface border border-line rounded-2xl divide-y divide-line">
          {visible.map(b => (
            <div key={b.id} className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-3 text-sm">
                  <span className="font-medium text-text">{b.contact?.name ?? b.contact?.phone ?? 'Unknown'}</span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ring-1 capitalize ${STATUS_STYLES[b.status]}`}>
                    {b.status.replace('_', ' ')}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                  <span className="flex items-center gap-1"><Calendar size={11} /> {fmtDate(b.booking_date)}</span>
                  <span className="flex items-center gap-1"><Clock size={11} /> {b.booking_time.slice(0, 5)}</span>
                  <span className="flex items-center gap-1"><Users size={11} /> {b.party_size}</span>
                </div>
                {b.notes && <p className="text-xs text-muted-foreground mt-1 italic">{b.notes}</p>}
              </div>

              {!['seated', 'no_show', 'cancelled'].includes(b.status) && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    disabled={busyId === b.id}
                    onClick={() => handleStatus(b.id, 'seated')}
                    title="Mark seated"
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-done hover:bg-done-bg disabled:opacity-50"
                  >
                    <CheckCircle2 size={13} /> Seated
                  </button>
                  <button
                    type="button"
                    disabled={busyId === b.id}
                    onClick={() => handleStatus(b.id, 'no_show')}
                    title="Mark no-show"
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:bg-sunken disabled:opacity-50"
                  >
                    <XCircle size={13} /> No-show
                  </button>
                  <button
                    type="button"
                    disabled={busyId === b.id}
                    onClick={() => handleStatus(b.id, 'cancelled')}
                    title="Cancel booking"
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-problem hover:bg-problem-bg disabled:opacity-50"
                  >
                    <Ban size={13} /> Cancel
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
