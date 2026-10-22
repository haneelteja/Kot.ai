import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const maxDuration = 60;

// ─── Anthropic types (plain, no SDK import) ───────────────────────────────────

type AnthropicToolProperty = {
  type: string;
  description?: string;
  items?: { type: string; properties?: Record<string, { type: string; description?: string }>; required?: string[] };
};

type AnthropicTool = {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, AnthropicToolProperty>;
    required: string[];
  };
};

type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> };

type MessageParam =
  | { role: 'user'; content: string | Array<{ type: 'tool_result'; tool_use_id: string; content: string }> }
  | { role: 'assistant'; content: string | ContentBlock[] };

// ─── Tool definitions ──────────────────────────────────────────────────────────

const TOOLS: AnthropicTool[] = [
  {
    name: 'add_kb_article',
    description: 'Add a new FAQ/article entry to a knowledge base collection.',
    input_schema: {
      type: 'object',
      properties: {
        collection_id: { type: 'string', description: 'UUID of the KB collection' },
        collection_name: { type: 'string', description: 'Collection name for display' },
        question: { type: 'string', description: 'The question or topic title' },
        answer: { type: 'string', description: 'The detailed answer content' },
      },
      required: ['collection_id', 'collection_name', 'question', 'answer'],
    },
  },
  {
    name: 'update_escalation_triggers',
    description: 'Replace the escalation trigger keywords for a specific bot.',
    input_schema: {
      type: 'object',
      properties: {
        product_slug: { type: 'string', description: 'e.g. support_bot, sales_bot, lifecycle_bot' },
        triggers: { type: 'array', items: { type: 'string' }, description: 'Full list of trigger keywords' },
      },
      required: ['product_slug', 'triggers'],
    },
  },
  {
    name: 'toggle_button_template',
    description: 'Enable or disable a WhatsApp button template.',
    input_schema: {
      type: 'object',
      properties: {
        template_id: { type: 'string', description: 'UUID of the button template' },
        template_name: { type: 'string', description: 'Template name for display' },
        is_active: { type: 'boolean', description: 'true to enable, false to disable' },
      },
      required: ['template_id', 'template_name', 'is_active'],
    },
  },
  {
    name: 'update_system_prompt',
    description: 'Update the system prompt for a bot.',
    input_schema: {
      type: 'object',
      properties: {
        product_slug: { type: 'string' },
        system_prompt: { type: 'string', description: 'The full new system prompt text' },
      },
      required: ['product_slug', 'system_prompt'],
    },
  },
  {
    name: 'add_kb_articles_bulk',
    description: 'Add multiple FAQ/article entries to a KB collection in one shot. ALWAYS use this instead of add_kb_article when adding 2 or more articles — never call add_kb_article in a loop.',
    input_schema: {
      type: 'object',
      properties: {
        collection_id: { type: 'string', description: 'UUID of the KB collection' },
        collection_name: { type: 'string', description: 'Collection name for display' },
        articles: {
          type: 'array',
          description: 'List of Q&A pairs to add',
          items: {
            type: 'object',
            properties: {
              question: { type: 'string', description: 'The question or topic' },
              answer: { type: 'string', description: 'The detailed answer' },
            },
            required: ['question', 'answer'],
          },
        },
      },
      required: ['collection_id', 'collection_name', 'articles'],
    },
  },
];

// ─── History helpers ───────────────────────────────────────────────────────────

type HistoryRow = {
  id: string;
  role: string;
  content: string;
  pending_action: Record<string, unknown> | null;
  action_status: string | null;
};

function buildMessages(history: HistoryRow[]): MessageParam[] {
  const msgs: MessageParam[] = [];
  for (const row of history) {
    if (row.role === 'user') {
      msgs.push({ role: 'user', content: row.content });
    } else {
      if (row.pending_action && row.action_status === 'executed') {
        const pa = row.pending_action as {
          toolUseId: string;
          toolName: string;
          toolInput: Record<string, unknown>;
          executionResult?: string;
        };
        const assistantBlocks: ContentBlock[] = [
          ...(row.content ? [{ type: 'text' as const, text: row.content }] : []),
          { type: 'tool_use' as const, id: pa.toolUseId, name: pa.toolName, input: pa.toolInput },
        ];
        msgs.push({ role: 'assistant', content: assistantBlocks });
        msgs.push({
          role: 'user',
          content: [{ type: 'tool_result', tool_use_id: pa.toolUseId, content: pa.executionResult ?? 'Done' }],
        });
      } else {
        msgs.push({ role: 'assistant', content: row.content || '…' });
      }
    }
  }
  return msgs;
}

