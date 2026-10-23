import type { getServerClient } from '@alphabot/database';

type Db = ReturnType<typeof getServerClient>;

export type NumberRole = 'customer' | 'kitchen' | 'ops';

export interface ResolvedNumber {
  phone_number_id: string;
  access_token:    string;
  provider:        string;
}

/**
 * WAB-06: resolves which WhatsApp number to send/receive on for a given
 * role (customer/kitchen/ops) within one restaurant tenant+bot instance.
 * Falls back to the tenant's default (role='customer', i.e. the one and
 * only number most tenants have) when no dedicated role-tagged number is
 * configured — required so the feature is additive, not a breaking change
 * for existing single-number setups.
 */
export async function resolveNumberForRole(
  db:          Db,
  tenantId:    string,
  productSlug: string,
  role:        NumberRole,
): Promise<ResolvedNumber | null> {
  if (role !== 'customer') {
    const { data: roleRow } = await db
      .from('whatsapp_numbers')
      .select('config_json, provider')
      .eq('tenant_id', tenantId)
      .eq('product_slug', productSlug)
      .eq('role', role)
      .eq('active', true)
      .maybeSingle();

    if (roleRow) {
      const cfg = roleRow.config_json as { phone_number_id?: string; access_token?: string };
      if (cfg.phone_number_id && cfg.access_token) {
        return { phone_number_id: cfg.phone_number_id, access_token: cfg.access_token, provider: roleRow.provider as string };
      }
    }
  }

  // Fall back to the tenant's default (customer-role, or any active) number.
  const { data: fallback } = await db
    .from('whatsapp_numbers')
    .select('config_json, provider')
    .eq('tenant_id', tenantId)
    .eq('product_slug', productSlug)
    .eq('active', true)
    .order('role', { ascending: true }) // 'customer' sorts before 'kitchen'/'ops' alphabetically
    .limit(1)
    .maybeSingle();

  if (!fallback) return null;
  const cfg = fallback.config_json as { phone_number_id?: string; access_token?: string };
  if (!cfg.phone_number_id || !cfg.access_token) return null;
  return { phone_number_id: cfg.phone_number_id, access_token: cfg.access_token, provider: fallback.provider as string };
}
