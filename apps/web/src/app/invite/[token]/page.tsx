import { getInviteByToken } from '@/app/actions/invites';
import { AcceptInviteForm } from './AcceptInviteForm';

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invite = await getInviteByToken(token);

  if (!invite) {
    return (
      <div className="min-h-screen bg-sunken flex items-center justify-center p-4">
        <div className="bg-surface rounded-2xl shadow-float border border-line p-8 max-w-md w-full text-center space-y-3">
          <div className="w-12 h-12 bg-problem-bg rounded-full flex items-center justify-center mx-auto">
            <span className="text-2xl">✗</span>
          </div>
          <h2 className="text-lg font-bold text-text">Invite Not Found</h2>
          <p className="text-sm text-muted-foreground">
            This invite link is invalid, has already been used, or has expired.
          </p>
        </div>
      </div>
    );
  }

  const isExpired = new Date(invite.expires_at) < new Date();

  if (isExpired) {
    return (
      <div className="min-h-screen bg-sunken flex items-center justify-center p-4">
        <div className="bg-surface rounded-2xl shadow-float border border-line p-8 max-w-md w-full text-center space-y-3">
          <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto">
            <span className="text-2xl">⏰</span>
          </div>
          <h2 className="text-lg font-bold text-text">Invite Expired</h2>
          <p className="text-sm text-muted-foreground">
            This invite link expired on{' '}
            {new Date(invite.expires_at).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
            . Please ask your administrator to send a new invite.
          </p>
        </div>
      </div>
    );
  }

  const tenantName = (invite.tenant as { name: string } | null)?.name ?? 'your organisation';

  return (
    <div className="min-h-screen bg-sunken flex items-center justify-center p-4">
      <div className="bg-surface rounded-2xl shadow-float border border-line p-8 max-w-md w-full space-y-6">
        <div className="text-center space-y-1">
          <div className="w-12 h-12 bg-brand-wash rounded-2xl flex items-center justify-center mx-auto mb-3">
            <span className="text-2xl">✉</span>
          </div>
          <h1 className="text-xl font-bold text-text">You&apos;re invited!</h1>
          <p className="text-sm text-muted-foreground">
            Set up your account to get started on KOT.ai.
          </p>
        </div>

        <AcceptInviteForm
          token={token}
          email={invite.email}
          tenantName={tenantName}
          role={invite.role}
        />
      </div>
    </div>
  );
}
