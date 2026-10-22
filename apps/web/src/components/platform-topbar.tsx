'use client';

import { usePathname, useRouter } from 'next/navigation';
import { ChevronRight, ArrowLeftRight } from 'lucide-react';

const PAGE_TITLES: Record<string, string> = {
  '/platform/clients':       'Clients',
  '/platform/users':         'Team',
  '/platform/notifications': 'Notifications',
  '/platform/settings':      'Settings',
};

function getTitle(pathname: string): { section: string; page: string | null } {
  if (pathname === '/platform/clients/new')          return { section: 'Clients',  page: 'New Client' };
  if (pathname.match(/\/platform\/clients\/[^/]+$/)) return { section: 'Clients',  page: 'Client Detail' };
  if (pathname === '/platform/settings')             return { section: 'Settings', page: null };
  return { section: PAGE_TITLES[pathname] ?? 'Platform', page: null };
}

export function PlatformTopbar({
  email,
  name,
  hasClientAccess = false,
}: {
  email: string;
  name: string;
  hasClientAccess?: boolean;
}) {
  const pathname = usePathname();
  const router   = useRouter();
  const { section, page } = getTitle(pathname);
  const initial = (name || email)[0]?.toUpperCase() ?? 'P';

  return (
    <header className="h-[64px] shrink-0 flex items-center justify-between px-6 bg-surface border-b border-line">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground font-medium">Platform</span>
        <ChevronRight size={14} className="text-line" />
        <span className={`font-semibold ${page ? 'text-muted-foreground' : 'text-text'}`}>{section}</span>
        {page && (
          <>
            <ChevronRight size={14} className="text-line" />
            <span className="font-semibold text-text">{page}</span>
          </>
        )}
      </div>

      <div className="flex items-center gap-2.5">
        {hasClientAccess && (
          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-brand-strong hover:bg-brand-wash px-2.5 py-1.5 rounded-lg transition-colors"
            title="Switch to Client Console"
          >
            <ArrowLeftRight size={13} />
            Client Console
          </button>
        )}

        <div className="w-8 h-8 rounded-full bg-brand-strong flex items-center justify-center text-white text-xs font-bold shadow-sm">
          {initial}
        </div>
        <div className="hidden sm:block">
          <p className="text-xs font-semibold text-text leading-tight">{name}</p>
          <p className="text-[10px] text-muted-foreground leading-tight">{email}</p>
        </div>
      </div>
    </header>
  );
}
