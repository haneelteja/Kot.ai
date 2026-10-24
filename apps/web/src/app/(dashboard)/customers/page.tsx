import { redirect } from 'next/navigation';
import { Users } from 'lucide-react';
import { getSession } from '@/lib/session';
import { getCustomersAction } from '@/app/actions/customers';
import { CustomersTable } from './CustomersTable';

export const metadata = { title: 'Customers' };

export default async function CustomersPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const { customers, error } = await getCustomersAction();

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-brand-wash flex items-center justify-center shrink-0">
          <Users size={18} className="text-brand-strong" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-text">Customers</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Everyone who has messaged your WhatsApp bot — order count, spend, and marketing opt-in status.
          </p>
        </div>
      </div>

      {error ? <p className="text-sm text-problem">{error}</p> : <CustomersTable customers={customers} />}
    </div>
  );
}
