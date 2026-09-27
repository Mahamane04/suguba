'use client';

import React from 'react';
import {
  CONTENU_PAR_UNITE, FAMILLES_UNITE, LIBELLES_MESURE, LIBELLES_UNITE,
  mesuresContenu, suffixeUnite, texteMinimum, type MesureContenu, type UniteVente,
} from '@/lib/unite-vente';

/** Saisie en cours : textes tels que tapés (virgule acceptée). */
export interface SaisieUnite {
  unite: UniteVente | '';
  contenu: string;
  mesure: MesureContenu | '';
  quantiteMin: string;
}

export const SAISIE_UNITE_VIDE: SaisieUnite = { unite: 'unite', contenu: '', mesure: '', quantiteMin: '' };

/**
 * « Le prix correspond à… » (V2, 2026-09-27) — fournisseur (création) et
 * admin (produits existants). Unités groupées par famille (pièce, tissus,
 * surface/poids/volume, conditionnements) ; contenu avec sa mesure quand
 * l'unité en a un (« sac de 50 kg », « carton de 1,44 m² ») ; quantité
 * minimale ; aperçu de ce que verra le client.
 */
export default function ChoixUniteVente({ id, valeur, onChange, compact = false }: {
  id: string;
  valeur: SaisieUnite;
  onChange: (v: SaisieUnite) => void;
  compact?: boolean;
}) {
  const unite = valeur.unite || null;
  const mesures = mesuresContenu(unite);
  const mesure = (valeur.mesure || mesures[0] || '') as MesureContenu | '';
  const contenuNombre = Number(valeur.contenu.replace(',', '.'));
  const apercu = unite ? suffixeUnite(unite, contenuNombre > 0 ? contenuNombre : null, mesure || null) : '';
  const minimum = texteMinimum(unite, Number(valeur.quantiteMin) || null);

  const changerUnite = (u: UniteVente | '') => {
    const regle = u ? CONTENU_PAR_UNITE[u] : null;
    onChange({
      ...valeur,
      unite: u,
      mesure: regle?.mesures[0] ?? '',
      contenu: regle?.mesures.length ? (valeur.unite === u ? valeur.contenu : regle.defaut ? String(regle.defaut) : '') : '',
    });
  };

  const champ = 'h-11 px-3 bg-slate-50 border border-slate-300 rounded-xl text-base sm:text-sm font-semibold text-slate-900 focus:bg-white';

  return (
    <div className="space-y-2">
      <div className="space-y-1.5">
        <label htmlFor={id} className="block text-xs font-bold text-slate-700">Le prix correspond à</label>
        <select id={id} value={valeur.unite} onChange={(e) => changerUnite(e.target.value as UniteVente | '')} className={`w-full ${champ}`}>
          {compact && <option value="">Non renseigné</option>}
          {FAMILLES_UNITE.map((f) => (
            <optgroup key={f.titre} label={f.titre}>
              {f.unites.map((u) => <option key={u} value={u}>{LIBELLES_UNITE[u]}</option>)}
            </optgroup>
          ))}
        </select>
      </div>

      {mesures.length > 0 && (
        <div className="space-y-1.5">
          <label htmlFor={`${id}-contenu`} className="block text-xs font-bold text-slate-700">
            Contenu {unite === 'lot' ? '*' : '(facultatif)'}
          </label>
          <div className="flex gap-2">
            <input
              id={`${id}-contenu`}
              inputMode="decimal"
              placeholder={unite === 'sac' ? 'Ex : 50' : unite === 'carton' ? 'Ex : 1,44' : 'Ex : 4'}
              value={valeur.contenu}
              onChange={(e) => onChange({ ...valeur, contenu: e.target.value.replace(/[^\d.,]/g, '').slice(0, 10) })}
              className={`flex-1 min-w-0 ${champ}`}
            />
            {mesures.length > 1 ? (
              <select aria-label="Mesure du contenu" value={mesure} onChange={(e) => onChange({ ...valeur, mesure: e.target.value as MesureContenu })} className={`w-28 ${champ}`}>
                {mesures.map((m) => <option key={m} value={m}>{LIBELLES_MESURE[m]}</option>)}
              </select>
            ) : (
              <span className="h-11 px-3 inline-flex items-center text-sm font-semibold text-slate-600">{LIBELLES_MESURE[mesures[0]]}</span>
            )}
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <label htmlFor={`${id}-min`} className="block text-xs font-bold text-slate-700">Quantité minimale par commande (facultatif)</label>
        <input
          id={`${id}-min`}
          inputMode="numeric"
          placeholder="Ex : 2"
          value={valeur.quantiteMin}
          onChange={(e) => onChange({ ...valeur, quantiteMin: e.target.value.replace(/\D/g, '').slice(0, 4) })}
          className={`w-full ${champ}`}
        />
      </div>

      <p className="text-xs text-slate-500">
        {apercu ? <>Le client verra : <strong className="text-slate-700">Prix {apercu}</strong></> : 'Le client ne verra pas d’unité à côté du prix.'}
        {minimum && <> · <strong className="text-slate-700">{minimum}</strong></>}
      </p>
    </div>
  );
}
