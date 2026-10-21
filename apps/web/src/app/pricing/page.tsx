'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Bot, Check, X, ArrowRight, MessageSquare, Zap, LifeBuoy, Calendar, Loader2 } from 'lucide-react';
import { initiateSubscriptionAction } from '@/app/actions/subscriptions';

const PLANS = [
  {
    key:      'starter',
    name:     'Starter',
    price:    8000,
    priceLabel: '₹8,000',
    desc:     'One Support Bot for teams getting started with WhatsApp AI.',
    cta:      'Get started',
    ctaHref:  'https://wa.me/919642917777?text=Hi%2C+I%27d+like+to+subscribe+to+the+KOT.ai+Starter+Plan',
    highlight: false,
    features: [
      'Support Bot (1 WhatsApp number)',
      'Up to 1,000 conversations/mo',
      'Knowledge base (200 entries)',
      'Basic analytics',
      'Email support',
    ],
    missing: ['Sales Bot', 'Appointment Bot', 'Lifecycle Bot', 'Priority support'],
  },
  {
    key:       'growth',
    name:      'Growth',
    price:     15000,
    priceLabel: '₹15,000',
    desc:      'Support and Sales bots for businesses scaling their pipeline.',
    cta:       'Get started',
    ctaHref:   null,
    highlight:  true,
    features: [
      'Support Bot + Sales Bot',
      'Up to 3,000 conversations/mo',
      'Knowledge base (500 entries)',
      'Lead pipeline & CRM sync',
      'Broadcast campaigns',
      'Advanced analytics',
      'Priority email support',
    ],
    missing: ['Appointment Bot', 'Lifecycle Bot'],
  },
  {
    key:       'scale',
    name:      'Scale',
    price:     25000,
    priceLabel: '₹25,000',
    desc:      'All 4 bots. Unlimited conversations. Full platform access.',
    cta:       'Get started',
    ctaHref:   null,
    highlight:  false,
    features: [
      'All 4 bots (Support + Sales + Appointment + Lifecycle)',
      'Up to 10,000 conversations/mo',
      'Unlimited knowledge base',
      'Appointment booking & reminders',
      'Order & invoice automation',
      'Payment collection via WhatsApp',
      'All CRM integrations',
      'Dedicated onboarding',
    ],
    missing: [],
  },
];

