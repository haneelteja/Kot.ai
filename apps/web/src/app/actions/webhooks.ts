'use server';

import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { revalidatePath }         from 'next/cache';
import { getSession }             from '@/lib/session';
import { randomBytes }            from 'crypto';

export type OutboundWebhook = {
  id:          string;
  url:         string;
  event_types: string[];
  active:      boolean;
  created_at:  string;
};

export type WebhookDelivery = {
  id:               string;
  webhook_id:       string;
  event_type:       string;
  attempt:          number;
  status_code:      number | null;
  response_time_ms: number | null;
  error_message:    string | null;
  created_at:       string;
};

export const WEBHOOK_EVENT_TYPES = ['order.created', 'order.paid', 'order.status_changed'] as const;

export async function listOutboundWebhooks(): Promise<{ webhooks: OutboundWebhook[]; error?: string }> {
  const session = await getSession();
  if (!session) return { webhooks: [], error: 'Unauthorized' };

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from('outbound_webhooks')
    .select('id, url, event_types, active, created_at')
    .eq('tenant_id', session.tenantId)
    .order('created_at', { ascending: true });

  if (error) return { webhooks: [], error: error.message };
  return { webhooks: (data ?? []) as OutboundWebhook[] };
}

export async function addOutboundWebhook(url: string, eventTypes: string[]): Promise<{ webhook?: OutboundWebhook; secret?: string; error?: string }> {
  const session = await getSession();
  if (!session) return { error: 'Unauthorized' };

  const trimmedUrl = url.trim();
  if (!trimmedUrl) return { error: 'URL is required' };

  let parsed: URL;
  try {
    parsed = new URL(trimmedUrl);
  } catch {
    return { error: 'Enter a valid URL' };
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return { error: 'URL must be http or https' };

  const validEventTypes = eventTypes.filter(e => (WEBHOOK_EVENT_TYPES as readonly string[]).includes(e));
  if (validEventTypes.length === 0) return { error: 'Select at least one event type' };

  const admin  = getSupabaseAdminClient();
  const secret = randomBytes(24).toString('hex');

  const { data, error } = await admin
    .from('outbound_webhooks')
    .insert({ tenant_id: session.tenantId, url: trimmedUrl, event_types: validEventTypes, secret })
    .select('id, url, event_types, active, created_at')
    .single();

  if (error) return { error: error.message };
  revalidatePath('/settings');
  return { webhook: data as OutboundWebhook, secret };
}

export async function toggleOutboundWebhook(id: string, active: boolean): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session) return { error: 'Unauthorized' };

  const admin = getSupabaseAdminClient();
  const { error } = await admin
    .from('outbound_webhooks')
    .update({ active })
    .eq('id', id)
    .eq('tenant_id', session.tenantId);

  if (error) return { error: error.message };
  revalidatePath('/settings');
  return {};
}

export async function removeOutboundWebhook(id: string): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session) return { error: 'Unauthorized' };

  const admin = getSupabaseAdminClient();
  const { error } = await admin
    .from('outbound_webhooks')
    .delete()
    .eq('id', id)
    .eq('tenant_id', session.tenantId);

  if (error) return { error: error.message };
  revalidatePath('/settings');
  return {};
}

export async function listWebhookDeliveries(webhookId: string): Promise<{ deliveries: WebhookDelivery[]; error?: string }> {
  const session = await getSession();
  if (!session) return { deliveries: [], error: 'Unauthorized' };

  const admin = getSupabaseAdminClient();

  // Scope via the parent webhook's tenant_id rather than trusting the caller's webhookId alone.
  const { data: owned } = await admin
    .from('outbound_webhooks')
    .select('id')
    .eq('id', webhookId)
    .eq('tenant_id', session.tenantId)
    .maybeSingle();
  if (!owned) return { deliveries: [], error: 'Not found' };

  const { data, error } = await admin
    .from('outbound_webhook_deliveries')
    .select('id, webhook_id, event_type, attempt, status_code, response_time_ms, error_message, created_at')
    .eq('webhook_id', webhookId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) return { deliveries: [], error: error.message };
  return { deliveries: (data ?? []) as WebhookDelivery[] };
}
