'use client';

import * as React from 'react';
import { Button, StatusPill, TicketCard, Countdown, Card, CardHeader, CardTitle, CardContent, EmptyState, Input } from '@/components/kot-ui';

const SWATCHES: { name: string; varName: string }[] = [
  { name: 'Paper (bg)', varName: '--bg' },
  { name: 'Surface', varName: '--surface' },
  { name: 'Surface sunken', varName: '--surface-sunken' },
  { name: 'Ink (text)', varName: '--text' },
  { name: 'Graphite (muted)', varName: '--text-muted' },
  { name: 'Steel (line)', varName: '--line' },
  { name: 'Saffron (brand)', varName: '--brand' },
  { name: 'Saffron Deep', varName: '--brand-strong' },
  { name: 'Saffron Wash', varName: '--brand-wash' },
];

const STATUS_SWATCHES = ['waiting', 'progress', 'ready', 'done', 'problem', 'neutral'] as const;

export default function DesignPreviewPage() {
  const [theme, setTheme] = React.useState<'light' | 'dark'>('light');

  React.useEffect(() => {
    document.documentElement.dataset.theme = theme;
    return () => {
      delete document.documentElement.dataset.theme;
    };
  }, [theme]);

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h1 font-display font-bold text-[30px]">KOT.ai design system</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Live reference for docs/DESIGN.md — the binding source of truth for every screen&rsquo;s look.
          </p>
        </div>
        <Button variant="secondary" onClick={() => setTheme(t => (t === 'light' ? 'dark' : 'light'))}>
          Switch to {theme === 'light' ? 'dark' : 'light'}
        </Button>
      </div>

      <section>
        <h2 className="text-[22px] font-semibold mb-4">Colour tokens</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {SWATCHES.map(s => (
            <div key={s.varName} className="flex items-center gap-3 border border-line rounded-md p-3 bg-surface">
              <div
                className="w-10 h-10 rounded-sm border border-line shrink-0"
                style={{ background: `var(${s.varName})` }}
              />
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{s.name}</p>
                <p className="text-xs text-muted-foreground font-mono truncate">{s.varName}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-[22px] font-semibold mb-4">Status colours</h2>
        <div className="flex flex-wrap gap-2">
          {STATUS_SWATCHES.map(g => (
            <StatusPill key={g} status={g === 'waiting' ? 'awaiting_payment' : g === 'progress' ? 'preparing' : g === 'ready' ? 'food_ready' : g === 'done' ? 'delivered' : g === 'problem' ? 'payment_failed' : 'cancelled'} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-[22px] font-semibold mb-4">Type scale</h2>
        <div className="space-y-2">
          <p className="font-display font-extrabold text-[44px] leading-[48px]">Display 44</p>
          <p className="font-display font-bold text-[30px] leading-9">Heading 1 — 30</p>
          <p className="text-[22px] font-semibold leading-7">Heading 2 — 22</p>
          <p className="text-[18px] font-semibold leading-6">Heading 3 — 18</p>
          <p className="text-[15px] leading-[22px]">Body 15 — the quick brown fox jumps over the lazy dog</p>
          <p className="text-[13px] leading-[18px] text-muted-foreground">Small 13 — meta, helper text</p>
          <p className="font-mono text-[14px] leading-5">Ticket 14 mono — 2 × Chicken Dum Biryani</p>
          <p className="font-mono text-[13px] tracking-[0.06em]">KOT-HYD1-000123</p>
        </div>
      </section>

      <section>
        <h2 className="text-[22px] font-semibold mb-4">Buttons</h2>
        <div className="flex flex-wrap gap-3">
          <Button variant="primary">Accept order</Button>
          <Button variant="secondary">Edit</Button>
          <Button variant="ghost">Cancel</Button>
          <Button variant="destructive">Refund ₹240</Button>
          <Button variant="primary" disabled>Disabled</Button>
        </div>
      </section>

      <section>
        <h2 className="text-[22px] font-semibold mb-4">Input</h2>
        <div className="max-w-sm space-y-3">
          <Input placeholder="Search the menu" />
          <Input defaultValue="400001" error="Enter a 6-digit pincode" />
        </div>
      </section>

      <section>
        <h2 className="text-[22px] font-semibold mb-4">Countdown</h2>
        <div className="flex gap-6">
          <Countdown seconds={252} totalSeconds={300} />
          <Countdown seconds={38} totalSeconds={300} />
        </div>
      </section>

      <section>
        <h2 className="text-[22px] font-semibold mb-4">Card</h2>
        <Card className="max-w-sm">
          <CardHeader><CardTitle>Branch details</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Madhapur · Open till 11 pm · Last delivery order 10:30 pm.
          </CardContent>
        </Card>
      </section>

      <section>
        <h2 className="text-[22px] font-semibold mb-4">TicketCard</h2>
        <div className="flex flex-wrap gap-6">
          <TicketCard
            orderRef="KOT-MDP-000123"
            fulfilmentType="delivery"
            status="sent_to_restaurant"
            lines={[
              { qty: 2, name: 'Chkn Biryani' },
              { qty: 1, name: 'Raita' },
            ]}
            totalLabel="₹640"
            paid
            countdownSeconds={252}
            countdownTotalSeconds={300}
            primaryAction={<Button size="sm" className="flex-1">Accept</Button>}
            secondaryAction={<Button size="sm" variant="secondary" className="flex-1">Reject</Button>}
          />
          <TicketCard
            orderRef="KOT-MDP-000115"
            fulfilmentType="delivery"
            status="food_ready"
            isProblem
            lines={[{ qty: 1, name: 'Paneer Tikka' }]}
            totalLabel="₹420"
            paid
            primaryAction={<Button size="sm" className="flex-1">Book rider</Button>}
          />
        </div>
      </section>

      <section>
        <h2 className="text-[22px] font-semibold mb-4">Empty state</h2>
        <Card>
          <EmptyState
            title="No orders yet today"
            description="Share your WhatsApp link to start receiving orders."
            action={<Button>Share WhatsApp link</Button>}
          />
        </Card>
      </section>
    </div>
  );
}
