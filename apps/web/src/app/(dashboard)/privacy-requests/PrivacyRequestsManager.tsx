'use client';

import { useState } from 'react';
import { Search, Download, Trash2, AlertTriangle } from 'lucide-react';
import {
  findContactByPhoneAction,
  exportContactDataAction,
  deleteContactDataAction,
  type ContactLookupResult,
} from '@/app/actions/privacy';

export function PrivacyRequestsManager() {
  const [phone, setPhone]       = useState('');
  const [contact, setContact]   = useState<ContactLookupResult | null>(null);
  const [error, setError]       = useState<string | null>(null);
  const [busy, setBusy]         = useState(false);
  const [confirmPhone, setConfirmPhone] = useState('');
  const [deleteMode, setDeleteMode]     = useState(false);
  const [deleted, setDeleted]   = useState(false);

  async function handleSearch() {
    setBusy(true);
    setError(null);
    setContact(null);
    setDeleteMode(false);
    setDeleted(false);
    const result = await findContactByPhoneAction(phone);
    setBusy(false);
    if (result.error) { setError(result.error); return; }
    setContact(result.contact);
  }

  async function handleExport() {
    if (!contact) return;
    setBusy(true);
    setError(null);
    const result = await exportContactDataAction(contact.id);
    setBusy(false);
    if (result.error) { setError(result.error); return; }

    const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `contact-${contact.id}-export.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function handleDelete() {
    if (!contact) return;
    setBusy(true);
    setError(null);
    const result = await deleteContactDataAction(contact.id, confirmPhone);
    setBusy(false);
    if (result.error) { setError(result.error); return; }
    setDeleted(true);
    setDeleteMode(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          type="tel"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          placeholder="+919XXXXXXXXX"
          className="flex-1 rounded-xl border border-line bg-sunken px-3 py-2 text-sm text-text placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent font-mono"
        />
        <button
          type="button"
          onClick={handleSearch}
          disabled={busy || !phone.trim()}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-strong text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          <Search size={14} /> Search
        </button>
      </div>

      {error && <p className="text-sm text-problem">{error}</p>}

      {deleted && (
        <div className="bg-done-bg border border-done/30 rounded-2xl p-4">
          <p className="text-sm text-done">This contact&apos;s data has been anonymized.</p>
        </div>
      )}

      {contact && !deleted && (
        <div className="bg-surface border border-line rounded-2xl p-5 space-y-4">
          <div>
            <p className="text-sm font-medium text-text">{contact.name ?? 'No name on file'}</p>
            <p className="text-xs text-muted-foreground font-mono">{contact.phone}</p>
            <p className="text-xs text-muted-foreground mt-1">Contact since {new Date(contact.created_at).toLocaleDateString('en-IN')}</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExport}
              disabled={busy}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-sunken text-text hover:bg-line disabled:opacity-50"
            >
              <Download size={13} /> Export data
            </button>
            <button
              type="button"
              onClick={() => setDeleteMode(true)}
              disabled={busy}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-problem hover:bg-problem-bg disabled:opacity-50"
            >
              <Trash2 size={13} /> Delete data
            </button>
          </div>

          {deleteMode && (
            <div className="border-t border-line pt-4 space-y-2">
              <div className="flex items-center gap-1.5 text-xs text-problem">
                <AlertTriangle size={13} /> This cannot be undone. Chat history is anonymized and the contact&apos;s name/phone are permanently cleared.
              </div>
              <p className="text-xs text-muted-foreground">Type the contact&apos;s phone number ({contact.phone}) to confirm:</p>
              <input
                type="tel"
                value={confirmPhone}
                onChange={e => setConfirmPhone(e.target.value)}
                placeholder={contact.phone ?? ''}
                className="w-full rounded-xl border border-line bg-sunken px-3 py-2 text-sm text-text placeholder:text-muted-foreground font-mono focus:outline-none focus:ring-2 focus:ring-problem focus:border-transparent"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={busy || confirmPhone.trim() !== contact.phone}
                  className="px-3 py-2 rounded-xl text-xs font-medium bg-problem text-white hover:opacity-90 disabled:opacity-40"
                >
                  Confirm deletion
                </button>
                <button
                  type="button"
                  onClick={() => { setDeleteMode(false); setConfirmPhone(''); }}
                  className="px-3 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:bg-sunken"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
