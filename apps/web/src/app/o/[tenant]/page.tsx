import { verifyOrderingLink } from '@/lib/ordering-link';
import { MenuOrderClient, type PublicMenuItem } from './MenuOrderClient';

export const dynamic = 'force-dynamic';

async function fetchMenu(tenantId: string): Promise<PublicMenuItem[]> {
  const apiUrl = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';
  try {
    const res = await fetch(`${apiUrl}/api/public/orders/menu/${tenantId}`, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = (await res.json()) as { menu?: PublicMenuItem[] };
    return data.menu ?? [];
  } catch {
    return [];
  }
}

function ErrorCard({ message }: { message: string }) {
  return (
    <main className="min-h-screen bg-sunken flex items-center justify-center p-4">
      <div className="bg-surface border border-line rounded-2xl p-8 text-center max-w-sm">
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </main>
  );
}

export default async function PublicOrderPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant } = await params;

  // WEB-01: the URL segment is a signed token (lib: @alphabot/shared's
  // ordering-link util), not a raw tenant id. 'unsigned' is accepted as a
  // bare-UUID fallback for links shared before ORDERING_LINK_SECRET was
  // configured — everything else is rejected with a clear message instead
  // of silently working or 404ing.
  const verified = verifyOrderingLink(tenant, process.env['ORDERING_LINK_SECRET']);
  let tenantId: string;
  if (verified.ok) {
    tenantId = verified.tenantId;
  } else if (verified.error === 'unsigned') {
    tenantId = tenant;
  } else {
    return <ErrorCard message={verified.error === 'expired' ? 'This ordering link has expired — please ask the restaurant to send you a fresh one.' : 'This ordering link isn’t valid.'} />;
  }

  const menu = await fetchMenu(tenantId);

  return (
    <main className="min-h-screen bg-sunken">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <h1 className="text-xl font-bold text-text mb-1">Order Online</h1>
        <p className="text-sm text-muted-foreground mb-5">Browse the menu and place your order — pay securely online.</p>

        {menu.length === 0 ? (
          <div className="bg-surface border border-line rounded-2xl p-8 text-center">
            <p className="text-sm text-muted-foreground">The menu isn&apos;t available right now. Please try again later.</p>
          </div>
        ) : (
          <MenuOrderClient tenantId={tenantId} menu={menu} />
        )}
      </div>
    </main>
  );
}