function CheckoutModal({
  plan,
  onClose,
}: {
  plan: typeof PLANS[0];
  onClose: () => void;
}) {
  const [company, setCompany] = useState('');
  const [email,   setEmail]   = useState('');
  const [error,   setError]   = useState('');
  const [isPending, start]    = useTransition();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!company.trim()) { setError('Company name is required'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('Enter a valid email'); return; }

    start(async () => {
      const result = await initiateSubscriptionAction(company.trim(), email.trim(), plan.key);
      if ('error' in result) { setError(result.error); return; }
      window.location.href = result.linkUrl;
    });
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-surface rounded-2xl shadow-2xl w-full max-w-md p-7"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="text-lg font-bold text-text">Start {plan.name} Plan</h3>
            <p className="text-sm text-muted-foreground mt-0.5">{plan.priceLabel}/month &middot; cancel anytime</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-text transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
              Company Name
            </label>
            <input
              value={company}
              onChange={e => setCompany(e.target.value)}
              placeholder="Acme Corp"
              className="w-full border border-line rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
              Work Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="w-full border border-line rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
            />
          </div>

          {error && (
            <p className="text-sm text-problem font-medium">{error}</p>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="flex items-center justify-center gap-2 w-full bg-brand-strong hover:opacity-90 disabled:opacity-60 text-white font-semibold text-sm py-3 rounded-xl transition-colors"
          >
            {isPending ? (
              <><Loader2 size={15} className="animate-spin" /> Redirecting to payment&hellip;</>
            ) : (
              <>Continue to payment <ArrowRight size={15} /></>
            )}
          </button>

          <p className="text-xs text-muted-foreground text-center">
            Secured by Easebuzz &middot; Your workspace is created instantly on payment.
          </p>
        </form>
      </div>
    </div>
  );
}

export default function PricingPage() {
  const [checkoutPlan, setCheckoutPlan] = useState<typeof PLANS[0] | null>(null);

  return (
    <div className="min-h-screen bg-sunken">
      {/* Nav */}
      <nav className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-brand-strong flex items-center justify-center">
            <Bot size={15} className="text-white" />
          </div>
          <span className="font-bold text-text text-base">KOT.ai</span>
        </Link>
        <Link
          href="/login"
          className="text-sm font-medium text-muted-foreground hover:text-text transition-colors"
        >
          Sign in
        </Link>
      </nav>

      {/* Hero */}
      <div className="max-w-3xl mx-auto px-6 text-center pt-10 pb-14">
        <div className="inline-flex items-center gap-2 bg-brand-wash border border-brand/20 text-brand-strong text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
          <Zap size={11} /> Simple, transparent pricing
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-text tracking-tight leading-tight">
          Pick a plan.<br />Your AI is live in minutes.
        </h1>
        <p className="text-muted-foreground text-lg mt-4 max-w-xl mx-auto leading-relaxed">
          No contracts. Pay monthly and cancel anytime.
        </p>

        {/* Bot icons */}
        <div className="flex items-center justify-center gap-6 mt-8 text-sm text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1.5"><LifeBuoy size={14} className="text-sky-400" /> Support Bot</span>
          <span className="flex items-center gap-1.5"><MessageSquare size={14} className="text-violet-400" /> Sales Bot</span>
          <span className="flex items-center gap-1.5"><Calendar size={14} className="text-pink-400" /> Appointment Bot</span>
          <span className="flex items-center gap-1.5"><Zap size={14} className="text-orange-400" /> Lifecycle Bot</span>
        </div>
      </div>

      {/* Plan cards */}
      <div className="max-w-6xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANS.map(plan => (
            <div
              key={plan.key}
              className={`relative flex flex-col rounded-2xl border p-7 ${
                plan.highlight
                  ? 'border-brand bg-rail text-white shadow-xl shadow-black/20'
                  : 'border-line bg-surface'
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-brand-strong text-white text-xs font-bold px-3 py-1 rounded-full">
                  Most popular
                </div>
              )}

              <div className="mb-5">
                <p className={`text-xs font-bold uppercase tracking-widest mb-2 ${plan.highlight ? 'text-brand' : 'text-brand-strong'}`}>
                  {plan.name}
                </p>
                <div className="flex items-baseline gap-1">
                  <span className={`text-4xl font-extrabold ${plan.highlight ? 'text-white' : 'text-text'}`}>
                    {plan.priceLabel}
                  </span>
                  {plan.price && (
                    <span className={`text-sm font-medium ${plan.highlight ? 'text-white/60' : 'text-muted-foreground'}`}>/mo</span>
                  )}
                </div>
                <p className={`text-sm mt-2 leading-snug ${plan.highlight ? 'text-white/70' : 'text-muted-foreground'}`}>
                  {plan.desc}
                </p>
              </div>

              {/* CTA */}
              {plan.ctaHref ? (
                <a
                  href={plan.ctaHref}
                  className={`flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold mb-6 transition-colors ${
                    plan.highlight
                      ? 'bg-brand-strong hover:opacity-90 text-white'
                      : 'bg-sunken hover:bg-line text-text'
                  }`}
                >
                  {plan.cta}
                </a>
              ) : (
                <button
                  onClick={() => setCheckoutPlan(plan)}
                  className={`flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold mb-6 transition-colors ${
                    plan.highlight
                      ? 'bg-brand-strong hover:opacity-90 text-white'
                      : 'bg-text hover:opacity-90 text-white'
                  }`}
                >
                  {plan.cta} <ArrowRight size={13} />
                </button>
              )}

              {/* Features */}
              <ul className="space-y-2.5 flex-1">
                {plan.features.map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check size={14} className={`mt-0.5 shrink-0 ${plan.highlight ? 'text-white' : 'text-done'}`} />
                    <span className={plan.highlight ? 'text-white/80' : 'text-muted-foreground'}>{f}</span>
                  </li>
                ))}
                {plan.missing.map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <X size={14} className={`mt-0.5 shrink-0 ${plan.highlight ? 'text-white/40' : 'text-muted-foreground/50'}`} />
                    <span className={`line-through ${plan.highlight ? 'text-white/40' : 'text-muted-foreground/50'}`}>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Footer note */}
        <p className="text-center text-sm text-muted-foreground mt-10">
          All plans include WhatsApp Cloud API integration, conversation analytics, and team access.
          Questions? <a href="mailto:nalluruhaneel@gmail.com" className="text-brand-strong hover:underline">Contact us</a>.
        </p>
      </div>

      {/* Checkout modal */}
      {checkoutPlan && (
        <CheckoutModal plan={checkoutPlan} onClose={() => setCheckoutPlan(null)} />
      )}
    </div>
  );
}
