import { createHmac, timingSafeEqual } from 'crypto';

// WEB-01: a lightweight signed link (HMAC-SHA256, no JWT library needed —
// matches this codebase's existing style, e.g. Easebuzz's hash
// verification) embedding the tenant id + an expiry, so a tampered or
// guessed /o/[tenant] URL is rejected instead of silently working.
// Requires ORDERING_LINK_SECRET to be set identically on both apps/api and
// apps/web — if unset, signOrderingLink falls back to the raw tenant id
// (today's unsigned behaviour) rather than breaking link generation.

const DEFAULT_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

export function signOrderingLink(
  tenantId: string,
  secret:   string | undefined,
  ttlSeconds = DEFAULT_TTL_SECONDS,
): string {
  if (!secret) return tenantId; // unsigned fallback — see note above

  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = b64url(JSON.stringify({ t: tenantId, e: exp }));
  const sig = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export type VerifyOrderingLinkResult =
  | { ok: true; tenantId: string }
  | { ok: false; error: 'invalid' | 'expired' | 'unsigned' };

/**
 * Verifies a token from signOrderingLink. A bare UUID (no '.' separator) is
 * reported as 'unsigned' rather than 'invalid' — the caller can choose to
 * accept it for backward compatibility with links shared before
 * ORDERING_LINK_SECRET was configured.
 */
export function verifyOrderingLink(token: string, secret: string | undefined): VerifyOrderingLinkResult {
  if (!token.includes('.')) return { ok: false, error: 'unsigned' };
  if (!secret) return { ok: false, error: 'invalid' };

  const [payload, sig] = token.split('.');
  if (!payload || !sig) return { ok: false, error: 'invalid' };

  const expectedSig = createHmac('sha256', secret).update(payload).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, error: 'invalid' };

  let parsed: { t?: string; e?: number };
  try {
    parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
  } catch {
    return { ok: false, error: 'invalid' };
  }
  if (!parsed.t || !parsed.e) return { ok: false, error: 'invalid' };
  if (Math.floor(Date.now() / 1000) > parsed.e) return { ok: false, error: 'expired' };

  return { ok: true, tenantId: parsed.t };
}
