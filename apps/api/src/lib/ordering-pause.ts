import type { getServerClient } from '@alphabot/database';

type Db = ReturnType<typeof getServerClient>;

export interface OrderingPauseStatus {
  paused: boolean;
  until:  string | null;
}

/** OWN-03: single tenant-wide ordering pause (PAUSE/RESUME owner commands). */
export async function getOrderingPauseStatus(db: Db, tenantId: string): Promise<OrderingPauseStatus> {
  const { data } = await db.from('tenants').select('ordering_paused_until').eq('id', tenantId).maybeSingle();
  const until = (data as { ordering_paused_until: string | null } | null)?.ordering_paused_until ?? null;
  const paused = until !== null && new Date(until).getTime() > Date.now();
  return { paused, until: paused ? until : null };
}
