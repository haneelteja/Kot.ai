import type { FastifyBaseLogger } from 'fastify';
import type { getServerClient } from '@alphabot/database';
import type { IncomingWhatsAppMessage } from '@alphabot/shared';
import type { RoutingConfig } from '../routing/router.js';
import { WhatsAppGateway } from '../whatsapp/gateway.js';
import { fireForget } from '../../lib/fire-forget.js';

type Db = ReturnType<typeof getServerClient>;

interface PostBookingContext {
  db:               Db;
  gateway:          WhatsAppGateway;
  config:           { phone_number_id: string; access_token: string };
  incoming:         IncomingWhatsAppMessage;
  tenantId:         string;
  whatsappNumberId: string;
  convAiVars:       Record<string, string>;
  entityMatches:    RegExpMatchArray[];
  contactName:      string | null;
  phoneValue:       string;
  log:              FastifyBaseLogger;
}

/**
 * When the lifecycle AI transitions to [STAGE:booked], fires two messages:
 * 1. Directions to the customer (branch address, access, hours)
 * 2. Booking summary to the branch manager's WhatsApp (if manager_phone is set)
 */
export function sendPostBookingDirections(ctx: PostBookingContext): void {
  fireForget(
    (async () => {
      const { data: wnForDirs } = await ctx.db
        .from('whatsapp_numbers')
        .select('routing_config')
        .eq('id', ctx.whatsappNumberId)
        .maybeSingle();
      const branches = ((wnForDirs?.routing_config ?? {}) as RoutingConfig).branches;
      if (!branches?.length) return;

      // Merge any new entity captures from this turn
      const latestVars = ctx.entityMatches.length > 0
        ? { ...ctx.convAiVars, ...Object.fromEntries(ctx.entityMatches.map(m => [m[1]!, m[2]!])) }
        : ctx.convAiVars;
      const branchName = latestVars['branch'] ?? latestVars['location'] ?? '';
      const branch = branches.find(b =>
        branchName && b.name.toLowerCase().includes(branchName.toLowerCase()),
      ) ?? branches[0]!;

      // 1. Directions to customer
      const dirLines: string[] = [`Here's how to find us! 📍`];
      if (branch.address) dirLines.push(`*${branch.name}*\n${branch.address}`);
      else                 dirLines.push(`*${branch.name}*`);
      if (branch.access)   dirLines.push(`🏢 ${branch.access}`);
      if (branch.hours)    dirLines.push(`🕐 Open ${branch.hours}`);
      if (branch.phone)    dirLines.push(`📞 ${branch.phone}`);
      dirLines.push(`\nSee you soon! 🙏`);

      await ctx.gateway.sendMessage(ctx.config.phone_number_id, ctx.config.access_token, {
        type: 'text', to: ctx.incoming.from, text: dirLines.join('\n'),
      });
      ctx.log.info({ tenantId: ctx.tenantId, branch: branch.name }, '[Webhook] post-booking directions sent');

      // 2. Notification to branch manager (if configured)
      if (branch.manager_phone) {
        const contactName = ctx.contactName ?? 'Guest';
        const summaryParts = [`📋 *New Booking — ${branch.name}*`, `👤 ${contactName}`];
        if (latestVars['date'])       summaryParts.push(`📅 ${latestVars['date']}`);
        if (latestVars['time'])       summaryParts.push(`🕐 ${latestVars['time']}`);
        if (latestVars['party_size']) summaryParts.push(`👥 ${latestVars['party_size']} guests`);
        if (latestVars['occasion'])   summaryParts.push(`🎉 ${latestVars['occasion']}`);
        if (latestVars['dietary'])    summaryParts.push(`🥗 Dietary: ${latestVars['dietary']}`);
        summaryParts.push(`\n📱 Customer: ${ctx.phoneValue}`);

        await ctx.gateway.sendMessage(ctx.config.phone_number_id, ctx.config.access_token, {
          type: 'text', to: branch.manager_phone, text: summaryParts.join('\n'),
        });
        ctx.log.info({ tenantId: ctx.tenantId, branch: branch.name, manager: branch.manager_phone }, '[Webhook] branch manager notified');
      }
    })(),
    'post-booking-directions',
    ctx.log,
  );
}
