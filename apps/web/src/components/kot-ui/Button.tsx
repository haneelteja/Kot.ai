import * as React from 'react';
import { cn } from '@/lib/utils';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-brand-strong text-white hover:opacity-90 border border-transparent',
  secondary: 'bg-surface text-text border border-line hover:bg-sunken',
  ghost: 'bg-transparent text-text hover:bg-sunken border border-transparent',
  destructive: 'bg-problem text-white hover:opacity-90 border border-transparent',
};

// docs/DESIGN.md §8: height 40 (36 small, 48 on customer pages)
const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

/**
 * Labels should say the action, not a generic verb: "Accept order",
 * "Mark food ready", "Refund ₹240" — docs/DESIGN.md §8.
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-sm font-medium transition-colors',
        'disabled:opacity-50 disabled:pointer-events-none',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = 'Button';
