import type { FastifyInstance } from 'fastify';
import { getServerClient } from '@alphabot/database';
import {
  createEasebuzzPaymentLink,
  verifyEasebuzzCallback,
} from '../../services/payment/easebuzz.js';
import { WhatsAppGateway } from '../../services/whatsapp/gateway.js';
import { generateAndSendInvoice } from '../../services/invoice/generator.js';
import type { WhatsAppProvider } from '@alphabot/shared';
import { requireAuth, requireScope } from '../../middleware/auth.js';
import { dispatchWebhook } from '../../lib/dispatch-webhook.js';

type Db = ReturnType<typeof getServerClient>;

/**
 * Resolves which WhatsApp number to send an order-related message from.
 * Prefers a number configured for the given product slug (e.g. the bot that
 * actually created the order), falling back to any active number for the
 * tenant — a tenant may only have a restaurant_bot number and no
 * lifecycle_bot number (or vice versa), and nothing stops a tenant running
 * both bot types at once.
 */
async function resolveOrderWhatsAppNumber(
  db: Db, tenantId: string, preferredSlug: string,
): Promise<{ config_json: Record<string, unknown>; provider: string } | null> {
  const { data: preferred } = await db
    .from('whatsapp_numbers')
    .select('config_json, provider')
    .eq('tenant_id', tenantId)
    .eq('product_slug', preferredSlug)
    .eq('active', true)
    .maybeSingle();
  if (preferred) return preferred as { config_json: Record<string, unknown>; provider: string };

  const { data: fallback } = await db
    .from('whatsapp_numbers')
    .select('config_json, provider')
    .eq('tenant_id', tenantId)
    .eq('active', true)
    .limit(1)
    .maybeSingle();
  return fallback as { config_json: Record<string, unknown>; provider: string } | null;
}

type OrderStatus = 'pending' | 'confirmed' | 'dispatched' | 'delivered' | 'cancelled';

// Moved here from apps/web/src/app/actions/orders.ts — that copy wrote
// straight to Supabase and duplicated resolveOrderWhatsAppNumber's fallback
// logic with its own hardcoded variant. Consolidating here means the
// dashboard's status-update button (now calling PATCH /:id/status instead of
// writing the DB directly) gets this notification AND the order.status_changed
// webhook dispatch from one place, instead of two code paths drifting apart.
const STATUS_MESSAGES: Partial<Record<OrderStatus, (name: string, shortId: string, itemsSummary: string, total: number) => string>> = {
  confirmed: (name, shortId, summary, total) =>
    `✅ *Order Confirmed!*\n\nHi ${name}! Your order #${shortId} has been confirmed and is being prepared.\n\n📦 ${summary}\n💰 Total: ₹${total.toFixed(2)}\n\nWe'll notify you when it's dispatched. 🙏`,
  dispatched: (name, shortId, summary) =>
    `🚚 *Your Order Is On Its Way!*\n\nHi ${name}! Your order #${shortId} has been dispatched.\n\n📦 ${summary}\n\nExpected delivery in 2–3 business days. We'll notify you once it arrives! 📬`,
  delivered: (name, shortId) =>
    `📦 *Order Delivered!*\n\nHi ${name}! Your order #${shortId} has been delivered. 🎉\n\nThank you for choosing us! If you have any questions, just reply to this message.`,
  cancelled: (name, shortId) =>
    `❌ *Order Cancelled*\n\nHi ${name}. Your order #${shortId} has been cancelled. If this was unexpected or you need help, please reply to this message.`,
};

