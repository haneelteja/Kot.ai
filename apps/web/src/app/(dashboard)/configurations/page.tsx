export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { BookOpen, ShieldCheck, MessageSquareMore, SlidersHorizontal } from 'lucide-react';
import { KnowledgeBaseTab } from '@/components/dashboard/KnowledgeBaseTab';
import { GuardrailsTab } from '@/components/dashboard/GuardrailsTab';
import { ButtonTemplatesTab } from '@/components/dashboard/ButtonTemplatesTab';

const TABS = [
  { key: 'knowledge-base', label: 'Knowledge Base', icon: BookOpen },
  { key: 'guardrails',     label: 'Guardrails',      icon: ShieldCheck },
  { key: 'buttons',        label: 'Buttons',         icon: MessageSquareMore },
] as const;

type TabKey = typeof TABS[number]['key'];

// Knowledge Base, Guardrails, and Buttons are all "set up once, rarely
// touched" bot-configuration surfaces — folded into one landing page with
// tabs instead of three separate nav entries. Each tab renders the exact
// same component that used to be its own route's page.tsx (relocated to
// components/dashboard/*Tab.tsx, not rewritten) — /knowledge-base,
// /guardrails, and /button-templates now just redirect here.
export default async function ConfigurationsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; bot?: string }>;
}) {
  const resolved = await searchParams;
  const rawTab   = resolved.tab ?? 'knowledge-base';
  const activeTab: TabKey = TABS.some(t => t.key === rawTab) ? (rawTab as TabKey) : 'knowledge-base';

  function tabHref(key: TabKey) {
    const p = new URLSearchParams();
    p.set('tab', key);
    if (resolved.bot) p.set('bot', resolved.bot);
    return `/configurations?${p.toString()}`;
  }

  return (
    <div>
      <div className="px-6 lg:px-8 pt-6 lg:pt-8 pb-2">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-xl font-bold text-text flex items-center gap-2">
            <SlidersHorizontal size={20} className="text-brand-strong" />
            Configurations
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Bot knowledge, guardrails, and interactive buttons — set up once, rarely changed.
          </p>

          <div className="flex gap-1 bg-sunken rounded-xl p-1 w-fit mt-4 overflow-x-auto">
            {TABS.map(t => {
              const isActive = activeTab === t.key;
              const Icon = t.icon;
              return (
                <Link
                  key={t.key}
                  href={tabHref(t.key)}
                  className={`flex items-center gap-2 text-sm px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
                    isActive ? 'bg-surface text-brand-strong shadow-sm' : 'text-muted-foreground hover:text-text hover:bg-surface/60'
                  }`}
                >
                  <Icon size={14} /> {t.label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {activeTab === 'knowledge-base' && <KnowledgeBaseTab />}
      {activeTab === 'guardrails' && <GuardrailsTab searchParams={searchParams} />}
      {activeTab === 'buttons' && <ButtonTemplatesTab />}
    </div>
  );
}
