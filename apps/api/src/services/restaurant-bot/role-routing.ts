import type { FastifyBaseLogger } from 'fastify';
import type { getServerClient } from '@alphabot/database';
import type { WhatsAppProvider } from '@alphabot/shared';
import { WhatsAppGateway } from '../whatsapp/gateway.js';
import { handleOwnerCommand } from './owner-commands.js';
import { handleKitchenReply, handleOwnerProblemResolution } from './kitchen-flow.js';

type Db = ReturnType<typeof getServerClient>;

/**
 * OWN-03/FUL-03: dispatches a message that arrived on a non-customer
 * WhatsApp number (WAB-06 role='ops'|'kitchen') — never the AI pipeline.
 * Returns true if the role matched (caller should stop regardless of
 * whether a specific handler inside fired).
 */
export async function routeNonCustomerRoleMessage(
  role:      string,
  db:        Db,
  wnRow:     { provider: string; config_json: Record<string, unknown> },
  body:      unknown,
  tenantId:  string,
  log:       FastifyBaseLogger,
): Promise<boolean> {
  if (role !== 'ops' && role !== 'kitchen') return false;

  const gateway  = new WhatsAppGateway(wnRow.provider as WhatsAppProvider);
  const config   = wnRow.config_json as { phone_number_id: string; access_token: string };
  const incoming = gateway.parseIncoming(body);
  if (!incoming || incoming.type === 'unsupported') return true;

  const ctx = { db, gateway, config, incoming, tenantId, log };
  if (role === 'kitchen') {
    await handleKitchenReply(ctx);
  } else {
    const resolved = await handleOwnerProblemResolution(ctx);
    if (!resolved) await handleOwnerCommand(ctx);
  }
  return true;
}
