import type { FastifyBaseLogger } from 'fastify';
import type { getServerClient } from '@alphabot/database';
import type { Contact, Conversation, IncomingWhatsAppMessage } from '@alphabot/shared';
import { WhatsAppGateway } from '../whatsapp/gateway.js';
import { fireForget } from '../../lib/fire-forget.js';

type Db = ReturnType<typeof getServerClient>;

interface ReturnRequestContext {
  db:           Db;
  gateway:      WhatsAppGateway;
  config:       { phone_number_id: string; access_token: string };
  incoming:     IncomingWhatsAppMessage;
  conversation: Conversation;
  contact:      Contact;
  tenantId:     string;
  log:          FastifyBaseLogger;
}

/**
 * Fires when the lifecycle bot appends [RETURN_REQUEST] to its reply.
 * Inserts a return_requests row and sends a WhatsApp confirmation.
 */
export function handleReturnRequest(ctx: ReturnRequestContext): void {
  const returnType = ctx.incoming.text?.toLowerCase().includes('replac') ? 'replacement' : 'return';
  fireForget(
    (async () => {
      const { data: inserted, error: insertErr } = await ctx.db
        .from('return_requests')
        .insert({
          tenant_id:       ctx.tenantId,
          conversation_id: ctx.conversation.id,
          contact_id:      ctx.contact.id,
          type:            returnType,
          reason:          ctx.incoming.text ?? null,
          status:          'pending',
        })
        .select('id')
        .single();

      if (insertErr) {
        ctx.log.error({ insertErr, tenantId: ctx.tenantId }, '[Webhook] Failed to insert return_request');
        return;
      }
      ctx.log.info({ returnRequestId: (inserted as { id: string }).id, returnType }, '[Webhook] Return request logged');

      const confirmMsg = returnType === 'replacement'
        ? `✅ We've received your replacement request and our team will review it shortly.\n\nPlease share your *order ID* and *photos of the item* so we can process it faster. You'll hear from us within 1–2 business days.`
        : `✅ We've received your return request and our team will review it shortly.\n\nPlease share your *order ID* and *photos of the item* if applicable. You'll hear from us within 1–2 business days.`;

      await ctx.gateway.sendMessage(ctx.config.phone_number_id, ctx.config.access_token, {
        type: 'text',
        to:   ctx.incoming.from,
        text: confirmMsg,
      });
    })(),
    'handle-return-request',
    ctx.log,
  );
}
