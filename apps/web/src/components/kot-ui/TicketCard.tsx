import * as React from 'react';
import { cn } from '@/lib/utils';
import { StatusPill } from './StatusPill';
import { Countdown } from './Countdown';

export interface TicketLine {
  qty: number;
  name: string;
  note?: string;
}

export interface TicketCardProps {
  orderRef: string;
  fulfilmentType: 'delivery' | 'takeaway';
  status: string;
  lines: TicketLine[];
  totalLabel: string; // pre-formatted, e.g. "₹640"
  paid?: boolean;
  /** Seconds remaining for acceptance; omit once accepted */
  countdownSeconds?: number;
  countdownTotalSeconds?: number;
  isProblem?: boolean;
  primaryAction?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

/**
 * The signature KOT.ai component — a live order styled as a kitchen order
 * ticket (docs/DESIGN.md §8, §9.1). Use sparingly: live orders only.
 */
export function TicketCard({
  orderRef,
  fulfilmentType,
  status,
  lines,
  totalLabel,
  paid,
  countdownSeconds,
  countdownTotalSeconds,
  isProblem,
  primaryAction,
  secondaryAction,
  onClick,
  className,
}: TicketCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'ticket w-full max-w-xs border border-line shadow-sm px-4 pt-4',
        isProblem && 'border-t-[3px] border-t-problem',
        onClick && 'cursor-pointer',
        className,
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-[13px] tracking-[0.06em] text-text">{orderRef}</span>
        <StatusPill status={status} />
      </div>

      <div className="flex items-center justify-between text-xs text-muted mb-3">
        <span className="capitalize">{fulfilmentType}</span>
        {countdownSeconds != null && countdownTotalSeconds != null && (
          <Countdown seconds={countdownSeconds} totalSeconds={countdownTotalSeconds} />
        )}
      </div>

      <div className="font-mono text-[14px] leading-5 space-y-0.5 mb-3">
        {lines.map((line, i) => (
          <div key={i}>
            <span>{line.qty} &times; {line.name}</span>
            {line.note && <div className="text-muted text-[12px] pl-4">{line.note}</div>}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between mb-3">
        <span className="font-display font-bold text-[18px]">{totalLabel}</span>
        {paid !== undefined && (
          <span className={cn('text-xs font-medium', paid ? 'text-done' : 'text-waiting')}>
            {paid ? 'Paid' : 'Unpaid'}
          </span>
        )}
      </div>

      {(primaryAction || secondaryAction) && (
        <div className="flex gap-2 pb-2">
          {secondaryAction}
          {primaryAction}
        </div>
      )}
    </div>
  );
}
