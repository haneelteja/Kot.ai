import { redirect } from 'next/navigation';
import { ClipboardList } from 'lucide-react';
import { getSession } from '@/lib/session';
import { getClientAuditLogsAction } from '@/app/actions/audit';
import { AuditLogTable } from '@/components/platform/AuditLogTable';

export const metadata = { title: 'Activity Log' };

export default async function ClientAuditPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  if (!['admin', 'client_manager'].includes(session.role)) {
    redirect('/dashboard');
  }

  const { logs, error } = await getClientAuditLogsAction(300);

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-brand-wash flex items-center justify-center shrink-0">
          <ClipboardList size={18} className="text-brand-strong" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-text">Activity Log</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            All actions taken in your workspace — bot changes, team invites, campaigns, guardrail updates. Last 300 events.
          </p>
        </div>
      </div>

      <div className="bg-surface rounded-2xl border border-line p-5">
        {error ? (
          <p className="text-sm text-problem">{error}</p>
        ) : (
          <AuditLogTable logs={logs} showTenant={false} />
        )}
      </div>
    </div>
  );
}
