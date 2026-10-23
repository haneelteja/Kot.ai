'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface Props {
  icon: React.ReactNode;
  title: string;
  hint?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export function DashboardCollapsibleSection({ icon, title, hint, children, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="bg-white rounded-2xl border border-line shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-start gap-2.5 px-5 py-4 text-left hover:bg-sunken/50 transition-colors ${open ? 'border-b border-line' : ''}`}
        aria-expanded={open}
      >
        <span className="text-brand-strong mt-0.5 shrink-0">{icon}</span>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-text">{title}</h2>
          {hint && <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{hint}</p>}
        </div>
        <ChevronDown
          size={14}
          className={`text-muted-foreground mt-1 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && <div>{children}</div>}
    </div>
  );
}
