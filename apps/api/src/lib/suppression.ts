import { getServerClient } from '@alphabot/database';

/** Opt-out keywords that trigger automatic suppression (case-insensitive). */
const OPT_OUT_KEYWORDS = [
  'stop', 'unsubscribe', 'opt out', 'optout', 'opt-out',
  'remove me', 'no more messages', 'dont message', "don't message",
  'block', 'do not contact', 'dnc',
];

/** Returns true if the message text is an opt-out request. */
export function isOptOutMessage(text: string): boolean {
  const lower = text.trim().toLowerCase();
  return OPT_OUT_KEYWORDS.some(kw => lower === kw || lower.startsWith(kw + ' ') || lower.endsWith(' ' + kw));
}

/**
 * MKT-01/02: opt-in / resubscribe keywords. 'start' is included because the
 * opt-out confirmation message tells customers to "Reply START to
 * re-subscribe" — this must be checked even for an already-suppressed
 * contact, ahead of the silent suppressed-contact drop in the webhook, or
 * that promise goes unfulfilled.
 */
const OPT_IN_KEYWORDS = [
  'start', 'subscribe', 'opt in', 'optin', 'opt-in',
  'send me offers', 'send offers', 'yes please',
];

/** Returns true if the message text is an opt-in / resubscribe request. */
export function isOptInMessage(text: string): boolean {
  const lower = text.trim().toLowerCase();
  return OPT_IN_KEYWORDS.some(kw => lower === kw || lower.startsWith(kw + ' ') || lower.endsWith(' ' + kw));
}

/** Returns true if this phone number is suppressed for this tenant. */
export async function isSuppressed(tenantId: string, phoneE164: string): Promise<boolean> {
  const db = getServerClient();
  const { data } = await db
    .from('contact_suppressions')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('phone_e164', normalisePhone(phoneE164))
    .maybeSingle();
  return !!data;
}

/** Writes a suppression record. Idempotent — safe to call multiple times. */
export async function writeSuppression(
  tenantId: string,
  phoneE164: string,
  reason: 'user_opt_out' | 'meta_complaint' | 'undeliverable' | 'manual' | 'regulatory',
): Promise<void> {
  const db = getServerClient();
  await db
    .from('contact_suppressions')
    .upsert(
      { tenant_id: tenantId, phone_e164: normalisePhone(phoneE164), reason },
      { onConflict: 'tenant_id,phone_e164', ignoreDuplicates: true },
    );
}

/** Removes a suppression record (resubscribe). No-op if none exists. */
export async function removeSuppression(tenantId: string, phoneE164: string): Promise<void> {
  const db = getServerClient();
  await db
    .from('contact_suppressions')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('phone_e164', normalisePhone(phoneE164));
}

/** Normalise to E.164 — strip leading + for storage consistency. */
function normalisePhone(phone: string): string {
  return phone.startsWith('+') ? phone : `+${phone}`;
}
