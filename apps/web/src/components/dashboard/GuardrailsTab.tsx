import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import { Shield, ShieldAlert } from 'lucide-react';
import { TenantGuardrailsForm } from '@/components/platform/TenantGuardrailsForm';
import { BotConfigForm } from '@/components/dashboard/BotConfigForm';
import { saveTenantGuardrailsAction } from '@/app/actions/tenant-guardrails';
import type { BotConfig, LayeredGuardrailsConfig, Product } from '@alphabot/shared';

const DEFAULT_TENANT_G: LayeredGuardrailsConfig = {
  blocked_topics:      [],
  blocked_keywords:    [],
  max_response_length: 2000,
  kb_only_mode:        false,
  no_personal_data:    false,
  no_external_links:   false,
  on_blocked_topic:    'escalate',
};

export async function GuardrailsTab({
  searchParams,
}: {
  searchParams: Promise<{ bot?: string }>;
}) {
  const { bot: selectedBot } = await searchParams;
  const supabase = await getSupabaseServerClient();
  const admin    = getSupabaseAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: tenantUser } = await admin
    .from('tenant_users')
    .select('tenant_id')
    .eq('user_id', user.id)
    .single();

  const tenantId = tenantUser?.tenant_id ?? '';

  const [
    { data: products },
    { data: botConfigs },
    { data: productCatalog },
    { data: tenantGuardrailsRow },
  ] = await Promise.all([
    admin.from('tenant_products').select('*').eq('tenant_id', tenantId).eq('active', true),
    admin.from('bot_configs').select('*, product:products(slug, default_prompt, default_model, name)').eq('tenant_id', tenantId),
    admin.from('products').select('slug, default_prompt'),
    admin.from('tenant_guardrails').select('guardrails_json').eq('tenant_id', tenantId).maybeSingle(),
  ]);

  // Auto-seed bot_configs for active products that don't have one yet
  if (tenantId && (products ?? []).length > 0) {
    const existingSlugs = new Set((botConfigs ?? []).map(c => c.product_slug));
    const missing = (products ?? []).filter(p => p.active && !existingSlugs.has((p as { product_slug?: string | null }).product_slug ?? p.product_type));
    for (const p of missing) {
      const pSlug = (p as { product_slug?: string | null }).product_slug ?? p.product_type;
      await admin.from('bot_configs').insert({
        tenant_id:            tenantId,
        product_slug:         pSlug,
        system_prompt:        null,
        ai_model:             null,
        confidence_threshold: 0.6,
        kb_only_mode:         false,
        escalation_triggers:  ['speak to human', 'talk to agent', 'human please', 'escalate', 'complaint', 'refund', 'dispute', 'urgent'],
        guardrails_json: {
          blocked_topics: [], blocked_keywords: [], max_response_length: 1000,
          tone: 'professional',
          content_filters: { no_personal_data: false, no_external_links: false, no_phone_numbers_in_response: false },
          on_blocked_topic: 'escalate', on_low_confidence: 'escalate',
        },
      });
    }
    if (missing.length > 0) {
      const { data: refreshed } = await admin
        .from('bot_configs')
        .select('*, product:products(slug, default_prompt, default_model, name)')
        .eq('tenant_id', tenantId);
      botConfigs?.splice(0, botConfigs.length, ...(refreshed ?? []));
    }
  }

  const productDefaults: Record<string, string> = {};
  for (const p of productCatalog ?? []) productDefaults[p.slug] = p.default_prompt;

  const activeSlugs = new Set((products ?? []).map(p => (p as { product_slug?: string | null }).product_slug ?? p.product_type));
  const allConfigs = ((botConfigs ?? []) as (BotConfig & { product: Product | null })[])
    .filter(c => activeSlugs.has(c.product_slug));
  const resolvedConfigs = selectedBot
    ? allConfigs.filter(c => c.product_slug === selectedBot)
    : allConfigs;
  const tenantGuardrails = (tenantGuardrailsRow?.guardrails_json as LayeredGuardrailsConfig) ?? DEFAULT_TENANT_G;

  const BOT_NAME: Record<string, string> = {
    support_bot: 'Support Bot', sales_bot: 'Sales Bot', lifecycle_bot: 'Lifecycle Bot',
  };
  const selectedBotName = selectedBot ? (BOT_NAME[selectedBot] ?? selectedBot) : null;

  return (
    <div className="p-6 lg:p-8 max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold text-text">Guardrails</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          {selectedBotName
            ? <>Rules for <span className="font-semibold text-text">{selectedBotName}</span></>
            : 'Control what your bots can and cannot do.'}
        </p>
      </div>

      {/* Cascade explanation */}
      <div className="bg-brand-wash rounded-2xl p-4 text-xs text-brand-strong space-y-1">
        <p className="font-semibold text-brand-strong">Your guardrail layers (Layers 3 &amp; 4)</p>
        <ol className="list-decimal ml-4 space-y-0.5 text-brand-strong">
          <li className="text-muted-foreground">Platform global rules — always active, set by KOT.ai</li>
          <li className="text-muted-foreground">Bot-type defaults — set by KOT.ai per bot type</li>
          <li><span className="font-semibold">General rules (all bots)</span> — you set these, apply across every bot you use <span className="italic">(below)</span></li>
          <li><span className="font-semibold">Per-bot rules</span> — fine-tune each bot individually <span className="italic">(below)</span></li>
        </ol>
        <p className="text-muted-foreground mt-1">
          Your rules add to platform rules — they don&apos;t replace them. Keywords stack; max length takes the minimum.
        </p>
      </div>

      {/* ── Layer 3: Client-wide ──────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-line shadow-sm overflow-hidden">
        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-line">
          <Shield size={16} className="text-brand-strong" />
          <h3 className="text-sm font-semibold text-text">Layer 3 — General Rules (All Bots)</h3>
          <span className="ml-auto text-[11px] px-2 py-0.5 bg-brand-wash text-brand-strong rounded-full font-semibold border border-transparent">
            Every bot
          </span>
        </div>
        <div className="px-5 py-5">
          <p className="text-xs text-muted-foreground mb-5">
            Rules here apply across <span className="font-medium text-muted-foreground">all your bots</span> without needing to repeat them per-bot.
          </p>
          <TenantGuardrailsForm
            initial={tenantGuardrails}
            action={saveTenantGuardrailsAction}
            accentColor="emerald"
          />
        </div>
      </div>

      {/* ── Layer 4: Per-bot ──────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-line shadow-sm overflow-hidden">
        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-line">
          <ShieldAlert size={16} className="text-brand-strong" />
          <h3 className="text-sm font-semibold text-text">Layer 4 — Per-Bot Configuration</h3>
          <span className="ml-auto text-[11px] px-2 py-0.5 bg-brand-wash text-brand-strong rounded-full font-semibold border border-transparent">
            {selectedBotName ?? 'Individual bots'}
          </span>
        </div>
        <div className="px-5 py-5">
          <p className="text-xs text-muted-foreground mb-5">
            Fine-tune system prompts, confidence thresholds, tone, and additional guardrails per bot.
            Click a bot to expand.
          </p>
          <BotConfigForm configs={resolvedConfigs} productDefaults={productDefaults} />
        </div>
      </div>
    </div>
  );
}
