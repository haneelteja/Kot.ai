import type { FastifyInstance } from 'fastify';
import { getServerClient } from '@alphabot/database';
import { getMenu } from '../../lib/menu-cache.js';
import { createWebOrder } from '../../lib/restaurant-order.js';
import { getTenantBillingConfig } from '../../lib/bill-calculator.js';

const PHONE_RE = /^\+?[0-9]{8,15}$/;
const MAX_LINES = 50;
const MAX_QTY   = 20;

/**
 * Unauthenticated public routes backing the new web ordering page
 * (apps/web/src/app/o/[tenant]). The POST endpoint can mint real Easebuzz
 * payment links, so it carries tighter, phone-keyed rate limiting on top of
 * the server-wide default, plus input validation and an abuse-triage log
 * line on every call — see the plan's "highest risk" note.
 */
export async function publicOrderRoutes(fastify: FastifyInstance): Promise<void> {
  const db = getServerClient();

  fastify.get<{ Params: { tenantId: string } }>('/menu/:tenantId', async (request, reply) => {
    const { tenantId } = request.params;
    if (!/^[0-9a-f-]{36}$/i.test(tenantId)) {
      return reply.status(400).send({ error: 'Invalid tenant id' });
    }
    const [menu, billing] = await Promise.all([
      getMenu(tenantId),
      getTenantBillingConfig(db, tenantId),
    ]);
    return reply.send({ menu, billing });
  });

  fastify.post<{
    Body: {
      tenantId: string;
      phone:    string;
      name?:    string;
      items:    Array<{ menuItemId: string; quantity: number }>;
    };
  }>('/', {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: '1 minute',
        keyGenerator: (request) => {
          const body = request.body as { tenantId?: string; phone?: string } | undefined;
          return `rl:public-order:${body?.tenantId ?? 'unknown'}:${body?.phone ?? request.ip}`;
        },
      },
    },
  }, async (request, reply) => {
    const { tenantId, phone, name, items } = request.body ?? {};

    if (!tenantId || !/^[0-9a-f-]{36}$/i.test(tenantId)) {
      return reply.status(400).send({ error: 'Invalid tenant id' });
    }
    if (!phone || !PHONE_RE.test(phone.trim())) {
      return reply.status(400).send({ error: 'Invalid phone number' });
    }
    if (!Array.isArray(items) || items.length === 0 || items.length > MAX_LINES) {
      return reply.status(400).send({ error: 'Invalid items' });
    }
    const normalisedItems = items
      .filter(i => typeof i?.menuItemId === 'string' && Number.isFinite(i?.quantity))
      .map(i => ({ menuItemId: i.menuItemId, quantity: Math.min(MAX_QTY, Math.max(1, Math.floor(i.quantity))) }));
    if (normalisedItems.length === 0) {
      return reply.status(400).send({ error: 'Invalid items' });
    }

    fastify.log.info(
      { tenantId, phone, ip: request.ip, itemCount: normalisedItems.length },
      '[PublicOrders] order attempt',
    );

    // ORD-02 (revised): this creates a checkout draft, not an order — the
    // order itself is only created once Easebuzz confirms payment.
    const result = await createWebOrder(db, tenantId, phone.trim(), name?.trim() || null, normalisedItems);

    if (!result.ok) {
      if (result.error === 'below_minimum' || result.error === 'above_maximum') {
        const message = result.error === 'below_minimum'
          ? `The minimum order value is ₹${(result.limitPaise / 100).toFixed(2)}.`
          : `This order exceeds the maximum order value of ₹${(result.limitPaise / 100).toFixed(2)}.`;
        return reply.status(400).send({ error: message });
      }
      const status = result.error === 'empty_order' ? 400 : 500;
      const message = result.error === 'empty_order'
        ? 'None of the selected items are currently available'
        : 'Could not set up payment for this order — please try again';
      return reply.status(status).send({ error: message });
    }

    return reply.send({
      draftId:    result.draftId,
      totalPaise: result.totalPaise,
      bill:       result.bill,
      linkUrl:    result.linkUrl,
    });
  });
}
