'use client';

import { useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import { Button, Input } from '@/components/kot-ui';

export default function ResetPasswordPage() {
  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [showPw, setShowPw]       = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [done, setDone]           = useState(false);
  const router   = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }

    setLoading(true);
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    setDone(true);
    setTimeout(() => router.push('/'), 2000);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-6">
      <div className="w-full max-w-[380px]">
        <div className="flex justify-center mb-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/kotai-logo-light-tagline.svg" alt="KOT.ai" className="h-12" />
        </div>

        <div className="bg-surface border border-line rounded-lg p-8">
          {done ? (
            <div className="text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-ready-bg flex items-center justify-center mx-auto">
                <svg className="w-7 h-7 text-ready" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-[20px] font-semibold text-text">Password updated</h1>
              <p className="text-sm text-muted-foreground">Redirecting you to the dashboard…</p>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h1 className="text-[22px] font-semibold text-text">Set new password</h1>
                <p className="text-sm text-muted-foreground mt-1">Choose a strong password for your account.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="new-password" className="text-sm font-medium text-text">New password</label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showPw ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="new-password"
                      placeholder="Min. 8 characters"
                      className="pr-11"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(!showPw)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-text transition-colors"
                      aria-label={showPw ? 'Hide password' : 'Show password'}
                    >
                      {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="confirm-password" className="text-sm font-medium text-text">Confirm password</label>
                  <Input
                    id="confirm-password"
                    type={showPw ? 'text' : 'password'}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    autoComplete="new-password"
                    placeholder="Re-enter password"
                  />
                </div>

                {error && (
                  <div className="flex items-start gap-2.5 text-sm text-problem bg-problem-bg rounded-sm px-3.5 py-3">
                    <span className="w-4 h-4 rounded-full bg-problem text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">!</span>
                    {error}
                  </div>
                )}

                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? 'Updating…' : 'Update password'}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
