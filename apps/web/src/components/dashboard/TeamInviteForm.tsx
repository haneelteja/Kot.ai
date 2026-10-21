'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { sendTeamInviteAction } from '@/app/actions/tenant-team';
import { UserPlus } from 'lucide-react';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="px-5 py-2.5 rounded-xl bg-brand-strong text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-colors whitespace-nowrap"
    >
      {pending ? 'Sending…' : 'Send invite'}
    </button>
  );
}

export function TeamInviteForm() {
  const [state, formAction] = useFormState(sendTeamInviteAction, null);

  return (
    <div className="bg-white rounded-2xl border border-line shadow-sm p-5">
      <h3 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
        <UserPlus size={14} />
        Invite a team member
      </h3>
      {/* key resets uncontrolled inputs on successful invite */}
      <form key={state?.success ? 'sent' : 'idle'} action={formAction} className="flex flex-col sm:flex-row gap-3">
        <input
          name="email"
          type="email"
          required
          placeholder="colleague@email.com"
          className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition-all"
        />
        <select
          name="role"
          defaultValue="agent"
          className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand transition-all"
        >
          <option value="agent">Agent</option>
          <option value="supervisor">Supervisor</option>
          <option value="admin">Admin</option>
        </select>
        <SubmitButton />
      </form>
      {state?.error && (
        <p className="text-xs text-red-500 mt-2">{state.error}</p>
      )}
      {state?.success && (
        <p className="text-xs text-done mt-2">Invite sent successfully!</p>
      )}
    </div>
  );
}
