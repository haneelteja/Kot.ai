import type { FastifyBaseLogger } from 'fastify';
import type { getServerClient } from '@alphabot/database';
import type { BotConfig, Conversation, IncomingWhatsAppMessage, Product } from '@alphabot/shared';
import { WhatsAppGateway } from '../whatsapp/gateway.js';
import { getMenu } from '../../lib/menu-cache.js';
import { createBooking } from '../../lib/booking.js';
import { notifyStaffOfBooking } from '../booking/notify.js';
import { dispatchWebhook } from '../../lib/dispatch-webhook.js';
import { fireForget } from '../../lib/fire-forget.js';

type Db = ReturnType<typeof getServerClient>;

interface ButtonTapContext {
  db:           Db;
  gateway:      WhatsAppGateway;
  config:       { phone_number_id: string; access_token: string };
  incoming:     IncomingWhatsAppMessage;
  conversation: Conversation;
  tenantId:     string;
  botConfig:    (BotConfig & { product: Product | null }) | null;
  log:          FastifyBaseLogger;
}

/**
 * Deterministic (no-LLM) routing for the three main-menu button taps —
 * view_menu / reserve_table / order_food — same fast-path philosophy as
 * matchAutoReply. Returns true when the tap was handled (caller should
 * release the processing lock and return without calling the AI).
 */
export async function handleRestaurantButtonTap(ctx: ButtonTapContext): Promise<boolean> {
  const { db, gateway, config, incoming, conversation, tenantId, botConfig, log } = ctx;
  const tappedId = incoming.interactiveReplyId;

  if (tappedId === 'view_menu') {
    const menu = await getMenu(tenantId);
    const menuText = menu.length > 0
      ? menu.map(m =>
          `• ${m.name}${m.is_veg ? ' 🟢' : ' 🔴'} — ₹${(m.price_paise / 100).toFixed(2)}` +
          `${m.category_name ? ` (${m.category_name})` : ''}${!m.in_stock ? ' [OUT OF STOCK]' : ''}`
        ).join('\n')
      : "Sorry, the menu isn't available right now.";
    const text = `🍽️ *Our Menu*\n\n${menuText}\n\n_Tell me what you'd like and I'll add it to your order!_`;
    await db.from('messages').insert({ conversation_id: conversation.id, role: 'assistant', content: text });
    await gateway.sendMessage(config.phone_number_id, config.access_token, { type: 'text', to: incoming.from, text });
    fireForget(db.from('conversations').update({ processing_lock_expires_at: null }).eq('id', conversation.id), 'release-lock-view-menu', log);
    return true;
  }

  if (tappedId === 'reserve_table') {
    const text = "Great! I'd love to set that up for you. How many people will be dining? 🍽️";
    await db.from('messages').insert({ conversation_id: conversation.id, role: 'assistant', content: text });
    await gateway.sendMessage(config.phone_number_id, config.access_token, { type: 'text', to: incoming.from, text });
    fireForget(db.from('conversations').update({ processing_lock_expires_at: null }).eq('id', conversation.id), 'release-lock-reserve-table', log);
    return true;
  }

  if (tappedId === 'order_food') {
    if (botConfig?.order_mode === 'weblink') {
      const webBaseUrl = process.env['WEB_BASE_URL'] ?? 'https://whats-app-agent-web.vercel.app';
      const text = 'Here you go — order online 🍽️';
      await db.from('messages').insert({ conversation_id: conversation.id, role: 'assistant', content: text });
      await gateway.sendMessage(config.phone_number_id, config.access_token, {
        type:            'interactive',
        interactiveType: 'cta_url',
        to:              incoming.from,
        body:            text,
        ctaButtonText:   'Order now',
        ctaUrl:          `${webBaseUrl}/o/${tenantId}`,
      });
    } else {
      const text = "Awesome! Here's our menu — just tell me what you'd like and I'll add it to your order 🍽️";
      await db.from('messages').insert({ conversation_id: conversation.id, role: 'assistant', content: text });
      await gateway.sendMessage(config.phone_number_id, config.access_token, { type: 'text', to: incoming.from, text });
    }
    fireForget(db.from('conversations').update({ processing_lock_expires_at: null }).eq('id', conversation.id), 'release-lock-order-food', log);
    return true;
  }

  return false;
}

/** System-prompt block for the table-reservation [ENTITY:]/[CONFIRM_BOOKING] slot-filling flow. */
export const RESERVATION_PROMPT_BLOCK =
  `\n\n---\nTABLE RESERVATION\nWhen a customer wants to reserve a table, ask ONE question at a time in this order: party size, then date, then time. Use the Captured info below to know what's already been answered — never re-ask something already captured.\nCapture each answer with these tags on the last line of your reply:\n[ENTITY:party_size=<number>]\n[ENTITY:booking_date=<YYYY-MM-DD>]\n[ENTITY:booking_time=<HH:MM>]\nOnce all three are present in Captured info, read back a confirmation in your visible reply text (e.g. "Got it — a table for 4 on 2026-10-25 at 19:30, is that right?") and only once the customer explicitly confirms, append [CONFIRM_BOOKING] on the very last line of that later reply. Do not append [CONFIRM_BOOKING] in the same reply as the readback — wait for the customer's confirmation first. This feature does NOT check table availability — always tell the customer their request has been sent to the restaurant team.`;

interface ConfirmBookingContext {
  db:           Db;
  gateway:      WhatsAppGateway;
  config:       { phone_number_id: string; access_token: string };
  incoming:     IncomingWhatsAppMessage;
  conversation: Conversation;
  tenantId:     string;
  contactId:    string;
  vars:         Record<string, string>;
  log:          FastifyBaseLogger;
}

/** Fires on [CONFIRM_BOOKING] — creates the booking row, notifies staff, confirms the customer. */
export async function handleConfirmBooking(ctx: ConfirmBookingContext): Promise<void> {
  const { db, gateway, config, incoming, conversation, tenantId, contactId, vars, log } = ctx;

  const partySize   = Number(vars['party_size']);
  const bookingDate = vars['booking_date'];
  const bookingTime = vars['booking_time'];

  if (!partySize || !bookingDate || !bookingTime) {
    log.warn(
      { tenantId, conversationId: conversation.id, partySize, bookingDate, bookingTime },
      '[Webhook] CONFIRM_BOOKING fired with incomplete captured info — booking not created',
    );
    return;
  }

  const result = await createBooking(db, tenantId, contactId, conversation.id, partySize, bookingDate, bookingTime);
  if (result.ok) {
    dispatchWebhook(tenantId, 'booking.created', { bookingId: result.booking.id, partySize, bookingDate, bookingTime });
    void notifyStaffOfBooking(conversation, { partySize, bookingDate, bookingTime });
    fireForget(
      gateway.sendMessage(config.phone_number_id, config.access_token, {
        type: 'text',
        to:   incoming.from,
        text: `✅ Table booked for ${partySize} on ${bookingDate} at ${bookingTime}. See you then!`,
      }),
      'send-booking-confirmation',
      log,
    );
  } else {
    fireForget(
      gateway.sendMessage(config.phone_number_id, config.access_token, {
        type: 'text',
        to:   incoming.from,
        text: "Sorry, I couldn't save that reservation request right now. Please try again in a moment.",
      }),
      'send-booking-confirm-failure',
      log,
    );
  }
}
