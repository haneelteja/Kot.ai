'use server';

import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { revalidatePath }         from 'next/cache';
import { getSession }             from '@/lib/session';
import { randomBytes, createHash } from 'crypto';

export type ApiKey = {
  id:            string;
  name:          string;
  key_prefix:    string;
  scopes:        string[];
  last_used_at:  string | null;
  created_at:    string;
};

export const API_KEY_SCOPES = ['orders:write'] as const;

export async function listApiKeys(): Promise<{ keys: ApiKey[]; error?: string }> {
  const session = await getSession();
  if (!session) return { keys: [], error: 'Unauthorized' };

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from('api_keys')
    .select('id, name, key_prefix, scopes, last_used_at, created_at')
    .eq('tenant_id', session.tenantId)
    .is('revoked_at', null)
    .order('created_at', { ascending: true });

  if (error) return { keys: [], error: error.message };
  return { keys: (data ?? []) as ApiKey[] };
}

export async function createApiKey(name: string, scopes: string[]): Promise<{ key?: ApiKey; secret?: string; error?: string }> {
  const session = await getSession();
  if (!session) return { error: 'Unauthorized' };

  const trimmedName = name.trim();
  if (!trimmedName) return { error: 'Name is required' };

  const validScopes = scopes.filter(s => (API_KEY_SCOPES as readonly string[]).includes(s));
  if (validScopes.length === 0) return { error: 'Select at least one scope' };

  const rawKey  = `kot_live_${randomBytes(24).toString('hex')}`;
  const keyHash = createHash('sha256').update(rawKey).digest('hex');

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from('api_keys')
    .insert({
      tenant_id:  session.tenantId,
      name:       trimmedName,
      key_hash:   keyHash,
      key_prefix: rawKey.slice(0, 16),
      scopes:     validScopes,
    })
    .select('id, name, key_prefix, scopes, last_used_at, created_at')
    .single();

  if (error) return { error: error.message };
  revalidatePath('/settings');
  return { key: data as ApiKey, secret: rawKey };
}

export async function revokeApiKey(id: string): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session) return { error: 'Unauthorized' };

  const admin = getSupabaseAdminClient();
  const { error } = await admin
    .from('api_keys')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)
    .eq('tenant_id', session.tenantId);

  if (error) return { error: error.message };
  revalidatePath('/settings');
  return {};
}
