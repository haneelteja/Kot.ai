'use server';

import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { getSession }             from '@/lib/session';
import { writeAuditLog }          from '@/lib/audit';

const REDACTED_TEXT = '[redacted — data deletion request]';

export interface ContactLookupResult {
  id:    string;
  name:  string | null;
  phone: string | null;
  created_at: string;
}

async function assertAdminRole(): Promise<{ ok: true; tenantId: string; userId: string; userEmail: string | null } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'Unauthorized' };
  if (!['admin', 'client_admin', 'client_manager'].includes(session.role)) {
    return { ok: false, error: 'Only an admin or manager can process data requests' };
  }
  return { ok: true, tenantId: session.tenantId, userId: session.userId, userEmail: session.userEmail };
}

/** PRV-03: look up a contact by phone within the current tenant, for export/delete. */
export async function findContactByPhoneAction(phone: string): Promise<{ contact: ContactLookupResult | null; error?: string }> {
  const auth = await assertAdminRole();
  if (!auth.ok) return { contact: null, error: auth.error };

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from('contacts')
    .select('id, name, phone, created_at')
    .eq('tenant_id', auth.tenantId)
    .eq('phone', phone.trim())
    .maybeSingle();

  if (error) return { contact: null, error: error.message };
  if (!data) return { contact: null, error: 'No contact found with that phone number' };
  return { contact: data as ContactLookupResult };
}

/**
 * PRV-03: data export — a full bundle of everything this contact's data
 * touches, for handing back to the customer. Audit-logged.
 */
export async function exportContactDataAction(contactId: string): Promise<{ data?: Record<string, unknown>; error?: string }> {
  const auth = await assertAdminRole();
  if (!auth.ok) return { error: auth.error };

  const admin = getSupabaseAdminClient();

  const { data: contact, error: contactErr } = await admin
    .from('contacts')
    .select('*')
    .eq('id', contactId)
    .eq('tenant_id', auth.tenantId)
    .single();
  if (contactErr || !contact) return { error: 'Contact not found' };

  const [{ data: conversations }, { data: orders }, { data: bookings }, { data: complaints }] = await Promise.all([
    admin.from('conversations').select('id, product_type, status, created_at, messages(role, content, timestamp)')
      .eq('contact_id', contactId).eq('tenant_id', auth.tenantId),
    admin.from('orders').select('order_ref, status, total, items_json, created_at')
      .eq('contact_id', contactId).eq('tenant_id', auth.tenantId),
    admin.from('bookings').select('party_size, booking_date, booking_time, status, created_at')
      .eq('contact_id', contactId).eq('tenant_id', auth.tenantId),
    admin.from('complaints').select('category, description, status, resolution_type, created_at')
      .eq('contact_id', contactId).eq('tenant_id', auth.tenantId),
  ]);

  void writeAuditLog({
    tenantId: auth.tenantId, actorId: auth.userId, actorEmail: auth.userEmail,
    action: 'data_export', entityType: 'contact', entityId: contactId,
    description: `Exported data bundle for contact ${contactId}`,
  });

  return {
    data: {
      contact,
      conversations: conversations ?? [],
      orders:        orders ?? [],
      bookings:      bookings ?? [],
      complaints:    complaints ?? [],
      exported_at:   new Date().toISOString(),
    },
  };
}

/**
 * PRV-03: data deletion — anonymizes the contact row (name/phone/bsuid/
 * memory_json) and scrubs message content across all their conversations.
 * Deliberately does NOT delete rows: orders/bookings/complaints reference
 * contact_id via NOT NULL FKs, and deleting the contact would cascade into
 * financial/operational records this platform needs to keep (same
 * reasoning as PRV-02's message-content-only anonymization). Once the
 * contact row itself is anonymized, every join through it (orders,
 * bookings, complaints) stops exposing PII automatically - no per-table
 * work needed beyond that plus the chat text itself.
 *
 * Requires re-typing the contact's phone number as a confirmation gate -
 * this is an irreversible action.
 */
export async function deleteContactDataAction(
  contactId:   string,
  confirmPhone: string,
): Promise<{ ok?: true; error?: string }> {
  const auth = await assertAdminRole();
  if (!auth.ok) return { error: auth.error };

  const admin = getSupabaseAdminClient();

  const { data: contact, error: contactErr } = await admin
    .from('contacts')
    .select('id, phone')
    .eq('id', contactId)
    .eq('tenant_id', auth.tenantId)
    .single();
  if (contactErr || !contact) return { error: 'Contact not found' };
  if ((contact as { phone: string | null }).phone !== confirmPhone.trim()) {
    return { error: 'Phone number does not match — type it exactly to confirm deletion' };
  }

  const { data: conversations } = await admin
    .from('conversations')
    .select('id')
    .eq('contact_id', contactId)
    .eq('tenant_id', auth.tenantId);
  const convoIds = (conversations ?? []).map(c => (c as { id: string }).id);

  if (convoIds.length > 0) {
    const { error: msgErr } = await admin
      .from('messages')
      .update({ content: REDACTED_TEXT, media_url: null })
      .in('conversation_id', convoIds);
    if (msgErr) return { error: `Failed to anonymize messages: ${msgErr.message}` };
  }

  const { error: contactUpdateErr } = await admin
    .from('contacts')
    .update({ name: null, phone: null, bsuid: null, memory_json: {} })
    .eq('id', contactId)
    .eq('tenant_id', auth.tenantId);
  if (contactUpdateErr) return { error: `Failed to anonymize contact: ${contactUpdateErr.message}` };

  void writeAuditLog({
    tenantId: auth.tenantId, actorId: auth.userId, actorEmail: auth.userEmail,
    action: 'data_delete', entityType: 'contact', entityId: contactId,
    description: `Deleted/anonymized data for contact ${contactId} (was ${confirmPhone.trim()})`,
  });

  return { ok: true };
}
