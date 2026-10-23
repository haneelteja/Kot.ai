'use client';

import { useState, useTransition } from 'react';
import {
  Copy, Check, Eye, EyeOff, RefreshCw, Save, Send,
  Zap, AlertCircle, CheckCircle2, XCircle, Clock,
  ChevronDown, ChevronUp, Plug, ArrowDownCircle, ArrowUpCircle,
  Download, Users, MessageSquare, Target,
} from 'lucide-react';
import {
  saveWelcomeTemplate, toggleIntegration, regenerateApiKey, sendTestMessage,
  saveOutboundSettings, regenerateSigningSecret, triggerManualPush,
} from '@/app/actions/integrations';
import { OUTBOUND_EVENT_OPTIONS } from '@/lib/integration-constants';
import type { IntegrationSettings, WebhookLog, OutboundLog } from '@/app/actions/integrations';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function CopyButton({ text, className = '' }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button type="button" title="Copy"
      onClick={() => { void navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); }}
      className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors ${
        copied ? 'bg-done-bg text-done' : 'bg-sunken text-muted-foreground hover:bg-done-bg hover:text-done'
      } ${className}`}
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function MonoField({ value, hidden }: { value: string; hidden: boolean }) {
  return (
    <code className="text-xs font-mono text-text flex-1 break-all">
      {hidden ? value.replace(/./g, '•') : value}
    </code>
  );
}

const INBOUND_STATUS: Record<string, { icon: React.ReactNode; cls: string; label: string }> = {
  sent:      { icon: <CheckCircle2 size={11} />, cls: 'bg-done-bg text-done border-done/30', label: 'Sent' },
  failed:    { icon: <XCircle     size={11} />, cls: 'bg-red-50 text-red-700 border-red-200',             label: 'Failed' },
  duplicate: { icon: <Clock       size={11} />, cls: 'bg-amber-50 text-amber-700 border-amber-200',       label: 'Duplicate' },
  skipped:   { icon: <Clock       size={11} />, cls: 'bg-sunken text-muted-foreground border-line',       label: 'Skipped' },
};

const OUTBOUND_STATUS: Record<string, { icon: React.ReactNode; cls: string }> = {
  delivered: { icon: <CheckCircle2 size={11} />, cls: 'bg-done-bg text-done border-done/30' },
  failed:    { icon: <XCircle     size={11} />, cls: 'bg-red-50 text-red-700 border-red-200' },
  skipped:   { icon: <Clock       size={11} />, cls: 'bg-sunken text-muted-foreground border-line' },
};

function LogTable({ children, empty }: { children: React.ReactNode; empty: string }) {
  return (
    <div className="divide-y divide-line">
      {children ?? <div className="px-5 py-10 text-center"><p className="text-sm text-muted-foreground font-medium">{empty}</p></div>}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function IntegrationsClient({
  settings,
  apiBase,
  initialInboundLogs,
  initialOutboundLogs,
}: {
  settings:            IntegrationSettings;
  apiBase:             string;
  initialInboundLogs:  WebhookLog[];
  initialOutboundLogs: OutboundLog[];
}) {
  const [tab, setTab] = useState<'inbound' | 'outbound'>('inbound');

  // ── Shared: enable toggle ──────────────────────────────────────────────────
  const [enabled,   setEnabled]   = useState(settings.enabled);
  const [toggling,  startToggle]  = useTransition();
  const [toggleErr, setToggleErr] = useState<string | null>(null);

  function handleToggle() {
    setToggleErr(null);
    startToggle(async () => {
      const r = await toggleIntegration(!enabled);
      if (r.error) { setToggleErr(r.error); return; }
      setEnabled(e => !e);
    });
  }

  const webhookUrl = `${apiBase}/api/integrations/webhook/contact`;

  return (
    <div className="space-y-5">

      {/* ── Status banner ───────────────────────────────────────────────────── */}
      <div className={`flex items-center justify-between px-5 py-3.5 rounded-xl border ${
        enabled ? 'bg-ready-bg border-ready/30' : 'bg-sunken border-line'
      }`}>
        <div className="flex items-center gap-2.5">
          <div className={`w-2.5 h-2.5 rounded-full ${enabled ? 'bg-ready animate-pulse' : 'bg-sunken'}`} />
          <span className="text-sm font-semibold text-text">
            Integrations are <span className={enabled ? 'text-ready' : 'text-muted-foreground'}>{enabled ? 'active' : 'disabled'}</span>
          </span>
          {toggleErr && <span className="text-xs text-red-600 ml-2">{toggleErr}</span>}
        </div>
        <button type="button" onClick={handleToggle} disabled={toggling}
          className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50 ${
            enabled ? 'border-line-strong text-muted-foreground hover:bg-sunken' : 'border-ready/30 text-ready bg-ready-bg hover:bg-ready-bg/70'
          }`}>
          {toggling ? 'Saving…' : enabled ? 'Disable all' : 'Enable'}
        </button>
      </div>

      {/* ── Tab switcher ────────────────────────────────────────────────────── */}
      <div className="flex gap-1 bg-white border border-line rounded-xl p-1 w-fit shadow-sm">
        <button type="button" onClick={() => setTab('inbound')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
            tab === 'inbound' ? 'bg-brand-strong text-white shadow-sm' : 'text-muted-foreground hover:text-text'
          }`}>
          <ArrowDownCircle size={14} /> Inbound
        </button>
        <button type="button" onClick={() => setTab('outbound')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
            tab === 'outbound' ? 'bg-violet-600 text-white shadow-sm' : 'text-muted-foreground hover:text-text'
          }`}>
          <ArrowUpCircle size={14} /> Outbound
        </button>
      </div>

      {/* ── INBOUND TAB ─────────────────────────────────────────────────────── */}
      {tab === 'inbound' && (
        <InboundTab
          settings={settings}
          webhookUrl={webhookUrl}
          apiBase={apiBase}
          initialLogs={initialInboundLogs}
        />
      )}

      {/* ── OUTBOUND TAB ────────────────────────────────────────────────────── */}
      {tab === 'outbound' && (
        <OutboundTab
          settings={settings}
          apiBase={apiBase}
          initialLogs={initialOutboundLogs}
        />
      )}
    </div>
  );
}

