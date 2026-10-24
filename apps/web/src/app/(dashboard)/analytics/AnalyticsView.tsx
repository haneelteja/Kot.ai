'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts';
import type { AnalyticsSummary } from '@/app/actions/analytics';

// Same categorical order already used by AnalyticsCharts.tsx — the
// project's own validated palette, reused rather than inventing a new one.
const BRAND_COLORS = ['#C8431D', '#6366f1', '#f59e0b'];

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-surface border border-line rounded-2xl p-4">
      <p className="text-xs text-muted-foreground font-medium">{label}</p>
      <p className="text-2xl font-bold text-text mt-1">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

export function AnalyticsView({ summary }: { summary: AnalyticsSummary }) {
  const funnelData = summary.funnel.length > 0
    ? summary.funnel[0]!.stages.map((s, i) => {
        const row: Record<string, string | number> = { stage: s.stage };
        for (const f of summary.funnel) row[f.source] = f.stages[i]!.count;
        return row;
      })
    : [];

  const aovData = summary.aovTrend.map(p => ({
    date: new Date(p.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    orders: p.orders,
    aov: p.orders > 0 ? Math.round(p.revenuePaise / p.orders / 100) : 0,
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile label="Conversations" value={String(summary.totalConversations)} />
        <StatTile label="Escalated to staff" value={String(summary.escalatedConversations)}
          sub={summary.totalConversations > 0 ? `${Math.round((summary.escalatedConversations / summary.totalConversations) * 100)}% of conversations` : undefined} />
        <StatTile label="Bot-handled only" value={`${Math.round(summary.botOnlyShare * 100)}%`} />
        <StatTile label="Repeat customer rate" value={`${Math.round(summary.repeatCustomerRate * 100)}%`} />
      </div>

      <div className="bg-surface border border-line rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-text">Conversion funnel</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Conversation → cart → checkout → paid, by source. &ldquo;Menu views&rdquo; isn&apos;t tracked, so that stage from the brief is omitted.</p>
        {funnelData.length > 0 && funnelData.some(d => summary.funnel.some(f => Number(d[f.source]) > 0)) ? (
          <ResponsiveContainer width="100%" height={240} className="mt-4">
            <BarChart data={funnelData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="stage" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }} />
              {summary.funnel.length > 1 && <Legend wrapperStyle={{ fontSize: '12px' }} />}
              {summary.funnel.map((f, i) => (
                <Bar key={f.source} dataKey={f.source} name={f.source === 'whatsapp_bot' ? 'WhatsApp' : 'Web'} fill={BRAND_COLORS[i % BRAND_COLORS.length]} radius={[4, 4, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[160px] mt-4 rounded-xl bg-sunken/50">
            <p className="text-sm text-muted-foreground">No activity in this period yet</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-surface border border-line rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-text">Orders per day</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Average order value shown on hover</p>
          {aovData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220} className="mt-4">
              <BarChart data={aovData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }}
                  formatter={(value: number, name: string) => name === 'orders' ? [value, 'Orders'] : [`₹${value}`, 'AOV']}
                />
                <Bar dataKey="orders" name="orders" fill={BRAND_COLORS[0]} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[220px] mt-4 rounded-xl bg-sunken/50">
              <p className="text-sm text-muted-foreground">No orders in this period yet</p>
            </div>
          )}
        </div>

        <div className="bg-surface border border-line rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-text">Top items</h3>
          <p className="text-xs text-muted-foreground mt-0.5">By quantity sold</p>
          {summary.topItems.length > 0 ? (
            <div className="mt-4 space-y-2">
              {summary.topItems.map((item, i) => (
                <div key={item.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs text-muted-foreground w-4 shrink-0">{i + 1}.</span>
                    <span className="text-text truncate">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
                    <span>{item.quantity}×</span>
                    <span className="font-medium text-text">₹{(item.revenuePaise / 100).toFixed(0)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-[160px] mt-4 rounded-xl bg-sunken/50">
              <p className="text-sm text-muted-foreground">No orders in this period yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
