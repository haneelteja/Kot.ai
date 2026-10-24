import type { getServerClient } from '@alphabot/database';
import { allocateOrderRef } from './order-ref.js';
import type { BillBreakdown } from './bill-calculator.js';

type Db = ReturnType<typeof getServerClient>;

const DRAFT_EXPIRY_MS = 30 * 60 * 1000; // PAY-02 default: 30 minutes

export interface DraftLineItem {
  menuItemId:     string;
  name:           string;
  unitPricePaise: number;
  quantity:       number;
  lineTotalPaise: number;
}

export interface CheckoutDraft {
  id:        string;
  expiresAt: string;
}

/**
 * ORD-02 (revised): the pre-payment state. No `orders` row exists yet —
 * this is deliberately NOT an order, so the kitchen/dashboard never see an
 * unpaid checkout. Converted to a real order only once Easebuzz confirms
 * payment (see convertDraftToOrder, called from the webhook callback).
 */
export async function createCheckoutDraft(
  db:             Db,
  tenantId:       string,
  contactId:      string,
  conversationId: string,
  source:         'whatsapp_bot' | 'weblink',
  items:          DraftLineItem[],
  bill:           BillBreakdown,
): Promise<CheckoutDraft | null> {
  const expiresAt = new Date(Date.now() + DRAFT_EXPIRY_MS).toISOString();

  const { data, error } = await db
    .from('checkout_drafts')
    .insert({
      tenant_id:            tenantId,
      contact_id:           contactId,
      conversation_id:      conversationId,
      source,
      items_json:           items,
      subtotal_paise:       bill.subtotalPaise,
      tax_paise:            bill.taxPaise,
      packing_charge_paise: bill.packingPaise,
      total_paise:          bill.totalPaise,
      expires_at:           expiresAt,
    })
    .select('id, expires_at')
    .single();

  if (error || !data) return null;
  return { id: (data as { id: string }).id, expiresAt: (data as { expires_at: string }).expires_at };
}

export async function attachDraftPaymentLink(db: Db, draftId: string, linkUrl: string): Promise<void> {
  await db.from('checkout_drafts').update({ link_url: linkUrl }).eq('id', draftId);
}

export type ConvertDraftResult =
  | { ok: true; orderId: string; orderRef: string; totalPaise: number; subtotalPaise: number; taxPaise: number; packingPaise: number; tenantId: string; contactId: string; conversationId: string; source: string }
  | { ok: false; error: 'draft_not_found' | 'already_converted' | 'create_failed' };

/**
 * Called from the Easebuzz webhook callback once payment is confirmed —
 * this is the ONLY place a restaurant order is created. Allocates the
 * order_ref here (not at draft time), so an abandoned/expired draft never
 * burns a visible ref — matches the flow map's "Order and pay" step o9.
 */
export async function convertDraftToOrder(db: Db, draftId: string): Promise<ConvertDraftResult> {
  const { data: draft } = await db
    .from('checkout_drafts')
    .select('id, tenant_id, contact_id, conversation_id, source, items_json, subtotal_paise, tax_paise, packing_charge_paise, total_paise, status, order_id')
    .eq('id', draftId)
    .single();

  if (!draft) return { ok: false, error: 'draft_not_found' };
  if (draft.status !== 'awaiting_payment') {
    // Idempotency: the webhook can retry delivery. If already converted,
    // hand back the existing order instead of creating a second one.
    if (draft.status === 'paid' && draft.order_id) {
      return {
        ok: true,
        orderId: draft.order_id as string,
        orderRef: '', // caller already sent the confirmation on first conversion; not needed on replay
        totalPaise: draft.total_paise as number,
        subtotalPaise: draft.subtotal_paise as number,
        taxPaise: draft.tax_paise as number,
        packingPaise: draft.packing_charge_paise as number,
        tenantId: draft.tenant_id as string,
        contactId: draft.contact_id as string,
        conversationId: draft.conversation_id as string,
        source: draft.source as string,
      };
    }
    return { ok: false, error: 'already_converted' };
  }

  const tenantId = draft.tenant_id as string;
  const orderRef = await allocateOrderRef(db, tenantId);
  const items = draft.items_json as DraftLineItem[];

  const { data: order, error: orderError } = await db
    .from('orders')
    .insert({
      tenant_id:       tenantId,
      contact_id:      draft.contact_id,
      conversation_id: draft.conversation_id,
      items_json:           items.map(i => ({ name: i.name, quantity: i.quantity, price: i.unitPricePaise / 100 })),
      total:                (draft.total_paise as number) / 100,
      total_paise:          draft.total_paise,
      subtotal_paise:       draft.subtotal_paise,
      tax_paise:            draft.tax_paise,
      packing_charge_paise: draft.packing_charge_paise,
      order_ref:            orderRef,
      source:               draft.source,
      status:               'confirmed',
    })
    .select('id')
    .single();

  if (orderError || !order) return { ok: false, error: 'create_failed' };
  const orderId = (order as { id: string }).id;

  await db.from('order_items').insert(
    items.map(i => ({
      order_id:         orderId,
      menu_item_id:     i.menuItemId,
      name:             i.name,
      unit_price_paise: i.unitPricePaise,
      quantity:         i.quantity,
      line_total_paise: i.lineTotalPaise,
    })),
  );

  // A real payments row, same shape every other order's payment row has —
  // the dashboard's Orders/Payments screens join on this. Status is 'paid'
  // immediately since we only get here after Easebuzz confirmed success.
  const { data: draftRow } = await db.from('checkout_drafts').select('link_url').eq('id', draftId).single();
  await db.from('payments').insert({
    order_id:            orderId,
    status:              'paid',
    link_url:            draftRow?.link_url ?? null,
    webhook_received_at: new Date().toISOString(),
  });

  await db.from('checkout_drafts').update({ status: 'paid', order_id: orderId }).eq('id', draftId);

  return {
    ok: true,
    orderId,
    orderRef,
    totalPaise: draft.total_paise as number,
    subtotalPaise: draft.subtotal_paise as number,
    taxPaise: draft.tax_paise as number,
    packingPaise: draft.packing_charge_paise as number,
    tenantId,
    contactId: draft.contact_id as string,
    conversationId: draft.conversation_id as string,
    source: draft.source as string,
  };
}
