import * as React from 'react';
import { cn } from '@/lib/utils';

export interface EmptyStateProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

/**
 * Ticket-on-rail line illustration, one sentence, one action
 * (docs/DESIGN.md §6, §8).
 */
export function EmptyState({ title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center py-16 px-6', className)}>
      <svg width="56" height="48" viewBox="0 0 56 48" fill="none" aria-hidden="true" className="mb-4 opacity-60">
        <rect x="2" y="2" width="52" height="6" rx="3" className="fill-line" />
        <path
          d="M10 8 H46 V34 L41 40 L36 34 L31 40 L26 34 L21 40 L16 34 L10 40 Z"
          className="fill-surface stroke-line"
          strokeWidth="1.5"
        />
        <rect x="16" y="14" width="14" height="3" rx="1.5" className="fill-line" />
        <rect x="16" y="21" width="22" height="2" rx="1" className="fill-line" />
        <rect x="16" y="27" width="18" height="2" rx="1" className="fill-line" />
      </svg>
      <p className="text-sm font-semibold text-text">{title}</p>
      {description && <p className="text-xs text-muted mt-1 max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
