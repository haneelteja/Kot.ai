'use client';

import { useState, useTransition } from 'react';
import { updateOrderStatusAction, type OrderStatus } from '@/app/actions/orders';

const STATUS_STYLES: Record<OrderStatus, string> = {
  pending:    'bg-amber-50 text-amber-700 ring-amber-200',
  confirmed:  'bg-progress-bg text-progress ring-progress/30',
  dispatched: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  delivered:  'bg-gray-100 text-gray-600 ring-gray-200',
  cancelled:  'bg-red-50 text-red-600 ring-red-200',
};

const NEXT_STATUS: Record<OrderStatus, OrderStatus | null> = {
  pending:    'confirmed',
  confirmed:  'dispatched',
  dispatched: 'delivered',
  delivered:  null,
  cancelled:  null,
};

export function OrderStatusBadge({
  orderId,
  currentStatus,
}: {
  orderId:       string;
  currentStatus: OrderStatus;
}) {
  const [status,  setStatus]  = useState<OrderStatus>(currentStatus);
  const [pending, startTransition] = useTransition();

  const next = NEXT_STATUS[status];

  function advance() {
    if (!next) return;
    const newStatus = next;
    setStatus(newStatus);
    startTransition(async () => {
      await updateOrderStatusAction(orderId, newStatus);
    });
  }

  return (
    <button
      type="button"
      onClick={advance}
      disabled={pending || !next}
      title={next ? `Mark as ${next}` : 'Final status'}
      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ring-1 capitalize transition-all disabled:cursor-default ${STATUS_STYLES[status]}`}
    >
      {status.replace('_', ' ')}
    </button>
  );
}
