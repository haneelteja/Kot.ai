import * as React from 'react';
import {
  Clock, Loader2, CheckCircle2, PackageCheck, XCircle, Ban,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * One status group → colour mapping, shared by every screen that shows an
 * order/payment/delivery/booking status (docs/DESIGN.md §3.2). Status is
 * always colour + icon + text, never colour alone.
 */
export type StatusGroup = 'waiting' | 'progress' | 'ready' | 'done' | 'problem' | 'neutral';

const GROUP_CLASSES: Record<StatusGroup, string> = {
  waiting: 'text-waiting bg-waiting-bg',
  progress: 'text-progress bg-progress-bg',
  ready: 'text-ready bg-ready-bg',
  done: 'text-done bg-done-bg',
  problem: 'text-problem bg-problem-bg',
  neutral: 'text-neutral bg-neutral-bg',
};

const GROUP_ICONS: Record<StatusGroup, LucideIcon> = {
  waiting: Clock,
  progress: Loader2,
  ready: PackageCheck,
  done: CheckCircle2,
  problem: XCircle,
  neutral: Ban,
};

/**
 * Maps every order/payment/delivery/booking status string (brief §7) to a
 * status group. Extend this table, not individual screens, when a new
 * status is added.
 */
export const STATUS_GROUP: Record<string, StatusGroup> = {
  // orders
  awaiting_payment: 'waiting', payment_pending: 'waiting',
  sent_to_restaurant: 'waiting', acceptance_timeout: 'problem',
  accepted: 'progress', preparing: 'progress', rider_requested: 'progress', rider_assigned: 'progress',
  picked_up: 'progress', searching_rider: 'progress',
  food_ready: 'ready',
  delivered: 'done', collected: 'done', completed: 'done', paid: 'done', refunded: 'done', seated: 'done',
  payment_failed: 'problem', payment_expired: 'problem', rejected_by_restaurant: 'problem',
  delivery_failed: 'problem', partially_refunded: 'problem',
  cancelled_by_customer: 'neutral', cancelled_by_restaurant: 'neutral', cancelled: 'neutral', draft: 'neutral',
  // bookings
  requested: 'waiting', confirmed: 'done', reminded: 'progress', declined: 'problem', no_show: 'problem',
};

export interface StatusPillProps {
  status: string;
  label?: string;
  className?: string;
}

export function StatusPill({ status, label, className }: StatusPillProps) {
  const group = STATUS_GROUP[status] ?? 'neutral';
  const Icon = GROUP_ICONS[group];
  const text = label ?? status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full',
        GROUP_CLASSES[group],
        className,
      )}
    >
      <Icon size={13} aria-hidden="true" className={group === 'progress' ? 'animate-spin' : undefined} />
      {text}
    </span>
  );
}
