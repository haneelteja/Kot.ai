import { redirect } from 'next/navigation';
import { BarChart3 } from 'lucide-react';
import { getSession } from '@/lib/session';
import { getAnalyticsSummaryAction } from '@/app/actions/analytics';
import { AnalyticsView } from './AnalyticsView';

export const metadata = { title: 'Analytics' };

export default async function AnalyticsPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const { summary, error } = await getAnalyticsSummaryAction(30);

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-brand-wash flex items-center justify-center shrink-0">
          <BarChart3 size={18} className="text-brand-strong" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-text">Analytics</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Last 30 days — conversion funnel, top items, and bot-vs-human handling.</p>
        </div>
      </div>

      {error ? <p className="text-sm text-problem">{error}</p> : summary ? <AnalyticsView summary={summary} /> : null}
    </div>
  );
}
