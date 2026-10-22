'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useCallback, useTransition } from 'react';
import { Bell, ChevronRight, Menu, Check, CheckCheck, MessageSquare, ArrowLeftRight } from 'lucide-react';
import { BotSelector } from '@/components/dashboard/BotSelector';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import {
  getNotificationsInboxAction,
  markNotificationsReadAction,
  type NotificationItem,
} from '@/app/actions/notifications-inbox';
import type { ActiveBot } from '@/components/dashboard/BotSelector';

// ── Constants ─────────────────────────────────────────────────────────────────

const PAGE_TITLES: Record<string, string> = {
  '/dashboard':       'Overview',
  '/conversations':   'Conversations',
  '/escalations':     'Escalations',
  '/knowledge-base':  'Knowledge Base',
  '/settings':        'Settings',
  '/analytics':       'Analytics',
  '/campaigns':       'Campaigns',
  '/leads':           'Leads',
  '/billing':         'Billing',
  '/integrations':    'Integrations',
  '/guardrails':      'Guardrails',
  '/call-triggers':   'Triggers',
  '/button-templates':'Buttons',
  '/orders':          'Orders',
  '/contacts':        'Contacts',
  '/groups':          'Groups',
  '/voice':           'Voice Calls',
  '/follow-ups':      'Follow-ups',
  '/ai-models':       'AI Models',
  '/catalogue':       'Catalogue',
  '/team':            'Team',
};

function getTitle(pathname: string): string {
  if (pathname.startsWith('/conversations/')) return 'Conversation';
  if (pathname.startsWith('/campaigns/'))     return 'Campaign';
  if (pathname.startsWith('/voice/'))         return 'Call Detail';
  if (pathname.startsWith('/groups/'))        return 'Group';
  return PAGE_TITLES[pathname] ?? 'KOT.ai';
}

