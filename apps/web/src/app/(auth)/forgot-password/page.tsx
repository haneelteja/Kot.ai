'use client';

import { useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button, Input } from '@/components/kot-ui';

export default function ForgotPasswordPage() {
  const [email, setEmail]     = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent]       = useState(false);
  const [error, setError]     = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const redirectTo =
      typeof window !== 'undefined'
        ? `${window.location.origin}/auth/callback?next=/reset-password`
        : '/auth/callback?next=/reset-password';

    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    setSent(true);
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-6">
      <div className="w-full max-w-[380px]">
        <div className="flex justify-center mb-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/kotai-logo-light-tagline.svg" alt="KOT.ai" className="h-12" />
        </div>

        <div className="bg-surface border border-line rounded-lg p-8">
          {sent ? (
            <div className="text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-ready-bg flex items-center justify-center mx-auto">
                <svg className="w-7 h-7 text-ready" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h1 className="text-[20px] font-semibold text-text">Check your inbox</h1>
              <p className="text-sm text-muted-foreground">
                We&rsquo;ve sent a password reset link to <span className="font-medium text-text">{email}</span>.
                The link expires in 1 hour.
              </p>
              <Link href="/login" className="inline-flex items-center gap-1.5 text-sm text-brand-strong hover:underline font-medium mt-4">
                <ArrowLeft size={14} /> Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h1 className="text-[22px] font-semibold text-text">Forgot password?</h1>
                <p className="text-sm text-muted-foreground mt-1">Enter your email and we&rsquo;ll send you a reset link.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="email" className="text-sm font-medium text-text">Email address</label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    placeholder="you@restaurant.com"
                  />
                </div>

                {error && (
                  <div className="flex items-start gap-2.5 text-sm text-problem bg-problem-bg rounded-sm px-3.5 py-3">
                    <span className="w-4 h-4 rounded-full bg-problem text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">!</span>
                    {error}
                  </div>
                )}

                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? 'Sending…' : 'Send reset link'}
                </Button>
              </form>

              <Link href="/login" className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-text mt-6 transition-colors">
                <ArrowLeft size={14} /> Back to sign in
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
