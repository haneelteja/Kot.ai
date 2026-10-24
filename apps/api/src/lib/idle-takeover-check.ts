import type { getServerClient } from '@alphabot/database';
import { releaseToBot } from '../services/escalation/index.js';

type Db = ReturnType<typeof getServerClient>;
type Logger = { info: (...args: unknown[]) => void; error: (...args: unknown[]) => void };

/**
 * HND-03: a conversation sitting at status='bot_paused' (human takeover)
 * with no activity for longer than the tenant's configured idle timeout
 * auto-releases back to the bot, so a customer is never left stuck in
 * silence because staff went idle without releasing the conversation.
 *
 * `conversations.updated_at` is the idle clock: incoming customer messages
 * while paused don't bump it (webhook/index.ts just stores the message
 * and returns), but a staff reply does (routes/conversations/index.ts's
 * /send route) — so it correctly measures "time since staff last engaged,"
 * not "time since the customer last spoke."
 */
export async function checkIdleTakeovers(db: Db, log: Logger): Promise<void> {
  const { data: pausedConvos, error } = await db
    .from('conversations')
    .select('id, tenant_id, assigned_agent_id, updated_at')
    .eq('status', 'bot_paused')
    .not('assigned_agent_id', 'is', null);

  if (error) {
    log.error({ err: error }, '[HND-03] failed to fetch paused conversations');
    return;
  }
  if (!pausedConvos || pausedConvos.length === 0) return;

  const tenantIds = [...new Set(pausedConvos.map(c => (c as { tenant_id: string }).tenant_id))];
  const { data: tenantRows } = await db
    .from('tenants')
    .select('id, bot_takeover_idle_minutes')
    .in('id', tenantIds);

  const idleMinutesByTenant = new Map(
    ((tenantRows ?? []) as Array<{ id: string; bot_takeover_idle_minutes: number }>).map(t => [t.id, t.bot_takeover_idle_minutes]),
  );

  const now = Date.now();
  for (const convo of pausedConvos as Array<{ id: string; tenant_id: string; assigned_agent_id: string; updated_at: string }>) {
    const idleMinutes = idleMinutesByTenant.get(convo.tenant_id) ?? 120;
    const idleSinceMs = now - new Date(convo.updated_at).getTime();
    if (idleSinceMs < idleMinutes * 60_000) continue;

    try {
      await releaseToBot(convo.id, convo.assigned_agent_id, 'Auto-released — no staff activity within the idle timeout');
      log.info({ conversationId: convo.id, idleMinutes }, '[HND-03] auto-released idle takeover back to bot');
    } catch (err) {
      log.error({ err, conversationId: convo.id }, '[HND-03] failed to auto-release idle takeover');
    }
  }
}
