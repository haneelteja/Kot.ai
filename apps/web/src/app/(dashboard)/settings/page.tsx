import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
  Building2, Phone, Bot, Link2, Bell, CreditCard, ChevronRight,
  Users, Mail, Clock, Trash2, Info, Cpu, MessageSquare, ShieldOff,
  UserCircle2, Wrench, MapPin,
} from 'lucide-react';
import { WhatsAppSetupSection }  from '@/components/dashboard/WhatsAppSetupSection';
import { NotificationSettings }  from '@/components/dashboard/NotificationSettings';
import { LeadNotificationSettings } from '@/components/dashboard/LeadNotificationSettings';
import { DailyReportSettings } from '@/components/dashboard/DailyReportSettings';
import { NotificationPreferences } from '@/components/dashboard/NotificationPreferences';
import { WhatsAppNumbersManager} from '@/components/dashboard/WhatsAppNumbersManager';
import { TeamInviteForm }        from '@/components/dashboard/TeamInviteForm';
import { removeTeamMemberAction } from '@/app/actions/tenant-team';
import { LlmConfigCard }         from '@/components/LlmConfigCard';
import type { LlmConfigCardProps } from '@/components/LlmConfigCard';
import { InternalNumbersManager } from '@/components/dashboard/InternalNumbersManager';
import { DashboardCollapsibleSection } from '@/components/dashboard/DashboardCollapsibleSection';
import { PersonaEditor } from '@/components/dashboard/PersonaEditor';
import { getBotPersonasAction } from '@/app/actions/bot-persona';
import { ToolManifestEditor } from '@/components/dashboard/ToolManifestEditor';
import { getBotToolsAction } from '@/app/actions/bot-tools';
import { BotsTabContent } from '@/components/dashboard/BotsTabContent';
import { BranchManagerEditor } from '@/components/dashboard/BranchManagerEditor';
import type { BranchInput } from '@/app/actions/whatsapp-numbers';

// ─── Types ────────────────────────────────────────────────────────────────────

type RawLlmConfig = {
  id: string;
  product_slug: string | null;
  provider: string;
  api_key: string;
  model: string;
  base_url: string | null;
  validation_status: 'pending' | 'valid' | 'invalid';
  validation_error: string | null;
  validated_at: string | null;
  credit_info: { usage: number | null; limit: number | null; is_free_tier: boolean } | null;
  created_at: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  admin:          { label: 'Admin',      color: 'bg-violet-50 text-violet-700' },
  client_manager: { label: 'Admin',      color: 'bg-violet-50 text-violet-700' },
  supervisor:     { label: 'Supervisor', color: 'bg-sky-50 text-sky-700' },
  client_admin:   { label: 'Supervisor', color: 'bg-sky-50 text-sky-700' },
  agent:          { label: 'Agent',      color: 'bg-neutral-bg text-neutral' },
};

const BOT_META_LLM: Record<string, { name: string; badge: string }> = {
  support_bot:   { name: 'Support Bot',   badge: 'bg-sky-100 text-sky-700 border-sky-200'          },
  sales_bot:     { name: 'Sales Bot',     badge: 'bg-violet-100 text-violet-700 border-violet-200'  },
  lifecycle_bot: { name: 'Lifecycle Bot', badge: 'bg-orange-100 text-orange-700 border-orange-200'  },
};

function maskLlmConfig(row: RawLlmConfig): LlmConfigCardProps['initial'] {
  return {
    id:                row.id,
    provider:          row.provider,
    api_key_masked:    '••••' + row.api_key.slice(-4),
    model:             row.model,
    base_url:          row.base_url,
    validation_status: row.validation_status,
    validation_error:  row.validation_error,
    validated_at:      row.validated_at,
    credit_info:       row.credit_info,
    created_at:        row.created_at,
  };
}

const TABS = [
  { key: 'workspace',    label: 'Workspace'     },
  { key: 'bots',         label: 'Bots'          },
  { key: 'team',         label: 'Team'          },
  { key: 'models',       label: 'AI Models'     },
  { key: 'notifications',label: 'Notifications' },
] as const;

