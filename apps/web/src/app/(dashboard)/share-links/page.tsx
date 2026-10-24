import { redirect } from 'next/navigation';
import { Link2 } from 'lucide-react';
import { getSession } from '@/lib/session';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { ShareLinksManager, type ShareLinkDef } from './ShareLinksManager';

export const metadata = { title: 'Share Links & QR Codes' };

/**
 * LNK-01/02: ready-made wa.me links with prefilled text, plus downloadable
 * QR codes. Tenant-level, not per-branch — the BR epic (multi-branch
 * model) doesn't exist in this codebase, so this scopes to the one number
 * every current tenant has. LNK-03 (source attribution in analytics) is
 * out of scope — it depends on ANL-01, which isn't built.
 */
export default async function ShareLinksPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const admin = getSupabaseAdminClient();
  const { data: wn } = await admin
    .from('whatsapp_numbers')
    .select('phone_number')
    .eq('tenant_id', session.tenantId)
    .eq('product_slug', 'restaurant_bot')
    .eq('active', true)
    .order('role', { ascending: true })
    .limit(1)
    .maybeSingle();

  const phoneDigits = (wn?.phone_number as string | undefined)?.replace(/[^\d]/g, '') ?? null;

  const links: ShareLinkDef[] = phoneDigits ? [
    { label: 'Order food',    text: 'Hi! I’d like to see the menu and order.' },
    { label: 'Book a table',  text: 'Hi! I’d like to book a table.' },
    { label: 'View menu',     text: 'Hi! Can I see the menu?' },
  ].map(l => ({ ...l, url: `https://wa.me/${phoneDigits}?text=${encodeURIComponent(l.text)}` })) : [];

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-brand-wash flex items-center justify-center shrink-0">
          <Link2 size={18} className="text-brand-strong" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-text">Share Links & QR Codes</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Ready-made WhatsApp links for table tents, flyers, Instagram bio, or your Google Business Profile — each one opens a chat with a prefilled message.
          </p>
        </div>
      </div>

      {!phoneDigits ? (
        <div className="bg-surface border border-line rounded-2xl p-8 text-center">
          <p className="text-sm text-muted-foreground">Connect a WhatsApp number in Settings first.</p>
        </div>
      ) : (
        <ShareLinksManager links={links} />
      )}
    </div>
  );
}
