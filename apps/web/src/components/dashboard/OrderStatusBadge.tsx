'use client';

import { useState, useTransition } from 'react';
import { updateOrderStatusAction, type OrderStatus } from '@/app/actions/orders';

const STATUS_STYLES: Record<OrderStatus, string> = {
  pending:    'bg-amber-50 text-amber-700 ring-amber-200',
  confirmed:  'bg-progress-bg text-progress ring-progress/30',
  preparing:  'bg-violet-50 text-violet-700 ring-violet-200',
  ready:      'bg-done-bg text-done ring-done/30',
  dispatched: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  delivered:  'bg-sunken text-muted-foreground ring-line',
  cancelled:  'bg-red-50 text-red-600 ring-red-200',
};

// preparing/ready are driven automatically by FUL-02 (auto-accept) and the
// kitchen's Ready/Problem tap (FUL-03) — staff can still advance manually
// from here too (e.g. a restaurant without a configured kitchen number).
const NEXT_STATUS: Record<OrderStatus, OrderStatus | null> = {
  pending:    'confirmed',
  confirmed:  'preparing',
  preparing:  'ready',
  ready:      'dispatched',
  dispatched: 'delivered',
  delivered:  null,
  cancelled:  null,
};

// TKW-04: restaurant pickup orders (no delivery epic exists) skip the
// delivery-specific 'dispatched' step — Ready advances straight to
// "collected" (delivered).
const PICKUP_NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus | null>> = {
  ready: 'delivered',
};

export function OrderStatusBadge({
  orderId,
  currentStatus,
  isPickup = false,
}: {
  orderId:       string;
  currentStatus: OrderStatus;
  /** restaurant_bot orders (whatsapp_bot/weblink source) — see PICKUP_NEXT_STATUS. */
  isPickup?:     boolean;
}) {
  const [status,  setStatus]  = useState<OrderStatus>(currentStatus);
  const [pending, startTransition] = useTransition();

  const next = (isPickup ? PICKUP_NEXT_STATUS[status] : undefined) ?? NEXT_STATUS[status];

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
      title={next ? `Mark as ${isPickup && next === 'delivered' ? 'collected' : next}` : 'Final status'}
      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ring-1 capitalize transition-all disabled:cursor-default ${STATUS_STYLES[status]}`}
    >
      {status.replace('_', ' ')}
    </button>
  );
}
