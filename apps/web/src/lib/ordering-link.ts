import { createHmac, timingSafeEqual } from 'crypto';

// WEB-01: verifies a signed /o/[tenant] link. Kept as a local duplicate of
// packages/shared/src/utils/ordering-link.ts's verifyOrderingLink rather
// than importing it — apps/web's tsconfig points "@alphabot/shared" at
// that package's TS *source* (for live types without rebuilding dist),
// and this is the first real value (non-type) import of that package into
// apps/web; Next's webpack can't resolve the source's internal `.js`-
// suffixed relative imports against sibling `.ts` files, which only
// surfaces now because every prior usage was `import type`. Not worth
// changing shared monorepo tooling config for one small function.

export type VerifyOrderingLinkResult =
  | { ok: true; tenantId: string }
  | { ok: false; error: 'invalid' | 'expired' | 'unsigned' };

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
