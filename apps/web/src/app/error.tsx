'use client';
import { useEffect } from 'react';
import { logError } from '@/lib/logger';

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logError(error, {
      layer:  'Component',
      source: 'RootError',
      meta:   { digest: error.digest },
    });
  }, [error]);

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 bg-sunken">
      <div className="rounded-2xl border border-problem/20 bg-surface p-8 shadow-sm text-center max-w-sm">
        <div className="w-12 h-12 rounded-xl bg-problem-bg flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-problem" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-sm font-semibold text-text mb-1">Something went wrong</h2>
        <p className="text-xs text-muted-foreground mb-4">
          {error.digest ? `Error ID: ${error.digest}` : 'An unexpected error occurred.'}
        </p>
        <button
          type="button"
          onClick={reset}
          className="rounded-lg bg-brand-strong px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
