import { redirect } from 'next/navigation';

// Folded into /configurations (tab: Guardrails) — kept as a redirect so
// old links/bookmarks still work, preserving the ?bot= filter. The actual
// component now lives at components/dashboard/GuardrailsTab.tsx.
export default async function GuardrailsRedirect({
  searchParams,
}: {
  searchParams: Promise<{ bot?: string }>;
}) {
  const { bot } = await searchParams;
  redirect(`/configurations?tab=guardrails${bot ? `&bot=${bot}` : ''}`);
}
