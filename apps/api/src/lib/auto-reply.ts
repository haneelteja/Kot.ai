import type { getServerClient } from '@alphabot/database';
import { cacheGetOrFetch } from './redis.js';

type Db = ReturnType<typeof getServerClient>;

const TTL = 300; // 5 min

export interface AutoReplyRule {
  id:          string;
  productSlug: string | null; // null = applies to every bot type for this tenant
  keyword:     string;
  matchType:   'exact' | 'contains' | 'regex';
  replyText:   string;
  sortOrder:   number;
}

async function getAutoReplies(db: Db, tenantId: string): Promise<AutoReplyRule[]> {
  return cacheGetOrFetch(`auto_replies:${tenantId}`, async () => {
    const { data } = await db
      .from('auto_replies')
      .select('id, product_slug, keyword, match_type, reply_text, sort_order')
      .eq('tenant_id', tenantId)
      .eq('active', true)
      .order('sort_order', { ascending: true });

    type Row = { id: string; product_slug: string | null; keyword: string; match_type: 'exact' | 'contains' | 'regex'; reply_text: string; sort_order: number };
    return ((data ?? []) as Row[]).map(r => ({
      id: r.id, productSlug: r.product_slug, keyword: r.keyword,
      matchType: r.match_type, replyText: r.reply_text, sortOrder: r.sort_order,
    }));
  }, TTL);
}

/**
 * Zero-LLM keyword fast-path. Checked before the AI pipeline runs at all —
 * cuts both reply latency and free-tier daily-quota burn on common literal
 * queries ("hi", "hours", "menu") that don't need a model call. Returns the
 * first matching rule's reply text, or null if nothing matched (caller
 * proceeds to the normal AI pipeline as usual).
 */
export async function matchAutoReply(db: Db, tenantId: string, productType: string, messageText: string): Promise<string | null> {
  const text = messageText.trim();
  if (!text) return null;

  const rules = await getAutoReplies(db, tenantId);
  const lowerText = text.toLowerCase();

  for (const rule of rules) {
    if (rule.productSlug && rule.productSlug !== productType) continue;

    const keyword = rule.keyword.trim();
    if (!keyword) continue;

    let matched = false;
    try {
      if (rule.matchType === 'exact') {
        matched = lowerText === keyword.toLowerCase();
      } else if (rule.matchType === 'contains') {
        matched = lowerText.includes(keyword.toLowerCase());
      } else {
        matched = new RegExp(keyword, 'i').test(text);
      }
    } catch {
      continue; // malformed regex in a tenant-authored rule — skip it, don't crash the webhook
    }

    if (matched) return rule.replyText;
  }

  return null;
}
