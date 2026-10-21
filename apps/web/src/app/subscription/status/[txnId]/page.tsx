import Link from 'next/link';
import { CheckCircle2, XCircle, Clock, Bot } from 'lucide-react';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

interface Props {
  params:      { txnId: string };
  searchParams: { result?: string };
}

export default async function SubscriptionStatusPage({ params, searchParams }: Props) {
  const result = searchParams.result ?? 'pending';

  // Read DB for authoritative status — the query-param is a hint, not the source of truth
  const admin = getSupabaseAdminClient();
  const { data: sp } = await admin
    .from('subscription_payments')
    .select('status, plan, amount, tenant_id, tenants(name)')
    .eq('id', params.txnId)
    .maybeSingle();

  const dbStatus = sp?.status ?? result;
  const planName = sp?.plan ? (sp.plan.charAt(0).toUpperCase() + sp.plan.slice(1)) : '';
  const company  = sp ? (sp as unknown as { tenants: { name: string } | null }).tenants?.name ?? '' : '';

  if (dbStatus === 'paid' || result === 'success') {
    return (
      <Shell>
        <div className="w-16 h-16 rounded-full bg-done-bg flex items-center justify-center mx-auto">
          <CheckCircle2 size={32} className="text-done" />
        </div>
        <h1 className="text-2xl font-bold text-text mt-4">Payment confirmed!</h1>
        {company && (
          <p className="text-sm text-muted-foreground mt-1 font-medium">{company} &middot; {planName} plan</p>
        )}
        <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
          Your workspace is now active. We&apos;ve sent a setup link to your email — click it to set your password and open your dashboard.
        </p>
        <div className="mt-5 px-4 py-3 bg-done-bg rounded-xl border border-done/20 text-xs text-done font-medium">
          Check your inbox (and spam folder) for the invite email.
        </div>
        <Link
          href="/login"
          className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-done hover:text-done"
        >
          Go to login &rarr;
        </Link>
      </Shell>
    );
  }

  if (dbStatus === 'failed' || result === 'failed') {
    return (
      <Shell>
        <div className="w-16 h-16 rounded-full bg-problem-bg flex items-center justify-center mx-auto">
          <XCircle size={32} className="text-problem" />
        </div>
        <h1 className="text-2xl font-bold text-text mt-4">Payment failed</h1>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
          Your card was not charged. This can happen due to an incorrect card number, insufficient funds, or a bank block.
        </p>
        <Link
          href="/pricing"
          className="mt-6 inline-flex items-center justify-center gap-2 bg-brand-strong hover:opacity-90 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
        >
          Try again
        </Link>
      </Shell>
    );
  }

  if (result === 'invalid') {
    return (
      <Shell>
        <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto">
          <Clock size={32} className="text-amber-500" />
        </div>
        <h1 className="text-2xl font-bold text-text mt-4">Verification failed</h1>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
          We could not verify this payment. Please contact us and we&apos;ll sort it out immediately.
        </p>
        <a
          href="mailto:nalluruhaneel@gmail.com?subject=KOT.ai payment issue"
          className="mt-6 text-sm font-semibold text-done hover:text-done"
        >
          Contact support &rarr;
        </a>
      </Shell>
    );
  }

  // Pending — payment still processing
  return (
    <Shell>
      <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto animate-pulse">
        <Clock size={32} className="text-amber-500" />
      </div>
      <h1 className="text-2xl font-bold text-text mt-4">Processing payment&hellip;</h1>
      <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
        Your payment is being confirmed. This usually takes a few seconds.
      </p>
      <p className="text-xs text-muted-foreground mt-4">
        If this page does not update, check your email — the invite may already be on its way.
      </p>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-sunken flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-surface rounded-3xl border border-line shadow-sm p-8 text-center">
        <Link href="/" className="inline-flex items-center gap-2 text-text font-bold text-base mb-6">
          <div className="w-7 h-7 rounded-lg bg-brand-strong flex items-center justify-center">
            <Bot size={13} className="text-white" />
          </div>
          KOT.ai
        </Link>
        {children}
        <p className="text-[11px] text-muted-foreground/60 mt-8">Powered by KOT.ai</p>
      </div>
    </div>
  );
}
