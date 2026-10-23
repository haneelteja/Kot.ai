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
import { logAiCall } from './ai-call-log.js';

export interface LlmOverride {
  provider?: string;
  apiKey?:   string;
  model?:    string;
  baseUrl?:  string;
}

export interface LlmLogContext {
  tenantId?:    string;
  productSlug?: string;
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
  'poolside/laguna-s-2.1:free',
  'recursive/flint-v1.0:free',
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
  logContext?: LlmLogContext;
}): Promise<CompletionResult> {
  const { messages, system, max_tokens = 512, override, logContext } = params;
  const provider = override?.provider ?? defaultProvider();
  // REPLY_MODEL is an Anthropic model id — only use it as the default when we
  // actually resolved to Anthropic. Auto-fallback to OpenRouter needs its own
  // default model id (handled per-call in the openrouter branch below).
  const model  = override?.model ?? (provider === 'anthropic' ? REPLY_MODEL : undefined);
  const apiKey = override?.apiKey;
  // Updated inside the openrouter fallback loop to the model that actually
  // responded — so logging reflects reality, not just the nominal default.
  let resolvedModel = model;

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

        // One pass over every candidate model, raced concurrently — first
        // usable success wins and every other in-flight attempt is aborted.
        // Previously these ran one after another (up to 4 models x 15s per
        // pass x 2 passes ≈ 120s worst case); racing them means the worst
        // case is a single 15s timeout window whenever at least one model
        // is healthy, since a slow/dead model no longer blocks trying the
        // others. Returns null (never throws) so the caller can retry the
        // whole chain once more on a transient burst instead of giving up
        // the moment every model happens to be 429'd at the same instant —
        // free-tier shared-pool limits are usually brief.
        async function tryAllModels(): Promise<{ json: OpenAiResponse | null; lastErrText: string }> {
          const winnerController = new AbortController();

          async function attempt(candidateModel: string): Promise<{ json: OpenAiResponse; candidateModel: string }> {
            const attemptController = new AbortController();
            const timeoutId = setTimeout(() => attemptController.abort(), 15_000);
            const onWinnerAbort = () => attemptController.abort();
            winnerController.signal.addEventListener('abort', onWinnerAbort);

            try {
              const res = await fetch(`${baseUrl}/chat/completions`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ model: candidateModel, messages: openaiMessages, max_tokens }),
                signal: attemptController.signal,
              });

              if (!res.ok) {
                const body = await res.text();
                let detail = `HTTP ${res.status}`;
                try { const j = JSON.parse(body) as { error?: { message?: string } }; detail = j.error?.message ?? detail; } catch { /* use status */ }
                throw new Error(`${res.status} on ${candidateModel}: ${detail}`);
              }

              const json = await res.json() as OpenAiResponse;
              const content = json.choices[0]?.message.content;
              // A 200 with empty/null content happens when a reasoning model burns
              // its whole token budget on internal "thinking" — not an HTTP error,
              // but equally unusable. Reject so Promise.any moves on to another model.
              if (!content?.trim()) {
                throw new Error(`empty content from ${candidateModel} (finish_reason: ${json.choices[0]?.finish_reason ?? 'unknown'})`);
              }

              return { json, candidateModel };
            } finally {
              clearTimeout(timeoutId);
              winnerController.signal.removeEventListener('abort', onWinnerAbort);
            }
          }

          try {
            const winner = await Promise.any(modelsToTry.map(attempt));
            resolvedModel = winner.candidateModel;
            winnerController.abort(); // one usable reply is enough — cancel the rest
            return { json: winner.json, lastErrText: '' };
          } catch (aggErr) {
            winnerController.abort(); // nothing won — make sure nothing is left hanging
            const errors = aggErr instanceof AggregateError ? aggErr.errors : [aggErr];
            const lastErrText = errors.map(e => (e instanceof Error ? e.message : String(e))).join('; ');
            return { json: null, lastErrText };
          }
        }

        let { json: okJson, lastErrText } = await tryAllModels();
        if (!okJson && modelsToTry.length > 1) {
          // Every model failed on the first pass — give the shared free pool a
          // moment to recover and try the whole chain again, once, before
          // giving up for real.
          await new Promise(r => setTimeout(r, 3_000));
          ({ json: okJson, lastErrText } = await tryAllModels());
        }
        if (!okJson) throw new Error(`${provider} API: all fallback models exhausted (after retry) — ${lastErrText}`);

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
  const startedAt = Date.now();
  try {
    const result = withCost(await call(messages));
    logAiCall({
      tenantId: logContext?.tenantId, productSlug: logContext?.productSlug,
      provider, model: resolvedModel ?? model ?? 'unknown', status: 'success',
      latencyMs: Date.now() - startedAt, inputTokens: result.inputTokens, outputTokens: result.outputTokens,
    });
    return result;
  } catch (err) {
    if (isContextOverflow(err) && messages.length > 1) {
      const trimmed = messages.slice(Math.ceil(messages.length / 2));
      try {
        const result = withCost(await call(trimmed));
        logAiCall({
          tenantId: logContext?.tenantId, productSlug: logContext?.productSlug,
          provider, model: resolvedModel ?? model ?? 'unknown', status: 'success',
          latencyMs: Date.now() - startedAt, inputTokens: result.inputTokens, outputTokens: result.outputTokens,
        });
        return result;
      } catch (retryErr) {
        if (isContextOverflow(retryErr)) {
          const overflowErr = new Error(
            `Context window exceeded even after trimming history to ${trimmed.length} messages. ` +
            `Consider reducing the system prompt or knowledge base size.`,
          );
          logAiCall({
            tenantId: logContext?.tenantId, productSlug: logContext?.productSlug,
            provider, model: resolvedModel ?? model ?? 'unknown', status: 'error',
            latencyMs: Date.now() - startedAt, errorMessage: overflowErr.message,
          });
          throw overflowErr;
        }
        logAiCall({
          tenantId: logContext?.tenantId, productSlug: logContext?.productSlug,
          provider, model: resolvedModel ?? model ?? 'unknown', status: 'error',
          latencyMs: Date.now() - startedAt, errorMessage: retryErr instanceof Error ? retryErr.message : String(retryErr),
        });
        throw retryErr;
      }
    }
    logAiCall({
      tenantId: logContext?.tenantId, productSlug: logContext?.productSlug,
      provider, model: resolvedModel ?? model ?? 'unknown', status: 'error',
      latencyMs: Date.now() - startedAt, errorMessage: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
