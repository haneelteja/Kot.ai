import type { FastifyInstance } from 'fastify';
import { getServerClient } from '@alphabot/database';
import { requireAuth } from '../../middleware/auth.js';

export async function quickReplyRoutes(fastify: FastifyInstance): Promise<void> {
  const db = getServerClient();

  fastify.addHook('preHandler', requireAuth);

  fastify.get('/', async (request, reply) => {
    const { data, error } = await db
      .from('quick_replies')
      .select('id, label, message, created_at')
      .eq('tenant_id', request.tenantId)
      .order('created_at', { ascending: true });

    if (error) return reply.status(500).send({ error: error.message });
    return reply.send({ quickReplies: data ?? [] });
  });

  fastify.post<{ Body: { label: string; message: string } }>('/', async (request, reply) => {
    const { label, message } = request.body;
    if (!label?.trim() || !message?.trim()) {
      return reply.status(400).send({ error: 'label and message are required' });
    }

    const { data, error } = await db
      .from('quick_replies')
      .insert({ tenant_id: request.tenantId, label: label.trim(), message: message.trim() })
      .select()
      .single();

    if (error) return reply.status(500).send({ error: error.message });
    return reply.send({ quickReply: data });
  });

  fastify.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const { error } = await db
      .from('quick_replies')
      .delete()
      .eq('id', request.params.id)
      .eq('tenant_id', request.tenantId);

    if (error) return reply.status(500).send({ error: error.message });
    return reply.send({ deleted: true });
  });
}
