import { getServerClient } from '@alphabot/database';

export type ConsentPurpose = 'marketing';
export type ConsentAction  = 'opt_in' | 'opt_out';
export type ConsentChannel = 'whatsapp_button' | 'whatsapp_keyword' | 'dashboard';

/**
 * MKT-03: append-only consent ledger — one row per opt-in/opt-out event,
 * never overwritten, so there's always a durable record of when/how
 * consent was granted or withdrawn (DPDP §17).
 */
export async function writeConsent(
  tenantId:  string,
  contactId: string,
  purpose:   ConsentPurpose,
  action:    ConsentAction,
  channel:   ConsentChannel,
): Promise<void> {
  const db = getServerClient();
  await db.from('consents').insert({ tenant_id: tenantId, contact_id: contactId, purpose, action, channel });
}

/**
 * MKT-01: the single choke-point any future marketing-send feature must
 * call before sending — true only if the contact's most recent 'marketing'
 * consent event is an opt_in. No code path sends marketing messages today
 * (MKT-04 is blocked on TPL-01's Meta template approval), so this has no
 * caller yet; it exists so that whenever one is added, "no explicit opt-in
 * -> never sent" is enforced in one place rather than re-implemented.
 */
export async function hasMarketingConsent(tenantId: string, contactId: string): Promise<boolean> {
  const db = getServerClient();
  const { data } = await db
    .from('consents')
    .select('action')
    .eq('tenant_id', tenantId)
    .eq('contact_id', contactId)
    .eq('purpose', 'marketing')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data?.action === 'opt_in';
}
