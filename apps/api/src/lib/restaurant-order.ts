import type { getServerClient } from '@alphabot/database';
import { createEasebuzzPaymentLink } from '../services/payment/easebuzz.js';
import { getCartSummary, clearCart } from './cart.js';
import { getMenu } from './menu-cache.js';
import { createCheckoutDraft, attachDraftPaymentLink, type DraftLineItem } from './checkout-draft.js';
import { calculateBill, checkOrderValue, getTenantBillingConfig, type BillBreakdown } from './bill-calculator.js';

type Db = ReturnType<typeof getServerClient>;

export type ConfirmOrderResult =
  | { ok: true; draftId: string; totalPaise: number; bill: BillBreakdown; linkUrl: string | null }
  | { ok: false; error: 'empty_cart' | 'draft_create_failed' }
  | { ok: false; error: 'below_minimum' | 'above_maximum'; limitPaise: number };

/**
 * ORD-02 (revised): creates a checkout draft — NOT an order — from the
 * customer's current cart, with the total recomputed server-side from live
 * menu prices (never trusting anything the AI said), and generates a real
 * Easebuzz payment link against the draft's id. The order itself is only
 * created once Easebuzz confirms payment (see lib/checkout-draft.ts's
 * convertDraftToOrder, called from the webhook callback) — until then,
 * nothing exists in `orders` for this checkout at all. Does not send any
 * WhatsApp message itself; the caller (the webhook's [CONFIRM_ORDER]
 * handler) does that.
 */
export async function confirmOrderFromCart(
  db:             Db,
  tenantId:       string,
  contactId:      string,
  conversationId: string,
): Promise<ConfirmOrderResult> {
  const cart = await getCartSummary(db, tenantId, contactId);
  if (cart.items.length === 0) return { ok: false, error: 'empty_cart' };

  const items: DraftLineItem[] = cart.items.map(i => ({
    menuItemId: i.menuItemId, name: i.name, unitPricePaise: i.unitPricePaise,
    quantity: i.quantity, lineTotalPaise: i.lineTotalPaise,
  }));

  const billingConfig = await getTenantBillingConfig(db, tenantId);
  const valueCheck = checkOrderValue(cart.totalPaise, billingConfig);
  if (!valueCheck.ok) return { ok: false, error: valueCheck.reason, limitPaise: valueCheck.limitPaise };

  const bill = calculateBill(cart.totalPaise, billingConfig);

  const draft = await createCheckoutDraft(db, tenantId, contactId, conversationId, 'whatsapp_bot', items, bill);
  if (!draft) return { ok: false, error: 'draft_create_failed' };

  let linkUrl: string | null = null;
  const { data: contact } = await db.from('contacts').select('phone, name').eq('id', contactId).single();
  if (contact?.phone) {
    const result = await createEasebuzzPaymentLink({
      paymentId:    draft.id, // Easebuzz txnid — the draft's id until conversion, matching the callback's lookup
      contactPhone: contact.phone,
      contactName:  (contact as { name: string | null }).name,
      amountRupees: bill.totalPaise / 100,
      description:  'Restaurant order',
    });
    if (result.success && result.linkUrl) {
      linkUrl = result.linkUrl;
      await attachDraftPaymentLink(db, draft.id, result.linkUrl);
    }
  }

  await clearCart(db, tenantId, contactId);

  return { ok: true, draftId: draft.id, totalPaise: bill.totalPaise, bill, linkUrl };
}

export type WebOrderResult =
  | { ok: true; draftId: string; totalPaise: number; bill: BillBreakdown; linkUrl: string | null }
  | { ok: false; error: 'empty_order' | 'draft_create_failed' }
  | { ok: false; error: 'below_minimum' | 'above_maximum'; limitPaise: number };

