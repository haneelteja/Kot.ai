import { redirect } from 'next/navigation';

// The Chats tab on /conversations is now a split view (list + live detail
// panel in one screen) instead of navigating to a separate page — this
// route just preserves old /conversations/:id links and bookmarks.
export default async function ConversationDetailRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/conversations?tab=chats&id=${id}`);
}
