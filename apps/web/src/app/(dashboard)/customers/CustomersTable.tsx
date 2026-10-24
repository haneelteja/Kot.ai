'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search, Shield } from 'lucide-react';
import type { CustomerRow } from '@/app/actions/customers';

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function CustomersTable({ customers }: { customers: CustomerRow[] }) {
  const [query, setQuery] = useState('');

  const visible = query.trim()
    ? customers.filter(c =>
        (c.name ?? '').toLowerCase().includes(query.toLowerCase()) ||
        (c.phone ?? '').includes(query.trim()),
      )
    : customers;

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by name or phone"
          className="w-full rounded-xl border border-line bg-sunken pl-9 pr-3 py-2 text-sm text-text placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
        />
      </div>

      {visible.length === 0 ? (
        <div className="bg-surface border border-line rounded-2xl p-8 text-center">
          <p className="text-sm text-muted-foreground">No customers {query ? 'match that search' : 'yet'}.</p>
        </div>
      ) : (
        <div className="bg-surface border border-line rounded-2xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Customer</th>
                <th className="px-4 py-2.5 font-medium">Orders</th>
                <th className="px-4 py-2.5 font-medium">Spend</th>
                <th className="px-4 py-2.5 font-medium">Last order</th>
                <th className="px-4 py-2.5 font-medium">Marketing</th>
                <th className="px-4 py-2.5 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {visible.map(c => (
                <tr key={c.id}>
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-text">{c.name ?? 'No name'}</p>
                    <p className="text-xs text-muted-foreground font-mono">{c.phone ?? '—'}</p>
                  </td>
                  <td className="px-4 py-2.5 text-text">{c.order_count}</td>
                  <td className="px-4 py-2.5 text-text">₹{c.total_spend.toFixed(0)}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{fmtDate(c.last_order_at)}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ring-1 ${
                      c.marketing_optin ? 'bg-done-bg text-done ring-done/30' : 'bg-neutral-bg text-neutral ring-line'
                    }`}>
                      {c.marketing_optin ? 'Opted in' : 'Not opted in'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {c.phone && (
                      <Link
                        href={`/privacy-requests?phone=${encodeURIComponent(c.phone)}`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-text"
                        title="Export or delete this customer's data"
                      >
                        <Shield size={12} /> Data
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
