'use client';

import React, { useState } from 'react';
import { Copy, Check, Share2 } from 'lucide-react';
import WhatsAppIcon from '@/components/ui/WhatsAppIcon';

/**
 * Partage d'une boutique : WhatsApp en premier (le canal qui vend au Mali),
 * puis Facebook, le lien à copier (TikTok, Instagram…) et le partage natif du
 * téléphone, en icônes compactes. Refait le 2026-09-24 pour l'en-tête clair de
 * la vitrine : quatre gros boutons de couleurs différentes écrasaient le nom
 * de la boutique.
 *
 * L'aperçu (image, prix, nom) qui apparaît une fois le lien collé est produit
 * par la page elle-même (generateMetadata), pas par ce composant.
 */
export default function ShopShareBar({ url, texte }: { url: string; texte: string }) {
  const [copie, setCopie] = useState(false);

  const copier = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopie(true);
      setTimeout(() => setCopie(false), 2000);
    } catch {
      // Presse-papiers refusé : le lien reste visible dans la barre d'adresse.
    }
  };

  const partagerNatif = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: texte, text: texte, url });
      } catch {
        // Partage annulé : ce n'est pas une erreur.
      }
      return;
    }
    copier();
  };

  const whatsapp = `https://wa.me/?text=${encodeURIComponent(`${texte}\n${url}`)}`;
  const facebook = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
  const icone = 'h-11 w-11 shrink-0 rounded-2xl border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 flex items-center justify-center transition-transform active:scale-[0.97]';

  return (
    <div className="flex items-center gap-2">
      <a href={whatsapp} target="_blank" rel="noopener noreferrer"
        className="h-11 px-4 flex-1 sm:flex-none rounded-2xl bg-suguba-wa hover:bg-[#20bd5a] text-suguba-profond text-xs font-bold inline-flex items-center justify-center gap-2 transition-transform active:scale-[0.98]">
        <WhatsAppIcon className="w-4 h-4" /><span><span className="hidden sm:inline">Partager sur </span>WhatsApp</span>
      </a>
      <a href={facebook} target="_blank" rel="noopener noreferrer" aria-label="Partager sur Facebook" title="Facebook" className={icone}>
        <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true" fill="#1877F2">
          <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.95.93-1.95 1.88v2.26h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07Z" />
        </svg>
      </a>
      <button type="button" onClick={copier} aria-label={copie ? 'Lien copié' : 'Copier le lien'} title={copie ? 'Lien copié' : 'Copier le lien'} className={icone}>
        {copie ? <Check className="w-4 h-4 text-suguba-brand-dark" /> : <Copy className="w-4 h-4" />}
      </button>
      <button type="button" onClick={partagerNatif} aria-label="Partager" title="Partager" className={icone}>
        <Share2 className="w-4 h-4" />
      </button>
    </div>
  );
}
