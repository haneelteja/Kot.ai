import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { getCouponsAction } from '@/app/actions/coupons';
import { OffersManager } from './OffersManager';

export const metadata = { title: 'Offers' };

export default async function OffersPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const { coupons, error } = await getCouponsAction();

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-text">Offers</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Coupon codes customers can apply in WhatsApp or on your web ordering page — percent off, flat amount off, or free delivery.
        </p>
      </div>
      {error ? <p className="text-sm text-problem">{error}</p> : <OffersManager initialCoupons={coupons} />}
    </div>
  );
}
