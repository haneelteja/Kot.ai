'use client';

import { useState, useTransition } from 'react';
import { Plus, Trash2, KeyRound } from 'lucide-react';
import { createApiKey, revokeApiKey, API_KEY_SCOPES } from '@/app/actions/api-keys';
import type { ApiKey } from '@/app/actions/api-keys';

export function ApiKeysManager({
  initialKeys,
}: {
  initialKeys: ApiKey[];
}) {
  const [keys, setKeys]     = useState<ApiKey[]>(initialKeys);
  const [name, setName]     = useState('');
  const [scopes, setScopes] = useState<string[]>([...API_KEY_SCOPES]);
  const [error, setError]   = useState<string | null>(null);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggleScope(scope: string) {
    setScopes(prev => prev.includes(scope) ? prev.filter(s => s !== scope) : [...prev, scope]);
  }

  function handleCreate() {
    setError(null);
    startTransition(async () => {
      const res = await createApiKey(name, scopes);
      if (res.error) { setError(res.error); return; }
      setKeys(prev => [...prev, res.key!]);
      if (res.secret) setNewSecret(res.secret);
      setName('');
    });
  }

  function handleRevoke(id: string) {
    const prev = keys;
    setKeys(cur => cur.filter(k => k.id !== id));
    startTransition(async () => {
      const res = await revokeApiKey(id);
      if (res.error) setKeys(prev);
    });
  }

  return (
    <div className="divide-y divide-line">
      <div className="px-5 py-4 flex items-start gap-3 bg-brand-wash">
        <KeyRound size={14} className="text-brand-strong mt-0.5 shrink-0" />
        <p className="text-xs text-brand-strong leading-relaxed">
          Let your own systems call the KOT.ai API directly (e.g. create or update orders programmatically) instead of using the dashboard. Send the key as an <code className="font-mono">X-API-Key</code> header.
        </p>
      </div>

      {newSecret && (
        <div className="px-5 py-3">
          <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-amber-800">API key (shown once — copy it now)</p>
              <p className="text-xs font-mono text-amber-700 truncate">{newSecret}</p>
            </div>
            <button onClick={() => setNewSecret(null)} className="text-[11px] font-medium text-amber-700 hover:text-amber-900 shrink-0">
              Dismiss
            </button>
          </div>
        </div>
      )}

      {keys.length > 0 && (
        <div className="divide-y divide-line">
          {keys.map(k => (
            <div key={k.id} className="flex items-center gap-3 px-5 py-3">
              <div className="w-8 h-8 rounded-full bg-sunken flex items-center justify-center shrink-0">
                <KeyRound size={13} className="text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text">{k.name}</p>
                <p className="text-xs text-muted-foreground font-mono truncate">{k.key_prefix}&hellip;</p>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                {k.scopes.map(s => (
                  <span key={s} className="text-[10px] px-1.5 py-0.5 rounded-full bg-sunken text-muted-foreground font-medium">{s}</span>
                ))}
              </div>
              <button
                onClick={() => handleRevoke(k.id)}
                disabled={isPending}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-problem-bg hover:text-problem transition-colors disabled:opacity-40 shrink-0"
                title="Revoke"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {keys.length === 0 && (
        <div className="px-5 py-6 text-center">
          <p className="text-xs text-muted-foreground">No API keys yet.</p>
        </div>
      )}

      <div className="px-5 py-4 space-y-2.5">
        <div className="flex gap-2">
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Key name, e.g. Order Sync Service"
            className="flex-1 text-sm border border-line rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand"
          />
          <button
            onClick={handleCreate}
            disabled={isPending || !name.trim() || scopes.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 bg-brand-strong text-white text-xs font-semibold rounded-lg hover:opacity-90 disabled:opacity-40 transition-colors shrink-0"
          >
            <Plus size={13} />
            Create key
          </button>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {API_KEY_SCOPES.map(s => (
            <label key={s} className="flex items-center gap-1.5 text-xs text-text cursor-pointer">
              <input type="checkbox" checked={scopes.includes(s)} onChange={() => toggleScope(s)} className="accent-brand-strong" />
              <span className="font-mono">{s}</span>
            </label>
          ))}
        </div>
        {error && <p className="text-xs text-problem">{error}</p>}
      </div>
    </div>
  );
}
