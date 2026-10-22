import { promises as dns } from 'dns';
import { isIP } from 'net';

/**
 * SSRF guard for tenant-supplied outbound webhook URLs. Must run before any
 * fetch to a URL a tenant configured — without it, a malicious or compromised
 * tenant could point their webhook at internal infrastructure (Render's
 * private network) or a cloud metadata endpoint (169.254.169.254) and read
 * back whatever that internal service returns via the delivery log.
 */

function isPrivateOrReservedIp(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) {
    const parts = ip.split('.').map(Number);
    const [a, b] = parts;
    if (a === undefined || b === undefined) return true;
    if (a === 127) return true;                          // loopback
    if (a === 10) return true;                            // private
    if (a === 172 && b >= 16 && b <= 31) return true;      // private
    if (a === 192 && b === 168) return true;               // private
    if (a === 169 && b === 254) return true;               // link-local, incl. cloud metadata 169.254.169.254
    if (a === 0) return true;                               // "this network"
    if (a === 100 && b >= 64 && b <= 127) return true;      // carrier-grade NAT
    return false;
  }
  if (version === 6) {
    const lower = ip.toLowerCase();
    if (lower === '::1') return true;                       // loopback
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // unique local (fc00::/7)
    if (lower.startsWith('fe80')) return true;               // link-local
    if (lower === '::' || lower.startsWith('::ffff:0:0')) return true;
    return false;
  }
  return true; // not a recognizable IP at all — fail closed
}

export interface UrlSafetyResult {
  safe:  boolean;
  error?: string;
}

/**
 * Resolves the URL's hostname and rejects it if the URL isn't https/http,
 * or if ANY resolved address is private/loopback/link-local/metadata. Call
 * this immediately before every outbound webhook fetch — DNS can change
 * between webhook creation and delivery (DNS rebinding), so this is not a
 * one-time validation at config-save time.
 */
export async function isUrlSafeForOutbound(rawUrl: string): Promise<UrlSafetyResult> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { safe: false, error: 'Invalid URL' };
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return { safe: false, error: `Unsupported protocol: ${url.protocol}` };
  }

  const hostname = url.hostname;
  // A literal IP in the URL — check it directly, no DNS lookup needed.
  if (isIP(hostname)) {
    return isPrivateOrReservedIp(hostname)
      ? { safe: false, error: `Target IP ${hostname} is private/reserved` }
      : { safe: true };
  }

  if (hostname === 'localhost') return { safe: false, error: 'localhost is not a valid webhook target' };

  try {
    const records = await dns.lookup(hostname, { all: true });
    for (const r of records) {
      if (isPrivateOrReservedIp(r.address)) {
        return { safe: false, error: `${hostname} resolves to a private/reserved address (${r.address})` };
      }
    }
    return { safe: true };
  } catch (err) {
    return { safe: false, error: `DNS resolution failed: ${err instanceof Error ? err.message : String(err)}` };
  }
}
