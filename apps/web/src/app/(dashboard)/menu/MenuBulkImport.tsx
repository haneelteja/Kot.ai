'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, X, Loader2, Plus, Pencil, AlertTriangle } from 'lucide-react';
import { previewMenuImportAction, applyMenuImportAction } from '@/app/actions/menu';
import type { MenuImportDiff } from '@/lib/menu-csv';

function fmtRupees(r: number): string {
  return `₹${r.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const FIELD_LABELS: Record<string, string> = {
  price: 'price', category: 'category', veg: 'veg/non-veg', description: 'description',
};

export function MenuBulkImport({ onClose }: { onClose: () => void }) {
  const [csvText, setCsvText]       = useState<string | null>(null);
  const [fileName, setFileName]     = useState<string | null>(null);
  const [diff, setDiff]             = useState<MenuImportDiff | null>(null);
  const [parseErrors, setParseErrors] = useState<string[] | undefined>(undefined);
  const [loading, setLoading]       = useState(false);
  const [applying, setApplying]     = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [done, setDone]             = useState<{ added: number; updated: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function handleFile(file: File) {
    setError(null);
    setDiff(null);
    setDone(null);
    setFileName(file.name);
    const text = await file.text();
    setCsvText(text);
    setLoading(true);
    const result = await previewMenuImportAction(text);
    setLoading(false);
    if (result.error) { setError(result.error); return; }
    setDiff(result.diff ?? null);
    setParseErrors(result.parseErrors);
  }

  async function handleApply() {
    if (!csvText) return;
    setApplying(true);
    setError(null);
    const result = await applyMenuImportAction(csvText);
    setApplying(false);
    if (result.error) { setError(result.error); return; }
    setDone({ added: result.added ?? 0, updated: result.updated ?? 0 });
    setDiff(null);
    router.refresh();
  }

  const totalChanges = (diff?.added.length ?? 0) + (diff?.changed.length ?? 0);

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-4 p-6 space-y-4 border border-line max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-text">Bulk menu import</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-sunken">
            <X size={16} />
          </button>
        </div>

        <p className="text-xs text-muted-foreground">
          Upload a CSV with columns <code className="bg-sunken px-1 rounded">name, price, category, veg, description</code>.
          Nothing changes until you review the preview below and approve it.
        </p>

        {!diff && !done && (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-line rounded-xl p-8 text-center cursor-pointer hover:border-brand transition-colors"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) void handleFile(f); }}
            />
            <Upload size={24} className="mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-text font-medium">{fileName ?? 'Click to choose a CSV file'}</p>
            {loading && <p className="text-xs text-muted-foreground mt-2 flex items-center justify-center gap-1.5"><Loader2 size={12} className="animate-spin" /> Comparing against your current menu…</p>}
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 bg-problem-bg border border-problem/20 rounded-xl px-4 py-2.5 text-sm text-problem">
            <AlertTriangle size={13} className="shrink-0" /> {error}
          </div>
        )}

        {parseErrors && parseErrors.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-xs text-amber-800 space-y-0.5">
            {parseErrors.map((e, i) => <p key={i}>{e}</p>)}
          </div>
        )}

        {done && (
          <div className="bg-done-bg border border-done/20 rounded-xl px-4 py-3 text-sm text-done">
            ✅ Applied — {done.added} item{done.added !== 1 ? 's' : ''} added, {done.updated} updated.
          </div>
        )}

        {diff && totalChanges === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">No changes — your menu already matches this file.</p>
        )}

        {diff && totalChanges > 0 && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              {diff.added.length} to add · {diff.changed.length} to update · {diff.unchangedCount} unchanged
              {diff.newCategoryNames.length > 0 && <> · new categories: {diff.newCategoryNames.join(', ')}</>}
            </p>

            <div className="border border-line rounded-xl divide-y divide-line max-h-80 overflow-y-auto">
              {diff.added.map(row => (
                <div key={`add-${row.name}`} className="flex items-center gap-2 px-3 py-2 text-sm">
                  <Plus size={13} className="text-done shrink-0" />
                  <span className="font-medium text-text">{row.name}</span>
                  <span className="text-muted-foreground ml-auto">{fmtRupees(row.priceRupees)}</span>
                </div>
              ))}
              {diff.changed.map(({ row, existing, fields }) => (
                <div key={`chg-${existing.id}`} className="flex items-center gap-2 px-3 py-2 text-sm">
                  <Pencil size={13} className="text-brand-strong shrink-0" />
                  <span className="font-medium text-text">{row.name}</span>
                  <span className="text-muted-foreground ml-auto">{fields.map(f => FIELD_LABELS[f]).join(', ')}</span>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => { setDiff(null); setCsvText(null); setFileName(null); }} className="text-sm px-4 py-2.5 rounded-xl border border-line text-muted-foreground hover:bg-sunken font-medium">
                Choose a different file
              </button>
              <button
                type="button"
                onClick={handleApply}
                disabled={applying}
                className="text-sm px-4 py-2.5 rounded-xl bg-brand-strong text-white font-semibold hover:opacity-90 disabled:opacity-50"
              >
                {applying ? 'Applying…' : `Apply ${totalChanges} change${totalChanges !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
