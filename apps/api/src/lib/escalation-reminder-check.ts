import type { getServerClient } from '@alphabot/database';
import type { Conversation } from '@alphabot/shared';
import { sendEscalationNotifications } from '../services/escalation/index.js';

type Db = ReturnType<typeof getServerClient>;
type Logger = { warn: (o: unknown, m: string) => void };

/**
 * CONV-06: if an escalated conversation sits unclaimed (escalations.status
 * still 'pending') past the tenant's configured window (default 5 min), a
 * second alert fires once — re-running the exact same notification path
 * used on the initial escalation (staff alert + customer holding message),
 * which already sends both in one call.
 */
export async function checkUnclaimedEscalations(db: Db, log: Logger): Promise<void> {
  const { data: pending } = await db
    .from('escalations')
    .select('id, conversation_id, trigger_reason, tenant_id, created_at')
    .eq('status', 'pending')
    .is('reminder_sent_at', null);

  if (!pending || pending.length === 0) return;

  const tenantIds = [...new Set(pending.map(e => (e as { tenant_id: string }).tenant_id))];
  const { data: tenantRows } = await db
    .from('tenants')
    .select('id, escalation_reminder_minutes')
    .in('id', tenantIds);

  const reminderMinutesByTenant = new Map(
    ((tenantRows ?? []) as Array<{ id: string; escalation_reminder_minutes: number }>).map(t => [t.id, t.escalation_reminder_minutes]),
  );

  const now = Date.now();
  for (const esc of pending as Array<{ id: string; conversation_id: string; trigger_reason: string; tenant_id: string; created_at: string }>) {
    const reminderMinutes = reminderMinutesByTenant.get(esc.tenant_id) ?? 5;
    if (now - new Date(esc.created_at).getTime() < reminderMinutes * 60_000) continue;

    try {
      const { data: conversation } = await db
        .from('conversations')
        .select('*')
        .eq('id', esc.conversation_id)
        .single();
      if (!conversation || (conversation as Conversation).status !== 'escalated') {
        // Already claimed/resolved by the time we got here — nothing to remind.
        await db.from('escalations').update({ reminder_sent_at: new Date().toISOString() }).eq('id', esc.id);
        continue;
      }

      await sendEscalationNotifications(conversation as Conversation, `${esc.trigger_reason} — no staff reply within ${reminderMinutes} min, re-alerting`);
      await db.from('escalations').update({ reminder_sent_at: new Date().toISOString() }).eq('id', esc.id);
    } catch (err) {
      log.warn({ escalationId: esc.id, err }, '[CONV-06] escalation reminder failed — continuing');
    }
  }
}
