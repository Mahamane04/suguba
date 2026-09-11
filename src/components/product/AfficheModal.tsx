'use client';

import React, { useEffect, useState } from 'react';
import { X, Download, Loader2 } from 'lucide-react';
import WhatsAppIcon from '@/components/ui/WhatsAppIcon';
import { genererAffiche, partagerAffiche, telechargerAffiche, type FormatAffiche, type ThemeAffiche } from '@/lib/affiche';
import { lienProduit, texteProduit, useCodeRevendeur, type ProduitAPartager } from '@/lib/partage';

/**
 * Affiche pour statut WhatsApp : aperçu, puis partage en un clic (2026-09-11).
 *
 * Deux temps volontaires, comme les grandes applications : l'affiche est
 * dessinée dès l'ouverture, et le bouton « Partager » l'envoie
 * instantanément. Générer au moment du clic ferait échouer le partage sur
 * iPhone, qui refuse un partage déclenché trop longtemps après le geste.
 */
export default function AfficheModal({ produit, onClose }: { produit: ProduitAPartager; onClose: () => void }) {
  const code = useCodeRevendeur();
  const [theme, setTheme] = useState<ThemeAffiche>('vert');
  const [format, setFormat] = useState<FormatAffiche>('story');
  const [fichier, setFichier] = useState<File | null>(null);
  const [apercu, setApercu] = useState<string | null>(null);
  const [erreur, setErreur] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let annule = false;
    let url: string | null = null;
    setFichier(null);
    setErreur('');
    genererAffiche(produit, code, { theme, format })
      .then((f) => {
        if (annule) return;
        url = URL.createObjectURL(f);
        setFichier(f);
        setApercu(url);
      })
      .catch((e) => { if (!annule) setErreur(e?.message || "L'affiche n'a pas pu être créée."); });
    return () => {
      annule = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [produit, code, theme, format]);

  const partager = async () => {
    if (!fichier) return;
    setMessage('');
    const texte = texteProduit(produit, lienProduit(produit.slug, code));
    const resultat = await partagerAffiche(fichier, texte);
    if (resultat === 'telecharge') {
      setMessage("Affiche enregistrée sur l'appareil. Publiez-la depuis WhatsApp → Statut.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 sm:p-4" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 space-y-4 max-h-[94vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Affiche pour mon statut WhatsApp"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-black text-base text-slate-900">Affiche pour mon statut</h2>
            <p className="text-xs text-slate-500 line-clamp-1">{produit.nom}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fermer"
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex gap-2">
          {([['story', 'Statut'], ['carre', 'Carré']] as const).map(([cle, libelle]) => (
            <button key={cle} type="button" onClick={() => setFormat(cle)}
              className={`flex-1 h-9 rounded-2xl text-xs font-bold border ${format === cle ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-200 text-slate-700'}`}>
              {libelle}
            </button>
          ))}
          {([['vert', 'bg-[#09b500]'], ['clair', 'bg-white'], ['nuit', 'bg-slate-900']] as const).map(([cle, fond]) => (
            <button key={cle} type="button" onClick={() => setTheme(cle)} aria-label={`Thème ${cle}`}
              className={`w-9 h-9 rounded-full border-2 shrink-0 ${fond} ${theme === cle ? 'border-suguba-brand ring-2 ring-suguba-brand/30' : 'border-slate-200'}`} />
          ))}
        </div>

        <div className={`mx-auto rounded-2xl overflow-hidden bg-slate-100 flex items-center justify-center ${format === 'story' ? 'w-56 aspect-[9/16]' : 'w-72 aspect-square'}`}>
          {erreur ? (
            <p className="p-4 text-xs text-rose-700 text-center">{erreur}</p>
          ) : fichier && apercu ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={apercu} alt="Aperçu de l'affiche" className="w-full h-full object-contain" />
          ) : (
            <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
          )}
        </div>

        {!code && (
          <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-2xl p-2.5">
            Aucun code revendeur : les ventes de cette affiche ne vous seront pas attribuées. Connectez-vous avec votre compte revendeur.
          </p>
        )}

        <div className="grid grid-cols-[1fr_auto] gap-2">
          <button type="button" onClick={partager} disabled={!fichier}
            className="h-11 rounded-2xl bg-[#25D366] hover:bg-[#1ebe5b] text-white text-sm font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition-all">
            <WhatsAppIcon className="w-5 h-5" />
            <span>Partager</span>
          </button>
          <button type="button" onClick={() => fichier && telechargerAffiche(fichier)} disabled={!fichier}
            aria-label="Enregistrer l'affiche sur l'appareil"
            className="h-11 w-11 rounded-2xl border border-slate-200 hover:bg-slate-50 text-slate-700 inline-flex items-center justify-center disabled:opacity-50">
            <Download className="w-5 h-5" />
          </button>
        </div>
        <p className="text-[11px] text-slate-500 text-center">
          {message || 'Dans WhatsApp, choisissez « Mon statut » pour la publier en statut. Le lien de commande part avec.'}
        </p>
      </div>
    </div>
  );
}
