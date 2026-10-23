export const dynamic = 'force-dynamic';

import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
  MessageSquare, AlertCircle, Clock, Users, Star, Search,
} from 'lucide-react';
import { BotFilterBar } from '@/components/dashboard/BotFilterBar';
import { ContactsTabClient } from '@/components/dashboard/ContactsTabClient';
import type { ContactSentiment } from '@alphabot/shared';

// ── Shared constants ──────────────────────────────────────────────────────────

const PRODUCT_LABELS: Record<string, { label: string; color: string }> = {
  support_bot:     { label: 'Support',   color: 'bg-sky-50 text-sky-600' },
  appointment_bot: { label: 'Appt',      color: 'bg-pink-50 text-pink-600' },
};

const AVATAR_COLORS = [
  'bg-brand-wash text-brand-strong',
  'bg-sky-100 text-sky-700',
  'bg-violet-100 text-violet-700',
  'bg-amber-100 text-amber-700',
];

// ── Chats section ─────────────────────────────────────────────────────────────

const CONV_STATUS_STYLES: Record<string, { dot: string; badge: string }> = {
  open:       { dot: 'bg-done',    badge: 'bg-done-bg text-done ring-transparent' },
  escalated:  { dot: 'bg-red-400',     badge: 'bg-red-50 text-red-700 ring-red-100' },
  resolved:   { dot: 'bg-sunken',    badge: 'bg-sunken text-muted-foreground ring-line' },
  bot_paused: { dot: 'bg-amber-400',   badge: 'bg-amber-50 text-amber-700 ring-amber-100' },
};

const SENTIMENT_META: Record<ContactSentiment, { emoji: string; bg: string; text: string; label: string }> = {
  positive:   { emoji: '😊', bg: 'bg-done-bg',    text: 'text-done',    label: 'Positive'   },
  neutral:    { emoji: '😐', bg: 'bg-neutral-bg', text: 'text-neutral', label: 'Neutral'    },
  negative:   { emoji: '😟', bg: 'bg-amber-50',   text: 'text-amber-700',  label: 'Unhappy'    },
  frustrated: { emoji: '😤', bg: 'bg-red-50',     text: 'text-red-700',    label: 'Frustrated' },
};

const VALID_BOTS     = new Set(['support_bot']);
const VALID_STATUSES = new Set(['open', 'escalated', 'resolved', 'bot_paused']);

