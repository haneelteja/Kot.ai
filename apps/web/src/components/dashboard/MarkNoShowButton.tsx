'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Ban } from 'lucide-react';
import { updateOrderStatusAction } from '@/app/actions/orders';

/** TKW-03: close an uncollected pickup order as a no-show (no refund by default — matches the acceptance criteria). */
export function MarkNoShowButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      onClick={() => startTransition(async () => {
        await updateOrderStatusAction(orderId, 'cancelled');
        router.refresh();
      })}
      disabled={pending}
      title="Mark as no-show (closes the order, no refund by default)"
      className="p-1.5 rounded-md hover:bg-problem-bg text-muted-foreground hover:text-problem transition-colors disabled:opacity-50"
    >
      <Ban size={13} />
    </button>
  );
}
