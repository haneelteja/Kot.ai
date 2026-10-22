'use server';

import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { revalidatePath }         from 'next/cache';
import { getSession }             from '@/lib/session';

// ─── Blocked numbers ────────────────────────────────────────────────────────

export type BlockedNumber = {
  id:         string;
  phone:      string;
  reason:     string | null;
  created_at: string;
};

export async function listBlockedNumbers(): Promise<{ numbers: BlockedNumber[]; error?: string }> {
  const session = await getSession();
  if (!session) return { numbers: [], error: 'Unauthorized' };

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from('blocked_numbers')
    .select('id, phone, reason, created_at')
    .eq('tenant_id', session.tenantId)
    .order('created_at', { ascending: true });

  if (error) return { numbers: [], error: error.message };
  return { numbers: (data ?? []) as BlockedNumber[] };
}

export async function addBlockedNumber(phone: string, reason: string): Promise<{ number?: BlockedNumber; error?: string }> {
  const session = await getSession();
  if (!session) return { error: 'Unauthorized' };

  const cleaned = phone.trim().replace(/\s+/g, '');
  if (!cleaned) return { error: 'Phone number is required' };
  if (!/^\+?\d{7,15}$/.test(cleaned)) return { error: 'Enter a valid phone number (digits only, optionally starting with +)' };

  const normalized = cleaned.startsWith('+') ? cleaned : `+${cleaned}`;

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from('blocked_numbers')
    .insert({ tenant_id: session.tenantId, phone: normalized, reason: reason.trim() || null })
    .select('id, phone, reason, created_at')
    .single();

  if (error) {
    if (error.code === '23505') return { error: 'This number is already blocked' };
    return { error: error.message };
  }

  revalidatePath('/settings');
  return { number: data as BlockedNumber };
}

export async function removeBlockedNumber(id: string): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session) return { error: 'Unauthorized' };

  const admin = getSupabaseAdminClient();
  const { error } = await admin
    .from('blocked_numbers')
    .delete()
    .eq('id', id)
    .eq('tenant_id', session.tenantId);

  if (error) return { error: error.message };
  revalidatePath('/settings');
  return {};
}

// ─── Auto-replies ───────────────────────────────────────────────────────────

export type AutoReply = {
  id:           string;
  product_slug: string | null;
  keyword:      string;
  match_type:   'exact' | 'contains' | 'regex';
  reply_text:   string;
  active:       boolean;
  sort_order:   number;
  created_at:   string;
};

export async function listAutoReplies(): Promise<{ rules: AutoReply[]; error?: string }> {
  const session = await getSession();
  if (!session) return { rules: [], error: 'Unauthorized' };

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from('auto_replies')
    .select('id, product_slug, keyword, match_type, reply_text, active, sort_order, created_at')
    .eq('tenant_id', session.tenantId)
    .order('sort_order', { ascending: true });

  if (error) return { rules: [], error: error.message };
  return { rules: (data ?? []) as AutoReply[] };
}

export async function addAutoReply(input: {
  productSlug: string | null;
  keyword:     string;
  matchType:   'exact' | 'contains' | 'regex';
  replyText:   string;
}): Promise<{ rule?: AutoReply; error?: string }> {
  const session = await getSession();
  if (!session) return { error: 'Unauthorized' };

  const keyword   = input.keyword.trim();
  const replyText = input.replyText.trim();
  if (!keyword) return { error: 'Keyword is required' };
  if (!replyText) return { error: 'Reply text is required' };

  if (input.matchType === 'regex') {
    try { new RegExp(keyword); } catch { return { error: 'Invalid regular expression' }; }
  }

  const admin = getSupabaseAdminClient();

  const { data: existing } = await admin
    .from('auto_replies')
    .select('sort_order')
    .eq('tenant_id', session.tenantId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSortOrder = ((existing as { sort_order: number } | null)?.sort_order ?? -1) + 1;

  const { data, error } = await admin
    .from('auto_replies')
    .insert({
      tenant_id:    session.tenantId,
      product_slug: input.productSlug,
      keyword,
      match_type:   input.matchType,
      reply_text:   replyText,
      sort_order:   nextSortOrder,
    })
    .select('id, product_slug, keyword, match_type, reply_text, active, sort_order, created_at')
    .single();

  if (error) return { error: error.message };
  revalidatePath('/settings');
  return { rule: data as AutoReply };
}

export async function toggleAutoReply(id: string, active: boolean): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session) return { error: 'Unauthorized' };

  const admin = getSupabaseAdminClient();
  const { error } = await admin
    .from('auto_replies')
    .update({ active })
    .eq('id', id)
    .eq('tenant_id', session.tenantId);

  if (error) return { error: error.message };
  revalidatePath('/settings');
  return {};
}

export async function removeAutoReply(id: string): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session) return { error: 'Unauthorized' };

  const admin = getSupabaseAdminClient();
  const { error } = await admin
    .from('auto_replies')
    .delete()
    .eq('id', id)
    .eq('tenant_id', session.tenantId);

  if (error) return { error: error.message };
  revalidatePath('/settings');
  return {};
}