function humanizeStatus(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ── Contacts section ──────────────────────────────────────────────────────────

type ConversationRow = { id: string; product_type: string; status: string; updated_at: string };

type ContactRow = {
  id: string; phone: string | null; bsuid: string | null; name: string | null;
  memory_json: {
    preferences?: Record<string, string>; order_history?: string[]; open_issues?: string[];
    last_interaction?: string | null; sentiment?: string; sentiment_updated_at?: string | null;
    awaiting_csat?: boolean; csat_score?: number;
  } | null;
  created_at: string; updated_at: string;
  conversations: ConversationRow[];
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ConversationsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; bot?: string; status?: string; sentiment?: string; q?: string }>;
}) {
  const { tab: tabParam, bot: botParam, status: statusParam, sentiment: sentimentFilter = 'all', q: search = '' } = await searchParams;

  const activeTab = tabParam === 'contacts' ? 'contacts' : 'chats';
  const botFilter    = botParam    && VALID_BOTS.has(botParam)       ? botParam    : null;
  const statusFilter = statusParam && VALID_STATUSES.has(statusParam) ? statusParam : null;

  const supabase = await getSupabaseServerClient();
  const admin    = getSupabaseAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: tenantUser } = await admin
    .from('tenant_users').select('tenant_id').eq('user_id', user.id).single();
  const tenantId = tenantUser?.tenant_id ?? '';

  function tabHref(t: string) {
    return `/conversations?tab=${t}`;
  }

  // ── Tab switcher ─────────────────────────────────────────────────────────────
  const tabs = [
    { key: 'chats',    label: 'Chats',    icon: MessageSquare },
    { key: 'contacts', label: 'Contacts', icon: Users },
  ];

  // ── Data fetching (only the active tab) ──────────────────────────────────────

  // Chats data
  let conversations: unknown[] = [];
  let activeSlugs: string[]    = [];
  let escalatedCount           = 0;

  if (activeTab === 'chats') {
    const [convResult, productsResult, escalatedResult] = await Promise.all([
      (() => {
        let q = admin
          .from('conversations')
          .select('*, contacts(phone, name, memory_json)')
          .eq('tenant_id', tenantId)
          .order('updated_at', { ascending: false })
          .limit(100);
        if (botFilter)    q = q.eq('product_type', botFilter);
        if (statusFilter) q = q.eq('status', statusFilter);
        return q;
      })(),
      admin.from('tenant_products').select('product_type').eq('tenant_id', tenantId).eq('active', true),
      admin.from('conversations').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('status', 'escalated'),
    ]);
    conversations  = convResult.data ?? [];
    activeSlugs    = (productsResult.data ?? []).map((p: { product_type: string }) => p.product_type);
    escalatedCount = escalatedResult.count ?? 0;
  }

  // Contacts data
  let contactRows: ContactRow[] = [];
  let contactStats = { total: 0, activeThisWeek: 0, positive: 0, frustrated: 0 };

  if (activeTab === 'contacts') {
    let query = admin
      .from('contacts')
      .select('id, phone, bsuid, name, memory_json, created_at, updated_at, conversations(id, product_type, status, updated_at)')
      .eq('tenant_id', tenantId)
      .order('updated_at', { ascending: false })
      .limit(200);

    if (sentimentFilter !== 'all') query = query.eq('memory_json->>sentiment', sentimentFilter);
    if (search.trim()) {
      const safeQ = search.trim().replace(/[,()]/g, ' ');
      query = query.or(`name.ilike.%${safeQ}%,phone.ilike.%${safeQ}%`);
    }

    const { data: contacts } = await query;
    contactRows = (contacts ?? []) as unknown as ContactRow[];

    const oneWeekAgo = Date.now() - 7 * 86_400_000;
    const bySentiment = { positive: 0, neutral: 0, negative: 0, frustrated: 0 };
    for (const c of contactRows) {
      const s = c.memory_json?.sentiment;
      if (s && s in bySentiment) bySentiment[s as keyof typeof bySentiment]++;
    }
    contactStats = {
      total: contactRows.length,
      activeThisWeek: contactRows.filter(c => new Date(c.updated_at).getTime() > oneWeekAgo).length,
      positive: bySentiment.positive,
      frustrated: bySentiment.frustrated,
    };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  function statusHref(status: string | null) {
    const p = new URLSearchParams();
    p.set('tab', 'chats');
    if (botFilter) p.set('bot', botFilter);
    if (status)    p.set('status', status);
    return `/conversations?${p.toString()}`;
  }

  const contactSentimentTabs = [
    { key: 'all', label: 'All', count: null },
    { key: 'positive',   label: 'Positive',   count: contactStats.positive },
    { key: 'neutral',    label: 'Neutral',     count: null },
    { key: 'negative',   label: 'Negative',    count: null },
    { key: 'frustrated', label: 'Frustrated',  count: contactStats.frustrated },
  ];

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-text">
            {activeTab === 'chats' ? 'Conversations' : 'Contacts'}
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {activeTab === 'chats'
              ? (statusFilter === 'escalated'
                  ? 'Conversations requiring immediate human attention'
                  : botFilter
                  ? `${PRODUCT_LABELS[botFilter]?.label ?? botFilter} bot conversations`
                  : 'All customer conversations across your bots')
              : 'All customers who have messaged your bot'}
          </p>
        </div>
        {activeTab === 'chats' && conversations.length > 0 && (() => {
          const uniqueContacts = new Set((conversations as { contact_id?: string; id: string }[]).map(c => c.contact_id ?? c.id)).size;
          return (
            <span className="text-xs font-semibold text-muted-foreground bg-white border border-line px-3 py-1.5 rounded-full shadow-sm self-start">
              {uniqueContacts} contact{uniqueContacts !== 1 ? 's' : ''}
            </span>
          );
        })()}
      </div>

      {/* Tab switcher */}
      <div
        role="tablist"
        aria-label="Conversation sections"
        className="flex items-center gap-1 bg-white border border-line rounded-xl shadow-sm p-1 w-fit"
      >
        {tabs.map(({ key, label, icon: Icon }) => (
          <Link
            key={key}
            href={tabHref(key)}
            role="tab"
            aria-selected={activeTab === key}
            aria-controls={`tabpanel-${key}`}
            className={`flex items-center gap-2 text-sm px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === key ? 'bg-brand-strong text-white shadow-sm' : 'text-muted-foreground hover:text-text'
            }`}
          >
            <Icon size={14} aria-hidden="true" /> {label}
          </Link>
        ))}
      </div>

      {/* ── CHATS TAB ─────────────────────────────────────────────────────────── */}
      {activeTab === 'chats' && (
        <div role="tabpanel" id="tabpanel-chats" aria-label="Chats">
          {/* Status filters */}
          <div className="flex items-center gap-2 flex-wrap">
            {([
              { key: null,         label: 'All',        cls: !statusFilter ? 'bg-brand-strong text-white border-brand-strong shadow-sm' : 'bg-white text-muted-foreground border-line hover:bg-sunken' },
              { key: 'open',       label: 'Open',       cls: statusFilter === 'open'       ? 'bg-done-bg text-done border-done font-bold' : 'bg-white text-muted-foreground border-line hover:bg-sunken' },
              { key: 'resolved',   label: 'Resolved',   cls: statusFilter === 'resolved'   ? 'bg-sunken text-text border-line-strong font-bold' : 'bg-white text-muted-foreground border-line hover:bg-sunken' },
              { key: 'bot_paused', label: 'Bot Paused', cls: statusFilter === 'bot_paused' ? 'bg-amber-50 text-amber-700 border-amber-300 font-bold' : 'bg-white text-muted-foreground border-line hover:bg-sunken' },
            ] as const).map(tab => (
              <Link key={tab.key ?? 'all'} href={statusHref(tab.key)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${tab.cls}`}>
                {tab.label}
              </Link>
            ))}
            {/* Escalated special tab */}
            <Link href={statusHref('escalated')}
              className={`relative flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-full border transition-all duration-150 ${
                statusFilter === 'escalated'
                  ? 'bg-red-600 text-white border-red-600 shadow-md shadow-red-200 scale-105'
                  : 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100 hover:border-red-400 hover:scale-105'
              }`}>
              <span className={`w-2 h-2 rounded-full animate-pulse ${statusFilter === 'escalated' ? 'bg-white' : 'bg-red-500'}`} />
              Escalated
              {escalatedCount > 0 && (
                <span className={`ml-0.5 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${
                  statusFilter === 'escalated' ? 'bg-white/20 text-white' : 'bg-red-500 text-white'
                }`}>{escalatedCount}</span>
              )}
            </Link>
          </div>

          {/* Bot filter */}
          <BotFilterBar activeSlugs={activeSlugs} current={botFilter} />

          {(() => {
            // Group by contact_id so the same person doesn't appear twice
            type RawConv = {
              id: string; status: string; product_type: string; updated_at: string; contact_id: string;
              contacts: { phone: string; name: string | null; memory_json: Record<string, unknown> | null } | null;
            };
            const grouped = new Map<string, { convs: RawConv[]; contact: RawConv['contacts'] }>();
            for (const c of (conversations as RawConv[])) {
              const key = c.contact_id ?? c.id;
              const existing = grouped.get(key);
              if (existing) {
                existing.convs.push(c);
              } else {
                grouped.set(key, { convs: [c], contact: c.contacts });
              }
            }
            const groups = [...grouped.values()];

            return groups.length === 0 ? (
              <div className="bg-white rounded-2xl border border-line shadow-sm flex flex-col items-center justify-center py-24 text-center">
                {statusFilter === 'escalated' ? (
                  <>
                    <div className="w-16 h-16 rounded-2xl bg-done-bg flex items-center justify-center mb-4">
                      <AlertCircle size={28} className="text-done" />
                    </div>
                    <p className="text-sm font-semibold text-muted-foreground">All clear — no escalations</p>
                    <p className="text-xs text-muted-foreground mt-1 max-w-xs">No conversations are currently waiting for human attention.</p>
                  </>
                ) : (
                  <>
                    <div className="w-16 h-16 rounded-2xl bg-sunken flex items-center justify-center mb-4 border border-line">
                      <MessageSquare size={28} className="text-muted-foreground" />
                    </div>
                    <p className="text-sm font-semibold text-muted-foreground">No conversations yet</p>
                    <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                      {botFilter ? 'No conversations for this bot. Switch to All or try another bot.' : 'Send a WhatsApp message to your bot number to start.'}
                    </p>
                  </>
                )}
              </div>
            ) : (
              <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${statusFilter === 'escalated' ? 'border-red-100' : 'border-line'}`}>
                <div className="divide-y divide-line">
                  {groups.map(({ convs, contact }) => {
                    const primary     = convs[0]!;
                    const displayName = contact?.name ?? contact?.phone ?? 'Unknown';
                    const style       = CONV_STATUS_STYLES[primary.status] ?? CONV_STATUS_STYLES.resolved;
                    const colorIdx    = displayName.charCodeAt(0) % AVATAR_COLORS.length;
                    const sentiment   = contact?.memory_json?.['sentiment'] as ContactSentiment | undefined;
                    const sentMeta    = sentiment ? SENTIMENT_META[sentiment] : null;
                    const diffMins    = Math.floor((Date.now() - new Date(primary.updated_at).getTime()) / 60000);
                    const timeAgo     = diffMins < 1 ? 'Just now' : diffMins < 60 ? `${diffMins}m` : diffMins < 1440 ? `${Math.floor(diffMins / 60)}h` : `${Math.floor(diffMins / 1440)}d`;

                    return (
                      <Link key={primary.id} href={`/conversations/${primary.id}`}
                        className="flex items-center gap-4 px-6 py-4 hover:bg-sunken transition-colors group">
                        <div className={`w-10 h-10 rounded-full ${AVATAR_COLORS[colorIdx]} flex items-center justify-center font-bold text-sm shrink-0`}>
                          {displayName[0]?.toUpperCase() ?? '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-text truncate group-hover:text-done transition-colors">{displayName}</p>
                          {contact?.name && <p className="text-xs text-muted-foreground truncate">{contact.phone}</p>}
                          {/* Bot badges — one per conversation this contact has */}
                          <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                            {convs.map(c => {
                              const p = PRODUCT_LABELS[c.product_type];
                              const s = CONV_STATUS_STYLES[c.status] ?? CONV_STATUS_STYLES.resolved;
                              if (!p) return null;
                              return (
                                <span key={c.id} className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-px rounded ${p.color}`}>
                                  <span className={`w-1 h-1 rounded-full ${s.dot}`} />
                                  {p.label}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                          {sentMeta && (
                            <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${sentMeta.bg} ${sentMeta.text}`} title={sentMeta.label}>
                              {sentMeta.emoji} {sentMeta.label}
                            </span>
                          )}
                          <span className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ring-1 ${style.badge}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                            {humanizeStatus(primary.status)}
                          </span>
                          <span className="text-xs text-muted-foreground w-8 text-right tabular-nums">{timeAgo}</span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* ── CONTACTS TAB ──────────────────────────────────────────────────────── */}
      {activeTab === 'contacts' && (
        <div role="tabpanel" id="tabpanel-contacts" aria-label="Contacts">
          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: <Users size={18} className="text-done" />,  label: 'Total Contacts',    value: contactStats.total,          bg: 'bg-done-bg' },
              { icon: <Clock size={18} className="text-blue-600" />,     label: 'Active This Week',  value: contactStats.activeThisWeek, bg: 'bg-blue-50'    },
              { icon: <Star size={18} className="text-amber-500" />,     label: 'Positive Sentiment',value: contactStats.positive,        bg: 'bg-amber-50'   },
              { icon: <AlertCircle size={18} className="text-red-500" />,label: 'Frustrated',        value: contactStats.frustrated,      bg: 'bg-red-50'     },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-xl border border-line p-4 flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg ${s.bg} flex items-center justify-center shrink-0`}>{s.icon}</div>
                <div>
                  <p className="text-xl font-bold text-text tabular-nums">{s.value.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <form method="GET" className="relative flex-1 max-w-xs">
              <input type="hidden" name="tab" value="contacts" />
              {sentimentFilter !== 'all' && <input type="hidden" name="sentiment" value={sentimentFilter} />}
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                name="q"
                defaultValue={search}
                placeholder="Search by name or phone…"
                aria-label="Search contacts by name or phone"
                className="w-full pl-9 pr-3 py-2 text-sm border border-line rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand"
              />
            </form>
            <div className="flex gap-1 flex-wrap">
              {contactSentimentTabs.map(tab => {
                const p = new URLSearchParams();
                p.set('tab', 'contacts');
                if (tab.key !== 'all') p.set('sentiment', tab.key);
                if (search.trim()) p.set('q', search.trim());
                const active = sentimentFilter === tab.key || (tab.key === 'all' && sentimentFilter === 'all');
                return (
                  <Link key={tab.key} href={`/conversations?${p.toString()}`}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      active ? 'bg-brand-strong text-white' : 'bg-white text-muted-foreground border border-line hover:border-brand hover:text-brand-strong'
                    }`}>
                    {tab.label}
                    {tab.count !== null && tab.count > 0 && (
                      <span className={`ml-1.5 ${active ? 'text-white/70' : 'text-muted-foreground'}`}>{tab.count}</span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Contact list — fully interactive client component */}
          <ContactsTabClient
            contacts={contactRows.map(c => {
              const convos = c.conversations ?? [];
              const sorted = [...convos].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
              return {
                id:             c.id,
                phone:          c.phone,
                bsuid:          c.bsuid,
                name:           c.name,
                memory_json:    c.memory_json as {
                  sentiment?: string;
                  preferences?: Record<string, string>;
                  open_issues?: string[];
                  awaiting_csat?: boolean;
                  csat_score?: number;
                } | null,
                updated_at:     c.updated_at,
                conv_count:     convos.length,
                latest_conv_id: sorted[0]?.id ?? null,
              };
            })}
          />

          <p className="text-xs text-muted-foreground text-center">
            {contactRows.length} contact{contactRows.length !== 1 ? 's' : ''}
            {sentimentFilter !== 'all' ? ` · filtered by ${sentimentFilter}` : ''}
            {search ? ` · matching &ldquo;${search}&rdquo;` : ''}
          </p>
        </div>
      )}
    </div>
  );
}
