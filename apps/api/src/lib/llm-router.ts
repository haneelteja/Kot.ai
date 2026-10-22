/**
 * Multi-provider LLM router.
 * Routes chat completion requests to the correct provider API based on the
 * `provider` field. Anthropic uses its native Messages format; OpenAI,
 * OpenRouter, and Custom use the OpenAI-compatible /chat/completions format;
 * Gemini uses the Google Generative Language API.
 */

import { chatCompletion as anthropicCompletion, REPLY_MODEL } from './anthropic.js';
import type { AnthropicMessage } from './anthropic.js';
import { calcCostInr } from './llm-cost.js';

export interface LlmOverride {
  provider?: string;
  apiKey?:   string;
  model?:    string;
  baseUrl?:  string;
}

export interface CompletionResult {
  content:      string;
  inputTokens:  number;
  outputTokens: number;
  costInr:      number;
}

// Free models tried in order when routed to OpenRouter with no explicit model
// override — different upstream providers, so one provider's 429 (shared free
// pool exhausted) doesn't take the whole fallback chain down.
// Reasoning models (e.g. nvidia/nemotron-*) are deliberately excluded — they
// can burn the entire max_tokens budget on internal "thinking" and return a
// 200 OK with content: null, which isn't an HTTP failure but is still unusable.
const OPENROUTER_FALLBACK_MODELS = [
  'google/gemma-4-31b-it:free',
  'liquid/lfm-2.5-2.6b:free',
  'minimax/minimax-m3.1-flash:free',
] as const;

/**
 * Resolve the provider to use when no explicit override is given — defaults
 * to Anthropic when ANTHROPIC_API_KEY is set (existing behaviour), otherwise
 * falls back to OpenRouter if a key is available for it, rather than always
 * defaulting to Anthropic and failing outright with no key configured.
 */
function defaultProvider(): string {
  if (process.env['ANTHROPIC_API_KEY']) return 'anthropic';
  if (process.env['OPENROUTER_API_KEY']) return 'openrouter';
  return 'anthropic';
}

// Detect context-length overflow errors across all supported providers.
function isContextOverflow(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    msg.includes('prompt is too long')       ||   // Anthropic
    msg.includes('prompt_too_long')          ||   // Anthropic alt
    msg.includes('context_length_exceeded')  ||   // OpenAI / OpenRouter
    msg.includes('maximum context length')   ||   // OpenAI alt
    msg.includes('context window')           ||   // generic
    msg.includes('too many tokens')               // generic
  );
}

