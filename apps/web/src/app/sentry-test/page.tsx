'use client';

import { useState } from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';

// Temporary verification page — deterministically exercises
// ErrorBoundary -> logError -> captureException -> Sentry, with no
// dependence on console-evaluated code or window.onerror quirks.
// Safe to delete once Sentry wiring is confirmed working.

function Boom({ trigger }: { trigger: boolean }): null {
  if (trigger) throw new Error('Sentry verification test — intentional render crash');
  return null;
}

export default function SentryTestPage() {
  const [trigger, setTrigger] = useState(false);

  return (
    <div style={{ padding: 40, fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Sentry Verification Page</h1>
      <button
        type="button"
        onClick={() => setTrigger(true)}
        style={{
          padding: '10px 20px', background: '#DC2626', color: '#fff',
          border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600,
        }}
      >
        Trigger Test Error
      </button>
      <ErrorBoundary name="SentryTestPage">
        <Boom trigger={trigger} />
      </ErrorBoundary>
    </div>
  );
}
