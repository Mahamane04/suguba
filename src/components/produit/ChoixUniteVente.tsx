'use client';

import React from 'react';
import { LIBELLES_UNITE, UNITES_VENTE, suffixeUnite, uniteAvecContenu, type UniteVente } from '@/lib/unite-vente';

/**
 * « Le prix correspond à… » (V2, 2026-09-27) — fournisseur (création) et
 * admin (produits existants). Le contenu n'est demandé que pour un lot, un
 * paquet ou un carton, et un aperçu montre ce que verra le client.
 */
export default function ChoixUniteVente({ id, unite, contenu, onChange, compact = false }: {
  id: string;
  unite: UniteVente | '';
  contenu: string;
  onChange: (unite: UniteVente | '', contenu: string) => void;
  compact?: boolean;
}) {
  const avecContenu = uniteAvecContenu(unite || null);
  const apercu = unite ? suffixeUnite(unite, Number(contenu) >= 2 ? Number(contenu) : null) : '';
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-xs font-bold text-slate-700">Le prix correspond à</label>
      <div className="flex gap-2">
        <select
          id={id}
          value={unite}
          onChange={(e) => onChange(e.target.value as UniteVente | '', uniteAvecContenu((e.target.value || null) as UniteVente | null) ? contenu : '')}
          className="flex-1 min-w-0 h-11 px-3 bg-slate-50 border border-slate-300 rounded-xl text-base sm:text-sm font-semibold text-slate-900 focus:bg-white"
        >
          {compact && <option value="">Non renseigné</option>}
          {UNITES_VENTE.map((u) => <option key={u} value={u}>{LIBELLES_UNITE[u]}</option>)}
        </select>
        {avecContenu && (
          <input
            type="number"
            inputMode="numeric"
            min={2}
            aria-label={`Nombre d’articles par ${unite === 'lot' ? 'lot' : unite}`}
            placeholder={unite === 'lot' ? 'Nombre *' : 'Nombre'}
            value={contenu}
            onChange={(e) => onChange(unite, e.target.value.replace(/\D/g, '').slice(0, 5))}
            className="w-24 h-11 px-3 bg-slate-50 border border-slate-300 rounded-xl text-base sm:text-sm font-bold text-slate-900 focus:bg-white"
          />
        )}
      </div>
      {!compact && (
        <p className="text-xs text-slate-500">
          {apercu ? <>Le client verra : <strong className="text-slate-700">Prix {apercu}</strong></> : 'Le client ne verra pas d’unité à côté du prix.'}
          {unite === 'lot' && ' — indiquez combien d’articles contient le lot.'}
        </p>
      )}
    </div>
  );
}
