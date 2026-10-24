import cron from 'node-cron';
import { getServerClient } from '@alphabot/database';
import { runDailyReports } from '../lib/email/daily-report.js';
import { WhatsAppGateway } from '../services/whatsapp/gateway.js';
import { runInsightsForAllTenants } from '../services/insights/generator.js';
import { withJobLock } from '../lib/redis.js';
import { businessDaysCutoff } from '../lib/business-days.js';
import { resetAllDailyCounts } from '../lib/sender-capacity.js';
import { captureException } from '../lib/sentry.js';
import type { Conversation, WhatsAppProvider } from '@alphabot/shared';
import type { RoutingConfig } from '../services/routing/router.js';
import { escalateConversation } from '../services/escalation/index.js';
import { sendDueBookingFeedbackPrompts } from '../lib/booking-feedback.js';
import { sendDueOrderFeedbackPrompts } from '../lib/order-feedback.js';
import { checkStuckOrders, checkUncollectedOrders } from '../lib/stuck-order-check.js';
import { purgeExpiredMessages } from '../lib/retention.js';
import { checkIdleTakeovers } from '../lib/idle-takeover-check.js';
import { processCheckoutDraftReminders } from '../lib/checkout-draft-expiry.js';

function alertJobFailure(jobName: string, err: unknown): void {
  console.error(`[Scheduler] ${jobName} failed:`, (err as Error).message);
  captureException(err, { job: jobName, source: 'scheduler' });
}

const KEEP_ALIVE_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours

async function pingSupabase(): Promise<void> {
  try {
    await getServerClient().from('tenants').select('id').limit(1);
  } catch (err) {
    console.error('[KeepAlive] Supabase ping failed:', err instanceof Error ? err.message : String(err));
  }
}

async function processFollowUps(): Promise<void> {
  const db = getServerClient();

  const { data: configs } = await db
    .from('follow_up_configs')
    .select('*')
    .eq('enabled', true);

  if (!configs?.length) return;

  for (const config of configs) {
    try {
      // Use business-days cutoff so weekends don't count as silence days
      const cutoff = businessDaysCutoff(config.idle_days);

      const { data: allConversations } = await db
        .from('conversations')
        .select('id, contact_id')
        .eq('tenant_id', config.tenant_id)
        .eq('product_type', config.product_slug)
        .eq('status', 'open')
        .lt('updated_at', cutoff);

      const scope      = config.scope ?? 'all';
      const contactIds = (config.contact_ids ?? []) as string[];
      const conversations = (allConversations ?? []).filter(conv => {
        if (scope === 'include' && contactIds.length > 0) return contactIds.includes(conv.contact_id);
        if (scope === 'exclude' && contactIds.length > 0) return !contactIds.includes(conv.contact_id);
        return true;
      });

      if (!conversations.length) continue;

      const { data: wn } = await db
        .from('whatsapp_numbers')
        .select('config_json, provider')
        .eq('tenant_id', config.tenant_id)
        .eq('product_slug', config.product_slug)
        .eq('active', true)
        .limit(1)
        .single();

      if (!wn) continue;

      const gateway  = new WhatsAppGateway(wn.provider as WhatsAppProvider);
      const wnConfig = wn.config_json as { phone_number_id: string; access_token: string };

      const convIds = conversations.map(c => c.id);

      // Batch: fetch all existing sends for every conversation in one query
      const { data: existingSends } = await db
        .from('follow_up_sends')
        .select('conversation_id')
        .in('conversation_id', convIds);

      const sendCountMap = new Map<string, number>();
      for (const send of (existingSends ?? [])) {
        const id = (send as { conversation_id: string }).conversation_id;
        sendCountMap.set(id, (sendCountMap.get(id) ?? 0) + 1);
      }

      const eligibleConvs = conversations.filter(
        conv => (sendCountMap.get(conv.id) ?? 0) < config.max_follow_ups,
      );

      if (!eligibleConvs.length) continue;

      // Batch: fetch all relevant contacts in one query
      const uniqueContactIds = [...new Set(eligibleConvs.map(c => c.contact_id))];
      const { data: contactsData } = await db
        .from('contacts')
        .select('id, phone, name')
        .in('id', uniqueContactIds);

      const contactMap = new Map(
        (contactsData ?? []).map(c => [(c as { id: string }).id, c as { id: string; phone: string; name: string | null }]),
      );

      const newMessages:    object[] = [];
      const newSends:       object[] = [];
      const updatedConvIds: string[] = [];

      for (const conv of eligibleConvs) {
        try {
          const contact = contactMap.get(conv.contact_id);
          if (!contact) continue;

          const name    = contact.name?.split(' ')[0] ?? 'there';
          const message = config.message_template.replace(/\{name\}/gi, name);

          await gateway.sendMessage(wnConfig.phone_number_id, wnConfig.access_token, {
            type: 'text',
            to:   contact.phone,
            text: message,
          });

          newMessages.push({ conversation_id: conv.id, role: 'assistant', content: message });
          newSends.push({ conversation_id: conv.id });
          updatedConvIds.push(conv.id);

        } catch (convErr) {
          console.error(`[FollowUp] Failed for conversation ${conv.id}:`, convErr);
        }
      }

      // Batch inserts and update — replaces N×4 sequential round-trips with 3
      if (newMessages.length)    await db.from('messages').insert(newMessages);
      if (newSends.length)       await db.from('follow_up_sends').insert(newSends);
      if (updatedConvIds.length) {
        await db.from('conversations')
          .update({ updated_at: new Date().toISOString() })
          .in('id', updatedConvIds);
      }
    } catch (configErr) {
      console.error(`[FollowUp] Failed processing config ${config.id}:`, configErr);
    }
  }
}

