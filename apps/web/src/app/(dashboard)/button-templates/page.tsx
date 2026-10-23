import { redirect } from 'next/navigation';

// Folded into /configurations (tab: Buttons) — kept as a redirect so old
// links/bookmarks still work. The actual component now lives at
// components/dashboard/ButtonTemplatesTab.tsx.
export default function ButtonTemplatesRedirect() {
  redirect('/configurations?tab=buttons');
}
