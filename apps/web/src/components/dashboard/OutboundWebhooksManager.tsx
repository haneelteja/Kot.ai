'use client';

import { useState, useTransition } from 'react';
import { Plus, Trash2, Webhook, ChevronDown, ChevronUp, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { addOutboundWebhook, removeOutboundWebhook, toggleOutboundWebhook, listWebhookDeliveries, WEBHOOK_EVENT_TYPES } from '@/app/actions/webhooks';
import type { OutboundWebhook, WebhookDelivery } from '@/app/actions/webhooks';

export function OutboundWebhooksManager({
  initialWebhooks,
}: {
  initialWebhooks: OutboundWebhook[];
}) {
  const [webhooks, setWebhooks] = useState<OutboundWebhook[]>(initialWebhooks);
  const [url, setUrl]           = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>([...WEBHOOK_EVENT_TYPES]);
  const [error, setError]       = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [newSecret, setNewSecret]   = useState<{ webhookId: string; secret: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggleEvent(event: string) {
    setSelectedEvents(prev => prev.includes(event) ? prev.filter(e => e !== event) : [...prev, event]);
  }

  function handleAdd() {
    setError(null);
    startTransition(async () => {
      const res = await addOutboundWebhook(url, selectedEvents);
      if (res.error) { setError(res.error); return; }
      setWebhooks(prev => [...prev, res.webhook!]);
      if (res.secret) setNewSecret({ webhookId: res.webhook!.id, secret: res.secret });
      setUrl('');
    });
  }

  function handleToggleActive(id: string, active: boolean) {
    setWebhooks(cur => cur.map(w => w.id === id ? { ...w, active } : w));
    startTransition(async () => { await toggleOutboundWebhook(id, active); });
  }

  function handleRemove(id: string) {
    const prev = webhooks;
    setWebhooks(cur => cur.filter(w => w.id !== id));
    if (expandedId === id) setExpandedId(null);
    startTransition(async () => {
      const res = await removeOutboundWebhook(id);
      if (res.error) setWebhooks(prev);
    });
  }

  async function handleExpand(id: string) {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    const res = await listWebhookDeliveries(id);
    setDeliveries(res.deliveries);
  }

  return (
    <div className="divide-y divide-line">
      <div className="px-5 py-4 flex items-start gap-3 bg-brand-wash">
        <Webhook size={14} className="text-brand-strong mt-0.5 shrink-0" />
        <p className="text-xs text-brand-strong leading-relaxed">
          Get a POST request to your own server when these events happen. Each request is signed with HMAC-SHA256 — verify it using the <code className="font-mono">X-KOTAI-Signature</code> header and the secret shown once at creation.
        </p>
      </div>

      {webhooks.length > 0 && (
        <div className="divide-y divide-line">
          {webhooks.map(w => (
            <div key={w.id}>
              <div className="flex items-start gap-3 px-5 py-3">
                <div className="w-8 h-8 rounded-full bg-sunken flex items-center justify-center shrink-0 mt-0.5">
                  <Webhook size={13} className="text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text font-mono truncate">{w.url}</p>
                  <div className="flex items-center gap-1.5 flex-wrap mt-1">
                    {w.event_types.map(e => (
                      <span key={e} className="text-[10px] px-1.5 py-0.5 rounded-full bg-sunken text-muted-foreground font-medium">{e}</span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleToggleActive(w.id, !w.active)}
                    disabled={isPending}
                    className={`text-[11px] px-2 py-1 rounded-full font-medium transition-colors ${
                      w.active ? 'bg-done-bg text-done' : 'bg-sunken text-muted-foreground'
                    }`}
                  >
                    {w.active ? 'Active' : 'Paused'}
                  </button>
                  <button
                    onClick={() => handleExpand(w.id)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-sunken transition-colors"
                    title="Delivery log"
                  >
                    {expandedId === w.id ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  </button>
                  <button
                    onClick={() => handleRemove(w.id)}
                    disabled={isPending}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-problem-bg hover:text-problem transition-colors disabled:opacity-40"
                    title="Delete"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {newSecret?.webhookId === w.id && (
                <div className="px-5 pb-3 pl-16">
                  <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold text-amber-800">Signing secret (shown once — copy it now)</p>
                      <p className="text-xs font-mono text-amber-700 truncate">{newSecret.secret}</p>
                    </div>
                    <button
                      onClick={() => setNewSecret(null)}
                      className="text-[11px] font-medium text-amber-700 hover:text-amber-900 shrink-0"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}

              {expandedId === w.id && (
                <div className="px-5 pb-3 pl-16">
                  {deliveries.length === 0 && (
                    <p className="text-xs text-muted-foreground py-2">No deliveries yet.</p>
                  )}
                  {deliveries.map(d => (
                    <div key={d.id} className="flex items-center gap-2 py-1.5 text-xs border-b border-line last:border-0">
                      {d.error_message ? (
                        <XCircle size={12} className="text-problem shrink-0" />
                      ) : d.status_code && d.status_code < 300 ? (
                        <CheckCircle2 size={12} className="text-done shrink-0" />
                      ) : (
                        <XCircle size={12} className="text-amber-600 shrink-0" />
                      )}
                      <span className="font-mono text-muted-foreground">{d.event_type}</span>
                      <span className="text-muted-foreground">
                        {d.status_code ?? '—'}{d.response_time_ms != null ? ` · ${d.response_time_ms}ms` : ''}
                      </span>
                      {d.error_message && <span className="text-problem truncate flex-1">{d.error_message}</span>}
                      <span className="ml-auto text-muted-foreground flex items-center gap-1 shrink-0">
                        <Clock size={10} />
                        {new Date(d.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {webhooks.length === 0 && (
        <div className="px-5 py-6 text-center">
          <p className="text-xs text-muted-foreground">No webhooks configured.</p>
        </div>
      )}

      <div className="px-5 py-4 space-y-2.5">
        <input
          type="text"
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder="https://your-server.com/webhooks/kotai"
          className="w-full text-sm border border-line rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand font-mono"
        />
        <div className="flex items-center gap-3 flex-wrap">
          {WEBHOOK_EVENT_TYPES.map(e => (
            <label key={e} className="flex items-center gap-1.5 text-xs text-text cursor-pointer">
              <input
                type="checkbox"
                checked={selectedEvents.includes(e)}
                onChange={() => toggleEvent(e)}
                className="accent-brand-strong"
              />
              <span className="font-mono">{e}</span>
            </label>
          ))}
        </div>
        <div className="flex justify-end">
          <button
            onClick={handleAdd}
            disabled={isPending || !url.trim() || selectedEvents.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 bg-brand-strong text-white text-xs font-semibold rounded-lg hover:opacity-90 disabled:opacity-40 transition-colors"
          >
            <Plus size={13} />
            Add webhook
          </button>
        </div>
        {error && <p className="text-xs text-problem">{error}</p>}
      </div>
    </div>
  );
}
