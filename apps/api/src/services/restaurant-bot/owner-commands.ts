import type { FastifyBaseLogger } from 'fastify';
import type { getServerClient } from '@alphabot/database';
import type { IncomingWhatsAppMessage } from '@alphabot/shared';
import { WhatsAppGateway } from '../whatsapp/gateway.js';
import { invalidateMenuCache } from '../../lib/menu-cache.js';

type Db = ReturnType<typeof getServerClient>;

interface OwnerCommandContext {
  db:       Db;
  gateway:  WhatsAppGateway;
  config:   { phone_number_id: string; access_token: string };
  incoming: IncomingWhatsAppMessage;
  tenantId: string;
  log:      FastifyBaseLogger;
}

const HELP_TEXT = [
  '🤖 *Available commands*',
  '',
  '*sales today* — orders + revenue so far today',
  '*open orders* — orders still pending/confirmed/dispatched',
  '*OUT <dish name>* — mark a dish out of stock',
  '*BACK <dish name>* — mark a dish back in stock',
  '*PAUSE <minutes>* — temporarily stop taking new orders',
  '*RESUME* — start taking orders again',
].join('\n');

async function reply(ctx: OwnerCommandContext, text: string): Promise<void> {
  await ctx.gateway.sendMessage(ctx.config.phone_number_id, ctx.config.access_token, {
    type: 'text',
    to:   ctx.incoming.from,
    text,
  });
}

/**
 * OWN-03: a short text-command surface for the restaurant owner, over the
 * dedicated "ops" WhatsApp number (WAB-06). Deliberately scoped to commands
 * with an existing underlying action today — `sales today`/`open orders`
 * read existing data, `OUT`/`BACK` toggle MENU-02's existing `in_stock`
 * flag. PAUSE/RESUME drive `tenants.ordering_paused_until` — a single
 * tenant-wide flag, not BR-03's full per-branch pause model (BR-01's
 * branches table doesn't exist in this codebase), but equivalent for the
 * current single-location product.
 *
 * This never touches conversations/messages/contacts — the ops number is
 * an internal admin channel, not a customer conversation, so nothing here
 * creates the usual chat history rows.
 */
export async function handleOwnerCommand(ctx: OwnerCommandContext): Promise<void> {
  const text = (ctx.incoming.text ?? '').trim();
  if (!text) { await reply(ctx, HELP_TEXT); return; }

  const lower = text.toLowerCase();

  if (lower === 'sales today' || lower === 'sales') {
    await handleSalesToday(ctx);
    return;
  }

  if (lower === 'open orders' || lower === 'orders') {
    await handleOpenOrders(ctx);
    return;
  }

  const outMatch = text.match(/^out\s+(.+)$/i);
  if (outMatch) { await handleStockToggle(ctx, outMatch[1]!.trim(), false); return; }

  const backMatch = text.match(/^back\s+(.+)$/i);
  if (backMatch) { await handleStockToggle(ctx, backMatch[1]!.trim(), true); return; }

  const pauseMatch = text.match(/^pause\s+(\d+)$/i);
  if (pauseMatch) { await handlePause(ctx, Number(pauseMatch[1])); return; }

  if (lower === 'resume') { await handleResume(ctx); return; }

  await reply(ctx, HELP_TEXT);
}

async function handlePause(ctx: OwnerCommandContext, minutes: number): Promise<void> {
  if (!Number.isFinite(minutes) || minutes <= 0) {
    await reply(ctx, 'Usage: *PAUSE <minutes>*, e.g. "PAUSE 30"');
    return;
  }
  const pausedUntil = new Date(Date.now() + minutes * 60_000);
  await ctx.db.from('tenants').update({ ordering_paused_until: pausedUntil.toISOString() }).eq('id', ctx.tenantId);
  await reply(ctx, `⏸️ Orders paused for ${minutes} minute${minutes === 1 ? '' : 's'}. Send *RESUME* to start taking orders again before then.`);
}

async function handleResume(ctx: OwnerCommandContext): Promise<void> {
  await ctx.db.from('tenants').update({ ordering_paused_until: null }).eq('id', ctx.tenantId);
  await reply(ctx, '▶️ Orders resumed.');
}

async function handleSalesToday(ctx: OwnerCommandContext): Promise<void> {
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const { data: orders } = await ctx.db
    .from('orders')
    .select('total_paise')
    .eq('tenant_id', ctx.tenantId)
    .in('source', ['whatsapp_bot', 'weblink'])
    .gte('created_at', todayStart.toISOString());

  const rows = orders ?? [];
  const totalPaise = rows.reduce((sum, o) => sum + ((o as { total_paise: number | null }).total_paise ?? 0), 0);

  await reply(ctx, `📊 *Sales today*\n${rows.length} orders · ₹${(totalPaise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`);
}

async function handleOpenOrders(ctx: OwnerCommandContext): Promise<void> {
  const { data: orders } = await ctx.db
    .from('orders')
    .select('order_ref, total_paise, status')
    .eq('tenant_id', ctx.tenantId)
    .in('source', ['whatsapp_bot', 'weblink'])
    .in('status', ['pending', 'confirmed', 'dispatched'])
    .order('created_at', { ascending: true })
    .limit(15);

  const rows = orders ?? [];
  if (rows.length === 0) { await reply(ctx, '✅ No open orders right now.'); return; }

  const lines = rows.map(o =>
    `• ${o.order_ref ?? '(no ref)'} — ₹${((o.total_paise ?? 0) / 100).toFixed(0)} — ${o.status}`
  );
  await reply(ctx, `📋 *Open orders (${rows.length})*\n${lines.join('\n')}`);
}

async function handleStockToggle(ctx: OwnerCommandContext, dishQuery: string, inStock: boolean): Promise<void> {
  const { data: matches } = await ctx.db
    .from('menu_items')
    .select('id, name, in_stock')
    .eq('tenant_id', ctx.tenantId)
    .eq('active', true)
    .ilike('name', `%${dishQuery}%`);

  const rows = matches ?? [];
  if (rows.length === 0) {
    await reply(ctx, `Couldn't find a dish matching "${dishQuery}" on the menu.`);
    return;
  }
  if (rows.length > 1) {
    const names = rows.map(r => `• ${r.name}`).join('\n');
    await reply(ctx, `Found more than one match for "${dishQuery}" — be more specific:\n${names}`);
    return;
  }

  const item = rows[0]!;
  if (item.in_stock === inStock) {
    await reply(ctx, `${item.name} is already ${inStock ? 'back in stock' : 'marked out of stock'}.`);
    return;
  }

  await ctx.db.from('menu_items').update({ in_stock: inStock }).eq('id', item.id);
  await invalidateMenuCache(ctx.tenantId);

  const confirmation = inStock
    ? `✅ ${item.name} is back in stock.`
    : `🚫 ${item.name} is now OUT. Send "BACK ${item.name}" to restore it.`;
  await reply(ctx, confirmation);
}
