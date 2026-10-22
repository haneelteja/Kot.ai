import type { getServerClient } from '@alphabot/database';
import { createEasebuzzPaymentLink } from '../services/payment/easebuzz.js';
import { getCartSummary, clearCart } from './cart.js';
import { allocateOrderRef } from './order-ref.js';

type Db = ReturnType<typeof getServerClient>;

export type ConfirmOrderResult =
  | { ok: true; orderId: string; orderRef: string; totalPaise: number; linkUrl: string | null }
  | { ok: false; error: 'empty_cart' | 'order_create_failed' };

/**
 * Creates a real orders + order_items + payments row set from the customer's
 * current cart, with the total recomputed server-side from live menu prices
 * (never trusting anything the AI said), and generates a real Easebuzz
 * payment link via the same shared-platform integration the existing manual
 * order flow (routes/orders/index.ts POST /) already uses — same
 * `paymentId: payment.id` -> Easebuzz `txnid` convention the callback
 * handler depends on. Does not send any WhatsApp message itself; the caller
 * (the webhook's [CONFIRM_ORDER] handler) does that.
 */
export async function confirmOrderFromCart(
  db:             Db,
  tenantId:       string,
  contactId:      string,
  conversationId: string,
): Promise<ConfirmOrderResult> {
  const cart = await getCartSummary(db, tenantId, contactId);
  if (cart.items.length === 0) return { ok: false, error: 'empty_cart' };

  const orderRef = await allocateOrderRef(db, tenantId);

  // Denormalized items_json snapshot (rupees, matching the legacy OrderItem
  // shape {name,quantity,price,sku?}) so the existing dashboard rendering
  // path keeps working unmodified for these rows too.
  const itemsJson = cart.items.map(i => ({
    name: i.name, quantity: i.quantity, price: i.unitPricePaise / 100,
  }));

  const { data: order, error: orderError } = await db
    .from('orders')
    .insert({
      tenant_id:       tenantId,
      contact_id:      contactId,
      conversation_id: conversationId,
      items_json:      itemsJson,
      total:           cart.totalPaise / 100,
      total_paise:     cart.totalPaise,
      order_ref:       orderRef,
      source:          'whatsapp_bot',
      status:          'pending',
    })
    .select('id')
    .single();

  if (orderError || !order) return { ok: false, error: 'order_create_failed' };
  const orderId = (order as { id: string }).id;

  await db.from('order_items').insert(
    cart.items.map(i => ({
      order_id:         orderId,
      menu_item_id:     i.menuItemId,
      name:             i.name,
      unit_price_paise: i.unitPricePaise,
      quantity:         i.quantity,
      line_total_paise: i.lineTotalPaise,
    })),
  );

  const { data: payment } = await db
    .from('payments')
    .insert({ order_id: orderId, status: 'pending' })
    .select('id')
    .single();

  let linkUrl: string | null = null;
  if (payment) {
    const { data: contact } = await db
      .from('contacts')
      .select('phone, name')
      .eq('id', contactId)
      .single();

    if (contact?.phone) {
      const result = await createEasebuzzPaymentLink({
        paymentId:    (payment as { id: string }).id,
        contactPhone: contact.phone,
        contactName:  (contact as { name: string | null }).name,
        amountRupees: cart.totalPaise / 100,
        description:  `Order ${orderRef}`,
      });
      if (result.success && result.linkUrl) {
        linkUrl = result.linkUrl;
        await db.from('payments')
          .update({ payment_ref: result.paymentRef, link_url: result.linkUrl })
          .eq('id', (payment as { id: string }).id);
      }
    }
  }

  await clearCart(db, tenantId, contactId);

  return { ok: true, orderId, orderRef, totalPaise: cart.totalPaise, linkUrl };
}