function timeAgo(ts: string): string {
  const mins = Math.floor((Date.now() - new Date(ts).getTime()) / 60_000);
  if (mins < 1)    return 'Just now';
  if (mins < 60)   return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return `${Math.floor(mins / 1440)}d ago`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function Topbar({
  email,
  tenantName,
  tenantId,
  onMenuClick,
  activeBots = [],
  hasPlatformAccess = false,
}: {
  email:        string;
  tenantName:   string;
  tenantId:     string;
  onMenuClick?: () => void;
  activeBots?:  ActiveBot[];
  hasPlatformAccess?: boolean;
}) {
  const pathname = usePathname();
  const router   = useRouter();
  const title    = getTitle(pathname);
  const initial  = email[0]?.toUpperCase() ?? 'U';
  const isDetail = pathname.startsWith('/conversations/');

  // ── Notification state ─────────────────────────────────────────────────────
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isOpen,        setIsOpen]        = useState(false);
  const [, startTransition]               = useTransition();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const supabase    = useRef(getSupabaseBrowserClient()).current;

  const unreadCount = notifications.filter(n => !n.read_at).length;

  // ── Initial fetch via server action ───────────────────────────────────────
  const fetchNotifications = useCallback(() => {
    startTransition(async () => {
      const data = await getNotificationsInboxAction();
      setNotifications(data);
    });
  }, []);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  // ── Realtime: listen for new INSERT on notifications table ────────────────
  useEffect(() => {
    if (!tenantId) return;

    const channel = supabase
      .channel(`notifications:${tenantId}`)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'notifications',
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          // Prepend the new notification and drop oldest beyond 30
          setNotifications(prev => [payload.new as NotificationItem, ...prev.slice(0, 29)]);
        },
      )
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [tenantId, supabase]);

  // ── Click outside to close ────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  // ── Actions ────────────────────────────────────────────────────────────────
  function markAsReadOptimistic(id: string) {
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n)
    );
    startTransition(async () => {
      await markNotificationsReadAction([id]);
    });
  }

  function markAllReadOptimistic() {
    const unreadIds = notifications.filter(n => !n.read_at).map(n => n.id);
    if (!unreadIds.length) return;
    setNotifications(prev =>
      prev.map(n => ({ ...n, read_at: n.read_at ?? new Date().toISOString() }))
    );
    startTransition(async () => {
      await markNotificationsReadAction(unreadIds);
    });
  }

  function handleNotificationClick(n: NotificationItem) {
    if (!n.read_at) markAsReadOptimistic(n.id);
    setIsOpen(false);
    if (n.conversation_id) router.push(`/conversations/${n.conversation_id}`);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <header className="h-[64px] shrink-0 flex items-center justify-between px-4 sm:px-6 bg-surface border-b border-line">

      {/* Left: hamburger (mobile) + breadcrumb */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open navigation menu"
          className="lg:hidden -ml-1 w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-sunken hover:text-text transition-colors"
        >
          <Menu size={18} />
        </button>

        <nav aria-label="Breadcrumb">
          <ol className="flex items-center gap-2 text-sm list-none" style={{ margin: 0, padding: 0 }}>
            <li>
              <span className="text-muted-foreground font-medium truncate max-w-[120px] sm:max-w-none block">{tenantName}</span>
            </li>
            <li aria-hidden="true"><ChevronRight size={14} className="text-line" /></li>
            <li>
              <span className={`font-semibold ${isDetail ? 'text-muted-foreground' : 'text-text'}`}>
                {isDetail ? 'Conversations' : title}
              </span>
            </li>
            {isDetail && (
              <>
                <li aria-hidden="true"><ChevronRight size={14} className="text-line" /></li>
                <li><span className="font-semibold text-text">Detail</span></li>
              </>
            )}
          </ol>
        </nav>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2">
        {activeBots.length > 0 && <BotSelector bots={activeBots} />}

        {hasPlatformAccess && (
          <button
            type="button"
            onClick={() => router.push('/platform/clients')}
            className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-brand-strong hover:bg-brand-wash px-2.5 py-1.5 rounded-lg transition-colors"
            title="Switch to Platform Console"
          >
            <ArrowLeftRight size={13} />
            Platform Console
          </button>
        )}

        {/* Bell + dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : 'Notifications'}
            aria-haspopup="true"
            aria-expanded={isOpen}
            onClick={() => setIsOpen(v => !v)}
            className="relative w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-sunken hover:text-brand-strong transition-colors"
          >
            <Bell size={16} aria-hidden="true" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 rounded-full bg-problem text-white text-[10px] font-bold flex items-center justify-center leading-none">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {/* Dropdown */}
          {isOpen && (
            <div className="absolute right-0 top-[calc(100%+6px)] w-80 bg-surface rounded-2xl shadow-float border border-line z-50 overflow-hidden">

              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-line">
                <p className="text-sm font-bold text-text">
                  Notifications
                  {unreadCount > 0 && (
                    <span className="ml-2 text-xs font-semibold text-problem bg-problem-bg px-1.5 py-0.5 rounded-full">
                      {unreadCount} new
                    </span>
                  )}
                </p>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllReadOptimistic}
                    className="flex items-center gap-1 text-[11px] font-semibold text-brand-strong hover:bg-brand-wash px-2 py-1 rounded-lg transition-colors"
                  >
                    <CheckCheck size={12} /> Mark all read
                  </button>
                )}
              </div>

              {/* List */}
              <div className="max-h-[420px] overflow-y-auto divide-y divide-line">
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                    <div className="w-10 h-10 rounded-xl bg-sunken flex items-center justify-center mb-2">
                      <Bell size={18} className="text-line" />
                    </div>
                    <p className="text-sm font-semibold text-muted-foreground">No notifications yet</p>
                    <p className="text-xs text-muted-foreground mt-0.5">New customer messages will appear here</p>
                  </div>
                ) : (
                  notifications.map(n => {
                    const isUnread = !n.read_at;
                    return (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => handleNotificationClick(n)}
                        className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50/80 ${isUnread ? 'bg-brand-wash/40' : ''}`}
                      >
                        {/* Avatar */}
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold ${
                          isUnread ? 'bg-brand-wash text-brand-strong' : 'bg-sunken text-muted-foreground'
                        }`}>
                          {n.title.slice(0, 2).toUpperCase()}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className={`text-sm leading-snug truncate ${isUnread ? 'font-semibold text-text' : 'font-medium text-muted-foreground'}`}>
                              {n.title}
                            </p>
                            <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums" suppressHydrationWarning>
                              {timeAgo(n.created_at)}
                            </span>
                          </div>
                          {n.body && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 text-left">{n.body}</p>
                          )}
                          <div className="flex items-center gap-1.5 mt-1">
                            <MessageSquare size={9} className="text-line" />
                            <span className="text-[10px] text-muted-foreground">New message</span>
                            {isUnread
                              ? <span className="w-1.5 h-1.5 rounded-full bg-brand ml-auto shrink-0" />
                              : <Check size={10} className="text-line ml-auto shrink-0" />
                            }
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              {/* Footer */}
              {notifications.length > 0 && (
                <div className="px-4 py-2.5 border-t border-line">
                  <button
                    type="button"
                    onClick={() => { setIsOpen(false); router.push('/conversations'); }}
                    className="text-xs font-semibold text-brand-strong hover:underline transition-colors"
                  >
                    View all conversations →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* User pill */}
        <div
          className="flex items-center gap-2.5 pl-2 ml-1 border-l border-line"
          role="img"
          aria-label={`Signed in as ${email}`}
        >
          <div
            className="w-8 h-8 rounded-full bg-brand-strong flex items-center justify-center text-white text-xs font-bold"
            aria-hidden="true"
          >
            {initial}
          </div>
          <div className="hidden sm:block">
            <p className="text-xs font-semibold text-text leading-tight">{email.split('@')[0]}</p>
            <p className="text-[10px] text-muted-foreground leading-tight">{email}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
