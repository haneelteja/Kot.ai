import type { getServerClient } from '@alphabot/database';
import { createEasebuzzPaymentLink } from '../services/payment/easebuzz.js';
import { getCartSummary, clearCart } from './cart.js';
import { allocateOrderRef } from './order-ref.js';
import { getMenu } from './menu-cache.js';

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

export type WebOrderResult =
  | { ok: true; orderId: string; orderRef: string; totalPaise: number; linkUrl: string | null }
  | { ok: false; error: 'empty_order' | 'order_create_failed' };

/**
 * Creates a real orders + order_items + payments row set directly from the
 * public ordering page (no pre-existing cart/conversation). Mirrors
 * confirmOrderFromCart's guarantees exactly: every line is recomputed from
 * LIVE menu_items prices — the client-submitted menuItemId/quantity list is
 * never trusted for price or name, and any item that doesn't match an
 * active, in-stock menu row is silently dropped. A minimal `resolved`
 * conversation row is created purely to satisfy orders.conversation_id's
 * NOT NULL FK — no live chat is happening for a web order.
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

  const lines: Array<{ menuItemId: string; name: string; unitPricePaise: number; quantity: number; lineTotalPaise: number }> = [];
  for (const item of items) {
    const m = menuById.get(item.menuItemId);
    if (!m || !m.in_stock) continue;
    const qty = Math.max(1, Math.min(50, Math.floor(item.quantity)));
    if (!Number.isFinite(qty) || qty <= 0) continue;
    lines.push({ menuItemId: m.id, name: m.name, unitPricePaise: m.price_paise, quantity: qty, lineTotalPaise: m.price_paise * qty });
  }

  if (lines.length === 0) return { ok: false, error: 'empty_order' };

  const totalPaise = lines.reduce((s, l) => s + l.lineTotalPaise, 0);

  const contactUpsert: Record<string, unknown> = { tenant_id: tenantId, phone };
  if (name) contactUpsert['name'] = name;
  const { data: contact, error: contactError } = await db
    .from('contacts')
    .upsert(contactUpsert, { onConflict: 'tenant_id,phone' })
    .select('id')
    .single();
  if (contactError || !contact) return { ok: false, error: 'order_create_failed' };
  const contactId = (contact as { id: string }).id;

  // No live chat happening — create a minimal resolved conversation row
  // purely to satisfy orders' NOT NULL FKs with zero schema change.
  const { data: conv, error: convError } = await db
    .from('conversations')
    .insert({ tenant_id: tenantId, contact_id: contactId, product_type: 'restaurant_bot', status: 'resolved' })
    .select('id')
    .single();
  if (convError || !conv) return { ok: false, error: 'order_create_failed' };
  const conversationId = (conv as { id: string }).id;

  const orderRef = await allocateOrderRef(db, tenantId);
  const itemsJson = lines.map(l => ({ name: l.name, quantity: l.quantity, price: l.unitPricePaise / 100 }));

  const { data: order, error: orderError } = await db
    .from('orders')
    .insert({
      tenant_id:       tenantId,
      contact_id:      contactId,
      conversation_id: conversationId,
      items_json:      itemsJson,
      total:           totalPaise / 100,
      total_paise:     totalPaise,
      order_ref:       orderRef,
      source:          'weblink',
      status:          'pending',
    })
    .select('id')
    .single();

  if (orderError || !order) return { ok: false, error: 'order_create_failed' };
  const orderId = (order as { id: string }).id;

  await db.from('order_items').insert(
    lines.map(l => ({
      order_id:         orderId,
      menu_item_id:     l.menuItemId,
      name:             l.name,
      unit_price_paise: l.unitPricePaise,
      quantity:         l.quantity,
      line_total_paise: l.lineTotalPaise,
    })),
  );

  const { data: payment } = await db
    .from('payments')
    .insert({ order_id: orderId, status: 'pending' })
    .select('id')
    .single();

  let linkUrl: string | null = null;
  if (payment) {
    const result = await createEasebuzzPaymentLink({
      paymentId:    (payment as { id: string }).id,
      contactPhone: phone,
      contactName:  name,
      amountRupees: totalPaise / 100,
      description:  `Order ${orderRef}`,
    });
    if (result.success && result.linkUrl) {
      linkUrl = result.linkUrl;
      await db.from('payments')
        .update({ payment_ref: result.paymentRef, link_url: result.linkUrl })
        .eq('id', (payment as { id: string }).id);
    }
  }

  return { ok: true, orderId, orderRef, totalPaise, linkUrl };
}
