/**
 * Minimal local/staging seed: a demo tenant + an owner-less WhatsApp number
 * row wired to the restaurant bot product, so auth/routing can be exercised
 * end to end before the Phase 3 restaurant schema (branches, menu, offers)
 * exists. Re-run after BR-01/MENU-01 land to extend this with the full
 * "Demo Biryani House" fixture (brief §20.2).
 *
 * Idempotent: safe to run multiple times against the same database.
 */
import { getServerClient } from './client.js';

const DEMO_TENANT_NAME = 'Demo Biryani House';
const DEMO_PHONE_NUMBER = '+910000000000'; // placeholder — replace with a real test number

async function main(): Promise<void> {
  const db = getServerClient();

  const { data: existing } = await db
    .from('tenants')
    .select('id')
    .eq('name', DEMO_TENANT_NAME)
    .maybeSingle();

  let tenantId = existing?.id as string | undefined;

  if (!tenantId) {
    const { data: tenant, error } = await db
      .from('tenants')
      .insert({ name: DEMO_TENANT_NAME, plan: 'starter', provider: 'meta_cloud', status: 'trial' })
      .select('id')
      .single();
    if (error) throw new Error(`Failed to create demo tenant: ${error.message}`);
    tenantId = tenant.id as string;
    console.log(`[seed] created tenant ${DEMO_TENANT_NAME} (${tenantId})`);
  } else {
    console.log(`[seed] tenant ${DEMO_TENANT_NAME} already exists (${tenantId})`);
  }

  const { error: productError } = await db
    .from('tenant_products')
    .upsert(
      {
        tenant_id: tenantId,
        product_type: 'restaurant_bot',
        product_slug: 'restaurant_bot',
        instance_name: 'Default',
        tier: 'base',
        active: true,
      },
      { onConflict: 'tenant_id,product_slug' },
    );
  if (productError) throw new Error(`Failed to enable restaurant_bot product: ${productError.message}`);
  console.log('[seed] restaurant_bot product enabled for demo tenant');

  const { error: numberError } = await db
    .from('whatsapp_numbers')
    .upsert(
      {
        tenant_id: tenantId,
        phone_number: DEMO_PHONE_NUMBER,
        provider: 'meta_cloud',
        product_slug: 'restaurant_bot',
        config_json: {},
      },
      { onConflict: 'tenant_id,phone_number' },
    );
  if (numberError) throw new Error(`Failed to seed whatsapp number: ${numberError.message}`);
  console.log(`[seed] placeholder WhatsApp number ${DEMO_PHONE_NUMBER} attached — replace with a real test number before using`);

  console.log('[seed] done. Branches, menu, and offers are seeded once BR-01/MENU-01 migrations land (Phase 3).');
}

main().catch(err => {
  console.error('[seed] failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
