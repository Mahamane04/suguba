'use client';

import React, { useState, useRef, useEffect } from 'react';
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
  variante = 'champ', prefixe,
}: NeighborhoodPickerProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [localisationEnCours, setLocalisationEnCours] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

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
        setOpen(false);
      },
      () => {
        setLocalisationEnCours(false);
        toast('Localisation refusée ou indisponible — choisissez votre quartier dans la liste.', { ton: 'erreur' });
      },
      { timeout: 8000, maximumAge: 60_000 },
    );
  };

  return (
    <div ref={ref} className={`relative ${className}`}>
      {/* Même gabarit que les champs du design system (Field.tsx) : 48 px,
          rayon 2xl, texte 16 px sur téléphone, focus au vert de marque. */}
      {variante === 'puce' ? (
        <button
          id={id}
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="listbox"
          aria-expanded={open}
          className="max-w-full min-h-[44px] inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/20 hover:bg-white/15 pl-1.5 pr-3 py-1 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-white/40"
        >
          <span className="w-8 h-8 rounded-full bg-suguba-brand text-white flex items-center justify-center shrink-0">
            <MapPin className="w-4 h-4" />
          </span>
          <span className="min-w-0 leading-tight">
            {prefixe && <span className="block text-[10px] font-bold uppercase tracking-wider text-emerald-100/60">{prefixe}</span>}
            <span className={`block truncate text-sm font-bold ${value ? 'text-white' : 'text-emerald-100/80'}`}>{value || placeholder}</span>
          </span>
          <ChevronDown className={`w-4 h-4 text-emerald-100/70 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      ) : (
      <button
        id={id}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-invalid={invalide}
        className={`w-full h-12 flex items-center justify-between gap-2 bg-white border rounded-2xl px-3.5 text-base sm:text-sm text-left focus:outline-none focus:ring-2 focus:ring-suguba-brand/30 focus:border-suguba-brand ${
          invalide ? 'border-rose-400' : 'border-slate-200'
        }`}
      >
        <span className={`truncate ${value ? 'text-slate-900' : 'text-slate-400'}`}>{value || placeholder}</span>
        <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      )}

      {open && (
        <div className={`absolute z-30 mt-1.5 ${variante === 'puce' ? 'left-0 w-72 max-w-[calc(100vw-2rem)]' : 'w-full'} min-w-[240px] max-h-72 overflow-y-auto bg-white border border-gray-100 rounded-2xl shadow-float py-1.5 animate-slide-down`}>
          <button
            type="button"
            onClick={utiliserPositionActuelle}
            disabled={localisationEnCours}
            className="w-full flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold text-suguba-brand hover:bg-suguba-50 disabled:opacity-60 transition-colors border-b border-gray-100 mb-1"
          >
            {localisationEnCours ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LocateFixed className="w-3.5 h-3.5" />}
            {localisationEnCours ? 'Localisation…' : 'Utiliser ma position actuelle'}
          </button>
          {BAMAKO_NEIGHBORHOODS.map((group) => (
            <div key={group.commune}>
              <p className="px-3.5 pt-2 pb-1 text-[11px] font-black text-gray-400 uppercase tracking-wider">
                {group.commune}
              </p>
              {group.quartiers.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => { onChange(q); setOpen(false); }}
                  className={`w-full text-left px-3.5 py-2 text-xs transition-colors ${
                    q === value ? 'bg-suguba-brand/10 text-suguba-brand font-bold' : 'text-gray-700 hover:bg-gray-50 font-medium'
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>
          ))}
          <button
            type="button"
            onClick={() => { onChange('Autre quartier'); setOpen(false); }}
            className={`w-full text-left px-3.5 py-2 text-xs mt-1 border-t border-gray-50 transition-colors ${
              value === 'Autre quartier' ? 'bg-suguba-brand/10 text-suguba-brand font-bold' : 'text-gray-500 hover:bg-gray-50 font-medium'
            }`}
          >
            Autre quartier
          </button>
        </div>
      )}
    </div>
  );
}
