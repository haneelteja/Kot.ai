import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Resting surface — border does the separating, no shadow (docs/DESIGN.md
 * §5: "Elevation: borders do the separating... no shadows on resting cards").
 */
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('bg-surface border border-line rounded-md', className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-5 py-4 border-b border-line', className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('text-[18px] font-semibold text-text', className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-5 py-4', className)} {...props} />;
}
