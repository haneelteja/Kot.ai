import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { redirect, notFound } from 'next/navigation';
import { PrintButton } from '@/components/PrintButton';

export const metadata = { title: 'Print KOT' };

/**
 * FUL-05: a thermal-printer-friendly KOT view — plain black-on-white, large
 * monospace, no dashboard chrome. Deliberately a top-level route (not under
 * the (dashboard) route group), since that group's layout wraps every page
 * in the sidebar/header shell, which would print alongside the ticket.
 * Opened in a new tab from the Orders screen; printed via the browser's
 * own print dialog.
 */
export default async function PrintKotPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await getSupabaseServerClient();
  const admin    = getSupabaseAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: tenantUser } = await admin.from('tenant_users').select('tenant_id').eq('user_id', user.id).single();
  const tenantId = tenantUser?.tenant_id;
  if (!tenantId) redirect('/login');

  const { data: order } = await admin
    .from('orders')
    .select(`
      id, order_ref, total, total_paise, source, status, created_at, items_json, pickup_code,
      contact:contacts(phone, name),
      order_items(id, name, quantity, line_total_paise)
    `)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single();

  if (!order) notFound();

  const lineItems = (order.order_items as Array<{ id: string; name: string; quantity: number; line_total_paise: number }> | null) ?? [];
  const legacyItems = (order.items_json as Array<{ name: string; quantity: number; price: number }>) ?? [];
  const lines = lineItems.length > 0
    ? lineItems.map(i => ({ name: i.name, quantity: i.quantity }))
    : legacyItems.map(i => ({ name: i.name, quantity: i.quantity }));

  const contact = order.contact as unknown as { phone: string | null; name: string | null } | null;
  const total = order.total_paise != null ? (order.total_paise as number) / 100 : Number(order.total);
  const isPickup = order.source === 'whatsapp_bot' || order.source === 'weblink';

  return (
    <div style={{ fontFamily: "'Courier New', monospace", padding: 16, width: 320, color: '#000', background: '#fff' }}>
      <style>{`@media print { .print-btn { display: none; } body { width: auto; } }`}</style>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: 18, margin: '0 0 4px' }}>KITCHEN ORDER TICKET</h1>
        <p style={{ fontSize: 12, margin: '2px 0' }}>{new Date(order.created_at as string).toLocaleString('en-IN')}</p>
      </div>
      <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }} />
      <p style={{ fontSize: 12, margin: '2px 0' }}><strong>Order:</strong> {order.order_ref ?? order.id.slice(0, 8).toUpperCase()}</p>
      <p style={{ fontSize: 12, margin: '2px 0' }}><strong>Type:</strong> {isPickup ? 'Takeaway' : 'Order'}</p>
      {order.pickup_code && <p style={{ fontSize: 12, margin: '2px 0' }}><strong>Pickup code:</strong> {order.pickup_code}</p>}
      {contact?.name && <p style={{ fontSize: 12, margin: '2px 0' }}><strong>Customer:</strong> {contact.name}</p>}
      <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }} />
      {lines.map((l, i) => (
        <div key={i} style={{ fontSize: 14, margin: '2px 0' }}>{l.quantity} &times; {l.name}</div>
      ))}
      <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }} />
      <p style={{ fontSize: 16, fontWeight: 'bold', marginTop: 8 }}>Total: ₹{total.toFixed(2)}</p>
      <PrintButton />
    </div>
  );
}
