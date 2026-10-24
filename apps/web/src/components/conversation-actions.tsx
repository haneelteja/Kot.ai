'use client';

import { useState, useTransition } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Send, UserCheck, RefreshCw, UserPlus, ChevronDown, Trash2, MessageSquareText } from 'lucide-react';
import { clearConversationAction } from '@/app/actions/conversation';

interface TeamMember {
  id: string;
  name: string;
}

interface QuickReply {
  id:      string;
  label:   string;
  message: string;
}

interface Props {
  conversationId: string;
  status: string;
  teamMembers: TeamMember[];
  assignedAgentId: string | null;
  quickReplies?: QuickReply[];
}

export function ConversationActions({ conversationId, status, teamMembers, assignedAgentId, quickReplies = [] }: Props) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [actioning, setActioning] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [clearPending, startClearTransition] = useTransition();
  const router = useRouter();
  const supabase = getSupabaseBrowserClient();

  async function getToken() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? '';
  }

  async function apiPost(path: string, body?: object) {
    const token = await getToken();
    const hasBody = body !== undefined;
    return fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}${path}`, {
      method: 'POST',
      headers: {
        ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
        Authorization: `Bearer ${token}`,
      },
      body: hasBody ? JSON.stringify(body) : undefined,
    });
  }

  async function apiPatch(path: string, body: object) {
    const token = await getToken();
    return fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}${path}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
  }

  async function handleTakeOver() {
    setActioning(true);
    await apiPost(`/api/conversations/${conversationId}/takeover`);
    setActioning(false);
    router.refresh();
  }

  async function handleClaim() {
    setActioning(true);
    await apiPost(`/api/conversations/${conversationId}/claim`);
    setActioning(false);
    router.refresh();
  }

  async function handleRelease() {
    setActioning(true);
    await apiPost(`/api/conversations/${conversationId}/release`);
    setActioning(false);
    router.refresh();
  }

  async function handleAssign(agentId: string | null) {
    setShowAssign(false);
    await apiPatch(`/api/conversations/${conversationId}`, { assigned_agent_id: agentId });
    router.refresh();
  }

  function handleClearChat() {
    if (!clearConfirm) { setClearConfirm(true); return; }
    startClearTransition(async () => {
      await clearConversationAction(conversationId);
      setClearConfirm(false);
      window.location.reload();
    });
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    setSending(true);
    setSendError(null);
    const res = await apiPost(`/api/conversations/${conversationId}/send`, { message });
    if (res.ok) {
      setMessage('');
    } else {
      const body = await res.json().catch(() => ({})) as { error?: string };
      setSendError(body.error ?? 'Failed to send message');
    }
    setSending(false);
  }

  const assignedAgent = teamMembers.find(m => m.id === assignedAgentId);

  return (
    <div className="bg-white border-t border-line shrink-0">
      {/* Status bar */}
      <div className="flex items-center gap-2.5 px-5 py-2.5 border-b border-line flex-wrap">
        {status === 'open' && (
          <>
            <p className="text-xs text-muted-foreground flex-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-ready mr-1.5 mb-px" />
              Bot is handling this conversation
            </p>
            <button
              type="button"
              onClick={handleTakeOver}
              disabled={actioning}
              className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border border-line text-muted-foreground hover:bg-amber-50 hover:border-amber-200 hover:text-amber-700 disabled:opacity-50 transition-colors font-medium"
            >
              <UserPlus size={13} />
              {actioning ? 'Taking over…' : 'Take over'}
            </button>
          </>
        )}
        {status === 'escalated' && (
          <button
            type="button"
            onClick={handleClaim}
            disabled={actioning}
            className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg bg-brand-strong text-white hover:opacity-90 disabled:opacity-50 transition-colors font-medium shadow-sm"
          >
            <UserCheck size={13} />
            {actioning ? 'Claiming…' : 'Claim conversation'}
          </button>
        )}
        {status === 'bot_paused' && (
          <div className="flex items-center gap-2 flex-1 flex-wrap">
            <button
              type="button"
              onClick={handleRelease}
              disabled={actioning}
              className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border border-line text-muted-foreground hover:bg-sunken disabled:opacity-50 transition-colors font-medium"
            >
              <RefreshCw size={13} />
              {actioning ? 'Releasing…' : 'Release to bot'}
            </button>

            {/* Assign dropdown */}
            {teamMembers.length > 0 && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowAssign(v => !v)}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-line text-muted-foreground hover:bg-sunken transition-colors font-medium"
                >
                  <UserCheck size={13} />
                  {assignedAgent ? assignedAgent.name : 'Assign to…'}
                  <ChevronDown size={11} />
                </button>
                {showAssign && (
                  <div className="absolute bottom-full left-0 mb-1 w-48 bg-white rounded-xl border border-line shadow-lg z-10 overflow-hidden">
                    {teamMembers.map(m => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => handleAssign(m.id)}
                        className={`w-full text-left px-3 py-2 text-xs hover:bg-sunken transition-colors ${assignedAgentId === m.id ? 'text-brand-strong font-semibold' : 'text-text'}`}
                      >
                        {m.name}
                      </button>
                    ))}
                    {assignedAgentId && (
                      <button
                        type="button"
                        onClick={() => handleAssign(null)}
                        className="w-full text-left px-3 py-2 text-xs text-red-500 hover:bg-red-50 transition-colors border-t border-line"
                      >
                        Unassign
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        {status === 'resolved' && (
          <p className="text-xs text-muted-foreground">Conversation resolved</p>
        )}

        {/* DEV-ONLY — remove before production (see production checklist §5) */}
        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          {clearConfirm && (
            <button
              type="button"
              onClick={() => setClearConfirm(false)}
              className="text-[11px] text-muted-foreground hover:text-muted-foreground transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            onClick={handleClearChat}
            disabled={clearPending}
            className={`flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-colors disabled:opacity-50 ${
              clearConfirm
                ? 'bg-orange-500 text-white border-orange-500 hover:bg-orange-600'
                : 'text-orange-500 border-orange-200 bg-orange-50 hover:bg-orange-100'
            }`}
          >
            <Trash2 size={11} />
            {clearPending ? 'Clearing…' : clearConfirm ? 'Confirm clear' : 'Clear chat'}
          </button>
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-orange-100 text-orange-400 uppercase tracking-wider">DEV</span>
        </div>
      </div>

      {/* Message input — only when agent has claimed */}
      {status === 'bot_paused' && (
        <div className="px-5 py-3 space-y-2">
          {sendError && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              {sendError}
            </p>
          )}
          <form onSubmit={handleSend} className="flex items-center gap-3">
            {quickReplies.length > 0 && (
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setShowQuickReplies(v => !v)}
                  aria-label="Insert a quick reply"
                  className="w-10 h-10 rounded-xl border border-line text-muted-foreground hover:bg-sunken flex items-center justify-center transition-colors"
                >
                  <MessageSquareText size={16} />
                </button>
                {showQuickReplies && (
                  <div className="absolute bottom-full left-0 mb-1 w-64 max-h-64 overflow-y-auto bg-white rounded-xl border border-line shadow-lg z-10 overflow-hidden">
                    {quickReplies.map(qr => (
                      <button
                        key={qr.id}
                        type="button"
                        onClick={() => { setMessage(qr.message); setShowQuickReplies(false); }}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-sunken transition-colors border-b border-line last:border-b-0"
                      >
                        <p className="font-semibold text-text">{qr.label}</p>
                        <p className="text-muted-foreground truncate">{qr.message}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <input
              type="text"
              value={message}
              onChange={(e) => { setMessage(e.target.value); setSendError(null); }}
              placeholder="Type a message as agent…"
              className="flex-1 rounded-xl border border-line bg-sunken px-4 py-2.5 text-sm text-text placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition-all"
            />
            <button
              type="submit"
              disabled={sending || !message.trim()}
              aria-label="Send message"
              className="w-10 h-10 rounded-xl bg-brand-strong hover:opacity-90 text-white flex items-center justify-center disabled:opacity-40 transition-colors shadow-sm shrink-0"
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
