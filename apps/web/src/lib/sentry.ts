/**
 * Sentry client-side error tracking wrapper.
 *
 * This is a basic, direct Sentry.init()/captureException() integration —
 * not the full official Next.js SDK setup (no sentry.client/server/edge
 * .config.ts instrumentation files, no withSentryConfig() source-map
 * upload, which needs its own SENTRY_AUTH_TOKEN build secret). It covers
 * exactly the gap logError() needed closed: every client-side error this
 * app already logs now also reaches Sentry. Upgrading to the full
 * instrumentation-based setup later is additive, not a rewrite of this.
 */

import * as Sentry from '@sentry/nextjs';

let _initialized = false;

export function initSentry(): void {
  if (_initialized) return;
  const dsn = process.env['NEXT_PUBLIC_SENTRY_DSN'];
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: process.env['NODE_ENV'] ?? 'development',
    tracesSampleRate: 0.05,
  });
  _initialized = true;
}

export function captureException(err: unknown, context?: Record<string, unknown>): void {
  if (process.env['NEXT_PUBLIC_SENTRY_DSN'] && _initialized) {
    Sentry.captureException(err, context ? { extra: context } : undefined);
  }
}
