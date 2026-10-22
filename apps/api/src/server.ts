import Fastify, { type FastifyError } from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import formbody from '@fastify/formbody';
import multipart from '@fastify/multipart';

import { webhookRoutes } from './routes/webhook/index.js';
import { conversationRoutes } from './routes/conversations/index.js';
import { kbRoutes } from './routes/kb/index.js';
import { kbDocumentRoutes } from './routes/kb/documents.js';
import { kbMediaRoutes } from './routes/kb/media.js';
import { escalationRoutes } from './routes/escalations/index.js';
import { orderRoutes, easebuzzCallbackRoute } from './routes/orders/index.js';
import { subscriptionRoutes } from './routes/subscriptions/index.js';
import { settingsRoutes } from './routes/settings/index.js';
import { buttonTemplateRoutes } from './routes/button-templates/index.js';
import { scheduledMessageRoutes } from './routes/scheduled-messages/index.js';
import { startScheduler } from './jobs/scheduler.js';
import { runInsightsForAllTenants } from './services/insights/generator.js';
import { getServerClient } from '@alphabot/database';
import { connectRedis, getRedis } from './lib/redis.js';
import { initSentry, captureException } from './lib/sentry.js';

initSentry();

// Connect Redis before registering plugins so the rate-limit store is ready.
// connectRedis() is a no-op if REDIS_URL is not set.
await connectRedis();

const isProd = process.env['NODE_ENV'] === 'production';
const server = Fastify({
  logger: isProd
    ? { level: 'info' }
    : { level: 'debug', transport: { target: 'pino-pretty' } },
});

// ─── Body parsers ─────────────────────────────────────────────────────────────
await server.register(formbody);
await server.register(multipart, {
  limits: { fileSize: 50 * 1024 * 1024, files: 1 },
});

// Capture the raw JSON body alongside the parsed one — needed to verify Meta's
// X-Hub-Signature-256 HMAC on inbound webhooks (the signature is computed over
// the exact raw bytes, not a re-serialized object).
server.addContentTypeParser(
  'application/json',
  { parseAs: 'buffer' },
  (request, rawBody: Buffer, done: (err: Error | null, body?: unknown) => void) => {
    (request as typeof request & { rawBody?: Buffer }).rawBody = rawBody;
    if (rawBody.length === 0) { done(null, {}); return; }
    try {
      done(null, JSON.parse(rawBody.toString('utf8')));
    } catch (err) {
      done(err as Error, undefined);
    }
  },
);

// ─── Security plugins ─────────────────────────────────────────────────────────
await server.register(helmet);
await server.register(cors, {
  origin: (origin, cb) => {
    const allowed = (process.env['WEB_BASE_URL'] ?? 'http://localhost:3000').split(',').map(s => s.trim());
    if (!origin || allowed.includes(origin) || /\.vercel\.app$/.test(origin)) {
      cb(null, true);
    } else {
      cb(new Error('CORS: origin not allowed'), false);
    }
  },
  credentials: true,
});

const redisClient = getRedis();
await server.register(rateLimit, {
  max: 200,
  timeWindow: '1 minute',
  // Use Redis store when available so limits survive across multiple instances.
  ...(redisClient ? { redis: redisClient as Parameters<typeof rateLimit>[1] extends { redis?: infer R } ? R : never } : {}),
  keyGenerator(request) {
    const params = request.params as Record<string, string> | undefined;
    if (params?.['tenantId']) return `rl:tenant:${params['tenantId']}`;
    const req = request as typeof request & { tenantId?: string };
    if (req.tenantId) return `rl:tenant:${req.tenantId}`;
    return `rl:ip:${request.ip}`;
  },
});

// ─── Global error handler ─────────────────────────────────────────────────────
server.setErrorHandler((error: FastifyError, _request, reply) => {
  const statusCode  = error.statusCode ?? 500;
  const isServer    = statusCode >= 500;
  const timestamp   = new Date().toISOString();

  captureException(error, { url: _request.url, method: _request.method, statusCode });

  // Structured response — frontend apiClient reads errorCode / message / details
  void reply.status(statusCode).send({
    status:    'error',
    errorCode: isServer ? 'API_INTERNAL_ERROR' : (error.code ?? 'API_ERROR'),
    message:   isServer ? 'Internal server error' : error.message,
    details:   isServer ? undefined : (error.validation ? 'Validation failed' : error.message),
    timestamp,
  });
});

// ─── Routes ───────────────────────────────────────────────────────────────────
await server.register(webhookRoutes,        { prefix: '/api/webhook' });
await server.register(conversationRoutes,   { prefix: '/api/conversations' });
await server.register(kbRoutes,             { prefix: '/api/kb' });
await server.register(kbDocumentRoutes,     { prefix: '/api/kb' });
await server.register(kbMediaRoutes,        { prefix: '/api/kb' });
await server.register(escalationRoutes,     { prefix: '/api/escalations' });
await server.register(orderRoutes,          { prefix: '/api/orders' });
await server.register(easebuzzCallbackRoute,  { prefix: '/api/payments' });
await server.register(subscriptionRoutes,   { prefix: '/api/subscriptions' });
await server.register(settingsRoutes,       { prefix: '/api/settings' });
await server.register(buttonTemplateRoutes,   { prefix: '/api/button-templates' });
await server.register(scheduledMessageRoutes, { prefix: '/api/scheduled-messages' });

// ─── Health check ─────────────────────────────────────────────────────────────
server.get('/health', async () => {
  const checks: Record<string, string> = { api: 'ok' };

  const dbCheck = Promise.resolve(getServerClient().from('tenants').select('id').limit(1))
    .then(() => { checks['database'] = 'ok'; })
    .catch(() => { checks['database'] = 'error'; });

  const redis = getRedis();
  const redisCheck = redis
    ? Promise.resolve(redis.ping())
        .then(() => { checks['redis'] = 'ok'; })
        .catch(() => { checks['redis'] = 'error'; })
    : Promise.resolve().then(() => { checks['redis'] = 'not_configured'; });

  await Promise.all([dbCheck, redisCheck]);

  const healthy = checks['database'] === 'ok';
  return { status: healthy ? 'ok' : 'degraded', ts: new Date().toISOString(), checks };
});

// ─── Admin: manual insights trigger ──────────────────────────────────────────
server.post('/api/admin/run-insights', async (request, reply) => {
  const secret = process.env['CRON_SECRET'];
  if (!secret || request.headers['x-cron-secret'] !== secret) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }
  void runInsightsForAllTenants().catch(err =>
    server.log.error({ err }, '[Admin] run-insights failed')
  );
  return { ok: true, message: 'Insights generation started in background' };
});

// ─── Start ────────────────────────────────────────────────────────────────────
const port = Number(process.env['API_PORT'] ?? 4000);
const host = '0.0.0.0';

try {
  await server.listen({ port, host });
  server.log.info(`KOT.ai API listening on ${host}:${port}`);

  startScheduler();
} catch (err) {
  server.log.error(err);
  process.exit(1);
}
