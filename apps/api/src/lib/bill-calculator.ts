import type { getServerClient } from '@alphabot/database';

type Db = ReturnType<typeof getServerClient>;

export interface TenantBillingConfig {
  taxRateBp:          number; // basis points, e.g. 500 = 5%
  packingChargePaise: number;
  minOrderValuePaise: number;
  maxOrderValuePaise: number | null;
}

export interface BillBreakdown {
  subtotalPaise: number;
  taxPaise:      number;
  packingPaise:  number;
  totalPaise:    number;
}

/**
 * PRC-01: the one place a restaurant order's final bill is computed.
 * Both tax and packing default to 0, so a tenant that hasn't configured
 * either sees no change from the pre-PRC-01 behaviour (totalPaise ===
 * subtotalPaise, as before).
 */
export function calculateBill(subtotalPaise: number, config: TenantBillingConfig): BillBreakdown {
  const taxPaise     = Math.round(subtotalPaise * config.taxRateBp / 10000);
  const packingPaise = subtotalPaise > 0 ? config.packingChargePaise : 0;
  return {
    subtotalPaise,
    taxPaise,
    packingPaise,
    totalPaise: subtotalPaise + taxPaise + packingPaise,
  };
}

export async function getTenantBillingConfig(db: Db, tenantId: string): Promise<TenantBillingConfig> {
  const { data } = await db
    .from('tenants')
    .select('tax_rate_bp, packing_charge_paise, min_order_value_paise, max_order_value_paise')
    .eq('id', tenantId)
    .maybeSingle();

  const row = data as {
    tax_rate_bp: number | null; packing_charge_paise: number | null;
    min_order_value_paise: number | null; max_order_value_paise: number | null;
  } | null;
  return {
    taxRateBp:          row?.tax_rate_bp ?? 0,
    packingChargePaise: row?.packing_charge_paise ?? 0,
    minOrderValuePaise: row?.min_order_value_paise ?? 0,
    maxOrderValuePaise: row?.max_order_value_paise ?? null,
  };
}

export type OrderValueCheck =
  | { ok: true }
  | { ok: false; reason: 'below_minimum' | 'above_maximum'; limitPaise: number };

/** PRC-05: checked against the item subtotal (before tax/packing), since that's "what you're ordering," not the surcharges added on top. */
export function checkOrderValue(subtotalPaise: number, config: TenantBillingConfig): OrderValueCheck {
  if (config.minOrderValuePaise > 0 && subtotalPaise < config.minOrderValuePaise) {
    return { ok: false, reason: 'below_minimum', limitPaise: config.minOrderValuePaise };
  }
  if (config.maxOrderValuePaise !== null && subtotalPaise > config.maxOrderValuePaise) {
    return { ok: false, reason: 'above_maximum', limitPaise: config.maxOrderValuePaise };
  }
  return { ok: true };
}
