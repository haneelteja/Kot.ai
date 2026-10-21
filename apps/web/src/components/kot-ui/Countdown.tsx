import * as React from 'react';
import { cn } from '@/lib/utils';

export interface CountdownProps {
  /** Seconds remaining */
  seconds: number;
  /** Total seconds the countdown started from (for the ring fraction) */
  totalSeconds: number;
  className?: string;
}

/**
 * Acceptance countdown — ring colour shifts Waiting → Problem in the last
 * 60s (docs/DESIGN.md §7). Static render here; callers tick `seconds` down
 * (e.g. via setInterval) from the live orders screen.
 */
export function Countdown({ seconds, totalSeconds, className }: CountdownProps) {
  const clamped = Math.max(0, seconds);
  const mm = Math.floor(clamped / 60);
  const ss = clamped % 60;
  const isProblem = clamped <= 60;
  const fraction = totalSeconds > 0 ? clamped / totalSeconds : 0;
  const circumference = 2 * Math.PI * 9;
  const dashoffset = circumference * (1 - fraction);

  return (
    <span
      className={cn('inline-flex items-center gap-1.5 font-mono text-[13px] tabular-nums', className)}
      role="timer"
      aria-label={`${mm}m ${ss}s remaining`}
    >
      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
        <circle cx="10" cy="10" r="9" fill="none" strokeWidth="2" className="stroke-line" />
        <circle
          cx="10" cy="10" r="9" fill="none" strokeWidth="2"
          strokeDasharray={circumference}
          strokeDashoffset={dashoffset}
          strokeLinecap="round"
          transform="rotate(-90 10 10)"
          className={isProblem ? 'stroke-problem' : 'stroke-waiting'}
        />
      </svg>
      <span className={isProblem ? 'text-problem' : 'text-waiting'}>
        {mm}:{ss.toString().padStart(2, '0')}
      </span>
    </span>
  );
}
