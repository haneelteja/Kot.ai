import type { FastifyInstance } from 'fastify';
import { getServerClient } from '@alphabot/database';
import { requireAuth } from '../../middleware/auth.js';

export async function couponRoutes(fastify: FastifyInstance): Promise<void> {
  const db = getServerClient();

  fastify.addHook('preHandler', requireAuth);

  // ─── GET /api/coupons ──────────────────────────────────────────────────────
  fastify.get('/', async (request, reply) => {
    const { data, error } = await db
      .from('coupons')
      .select('id, code, type, value, max_uses, uses_count, min_order_value_paise, active, expires_at, created_at')
      .eq('tenant_id', request.tenantId)
      .order('created_at', { ascending: false });

    if (error) return reply.status(500).send({ error: error.message });
    return reply.send({ coupons: data ?? [] });
  });

  // ─── POST /api/coupons ─────────────────────────────────────────────────────
  fastify.post<{
    Body: {
      code: string; type: string; value: number;
      max_uses?: number | null; min_order_value_paise?: number; expires_at?: string | null;
    };
  }>('/', async (request, reply) => {
    const { code, type, value, max_uses, min_order_value_paise, expires_at } = request.body;

    if (!code || !code.trim()) return reply.status(400).send({ error: 'Code is required' });
    if (!['percent', 'flat', 'free_delivery'].includes(type)) return reply.status(400).send({ error: 'Invalid type' });
    if (!Number.isInteger(value) || value < 0) return reply.status(400).send({ error: 'Invalid value' });
    if (type === 'percent' && value > 10000) return reply.status(400).send({ error: 'Percent value cannot exceed 100% (10000 bp)' });
    if (max_uses !== undefined && max_uses !== null && (!Number.isInteger(max_uses) || max_uses <= 0)) {
      return reply.status(400).send({ error: 'max_uses must be a positive integer or null' });
    }

    const { data, error } = await db
      .from('coupons')
      .insert({
        tenant_id:             request.tenantId,
        code:                  code.trim().toUpperCase(),
        type,
        value,
        max_uses:              max_uses ?? null,
        min_order_value_paise: min_order_value_paise ?? 0,
        expires_at:            expires_at ?? null,
      })
      .select()
      .single();

    if (error) {
      const message = error.code === '23505' ? 'A coupon with this code already exists' : error.message;
      return reply.status(error.code === '23505' ? 409 : 500).send({ error: message });
    }
    return reply.send({ coupon: data });
  });

  // ─── PATCH /api/coupons/:id ────────────────────────────────────────────────
  fastify.patch<{
    Params: { id: string };
    Body: { active?: boolean; max_uses?: number | null; expires_at?: string | null };
  }>('/:id', async (request, reply) => {
    const { active, max_uses, expires_at } = request.body;
    if (max_uses !== undefined && max_uses !== null && (!Number.isInteger(max_uses) || max_uses <= 0)) {
      return reply.status(400).send({ error: 'max_uses must be a positive integer or null' });
    }

    const { data, error } = await db
      .from('coupons')
      .update({
        ...(active !== undefined && { active }),
        ...(max_uses !== undefined && { max_uses }),
        ...(expires_at !== undefined && { expires_at }),
      })
      .eq('id', request.params.id)
      .eq('tenant_id', request.tenantId)
      .select()
      .single();

    if (error) return reply.status(500).send({ error: error.message });
    return reply.send({ coupon: data });
  });

  // ─── DELETE /api/coupons/:id ───────────────────────────────────────────────
  // Only allowed if the coupon has never been used — a used coupon is part
  // of real order history (orders.coupon_code), so it's deactivated instead.
  fastify.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const { data: coupon } = await db
      .from('coupons')
      .select('uses_count')
      .eq('id', request.params.id)
      .eq('tenant_id', request.tenantId)
      .maybeSingle();

    if (!coupon) return reply.status(404).send({ error: 'Coupon not found' });

    if ((coupon as { uses_count: number }).uses_count > 0) {
      const { error } = await db.from('coupons').update({ active: false }).eq('id', request.params.id).eq('tenant_id', request.tenantId);
      if (error) return reply.status(500).send({ error: error.message });
      return reply.send({ deactivated: true });
    }

    const { error } = await db.from('coupons').delete().eq('id', request.params.id).eq('tenant_id', request.tenantId);
    if (error) return reply.status(500).send({ error: error.message });
    return reply.send({ deleted: true });
  });
}
