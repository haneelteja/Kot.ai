import type { FastifyBaseLogger } from 'fastify';
import type { IncomingWhatsAppMessage } from '@alphabot/shared';
import { WhatsAppGateway } from '../whatsapp/gateway.js';
import { getProductCatalogue } from '../../lib/product-cache.js';
import { fireForget } from '../../lib/fire-forget.js';

interface Ctx {
  gateway:  WhatsAppGateway;
  config:   { phone_number_id: string; access_token: string };
  incoming: IncomingWhatsAppMessage;
  tenantId: string;
  log:      FastifyBaseLogger;
}

/** Sends the formatted product catalogue — sales_bot only, when [SHOW_CATALOGUE] fires. */
export async function sendProductCatalogue(ctx: Ctx): Promise<void> {
  const catalogue = await getProductCatalogue(ctx.tenantId); // already in Redis
  if (catalogue.length === 0) return;

  const lines: string[] = ['📦 *Our Products*\n'];
  for (const p of catalogue) {
    lines.push(`*${p.name}*${p.sku ? ` (SKU: ${p.sku})` : ''}`);
    if (p.category)    lines.push(`🏷 ${p.category}`);
    if (p.description) lines.push(p.description);
    if (p.price_inr !== null) {
      lines.push(`💰 ₹${Number(p.price_inr).toLocaleString('en-IN')}`);
    }
    lines.push('');
  }
  lines.push('_Reply with a product name for details or to place an order._');

  fireForget(
    ctx.gateway.sendMessage(ctx.config.phone_number_id, ctx.config.access_token, {
      type: 'text',
      to:   ctx.incoming.from,
      text: lines.join('\n').trimEnd(),
    }),
    'send-catalogue-message',
    ctx.log,
  );
}
