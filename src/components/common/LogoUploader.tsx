'use client';

import SugubaLoader from '@/components/ui/SugubaLoader';

import React, { useEffect, useRef, useState } from 'react';
import { Camera, X } from 'lucide-react';
import { compresserImage } from '@/lib/compression-image';
import { initiale as lettreInitiale } from '@/lib/initiale';

/**
 * Logo de boutique — avatar circulaire, un seul fichier (2026-09-11).
 *
 * Avant : réutilisait PhotosUploader (pensé pour une GRILLE de plusieurs
 * photos produit) serré dans une boîte de 96 px de large. Sa grille à 3
 * colonnes s'écrasait sur elle-même, avec le texte du bouton qui repassait
 * à la ligne lettre par lettre — signalé comme « pas joli » par vidéo. Un
 * logo de boutique est un seul avatar rond : ça mérite son propre composant,
 * pas une grille réduite de force.
 *
 * Lot 2 du chantier boutique (2026-10-03) :
 *  - l'aperçu suit enfin `value` : il était lu une seule fois au montage, donc
 *    une page qui chargeait le logo APRÈS le premier rendu (réglages, panneau de
 *    la vitrine) affichait « Aucun logo » alors qu'il y en avait un ;
 *  - `forme="carre"` : carré arrondi, comme sur la vitrine (le rond trompait sur
 *    le rendu final) ;
 *  - mêmes formats proposés que la couverture (image/*) : un seul comportement
 *    de choix de photo sur les deux. Le serveur garde sa liste (JPEG, PNG, WebP)
 *    et son message d'erreur ; compresserImage convertit en JPEG ce que le
 *    navigateur sait lire ;
 *  - initiale aux couleurs de la vitrine (menthe et vert profond).
 */
export default function LogoUploader({
  value,
  onChange,
  onUploadingChange,
  nomPourInitiale,
  forme = 'rond',
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  onUploadingChange?: (enCours: boolean) => void;
  /** Avatar par défaut (initiale) tant qu'aucun logo n'est choisi. */
  nomPourInitiale?: string;
  /** 'carre' : carré arrondi, comme le logo affiché sur la vitrine. */
  forme?: 'rond' | 'carre';
}) {
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [apercu, setApercu] = useState<string | null>(value);
  const input = useRef<HTMLInputElement>(null);
  const arrondi = forme === 'carre' ? 'rounded-3xl' : 'rounded-full';

  // Resynchronise l'aperçu quand le logo enregistré change (chargé après coup,
  // ou rétabli par la page après un enregistrement refusé). Pas pendant un envoi :
  // l'aperçu local de la photo choisie resterait sinon remplacé par l'ancien logo.
  useEffect(() => {
    if (!envoiEnCours) setApercu(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const choisir = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fichier = e.target.files?.[0];
    e.target.value = '';
    if (!fichier) return;

    setErreur(null);
    setApercu(URL.createObjectURL(fichier));
    setEnvoiEnCours(true);
    onUploadingChange?.(true);
    try {
      const allegee = await compresserImage(fichier);
      const donnees = new FormData();
      donnees.append('file', allegee);
      const res = await fetch('/api/reseau/upload?usage=image', { method: 'POST', body: donnees });
      const json = await res.json();
      if (res.ok && json.success) {
        setApercu(json.url);
        onChange(json.url);
      } else {
        setErreur(json.error || "Échec de l'envoi.");
        setApercu(value);
      }
    } catch {
      setErreur('Erreur réseau.');
      setApercu(value);
    } finally {
      setEnvoiEnCours(false);
      onUploadingChange?.(false);
    }
  };

  const retirer = () => {
    setApercu(null);
    setErreur(null);
    onChange(null);
  };

  const initiale = lettreInitiale(nomPourInitiale || '?');

  return (
    <div className="flex items-center gap-4">
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => input.current?.click()}
          aria-label={apercu ? 'Changer le logo' : 'Ajouter un logo'}
          className={`w-20 h-20 ${arrondi} overflow-hidden border-2 border-slate-200 bg-suguba-menthe flex items-center justify-center text-suguba-profond font-bold text-2xl hover:opacity-90 transition-opacity`}
        >
          {apercu ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={apercu} alt="Logo de la boutique" className="w-full h-full object-cover" />
          ) : (
            initiale
          )}
          {envoiEnCours && (
            <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
              <SugubaLoader className="w-5 h-5 text-slate-600" />
            </div>
          )}
        </button>
        <button
          type="button"
          onClick={() => input.current?.click()}
          aria-label="Changer le logo"
          className="absolute -bottom-0.5 -right-0.5 w-7 h-7 rounded-full bg-slate-900 hover:bg-black text-white flex items-center justify-center border-2 border-white"
        >
          <Camera className="w-3.5 h-3.5" />
        </button>
        {apercu && !envoiEnCours && (
          <button
            type="button"
            onClick={retirer}
            aria-label="Retirer le logo"
            className="absolute -top-0.5 -right-0.5 w-6 h-6 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center border-2 border-white"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-bold text-slate-700">{apercu ? 'Logo de la boutique' : 'Aucun logo'}</p>
        <p className="text-xs text-slate-500">JPEG, PNG ou WebP — allégé automatiquement.</p>
        {erreur && <p className="text-xs text-rose-600 font-bold mt-0.5">{erreur}</p>}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        onChange={choisir}
        className="hidden"
      />
    </div>
  );
}