async function sendOrderStatusWhatsApp(db: Db, orderId: string, status: OrderStatus): Promise<void> {
  const buildFn = STATUS_MESSAGES[status];
  if (!buildFn) return;

  const { data: order } = await db
    .from('orders')
    .select('tenant_id, total, items_json, source, contact:contacts(phone, name)')
    .eq('id', orderId)
    .single();
  if (!order) return;

  const contact = (order as unknown as { contact: { phone: string | null; name: string | null } | null }).contact;
  if (!contact?.phone) return;

  const preferredSlug = (order as unknown as { source?: string }).source === 'whatsapp_bot' ? 'restaurant_bot' : 'lifecycle_bot';
  const wn = await resolveOrderWhatsAppNumber(db, (order as { tenant_id: string }).tenant_id, preferredSlug);
  if (!wn) return;

  const shortId      = orderId.slice(0, 8).toUpperCase();
  const items         = ((order as { items_json: Array<{ name: string; quantity: number }> }).items_json) ?? [];
  const itemsSummary  = items.slice(0, 3).map(i => `${i.name} ×${i.quantity}`).join(', ')
    + (items.length > 3 ? ` +${items.length - 3} more` : '');
  const contactName  = contact.name?.split(' ')[0] ?? 'there';
  const total         = Number((order as { total: number }).total);

  const text    = buildFn(contactName, shortId, itemsSummary, total);
  const config  = wn.config_json as { phone_number_id: string; access_token: string };
  const gateway = new WhatsAppGateway(wn.provider as WhatsAppProvider);
  await gateway.sendMessage(config.phone_number_id, config.access_token, { type: 'text', to: contact.phone, text });
}

