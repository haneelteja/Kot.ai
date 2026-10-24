import type { FastifyBaseLogger } from 'fastify';
import type { getServerClient } from '@alphabot/database';
import { WhatsAppGateway } from '../services/whatsapp/gateway.js';

type Db = ReturnType<typeof getServerClient>;

/**
 * PRV-01: sends a one-line privacy notice alongside a contact's first-ever
 * message. Exactly-once via an UPDATE ... WHERE privacy_notice_sent_at IS
 * NULL claim — safe against webhook retries racing on the same brand-new
 * contact, no time-window heuristic needed.
 */
export async function maybeSendPrivacyNotice(
  db:            Db,
  gateway:       WhatsAppGateway,
  config:        { phone_number_id: string; access_token: string },
  tenantId:      string,
  contactId:     string,
  customerPhone: string,
  log:           FastifyBaseLogger,
): Promise<void> {
  const { data: claimed } = await db
    .from('contacts')
    .update({ privacy_notice_sent_at: new Date().toISOString() })
    .eq('id', contactId)
    .is('privacy_notice_sent_at', null)
    .select('id')
    .maybeSingle();

  if (!claimed) return;

  const { data: settings } = await db
    .from('tenant_notification_settings')
    .select('privacy_notice_url')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  const url = (settings as { privacy_notice_url: string | null } | null)?.privacy_notice_url;
  const text = url
    ? `🔒 We use your WhatsApp messages and order details only to handle your request. Privacy notice: ${url}`
    : `🔒 We use your WhatsApp messages and order details only to handle your request, in line with applicable data protection law.`;

  await gateway.sendMessage(config.phone_number_id, config.access_token, {
    type: 'text',
    to:   customerPhone,
    text,
  }).catch(err => log.warn({ err, tenantId, contactId }, '[PRV-01] privacy notice send failed'));
}
