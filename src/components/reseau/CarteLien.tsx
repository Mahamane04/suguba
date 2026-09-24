'use client';

import React, { useState } from 'react';
import { Copy, Check, Share2, QrCode as QrIcon } from 'lucide-react';
import QrCode from '@/components/common/QrCode';
import Button from '@/components/ui/Button';
import { Card } from '@/components/ui/Surface';

/**
 * Un lien de partage prêt à l'emploi : copier, partager, montrer en QR code.
 *
 * Le QR n'est PAS un second système : c'est le même lien tracké, rendu en
 * image (§ L du cahier des charges). Un revendeur au marché le fait scanner,
 * un autre l'envoie sur WhatsApp — Suguba compte les deux de la même façon.
 */
export default function CarteLien({
  titre,
  url,
  aide,
  texteWhatsApp,
}: {
  titre: string;
  url: string;
  aide?: string;
  texteWhatsApp?: string;
}) {
  const [copie, setCopie] = useState(false);
  const [qrVisible, setQrVisible] = useState(false);

  const copier = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopie(true);
      setTimeout(() => setCopie(false), 2000);
    } catch {
      // Navigateur sans presse-papiers (WebView ancienne) : le champ ci-dessous
      // reste sélectionnable à la main, l'utilisateur n'est pas bloqué.
    }
  };

  return (
    <Card className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-900">{titre}</p>
          {aide && <p className="text-xs text-slate-500 mt-0.5">{aide}</p>}
        </div>
        <button
          type="button"
          onClick={() => setQrVisible((v) => !v)}
          aria-expanded={qrVisible}
          className="shrink-0 w-10 h-10 rounded-2xl border border-slate-200 bg-white text-slate-700 flex items-center justify-center active:scale-95"
        >
          <QrIcon className="w-4 h-4" />
          <span className="sr-only">Afficher le QR code</span>
        </button>
      </div>

      <div className="flex items-center gap-2">
        <input
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="flex-1 min-w-0 h-11 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-xs text-slate-700 font-mono"
        />
        <Button variant="ghost" size="sm" onClick={copier} aria-label="Copier le lien">
          {copie ? <Check className="w-4 h-4 text-suguba-brand-dark" /> : <Copy className="w-4 h-4" />}
        </Button>
      </div>

      {qrVisible && (
        <div className="flex justify-center pt-1">
          <div className="p-3 bg-white rounded-3xl border border-slate-200">
            <QrCode value={url} size={168} />
          </div>
        </div>
      )}

      <Button
        href={`https://api.whatsapp.com/send?text=${encodeURIComponent(texteWhatsApp || url)}`}
        target="_blank"
        rel="noopener noreferrer"
        fullWidth
      >
        <Share2 className="w-4 h-4" />
        Partager sur WhatsApp
      </Button>
    </Card>
  );
}