export async function orderRoutes(fastify: FastifyInstance): Promise<void> {
  const db = getServerClient();

  fastify.addHook('preHandler', requireAuth);

  // ─── POST /api/orders — create order + generate payment link ────────────
  fastify.post<{ Body: {
    contactId:      string;
    conversationId: string;
    items:          Array<{ name: string; quantity: number; price: number; sku?: string }>;
    total:          number;
    sendLink?:      boolean;
    provider?:      'easebuzz';
  } }>('/', { preHandler: requireScope('orders:write') }, async (request, reply) => {
    const tenantId = request.tenantId;
    const { contactId, conversationId, items, total, sendLink = true, provider = 'easebuzz' } = request.body;

    if (!contactId || !conversationId || !items?.length || !total) {
      return reply.status(400).send({ error: 'Missing required fields' });
    }

    // Create order
    const { data: order, error: orderError } = await db
      .from('orders')
      .insert({ tenant_id: tenantId, contact_id: contactId, conversation_id: conversationId, items_json: items, total, status: 'pending' })
      .select()
      .single();

    if (orderError || !order) {
      fastify.log.error({ orderError }, '[Orders] Failed to create order');
      return reply.status(500).send({ error: 'Failed to create order' });
    }

    // Create pending payment row
    const { data: payment, error: paymentError } = await db
      .from('payments')
      .insert({ order_id: order.id, status: 'pending' })
      .select()
      .single();

    if (paymentError || !payment) {
      fastify.log.error({ paymentError }, '[Orders] Failed to create payment record');
      return reply.status(500).send({ error: 'Failed to create payment record' });
    }

    // Fetch contact
    const { data: contact } = await db
      .from('contacts')
      .select('phone, name')
      .eq('id', contactId)
      .single();

    if (!contact?.phone) {
      return reply.status(201).send({ order, payment, linkUrl: null });
    }

    // Generate payment link via selected provider
    let linkUrl: string | null = null;
    let paymentRef: string | null = null;
    let providerError: string | undefined;

    if (provider === 'easebuzz') {
      const result = await createEasebuzzPaymentLink({
        paymentId:    payment.id,
        contactPhone: contact.phone,
        contactName:  contact.name ?? null,
        amountRupees: total,
        description:  `Order #${order.id.slice(0, 8)}`,
      });
      if (result.success && result.linkUrl) {
        linkUrl    = result.linkUrl;
        paymentRef = result.paymentRef ?? null;
      } else {
        providerError = result.error;
      }
    }

    if (linkUrl) {
      await db.from('payments')
        .update({ payment_ref: paymentRef, link_url: linkUrl })
        .eq('id', payment.id);

      // Send link via WhatsApp
      if (sendLink) {
        const wn = await resolveOrderWhatsAppNumber(db, tenantId, 'lifecycle_bot');

        if (wn) {
          const config  = wn.config_json as { phone_number_id: string; access_token: string };
          const gateway = new WhatsAppGateway(wn.provider as WhatsAppProvider);
          const itemsSummary = items.map(i => `${i.name} ×${i.quantity}`).join(', ');

          await gateway.sendMessage(config.phone_number_id, config.access_token, {
            type: 'text',
            to:   contact.phone,
            text: `🧾 *Order Confirmed!*\n\nItems: ${itemsSummary}\nTotal: ₹${total.toFixed(2)}\n\n💳 Pay securely:\n${linkUrl}`,
          });
        }
      }

      return reply.status(201).send({ order, payment: { ...payment, link_url: linkUrl }, linkUrl });
    }

    fastify.log.warn({ error: providerError, provider }, '[Orders] Payment link generation failed');
    return reply.status(201).send({ order, payment, linkUrl: null, providerError });
  });

  // ─── GET /api/orders — list orders for a tenant ──────────────────────────
  fastify.get<{ Querystring: { limit?: string; offset?: string } }>('/', async (request, reply) => {
    const tenantId = request.tenantId;
    const { limit = '50', offset = '0' } = request.query;

    const { data: orders, error } = await db
      .from('orders')
      .select(`*, contact:contacts(phone, name), payments(id, status, link_url, payment_ref, created_at)`)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (error) return reply.status(500).send({ error: error.message });
    return reply.send({ orders: orders ?? [] });
  });

  // ─── GET /api/orders/:id ──────────────────────────────────────────────────
  fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const { data: order, error } = await db
      .from('orders')
      .select(`*, contact:contacts(phone, name), payments(*)`)
      .eq('id', request.params.id)
      .eq('tenant_id', request.tenantId)
      .single();

    if (error || !order) return reply.status(404).send({ error: 'Order not found' });
    return reply.send({ order });
  });

  // ─── PATCH /api/orders/:id/status ────────────────────────────────────────
  fastify.patch<{ Params: { id: string }; Body: { status: string } }>('/:id/status', { preHandler: requireScope('orders:write') }, async (request, reply) => {
    const valid = ['pending', 'confirmed', 'dispatched', 'delivered', 'cancelled'];
    if (!valid.includes(request.body.status)) return reply.status(400).send({ error: 'Invalid status' });

    const { data, error } = await db
      .from('orders')
      .update({ status: request.body.status, updated_at: new Date().toISOString() })
      .eq('id', request.params.id)
      .eq('tenant_id', request.tenantId)
      .select()
      .single();

    if (error) return reply.status(500).send({ error: error.message });

    dispatchWebhook(request.tenantId, 'order.status_changed', { orderId: request.params.id, status: request.body.status });
    void sendOrderStatusWhatsApp(db, request.params.id, request.body.status as OrderStatus).catch(err =>
      fastify.log.error({ err }, '[Orders] status WhatsApp notification failed'),
    );

    return reply.send({ order: data });
  });

  // ─── POST /api/orders/:id/resend-link ────────────────────────────────────
  fastify.post<{ Params: { id: string } }>('/:id/resend-link', async (request, reply) => {
    const { data: order } = await db
      .from('orders')
      .select(`tenant_id, total, source, contact:contacts(phone), payments(link_url, status)`)
      .eq('id', request.params.id)
      .eq('tenant_id', request.tenantId)
      .single();

    if (!order) return reply.status(404).send({ error: 'Order not found' });

    const payment = (order as unknown as { payments: Array<{ link_url: string | null; status: string }> }).payments?.[0];
    const contact = (order as unknown as { contact: { phone: string } }).contact;

    if (!payment?.link_url || !contact?.phone) {
      return reply.status(400).send({ error: 'No payment link available' });
    }

    const preferredSlug = (order as unknown as { source?: string }).source === 'whatsapp_bot' ? 'restaurant_bot' : 'lifecycle_bot';
    const wn = await resolveOrderWhatsAppNumber(db, (order as { tenant_id: string }).tenant_id, preferredSlug);

    if (wn) {
      const config  = wn.config_json as { phone_number_id: string; access_token: string };
      const gateway = new WhatsAppGateway(wn.provider as WhatsAppProvider);
      await gateway.sendMessage(config.phone_number_id, config.access_token, {
        type: 'text',
        to:   contact.phone,
        text: `🔔 *Payment Reminder*\n\nYour payment of ₹${(order as { total: number }).total.toFixed(2)} is pending:\n\n${payment.link_url}`,
      });
    }

    return reply.send({ sent: true });
  });

  // ─── POST /api/orders/:id/invoice ────────────────────────────────────────
  fastify.post<{ Params: { id: string } }>('/:id/invoice', async (request, reply) => {
    const { data: order } = await db
      .from('orders')
      .select(`
        id, total, items_json, status,
        tenant:tenants(name),
        contact:contacts(phone, name),
        payments(status, link_url)
      `)
      .eq('id', request.params.id)
      .eq('tenant_id', request.tenantId)
      .single();

    if (!order) return reply.status(404).send({ error: 'Order not found' });

    const contact       = (order as unknown as { contact: { phone: string; name: string | null } }).contact;
    const tenant        = (order as unknown as { tenant: { name: string } }).tenant;
    const payment       = (order as unknown as { payments: Array<{ status: string; link_url: string | null }> }).payments?.[0];
    const items         = ((order as unknown as { items_json: Array<{ name: string; quantity: number; price: number; sku?: string }> }).items_json) ?? [];

    if (!contact?.phone) return reply.status(400).send({ error: 'No contact phone number' });

    try {
      const result = await generateAndSendInvoice({
        tenantId:      request.tenantId,
        tenantName:    tenant?.name ?? 'Business',
        orderId:       order.id,
        orderTotal:    Number((order as unknown as { total: number }).total),
        items,
        contactName:   contact.name,
        contactPhone:  contact.phone,
        paymentStatus: payment?.status ?? 'pending',
        paymentLink:   payment?.link_url,
      });

      return reply.send(result);
    } catch (err) {
      fastify.log.error({ err }, '[Invoice] Generation failed');
      return reply.status(500).send({ error: (err as Error).message });
    }
  });
}

