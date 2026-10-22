import type { FastifyRequest, FastifyReply } from 'fastify';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import { getServerClient } from '@alphabot/database';
import { cacheGet, cacheSet } from '../lib/redis.js';

declare module 'fastify' {
  interface FastifyRequest {
    tenantId: string;
    userId: string;
    userRole: 'admin' | 'supervisor' | 'agent';
    apiKeyScopes?: string[];
  }
}

// Module-level singleton for JWT validation — avoids allocating a new SupabaseClient
// (with its internal fetch wrappers and event emitters) on every authenticated request.
let _anonClient: ReturnType<typeof createClient> | null = null;

function getAnonClient() {
  if (_anonClient) return _anonClient;
  _anonClient = createClient(
    process.env['SUPABASE_URL']!,
    process.env['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY']!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  return _anonClient;
}

interface AuthContext {
  tenantId: string;
  userId:   string;
  userRole: 'admin' | 'supervisor' | 'agent';
}

// Cache auth results for 30s — safe since JWTs are valid for 1h and the
// tenant→user mapping is stable within that window.
const AUTH_CACHE_TTL = 30;

async function resolveAuthContext(token: string): Promise<AuthContext | null> {
  const cacheKey = `auth:${createHash('sha256').update(token).digest('hex').slice(0, 32)}`;

  const cached = await cacheGet<AuthContext>(cacheKey);
  if (cached) return cached;

  const { data: { user }, error } = await getAnonClient().auth.getUser(token);
  if (error || !user) return null;

  const db = getServerClient();

  // Try tenant_users first (service-role bypasses RLS)
  const { data: membership } = await db
    .from('tenant_users')
    .select('tenant_id, role')
    .eq('user_id', user.id)
    .single();

  if (membership) {
    const ctx: AuthContext = {
      tenantId: membership.tenant_id as string,
      userId:   user.id,
      userRole: membership.role as 'admin' | 'supervisor' | 'agent',
    };
    await cacheSet(cacheKey, ctx, AUTH_CACHE_TTL);
    return ctx;
  }

  // Fallback: platform_users get admin access to the earliest tenant
  const { data: platformUser } = await db
    .from('platform_users')
    .select('user_id')
    .eq('user_id', user.id)
    .single();

  if (platformUser) {
    const { data: tenant } = await db
      .from('tenants')
      .select('id')
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (!tenant) return null;

    const ctx: AuthContext = {
      tenantId: tenant.id as string,
      userId:   user.id,
      userRole: 'admin',
    };
    await cacheSet(cacheKey, ctx, AUTH_CACHE_TTL);
    return ctx;
  }

  return null;
}

interface ApiKeyContext {
  tenantId: string;
  keyId:    string;
  scopes:   string[];
}

const API_KEY_CACHE_TTL = 30;

async function resolveApiKeyContext(rawKey: string): Promise<ApiKeyContext | null> {
  const keyHash = createHash('sha256').update(rawKey).digest('hex');
  const cacheKey = `apikey:${keyHash.slice(0, 32)}`;

  const cached = await cacheGet<ApiKeyContext>(cacheKey);
  if (cached) return cached;

  const db = getServerClient();
  const { data: row } = await db
    .from('api_keys')
    .select('id, tenant_id, scopes, revoked_at')
    .eq('key_hash', keyHash)
    .is('revoked_at', null)
    .maybeSingle();

  if (!row) return null;

  const ctx: ApiKeyContext = {
    tenantId: row.tenant_id as string,
    keyId:    row.id as string,
    scopes:   (row.scopes as string[]) ?? [],
  };
  await cacheSet(cacheKey, ctx, API_KEY_CACHE_TTL);

  // Best-effort, non-blocking — a stale last_used_at by a few requests doesn't matter.
  void db.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', ctx.keyId).then(() => {}, () => {});

  return ctx;
}

/**
 * Fastify preHandler: accepts either a tenant-scoped API key (X-API-Key header
 * — programmatic access for a tenant's own systems, scoped via apiKeyScopes)
 * or a Supabase JWT (Authorization: Bearer — the dashboard's own session).
 * Both paths attach tenantId to the request for downstream tenant scoping.
 * Auth context is cached in Redis for 30s to eliminate repeat DB lookups.
 */
export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const apiKeyHeader = request.headers['x-api-key'];
  if (typeof apiKeyHeader === 'string' && apiKeyHeader) {
    const apiKeyCtx = await resolveApiKeyContext(apiKeyHeader);
    if (!apiKeyCtx) {
      await reply.status(401).send({ success: false, error: 'Invalid or revoked API key' });
      return;
    }
    request.tenantId     = apiKeyCtx.tenantId;
    request.userId       = `api_key:${apiKeyCtx.keyId}`;
    request.userRole     = 'agent';
    request.apiKeyScopes = apiKeyCtx.scopes;
    return;
  }

  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    await reply.status(401).send({ success: false, error: 'Missing auth token' });
    return;
  }

  const token = authHeader.slice(7);
  const ctx   = await resolveAuthContext(token);

  if (!ctx) {
    await reply.status(401).send({ success: false, error: 'Invalid token or no tenant membership' });
    return;
  }

  request.tenantId  = ctx.tenantId;
  request.userId    = ctx.userId;
  request.userRole  = ctx.userRole;
}

/**
 * Fastify preHandler: restricts a route to a required scope when the caller
 * authenticated via API key. A dashboard session (JWT) always passes — scopes
 * only constrain programmatic API-key access, not the dashboard itself.
 */
export function requireScope(scope: string) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.apiKeyScopes) return; // JWT session — role-based access already applied
    if (!request.apiKeyScopes.includes(scope)) {
      await reply.status(403).send({ success: false, error: `API key missing required scope: ${scope}` });
    }
  };
}

export function requireRole(...roles: Array<'admin' | 'supervisor' | 'agent'>) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!roles.includes(request.userRole)) {
      await reply.status(403).send({ success: false, error: 'Insufficient permissions' });
    }
  };
}
