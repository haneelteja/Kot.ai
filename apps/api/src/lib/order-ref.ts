import type { getServerClient } from '@alphabot/database';

type Db = ReturnType<typeof getServerClient>;

/**
 * Allocates a gap-free, concurrency-safe order reference for a tenant via the
 * `allocate_order_ref` Postgres function (atomic INSERT...ON CONFLICT DO
 * UPDATE...RETURNING — Postgres row-locking on the upsert serializes
 * concurrent checkouts for the same tenant, no explicit row lock needed here).
 */
export async function allocateOrderRef(db: Db, tenantId: string): Promise<string> {
  const { data, error } = await db.rpc('allocate_order_ref', { p_tenant_id: tenantId });
  if (error || typeof data !== 'string') {
    throw new Error(`Failed to allocate order ref: ${error?.message ?? 'no data returned'}`);
  }
  return data;
}
