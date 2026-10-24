import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { getComplaintsAction } from '@/app/actions/complaints';
import { ComplaintsManager } from './ComplaintsManager';

export default async function ComplaintsPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const { complaints } = await getComplaintsAction();

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-text">Complaints</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Order issues reported by customers over WhatsApp, with a 24-hour SLA timer on each open ticket.
        </p>
      </div>
      <ComplaintsManager initialComplaints={complaints} />
    </div>
  );
}
