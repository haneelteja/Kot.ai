'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface CollapsibleSectionProps {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  rightContent?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  containerClass?: string;
  headerClass?: string;
  titleClass?: string;
  contentClass?: string;
}

export function CollapsibleSection({
  icon,
  title,
  subtitle,
  rightContent,
  children,
  defaultOpen = false,
  containerClass = 'bg-white rounded-2xl border border-line shadow-sm overflow-hidden',
  headerClass,
  titleClass = 'text-sm font-semibold text-text',
  contentClass = 'px-6 py-5',
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  const defaultHeaderClass = `w-full flex items-center gap-2.5 px-6 py-4 text-left hover:bg-sunken transition-colors ${open ? 'border-b border-line' : ''}`;

  return (
    <div className={containerClass}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={headerClass ?? defaultHeaderClass}
        aria-expanded={open}
      >
        {icon}
        <div className="min-w-0">
          <span className={titleClass}>{title}</span>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        <span className="ml-auto flex items-center gap-2 shrink-0">
          {rightContent}
          <ChevronDown
            size={14}
            className={`text-muted-foreground transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          />
        </span>
      </button>
      {open && <div className={contentClass}>{children}</div>}
    </div>
  );
}
