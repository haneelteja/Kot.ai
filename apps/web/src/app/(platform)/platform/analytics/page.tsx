import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import {
  MessageSquare,
  Bot,
  AlertCircle,
  Users,
  TrendingUp,
  BarChart2,
  Phone,
  Megaphone,
  IndianRupee,
} from 'lucide-react';
import Link from 'next/link';

const BOT_META: Record<string, { name: string; color: string; bg: string; border: string }> = {
  support_bot:   { name: 'Support Bot',   color: 'text-sky-600',    bg: 'bg-sky-50',    border: 'border-sky-200'    },
  sales_bot:     { name: 'Sales Bot',     color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-200' },
  lifecycle_bot: { name: 'Lifecycle Bot', color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
};

const STATUS_BADGE: Record<string, string> = {
  open:       'bg-done-bg text-done ring-done',
  escalated:  'bg-red-50 text-red-700 ring-red-200',
  resolved:   'bg-sunken text-muted-foreground ring-neutral',
  bot_paused: 'bg-amber-50 text-amber-700 ring-amber-200',
};

const PLAN_META: Record<string, { label: string; color: string; bg: string }> = {
  starter: { label: 'Starter', color: 'text-muted-foreground',  bg: 'bg-sunken'  },
  growth:  { label: 'Growth',  color: 'text-indigo-600', bg: 'bg-indigo-50'  },
  scale:   { label: 'Scale',   color: 'text-violet-600', bg: 'bg-violet-50'  },
};

type SearchParams = Promise<{ range?: string }>;

function startOfPeriod(range: string): string {
  const now = new Date();
  if (range === '7d')  { now.setDate(now.getDate() - 7);  return now.toISOString(); }
  if (range === '90d') { now.setDate(now.getDate() - 90); return now.toISOString(); }
  now.setDate(now.getDate() - 30);
  return now.toISOString();
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000)      return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function fmtDuration(seconds: number): string {
  if (seconds < 60)  return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

type VoiceCallRow    = { status: string; duration_seconds: number | null; cost_rupees: string | null; triggered_by: string };
type CampaignRow     = { status: string; channel: string; contact_count: number; stats: Record<string, number> | null };

export default async function PlatformAnalyticsPage({ searchParams }: { searchParams: SearchParams }) {
  const { range = '30d' } = await searchParams;
  const since = startOfPeriod(range);

  const admin = getSupabaseAdminClient();

  const [
    { data: tenants },
    { count: totalConvs },
    { count: openConvs },
    { count: escalatedConvs },
    { count: resolvedConvs },
    { count: totalMessages },
    { count: userMessages },
    { count: totalEscalations },
    { count: pendingEscalations },
    { data: convsByBot },
    { data: recentConvs },
    { count: contacts },
    { data: voiceCalls },
    { data: campaigns },
    { count: newTenants },
    { data: llmConfigs },
    { count: kbDocs },
  ] = await Promise.all([
    admin.from('tenants').select('id, name, plan, status'),

    admin.from('conversations').select('*', { count: 'exact', head: true })
      .gte('created_at', since),

    admin.from('conversations').select('*', { count: 'exact', head: true })
      .eq('status', 'open').gte('created_at', since),

    admin.from('conversations').select('*', { count: 'exact', head: true })
      .eq('status', 'escalated').gte('created_at', since),

    admin.from('conversations').select('*', { count: 'exact', head: true })
      .eq('status', 'resolved').gte('created_at', since),

    admin.from('messages').select('*', { count: 'exact', head: true })
      .gte('timestamp', since),

    admin.from('messages').select('*', { count: 'exact', head: true })
      .eq('role', 'user').gte('timestamp', since),

    admin.from('escalations').select('*', { count: 'exact', head: true })
      .gte('created_at', since),

    admin.from('escalations').select('*', { count: 'exact', head: true })
      .eq('status', 'pending').gte('created_at', since),

    admin.from('conversations').select('product_type, tenant_id')
      .gte('created_at', since),

    admin.from('conversations')
      .select('id, product_type, status, created_at, tenant_id, tenants(name)')
      .order('created_at', { ascending: false })
      .limit(10),

    admin.from('contacts').select('tenant_id', { count: 'exact', head: true }),

    admin.from('voice_calls')
      .select('status, duration_seconds, cost_rupees, triggered_by')
      .gte('created_at', since),

    admin.from('campaigns')
      .select('status, channel, contact_count, stats')
      .gte('created_at', since),

    admin.from('tenants').select('*', { count: 'exact', head: true })
      .gte('created_at', since),

    admin.from('llm_configs')
      .select('provider, model, tenant_id')
      .eq('validation_status', 'valid'),

    admin.from('kb_documents').select('*', { count: 'exact', head: true })
      .eq('status', 'active'),
  ]);

  // ── WhatsApp aggregates ───────────────────────────────────────────────────
  const botCounts: Record<string, number> = {};
  for (const c of convsByBot ?? []) {
    botCounts[c.product_type] = (botCounts[c.product_type] ?? 0) + 1;
  }

  const tenantConvCounts: Record<string, number> = {};
  for (const c of convsByBot ?? []) {
    tenantConvCounts[c.tenant_id] = (tenantConvCounts[c.tenant_id] ?? 0) + 1;
  }

  const tenantList = (tenants ?? [])
    .map(t => ({ ...t, convCount: tenantConvCounts[t.id] ?? 0 }))
    .sort((a, b) => b.convCount - a.convCount);

  const resolutionRate = totalConvs
    ? Math.round(((resolvedConvs ?? 0) / (totalConvs ?? 1)) * 100)
    : 0;

  const escalationRate = totalConvs
    ? Math.round(((totalEscalations ?? 0) / (totalConvs ?? 1)) * 100)
    : 0;

  // ── Voice aggregates ──────────────────────────────────────────────────────
  const calls = (voiceCalls ?? []) as VoiceCallRow[];
  const totalCalls     = calls.length;
  const answeredCalls  = calls.filter(c => c.status === 'completed').length;
  const failedCalls    = calls.filter(c => ['failed', 'no_answer', 'busy'].includes(c.status)).length;
  const voicemailCalls = calls.filter(c => c.status === 'voicemail').length;
  const answerRate     = totalCalls ? Math.round((answeredCalls / totalCalls) * 100) : 0;
  const totalDurationS = calls.reduce((s, c) => s + (c.duration_seconds ?? 0), 0);
  const avgDurationS   = answeredCalls ? Math.round(totalDurationS / answeredCalls) : 0;
  const totalCostINR   = calls.reduce((s, c) => s + parseFloat(c.cost_rupees ?? '0'), 0);
  const escalationCalls = calls.filter(c => c.triggered_by === 'escalation').length;
  const campaignCalls   = calls.filter(c => c.triggered_by === 'campaign').length;

  // ── Campaign aggregates ───────────────────────────────────────────────────
  const camps = (campaigns ?? []) as CampaignRow[];
  const totalCampaigns    = camps.length;
  const runningCampaigns  = camps.filter(c => c.status === 'running').length;
  const completedCampaigns = camps.filter(c => c.status === 'completed').length;
  const waCampaigns       = camps.filter(c => c.channel === 'whatsapp').length;
  const voiceCampaigns    = camps.filter(c => c.channel === 'voice').length;
  const bothCampaigns     = camps.filter(c => c.channel === 'both').length;
  const totalCampContacts = camps.reduce((s, c) => s + (c.contact_count ?? 0), 0);
  const totalWaSent       = camps.reduce((s, c) => s + (c.stats?.wa_sent ?? 0), 0);
  const totalWaReplied    = camps.reduce((s, c) => s + (c.stats?.wa_replied ?? 0), 0);
  const totalCallsMade    = camps.reduce((s, c) => s + (c.stats?.calls_made ?? 0), 0);
  const totalCallsAnswered = camps.reduce((s, c) => s + (c.stats?.calls_answered ?? 0), 0);

  // ── LLM provider distribution ─────────────────────────────────────────────
  const llmProviderCounts: Record<string, number> = {};
  for (const cfg of (llmConfigs ?? []) as Array<{ provider: string; model: string; tenant_id: string | null }>) {
    llmProviderCounts[cfg.provider] = (llmProviderCounts[cfg.provider] ?? 0) + 1;
  }
  const tenantsWithCustomLlm = new Set(
    (llmConfigs ?? []).filter((c: { tenant_id: string | null }) => c.tenant_id !== null).map((c: { tenant_id: string | null }) => c.tenant_id)
  ).size;

  // ── Tenant plan distribution ──────────────────────────────────────────────
  const planCounts: Record<string, number> = { starter: 0, growth: 0, scale: 0 };
  const statusCounts: Record<string, number> = { active: 0, trial: 0, suspended: 0 };
  for (const t of tenants ?? []) {
    planCounts[t.plan]     = (planCounts[t.plan] ?? 0) + 1;
    statusCounts[t.status] = (statusCounts[t.status] ?? 0) + 1;
  }
  const totalTenants = (tenants ?? []).length;

  const RANGES = [
    { label: '7 days',  value: '7d'  },
    { label: '30 days', value: '30d' },
    { label: '90 days', value: '90d' },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-text">Platform Analytics</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Aggregate metrics across all tenants</p>
        </div>
        <div className="flex items-center gap-1 bg-sunken rounded-lg p-1">
          {RANGES.map(r => (
            <Link
              key={r.value}
              href={`/platform/analytics?range=${r.value}`}
              className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-colors ${
                range === r.value
                  ? 'bg-white text-text shadow-sm'
                  : 'text-muted-foreground hover:text-text'
              }`}
            >
              {r.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Top-line KPIs — WhatsApp */}
      <div>
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">WhatsApp</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Conversations',  value: fmtNum(totalConvs ?? 0),      icon: MessageSquare, color: 'text-indigo-600', bg: 'bg-indigo-50'  },
            { label: 'Messages',       value: fmtNum(totalMessages ?? 0),    icon: TrendingUp,    color: 'text-done',bg: 'bg-done-bg' },
            { label: 'Escalations',    value: fmtNum(totalEscalations ?? 0), icon: AlertCircle,   color: 'text-red-500',   bg: 'bg-red-50'    },
            { label: 'Total Contacts', value: fmtNum(contacts ?? 0),         icon: Users,         color: 'text-violet-600',bg: 'bg-violet-50'  },
          ].map(s => (
            <div key={s.label} className="bg-white border border-line rounded-xl p-4">
              <div className={`w-8 h-8 rounded-lg ${s.bg} flex items-center justify-center mb-2`}>
                <s.icon size={15} className={s.color} />
              </div>
              <p className="text-2xl font-bold tabular-nums text-text">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Top-line KPIs — Voice */}
      <div>
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Voice</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Calls Made',    value: fmtNum(totalCalls),                  icon: Phone,         color: 'text-sky-600',    bg: 'bg-sky-50'    },
            { label: 'Answered',      value: fmtNum(answeredCalls),               icon: Phone,         color: 'text-done',bg: 'bg-done-bg' },
            { label: 'Answer Rate',   value: `${answerRate}%`,                    icon: TrendingUp,    color: 'text-indigo-600', bg: 'bg-indigo-50'  },
            { label: 'Total Cost',    value: `₹${totalCostINR.toFixed(0)}`,       icon: IndianRupee,   color: 'text-amber-600',  bg: 'bg-amber-50'   },
          ].map(s => (
            <div key={s.label} className="bg-white border border-line rounded-xl p-4">
              <div className={`w-8 h-8 rounded-lg ${s.bg} flex items-center justify-center mb-2`}>
                <s.icon size={15} className={s.color} />
              </div>
              <p className="text-2xl font-bold tabular-nums text-text">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Top-line KPIs — Campaigns */}
      <div>
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Campaigns</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Campaigns', value: fmtNum(totalCampaigns),     icon: Megaphone, color: 'text-violet-600', bg: 'bg-violet-50'  },
            { label: 'Contacts Reached',value: fmtNum(totalCampContacts),  icon: Users,     color: 'text-indigo-600', bg: 'bg-indigo-50'  },
            { label: 'WA Sent',         value: fmtNum(totalWaSent),        icon: MessageSquare, color: 'text-done', bg: 'bg-done-bg' },
            { label: 'Calls Initiated', value: fmtNum(totalCallsMade),     icon: Phone,     color: 'text-sky-600',    bg: 'bg-sky-50'     },
          ].map(s => (
            <div key={s.label} className="bg-white border border-line rounded-xl p-4">
              <div className={`w-8 h-8 rounded-lg ${s.bg} flex items-center justify-center mb-2`}>
                <s.icon size={15} className={s.color} />
              </div>
              <p className="text-2xl font-bold tabular-nums text-text">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Conversation health */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Open',         value: fmtNum(openConvs ?? 0),      sub: 'conversations', color: 'text-done' },
          { label: 'Escalated',    value: fmtNum(escalatedConvs ?? 0), sub: 'conversations', color: 'text-red-600'     },
          { label: 'Resolution',   value: `${resolutionRate}%`,         sub: 'rate',          color: 'text-indigo-600'  },
          { label: 'Escalation',   value: `${escalationRate}%`,         sub: 'rate',          color: 'text-amber-600'   },
        ].map(s => (
          <div key={s.label} className="bg-white border border-line rounded-xl p-4">
            <p className={`text-2xl font-bold tabular-nums ${s.color}`}>{s.value}</p>
            <p className="text-xs text-muted-foreground font-medium mt-0.5">{s.label}</p>
            <p className="text-[10px] text-muted-foreground">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Three-col: Bot breakdown + Voice breakdown + Escalation summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Bot breakdown */}
        <div className="bg-white border border-line rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Bot size={14} className="text-muted-foreground" />
            <p className="text-sm font-semibold text-text">Conversations by Bot</p>
          </div>
          <div className="space-y-2.5">
            {Object.entries(BOT_META).map(([slug, meta]) => {
              const count = botCounts[slug] ?? 0;
              const pct   = totalConvs ? Math.round((count / (totalConvs ?? 1)) * 100) : 0;
              return (
                <div key={slug}>
                  <div className="flex items-center justify-between mb-1">
                    <p className={`text-xs font-medium ${meta.color}`}>{meta.name}</p>
                    <p className="text-xs font-semibold text-text tabular-nums">
                      {fmtNum(count)} <span className="text-muted-foreground font-normal">({pct}%)</span>
                    </p>
                  </div>
                  <div className="h-2 bg-sunken rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${meta.bg.replace('-50', '-400')}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {(totalConvs ?? 0) === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">No conversations in this period.</p>
            )}
          </div>
        </div>

        {/* Voice breakdown */}
        <div className="bg-white border border-line rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Phone size={14} className="text-muted-foreground" />
            <p className="text-sm font-semibold text-text">Voice Calls</p>
          </div>
          <div className="space-y-3">
            {[
              { label: 'Total calls',   value: fmtNum(totalCalls),                            color: 'text-text'   },
              { label: 'Answered',      value: `${fmtNum(answeredCalls)} (${answerRate}%)`,   color: 'text-done' },
              { label: 'Voicemail',     value: fmtNum(voicemailCalls),                        color: 'text-amber-600'   },
              { label: 'Failed / N/A',  value: fmtNum(failedCalls),                           color: 'text-red-600'     },
              { label: 'Avg duration',  value: avgDurationS ? fmtDuration(avgDurationS) : '—', color: 'text-text' },
              { label: 'From escalation', value: fmtNum(escalationCalls),                     color: 'text-muted-foreground'   },
              { label: 'From campaigns',  value: fmtNum(campaignCalls),                       color: 'text-muted-foreground'   },
              { label: 'Total cost',    value: `₹${totalCostINR.toFixed(2)}`,                 color: 'text-amber-700'   },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between py-1.5 border-b border-line last:border-0">
                <p className="text-xs text-muted-foreground">{row.label}</p>
                <p className={`text-xs font-bold tabular-nums ${row.color}`}>{row.value}</p>
              </div>
            ))}
            {totalCalls === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">No calls in this period.</p>
            )}
          </div>
        </div>

        {/* Escalation summary */}
        <div className="bg-white border border-line rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle size={14} className="text-muted-foreground" />
            <p className="text-sm font-semibold text-text">Escalations</p>
          </div>
          <div className="space-y-3">
            {[
              { label: 'Total',    value: totalEscalations ?? 0,   color: 'text-text' },
              { label: 'Pending',  value: pendingEscalations ?? 0, color: 'text-red-600'   },
              { label: 'Resolved', value: (totalEscalations ?? 0) - (pendingEscalations ?? 0), color: 'text-done' },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between py-2 border-b border-line last:border-0">
                <p className="text-xs text-muted-foreground">{row.label}</p>
                <p className={`text-sm font-bold tabular-nums ${row.color}`}>{fmtNum(row.value)}</p>
              </div>
            ))}
            <div className="flex items-center justify-between py-2 border-b border-line">
              <p className="text-xs text-muted-foreground">Avg messages / conv.</p>
              <p className="text-sm font-bold tabular-nums text-text">
                {totalConvs ? ((totalMessages ?? 0) / totalConvs).toFixed(1) : '—'}
              </p>
            </div>
            <div className="flex items-center justify-between py-2">
              <p className="text-xs text-muted-foreground">User messages</p>
              <p className="text-sm font-bold tabular-nums text-text">{fmtNum(userMessages ?? 0)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Campaign breakdown */}
      {totalCampaigns > 0 && (
        <div className="bg-white border border-line rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Megaphone size={14} className="text-muted-foreground" />
            <p className="text-sm font-semibold text-text">Campaign Breakdown</p>
            <span className="text-xs text-muted-foreground ml-auto">{totalCampaigns} total</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {/* Status breakdown */}
            <div className="space-y-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">By Status</p>
              {[
                { label: 'Running',   value: runningCampaigns,   color: 'text-done' },
                { label: 'Completed', value: completedCampaigns, color: 'text-indigo-700'  },
                { label: 'Other',     value: totalCampaigns - runningCampaigns - completedCampaigns, color: 'text-muted-foreground' },
              ].map(r => (
                <div key={r.label} className="flex justify-between">
                  <p className="text-xs text-muted-foreground">{r.label}</p>
                  <p className={`text-xs font-bold ${r.color}`}>{r.value}</p>
                </div>
              ))}
            </div>
            {/* Channel breakdown */}
            <div className="space-y-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">By Channel</p>
              {[
                { label: 'WhatsApp', value: waCampaigns,    color: 'text-done' },
                { label: 'Voice',    value: voiceCampaigns, color: 'text-sky-700'     },
                { label: 'Both',     value: bothCampaigns,  color: 'text-violet-700'  },
              ].map(r => (
                <div key={r.label} className="flex justify-between">
                  <p className="text-xs text-muted-foreground">{r.label}</p>
                  <p className={`text-xs font-bold ${r.color}`}>{r.value}</p>
                </div>
              ))}
            </div>
            {/* WA stats */}
            <div className="space-y-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">WhatsApp</p>
              {[
                { label: 'Sent',    value: fmtNum(totalWaSent)    },
                { label: 'Replied', value: fmtNum(totalWaReplied) },
                { label: 'Reply rate', value: totalWaSent ? `${Math.round((totalWaReplied / totalWaSent) * 100)}%` : '—' },
              ].map(r => (
                <div key={r.label} className="flex justify-between">
                  <p className="text-xs text-muted-foreground">{r.label}</p>
                  <p className="text-xs font-bold text-text">{r.value}</p>
                </div>
              ))}
            </div>
            {/* Voice call stats */}
            <div className="space-y-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Voice</p>
              {[
                { label: 'Initiated', value: fmtNum(totalCallsMade)    },
                { label: 'Answered',  value: fmtNum(totalCallsAnswered) },
                { label: 'Answer rate', value: totalCallsMade ? `${Math.round((totalCallsAnswered / totalCallsMade) * 100)}%` : '—' },
              ].map(r => (
                <div key={r.label} className="flex justify-between">
                  <p className="text-xs text-muted-foreground">{r.label}</p>
                  <p className="text-xs font-bold text-text">{r.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tenant leaderboard + Plan distribution */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Leaderboard */}
        <div className="sm:col-span-2 bg-white border border-line rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-line">
            <BarChart2 size={14} className="text-muted-foreground" />
            <p className="text-sm font-semibold text-text">Top Clients by Conversations</p>
            <span className="text-xs text-muted-foreground ml-auto">{RANGES.find(r => r.value === range)?.label}</span>
          </div>
          <div className="divide-y divide-line">
            {tenantList.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">No data yet.</p>
            ) : tenantList.map((t, i) => (
              <Link
                key={t.id}
                href={`/platform/clients/${t.id}`}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-sunken transition-colors group"
              >
                <span className="text-xs font-bold text-muted-foreground w-5 tabular-nums">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-text group-hover:text-indigo-700 transition-colors truncate">{t.name}</p>
                  <p className="text-[10px] text-muted-foreground capitalize">{t.plan} · {t.status}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="w-20 h-1.5 bg-sunken rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-400 rounded-full"
                      style={{ width: tenantList[0].convCount ? `${(t.convCount / tenantList[0].convCount) * 100}%` : '0%' }}
                    />
                  </div>
                  <p className="text-xs font-bold text-text tabular-nums w-8 text-right">{fmtNum(t.convCount)}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Plan distribution */}
        <div className="bg-white border border-line rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users size={14} className="text-muted-foreground" />
            <p className="text-sm font-semibold text-text">Tenant Overview</p>
            <span className="text-xs text-muted-foreground ml-auto">{totalTenants} total</span>
          </div>

          <div className="mb-5">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">By Plan</p>
            <div className="space-y-2">
              {Object.entries(PLAN_META).map(([plan, meta]) => {
                const count = planCounts[plan] ?? 0;
                const pct   = totalTenants ? Math.round((count / totalTenants) * 100) : 0;
                return (
                  <div key={plan}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${meta.bg} ${meta.color}`}>{meta.label}</span>
                      <p className="text-xs font-semibold text-text tabular-nums">{count} <span className="text-muted-foreground font-normal">({pct}%)</span></p>
                    </div>
                    <div className="h-1.5 bg-sunken rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${plan === 'starter' ? 'bg-sunken' : plan === 'growth' ? 'bg-indigo-400' : 'bg-violet-400'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">By Status</p>
            <div className="space-y-1.5">
              {[
                { label: 'Active',    value: statusCounts.active    ?? 0, color: 'text-done' },
                { label: 'Trial',     value: statusCounts.trial     ?? 0, color: 'text-amber-600'   },
                { label: 'Suspended', value: statusCounts.suspended ?? 0, color: 'text-red-600'     },
              ].map(r => (
                <div key={r.label} className="flex justify-between items-center">
                  <p className="text-xs text-muted-foreground">{r.label}</p>
                  <p className={`text-xs font-bold tabular-nums ${r.color}`}>{r.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-line">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">Growth & AI</p>
            <div className="space-y-1.5">
              {[
                { label: `New clients (period)`, value: newTenants ?? 0, color: 'text-indigo-700' },
                { label: 'Custom LLM clients',   value: tenantsWithCustomLlm,  color: 'text-violet-700' },
                { label: 'Active KB docs',        value: kbDocs ?? 0,           color: 'text-done' },
              ].map(r => (
                <div key={r.label} className="flex justify-between items-center">
                  <p className="text-xs text-muted-foreground">{r.label}</p>
                  <p className={`text-xs font-bold tabular-nums ${r.color}`}>{fmtNum(r.value)}</p>
                </div>
              ))}
            </div>
          </div>

          {Object.keys(llmProviderCounts).length > 0 && (
            <div className="mt-4 pt-4 border-t border-line">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">LLM Providers</p>
              <div className="space-y-1.5">
                {Object.entries(llmProviderCounts).map(([provider, count]) => (
                  <div key={provider} className="flex justify-between items-center">
                    <p className="text-xs text-muted-foreground capitalize">{provider}</p>
                    <p className="text-xs font-bold tabular-nums text-text">{count} config{count !== 1 ? 's' : ''}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recent conversations */}
      <div className="bg-white border border-line rounded-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-line">
          <MessageSquare size={14} className="text-muted-foreground" />
          <p className="text-sm font-semibold text-text">Recent Conversations</p>
        </div>
        <div className="divide-y divide-line">
          {(recentConvs ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">No conversations yet.</p>
          ) : (recentConvs ?? []).map(c => {
            const tenant  = (c.tenants as unknown as { name: string } | null);
            const botMeta = BOT_META[c.product_type];
            return (
              <div key={c.id} className="flex items-center gap-4 px-5 py-3.5">
                <div className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold ${botMeta?.bg ?? 'bg-sunken'} ${botMeta?.color ?? 'text-muted-foreground'} border ${botMeta?.border ?? 'border-line'}`}>
                  {botMeta?.name ?? c.product_type}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-text truncate">{tenant?.name ?? '—'}</p>
                  <p className="text-[10px] text-muted-foreground">{new Date(c.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })}</p>
                </div>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ring-1 capitalize ${STATUS_BADGE[c.status] ?? STATUS_BADGE.open}`}>
                  {c.status.replace('_', ' ')}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
