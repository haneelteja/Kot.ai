import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ShoppingCart, Plus, ExternalLink, CheckCircle, Clock, Truck, XCircle, Package, ChefHat, BellRing, Printer } from 'lucide-react';
import { OrderStatusBadge }   from '@/components/dashboard/OrderStatusBadge';
import { SendInvoiceButton } from '@/components/dashboard/SendInvoiceButton';

const STATUS_ICON: Record<string, React.ReactNode> = {
  pending:    <Clock size={13} className="text-amber-500" />,
  confirmed:  <CheckCircle size={13} className="text-done" />,
  preparing:  <ChefHat size={13} className="text-violet-500" />,
  ready:      <BellRing size={13} className="text-done" />,
  dispatched: <Truck size={13} className="text-indigo-500" />,
  delivered:  <Package size={13} className="text-neutral" />,
  cancelled:  <XCircle size={13} className="text-red-400" />,
};

const PAYMENT_BADGE: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 ring-amber-200',
  paid:    'bg-done-bg text-done ring-transparent',
  failed:  'bg-red-50 text-red-700 ring-red-200',
  expired: 'bg-neutral-bg text-neutral ring-transparent',
};

type SearchParams = Promise<{ status?: string }>;

export default async function OrdersPage({ searchParams }: { searchParams: SearchParams }) {
  const { status: filterStatus } = await searchParams;

  const supabase = await getSupabaseServerClient();
  const admin    = getSupabaseAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: tenantUser } = await admin
    .from('tenant_users')
    .select('tenant_id')
    .eq('user_id', user.id)
    .single();

  const tenantId = tenantUser?.tenant_id ?? '';

  let query = admin
    .from('orders')
    .select(`
      id, total, total_paise, order_ref, source, status, created_at, updated_at, items_json, pickup_code,
      contact:contacts(phone, name),
      payments(id, status, link_url, webhook_received_at),
      order_items(id, name, unit_price_paise, quantity, line_total_paise)
    `)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (filterStatus && filterStatus !== 'all') {
    query = query.eq('status', filterStatus);
  }

  const { data: orders } = await query.limit(100);

  const STATUSES = ['all', 'pending', 'confirmed', 'preparing', 'ready', 'dispatched', 'delivered', 'cancelled'];

  // Single pass over orders to compute all counts — previously three separate filter passes.
  const totals = (orders ?? []).reduce(
    (acc, o) => {
      if (o.status === 'pending')   acc.pending++;
      if (o.status === 'confirmed') acc.confirmed++;
      if ((o.payments as Array<{ status: string }>)?.[0]?.status === 'paid') acc.paid++;
      return acc;
    },
    { all: orders?.length ?? 0, pending: 0, confirmed: 0, paid: 0 },
  );

  const totalRevenue = orders
    ?.filter(o => (o.payments as Array<{ status: string }>)?.[0]?.status === 'paid')
    .reduce((sum, o) => sum + (o.total_paise != null ? o.total_paise / 100 : Number(o.total)), 0) ?? 0;

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-text">Orders</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Manage customer orders and payment links</p>
        </div>
        <Link
          href="/orders/new"
          className="flex items-center gap-1.5 px-4 py-2 bg-brand-strong text-white text-sm font-semibold rounded-xl hover:bg-brand transition-colors"
        >
          <Plus size={14} />
          New Order
        </Link>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Orders', value: totals.all,       color: 'text-text'   },
          { label: 'Pending',      value: totals.pending,   color: 'text-amber-600'   },
          { label: 'Confirmed',    value: totals.confirmed, color: 'text-done' },
          { label: 'Revenue (₹)',  value: `₹${totalRevenue.toLocaleString('en-IN')}`, color: 'text-indigo-600' },
        ].map(s => (
          <div key={s.label} className="bg-white border border-line rounded-xl p-4">
            <p className={`text-xl font-bold tabular-nums ${s.color}`}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {STATUSES.map(s => (
          <Link
            key={s}
            href={s === 'all' ? '/orders' : `/orders?status=${s}`}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors capitalize ${
              (s === 'all' && !filterStatus) || filterStatus === s
                ? 'bg-done-bg text-done border-done'
                : 'bg-white text-muted-foreground border-line hover:bg-sunken'
            }`}
          >
            {s}
          </Link>
        ))}
      </div>

      {/* Orders list */}
      <div className="bg-white rounded-2xl border border-line shadow-sm overflow-hidden">
        {!orders?.length ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <ShoppingCart size={28} className="text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No orders yet.</p>
            <Link href="/orders/new" className="text-xs font-semibold text-brand-strong hover:underline">
              Create your first order →
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-line">
            {orders.map(order => {
              const contact    = order.contact as unknown as { phone: string; name: string | null } | null;
              const payment    = (order.payments as Array<{ id: string; status: string; link_url: string | null; webhook_received_at: string | null }>)?.[0];
              const lineItems  = (order.order_items as Array<{ id: string; name: string; quantity: number; unit_price_paise: number; line_total_paise: number }> | null) ?? [];
              const legacyItems = (order.items_json as Array<{ name: string; quantity: number; price: number }>) ?? [];
              // Render from real order_items when present (restaurant-bot orders), falling
              // back to the legacy items_json blob for pre-existing manual orders.
              const itemsSummary = lineItems.length > 0
                ? lineItems.map(i => ({ name: i.name, quantity: i.quantity }))
                : legacyItems.map(i => ({ name: i.name, quantity: i.quantity }));
              const totalDisplay = order.total_paise != null ? order.total_paise / 100 : Number(order.total);
              const isWhatsAppOrder = order.source === 'whatsapp_bot';
              const isPickup = order.source === 'whatsapp_bot' || order.source === 'weblink';

              return (
                <div key={order.id} className="flex items-center gap-4 px-5 py-4">
                  <div className="shrink-0">{STATUS_ICON[order.status]}</div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-text truncate">
                        {contact?.name ?? contact?.phone ?? '—'}
                      </p>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {order.order_ref ?? order.id.slice(0, 8)}
                      </span>
                      {isWhatsAppOrder && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-brand-wash text-brand-strong">
                          WhatsApp order
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {itemsSummary.slice(0, 2).map(i => `${i.name} ×${i.quantity}`).join(', ')}
                      {itemsSummary.length > 2 ? ` +${itemsSummary.length - 2} more` : ''}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <p className="text-sm font-bold text-text tabular-nums">₹{totalDisplay.toLocaleString('en-IN')}</p>

                    {payment && (
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ring-1 capitalize ${PAYMENT_BADGE[payment.status] ?? PAYMENT_BADGE.pending}`}>
                        {payment.status}
                      </span>
                    )}

                    {order.status === 'ready' && order.pickup_code && (
                      <span className="text-[11px] font-mono font-bold text-text bg-sunken px-2 py-0.5 rounded-md" title="Pickup verification code">
                        #{order.pickup_code}
                      </span>
                    )}

                    <OrderStatusBadge orderId={order.id} currentStatus={order.status as 'pending' | 'confirmed' | 'dispatched' | 'delivered' | 'cancelled'} isPickup={isPickup} />

                    <SendInvoiceButton orderId={order.id} />

                    <a
                      href={`/orders/${order.id}/print`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Print KOT"
                      className="p-1.5 rounded-md hover:bg-sunken text-muted-foreground hover:text-text transition-colors"
                    >
                      <Printer size={13} />
                    </a>

                    {payment?.link_url && payment.status !== 'paid' && (
                      <a
                        href={payment.link_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Open payment link"
                        className="p-1.5 rounded-md hover:bg-sunken text-muted-foreground hover:text-text transition-colors"
                      >
                        <ExternalLink size={13} />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
