import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { AlertTriangle, Clock, IndianRupee, ShoppingBag, CalendarCheck, PackageX, ShoppingCart } from 'lucide-react';
import { getSession } from '@/lib/session';
import { getTodaySummaryAction } from '@/app/actions/today';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending', confirmed: 'Confirmed', preparing: 'Preparing',
  ready: 'Ready', dispatched: 'Dispatched', delivered: 'Delivered', cancelled: 'Cancelled',
};

function StatCard({ icon, label, value, sub }: { icon: ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="bg-surface border border-line rounded-2xl p-4 space-y-1">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-2xl font-bold text-text">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function AttentionRow({ icon, text, href, count }: { icon: ReactNode; text: string; href: string; count: number }) {
  if (count === 0) return null;
  return (
    <Link href={href} className="flex items-center justify-between px-4 py-3 hover:bg-sunken transition-colors">
      <div className="flex items-center gap-2 text-sm text-text">
        {icon}
        <span>{text}</span>
      </div>
      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-problem-bg text-problem ring-1 ring-problem/30">{count}</span>
    </Link>
  );
}

export default async function TodayPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const { summary, error } = await getTodaySummaryAction();

  const needsAttentionCount = summary
    ? summary.overdueComplaints + summary.stuckOrders + summary.uncollectedOrders
    : 0;

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-text">Today</h1>
        <p className="text-sm text-muted-foreground mt-0.5">At a glance — today&apos;s business, since midnight IST.</p>
      </div>

      {error && <p className="text-sm text-problem">{error}</p>}

      {summary && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <StatCard icon={<IndianRupee size={13} />} label="GMV today" value={`₹${summary.gmv.toFixed(0)}`} />
            <StatCard icon={<ShoppingBag size={13} />} label="Orders today" value={String(Object.values(summary.ordersByStatus).reduce((a, b) => a + b, 0))}
              sub={Object.entries(summary.ordersByStatus).map(([s, c]) => `${STATUS_LABELS[s] ?? s}: ${c}`).join(' · ') || 'No orders yet'} />
            <StatCard icon={<CalendarCheck size={13} />} label="Bookings today" value={String(summary.bookingsToday)} />
            <StatCard icon={<PackageX size={13} />} label="Left before paying" value={`₹${summary.abandonedCheckoutValue.toFixed(0)}`}
              sub={summary.abandonedCheckoutCount > 0 ? `${summary.abandonedCheckoutCount} draft(s)` : undefined} />
          </div>

          <div>
            <h2 className="text-sm font-semibold text-text mb-2">Needs attention</h2>
            {needsAttentionCount === 0 && summary.openComplaints === 0 ? (
              <div className="bg-surface border border-line rounded-2xl p-6 text-center">
                <p className="text-sm text-muted-foreground">Nothing needs attention right now.</p>
              </div>
            ) : (
              <div className="bg-surface border border-line rounded-2xl divide-y divide-line">
                <AttentionRow icon={<AlertTriangle size={14} className="text-problem" />} text="Complaints past their SLA" href="/complaints" count={summary.overdueComplaints} />
                <AttentionRow icon={<Clock size={14} className="text-amber-600" />} text="Orders stuck in preparation" href="/orders" count={summary.stuckOrders} />
                <AttentionRow icon={<ShoppingCart size={14} className="text-amber-600" />} text="Orders ready but uncollected" href="/orders" count={summary.uncollectedOrders} />
                {summary.openComplaints > summary.overdueComplaints && (
                  <AttentionRow icon={<AlertTriangle size={14} className="text-muted-foreground" />} text="Other open complaints" href="/complaints" count={summary.openComplaints - summary.overdueComplaints} />
                )}
              </div>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Delivery partner health and POS sync status aren&apos;t shown here yet — neither integration is connected.
          </p>
        </>
      )}
    </div>
  );
}
