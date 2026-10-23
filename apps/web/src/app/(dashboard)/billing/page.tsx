import { redirect } from 'next/navigation';

// Folded into /settings (tab: Billing) — kept as a redirect so old
// links/bookmarks (and the Easebuzz payment callback, which still
// targets this exact path) keep working, preserving ?eb=paid|failed.
// The actual component now lives at components/dashboard/BillingTab.tsx.
export default function BillingRedirect({
  searchParams,
}: {
  searchParams?: { eb?: string };
}) {
  redirect(`/settings?tab=billing${searchParams?.eb ? `&eb=${searchParams.eb}` : ''}`);
}