// ─── Inbound tab ─────────────────────────────────────────────────────────────

function InboundTab({
  settings, webhookUrl, apiBase,
  initialLogs,
}: {
  settings:    IntegrationSettings;
  webhookUrl:  string;
  apiBase:     string;
  initialLogs: WebhookLog[];
}) {
  const [apiKey,    setApiKey]    = useState(settings.webhook_api_key);
  const [keyHidden, setKeyHidden] = useState(true);
  const [regen,     startRegen]   = useTransition();
  const [regenErr,  setRegenErr]  = useState<string | null>(null);

  const [template,  setTemplate]  = useState(settings.welcome_template);
  const [saving,    startSave]    = useTransition();
  const [saveMsg,   setSaveMsg]   = useState<string | null>(null);
  const [saveErr,   setSaveErr]   = useState<string | null>(null);

  const [testPhone, setTestPhone] = useState('');
  const [testName,  setTestName]  = useState('');
  const [testing,   startTest]    = useTransition();
  const [testResult,setTestResult]= useState<{ ok: boolean; msg: string } | null>(null);

  const [logs]           = useState<WebhookLog[]>(initialLogs);
  const [showAll, setShowAll] = useState(false);
  const displayedLogs = showAll ? logs : logs.slice(0, 10);

  const [openGuide, setOpenGuide] = useState<'curl' | 'zapier' | 'make'>('curl');

  const curlExample = `curl -X POST \\
  ${webhookUrl} \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: ${keyHidden ? '<YOUR_API_KEY>' : apiKey}" \\
  -d '{"phone":"+919876543210","name":"Ravi Kumar","source":"my-crm"}'`;

  const zapierExample = `Action: Webhooks by Zapier → POST
URL:     ${webhookUrl}
Headers: x-api-key = ${keyHidden ? '<API_KEY>' : apiKey}
Body (JSON):
  phone  → {{contact phone field}}
  name   → {{contact name field}}
  source → zapier`;

  const makeExample = `Module: HTTP → Make a request
URL:    ${webhookUrl}
Method: POST
Header: x-api-key = ${keyHidden ? '<API_KEY>' : apiKey}
Body (JSON):
{
  "phone":  "{{contact.phone}}",
  "name":   "{{contact.name}}",
  "source": "make"
}`;

  void apiBase; // used via webhookUrl

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      {/* LEFT */}
      <div className="space-y-5">

        {/* Endpoint */}
        <div className="bg-white rounded-2xl border border-line p-5 space-y-3">
          <h3 className="text-sm font-bold text-text flex items-center gap-2">
            <Plug size={14} className="text-brand-strong" /> Webhook endpoint
          </h3>
          <p className="text-xs text-muted-foreground">
            Point your CRM, Zapier, or Make to this URL. Every call triggers a personalised WhatsApp welcome message.
          </p>
          <div className="flex items-center gap-2 bg-sunken rounded-xl px-4 py-2.5 border border-line">
            <code className="text-xs font-mono text-text flex-1 break-all">{webhookUrl}</code>
            <CopyButton text={webhookUrl} />
          </div>
        </div>

        {/* API key */}
        <div className="bg-white rounded-2xl border border-line p-5 space-y-3">
          <h3 className="text-sm font-bold text-text">Inbound API key</h3>
          <p className="text-xs text-muted-foreground">
            External systems pass this in the <code className="bg-sunken px-1 rounded">x-api-key</code> header to authenticate their requests to your webhook.
          </p>
          <div className="flex items-center gap-2 bg-sunken rounded-xl px-4 py-2.5 border border-line">
            <MonoField value={apiKey} hidden={keyHidden} />
            <button type="button" onClick={() => setKeyHidden(h => !h)}
              className="text-muted-foreground hover:text-text p-1 transition-colors">
              {keyHidden ? <Eye size={14} /> : <EyeOff size={14} />}
            </button>
            <CopyButton text={apiKey} />
          </div>
          <div className="flex items-center gap-2">
            <button type="button" disabled={regen}
              onClick={() => {
                if (!confirm('Regenerating will break existing integrations using the old key. Continue?')) return;
                setRegenErr(null);
                startRegen(async () => {
                  const r = await regenerateApiKey();
                  if (r.error) { setRegenErr(r.error); return; }
                  if (r.key) setApiKey(r.key);
                });
              }}
              className="flex items-center gap-1.5 text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50">
              <RefreshCw size={11} className={regen ? 'animate-spin' : ''} />
              {regen ? 'Regenerating…' : 'Regenerate key'}
            </button>
            <span className="text-muted-foreground text-xs">· breaks existing integrations</span>
          </div>
          {regenErr && <p className="text-xs text-red-600 flex items-center gap-1"><AlertCircle size={11} />{regenErr}</p>}
        </div>

        {/* Welcome template */}
        <div className="bg-white rounded-2xl border border-line p-5 space-y-3">
          <h3 className="text-sm font-bold text-text">Welcome message template</h3>
          <p className="text-xs text-muted-foreground">
            Use <code className="bg-sunken px-1 rounded">{'{name}'}</code> for the contact&apos;s first name. Sent once per contact (30-day deduplication).
          </p>
          <textarea value={template} rows={5} maxLength={1024}
            onChange={e => { setTemplate(e.target.value); setSaveMsg(null); setSaveErr(null); }}
            className="w-full text-sm border border-line rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-brand font-mono"
          />
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">{template.length} / 1024</span>
            <div className="flex items-center gap-2">
              {saveMsg && <span className="text-xs text-done flex items-center gap-1"><Check size={11} />{saveMsg}</span>}
              {saveErr && <span className="text-xs text-red-600 flex items-center gap-1"><AlertCircle size={11} />{saveErr}</span>}
              <button type="button" disabled={saving}
                onClick={() => { setSaveMsg(null); setSaveErr(null); startSave(async () => { const r = await saveWelcomeTemplate(template); if (r.error) { setSaveErr(r.error); return; } setSaveMsg('Saved.'); setTimeout(() => setSaveMsg(null), 3000); }); }}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-brand-strong text-white rounded-lg hover:opacity-90 disabled:opacity-50">
                <Save size={11} />
                {saving ? 'Saving…' : 'Save template'}
              </button>
            </div>
          </div>
        </div>

        {/* Test */}
        <div className="bg-white rounded-2xl border border-line p-5 space-y-3">
          <h3 className="text-sm font-bold text-text">Send a test message</h3>
          <div className="flex gap-2">
            <input value={testName} onChange={e => setTestName(e.target.value)} placeholder="Name (optional)"
              className="flex-1 text-sm border border-line rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand" />
            <input value={testPhone} onChange={e => setTestPhone(e.target.value)} placeholder="+91 98765 43210"
              className="flex-1 text-sm border border-line rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>
          <div className="flex items-center gap-3">
            <button type="button" disabled={testing || !testPhone.trim()}
              onClick={() => { setTestResult(null); startTest(async () => { const r = await sendTestMessage(testPhone, testName); setTestResult({ ok: !r.error, msg: r.error ?? 'Welcome message sent!' }); }); }}
              className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 bg-brand-strong text-white rounded-xl hover:opacity-90 disabled:opacity-50">
              <Send size={13} />
              {testing ? 'Sending…' : 'Send test'}
            </button>
            {testResult && (
              <span className={`text-xs flex items-center gap-1.5 ${testResult.ok ? 'text-done' : 'text-red-600'}`}>
                {testResult.ok ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
                {testResult.msg}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* RIGHT */}
      <div className="space-y-5">

        {/* Integration guides */}
        <div className="bg-white rounded-2xl border border-line p-5 space-y-3">
          <h3 className="text-sm font-bold text-text flex items-center gap-2">
            <Zap size={14} className="text-amber-500" /> Integration guides
          </h3>
          <div className="flex gap-1 border-b border-line pb-2">
            {(['curl', 'zapier', 'make'] as const).map(g => (
              <button key={g} type="button" onClick={() => setOpenGuide(g)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors capitalize ${
                  openGuide === g ? 'bg-gray-800 text-white' : 'bg-sunken text-muted-foreground hover:bg-sunken'
                }`}>
                {g === 'curl' ? 'cURL / REST' : g === 'zapier' ? 'Zapier' : 'Make'}
              </button>
            ))}
          </div>
          <div className="relative">
            <pre className="bg-gray-950 text-green-300 text-[11px] font-mono rounded-xl p-4 overflow-x-auto whitespace-pre-wrap">
              {openGuide === 'curl' ? curlExample : openGuide === 'zapier' ? zapierExample : makeExample}
            </pre>
            <div className="absolute top-2 right-2">
              <CopyButton text={openGuide === 'curl' ? curlExample : openGuide === 'zapier' ? zapierExample : makeExample} />
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {['HubSpot', 'Zoho CRM', 'Salesforce', 'Zapier', 'Make', 'n8n', 'Pabbly', 'Webflow', 'Typeform', 'Google Sheets'].map(s => (
              <span key={s} className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-sunken text-muted-foreground">{s}</span>
            ))}
          </div>
        </div>

        {/* Request / response format */}
        <div className="bg-white rounded-2xl border border-line p-5 space-y-3">
          <h3 className="text-sm font-bold text-text">Request format</h3>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="font-semibold text-muted-foreground uppercase tracking-wide text-[10px] mb-2">Headers</p>
              <div className="bg-sunken rounded-xl p-3 font-mono space-y-1">
                <p><span className="text-amber-600">x-api-key</span>: <span className="text-muted-foreground">your_key</span></p>
                <p><span className="text-amber-600">Content-Type</span>: <span className="text-muted-foreground">application/json</span></p>
              </div>
            </div>
            <div>
              <p className="font-semibold text-muted-foreground uppercase tracking-wide text-[10px] mb-2">Body</p>
              <div className="bg-sunken rounded-xl p-3 font-mono space-y-1">
                <p><span className="text-brand-strong">phone</span> <span className="text-red-500">*</span></p>
                <p><span className="text-sky-700">name</span> <span className="text-muted-foreground">optional</span></p>
                <p><span className="text-sky-700">source</span> <span className="text-muted-foreground">optional</span></p>
              </div>
            </div>
          </div>
        </div>

        {/* Inbound log */}
        <div className="bg-white rounded-2xl border border-line overflow-hidden">
          <div className="px-5 py-4 border-b border-line flex items-center justify-between">
            <h3 className="text-sm font-bold text-text">Inbound log</h3>
            <span className="text-xs text-muted-foreground">{logs.length} hits</span>
          </div>
          {logs.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-sm text-muted-foreground font-medium">No inbound webhook hits yet</p>
              <p className="text-xs text-muted-foreground mt-1">Send a test message to see the first entry.</p>
            </div>
          ) : (
            <>
              <LogTable empty="">
                {displayedLogs.map(log => {
                  const s = INBOUND_STATUS[log.status] ?? INBOUND_STATUS.skipped!;
                  return (
                    <div key={log.id} className="px-5 py-3 flex items-center gap-3">
                      <span className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${s.cls}`}>
                        {s.icon} {s.label}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-text truncate">
                          {log.contact_name ? `${log.contact_name} — ` : ''}{log.contact_phone}
                        </p>
                        {log.error_message && <p className="text-[10px] text-red-500 truncate">{log.error_message}</p>}
                      </div>
                      <div className="text-right shrink-0">
                        {log.source && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-sunken text-muted-foreground">{log.source}</span>}
                        <p className="text-[10px] text-muted-foreground mt-0.5" suppressHydrationWarning>
                          {new Date(log.triggered_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </LogTable>
              {logs.length > 10 && (
                <button type="button" onClick={() => setShowAll(s => !s)}
                  className="w-full py-3 text-xs font-semibold text-muted-foreground hover:text-brand-strong flex items-center justify-center gap-1 border-t border-line hover:bg-sunken transition-colors">
                  {showAll ? <><ChevronUp size={12} /> Show less</> : <><ChevronDown size={12} /> Show all {logs.length}</>}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Outbound tab ─────────────────────────────────────────────────────────────

function OutboundTab({
  settings, initialLogs,
}: {
  settings:    IntegrationSettings;
  apiBase:     string;
  initialLogs: OutboundLog[];
}) {
  const [url,      setUrl]      = useState(settings.outbound_webhook_url ?? '');
  const [events,   setEvents]   = useState<string[]>(settings.outbound_events ?? []);
  const [saving,   startSave]   = useTransition();
  const [saveMsg,  setSaveMsg]  = useState<string | null>(null);
  const [saveErr,  setSaveErr]  = useState<string | null>(null);

  const [secret,      setSecret]      = useState(settings.outbound_signing_secret);
  const [secretHidden, setSecretHidden] = useState(true);
  const [regenSec,    startRegenSec]   = useTransition();
  const [regenSecErr, setRegenSecErr]  = useState<string | null>(null);

  const [logs] = useState<OutboundLog[]>(initialLogs);
  const [showAll, setShowAll] = useState(false);
  const displayedLogs = showAll ? logs : logs.slice(0, 10);

  // Manual push state per type
  type PushType = 'contacts' | 'conversations' | 'leads';
  const [pushing,    setPushing]    = useState<PushType | null>(null);
  const [pushResult, setPushResult] = useState<{ type: PushType; ok: boolean; msg: string } | null>(null);
  const [,           startPush]     = useTransition();

  function handlePush(type: PushType) {
    setPushResult(null);
    setPushing(type);
    startPush(async () => {
      const r = await triggerManualPush(type);
      setPushing(null);
      if (r.error) { setPushResult({ type, ok: false, msg: r.error }); return; }
      setPushResult({ type, ok: true, msg: `Pushed ${r.count ?? 0} ${type} to your endpoint.` });
    });
  }

  function toggleEvent(val: string) {
    setEvents(prev => prev.includes(val) ? prev.filter(e => e !== val) : [...prev, val]);
  }

  const verifySnippet = `import { createHmac, timingSafeEqual } from 'crypto';

function verifyAlphabotSignature(
  rawBody: string,
  signature: string, // x-alphabot-signature header
  secret: string,    // your signing secret
): boolean {
  const expected = 'sha256=' + createHmac('sha256', secret).update(rawBody).digest('hex');
  if (expected.length !== signature.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}`;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      {/* LEFT — config */}
      <div className="space-y-5">

        {/* Destination URL + events */}
        <div className="bg-white rounded-2xl border border-line p-5 space-y-4">
          <h3 className="text-sm font-bold text-text flex items-center gap-2">
            <ArrowUpCircle size={14} className="text-violet-600" /> Destination webhook URL
          </h3>
          <p className="text-xs text-muted-foreground">
            We&apos;ll POST events to this URL whenever something important happens. Leave blank to disable outbound delivery.
          </p>

          <input
            value={url}
            onChange={e => { setUrl(e.target.value); setSaveMsg(null); setSaveErr(null); }}
            placeholder="https://hooks.zapier.com/hooks/catch/... or https://your-crm.com/webhook"
            className="w-full text-sm border border-line rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-300"
          />

          {/* Event subscriptions */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">Subscribe to events</p>
            <div className="space-y-2">
              {OUTBOUND_EVENT_OPTIONS.map(opt => (
                <label key={opt.value} className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={events.includes(opt.value)}
                    onChange={() => { toggleEvent(opt.value); setSaveMsg(null); setSaveErr(null); }}
                    className="mt-0.5 accent-violet-600"
                  />
                  <div>
                    <p className="text-xs font-semibold text-text group-hover:text-violet-700 transition-colors">{opt.label}</p>
                    <p className="text-[11px] text-muted-foreground">{opt.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2">
              {saveMsg && <span className="text-xs text-done flex items-center gap-1"><Check size={11} />{saveMsg}</span>}
              {saveErr && <span className="text-xs text-red-600 flex items-center gap-1"><AlertCircle size={11} />{saveErr}</span>}
            </div>
            <button type="button" disabled={saving}
              onClick={() => { setSaveMsg(null); setSaveErr(null); startSave(async () => { const r = await saveOutboundSettings(url || null, events); if (r.error) { setSaveErr(r.error); return; } setSaveMsg('Saved.'); setTimeout(() => setSaveMsg(null), 3000); }); }}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50">
              <Save size={11} />
              {saving ? 'Saving…' : 'Save settings'}
            </button>
          </div>
        </div>

        {/* Signing secret */}
        <div className="bg-white rounded-2xl border border-line p-5 space-y-3">
          <h3 className="text-sm font-bold text-text">Signing secret</h3>
          <p className="text-xs text-muted-foreground">
            Every outbound request includes an <code className="bg-sunken px-1 rounded">x-alphabot-signature</code> header.
            Use this secret to verify the request is genuinely from us.
          </p>
          <div className="flex items-center gap-2 bg-sunken rounded-xl px-4 py-2.5 border border-line">
            <MonoField value={secret} hidden={secretHidden} />
            <button type="button" onClick={() => setSecretHidden(h => !h)}
              className="text-muted-foreground hover:text-text p-1 transition-colors">
              {secretHidden ? <Eye size={14} /> : <EyeOff size={14} />}
            </button>
            <CopyButton text={secret} />
          </div>
          <div className="flex items-center gap-2">
            <button type="button" disabled={regenSec}
              onClick={() => {
                if (!confirm('Regenerate the signing secret? Any verification using the old secret will fail.')) return;
                setRegenSecErr(null);
                startRegenSec(async () => {
                  const r = await regenerateSigningSecret();
                  if (r.error) { setRegenSecErr(r.error); return; }
                  if (r.secret) setSecret(r.secret);
                });
              }}
              className="flex items-center gap-1.5 text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50">
              <RefreshCw size={11} className={regenSec ? 'animate-spin' : ''} />
              {regenSec ? 'Regenerating…' : 'Regenerate'}
            </button>
          </div>
          {regenSecErr && <p className="text-xs text-red-600">{regenSecErr}</p>}
        </div>

        {/* Manual push */}
        <div className="bg-white rounded-2xl border border-line p-5 space-y-4">
          <h3 className="text-sm font-bold text-text flex items-center gap-2">
            <Download size={14} className="text-violet-600" /> Push data now
          </h3>
          <p className="text-xs text-muted-foreground">
            Send a full snapshot of your data to your configured endpoint. Useful for initial CRM sync or on-demand exports.
          </p>

          {!url.trim() && (
            <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              <AlertCircle size={12} className="shrink-0" />
              Configure a destination URL above before pushing data.
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            {([
              { type: 'contacts' as PushType,      icon: <Users         size={14} />, label: 'Contacts',      color: 'bg-done-bg border-done/30 text-done hover:bg-done-bg/70' },
              { type: 'conversations' as PushType,  icon: <MessageSquare size={14} />, label: 'Conversations',  color: 'bg-sky-50 border-sky-200 text-sky-700 hover:bg-sky-100' },
              { type: 'leads' as PushType,          icon: <Target        size={14} />, label: 'Leads',          color: 'bg-violet-50 border-violet-200 text-violet-700 hover:bg-violet-100' },
            ]).map(({ type, icon, label, color }) => (
              <button key={type} type="button"
                disabled={!url.trim() || pushing === type}
                onClick={() => handlePush(type)}
                className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border text-xs font-semibold transition-colors disabled:opacity-40 ${color}`}
              >
                {pushing === type ? <RefreshCw size={14} className="animate-spin" /> : icon}
                {pushing === type ? 'Pushing…' : `Push ${label}`}
              </button>
            ))}
          </div>

          {pushResult && (
            <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-xl border ${
              pushResult.ok ? 'bg-done-bg border-done/30 text-done' : 'bg-red-50 border-red-200 text-red-700'
            }`}>
              {pushResult.ok ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
              {pushResult.msg}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT — docs + log */}
      <div className="space-y-5">

        {/* Event payload reference */}
        <div className="bg-white rounded-2xl border border-line p-5 space-y-3">
          <h3 className="text-sm font-bold text-text">Event payload format</h3>
          <p className="text-xs text-muted-foreground">Every outbound request is a JSON POST with this envelope:</p>
          <pre className="bg-gray-950 text-green-300 text-[11px] font-mono rounded-xl p-4 overflow-x-auto whitespace-pre-wrap">{`{
  "event":      "contact.created",   // event type
  "timestamp":  "2026-01-01T10:00:00Z",
  "tenant_id":  "your-tenant-uuid",
  "data": {
    // contact.created / contact.updated
    "id":         "contact-uuid",
    "phone":      "+919876543210",
    "name":       "Ravi Kumar",
    "sentiment":  "positive",

    // conversation.resolved / conversation.escalated
    "conversation_id": "uuid",
    "product_type":    "support_bot",
    "contact_phone":   "+91...",
    "contact_name":    "Ravi Kumar",

    // data.export (manual push)
    "export_type": "contacts",
    "count":       45,
    "records":     [...]
  }
}`}</pre>
        </div>

        {/* Signature verification */}
        <div className="bg-white rounded-2xl border border-line p-5 space-y-3">
          <h3 className="text-sm font-bold text-text">Signature verification</h3>
          <p className="text-xs text-muted-foreground">Verify the <code className="bg-sunken px-1 rounded">x-alphabot-signature</code> header to ensure the request is from us:</p>
          <div className="relative">
            <pre className="bg-gray-950 text-sky-300 text-[11px] font-mono rounded-xl p-4 overflow-x-auto whitespace-pre-wrap">{verifySnippet}</pre>
            <div className="absolute top-2 right-2"><CopyButton text={verifySnippet} /></div>
          </div>
        </div>

        {/* Outbound log */}
        <div className="bg-white rounded-2xl border border-line overflow-hidden">
          <div className="px-5 py-4 border-b border-line flex items-center justify-between">
            <h3 className="text-sm font-bold text-text">Outbound delivery log</h3>
            <span className="text-xs text-muted-foreground">{logs.length} events</span>
          </div>
          {logs.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-sm text-muted-foreground font-medium">No outbound deliveries yet</p>
              <p className="text-xs text-muted-foreground mt-1">Configure a URL, subscribe to events, and they&apos;ll appear here.</p>
            </div>
          ) : (
            <>
              <div className="divide-y divide-line">
                {displayedLogs.map(log => {
                  const s = OUTBOUND_STATUS[log.status] ?? OUTBOUND_STATUS.skipped!;
                  return (
                    <div key={log.id} className="px-5 py-3 flex items-center gap-3">
                      <span className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${s.cls}`}>
                        {s.icon} {log.status}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-text">{log.event_type}</p>
                        {log.error_message && <p className="text-[10px] text-red-500 truncate">{log.error_message}</p>}
                        {log.http_status && <p className="text-[10px] text-muted-foreground">HTTP {log.http_status}</p>}
                      </div>
                      <p className="text-[10px] text-muted-foreground shrink-0" suppressHydrationWarning>
                        {new Date(log.triggered_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })}
                      </p>
                    </div>
                  );
                })}
              </div>
              {logs.length > 10 && (
                <button type="button" onClick={() => setShowAll(s => !s)}
                  className="w-full py-3 text-xs font-semibold text-muted-foreground hover:text-violet-700 flex items-center justify-center gap-1 border-t border-line hover:bg-sunken transition-colors">
                  {showAll ? <><ChevronUp size={12} /> Show less</> : <><ChevronDown size={12} /> Show all {logs.length}</>}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
