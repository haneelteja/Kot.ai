import { getSupabaseServerClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronLeft, Users, CheckCircle2, AlertCircle, Clock, MessageSquare,
  ExternalLink, Repeat2, Bot, CalendarClock, XCircle, RefreshCw,
} from 'lucide-react';
import { getScheduledMessageAction, getRecipientLogAction } from '@/app/actions/scheduled-messages';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

const STATUS_STYLES: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
  scheduled: { label: 'Scheduled', cls: 'bg-waiting-bg text-waiting border-transparent', icon: Clock        },
  running:   { label: 'Sending',   cls: 'bg-progress-bg text-progress border-transparent', icon: RefreshCw    },
  completed: { label: 'Done',      cls: 'bg-done-bg text-done border-transparent', icon: CheckCircle2 },
  failed:    { label: 'Failed',    cls: 'bg-problem-bg text-problem border-transparent',           icon: AlertCircle  },
  cancelled: { label: 'Cancelled', cls: 'bg-neutral-bg text-neutral border-transparent',        icon: XCircle      },
};

const REC_STATUS: Record<string, { label: string; cls: string }> = {
  pending:   { label: 'Pending',   cls: 'bg-waiting-bg text-waiting border-transparent'       },
  sent:      { label: 'Sent',      cls: 'bg-progress-bg text-progress border-transparent'             },
  delivered: { label: 'Delivered', cls: 'bg-ready-bg text-ready border-transparent'    },
  read:      { label: 'Read',      cls: 'bg-done-bg text-done border-transparent' },
  failed:    { label: 'Failed',    cls: 'bg-problem-bg text-problem border-transparent'             },
  skipped:   { label: 'Skipped',   cls: 'bg-neutral-bg text-neutral border-transparent'       },
};

function recurrenceLabel(rec: { type: string; days_of_week?: number[]; day_of_month?: number }): string {
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  if (rec.type === 'once')    return 'One-time';
  if (rec.type === 'daily')   return 'Repeats daily';
  if (rec.type === 'monthly') return `Repeats monthly on ${rec.day_of_month ?? '?'}`;
  if (rec.type === 'weekly' && rec.days_of_week?.length)
    return `Repeats weekly · ${rec.days_of_week.map(d => DAYS[d] ?? d).join(', ')}`;
  return rec.type;
}

