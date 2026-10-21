'use client';

import { useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { Button, Input } from '@/components/kot-ui';

const PW_RULES = [
  { label: 'At least 8 characters',   test: (p: string) => p.length >= 8 },
  { label: 'One uppercase letter',     test: (p: string) => /[A-Z]/.test(p) },
  { label: 'One lowercase letter',     test: (p: string) => /[a-z]/.test(p) },
  { label: 'One number',               test: (p: string) => /[0-9]/.test(p) },
  { label: 'One special character',    test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

function isPasswordValid(p: string) {
  return PW_RULES.every(r => r.test(p));
}

export default function SignupForm() {
  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [confirm, setConfirm]       = useState('');
  const [showPw, setShowPw]         = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwTouched, setPwTouched]   = useState(false);
  const [error, setError]           = useState('');
  const [loading, setLoading]       = useState(false);
  const [done, setDone]             = useState(false);
  const router = useRouter();

  const confirmMismatch = confirm.length > 0 && password !== confirm;

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!isPasswordValid(password)) {
      setError('Password does not meet all requirements.');
      setPwTouched(true);
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    const supabase = getSupabaseBrowserClient();
    const { data, error: supaErr } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });

    if (supaErr) {
      setError(supaErr.message);
      setLoading(false);
      return;
    }

    if (data.session) {
      router.push('/dashboard');
      return;
    }

    setDone(true);
    setLoading(false);
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg px-6">
        <div className="w-full max-w-md bg-surface border border-line rounded-lg p-10 text-center">
          <div className="w-14 h-14 rounded-full bg-ready-bg flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={28} className="text-ready" />
          </div>
          <h1 className="text-[22px] font-semibold text-text mb-2">Check your email</h1>
          <p className="text-sm text-muted-foreground">
            We sent a confirmation link to <strong className="text-text">{email}</strong>.<br />
            Click it to activate your account.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-6 py-12">
      <div className="w-full max-w-[380px]">
        <div className="flex justify-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/kotai-logo-light-tagline.svg" alt="KOT.ai" className="h-12" />
        </div>

        <div className="bg-surface border border-line rounded-lg p-8">
          <div className="mb-6">
            <h1 className="text-[22px] font-semibold text-text">Create account</h1>
            <p className="text-sm text-muted-foreground mt-1">Get started with KOT.ai for free</p>
          </div>

          <form onSubmit={handleSignup} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium text-text">
                Email address <span className="text-problem">*</span>
              </label>
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

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-medium text-text">
                Password <span className="text-problem">*</span>
              </label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setPwTouched(true); }}
                  required
                  autoComplete="new-password"
                  placeholder="Create a strong password"
                  className="pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-text transition-colors"
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {pwTouched && (
                <ul className="space-y-1 pt-1">
                  {PW_RULES.map(rule => {
                    const ok = rule.test(password);
                    return (
                      <li key={rule.label} className={`flex items-center gap-2 text-[11px] font-medium ${ok ? 'text-ready' : 'text-problem'}`}>
                        <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 ${ok ? 'bg-ready-bg' : 'bg-problem-bg'}`}>
                          {ok ? '✓' : '✗'}
                        </span>
                        {rule.label}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="confirm" className="text-sm font-medium text-text">
                Confirm password <span className="text-problem">*</span>
              </label>
              <div className="relative">
                <Input
                  id="confirm"
                  type={showConfirm ? 'text' : 'password'}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  autoComplete="new-password"
                  placeholder="Re-enter your password"
                  className="pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-text transition-colors"
                  aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
                >
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {confirmMismatch && (
                <p className="text-[11px] font-medium text-problem">Passwords do not match</p>
              )}
            </div>

            {error && (
              <div className="flex items-start gap-2.5 text-sm text-problem bg-problem-bg rounded-sm px-3.5 py-3">
                <span className="w-4 h-4 rounded-full bg-problem text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">!</span>
                {error}
              </div>
            )}

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Creating account…' : 'Create account'}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Already have an account?{' '}
            <Link href="/login" className="text-brand-strong font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