async function processPaymentReminders(): Promise<void> {
  const db = getServerClient();

  // Find pending orders where no reminder in last 3 days (or first reminder after 24h)
  const firstCutoff  = new Date(Date.now() - 24  * 60 * 60 * 1000).toISOString();
  const repeatCutoff = new Date(Date.now() - 72  * 60 * 60 * 1000).toISOString();

  const { data: orders } = await db
    .from('orders')
    .select(`
      id, tenant_id, total, reminder_count, last_reminded_at,
      contact:contacts(phone, name),
      payments(status, link_url)
    `)
    .in('status', ['pending', 'confirmed'])
    .lt('reminder_count', 3)
    .lt('created_at', firstCutoff);

  if (!orders?.length) return;

  const eligible = orders.filter(o => {
    const lastReminded = (o as unknown as { last_reminded_at: string | null }).last_reminded_at;
    if (!lastReminded) return true;                     // never reminded — fire if past first-cutoff
    return lastReminded < repeatCutoff;                 // reminded before, wait 3 days before next
  });

  if (!eligible.length) return;

  // Group by tenant to fetch WhatsApp numbers once per tenant
  const byTenant = new Map<string, typeof eligible>();
  for (const o of eligible) {
    const tid = (o as unknown as { tenant_id: string }).tenant_id;
    if (!byTenant.has(tid)) byTenant.set(tid, []);
    byTenant.get(tid)!.push(o);
  }

  for (const [tenantId, tenantOrders] of byTenant) {
    const { data: wn } = await db
      .from('whatsapp_numbers')
      .select('config_json, provider')
      .eq('tenant_id', tenantId)
      .eq('product_slug', 'lifecycle_bot')
      .eq('active', true)
      .maybeSingle();

    if (!wn) continue;

    const gateway  = new WhatsAppGateway((wn as { provider: string }).provider as WhatsAppProvider);
    const wnConfig = (wn as { config_json: { phone_number_id: string; access_token: string } }).config_json;

    await Promise.allSettled(
      tenantOrders.map(async (o) => {
        const contact       = (o as unknown as { contact: { phone: string; name: string | null } | null }).contact;
        const payments      = (o as unknown as { payments: Array<{ status: string; link_url: string | null }> }).payments;
        const payment       = payments?.[0];
        const reminderCount = (o as unknown as { reminder_count: number }).reminder_count;
        const total         = (o as unknown as { total: number }).total;
        const orderId       = (o as unknown as { id: string }).id;

        if (!contact?.phone) return;
        if (payment?.status === 'paid') return;

        const name    = contact.name?.split(' ')[0] ?? 'there';
        const shortId = orderId.slice(0, 8).toUpperCase();

        const messages = [
          `⏰ *Payment Reminder*\n\nHi ${name}! Your order #${shortId} (₹${Number(total).toLocaleString('en-IN')}) is awaiting payment.\n\n${payment?.link_url ? `Pay here: ${payment.link_url}` : 'Please complete your payment to proceed.'}`,
          `🔔 *Follow-up Reminder*\n\nHi ${name}, just a friendly nudge — your order #${shortId} is still unpaid.\n\n${payment?.link_url ? `Pay here: ${payment.link_url}` : 'Reach out if you need help.'}`,
          `🚨 *Final Reminder*\n\nHi ${name}, this is our last reminder for order #${shortId}. Your order may be cancelled if payment isn't received.\n\n${payment?.link_url ? `Pay here: ${payment.link_url}` : 'Contact us for support.'}`,
        ];

        const text = messages[Math.min(reminderCount, 2)]!;
        await gateway.sendMessage(wnConfig.phone_number_id, wnConfig.access_token, {
          type: 'text', to: contact.phone, text,
        });

        await db.from('orders')
          .update({ reminder_count: reminderCount + 1, last_reminded_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq('id', orderId);

        console.log(`[PaymentReminder] Sent reminder #${reminderCount + 1} for order ${orderId}`);
      }),
    );
  }
}

async function processEnquiryFollowups(): Promise<void> {
  const db = getServerClient();
  const now = new Date().toISOString();

  const { data: jobs } = await db
    .from('enquiry_followup_jobs')
    .select('id, tenant_id, conversation_id, contact_phone, whatsapp_number_id')
    .lte('fire_at', now)
    .is('fired_at', null)
    .is('cancelled_at', null)
    .limit(50);

  if (!jobs?.length) return;

  await Promise.allSettled(jobs.map(async (job) => {
    try {
      type JobRow = { id: string; tenant_id: string; conversation_id: string; contact_phone: string; whatsapp_number_id: string | null };
      const j = job as unknown as JobRow;

      // Check if conversation is still open and not yet booked
      const { data: conv } = await db
        .from('conversations')
        .select('id, status, stage, contact_id')
        .eq('id', j.conversation_id)
        .maybeSingle();

      const stage = (conv as unknown as { stage?: string | null } | null)?.stage ?? '';
      const status = (conv as unknown as { status?: string } | null)?.status ?? '';

      if (!conv || status !== 'open' || stage === 'booked' || stage === 'confirmed') {
        // Conversation resolved or already booked — cancel silently
        await db.from('enquiry_followup_jobs')
          .update({ cancelled_at: now })
          .eq('id', j.id);
        return;
      }

      // Load WA number for messaging + routing config for custom message
      const { data: wn } = await db
        .from('whatsapp_numbers')
        .select('config_json, provider, routing_config')
        .eq('id', j.whatsapp_number_id ?? '')
        .maybeSingle();

      if (!wn) {
        await db.from('enquiry_followup_jobs').update({ cancelled_at: now }).eq('id', j.id);
        return;
      }

      const routingCfg = ((wn as unknown as { routing_config?: unknown }).routing_config ?? {}) as RoutingConfig;
      const msgTemplate = routingCfg.enquiry_followup_message
        ?? "Hi {name}! 👋 You reached out to us earlier — would you like to go ahead with a booking? We'd love to help!";

      // Get contact name
      const contactId = (conv as unknown as { contact_id: string }).contact_id;
      const { data: contactRow } = await db
        .from('contacts')
        .select('name')
        .eq('id', contactId)
        .maybeSingle();
      const firstName = (contactRow as { name?: string | null } | null)?.name?.split(' ')[0] ?? 'there';
      const text = msgTemplate.replace(/\{name\}/gi, firstName);

      const gateway  = new WhatsAppGateway((wn as { provider: string }).provider as WhatsAppProvider);
      const wnConfig = (wn as { config_json: { phone_number_id: string; access_token: string } }).config_json;

      await gateway.sendMessage(wnConfig.phone_number_id, wnConfig.access_token, {
        type: 'text', to: j.contact_phone, text,
      });

      // Store message + mark job fired
      await Promise.all([
        db.from('messages').insert({ conversation_id: j.conversation_id, role: 'assistant', content: text }),
        db.from('enquiry_followup_jobs').update({ fired_at: now }).eq('id', j.id),
      ]);

      console.log(`[EnquiryFollowup] Sent nudge for conversation ${j.conversation_id}`);
    } catch (err) {
      console.error(`[EnquiryFollowup] Failed for job ${(job as { id: string }).id}:`, err instanceof Error ? err.message : String(err));
    }
  }));
}

async function processAutoEscalate(): Promise<void> {
  const db = getServerClient();

  const { data: botCfgs } = await db
    .from('bot_configs')
    .select('tenant_id, product_slug, escalation_policy')
    .not('escalation_policy', 'is', null);

  if (!botCfgs?.length) return;

  for (const row of botCfgs) {
    const policy = row.escalation_policy as { auto_escalate_after_hours?: number | null } | null;
    const hours  = policy?.auto_escalate_after_hours;
    if (!hours || hours <= 0) continue;

    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    const { data: convs } = await db
      .from('conversations')
      .select('id, tenant_id, contact_id, product_type, status, updated_at')
      .eq('tenant_id', row.tenant_id)
      .eq('product_type', row.product_slug)
      .eq('status', 'open')
      .lt('updated_at', cutoff)
      .limit(100);

    if (!convs?.length) continue;

    await Promise.allSettled(convs.map(async (conv) => {
      try {
        await escalateConversation(
          conv as unknown as Conversation,
          `Stale conversation auto-escalated after ${hours}h with no customer reply`,
        );
        console.log(`[AutoEscalate] Escalated conversation ${conv.id} (idle ${hours}h)`);
      } catch (err) {
        console.error(`[AutoEscalate] Failed for conversation ${conv.id}:`, err instanceof Error ? err.message : String(err));
      }
    }));
  }
}

export function startScheduler(): void {
  // Keep Supabase alive (free tier pauses after 7 days inactivity)
  void pingSupabase();
  setInterval(() => void pingSupabase(), KEEP_ALIVE_INTERVAL_MS);

  // Daily report — every hour on the hour. Each tenant is sent exactly once
  // per day, at their configured UTC hour (tenant_notification_settings.
  // daily_report_hour_utc, default 8 — the pre-existing fixed time) — OWN-02
  // needs this to be per-tenant-configurable (default ~11pm IST for
  // restaurants), which a single fixed cron time can't do.
  // [TTL: 3540s = 59min, prevents duplicate within the same hour on restart]
  cron.schedule('0 * * * *', () => {
    const hour = new Date().getUTCHours();
    void withJobLock(`daily_reports_${hour}`, 3540, () => runDailyReports(hour)).catch(err =>
      alertJobFailure('daily_reports', err)
    );
  }, { timezone: 'UTC' });

  // Follow-up messages — every hour  [TTL: 3540s = 59min]
  cron.schedule('0 * * * *', () => {
    void withJobLock('follow_ups', 3540, () => processFollowUps()).catch(err =>
      alertJobFailure('follow_ups', err)
    );
  });

  // Auto-escalate stale conversations — every hour  [TTL: 3540s = 59min]
  cron.schedule('0 * * * *', () => {
    void withJobLock('auto_escalate', 3540, () => processAutoEscalate()).catch(err =>
      alertJobFailure('auto_escalate', err)
    );
  });

  // Enquiry follow-up nudges — every 5 min  [TTL: 270s = 4.5min]
  cron.schedule('*/5 * * * *', () => {
    void withJobLock('enquiry_followups', 270, () => processEnquiryFollowups()).catch(err =>
      alertJobFailure('enquiry_followups', err)
    );
  });

  // Payment reminders — daily at 11:30 UTC (5:00 PM IST)  [TTL: 82800s = 23h]
  cron.schedule('30 11 * * *', () => {
    void withJobLock('payment_reminders', 82800, () => processPaymentReminders()).catch(err =>
      alertJobFailure('payment_reminders', err)
    );
  }, { timezone: 'UTC' });

  // AI Insights — runs at :30 past each hour; schedule_hour=0 → 0:30 UTC = 6:00 AM IST
  cron.schedule('30 * * * *', () => {
    void withJobLock('ai_insights', 3540, async () => {
      const db = getServerClient();
      const { data: setting } = await db
        .from('platform_settings')
        .select('value')
        .eq('key', 'insights')
        .maybeSingle();
      const scheduleHour = ((setting?.value as Record<string, unknown> | null)?.['schedule_hour'] as number | null) ?? 0;
      if (new Date().getUTCHours() === scheduleHour) {
        await runInsightsForAllTenants();
      }
    }).catch(err =>
      alertJobFailure('ai_insights', err)
    );
  });

  // Booking feedback prompts (BKG-07) — every 30 min  [TTL: 1740s = 29min]
  cron.schedule('*/30 * * * *', () => {
    void withJobLock('booking_feedback', 1740, () => sendDueBookingFeedbackPrompts(getServerClient(), console)).catch(err =>
      alertJobFailure('booking_feedback', err)
    );
  });

  // Order feedback prompts (ORD-07) — every 30 min  [TTL: 1740s = 29min]
  cron.schedule('*/30 * * * *', () => {
    void withJobLock('order_feedback', 1740, () => sendDueOrderFeedbackPrompts(getServerClient(), console)).catch(err =>
      alertJobFailure('order_feedback', err)
    );
  });

  // Stuck-order alert (FUL-02) — every 5 min  [TTL: 270s = 4.5min]
  cron.schedule('*/5 * * * *', () => {
    void withJobLock('stuck_orders', 270, () => checkStuckOrders(getServerClient(), console)).catch(err =>
      alertJobFailure('stuck_orders', err)
    );
  });

  // Uncollected-order alert (TKW-03) — every 5 min  [TTL: 270s = 4.5min]
  cron.schedule('*/5 * * * *', () => {
    void withJobLock('uncollected_orders', 270, () => checkUncollectedOrders(getServerClient(), console)).catch(err =>
      alertJobFailure('uncollected_orders', err)
    );
  });

  // Checkout draft reminders + expiry (PAY-02/ORD-02) — every 2 min  [TTL: 110s]
  cron.schedule('*/2 * * * *', () => {
    void withJobLock('checkout_draft_reminders', 110, () => processCheckoutDraftReminders(getServerClient(), console)).catch(err =>
      alertJobFailure('checkout_draft_reminders', err)
    );
  });

  // Sender capacity daily reset — midnight UTC  [TTL: 82800s = 23h]
  cron.schedule('0 0 * * *', () => {
    void withJobLock('sender_capacity_reset', 82800, () => resetAllDailyCounts()).catch(err =>
      alertJobFailure('sender_capacity_reset', err)
    );
  }, { timezone: 'UTC' });

  // PRV-02: chat retention — anonymizes expired messages, 3 AM UTC  [TTL: 82800s = 23h]
  cron.schedule('0 3 * * *', () => {
    void withJobLock('chat_retention_purge', 82800, () => purgeExpiredMessages(getServerClient(), console)).catch(err =>
      alertJobFailure('chat_retention_purge', err)
    );
  }, { timezone: 'UTC' });

  // HND-03: auto-release idle human-takeover conversations back to the bot  [TTL: 590s]
  cron.schedule('*/10 * * * *', () => {
    void withJobLock('idle_takeover_check', 590, () => checkIdleTakeovers(getServerClient(), console)).catch(err =>
      alertJobFailure('idle_takeover_check', err)
    );
  });

  // Startup catch-up: generate insights if none in last 24h — fixes Render hibernation.
  // Guard: skip if the process started recently (< 5 min ago) and another instance is
  // likely still running; the withJobLock TTL (82800s) handles the distributed case
  // when Redis is available.
  const _processStartMs = Date.now();
  setTimeout(() => {
    // If the process restarted within 5 minutes of itself (e.g. Render free-tier wake),
    // withJobLock will prevent a re-run as long as Redis holds the previous lock key.
    void withJobLock('ai_insights_startup', 82800, async () => {
      const db = getServerClient();
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count } = await db
        .from('ai_insights')
        .select('*', { count: 'exact', head: true })
        .gte('generated_at', since);
      if ((count ?? 0) === 0) {
        console.log('[Insights] Startup catch-up: no insights in last 24h, generating now...');
        await runInsightsForAllTenants();
      } else {
        console.log(`[Insights] Startup catch-up: ${count} recent insight(s) found — skipping.`);
      }
    }).catch(err =>
      alertJobFailure('ai_insights_startup', err)
    );
  }, 15_000);
  void _processStartMs; // suppress unused-var warning
}