export default async function ScheduledMessageDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [msg, { recipients, total }] = await Promise.all([
    getScheduledMessageAction(id),
    getRecipientLogAction(id),
  ]);
  if (!msg) notFound();

  // Check provider for display mode
  const admin = getSupabaseAdminClient();
  const { data: tenantUser } = await admin
    .from('tenant_users').select('tenant_id').eq('user_id', user.id).limit(1).single();
  const tenantId = tenantUser?.tenant_id ?? '';
  const { data: wn } = await admin
    .from('whatsapp_numbers').select('provider').eq('tenant_id', tenantId).eq('active', true).limit(1).single();
  const isWaba = wn?.provider === 'meta_cloud';

  const meta  = STATUS_STYLES[msg.status] ?? STATUS_STYLES['scheduled']!;
  const Icon  = meta.icon;
  const rec   = msg.recurrence as { type: string; days_of_week?: number[]; day_of_month?: number };

  const sentCount      = recipients.filter(r => ['sent', 'delivered', 'read'].includes(r.status)).length;
  const failedCount    = recipients.filter(r => ['failed', 'skipped'].includes(r.status)).length;
  const pendingCount   = recipients.filter(r => r.status === 'pending').length;

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Back */}
      <Link href="/scheduled-messages" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-text transition-colors">
        <ChevronLeft size={15} /> Scheduled Messages
      </Link>

      {/* Header card */}
      <div className="bg-surface rounded-2xl border border-line shadow-float p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-strong flex items-center justify-center shrink-0">
              <CalendarClock size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-text">{msg.name}</h1>
              <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                <span className={`inline-flex items-center gap-1 text-[11px] font-semibold border px-2 py-0.5 rounded-full ${meta.cls}`}>
                  <Icon size={10} /> {meta.label}
                </span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock size={11} />
                  {new Date(msg.scheduled_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
                {rec.type !== 'once' && (
                  <span className="text-xs text-brand-strong flex items-center gap-1">
                    <Repeat2 size={11} /> {recurrenceLabel(rec)}
                  </span>
                )}
                {msg.bot_handles_replies && (
                  <span className="text-xs text-done flex items-center gap-1">
                    <Bot size={11} /> Bot handles replies
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Message preview */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {msg.message_body && (
            <div className="p-3 bg-sunken rounded-xl border border-line">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1"><MessageSquare size={10} /> Free-form</p>
              <p className="text-xs text-text whitespace-pre-wrap line-clamp-4">{msg.message_body}</p>
            </div>
          )}
          {msg.template_name && (
            <div className="p-3 bg-brand-wash rounded-xl border border-line">
              <p className="text-[10px] font-semibold text-brand-strong/70 uppercase tracking-wider mb-1">Template fallback</p>
              <p className="text-xs font-semibold text-brand-strong">{msg.template_name}</p>
              <p className="text-[10px] text-brand-strong/70 mt-0.5">{msg.template_language}</p>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="mt-4 grid grid-cols-3 gap-3">
          {[
            { label: 'Sent',    value: sentCount,    icon: CheckCircle2, cls: 'text-done' },
            { label: 'Failed',  value: failedCount,  icon: AlertCircle,  cls: 'text-problem'     },
            { label: 'Pending', value: pendingCount, icon: Clock,        cls: 'text-muted-foreground'    },
          ].map(({ label, value, icon: Ic, cls }) => (
            <div key={label} className="text-center p-3 bg-sunken rounded-xl border border-line">
              <Ic size={14} className={`${cls} mx-auto mb-1`} />
              <p className={`text-lg font-bold ${cls}`}>{value}</p>
              <p className="text-[10px] text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Recipient log */}
      <div className="bg-surface rounded-2xl border border-line shadow-float overflow-hidden">
        <div className="px-5 py-3.5 border-b border-line flex items-center gap-2">
          <Users size={14} className="text-muted-foreground" />
          <h2 className="text-sm font-semibold text-text">Recipients</h2>
          <span className="ml-auto text-xs text-muted-foreground">{total} total</span>
        </div>

        {recipients.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">No recipients logged yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-line text-left">
                  <th className="px-5 py-3 font-semibold text-muted-foreground font-variant-numeric">Contact</th>
                  <th className="px-3 py-3 font-semibold text-muted-foreground">Session</th>
                  <th className="px-3 py-3 font-semibold text-muted-foreground">Type</th>
                  <th className="px-3 py-3 font-semibold text-muted-foreground">Status</th>
                  <th className="px-3 py-3 font-semibold text-muted-foreground">Sent at</th>
                  {isWaba && <th className="px-3 py-3 font-semibold text-muted-foreground">Conversation</th>}
                  <th className="px-3 py-3 font-semibold text-muted-foreground">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {recipients.map(r => {
                  const st = REC_STATUS[r.status] ?? REC_STATUS['pending']!;
                  return (
                    <tr key={r.id} className="hover:bg-sunken/50 transition-colors">
                      <td className="px-5 py-3">
                        <p className="font-medium text-text">{r.contact_name ?? r.phone}</p>
                        {r.contact_name && <p className="text-muted-foreground">{r.phone}</p>}
                      </td>
                      <td className="px-3 py-3">
                        {r.session_status ? (
                          <span className={`inline-block px-1.5 py-0.5 rounded-full font-medium ${
                            r.session_status === 'active' ? 'bg-progress-bg text-progress' : 'bg-neutral-bg text-neutral'
                          }`}>{r.session_status}</span>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-3 py-3 text-muted-foreground capitalize">{r.message_type ?? '—'}</td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex px-1.5 py-0.5 rounded-full border font-semibold ${st.cls}`}>{st.label}</span>
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">
                        {r.sent_at ? new Date(r.sent_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                      </td>
                      {isWaba && (
                        <td className="px-3 py-3">
                          {r.conversation_id ? (
                            <Link href={`/conversations?id=${r.conversation_id}`}
                              className="inline-flex items-center gap-1 text-brand-strong hover:underline font-medium">
                              View <ExternalLink size={10} />
                            </Link>
                          ) : <span className="text-muted-foreground">—</span>}
                        </td>
                      )}
                      <td className="px-3 py-3 text-problem max-w-xs truncate">{r.error_message ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
