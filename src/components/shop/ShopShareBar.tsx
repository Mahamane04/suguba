'use client';

import React, { useState } from 'react';
import { Copy, Check, Share2, MessageCircle } from 'lucide-react';

/**
 * Partage d'une boutique : WhatsApp, Facebook, lien à copier (pour TikTok,
 * Instagram et tout ce qui n'a pas d'adresse de partage), et le partage natif
 * du téléphone quand il existe — c'est le plus naturel sur mobile.
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
      // Presse-papiers refusé (navigateur ancien, page non sécurisée) : le lien
      // reste visible dans la barre d'adresse, rien de plus à faire.
    }
  };

  const partagerNatif = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: texte, text: texte, url });
        return;
      } catch {
        // Partage annulé par l'utilisateur : ce n'est pas une erreur.
        return;
      }
    }
    copier();
  };

  const whatsapp = `https://wa.me/?text=${encodeURIComponent(`${texte}\n${url}`)}`;
  const facebook = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      <a href={whatsapp} target="_blank" rel="noopener noreferrer"
        className="h-11 rounded-2xl bg-[#25D366] hover:bg-[#20bd5a] text-white text-xs font-black flex items-center justify-center space-x-1.5 transition-transform active:scale-[0.98]">
        <MessageCircle className="w-4 h-4 fill-current" /><span>WhatsApp</span>
      </a>
      <a href={facebook} target="_blank" rel="noopener noreferrer"
        className="h-11 rounded-2xl bg-[#1877F2] hover:bg-[#166fe0] text-white text-xs font-black flex items-center justify-center transition-transform active:scale-[0.98]">
        Facebook
      </a>
      <button type="button" onClick={copier}
        className="h-11 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-black flex items-center justify-center space-x-1.5 transition-transform active:scale-[0.98]">
        {copie ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
        <span>{copie ? 'Lien copié' : 'Copier le lien'}</span>
      </button>
      <button type="button" onClick={partagerNatif}
        className="h-11 rounded-2xl bg-white text-slate-900 text-xs font-black flex items-center justify-center space-x-1.5 transition-transform active:scale-[0.98]">
        <Share2 className="w-4 h-4" /><span>Partager</span>
      </button>
    </div>
  );
}
