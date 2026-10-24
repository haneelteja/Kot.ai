import type { FastifyBaseLogger } from 'fastify';
import type { getServerClient } from '@alphabot/database';
import type { IncomingWhatsAppMessage } from '@alphabot/shared';
import { WhatsAppGateway } from '../whatsapp/gateway.js';
import { createComplaint } from '../../lib/complaint.js';
import { notifyStaffOfComplaint } from '../booking/notify.js';

type Db = ReturnType<typeof getServerClient>;

/** CMP-01: system-prompt block for the [ENTITY:]/[CONFIRM_COMPLAINT] capture flow. */
export const COMPLAINT_PROMPT_BLOCK =
  `\n\n---\nCOMPLAINT HANDLING\nIf a customer reports a problem with an order they received (wrong item, missing item, poor quality, arrived late, or anything else), capture it as a ticket — don't just apologize and move on.\nAsk for a short description if they haven't given one. Capture the category with [ENTITY:complaint_category=<wrong_item|missing_item|quality|late|other>] and the description with [ENTITY:complaint_description=<text>].\nOnce you have the category (description is optional), tell the customer you've logged it and someone will follow up, then append [CONFIRM_COMPLAINT] on the very last line — no need to ask them to confirm first, just log it once you have enough detail.`;

interface ConfirmComplaintContext {
  db:           Db;
  gateway:      WhatsAppGateway;
  config:       { phone_number_id: string; access_token: string };
  incoming:     IncomingWhatsAppMessage;
  conversation: { id: string; tenant_id: string };
  tenantId:     string;
  contactId:    string;
  contactName:  string | null;
  contactPhone: string;
  vars:         Record<string, string>;
  log:          FastifyBaseLogger;
}

/** CMP-01: fires on [CONFIRM_COMPLAINT]. Mirrors button-flow.ts's handleConfirmBooking. */
export async function handleConfirmComplaint(ctx: ConfirmComplaintContext): Promise<void> {
  const category = ctx.vars['complaint_category'];
  if (!category) {
    ctx.log.warn({ tenantId: ctx.tenantId, conversationId: ctx.conversation.id }, '[CMP-01] CONFIRM_COMPLAINT fired with no category captured — not logged');
    return;
  }

  const result = await createComplaint(
    ctx.db, ctx.tenantId, ctx.contactId, ctx.conversation.id, category, ctx.vars['complaint_description'] ?? null,
  );

  if (!result.ok) {
    ctx.log.warn({ tenantId: ctx.tenantId, error: result.error }, '[CMP-01] failed to create complaint');
    return;
  }

  void notifyStaffOfComplaint(
    ctx.tenantId, 'restaurant_bot', ctx.contactName ?? ctx.contactPhone, ctx.contactPhone, category, result.complaint.orderRef,
  );

  // Fire-and-forget — the AI's own reply already told the customer it's
  // logged; this is just a safety net in case that reply was truncated.
  void ctx.gateway.sendMessage(ctx.config.phone_number_id, ctx.config.access_token, {
    type: 'text',
    to:   ctx.incoming.from,
    text: `Got it — we've logged this and our team will follow up within 24 hours.`,
  }).catch(() => {});
}
