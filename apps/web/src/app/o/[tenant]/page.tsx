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

export default async function PublicOrderPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant } = await params;
  const menu = await fetchMenu(tenant);

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
          <MenuOrderClient tenantId={tenant} menu={menu} />
        )}
      </div>
    </main>
  );
}
