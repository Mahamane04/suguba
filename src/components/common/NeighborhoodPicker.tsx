'use client';

import ChoicePicker from '@/components/ui/ChoicePicker';
import React, { useState } from 'react';
import { ChevronDown, LocateFixed, Loader2, MapPin } from 'lucide-react';
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
  return <div className={`${variante === 'puce' ? 'flex items-center gap-2 min-w-0' : 'space-y-1'} ${className}`}>
    <ChoicePicker id={id} valeur={value} choix={choix} invalide={invalide} placeholder={placeholder}
      ariaLabel={id ? undefined : prefixe || 'Quartier'} prefixe={variante === 'puce' ? prefixe : undefined}
      className={variante === 'puce' ? 'flex-1 min-w-0' : ''}
      triggerClassName={variante === 'puce' ? 'bg-suguba-profond text-white border-white/40' : ''}
      onChange={q=>{onChange(q);onPosition?.(null);}} />
    <button type="button" onClick={utiliserPositionActuelle} disabled={localisationEnCours}
      aria-label="Utiliser ma position actuelle" className={`min-h-11 min-w-11 flex items-center justify-center gap-2 rounded-xl px-2 text-xs font-semibold focus-visible:outline-2 ${variante === 'puce' ? 'bg-suguba-profond text-white' : 'text-suguba-profond hover:bg-slate-100'}`}>
      {localisationEnCours ? <Loader2 aria-hidden="true" className="w-4 h-4 animate-spin" /> : <LocateFixed aria-hidden="true" className="w-4 h-4" />}
      {variante !== 'puce' && (localisationEnCours ? 'Localisation…' : 'Utiliser ma position actuelle')}
    </button>
  </div>;
}
