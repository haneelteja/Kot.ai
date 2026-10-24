import type { FastifyInstance } from 'fastify';
import { getServerClient } from '@alphabot/database';
import type { WhatsAppProvider } from '@alphabot/shared';
import { WhatsAppGateway } from '../../services/whatsapp/gateway.js';
import { requireAuth } from '../../middleware/auth.js';
import { resolveNumberForRole } from '../../lib/number-roles.js';

type Db = ReturnType<typeof getServerClient>;

type ResolutionType = 'refund' | 'coupon' | 'redeliver' | 'none';
const VALID_RESOLUTIONS: ResolutionType[] = ['refund', 'coupon', 'redeliver', 'none'];

// CMP-03: the customer-facing line per resolution type. "refund" and "coupon"
// describe an action staff already took manually outside the system (no
// Easebuzz refund API integration exists yet — PAY-07 is deferred to MLP2,
// same honest-manual-handoff framing as FUL-03's "Refund order" stub) —
// this endpoint only records what staff did and informs the customer.
const RESOLUTION_MESSAGES: Record<ResolutionType, (notes: string | null) => string> = {
  refund:    (notes) => `✅ *Your complaint has been resolved*\n\nWe've processed a refund for this order.${notes ? `\n\n${notes}` : ''}\n\nWe're sorry for the inconvenience and appreciate you letting us know.`,
  coupon:    (notes) => `✅ *Your complaint has been resolved*\n\nWe've issued a coupon to make up for this.${notes ? `\n\n${notes}` : ''}\n\nWe're sorry for the inconvenience and appreciate you letting us know.`,
  redeliver: (notes) => `✅ *Your complaint has been resolved*\n\nWe're sending a replacement for the affected item(s).${notes ? `\n\n${notes}` : ''}\n\nWe're sorry for the inconvenience and appreciate you letting us know.`,
  none:      (notes) => `We've reviewed your complaint.${notes ? `\n\n${notes}` : ''}\n\nThank you for letting us know — we take this seriously.`,
};

export async function complaintRoutes(fastify: FastifyInstance): Promise<void> {
  const db = getServerClient();

  fastify.addHook('preHandler', requireAuth);

  // ─── GET /api/complaints ──────────────────────────────────────────────────
  // CMP-02: full queue, SLA-overdue flag computed client-side off sla_due_at.
  fastify.get<{ Querystring: { status?: string } }>('/', async (request, reply) => {
    let query = db
      .from('complaints')
      .select('*, contact:contacts(name, phone), order:orders(order_ref)')
      .eq('tenant_id', request.tenantId)
      .order('created_at', { ascending: false })
      .limit(200);

    if (request.query.status) query = query.eq('status', request.query.status);

    const { data, error } = await query;
    if (error) return reply.status(500).send({ error: error.message });
    return reply.send({ complaints: data ?? [] });
  });

  // ─── PATCH /api/complaints/:id/resolve ────────────────────────────────────
  fastify.patch<{ Params: { id: string }; Body: { resolutionType: string; resolutionNotes?: string } }>(
    '/:id/resolve',
    async (request, reply) => {
      const resolutionType = request.body.resolutionType as ResolutionType;
      if (!VALID_RESOLUTIONS.includes(resolutionType)) {
        return reply.status(400).send({ error: 'Invalid resolutionType' });
      }

      const { data: complaint, error: fetchErr } = await db
        .from('complaints')
        .select('id, contact:contacts(phone, name)')
        .eq('id', request.params.id)
        .eq('tenant_id', request.tenantId)
        .single();

      if (fetchErr || !complaint) return reply.status(404).send({ error: 'Complaint not found' });

      const { data: updated, error: updateErr } = await db
        .from('complaints')
        .update({
          status:           'resolved',
          resolution_type:  resolutionType,
          resolution_notes: request.body.resolutionNotes ?? null,
          resolved_by:       request.userId.startsWith('api_key:') ? null : request.userId,
          updated_at:        new Date().toISOString(),
        })
        .eq('id', request.params.id)
        .eq('tenant_id', request.tenantId)
        .select()
        .single();

      if (updateErr) return reply.status(500).send({ error: updateErr.message });

      const contact = (complaint as unknown as { contact: { phone: string | null; name: string | null } | null }).contact;
      if (contact?.phone) {
        const wn = await resolveNumberForRole(db, request.tenantId, 'restaurant_bot', 'customer');
        if (wn) {
          const gateway = new WhatsAppGateway(wn.provider as WhatsAppProvider);
          await gateway.sendMessage(wn.phone_number_id, wn.access_token, {
            type: 'text',
            to:   contact.phone,
            text: RESOLUTION_MESSAGES[resolutionType](request.body.resolutionNotes ?? null),
          }).catch(err => fastify.log.error({ err }, '[Complaints] resolution WhatsApp notification failed'));
        }
      }

      return reply.send({ complaint: updated });
    },
  );
}
