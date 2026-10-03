'use client';

import SugubaLoader from '@/components/ui/SugubaLoader';

import ChoicePicker from '@/components/ui/ChoicePicker';
import React, { useState } from 'react';
import { ChevronDown, LocateFixed, MapPin } from 'lucide-react';
import { BAMAKO_NEIGHBORHOODS } from '@/lib/bamako-neighborhoods';
import { quartierLePlusProche } from '@/lib/bamako-quartiers';
import { useToast } from '@/components/ui/Toast';

interface NeighborhoodPickerProps {
  value: string;
  onChange: (neighborhood: string) => void;
  className?: string;
  /** Texte grisé tant qu'aucun quartier n'est choisi. */
  placeholder?: string;
  /** Relie le déclencheur à un <label htmlFor> et permet d'y ramener le focus. */
  id?: string;
  invalide?: boolean;
  /**
   * `champ` (défaut) : champ de formulaire pleine largeur.
   * `puce` : pastille compacte « 📍 Quartier ▾ » pour un bandeau sombre
   * (accueil), à la manière des applis de livraison.
   */
  variante?: 'champ' | 'puce';
  /** Petit libellé au-dessus du quartier dans la pastille (ex. « Mon quartier »). */
  prefixe?: string;
  /**
   * Position GPS exacte (2026-09-24) : appelée avec les coordonnées quand la
   * personne utilise « Ma position actuelle », avec `null` quand elle choisit
   * un quartier dans la liste. Sert au tarif de livraison à la distance réelle
   * et à guider le livreur jusqu'à la porte.
   */
  onPosition?: (position: { lat: number; lng: number } | null) => void;
}

/** Au-delà, la position n'a plus rien à voir avec Bamako (test à l'étranger, GPS erratique). */
const DISTANCE_MAX_KM = 40;

/**
 * Même logique que DialCodePicker : un <select> natif avec optgroup rend
 * différemment (et souvent mal) selon l'OS/navigateur. Ce menu scrollable
 * garde le regroupement par commune mais dans un style contrôlé par l'app.
 *
 * « Utiliser ma position actuelle » (2026-09-12, inspiré des apps de
 * livraison à Bamako) : géolocalise puis sélectionne le quartier connu le
 * plus proche — sans jamais bloquer la saisie manuelle si refusée/indisponible.
 */
export default function NeighborhoodPicker({
  value, onChange, className = '', placeholder = 'Choisir…', id, invalide = false,
  variante = 'champ', prefixe, onPosition,
}: NeighborhoodPickerProps) {
  const { toast } = useToast();
  const [localisationEnCours, setLocalisationEnCours] = useState(false);

  const utiliserPositionActuelle = () => {
    if (!navigator.geolocation) {
      toast('Localisation non prise en charge sur cet appareil.', { ton: 'erreur' });
      return;
    }
    setLocalisationEnCours(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocalisationEnCours(false);
        const trouve = quartierLePlusProche({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        if (!trouve || trouve.distanceKm > DISTANCE_MAX_KM) {
          toast('Votre position ne correspond à aucun quartier de Bamako — choisissez-le dans la liste.', { ton: 'erreur' });
          return;
        }
        onChange(trouve.nom);
        onPosition?.({ lat: position.coords.latitude, lng: position.coords.longitude });

      },
      () => {
        setLocalisationEnCours(false);
        toast('Localisation refusée ou indisponible — choisissez votre quartier dans la liste.', { ton: 'erreur' });
      },
      { timeout: 10_000, maximumAge: 60_000, enableHighAccuracy: Boolean(onPosition) },
    );
  };

  const choix = [...BAMAKO_NEIGHBORHOODS.flatMap(g => g.quartiers.map(q => ({ valeur:q, libelle:q, groupe:g.commune }))), { valeur:'Autre quartier', libelle:'Autre quartier', groupe:'Autres' }];

  /* Pastille sur fond sombre (2026-10-03). Avant : un cadre carré à deux
     lignes (« Mon quartier » en gras, « Choisir » plus gros que lui) et une
     cible GPS isolée à côté, sans fond — deux formes différentes de la
     pilule « Boutiques » voisine. Désormais une seule pilule de même
     hauteur : repère citron, quartier en gras (en citron tant qu'il reste à
     choisir), et la localisation rangée dans la même pilule. */
  if (variante === 'puce') {
    return <div className={`inline-flex items-center max-w-full h-12 rounded-full bg-white/10 ring-1 ring-inset ring-white/25 pl-1.5 pr-1 ${className}`}>
      <ChoicePicker nu id={id} valeur={value} choix={choix} invalide={invalide} placeholder={placeholder}
        ariaLabel={id ? undefined : prefixe || 'Quartier'} className="min-w-0" listeClassName="min-w-[16rem]"
        triggerClassName="h-11 pr-2 rounded-full text-white"
        rendu={(selection, ouvert) => <>
          <span aria-hidden="true" className="w-9 h-9 shrink-0 rounded-full bg-suguba-citron text-suguba-profond flex items-center justify-center">
            <MapPin className="w-4 h-4" />
          </span>
          <span className="min-w-0">
            {prefixe && <span className="block text-[11px] leading-4 font-medium text-white/70">{prefixe}</span>}
            <span title={selection?.libelle} className={`block truncate text-sm leading-5 font-bold ${selection ? 'text-white' : 'text-suguba-citron'}`}>{selection?.libelle || placeholder}</span>
          </span>
          <ChevronDown aria-hidden="true" className={`w-4 h-4 shrink-0 text-white/70 transition-transform ${ouvert ? 'rotate-180' : ''}`} />
        </>}
        onChange={q=>{onChange(q);onPosition?.(null);}} />
      <span aria-hidden="true" className="w-px h-6 shrink-0 bg-white/20" />
      <button type="button" onClick={utiliserPositionActuelle} disabled={localisationEnCours}
        aria-label="Utiliser ma position actuelle" title="Utiliser ma position actuelle"
        className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-white hover:bg-white/10 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-suguba-citron">
        {localisationEnCours ? <SugubaLoader aria-hidden="true" className="w-4 h-4" /> : <LocateFixed aria-hidden="true" className="w-[18px] h-[18px]" />}
      </button>
    </div>;
  }

  return <div className={`space-y-1 ${className}`}>
    <ChoicePicker id={id} valeur={value} choix={choix} invalide={invalide} placeholder={placeholder}
      ariaLabel={id ? undefined : prefixe || 'Quartier'}
      onChange={q=>{onChange(q);onPosition?.(null);}} />
    <button type="button" onClick={utiliserPositionActuelle} disabled={localisationEnCours}
      aria-label="Utiliser ma position actuelle" className="min-h-11 min-w-11 flex items-center justify-center gap-2 rounded-xl px-2 text-xs font-semibold focus-visible:outline-2 text-suguba-profond hover:bg-slate-100">
      {localisationEnCours ? <SugubaLoader aria-hidden="true" className="w-4 h-4" /> : <LocateFixed aria-hidden="true" className="w-4 h-4" />}
      {localisationEnCours ? 'Localisation…' : 'Utiliser ma position actuelle'}
    </button>
  </div>;
}
