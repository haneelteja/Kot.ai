import type { getServerClient } from '@alphabot/database';

type Db = ReturnType<typeof getServerClient>;
type Logger = { info: (...args: unknown[]) => void; error: (...args: unknown[]) => void };

const REDACTED_TEXT = '[redacted — retention policy]';
const CHUNK_SIZE = 200;

/**
 * PRV-02: anonymizes message content past a tenant's configured retention
 * window — never deletes rows. Deleting conversations outright risks
 * cascading into orders/payments/bookings that reference conversation_id
 * (several are NOT NULL FKs added across 90+ migrations; auditing every
 * ON DELETE behaviour before deleting production rows is not a safe bet to
 * make blind), so this scrubs the sensitive text/media instead — satisfies
 * "purges or anonymizes" without that cascade risk. Null chat_retention_days
 * (the default) means no purge — opt-in per tenant, never silently enabled.
 */
export async function purgeExpiredMessages(db: Db, log: Logger): Promise<void> {
  const { data: tenants, error: tenantsErr } = await db
    .from('tenants')
    .select('id, chat_retention_days')
    .not('chat_retention_days', 'is', null);

  if (tenantsErr) {
    log.error({ err: tenantsErr }, '[PRV-02] failed to fetch tenants with retention configured');
    return;
  }
  if (!tenants || tenants.length === 0) return;

  for (const t of tenants as Array<{ id: string; chat_retention_days: number }>) {
    try {
      await purgeTenantMessages(db, t.id, t.chat_retention_days, log);
    } catch (err) {
      log.error({ err, tenantId: t.id }, '[PRV-02] purge failed for tenant');
    }
  }
}

async function purgeTenantMessages(db: Db, tenantId: string, retentionDays: number, log: Logger): Promise<void> {
  const cutoff = new Date(Date.now() - retentionDays * 86_400_000).toISOString();

  const { data: convos, error: convosErr } = await db
    .from('conversations')
    .select('id')
    .eq('tenant_id', tenantId);

  if (convosErr || !convos || convos.length === 0) return;

  const ids = convos.map(c => (c as { id: string }).id);
  let totalUpdated = 0;

  for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
    const chunk = ids.slice(i, i + CHUNK_SIZE);
    const { data, error } = await db
      .from('messages')
      .update({ content: REDACTED_TEXT, media_url: null })
      .in('conversation_id', chunk)
      .lt('timestamp', cutoff)
      .neq('content', REDACTED_TEXT)
      .select('id');

    if (error) {
      log.error({ err: error, tenantId }, '[PRV-02] message anonymization chunk failed');
      continue;
    }
    totalUpdated += data?.length ?? 0;
  }

  if (totalUpdated > 0) {
    log.info({ tenantId, retentionDays, anonymized: totalUpdated }, '[PRV-02] anonymized expired messages');
  }
}
