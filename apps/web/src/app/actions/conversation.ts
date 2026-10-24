'use server';

import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getSession }             from '@/lib/session';
import { revalidatePath }         from 'next/cache';
import { unstable_cache }         from 'next/cache';

export interface LinkedOrderSummary {
  id:          string;
  order_ref:   string | null;
  status:      string;
  total:       number;
  pickup_code: string | null;
  created_at:  string;
}

export interface LinkedBookingSummary {
  id:           string;
  party_size:   number;
  booking_date: string;
  booking_time: string;
  status:       string;
}

export interface ConversationDetail {
  id:               string;
  status:           string;
  product_type:     string;
  assigned_agent_id: string | null;
  contact: { phone: string | null; name: string | null } | null;
  messages: Array<{ id: string; role: 'user' | 'assistant' | 'system'; content: string; timestamp: string; confidence_score: number | null }>;
  teamMembers: Array<{ id: string; name: string }>;
  quickReplies: Array<{ id: string; label: string; message: string }>;
  /** HND-02: the most recent order/booking linked to this conversation, restaurant_bot only. */
  linkedOrder?:   LinkedOrderSummary | null;
  linkedBooking?: LinkedBookingSummary | null;
}

const getAuthUsersCached = unstable_cache(
  async (tid: string) => {
    const { data: { users } } = await getSupabaseAdminClient().auth.admin.listUsers({ page: 1, perPage: 200 });
    return users;
  },
  ['auth-users'],
  { revalidate: 600 },
);

// Shared detail fetch — used by both the Conversations split-pane (chats tab)
// and the /conversations/[id] redirect target, so there is one source of
// truth for "what does opening a conversation need" instead of two.
export async function getConversationDetailAction(conversationId: string): Promise<ConversationDetail | null> {
  const supabase = await getSupabaseServerClient();
  const admin    = getSupabaseAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: tenantUser } = await admin
    .from('tenant_users')
    .select('tenant_id')
    .eq('user_id', user.id)
    .single();
  const tenantId = tenantUser?.tenant_id;
  if (!tenantId) return null;

  const { data: conversation } = await admin
    .from('conversations')
    .select('id, status, product_type, assigned_agent_id, contacts(phone, name)')
    .eq('id', conversationId)
    .eq('tenant_id', tenantId)
    .single();

  if (!conversation) return null;

  const { data: messagesDesc } = await admin
    .from('messages')
    .select('id, role, content, timestamp, confidence_score')
    .eq('conversation_id', conversationId)
    .order('timestamp', { ascending: false })
    .limit(50);

  const [{ data: tenantUsersData }, { data: quickRepliesData }] = await Promise.all([
    admin.from('tenant_users').select('user_id, role').eq('tenant_id', tenantId),
    admin.from('quick_replies').select('id, label, message').eq('tenant_id', tenantId).order('created_at', { ascending: true }),
  ]);

  const memberIds   = new Set((tenantUsersData ?? []).map(tu => tu.user_id));
  const authUsers   = await getAuthUsersCached(tenantId);
  const authUserMap = new Map(authUsers.filter(u => memberIds.has(u.id)).map(u => [u.id, u]));

  const teamMembers = (tenantUsersData ?? []).map(tu => {
    const authUser = authUserMap.get(tu.user_id);
    return {
      id:   tu.user_id,
      name: (authUser?.user_metadata?.full_name as string | undefined) ?? authUser?.email ?? tu.user_id,
    };
  });

  // HND-02: side-panel order/booking context — restaurant_bot only, since
  // neither table applies to other bot types.
  let linkedOrder: LinkedOrderSummary | null = null;
  let linkedBooking: LinkedBookingSummary | null = null;
  if (conversation.product_type === 'restaurant_bot') {
    const [{ data: orderRow }, { data: bookingRow }] = await Promise.all([
      admin.from('orders').select('id, order_ref, status, total, pickup_code, created_at')
        .eq('conversation_id', conversationId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      admin.from('bookings').select('id, party_size, booking_date, booking_time, status')
        .eq('conversation_id', conversationId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ]);
    linkedOrder = (orderRow as LinkedOrderSummary | null) ?? null;
    linkedBooking = (bookingRow as LinkedBookingSummary | null) ?? null;
  }

  return {
    id:                conversation.id,
    status:            conversation.status,
    product_type:      conversation.product_type,
    assigned_agent_id: conversation.assigned_agent_id ?? null,
    contact:           (conversation.contacts as unknown as { phone: string | null; name: string | null } | null) ?? null,
    messages:          ((messagesDesc ?? []) as ConversationDetail['messages']).reverse(),
    teamMembers,
    quickReplies:      (quickRepliesData ?? []) as ConversationDetail['quickReplies'],
    linkedOrder,
    linkedBooking,
  };
}

// DEV-ONLY — remove before production (see production checklist §5)
export async function clearConversationAction(conversationId: string): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session) return { error: 'Not authenticated' };

  const admin = getSupabaseAdminClient();

  // Verify conversation belongs to the caller's tenant
  const { data: conv } = await admin
    .from('conversations')
    .select('tenant_id')
    .eq('id', conversationId)
    .single();

  if (!conv || conv.tenant_id !== session.tenantId) {
    return { error: 'Not authorised' };
  }

  // Delete all messages first (no guaranteed cascade)
  const { error: msgErr } = await admin
    .from('messages')
    .delete()
    .eq('conversation_id', conversationId);
  if (msgErr) return { error: msgErr.message };

  // Reset conversation so the bot can start fresh
  const { error: convErr } = await admin
    .from('conversations')
    .update({ status: 'open', assigned_agent_id: null })
    .eq('id', conversationId);
  if (convErr) return { error: convErr.message };

  revalidatePath(`/conversations/${conversationId}`);
  return {};
}