/**
 * ORD-02 (revised): same draft-first model as confirmOrderFromCart, but for
 * the public web ordering page (no pre-existing cart/conversation). Every
 * line is recomputed from LIVE menu_items prices — the client-submitted
 * menuItemId/quantity list is never trusted for price or name, and any item
 * that doesn't match an active, in-stock menu row is silently dropped. A
 * minimal `resolved` conversation row is created purely to satisfy the
 * eventual orders.conversation_id NOT NULL FK — no live chat is happening
 * for a web order.
 */
export async function createWebOrder(
  db:       Db,
  tenantId: string,
  phone:    string,
  name:     string | null,
  items:    Array<{ menuItemId: string; quantity: number }>,
): Promise<WebOrderResult> {
  const menu     = await getMenu(tenantId);
  const menuById = new Map(menu.map(m => [m.id, m]));

  const lines: DraftLineItem[] = [];
  for (const item of items) {
    const m = menuById.get(item.menuItemId);
    if (!m || !m.in_stock) continue;
    const qty = Math.max(1, Math.min(50, Math.floor(item.quantity)));
    if (!Number.isFinite(qty) || qty <= 0) continue;
    lines.push({ menuItemId: m.id, name: m.name, unitPricePaise: m.price_paise, quantity: qty, lineTotalPaise: m.price_paise * qty });
  }

  if (lines.length === 0) return { ok: false, error: 'empty_order' };

  const subtotalPaise = lines.reduce((s, l) => s + l.lineTotalPaise, 0);
  const billingConfig = await getTenantBillingConfig(db, tenantId);
  const valueCheck = checkOrderValue(subtotalPaise, billingConfig);
  if (!valueCheck.ok) return { ok: false, error: valueCheck.reason, limitPaise: valueCheck.limitPaise };

  const bill = calculateBill(subtotalPaise, billingConfig);

  const contactUpsert: Record<string, unknown> = { tenant_id: tenantId, phone };
  if (name) contactUpsert['name'] = name;
  const { data: contact, error: contactError } = await db
    .from('contacts')
    .upsert(contactUpsert, { onConflict: 'tenant_id,phone' })
    .select('id')
    .single();
  if (contactError || !contact) return { ok: false, error: 'draft_create_failed' };
  const contactId = (contact as { id: string }).id;

  const { data: conv, error: convError } = await db
    .from('conversations')
    .insert({ tenant_id: tenantId, contact_id: contactId, product_type: 'restaurant_bot', status: 'resolved' })
    .select('id')
    .single();
  if (convError || !conv) return { ok: false, error: 'draft_create_failed' };
  const conversationId = (conv as { id: string }).id;

  const draft = await createCheckoutDraft(db, tenantId, contactId, conversationId, 'weblink', lines, bill);
  if (!draft) return { ok: false, error: 'draft_create_failed' };

  let linkUrl: string | null = null;
  const result = await createEasebuzzPaymentLink({
    paymentId:    draft.id,
    contactPhone: phone,
    contactName:  name,
    amountRupees: bill.totalPaise / 100,
    description:  'Restaurant order',
  });
  if (result.success && result.linkUrl) {
    linkUrl = result.linkUrl;
    await attachDraftPaymentLink(db, draft.id, result.linkUrl);
  }

  return { ok: true, draftId: draft.id, totalPaise: bill.totalPaise, bill, linkUrl };
}

export type CreateOrderFeedbackResult =
  | { ok: true; rating: number }
  | { ok: false; error: 'invalid_rating' | 'already_submitted' | 'create_failed' };

/** ORD-07: records the customer's reply to the post-pickup feedback prompt — parity with lib/booking.ts's createBookingFeedback. */
export async function createOrderFeedback(
  db:        Db,
  tenantId:  string,
  orderId:   string,
  contactId: string,
  rating:    number,
): Promise<CreateOrderFeedbackResult> {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { ok: false, error: 'invalid_rating' };
  }

  const { error } = await db
    .from('order_feedback')
    .insert({ tenant_id: tenantId, order_id: orderId, contact_id: contactId, rating });

  if (error) {
    return error.code === '23505'
      ? { ok: false, error: 'already_submitted' }
      : { ok: false, error: 'create_failed' };
  }

  return { ok: true, rating };
}
