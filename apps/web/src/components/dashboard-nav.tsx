'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import {
  MessageSquare,
  LayoutDashboard,
  BookOpen,
  Settings,
  LogOut,
  Bot,
  ShieldCheck,
  CreditCard,
  ShoppingCart,
  MessageSquareMore,
  Plug,
  CalendarClock,
  ClipboardList,
  RotateCcw,
  Inbox,
  UtensilsCrossed,
} from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

const BASE_NAV = [
  { href: '/dashboard',        label: 'Overview',       icon: LayoutDashboard  },
  { href: '/conversations',    label: 'Conversations',  icon: MessageSquare    },
  { href: '/inbox',            label: 'Inbox',          icon: Inbox            },
  { href: '/knowledge-base',   label: 'Knowledge Base', icon: BookOpen         },
  { href: '/guardrails',       label: 'Guardrails',     icon: ShieldCheck      },
  { href: '/button-templates', label: 'Buttons',        icon: MessageSquareMore },
  { href: '/scheduled-messages',  label: 'Scheduled',  icon: CalendarClock },
  { href: '/billing',          label: 'Billing',        icon: CreditCard       },
  { href: '/settings',         label: 'Settings',       icon: Settings         },
];

const INTEGRATIONS_ITEM   = { href: '/integrations',   label: 'Integrations', icon: Plug        };
const ORDERS_ITEM         = { href: '/orders',          label: 'Orders',       icon: ShoppingCart };
const RETURNS_ITEM        = { href: '/returns',         label: 'Returns',      icon: RotateCcw   };
const MENU_ITEM            = { href: '/menu',            label: 'Menu',         icon: UtensilsCrossed };

export function DashboardNav({
  tenantName,
  userRole,
  hasLifecycleBot,
  hasRestaurantBot = false,
  isAgency = false,
  onLinkClick,
}: {
  tenantName: string;
  userRole: string;
  hasLifecycleBot: boolean;
  hasRestaurantBot?: boolean;
  isAgency?: boolean;
  onLinkClick?: () => void;
}) {
  const pathname = usePathname();
  const router   = useRouter();
  // Read bot param client-side only to avoid SSR/hydration mismatch
  const [botParam, setBotParam] = useState<string | null>(null);
  useEffect(() => {
    setBotParam(new URLSearchParams(window.location.search).get('bot'));
  }, []);
  const supabase = getSupabaseBrowserClient();

  const ADMIN_ONLY_HREFS = new Set(['/audit']);
  const AGENT_HREFS      = new Set(['/dashboard', '/conversations', '/inbox']);

  const navItems = (() => {
    const items = [...BASE_NAV];
    const convsIdx = items.findIndex(i => i.href === '/conversations');
    items.splice(convsIdx + 1, 0, INTEGRATIONS_ITEM);
    if (hasRestaurantBot) {
      const guardrailsIdx = items.findIndex(i => i.href === '/guardrails');
      const toAdd = [MENU_ITEM, ...(items.some(i => i.href === '/orders') ? [] : [ORDERS_ITEM])];
      items.splice(guardrailsIdx + 1, 0, ...toAdd);
    }
    if (hasLifecycleBot) {
      const guardrailsIdx = items.findIndex(i => i.href === '/guardrails');
      const toAdd = [...(items.some(i => i.href === '/orders') ? [] : [ORDERS_ITEM]), RETURNS_ITEM];
      items.splice(guardrailsIdx + 1, 0, ...toAdd);
    }
    // Audit log — client_admin and client_manager only.
    // tenant_users.role is constrained to 'client_admin' | 'client_manager' | 'agent'.
    if (['client_admin', 'client_manager'].includes(userRole)) {
      const settingsIdx = items.findIndex(i => i.href === '/settings');
      items.splice(settingsIdx, 0, { href: '/audit', label: 'Activity Log', icon: ClipboardList });
    }
    if (userRole === 'agent') return items.filter(i => !ADMIN_ONLY_HREFS.has(i.href) && AGENT_HREFS.has(i.href));
    return items;
  })();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  const roleLabel = userRole.replace(/_/g, ' ');

  return (
    <aside
      className="w-[240px] shrink-0 flex flex-col h-screen bg-rail border-r border-white/10"
      aria-label="Main navigation"
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 h-[64px] shrink-0 border-b border-white/10">
        <div
          className="w-8 h-8 rounded-lg bg-brand-strong flex items-center justify-center shrink-0"
          aria-hidden="true"
        >
          <Bot size={15} className="text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-white font-bold text-sm tracking-tight truncate">{tenantName}</p>
          <p className="text-white/50 text-[10px] leading-none mt-0.5 font-medium capitalize">{roleLabel}</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto" role="navigation" aria-label="Dashboard sections">
        <p className="text-white/35 text-[10px] font-semibold uppercase tracking-widest px-3 pb-2" aria-hidden="true">
          Navigation
        </p>
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
          const navHref = botParam ? `${href}?bot=${botParam}` : href;
          // Derive a stable tour-id from the href path segment
          const tourId = href.replace(/^\//, '').replace(/\//g, '-') || 'overview';
          return (
            <Link
              key={href}
              href={navHref}
              onClick={onLinkClick}
              aria-current={active ? 'page' : undefined}
              data-tour-id={tourId}
              className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 group ${
                active
                  ? 'bg-[#3F2A1C] text-brand'
                  : 'text-white/60 hover:bg-white/5 hover:text-white/90'
              }`}
            >
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full bg-brand" aria-hidden="true" />
              )}
              <Icon size={15} className={`shrink-0 ${active ? 'text-brand' : 'text-white/40 group-hover:text-white/80'}`} aria-hidden="true" />
              <span className="font-medium">{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="p-3 border-t border-white/10">
        <button
          type="button"
          onClick={handleSignOut}
          aria-label="Sign out of KOT.ai"
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm text-white/50 hover:bg-white/5 hover:text-white/90 transition-all group"
        >
          <LogOut size={15} className="shrink-0" aria-hidden="true" />
          <span className="font-medium">Sign out</span>
        </button>
      </div>
    </aside>
  );
}