// ─── Easebuzz callback (surl + furl) ─────────────────────────────────────────
export async function easebuzzCallbackRoute(fastify: FastifyInstance): Promise<void> {
  const db = getServerClient();

  fastify.post('/easebuzz/callback', async (request, reply) => {
    reply.status(200).send('');

    const body = request.body as Record<string, string>;

    if (!verifyEasebuzzCallback(body)) {
      fastify.log.warn({ txnid: body['txnid'] }, '[Easebuzz] Callback hash verification failed');
      return;
    }

    const txnid  = body['txnid']  ?? '';
    const status = body['status'] ?? '';

    fastify.log.info({ txnid, status }, '[Easebuzz] Callback received');

    if (status === 'success') {
      const { data: payment } = await db
        .from('payments')
        .update({ status: 'paid', webhook_received_at: new Date().toISOString() })
        .eq('id', txnid)
        .select('order_id')
        .single();

      if (!payment) return;

      await db.from('orders')
        .update({ status: 'confirmed', updated_at: new Date().toISOString() })
        .eq('id', payment.order_id);

      const { data: order } = await db
        .from('orders')
        .select('tenant_id, total, total_paise, order_ref, source, contact:contacts(phone)')
        .eq('id', payment.order_id)
        .single();

      if (order) {
        const tenantId   = (order as unknown as { tenant_id: string }).tenant_id;
        const contact    = (order as unknown as { contact: { phone: string } }).contact;
        const orderRow   = order as unknown as { total: number; total_paise: number | null; order_ref: string | null; source?: string };
        const isRestaurantOrder = orderRow.source === 'whatsapp_bot';
        const amountDisplay = orderRow.total_paise != null ? (orderRow.total_paise / 100) : orderRow.total;

        dispatchWebhook(tenantId, 'order.paid', { orderId: payment.order_id, orderRef: orderRow.order_ref, totalPaise: orderRow.total_paise ?? Math.round(orderRow.total * 100) });

        const wn = await resolveOrderWhatsAppNumber(db, tenantId, isRestaurantOrder ? 'restaurant_bot' : 'lifecycle_bot');

        const confirmText = isRestaurantOrder
          ? `✅ *Payment Received!*\n\nYour order ${orderRow.order_ref ?? ''} is confirmed and being prepared. Total: ₹${amountDisplay.toFixed(2)}.\n\nWe'll keep you updated! 🎉`
          : `✅ *Payment Received!*\n\nThank you! Your payment of ₹${amountDisplay.toFixed(2)} is confirmed.\n\nYour order is being processed. We'll keep you updated! 🎉`;

        if (wn && contact?.phone) {
          const config  = wn.config_json as { phone_number_id: string; access_token: string };
          const gateway = new WhatsAppGateway(wn.provider as WhatsAppProvider);
          await gateway.sendMessage(config.phone_number_id, config.access_token, {
            type: 'text',
            to:   contact.phone,
            text: confirmText,
          });
        }
      }
    }

    if (status === 'failure' || status === 'userCancelled') {
      await db.from('payments')
        .update({ status: 'failed', webhook_received_at: new Date().toISOString() })
        .eq('id', txnid);
    }
  });
}

