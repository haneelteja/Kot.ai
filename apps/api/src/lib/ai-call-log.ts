import { getServerClient } from '@alphabot/database';

/**
 * Structured logging for every LLM call — provider, model, latency, tokens,
 * success/error — so diagnosing free-tier reliability issues (429s, empty
 * content, timeouts) is a SQL query against ai_calls instead of grepping
 * Render logs. Fire-and-forget: never let logging failures affect the
 * actual AI call's result.
 */
export interface AiCallLogEntry {
  tenantId?:      string;
  productSlug?:   string;
  provider:       string;
  model:          string;
  status:         'success' | 'error';
  latencyMs:      number;
  inputTokens?:   number;
  outputTokens?:  number;
  errorMessage?:  string;
}

export function logAiCall(entry: AiCallLogEntry): void {
  if (!entry.tenantId) return; // nothing to scope the row to — skip rather than violate the FK
  const db = getServerClient();
  void db.from('ai_calls').insert({
    tenant_id:     entry.tenantId,
    product_slug:  entry.productSlug ?? null,
    provider:      entry.provider,
    model:         entry.model,
    status:        entry.status,
    latency_ms:    entry.latencyMs,
    input_tokens:  entry.inputTokens ?? null,
    output_tokens: entry.outputTokens ?? null,
    error_message: entry.errorMessage?.slice(0, 2000) ?? null,
  }).then(() => {}, () => {}); // swallow — logging must never throw into the caller
}
