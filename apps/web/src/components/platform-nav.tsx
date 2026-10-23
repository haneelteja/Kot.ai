'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Building2, Users, Bell, Settings, LogOut, Shield, ShieldCheck, Box, Cpu, CreditCard, BarChart2, ClipboardList, Palette } from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

const NAV_ITEMS = [
  { href: '/platform/clients',         label: 'Clients',         icon: Building2  },
  { href: '/platform/users',           label: 'Team',            icon: Users      },
  { href: '/platform/products',        label: 'Products',        icon: Box        },
  { href: '/platform/guardrails',      label: 'Guardrails',      icon: ShieldCheck },
  { href: '/platform/ai-models',       label: 'AI Models',       icon: Cpu        },
  { href: '/platform/analytics',       label: 'Analytics',       icon: BarChart2  },
  { href: '/platform/billing',         label: 'Billing',         icon: CreditCard },
  { href: '/platform/notifications',   label: 'Notifications',   icon: Bell       },
  { href: '/platform/design',          label: 'Design system',   icon: Palette    },
  { href: '/platform/settings',        label: 'Settings',        icon: Settings   },
];

export function PlatformNav({ role }: { role: string }) {
  const pathname = usePathname();
  const router   = useRouter();
  const supabase = getSupabaseBrowserClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  return (
    <aside className="w-[240px] shrink-0 flex flex-col h-screen bg-surface border-r border-line">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 h-[64px] shrink-0 border-b border-line">
        <div className="w-8 h-8 rounded-lg bg-brand-strong flex items-center justify-center shrink-0">
          <Shield size={15} className="text-white" />
        </div>
        <div>
          <p className="text-text font-bold text-sm tracking-tight">KOT.ai</p>
          <p className="text-brand-strong text-[10px] leading-none mt-0.5 font-medium">Platform Console</p>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-widest px-3 pb-2">
          Management
        </p>
          {role === 'manager' && (() => {
          const href  = '/platform/audit';
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all group ${
                active
                  ? 'bg-brand-wash text-brand-strong'
                  : 'text-muted-foreground hover:bg-sunken hover:text-text'
              }`}
            >
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full bg-brand" />
              )}
              <ClipboardList size={15} className="shrink-0" />
              <span className="font-medium">Audit Log</span>
            </Link>
          );
        })()}
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all group ${
                active
                  ? 'bg-brand-wash text-brand-strong'
                  : 'text-muted-foreground hover:bg-sunken hover:text-text'
              }`}
            >
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full bg-brand" />
              )}
              <Icon size={15} className="shrink-0" />
              <span className="font-medium">{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Role + sign out */}
      <div className="p-3 border-t border-line space-y-1">
        <div className="px-3 py-1.5">
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${
            role === 'manager'
              ? 'bg-brand-wash text-brand-strong'
              : 'bg-sunken text-muted-foreground'
          }`}>
            {role === 'manager' ? 'Platform Manager' : 'Platform Admin'}
          </span>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm text-muted-foreground hover:bg-sunken hover:text-text transition-all"
        >
          <LogOut size={15} className="shrink-0" />
          <span className="font-medium">Sign out</span>
        </button>
      </div>
    </aside>
  );
}
