import type { FastifyBaseLogger } from 'fastify';
import type { getServerClient } from '@alphabot/database';
import type { IncomingWhatsAppMessage, WhatsAppProvider } from '@alphabot/shared';
import { WhatsAppGateway } from '../whatsapp/gateway.js';
import { resolveNumberForRole } from '../../lib/number-roles.js';

type Db = ReturnType<typeof getServerClient>;

interface Ctx {
  db:       Db;
  gateway:  WhatsAppGateway;
  config:   { phone_number_id: string; access_token: string };
  incoming: IncomingWhatsAppMessage;
  tenantId: string;
  log:      FastifyBaseLogger;
}

async function loadOrder(db: Db, orderId: string) {
  const { data } = await db
    .from('orders')
    .select('id, order_ref, total_paise, status, contact:contacts(phone)')
    .eq('id', orderId)
    .single();
  return data as { id: string; order_ref: string | null; total_paise: number | null; status: string; contact: { phone: string } | null } | null;
}

/**
 * FUL-03: handles a kitchen staff tap on the Ready/Problem ticket buttons
 * (lib arrives on the role='kitchen' number, see routes/orders/index.ts's
 * sendKitchenTicket). "Problem" is deliberately whole-order, not per-item —
 * a single button tap can't carry which item was the issue, and there's no
 * structured item-unavailable flow built to ask for it (FUL-04, consolidated
 * into this story per docs/BACKLOG.md, kept intentionally simple).
 */
export async function handleKitchenReply(ctx: Ctx): Promise<boolean> {
  const replyId = ctx.incoming.interactiveReplyId;
  if (!replyId) return false;

  const readyMatch   = replyId.match(/^kitchen_ready:([0-9a-f-]{36})$/i);
  const problemMatch = replyId.match(/^kitchen_problem:([0-9a-f-]{36})$/i);
  if (!readyMatch && !problemMatch) return false;

  const orderId = (readyMatch ?? problemMatch)![1]!;
  const order = await loadOrder(ctx.db, orderId);
  if (!order) return true; // acknowledge the tap either way — nothing more to do

  if (readyMatch) {
    await ctx.db.from('orders').update({ status: 'ready' }).eq('id', orderId);

    const customerWn = await resolveNumberForRole(ctx.db, ctx.tenantId, 'restaurant_bot', 'customer');
    if (customerWn && order.contact?.phone) {
      const gw = new WhatsAppGateway(customerWn.provider as WhatsAppProvider);
      await gw.sendMessage(customerWn.phone_number_id, customerWn.access_token, {
        type: 'text',
        to:   order.contact.phone,
        text: `Your order ${order.order_ref ?? ''} is ready for pickup! 🎉`,
      });
    }
    await ctx.gateway.sendMessage(ctx.config.phone_number_id, ctx.config.access_token, {
      type: 'text', to: ctx.incoming.from, text: `Marked ${order.order_ref ?? orderId} ready. Customer notified.`,
    });
    return true;
  }

  // "Problem" — alert the owner on the ops number with Swap/Refund actions.
  const opsWn = await resolveNumberForRole(ctx.db, ctx.tenantId, 'restaurant_bot', 'ops');
  const { data: settings } = await ctx.db
    .from('tenant_notification_settings')
    .select('lead_notification_wa_numbers')
    .eq('tenant_id', ctx.tenantId)
    .maybeSingle();
  const ownerNumbers = (settings?.lead_notification_wa_numbers as string[] | null) ?? [];

  if (opsWn && ownerNumbers.length > 0) {
    const gw = new WhatsAppGateway(opsWn.provider as WhatsAppProvider);
    const amount = order.total_paise != null ? `₹${(order.total_paise / 100).toFixed(2)}` : '';
    await Promise.allSettled(
      ownerNumbers.map(number =>
        gw.sendMessage(opsWn.phone_number_id, opsWn.access_token, {
          type:            'interactive',
          interactiveType: 'button',
          to:              number,
          body:            `Order ${order.order_ref ?? ''}: kitchen reports a problem. Paid ${amount}.`,
          buttons: [
            { type: 'reply', reply: { id: `own_swap:${orderId}`,   title: 'Offer a swap' } },
            { type: 'reply', reply: { id: `own_refund:${orderId}`, title: 'Refund order' } },
          ],
        }).catch(err => ctx.log.warn({ orderId, number, err }, '[FUL-03] owner problem alert failed'))
      ),
    );
  }

  await ctx.gateway.sendMessage(ctx.config.phone_number_id, ctx.config.access_token, {
    type: 'text', to: ctx.incoming.from, text: `Owner alerted about ${order.order_ref ?? orderId}.`,
  });
  return true;
}

/**
 * FUL-03: the owner's response to a "Problem" alert, arriving on the
 * role='ops' number. "Offer a swap" hands the conversation back to the
 * customer in free text (no structured substitute-picker exists). "Refund
 * order" cancels the order and tells the owner to process the refund
 * manually — no Easebuzz refund API integration exists yet (PAY-07).
 */
export async function handleOwnerProblemResolution(ctx: Ctx): Promise<boolean> {
  const replyId = ctx.incoming.interactiveReplyId;
  if (!replyId) return false;

  const swapMatch   = replyId.match(/^own_swap:([0-9a-f-]{36})$/i);
  const refundMatch = replyId.match(/^own_refund:([0-9a-f-]{36})$/i);
  if (!swapMatch && !refundMatch) return false;

  const orderId = (swapMatch ?? refundMatch)![1]!;
  const order = await loadOrder(ctx.db, orderId);
  if (!order) return true;

  const customerWn = await resolveNumberForRole(ctx.db, ctx.tenantId, 'restaurant_bot', 'customer');

  if (swapMatch) {
    if (customerWn && order.contact?.phone) {
      const gw = new WhatsAppGateway(customerWn.provider as WhatsAppProvider);
      await gw.sendMessage(customerWn.phone_number_id, customerWn.access_token, {
        type: 'text',
        to:   order.contact.phone,
        text: `Sorry — one item in your order ${order.order_ref ?? ''} isn't available right now. What would you like instead, or should we remove it?`,
      });
    }
    await ctx.gateway.sendMessage(ctx.config.phone_number_id, ctx.config.access_token, {
      type: 'text', to: ctx.incoming.from, text: 'Customer asked for a replacement choice.',
    });
    return true;
  }

  await ctx.db.from('orders').update({ status: 'cancelled' }).eq('id', orderId);
  if (customerWn && order.contact?.phone) {
    const gw = new WhatsAppGateway(customerWn.provider as WhatsAppProvider);
    await gw.sendMessage(customerWn.phone_number_id, customerWn.access_token, {
      type: 'text',
      to:   order.contact.phone,
      text: `We're sorry — your order ${order.order_ref ?? ''} has been cancelled and will be refunded.`,
    });
  }
  await ctx.gateway.sendMessage(ctx.config.phone_number_id, ctx.config.access_token, {
    type: 'text', to: ctx.incoming.from,
    text: `Order ${order.order_ref ?? ''} cancelled. Refunds aren't automated yet — please process it manually in your Easebuzz dashboard.`,
  });
  return true;
}
