import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { Bell } from 'lucide-react';
import { NotificationToggleRow } from '@/components/platform/NotificationToggleRow';

type Recipient = { role?: string; email?: string };

type NotifRow = {
  id:         string;
  event_type: string;
  enabled:    boolean;
  recipients: Recipient[];
};

const EVENT_META: Record<string, { label: string; desc: string; group: string }> = {
  trial_expiring_7d:    { label: '7-Day Trial Warning',    desc: 'Sent 7 days before a client trial expires',              group: 'Trial & Onboarding' },
  trial_expiring_1d:    { label: '1-Day Trial Warning',    desc: 'Sent 1 day before a client trial expires',               group: 'Trial & Onboarding' },
  trial_expired:        { label: 'Trial Expired',          desc: 'Sent when a client trial ends without converting',       group: 'Trial & Onboarding' },
  client_invited:       { label: 'Client Invited',         desc: 'Sent when a new client invite is created',               group: 'Trial & Onboarding' },
  client_activated:     { label: 'Client Activated',       desc: 'Sent when a client moves from trial to active',          group: 'Trial & Onboarding' },
  new_client_onboarded: { label: 'Client Onboarded',       desc: 'Sent when a new client completes setup',                 group: 'Trial & Onboarding' },
  escalation_created:   { label: 'Escalation Created',     desc: 'Sent each time a bot escalates a conversation to human', group: 'Escalations'        },
  escalation_timeout:   { label: 'Escalation Timeout',     desc: 'Sent when an escalation goes unassigned too long',       group: 'Escalations'        },
  daily_report:         { label: 'Daily Report',           desc: 'Morning digest with conversation and usage summary',     group: 'System'             },
  low_confidence_spike: { label: 'Low Confidence Spike',   desc: 'Sent when AI confidence drops below threshold',          group: 'System'             },
  bot_error:            { label: 'Bot Error',              desc: 'Sent on critical bot failures or webhook errors',        group: 'System'             },
  subscription_renewed: { label: 'Subscription Renewed',   desc: 'Sent when a client subscription auto-renews',           group: 'System'             },
};

const GROUP_ORDER = ['Trial & Onboarding', 'Escalations', 'System'];

const GROUP_STYLE: Record<string, { icon: string; badge: string }> = {
  'Trial & Onboarding': { icon: '🚀', badge: 'bg-sky-50 text-sky-700 border-sky-200' },
  'Escalations':        { icon: '🔔', badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  'System':             { icon: '⚙️', badge: 'bg-sunken text-muted-foreground border-line' },
};

export default async function PlatformNotificationsPage() {
  const admin = getSupabaseAdminClient();

  const { data: rows } = await admin
    .from('notification_configs')
    .select('id, event_type, enabled, recipients')
    .eq('scope', 'platform')
    .order('event_type');

  const configMap = new Map<string, NotifRow>(
    (rows ?? []).map(r => [r.event_type, r as NotifRow])
  );

  // Group events
  const groups = GROUP_ORDER.map(groupName => ({
    name: groupName,
    events: Object.entries(EVENT_META)
      .filter(([, m]) => m.group === groupName)
      .map(([eventType, meta]) => ({
        eventType,
        ...meta,
        row: configMap.get(eventType) ?? null,
      })),
  }));

  const totalEnabled = [...configMap.values()].filter(r => r.enabled).length;

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-text">Notifications</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Platform-wide email alerts — control which events trigger notifications and who receives them.
        </p>
      </div>

      {/* Summary bar */}
      <div className="flex items-center gap-3 bg-sunken border border-line rounded-xl px-4 py-3">
        <Bell size={14} className="text-indigo-500 shrink-0" />
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold text-text">{totalEnabled}</span> of{' '}
          <span className="font-semibold text-text">{Object.keys(EVENT_META).length}</span> notification types are enabled.
          Recipients shown as role tags — click <strong>Edit</strong> on any row to change them.
        </p>
      </div>

      {/* Groups */}
      <div className="space-y-5">
        {groups.map(group => {
          const style = GROUP_STYLE[group.name];
          const onCount = group.events.filter(e => e.row?.enabled).length;

          return (
            <div key={group.name}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm">{style.icon}</span>
                <h3 className="text-sm font-semibold text-text">{group.name}</h3>
                <span className={`ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full border ${style.badge}`}>
                  {onCount}/{group.events.length} on
                </span>
              </div>

              <div className="bg-white rounded-2xl border border-line shadow-sm overflow-hidden divide-y divide-line">
                {group.events.map(evt => {
                  if (!evt.row) {
                    return (
                      <div key={evt.eventType} className="px-5 py-4 flex items-center gap-3">
                        <div className="w-9 h-5 rounded-full bg-sunken shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-muted-foreground">{evt.label}</p>
                          <p className="text-xs text-muted-foreground">{evt.desc}</p>
                          <p className="text-[11px] text-line mt-0.5 italic">Not seeded — run migration 002.</p>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <NotificationToggleRow
                      key={evt.eventType}
                      id={evt.row.id}
                      label={evt.label}
                      desc={evt.desc}
                      enabled={evt.row.enabled}
                      recipients={evt.row.recipients ?? []}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
