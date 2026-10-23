import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { getBookingsAction } from '@/app/actions/bookings';
import { BookingsManager } from './BookingsManager';

export default async function BookingsPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const { bookings } = await getBookingsAction();

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-text">Bookings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Table booking requests captured by the WhatsApp bot. No availability/capacity check is performed — confirm seating directly with the customer.
        </p>
      </div>
      <BookingsManager initialBookings={bookings} />
    </div>
  );
}
