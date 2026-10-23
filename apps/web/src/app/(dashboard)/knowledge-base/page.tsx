import { redirect } from 'next/navigation';

// Folded into /configurations (tab: Knowledge Base) — kept as a redirect
// so old links/bookmarks still work. The actual component now lives at
// components/dashboard/KnowledgeBaseTab.tsx.
export default function KnowledgeBaseRedirect() {
  redirect('/configurations?tab=knowledge-base');
}
