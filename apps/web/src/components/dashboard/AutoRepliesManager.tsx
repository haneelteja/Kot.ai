'use client';

import { useState, useTransition } from 'react';
import { Plus, Trash2, MessageSquareReply, Zap } from 'lucide-react';
import { addAutoReply, removeAutoReply, toggleAutoReply } from '@/app/actions/automation';
import type { AutoReply } from '@/app/actions/automation';

const MATCH_TYPES = [
  { value: 'contains', label: 'Contains' },
  { value: 'exact',    label: 'Exact match' },
  { value: 'regex',    label: 'Regex' },
] as const;

export function AutoRepliesManager({
  initialRules,
  activeSlugs,
}: {
  initialRules: AutoReply[];
  activeSlugs: string[];
}) {
  const [rules, setRules] = useState<AutoReply[]>(initialRules);
  const [keyword, setKeyword]     = useState('');
  const [matchType, setMatchType] = useState<'exact' | 'contains' | 'regex'>('contains');
  const [replyText, setReplyText] = useState('');
  const [productSlug, setProductSlug] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleAdd() {
    setError(null);
    startTransition(async () => {
      const res = await addAutoReply({
        productSlug: productSlug || null,
        keyword,
        matchType,
        replyText,
      });
      if (res.error) { setError(res.error); return; }
      setRules(prev => [...prev, res.rule!]);
      setKeyword('');
      setReplyText('');
    });
  }

  function handleToggle(id: string, active: boolean) {
    setRules(cur => cur.map(r => r.id === id ? { ...r, active } : r));
    startTransition(async () => {
      await toggleAutoReply(id, active);
    });
  }

  function handleRemove(id: string) {
    const prev = rules;
    setRules(cur => cur.filter(r => r.id !== id));
    startTransition(async () => {
      const res = await removeAutoReply(id);
      if (res.error) setRules(prev);
    });
  }

  return (
    <div className="divide-y divide-line">
      <div className="px-5 py-4 flex items-start gap-3 bg-brand-wash">
        <Zap size={14} className="text-brand-strong mt-0.5 shrink-0" />
        <p className="text-xs text-brand-strong leading-relaxed">
          Matched keywords reply instantly <strong>without calling the AI model</strong> — faster replies and lower API usage for common questions (&ldquo;hours&rdquo;, &ldquo;menu&rdquo;, &ldquo;hi&rdquo;). Rules are checked in order; the first match wins. Takes up to 5 minutes to apply (cached).
        </p>
      </div>

      {rules.length > 0 && (
        <div className="divide-y divide-line">
          {rules.map(r => (
            <div key={r.id} className="flex items-start gap-3 px-5 py-3">
              <div className="w-8 h-8 rounded-full bg-sunken flex items-center justify-center shrink-0 mt-0.5">
                <MessageSquareReply size={13} className="text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-text font-mono">{r.keyword}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-sunken text-muted-foreground font-medium">{r.match_type}</span>
                  {r.product_slug && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-brand-wash text-brand-strong font-medium">{r.product_slug.replace(/_/g, ' ')}</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">{r.reply_text}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleToggle(r.id, !r.active)}
                  disabled={isPending}
                  className={`text-[11px] px-2 py-1 rounded-full font-medium transition-colors ${
                    r.active ? 'bg-done-bg text-done' : 'bg-sunken text-muted-foreground'
                  }`}
                >
                  {r.active ? 'Active' : 'Paused'}
                </button>
                <button
                  onClick={() => handleRemove(r.id)}
                  disabled={isPending}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-problem-bg hover:text-problem transition-colors disabled:opacity-40"
                  title="Delete"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {rules.length === 0 && (
        <div className="px-5 py-6 text-center">
          <p className="text-xs text-muted-foreground">No auto-reply rules yet.</p>
        </div>
      )}

      <div className="px-5 py-4 space-y-2.5">
        <div className="flex gap-2">
          <input
            type="text"
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            placeholder="Keyword, e.g. hours"
            className="flex-1 text-sm border border-line rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand"
          />
          <select
            value={matchType}
            onChange={e => setMatchType(e.target.value as typeof matchType)}
            className="text-sm border border-line rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-brand bg-surface"
          >
            {MATCH_TYPES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          {activeSlugs.length > 0 && (
            <select
              value={productSlug}
              onChange={e => setProductSlug(e.target.value)}
              className="text-sm border border-line rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-brand bg-surface"
            >
              <option value="">All bots</option>
              {activeSlugs.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
            </select>
          )}
        </div>
        <textarea
          value={replyText}
          onChange={e => setReplyText(e.target.value)}
          placeholder="Reply text sent to the customer"
          rows={2}
          className="w-full text-sm border border-line rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand resize-none"
        />
        <div className="flex justify-end">
          <button
            onClick={handleAdd}
            disabled={isPending || !keyword.trim() || !replyText.trim()}
            className="flex items-center gap-1.5 px-3 py-2 bg-brand-strong text-white text-xs font-semibold rounded-lg hover:opacity-90 disabled:opacity-40 transition-colors"
          >
            <Plus size={13} />
            Add rule
          </button>
        </div>
        {error && <p className="text-xs text-problem">{error}</p>}
      </div>
    </div>
  );
}