type TabKey = typeof TABS[number]['key'];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const rawTab = searchParams.tab ?? 'workspace';
  const activeTab: TabKey = TABS.some(t => t.key === rawTab)
    ? (rawTab as TabKey)
    : 'workspace';

  const supabase = await getSupabaseServerClient();
  const admin    = getSupabaseAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: callerTU } = await admin
    .from('tenant_users')
    .select('tenant_id, role')
    .eq('user_id', user.id)
    .single();

  if (!callerTU) redirect('/dashboard');
  const tenantId = callerTU.tenant_id;
  // tenant_users.role is constrained to 'client_admin' | 'client_manager' | 'agent' —
  // 'admin'/'supervisor' are not valid values and never matched here.
  const isAdmin  = ['client_admin', 'client_manager'].includes(callerTU.role);

  // ── Workspace data ──────────────────────────────────────────────────────────
  let tenant: Record<string, unknown> | null = null;
  let numbers: Record<string, unknown>[] | null = null;
  let products: Record<string, unknown>[] | null = null;

  if (activeTab === 'workspace') {
    const apiBase = process.env['NEXT_PUBLIC_API_URL'] ?? 'https://your-api.onrender.com';
    const [tenantRes, numbersRes, productsRes] = await Promise.all([
      admin.from('tenants').select('*').eq('id', tenantId).single(),
      admin.from('whatsapp_numbers').select('*').eq('tenant_id', tenantId),
      admin.from('tenant_products').select('*').eq('tenant_id', tenantId),
    ]);
    tenant   = tenantRes.data as Record<string, unknown> | null;
    numbers  = (numbersRes.data ?? []) as Record<string, unknown>[];
    products = (productsRes.data ?? []) as Record<string, unknown>[];

    const activeBots = products.filter(p => p['active']);
    const tenantWebhookUrl = tenant?.['id'] ? `${apiBase}/api/webhook/${tenant['id']}` : '';
    const botWebhooks = activeBots.map(p => {
      const wn     = numbers!.find(n => n['product_slug'] === p['product_type']);
      const config = ((wn?.['config_json'] ?? {}) as Record<string, string>);
      return {
        productType: p['product_type'] as string,
        verifyToken: config['verify_token'] ?? null,
        phoneNumber: (wn?.['phone_number'] as string | undefined) ?? null,
        configured:  !!wn,
      };
    });

    return (
      <SettingsShell activeTab={activeTab}>
        <div className="space-y-5">
          <DashboardCollapsibleSection icon={<Building2 size={16} />} title="Workspace" hint="Read-only account details. Share your Tenant ID with support when reporting issues.">
            <div className="divide-y divide-line">
              <InfoRow label="Name"      value={(tenant?.['name'] as string) ?? '—'} />
              <InfoRow label="Provider"  value={(tenant?.['provider'] as string) ?? '—'} capitalize />
              <InfoRow label="Tenant ID" value={(tenant?.['id'] as string) ?? '—'} mono />
              <div className="flex items-center justify-between gap-4 px-5 py-3.5">
                <span className="text-sm text-muted-foreground shrink-0">Plan</span>
                <PlanBadge plan={(tenant?.['plan'] as string) ?? 'starter'} />
              </div>
              <div className="flex items-center justify-between gap-4 px-5 py-3.5">
                <span className="text-sm text-muted-foreground shrink-0">Status</span>
                <StatusBadge status={(tenant?.['status'] as string) ?? 'active'} />
              </div>
              <Link href="/billing" className="flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-sunken transition-colors group">
                <div className="flex items-center gap-2">
                  <CreditCard size={14} className="text-brand" />
                  <span className="text-sm text-text font-medium">Billing &amp; Usage</span>
                </div>
                <ChevronRight size={14} className="text-muted-foreground group-hover:text-brand transition-colors" />
              </Link>
            </div>
          </DashboardCollapsibleSection>

          <DashboardCollapsibleSection icon={<Phone size={16} />} title="WhatsApp Numbers" hint="Connect your Meta phone numbers to bots. Each number routes incoming messages to the assigned bot. Add the Phone Number ID from your Meta App Dashboard.">
            <WhatsAppNumbersManager
              numbers={numbers!.map(n => ({
                id:              n['id'] as string,
                phone_number:    n['phone_number'] as string,
                provider:        n['provider'] as string,
                label:           (n['label'] ?? null) as string | null,
                product_slug:    (n['product_slug'] ?? null) as string | null,
                phone_number_id: ((n['config_json'] as Record<string, string>)?.['phone_number_id'] ?? null),
                routing_mode:    (n['routing_mode'] ?? 'single') as 'single' | 'multi',
                routing_config:  (n['routing_config'] ?? undefined) as Record<string, unknown> | undefined,
              }))}
              activeBots={activeBots.map(p => p['product_type'] as string)}
              webhookBase={`${apiBase}/api/webhook/${tenant?.['id'] ?? ''}`}
            />
          </DashboardCollapsibleSection>

          {/* Branch Management — shown when any number has routing_config.branches */}
          {(() => {
            const branchNumbers = numbers!.filter(n => {
              const cfg = n['routing_config'] as Record<string, unknown> | null;
              return Array.isArray(cfg?.['branches']) && (cfg!['branches'] as unknown[]).length > 0;
            });
            // Also show if routing_mode is 'multi' so they can add branches
            const multiNumbers = numbers!.filter(n => n['routing_mode'] === 'multi');
            const relevant = [...new Map([...branchNumbers, ...multiNumbers].map(n => [n['id'], n])).values()];
            if (!relevant.length) return null;
            return relevant.map(n => {
              const cfg = (n['routing_config'] ?? {}) as Record<string, unknown>;
              const branches = (Array.isArray(cfg['branches']) ? cfg['branches'] : []) as BranchInput[];
              return (
                <DashboardCollapsibleSection
                  key={n['id'] as string}
                  icon={<MapPin size={16} />}
                  title={`Branches — ${(n['label'] ?? n['phone_number'] ?? n['id']) as string}`}
                  hint="Configure branch details: address, floor access, opening hours, and branch manager contact. The manager will receive a WhatsApp notification when a customer books via the bot."
                >
                  <BranchManagerEditor
                    numberId={n['id'] as string}
                    initialBranches={branches}
                  />
                </DashboardCollapsibleSection>
              );
            });
          })()}

          {activeBots.length > 0 && (
            <DashboardCollapsibleSection icon={<Link2 size={16} />} title="Meta Cloud API & Webhook Setup" hint="Paste the Webhook URL and Verify Token into your Meta App Dashboard under WhatsApp → Configuration to activate message delivery.">
              <div className="px-5 py-4">
                <WhatsAppSetupSection tenantWebhookUrl={tenantWebhookUrl} bots={botWebhooks} />
              </div>
            </DashboardCollapsibleSection>
          )}

        </div>
      </SettingsShell>
    );
  }

  // ── Bots data ────────────────────────────────────────────────────────────────
  if (activeTab === 'bots') {
    const apiBase = process.env['NEXT_PUBLIC_API_URL'] ?? 'https://your-api.onrender.com';
    const [{ data: botProducts }, { data: botNumbers }, { data: llmRows }] = await Promise.all([
      admin.from('tenant_products').select('product_type, product_slug, instance_name, tier, active').eq('tenant_id', tenantId),
      admin.from('whatsapp_numbers').select('id, phone_number, provider, label, product_slug').eq('tenant_id', tenantId),
      admin.from('llm_configs').select('product_slug, credit_info').eq('tenant_id', tenantId),
    ]);

    return (
      <SettingsShell activeTab={activeTab}>
        <BotsTabContent
          tenantId={tenantId}
          apiBase={apiBase}
          botProducts={(botProducts ?? []).map(p => ({
            product_type:  p.product_type,
            product_slug:  (p as { product_slug?: string | null }).product_slug ?? p.product_type,
            instance_name: (p as { instance_name?: string | null }).instance_name ?? 'Default',
            tier:          p.tier,
            active:        p.active,
          }))}
          numbers={(botNumbers ?? []) as { id: string; phone_number: string; provider: string; label: string | null; product_slug: string | null }[]}
          tokenUsage={(llmRows ?? []) as { product_slug: string | null; credit_info: { usage: number | null; limit: number | null; is_free_tier: boolean } | null }[]}
        />
      </SettingsShell>
    );
  }

  // ── Team data ───────────────────────────────────────────────────────────────
  if (activeTab === 'team') {
    const { data: tenantUsers } = await admin
      .from('tenant_users')
      .select('user_id, role, created_at')
      .eq('tenant_id', tenantId);

    const members = await Promise.all(
      (tenantUsers ?? []).map(async (tu) => {
        const { data: { user: authUser } } = await admin.auth.admin.getUserById(tu.user_id);
        return {
          userId:   tu.user_id,
          role:     tu.role,
          joinedAt: tu.created_at,
          email:    authUser?.email ?? '—',
          name:     (authUser?.user_metadata?.['full_name'] as string | undefined) ?? null,
          isSelf:   tu.user_id === user.id,
        };
      })
    );

    const [{ data: pendingInvites }, internalNumbersRes] = await Promise.all([
      admin
        .from('client_invites')
        .select('id, email, role, created_at, expires_at')
        .eq('tenant_id', tenantId)
        .is('accepted_at', null)
        .order('created_at', { ascending: false }),
      admin
        .from('tenant_internal_numbers')
        .select('id, phone, label, created_at')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: true }),
    ]);
    const internalNumbers = (internalNumbersRes.data ?? []) as import('@/app/actions/internal-numbers').InternalNumber[];

    return (
      <SettingsShell activeTab={activeTab}>
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">Manage your team members and invite new agents.</p>
            <span className="text-xs font-semibold text-muted-foreground bg-surface border border-line px-3 py-1.5 rounded-full shadow-sm shrink-0">
              {members.length} member{members.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Role guide */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { role: 'Admin',      desc: 'Full access. Can invite, remove members, and change all settings.',      color: 'bg-violet-50 border-violet-100 text-violet-700' },
              { role: 'Supervisor', desc: 'Manages conversations and settings. Cannot invite or remove members.',   color: 'bg-sky-50 border-sky-100 text-sky-700' },
              { role: 'Agent',      desc: 'Handles assigned conversations only. No access to settings.',            color: 'bg-sunken border-line text-muted-foreground' },
            ].map(r => (
              <div key={r.role} className={`rounded-xl border p-3 ${r.color}`}>
                <p className="text-[11px] font-bold">{r.role}</p>
                <p className="text-[10px] mt-1 leading-relaxed opacity-80">{r.desc}</p>
              </div>
            ))}
          </div>

          {isAdmin
            ? <TeamInviteForm />
            : (
              <div className="bg-sunken border border-line rounded-xl px-4 py-3">
                <p className="text-xs text-muted-foreground">Only Admins can invite or remove team members. Contact your workspace Admin to make changes.</p>
              </div>
            )
          }

          <div className="bg-surface rounded-2xl border border-line shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-line">
              <h3 className="text-sm font-semibold text-text flex items-center gap-2">
                <Users size={14} />
                Active members
              </h3>
            </div>
            <div className="divide-y divide-line">
              {members.map((m) => {
                const roleMeta = ROLE_LABELS[m.role] ?? { label: m.role, color: 'bg-sunken text-muted-foreground' };
                return (
                  <div key={m.userId} className="flex items-center gap-4 px-5 py-3.5">
                    <div className="w-9 h-9 rounded-full bg-brand-wash flex items-center justify-center text-brand-strong font-bold text-sm shrink-0">
                      {(m.name ?? m.email)[0]?.toUpperCase() ?? '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      {m.name && <p className="text-sm font-semibold text-text truncate">{m.name}</p>}
                      <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${roleMeta.color}`}>
                        {roleMeta.label}
                      </span>
                      {m.isSelf && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-brand-wash text-brand-strong font-medium">You</span>
                      )}
                      {isAdmin && !m.isSelf && (
                        <form action={removeTeamMemberAction.bind(null, m.userId) as unknown as (formData: FormData) => Promise<void>}>
                          <button
                            type="submit"
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-problem-bg hover:text-problem transition-colors"
                            title="Remove member"
                          >
                            <Trash2 size={13} />
                          </button>
                        </form>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {(pendingInvites?.length ?? 0) > 0 && (
            <div className="bg-surface rounded-2xl border border-line shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b border-line">
                <h3 className="text-sm font-semibold text-text flex items-center gap-2">
                  <Clock size={14} />
                  Pending invites
                </h3>
              </div>
              <div className="divide-y divide-line">
                {(pendingInvites ?? []).map((inv) => {
                  const expired   = new Date(inv.expires_at) < new Date();
                  const roleMeta  = ROLE_LABELS[inv.role] ?? { label: inv.role, color: 'bg-sunken text-muted-foreground' };
                  return (
                    <div key={inv.id} className="flex items-center gap-4 px-5 py-3.5">
                      <div className="w-9 h-9 rounded-full bg-sunken flex items-center justify-center text-muted-foreground shrink-0">
                        <Mail size={14} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text truncate">{inv.email}</p>
                        <p className={`text-xs mt-0.5 ${expired ? 'text-problem' : 'text-muted-foreground'}`}>
                          {expired ? 'Expired' : `Expires ${new Date(inv.expires_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`}
                        </p>
                      </div>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${roleMeta.color}`}>
                        {roleMeta.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="bg-surface rounded-2xl border border-line shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-line">
              <h3 className="text-sm font-semibold text-text flex items-center gap-2">
                <ShieldOff size={14} />
                Internal Team Numbers
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">Messages from these numbers are silently ignored — no bot reply, no lead created.</p>
            </div>
            <InternalNumbersManager initialNumbers={internalNumbers} />
          </div>
        </div>
      </SettingsShell>
    );
  }

  // ── AI Models data ──────────────────────────────────────────────────────────
  if (activeTab === 'models') {
    const [{ data: llmRows }, { data: llmProducts }, personas, botToolsRows] = await Promise.all([
      admin.from('llm_configs').select('id, product_slug, provider, api_key, model, base_url, validation_status, validation_error, validated_at, credit_info, created_at').eq('tenant_id', tenantId),
      admin.from('tenant_products').select('product_type').eq('tenant_id', tenantId).eq('active', true),
      getBotPersonasAction(),
      getBotToolsAction(),
    ]);

    const configMap: Record<string, RawLlmConfig | null> = { __generic__: null };
    for (const row of (llmRows ?? []) as RawLlmConfig[]) {
      configMap[row.product_slug ?? '__generic__'] = row;
    }
    const activeSlugs = (llmProducts ?? []).map((p: { product_type: string }) => p.product_type);

    return (
      <SettingsShell activeTab={activeTab}>
        <div className="space-y-5">
          <p className="text-sm text-muted-foreground">
            Bring your own LLM API key for cost control and higher rate limits. Leave blank to use the platform default — your bots work out of the box without any configuration here.
          </p>

          <div className="bg-brand-wash border border-line rounded-2xl p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Info size={13} className="text-brand-strong" />
              <p className="text-xs font-semibold text-brand-strong">How this works</p>
            </div>
            <div className="flex items-center gap-1 flex-wrap text-[11px] text-brand-strong">
              {['Per-Bot (below)', 'Account Default (below)', 'Platform Bot-type', 'Platform Default'].map((level, i) => (
                <span key={level} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight size={10} className="text-brand" />}
                  <span className={i < 2 ? 'font-semibold text-brand-strong' : 'text-brand'}>{level}</span>
                </span>
              ))}
              <span className="ml-1 text-brand">→ system default</span>
            </div>
            <p className="text-[11px] text-brand-strong">
              All fields are <span className="font-semibold">optional</span> — your bots work without any configuration here (using the platform default).
            </p>
          </div>

          <div className="bg-surface rounded-2xl border border-line shadow-sm overflow-hidden">
            <div className="flex items-center gap-2.5 px-5 py-4 border-b border-line">
              <Cpu size={15} className="text-brand" />
              <h3 className="text-sm font-semibold text-text">Account Default</h3>
              <span className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full bg-brand-wash text-brand-strong border border-line">
                All your bots
              </span>
            </div>
            <div className="p-4">
              <LlmConfigCard
                label="Account Default"
                description="Used when no per-bot configuration is set. Applies across all your bots."
                tenantId={tenantId}
                productSlug={null}
                initial={configMap['__generic__'] ? maskLlmConfig(configMap['__generic__']!) : null}
                accent="emerald"
              />
            </div>
          </div>

          {activeSlugs.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Cpu size={14} className="text-muted-foreground" />
                <h3 className="text-sm font-semibold text-text">Per-Bot Override</h3>
                <span className="ml-auto text-[11px] text-muted-foreground">Overrides account default for that bot only</span>
              </div>
              <div className="space-y-3">
                {activeSlugs.map((slug: string) => {
                  const meta = BOT_META_LLM[slug] ?? { name: slug, badge: 'bg-sunken text-muted-foreground border-line' };
                  return (
                    <div key={slug} className="bg-surface rounded-2xl border border-line shadow-sm overflow-hidden">
                      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-line">
                        <h4 className="text-sm font-semibold text-text">{meta.name}</h4>
                        <span className={`ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full border ${meta.badge}`}>
                          {slug.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <div className="p-4">
                        <LlmConfigCard
                          label={meta.name}
                          description={`Overrides your account default specifically for the ${meta.name.toLowerCase()}.`}
                          tenantId={tenantId}
                          productSlug={slug}
                          initial={configMap[slug] ? maskLlmConfig(configMap[slug]!) : null}
                          accent="emerald"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeSlugs.length === 0 && (
            <p className="text-center py-8 text-sm text-muted-foreground">
              No active bots found. Activate bots from the Workspace tab to configure per-bot models.
            </p>
          )}

          {activeSlugs.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Wrench size={14} className="text-muted-foreground" />
                <h3 className="text-sm font-semibold text-text">Bot Tools</h3>
                <span className="ml-auto text-[11px] text-muted-foreground">Enable or disable per-bot capabilities</span>
              </div>
              <ToolManifestEditor activeSlugs={activeSlugs} botToolsRows={botToolsRows} />
            </div>
          )}

          {activeSlugs.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Bot size={14} className="text-muted-foreground" />
                <h3 className="text-sm font-semibold text-text">Bot Persona</h3>
                <span className="ml-auto text-[11px] text-muted-foreground">Injected as identity preamble before the system prompt</span>
              </div>
              <PersonaEditor activeSlugs={activeSlugs} personas={personas} />
            </div>
          )}
        </div>
      </SettingsShell>
    );
  }

  // ── Notifications data ──────────────────────────────────────────────────────
  const [{ data: notifSettings }, { data: userNotifPrefs }] = await Promise.all([
    admin.from('tenant_notification_settings').select('*').eq('tenant_id', tenantId).single(),
    admin.from('user_notification_preferences').select('escalation_email, assignment_email')
      .eq('user_id', user.id).eq('tenant_id', tenantId).maybeSingle(),
  ]);

  return (
    <SettingsShell activeTab={activeTab}>
      <div className="space-y-5">
        <p className="text-sm text-muted-foreground">
          Set up who receives an alert the moment a customer conversation is escalated by the bot.
        </p>

        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 space-y-1">
          <div className="flex items-center gap-2">
            <Bell size={13} className="text-amber-600 shrink-0" />
            <p className="text-xs font-semibold text-amber-800">When does escalation happen?</p>
          </div>
          <p className="text-xs text-amber-700">
            The bot escalates when a customer explicitly requests a human, or when it cannot confidently answer after a set number of retries. You can also configure keywords that trigger escalation in{' '}
            <Link href="/guardrails" className="font-semibold underline">Guardrails</Link>.
          </p>
        </div>

        <Section icon={<Bell size={16} />} title="Escalation Notifications" hint="Add email addresses or WhatsApp numbers (international format, e.g. +919876543210) to alert when a conversation is escalated. The customer message is sent to the end user immediately on escalation.">
          <NotificationSettings
            initialEmails={(notifSettings?.escalation_emails as string[] | null) ?? []}
            initialWaNumbers={(notifSettings?.escalation_wa_numbers as string[] | null) ?? []}
            initialCustomerMessage={notifSettings?.escalation_customer_message ?? 'Your query has been escalated to our team. A team member will get back to you shortly.'}
            initialFromEmail={(notifSettings as { from_email?: string | null } | null)?.from_email ?? ''}
            initialResendConfigured={!!(notifSettings as { resend_api_key?: string | null } | null)?.resend_api_key}
            initialResendKeyMasked={(notifSettings as { resend_api_key?: string | null } | null)?.resend_api_key
              ? '••••' + ((notifSettings as { resend_api_key: string }).resend_api_key).slice(-4)
              : ''}
          />
        </Section>

        <Section icon={<Bell size={16} />} title="Lead Notifications" hint="Notify your sales team the moment a lead is captured — when the bot detects buying intent. Configure email addresses and WhatsApp numbers to receive instant lead alerts.">
          <LeadNotificationSettings
            initialEmails={(notifSettings as { lead_notification_emails?: string[] | null } | null)?.lead_notification_emails ?? []}
            initialWaNumbers={(notifSettings as { lead_notification_wa_numbers?: string[] | null } | null)?.lead_notification_wa_numbers ?? []}
          />
        </Section>

        <Section icon={<Bell size={16} />} title="Daily Report" hint="Sent every day at 8:00 AM UTC — conversations, leads, open/escalated/resolved counts, and pending escalations. Configure who receives the email and WhatsApp summary.">
          <DailyReportSettings
            initialEmails={(notifSettings as { daily_report_emails?: string[] | null } | null)?.daily_report_emails ?? []}
            initialWaNumbers={(notifSettings as { daily_report_wa_numbers?: string[] | null } | null)?.daily_report_wa_numbers ?? []}
          />
        </Section>

        <Section icon={<Bell size={16} />} title="My Alert Preferences" hint="Control which notification emails you personally receive. These settings only affect your account.">
          <NotificationPreferences
            initial={{
              escalation_email: userNotifPrefs?.escalation_email ?? true,
              assignment_email: userNotifPrefs?.assignment_email ?? true,
            }}
          />
        </Section>
      </div>
    </SettingsShell>
  );
}

// ─── Shell (tabs + layout wrapper) ────────────────────────────────────────────

function SettingsShell({
  activeTab,
  children,
}: {
  activeTab: TabKey;
  children: React.ReactNode;
}) {
  return (
    <div className="p-6 lg:p-8 max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold text-text">Settings</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Workspace, team, and bot configuration</p>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 bg-sunken rounded-xl p-1 overflow-x-auto">
        {TABS.map(t => {
          const isActive = activeTab === t.key;
          return (
            <Link
              key={t.key}
              href={`/settings?tab=${t.key}`}
              className={`flex-1 text-center text-xs font-semibold px-3 py-2 rounded-lg whitespace-nowrap transition-all duration-150 ${
                isActive
                  ? 'bg-surface text-brand-strong shadow-sm'
                  : 'text-muted-foreground hover:text-text hover:bg-surface/60'
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      {children}
    </div>
  );
}

// ─── Shared UI helpers ─────────────────────────────────────────────────────────

function Section({ icon, title, hint, children }: { icon: React.ReactNode; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface rounded-2xl border border-line shadow-sm overflow-hidden">
      <div className="flex items-start gap-2.5 px-5 py-4 border-b border-line">
        <span className="text-brand-strong mt-0.5 shrink-0">{icon}</span>
        <div>
          <h2 className="text-sm font-semibold text-text">{title}</h2>
          {hint && <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{hint}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

function InfoRow({ label, value, mono = false, capitalize = false }: { label: string; value: string; mono?: boolean; capitalize?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3.5">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <span className={`text-right truncate max-w-[60%] ${mono ? 'font-mono text-xs text-muted-foreground bg-sunken px-2 py-0.5 rounded-md' : 'text-sm text-text'} ${capitalize ? 'capitalize' : ''}`}>
        {value}
      </span>
    </div>
  );
}

const PLAN_BADGE: Record<string, { label: string; bg: string; text: string }> = {
  starter: { label: 'Starter', bg: 'bg-neutral-bg',  text: 'text-neutral'      },
  growth:  { label: 'Growth',  bg: 'bg-violet-100',  text: 'text-violet-700'  },
  scale:   { label: 'Scale',   bg: 'bg-brand-wash',  text: 'text-brand-strong' },
};

function PlanBadge({ plan }: { plan: string }) {
  const b = PLAN_BADGE[plan] ?? PLAN_BADGE['starter'];
  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${b.bg} ${b.text}`}>
      {b.label}
    </span>
  );
}

const STATUS_BADGE: Record<string, { bg: string; text: string; dot: string }> = {
  active:    { bg: 'bg-done-bg',    text: 'text-done',    dot: 'bg-done'    },
  trial:     { bg: 'bg-sky-50',     text: 'text-sky-700', dot: 'bg-sky-500' },
  suspended: { bg: 'bg-problem-bg', text: 'text-problem', dot: 'bg-problem' },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_BADGE[status] ?? STATUS_BADGE['active'];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {status}
    </span>
  );
}