// ─── Anthropic API call (plain fetch, no SDK) ──────────────────────────────────

async function callAnthropic(
  apiKey: string,
  systemPrompt: string,
  messages: MessageParam[],
  tools: AnthropicTool[],
): Promise<{ content: ContentBlock[] }> {
  const body: Record<string, unknown> = {
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 8192,
    system: systemPrompt,
    messages,
  };
  if (tools.length > 0) body['tools'] = tools;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey.trim(),
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic ${res.status}: ${text}`);
  }

  return res.json() as Promise<{ content: ContentBlock[] }>;
}

// ─── OpenRouter fallback (OpenAI-compatible function-calling) ──────────────────
// Used when ANTHROPIC_API_KEY isn't set. Converts Anthropic-shaped tool defs and
// message history to/from OpenAI's chat-completions + function-calling format so
// the rest of this route (tool execution, history persistence) stays unchanged.

// Tried in order — OpenRouter's free tier is a shared pool per upstream provider,
// so one model (e.g. Google AI Studio's gemma) getting 429'd doesn't take the
// whole fallback down; the next entry is served by a different upstream.
// Reasoning models (e.g. nvidia/nemotron-*) are deliberately excluded — they
// can burn the entire max_tokens budget on internal "thinking" and return a
// 200 OK with content: null, which isn't an HTTP failure but is still unusable.
const OPENROUTER_MODELS = [
  'google/gemma-4-31b-it:free',
  'liquid/lfm-2.5-2.6b:free',
  'poolside/laguna-s-2.1:free',
] as const;

type OpenAiMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }> }
  | { role: 'tool'; tool_call_id: string; content: string };

function toOpenAiTools(tools: AnthropicTool[]) {
  return tools.map(t => ({
    type: 'function' as const,
    function: { name: t.name, description: t.description, parameters: t.input_schema },
  }));
}

function toOpenAiMessages(systemPrompt: string, messages: MessageParam[]): OpenAiMessage[] {
  const out: OpenAiMessage[] = [{ role: 'system', content: systemPrompt }];
  for (const m of messages) {
    if (m.role === 'user') {
      if (typeof m.content === 'string') {
        out.push({ role: 'user', content: m.content });
      } else {
        for (const block of m.content) {
          out.push({ role: 'tool', tool_call_id: block.tool_use_id, content: block.content });
        }
      }
    } else {
      if (typeof m.content === 'string') {
        out.push({ role: 'assistant', content: m.content });
      } else {
        const textBlock = m.content.find(b => b.type === 'text') as { type: 'text'; text: string } | undefined;
        const toolBlock = m.content.find(b => b.type === 'tool_use') as { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> } | undefined;
        out.push({
          role: 'assistant',
          content: textBlock?.text ?? null,
          ...(toolBlock ? { tool_calls: [{ id: toolBlock.id, type: 'function', function: { name: toolBlock.name, arguments: JSON.stringify(toolBlock.input) } }] } : {}),
        });
      }
    }
  }
  return out;
}

async function callOpenRouter(
  apiKey: string,
  systemPrompt: string,
  messages: MessageParam[],
  tools: AnthropicTool[],
): Promise<{ content: ContentBlock[] }> {
  const body: Record<string, unknown> = {
    messages: toOpenAiMessages(systemPrompt, messages),
  };
  if (tools.length > 0) body['tools'] = toOpenAiTools(tools);

  type OpenRouterResponse = {
    choices: Array<{ message: { content: string | null; tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }> }; finish_reason?: string }>;
  };

  let okData: OpenRouterResponse | null = null;
  let lastError = '';
  for (const model of OPENROUTER_MODELS) {
    const isLast = model === OPENROUTER_MODELS[OPENROUTER_MODELS.length - 1];
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey.trim()}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ ...body, model }),
        signal: AbortSignal.timeout(25_000),
      });

      if (!res.ok) {
        const text = await res.text();
        if (!isLast) { lastError = `OpenRouter ${res.status} on ${model}: ${text}`; continue; }
        throw new Error(`OpenRouter ${res.status}: ${text}`);
      }

      const data = await res.json() as OpenRouterResponse;
      const msg = data.choices[0]?.message;
      // A 200 with no text AND no tool call happens when a reasoning model burns
      // its whole token budget on internal "thinking" — try the next model.
      if (!msg?.content?.trim() && !msg?.tool_calls?.length) {
        if (!isLast) {
          lastError = `OpenRouter: empty content from ${model} (finish_reason: ${data.choices[0]?.finish_reason ?? 'unknown'})`;
          continue;
        }
        throw new Error(`OpenRouter: ${model} returned empty content (finish_reason: ${data.choices[0]?.finish_reason ?? 'unknown'})`);
      }
      okData = data;
      break;
    } catch (fetchErr) {
      // Network-level failures (timeout, DNS, connection reset) throw before a
      // Response exists at all — treat like a bad response and try the next model.
      if (fetchErr instanceof Error && fetchErr.message.startsWith('OpenRouter')) throw fetchErr;
      if (!isLast) { lastError = `${model} threw: ${fetchErr instanceof Error ? fetchErr.message : String(fetchErr)}`; continue; }
      throw fetchErr;
    }
  }

  if (!okData) throw new Error(lastError || 'OpenRouter: all fallback models exhausted');

  const msg = okData.choices[0]?.message;
  const content: ContentBlock[] = [];
  if (msg?.content) content.push({ type: 'text', text: msg.content });
  const call = msg?.tool_calls?.[0];
  if (call) {
    let input: Record<string, unknown> = {};
    try { input = JSON.parse(call.function.arguments); } catch { /* leave empty on malformed args */ }
    content.push({ type: 'tool_use', id: call.id, name: call.function.name, input });
  }
  return { content };
}

// ─── Route ─────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = getSupabaseAdminClient();
    const { data: tenantUser } = await admin
      .from('tenant_users')
      .select('tenant_id')
      .eq('user_id', user.id)
      .single();
    if (!tenantUser) return NextResponse.json({ error: 'No tenant' }, { status: 403 });

    const tenantId = tenantUser.tenant_id as string;
    const body = await request.json() as { message: string };
    const { message } = body;
    if (!message?.trim()) return NextResponse.json({ error: 'Empty message' }, { status: 400 });

    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const openRouterKey = process.env.OPENROUTER_API_KEY;
    if (!anthropicKey && !openRouterKey) {
      return NextResponse.json({ error: 'No AI provider configured (set ANTHROPIC_API_KEY or OPENROUTER_API_KEY)' }, { status: 500 });
    }

    // Load copilot config — check enabled + get instructions/allowed_actions
    const { data: tenantRow } = await admin.from('tenants').select('copilot_config').eq('id', tenantId).single();
    const rawCfg = (tenantRow as { copilot_config?: Record<string, unknown> } | null)?.copilot_config ?? {};
    const copilotEnabled = typeof rawCfg['enabled'] === 'boolean' ? rawCfg['enabled'] : true;
    if (!copilotEnabled) {
      return NextResponse.json({ error: 'AI Copilot is disabled for this account.' }, { status: 403 });
    }
    const copilotInstructions = typeof rawCfg['instructions'] === 'string' ? rawCfg['instructions'].trim() : '';
    const allowedActions = Array.isArray(rawCfg['allowed_actions'])
      ? rawCfg['allowed_actions'] as string[]
      : ['add_kb_article', 'add_kb_articles_bulk', 'update_escalation_triggers', 'toggle_button_template', 'update_system_prompt'];

    // Load history + context in parallel
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const [
      { data: historyRows },
      { data: kbCollections },
      { data: botConfigs },
      { data: buttonTemplates },
      { count: totalConvs },
      { count: escalatedConvs },
    ] = await Promise.all([
      admin.from('copilot_messages')
        .select('id, role, content, pending_action, action_status')
        .eq('user_id', user.id).eq('tenant_id', tenantId)
        .order('created_at', { ascending: false }).limit(30),
      admin.from('kb_collections').select('id, name, entry_count').eq('tenant_id', tenantId).eq('active', true),
      admin.from('bot_configs').select('product_slug, guardrails_json, escalation_triggers, confidence_threshold, kb_only_mode').eq('tenant_id', tenantId),
      admin.from('interactive_button_templates').select('id, name, is_active, type, trigger_keywords').eq('tenant_id', tenantId),
      admin.from('conversations').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).gte('created_at', sevenDaysAgo),
      admin.from('conversations').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('status', 'escalated').gte('created_at', sevenDaysAgo),
    ]);

    const history = ((historyRows ?? []) as HistoryRow[]).reverse();

    type KbCol = { id: string; name: string; entry_count: number };
    type BotCfg = { product_slug: string; guardrails_json: Record<string, unknown> | null; escalation_triggers: string[] | null; confidence_threshold: number | null; kb_only_mode: boolean | null };
    type BtnTpl = { id: string; name: string; is_active: boolean; type: string; trigger_keywords: string[] | null };

    const escalationRate = (totalConvs ?? 0) > 0
      ? Math.round(((escalatedConvs ?? 0) / (totalConvs ?? 1)) * 100)
      : 0;

    const kbLines = (kbCollections as KbCol[] ?? []).map(
      c => `  • ID: ${c.id} | "${c.name}" (${c.entry_count ?? 0} entries)`
    );
    const botLines = (botConfigs as BotCfg[] ?? []).flatMap(cfg => {
      const g = cfg.guardrails_json ?? {};
      return [
        `  ${cfg.product_slug}:`,
        `    KB-only: ${cfg.kb_only_mode ?? false} | Confidence: ${cfg.confidence_threshold ?? 0.6}`,
        `    Escalation triggers: ${(cfg.escalation_triggers ?? []).join(', ') || 'none'}`,
        `    Blocked topics: ${((g['blocked_topics'] as string[] | null) ?? []).join(', ') || 'none'}`,
        `    Tone: ${(g['tone'] as string | null) ?? 'professional'}`,
      ];
    });
    const btnLines = (buttonTemplates as BtnTpl[] ?? []).map(
      t => `  • ID: ${t.id} | "${t.name}" | ${t.type} | Active: ${t.is_active} | Keywords: ${(t.trigger_keywords ?? []).join(', ') || 'none'}`
    );

    const systemPrompt = `You are the AI Copilot for this WhatsApp AI agent dashboard. You help operators understand and improve their bot setup.

KNOWLEDGE BASE COLLECTIONS (use IDs for add_kb_article / add_kb_articles_bulk):
${kbLines.length ? kbLines.join('\n') : '  (none configured — if you need to add articles, use any short descriptive slug as collection_id such as "restaurant-kb" and the system will auto-create the collection)'}

BOT CONFIGURATIONS:
${botLines.length ? botLines.join('\n') : '  (none configured)'}

BUTTON TEMPLATES (use IDs for toggle_button_template):
${btnLines.length ? btnLines.join('\n') : '  (none configured)'}

CONVERSATION STATS (last 7 days):
  Total: ${totalConvs ?? 0} | Escalated: ${escalatedConvs ?? 0} (${escalationRate}%)

You can:
1. Answer questions about the configuration above
2. Guide navigation — embed links like: [GO:/knowledge-base "Go to Knowledge Base"]
   Valid paths: /knowledge-base, /guardrails, /settings, /button-templates, /campaigns, /analytics, /conversations
3. Propose write actions using tools (user must approve before executing)

Before calling a tool, briefly describe what you'll do. Keep responses concise.${copilotInstructions ? `\n\nADDITIONAL INSTRUCTIONS FROM PLATFORM:\n${copilotInstructions}` : ''}`;

    const claudeMessages = buildMessages(history);
    claudeMessages.push({ role: 'user', content: message });

    const enabledTools = TOOLS.filter(t => allowedActions.includes(t.name));
    const response = anthropicKey
      ? await callAnthropic(anthropicKey, systemPrompt, claudeMessages, enabledTools)
      : await callOpenRouter(openRouterKey as string, systemPrompt, claudeMessages, enabledTools);

    // Save user message
    await admin.from('copilot_messages').insert({
      user_id: user.id, tenant_id: tenantId, role: 'user', content: message,
    });

    const textBlock = response.content.find(b => b.type === 'text') as { type: 'text'; text: string } | undefined;
    const toolBlock = response.content.find(b => b.type === 'tool_use') as { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> } | undefined;

    if (toolBlock) {
      const assistantText = textBlock?.text ?? '';
      const { data: saved } = await admin.from('copilot_messages').insert({
        user_id: user.id, tenant_id: tenantId, role: 'assistant',
        content: assistantText,
        pending_action: { toolUseId: toolBlock.id, toolName: toolBlock.name, toolInput: toolBlock.input },
        action_status: 'pending',
      }).select('id').single();

      return NextResponse.json({
        type: 'action_pending',
        messageId: (saved as { id: string } | null)?.id ?? '',
        toolUseId: toolBlock.id,
        toolName: toolBlock.name,
        toolInput: toolBlock.input,
        assistantText,
      });
    }

    const content = textBlock?.text ?? '';
    const { data: saved } = await admin.from('copilot_messages').insert({
      user_id: user.id, tenant_id: tenantId, role: 'assistant', content,
    }).select('id').single();

    return NextResponse.json({
      type: 'message',
      content,
      messageId: (saved as { id: string } | null)?.id ?? '',
    });

  } catch (err) {
    console.error('[Copilot] chat error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
