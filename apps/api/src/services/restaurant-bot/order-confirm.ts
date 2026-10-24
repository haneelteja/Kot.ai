import type { FastifyBaseLogger } from 'fastify';
import type { getServerClient } from '@alphabot/database';
import type { IncomingWhatsAppMessage } from '@alphabot/shared';
import { WhatsAppGateway } from '../whatsapp/gateway.js';
import { confirmOrderFromCart } from '../../lib/restaurant-order.js';
import { fireForget } from '../../lib/fire-forget.js';

type Db = ReturnType<typeof getServerClient>;

interface ConfirmOrderContext {
  db:           Db;
  gateway:      WhatsAppGateway;
  config:       { phone_number_id: string; access_token: string };
  incoming:     IncomingWhatsAppMessage;
  conversation: { id: string };
  tenantId:     string;
  contactId:    string;
  vars:         Record<string, string>;
  convAiVars:   Record<string, string>;
  log:          FastifyBaseLogger;
}

const COUPON_ERROR_MESSAGES: Record<string, string> = {
  not_found: "That coupon code isn't valid.",
  inactive: 'That coupon is no longer active.',
  expired: 'That coupon has expired.',
  below_minimum: "Your order doesn't meet that coupon's minimum order value.",
  usage_limit_reached: 'That coupon has already reached its usage limit.',
};

/**
 * Fires on [CONFIRM_ORDER]. ORD-02: creates a checkout draft, not an order —
 * the order exists only once Easebuzz confirms payment
 * (routes/orders/index.ts). PRC-02: coupon_code comes from the same
 * [ENTITY:] capture system booking/complaint already use.
 */
export async function handleConfirmOrder(ctx: ConfirmOrderContext): Promise<void> {
  const couponCode = ctx.vars['coupon_code'] ?? null;
  const result = await confirmOrderFromCart(ctx.db, ctx.tenantId, ctx.contactId, ctx.conversation.id, couponCode);

  if (result.ok && result.linkUrl) {
    const hasDiscount = result.bill.discountPaise > 0;
    const hasSurcharge = result.bill.taxPaise > 0 || result.bill.packingPaise > 0;
    const billLines = (hasDiscount || hasSurcharge)
      ? `Subtotal: ₹${(result.bill.subtotalPaise / 100).toFixed(2)}\n` +
        (hasDiscount ? `Discount: -₹${(result.bill.discountPaise / 100).toFixed(2)}\n` : '') +
        (result.bill.taxPaise > 0 ? `Tax: ₹${(result.bill.taxPaise / 100).toFixed(2)}\n` : '') +
        (result.bill.packingPaise > 0 ? `Packing charge: ₹${(result.bill.packingPaise / 100).toFixed(2)}\n` : '') +
        `Total: ₹${(result.totalPaise / 100).toFixed(2)}\n\n`
      : '';
    const msg = `${billLines}Please pay ₹${(result.totalPaise / 100).toFixed(2)} to confirm your order. This link is valid for 30 minutes.\n\n💳 ${result.linkUrl}`;
    fireForget(
      ctx.gateway.sendMessage(ctx.config.phone_number_id, ctx.config.access_token, { type: 'text', to: ctx.incoming.from, text: msg }),
      'send-order-confirmation',
      ctx.log,
    );
    return;
  }

  const msg = !result.ok && result.error === 'empty_cart'
    ? "Your cart is empty — add a few items first! 🍽️"
    : !result.ok && result.error === 'below_minimum'
    ? `The minimum order value is ₹${(result.limitPaise / 100).toFixed(2)}. Please add a bit more to your order.`
    : !result.ok && result.error === 'above_maximum'
    ? `This order exceeds our maximum order value of ₹${(result.limitPaise / 100).toFixed(2)}. Please split it into smaller orders or contact us directly.`
    : !result.ok && result.error === 'coupon_invalid'
    ? `${COUPON_ERROR_MESSAGES[result.couponError] ?? "That coupon code isn't valid."} Say "confirm" again to place the order without it, or give me a different code.`
    : "Sorry, I couldn't set up payment for that order right now. Please try again in a moment.";

  // PRC-02: clear the stale coupon_code so a bare "confirm again" doesn't
  // resubmit the same already-known-invalid code forever.
  if (!result.ok && result.error === 'coupon_invalid') {
    const { coupon_code: _dropped, ...varsWithoutCoupon } = ctx.convAiVars;
    void ctx.db.from('conversations').update({ ai_vars: varsWithoutCoupon }).eq('id', ctx.conversation.id);
  }

  fireForget(
    ctx.gateway.sendMessage(ctx.config.phone_number_id, ctx.config.access_token, { type: 'text', to: ctx.incoming.from, text: msg }),
    'send-order-confirm-failure',
    ctx.log,
  );
}
