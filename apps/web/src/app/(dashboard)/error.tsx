'use client';

import { useEffect } from 'react';
import { logError } from '@/lib/logger';
import { RefreshCw } from 'lucide-react';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logError(error, {
      layer:   'Component',
      source:  'DashboardError',
      component: 'Dashboard',
      meta:    { digest: error.digest },
    });
  }, [error]);

  return (
    <div className="flex h-screen items-center justify-center bg-bg p-8">
      <div className="text-center max-w-sm">
        <div className="w-12 h-12 rounded-full bg-problem-bg border border-transparent flex items-center justify-center mx-auto mb-4">
          <RefreshCw size={20} className="text-problem" />
        </div>
        <h2 className="text-sm font-semibold text-text mb-1">Something went wrong</h2>
        <p className="text-xs text-muted-foreground mb-4">
          {error.message ?? 'An unexpected error occurred loading the dashboard.'}
        </p>
        <button
          type="button"
          onClick={reset}
          className="text-sm font-semibold text-brand-strong hover:text-brand underline"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
