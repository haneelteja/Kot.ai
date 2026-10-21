/**
 * Supabase env var access with a safe fallback. `createClient`/`createBrowserClient`/
 * `createServerClient` all throw synchronously ("supabaseUrl is required") if the
 * URL is empty — and because many call sites construct the client at component
 * render time rather than inside an event handler, that throw was crashing the
 * entire page into the generic error boundary whenever Supabase wasn't configured.
 *
 * Falling back to a syntactically-valid placeholder means client construction
 * always succeeds; only the actual network call fails (gracefully, as a normal
 * auth/fetch error) once a real request is made. Once real env vars are set,
 * this fallback is never used.
 */
let warned = false;

function warnOnce(): void {
  if (warned) return;
  warned = true;
  console.warn('[supabase] NEXT_PUBLIC_SUPABASE_URL/keys are not set — using placeholder values. Auth and data calls will fail until real Supabase credentials are configured.');
}

export function getSupabaseUrl(): string {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  if (!url) {
    warnOnce();
    return 'https://placeholder.supabase.co';
  }
  return url;
}

export function getSupabasePublishableKey(): string {
  const key = process.env['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'];
  if (!key) {
    warnOnce();
    return 'placeholder-anon-key';
  }
  return key;
}

export function getSupabaseServiceRoleKey(): string {
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!key) {
    warnOnce();
    return 'placeholder-service-role-key';
  }
  return key;
}
