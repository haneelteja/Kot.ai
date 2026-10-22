import type { FastifyInstance } from 'fastify';
import { getServerClient } from '@alphabot/database';

const WINDOW_HOURS = 24;

/**
 * Token-gated operational metrics in Prometheus exposition format — same
 * gating pattern as the existing /api/admin/run-insights route (a shared
 * secret header, not tenant auth; this is a platform-wide ops endpoint, not
 * a tenant-facing feature). 404s rather than 401s when no token is
 * configured, so the route doesn't even reveal its own existence by default.
 */
export async function metricsRoutes(fastify: FastifyInstance): Promise<void> {
  const db = getServerClient();

  fastify.get('/metrics', async (request, reply) => {
    const token = process.env['METRICS_TOKEN'];
    if (!token) return reply.status(404).send('Not found');

    const authHeader = request.headers.authorization;
    if (authHeader !== `Bearer ${token}`) return reply.status(404).send('Not found');

    const since = new Date(Date.now() - WINDOW_HOURS * 60 * 60 * 1000).toISOString();

    const [aiCallsRes, webhookRes, tenantsRes] = await Promise.all([
      db.from('ai_calls').select('status, latency_ms').gte('created_at', since),
      db.from('outbound_webhook_deliveries').select('status_code, error_message').gte('created_at', since),
      db.from('tenants').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    ]);

    const aiCalls = aiCallsRes.data ?? [];
    const aiSuccessCount = aiCalls.filter(c => c.status === 'success').length;
    const aiErrorCount   = aiCalls.filter(c => c.status === 'error').length;
    const avgLatencyMs   = aiCalls.length
      ? Math.round(aiCalls.reduce((sum, c) => sum + ((c as { latency_ms: number }).latency_ms ?? 0), 0) / aiCalls.length)
      : 0;

    const deliveries = webhookRes.data ?? [];
    const webhookSuccessCount = deliveries.filter(d => !d.error_message && (d.status_code ?? 0) < 300).length;
    const webhookErrorCount   = deliveries.length - webhookSuccessCount;

    const activeTenants = tenantsRes.count ?? 0;

    const lines = [
      `# HELP kotai_active_tenants Active tenants on the platform`,
      `# TYPE kotai_active_tenants gauge`,
      `kotai_active_tenants ${activeTenants}`,
      ``,
      `# HELP kotai_ai_calls_total AI calls in the last ${WINDOW_HOURS}h, by status`,
      `# TYPE kotai_ai_calls_total counter`,
      `kotai_ai_calls_total{status="success"} ${aiSuccessCount}`,
      `kotai_ai_calls_total{status="error"} ${aiErrorCount}`,
      ``,
      `# HELP kotai_ai_call_latency_ms_avg Average AI call latency in ms over the last ${WINDOW_HOURS}h`,
      `# TYPE kotai_ai_call_latency_ms_avg gauge`,
      `kotai_ai_call_latency_ms_avg ${avgLatencyMs}`,
      ``,
      `# HELP kotai_webhook_deliveries_total Outbound webhook delivery attempts in the last ${WINDOW_HOURS}h, by outcome`,
      `# TYPE kotai_webhook_deliveries_total counter`,
      `kotai_webhook_deliveries_total{outcome="success"} ${webhookSuccessCount}`,
      `kotai_webhook_deliveries_total{outcome="error"} ${webhookErrorCount}`,
      ``,
    ];

    return reply
      .header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
      .send(lines.join('\n'));
  });
}
