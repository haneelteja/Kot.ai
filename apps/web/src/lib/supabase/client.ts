'use client';

import { createBrowserClient } from '@supabase/ssr';
import { getSupabaseUrl, getSupabasePublishableKey } from './env';

let _client: ReturnType<typeof createBrowserClient> | null = null;

export function getSupabaseBrowserClient() {
  if (_client) return _client;
  _client = createBrowserClient(getSupabaseUrl(), getSupabasePublishableKey());
  return _client;
}
