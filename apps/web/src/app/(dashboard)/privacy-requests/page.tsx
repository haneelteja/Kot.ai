import { redirect } from 'next/navigation';
import { Shield } from 'lucide-react';
import { getSession } from '@/lib/session';
import { PrivacyRequestsManager } from './PrivacyRequestsManager';

export const metadata = { title: 'Data Requests' };

export default async function PrivacyRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ phone?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!['admin', 'client_admin', 'client_manager'].includes(session.role)) redirect('/dashboard');

  const { phone } = await searchParams;

  return (
    <div className="p-6 lg:p-8 max-w-2xl mx-auto space-y-6">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-brand-wash flex items-center justify-center shrink-0">
          <Shield size={18} className="text-brand-strong" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-text">Data Requests</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Look up a customer by phone number to export their data or process a deletion request (PRV-03). Every action here is logged to the Activity Log.
          </p>
        </div>
      </div>

      <PrivacyRequestsManager initialPhone={phone} />
    </div>
  );
}