export async function routedChatCompletion(params: {
  messages:    AnthropicMessage[];
  system?:     string;
  max_tokens?: number;
  override?:   LlmOverride;
}): Promise<CompletionResult> {
  const { messages, system, max_tokens = 512, override } = params;
  const provider = override?.provider ?? defaultProvider();
  // REPLY_MODEL is an Anthropic model id — only use it as the default when we
  // actually resolved to Anthropic. Auto-fallback to OpenRouter needs its own
  // default model id (handled per-call in the openrouter branch below).
  const model  = override?.model ?? (provider === 'anthropic' ? REPLY_MODEL : undefined);
  const apiKey = override?.apiKey;

  // Inner call — provider dispatch with the given message list.
  // Extracted so the overflow retry can call it with a trimmed list.
  async function call(msgs: AnthropicMessage[]): Promise<Omit<CompletionResult, 'costInr'>> {
    switch (provider) {
      // ── Anthropic native API ──────────────────────────────────────────────
      case 'anthropic':
        return anthropicCompletion({ model: model ?? REPLY_MODEL, messages: msgs, system, max_tokens, apiKey });

      // ── OpenAI-compatible (OpenAI direct, OpenRouter, Custom endpoint) ────
      case 'openai':
      case 'openrouter':
      case 'custom': {
        const effectiveKey = apiKey ?? (
          provider === 'openai'     ? process.env['OPENAI_API_KEY'] :
          provider === 'openrouter' ? process.env['OPENROUTER_API_KEY'] :
          undefined
        );
        if (!effectiveKey) throw new Error(`No API key configured for provider: ${provider}`);

        const baseUrl = override?.baseUrl?.replace(/\/$/, '') ?? (
          provider === 'openrouter' ? 'https://openrouter.ai/api/v1' :
          'https://api.openai.com/v1'
        );

        const openaiMessages: { role: string; content: string }[] = [];
        if (system) openaiMessages.push({ role: 'system', content: system });
        openaiMessages.push(...msgs.map(m => ({ role: m.role as string, content: m.content })));

        const headers: Record<string, string> = {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${effectiveKey}`,
        };
        if (provider === 'openrouter') {
          headers['HTTP-Referer'] = 'https://whats-app-agent-web.vercel.app';
          headers['X-Title']      = 'Alphabot';
        }

        // No explicit model + OpenRouter → try the free fallback chain (one
        // model per upstream provider, so a single 429'd provider doesn't
        // block the whole chain). Otherwise there's exactly one model to try.
        const modelsToTry = model
          ? [model]
          : provider === 'openrouter'
            ? [...OPENROUTER_FALLBACK_MODELS]
            : (() => { throw new Error(`No model specified for provider: ${provider}`); })();

        type OpenAiResponse = {
          choices: Array<{ message: { content: string | null }; finish_reason?: string }>;
          usage?: { prompt_tokens: number; completion_tokens: number };
        };

        let okJson: OpenAiResponse | null = null;
        let lastErrText = '';
        for (const candidateModel of modelsToTry) {
          const isLast = candidateModel === modelsToTry[modelsToTry.length - 1];
          try {
            const res = await fetch(`${baseUrl}/chat/completions`, {
              method: 'POST',
              headers,
              body: JSON.stringify({ model: candidateModel, messages: openaiMessages, max_tokens }),
              signal: AbortSignal.timeout(25_000),
            });

            if (!res.ok) {
              const body = await res.text();
              if (res.status === 429 && !isLast) { lastErrText = `429 on ${candidateModel}: ${body}`; continue; }
              let detail = `HTTP ${res.status}`;
              try { const j = JSON.parse(body) as { error?: { message?: string } }; detail = j.error?.message ?? detail; } catch { /* use status */ }
              if (!isLast) { lastErrText = `${res.status} on ${candidateModel}: ${detail}`; continue; }
              throw new Error(`${provider} API error ${res.status}: ${detail}`);
            }

            const json = await res.json() as OpenAiResponse;
            const content = json.choices[0]?.message.content;
            // A 200 with empty/null content happens when a reasoning model burns
            // its whole token budget on internal "thinking" — not an HTTP error,
            // but equally unusable. Try the next model instead of returning blank.
            if (!content?.trim()) {
              if (!isLast) {
                lastErrText = `empty content from ${candidateModel} (finish_reason: ${json.choices[0]?.finish_reason ?? 'unknown'})`;
                continue;
              }
              throw new Error(`${provider}: ${candidateModel} returned empty content (finish_reason: ${json.choices[0]?.finish_reason ?? 'unknown'})`);
            }

            okJson = json;
            break;
          } catch (fetchErr) {
            // Network-level failures (timeout, DNS, connection reset) throw
            // before a Response exists at all — treat the same as a bad
            // response from this model and move on to the next one.
            if (fetchErr instanceof Error && fetchErr.message.startsWith(`${provider} API error`)) throw fetchErr;
            if (fetchErr instanceof Error && fetchErr.message.startsWith(`${provider}:`)) throw fetchErr;
            if (!isLast) { lastErrText = `${candidateModel} threw: ${fetchErr instanceof Error ? fetchErr.message : String(fetchErr)}`; continue; }
            throw fetchErr;
          }
        }
        if (!okJson) throw new Error(`${provider} API: all fallback models exhausted — ${lastErrText}`);

        return {
          content:      okJson.choices[0]?.message.content ?? '',
          inputTokens:  Math.max(0, okJson.usage?.prompt_tokens    ?? 0),
          outputTokens: Math.max(0, okJson.usage?.completion_tokens ?? 0),
        };
      }

      // ── Google Gemini ──────────────────────────────────────────────────────
      case 'gemini': {
        const geminiKey = apiKey ?? process.env['GEMINI_API_KEY'];
        if (!geminiKey) throw new Error('No Gemini API key configured. Set GEMINI_API_KEY or configure a client-level key.');

        // Gemini expects alternating user/model turns; inject system prompt as a leading exchange
        const contents: { role: string; parts: { text: string }[] }[] = [];
        if (system) {
          contents.push({ role: 'user',  parts: [{ text: `System instructions: ${system}` }] });
          contents.push({ role: 'model', parts: [{ text: 'Understood. I will follow these instructions.' }] });
        }
        for (const msg of msgs) {
          contents.push({
            role:  msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.content }],
          });
        }

        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model ?? REPLY_MODEL}:generateContent?key=${geminiKey}`;
        const res = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents,
            generationConfig: { maxOutputTokens: max_tokens },
          }),
          signal: AbortSignal.timeout(25_000),
        });

        if (!res.ok) {
          const body = await res.text();
          let detail = `HTTP ${res.status}`;
          try { const j = JSON.parse(body) as { error?: { message?: string } }; detail = j.error?.message ?? detail; } catch { /* use status */ }
          throw new Error(`Gemini API error ${res.status}: ${detail}`);
        }

        const json = await res.json() as {
          candidates?: Array<{ content: { parts: { text: string }[] } }>;
          usageMetadata?: { promptTokenCount: number; candidatesTokenCount: number };
        };

        const text = json.candidates?.[0]?.content.parts.map(p => p.text).join('') ?? '';

        return {
          content:      text,
          inputTokens:  Math.max(0, json.usageMetadata?.promptTokenCount    ?? 0),
          outputTokens: Math.max(0, json.usageMetadata?.candidatesTokenCount ?? 0),
        };
      }

      default:
        // Unknown provider — fall back to Anthropic env key
        return anthropicCompletion({ model: model ?? REPLY_MODEL, messages: msgs, system, max_tokens, apiKey });
    }
  }

  // Attach cost to a raw CompletionResult (which lacks costInr).
  function withCost(r: Omit<CompletionResult, 'costInr'>): CompletionResult {
    return { ...r, costInr: calcCostInr(r.inputTokens, r.outputTokens, model ?? REPLY_MODEL) };
  }

  // First attempt with full message list.
  // On context-length overflow: trim to the most recent half and retry once.
  // If the retry also overflows (system prompt alone is too large), rethrow clearly.
  try {
    return withCost(await call(messages));
  } catch (err) {
    if (isContextOverflow(err) && messages.length > 1) {
      const trimmed = messages.slice(Math.ceil(messages.length / 2));
      try {
        return withCost(await call(trimmed));
      } catch (retryErr) {
        if (isContextOverflow(retryErr)) {
          throw new Error(
            `Context window exceeded even after trimming history to ${trimmed.length} messages. ` +
            `Consider reducing the system prompt or knowledge base size.`,
          );
        }
        throw retryErr;
      }
    }
    throw err;
  }
}
