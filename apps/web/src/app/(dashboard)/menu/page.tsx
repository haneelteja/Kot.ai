import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { getMenuCategoriesAction, getMenuItemsAction } from '@/app/actions/menu';
import { MenuManager } from './MenuManager';

export default async function MenuPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const [{ categories }, { items }] = await Promise.all([
    getMenuCategoriesAction(),
    getMenuItemsAction(),
  ]);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-text">Menu</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Manage the menu your WhatsApp bot shows and orders from.
        </p>
      </div>
      <MenuManager initialCategories={categories} initialItems={items} />
    </div>
  );
}
