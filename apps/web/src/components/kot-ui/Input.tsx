import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

/**
 * 40px, 8px radius, Steel border, Saffron 2px focus ring with 2px offset
 * (docs/DESIGN.md §8). Errors render in Problem colour below the field
 * with a fix, not just "invalid".
 */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, id, ...props }, ref) => (
    <div className="w-full">
      <input
        ref={ref}
        id={id}
        className={cn(
          'h-10 w-full rounded-sm border bg-surface px-3 text-sm text-text placeholder:text-muted',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--focus)]',
          error ? 'border-problem' : 'border-line',
          className,
        )}
        aria-invalid={!!error}
        aria-describedby={error && id ? `${id}-error` : undefined}
        {...props}
      />
      {error && (
        <p id={id ? `${id}-error` : undefined} className="mt-1 text-xs text-problem">
          {error}
        </p>
      )}
    </div>
  ),
);
Input.displayName = 'Input';
