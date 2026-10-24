'use client';

import { useEffect, useState } from 'react';
import { Download, Copy, Check } from 'lucide-react';
import QRCode from 'qrcode';

export interface ShareLinkDef {
  label: string;
  text:  string;
  url:   string;
}

function QrCard({ link }: { link: ShareLinkDef }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [copied, setCopied]   = useState(false);

  useEffect(() => {
    QRCode.toDataURL(link.url, { width: 320, margin: 2 }).then(setDataUrl).catch(() => setDataUrl(null));
  }, [link.url]);

  function handleDownload() {
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${link.label.toLowerCase().replace(/\s+/g, '-')}-qr.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(link.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="bg-surface border border-line rounded-2xl p-5 space-y-3">
      <p className="text-sm font-semibold text-text">{link.label}</p>
      <div className="flex items-center justify-center bg-sunken rounded-xl p-4">
        {dataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={dataUrl} alt={`${link.label} QR code`} className="w-40 h-40" />
        ) : (
          <div className="w-40 h-40 animate-pulse bg-line rounded" />
        )}
      </div>
      <p className="text-xs text-muted-foreground break-all font-mono">{link.url}</p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleDownload}
          disabled={!dataUrl}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-brand-strong text-white hover:opacity-90 disabled:opacity-50"
        >
          <Download size={13} /> Download QR
        </button>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-sunken text-text hover:bg-line"
        >
          {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Copied' : 'Copy link'}
        </button>
      </div>
    </div>
  );
}

export function ShareLinksManager({ links }: { links: ShareLinkDef[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {links.map(link => <QrCard key={link.label} link={link} />)}
    </div>
  );
}
