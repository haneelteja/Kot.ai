import type { getServerClient } from '@alphabot/database';

type Db = ReturnType<typeof getServerClient>;

export type ComplaintCategory = 'wrong_item' | 'missing_item' | 'quality' | 'late' | 'other';

export interface ComplaintRow {
  id:         string;
  category:   ComplaintCategory;
  orderRef:   string | null;
  slaDueAt:   string;
}

export type CreateComplaintResult =
  | { ok: true; complaint: ComplaintRow }
  | { ok: false; error: 'invalid_category' | 'create_failed' };

const VALID_CATEGORIES: ComplaintCategory[] = ['wrong_item', 'missing_item', 'quality', 'late', 'other'];

/**
 * CMP-01: captures a complaint ticket, auto-linking the customer's most
 * recent restaurant order per brief §16 ("Collect order ref auto from
 * last order"). No resolution automation here — see lib/complaint.ts's
 * resolveComplaint for CMP-03, which is honest-stub for refund (PAY-07
 * deferred to MLP2) just like FUL-03's "Refund order" already is.
 */
export async function createComplaint(
  db:             Db,
  tenantId:       string,
  contactId:      string,
  conversationId: string,
  category:       string,
  description:    string | null,
): Promise<CreateComplaintResult> {
  if (!VALID_CATEGORIES.includes(category as ComplaintCategory)) {
    return { ok: false, error: 'invalid_category' };
  }

  const { data: lastOrder } = await db
    .from('orders')
    .select('id, order_ref')
    .eq('tenant_id', tenantId)
    .eq('contact_id', contactId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await db
    .from('complaints')
    .insert({
      tenant_id:       tenantId,
      contact_id:      contactId,
      conversation_id: conversationId,
      order_id:        lastOrder?.id ?? null,
      category,
      description,
    })
    .select('id, category, sla_due_at')
    .single();

  if (error || !data) return { ok: false, error: 'create_failed' };

  return {
    ok: true,
    complaint: {
      id:       (data as { id: string }).id,
      category: (data as { category: ComplaintCategory }).category,
      orderRef: lastOrder?.order_ref ?? null,
      slaDueAt: (data as { sla_due_at: string }).sla_due_at,
    },
  };
}
