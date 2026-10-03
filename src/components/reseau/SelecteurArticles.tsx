'use client';

import React, { useState } from 'react';
import { Check } from 'lucide-react';
import Button from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import ProductImage from '@/components/common/ProductImage';
import { formatF } from '@/lib/montant';
import { normaliserRecherche } from '@/lib/recherche-texte';

/**
 * Liste d'articles à cocher, avec sa recherche (lot 6 du chantier boutique,
 * 2026-10-03).
 *
 * Extraite de « Mes boutiques » (/compte/boutiques), où elle choisit les articles
 * d'une boutique supplémentaire, pour servir aussi à « Mes rayons » : cocher les
 * articles d'un rayon. Deux usages, un seul composant :
 *  - `onEnregistrer` : la liste garde son bouton « Enregistrer N article(s) »
 *    (Mes boutiques, inchangé) ;
 *  - `onChange` : chaque coche est remontée tout de suite, sans bouton — l'écran
 *    qui l'accueille a déjà son action principale (Mes rayons).
 *
 * `note` dit où se trouve déjà un article (« Dans « Pagnes » ») : le cocher ici le
 * déplace, un article n'est rangé que dans un seul rayon maison. La recherche
 * ignore les accents, comme celle de la vitrine.
 *
 * Relecture du lot 6 (2026-10-03) : la précision était écrite après le prix, sur
 * une seule ligne coupée par « … ». À 390 px, « 12 500 F · Coup de cœur, affiché en
 * tête » et « Dans « <rayon de 24 caractères> » » ne tenaient pas : le revendeur
 * ne lisait pas où était rangé l'article qu'il allait déplacer. Elle a maintenant
 * sa propre ligne, sous le prix, et passe à la ligne plutôt que d'être coupée.
 */

export interface ArticleACocher {
  id: string;
  nom: string;
  image: string | null;
  /** Prix affiché ; absent ou null : « — », jamais un 0 inventé. */
  prix?: number | null;
  /** Précision sous le nom : rayon actuel, « Épuisé », « Coup de cœur »… */
  note?: string | null;
}

export default function SelecteurArticles({
  catalogue,
  choisis,
  onEnregistrer,
  onChange,
  listeClassName = 'max-h-80 overflow-y-auto',
}: {
  catalogue: ArticleACocher[];
  choisis: string[];
  /** Avec bouton : appelé au toucher de « Enregistrer N article(s) ». */
  onEnregistrer?: (ids: string[]) => Promise<void>;
  /** Sans bouton : appelé à chaque coche. */
  onChange?: (ids: string[]) => void;
  /** Hauteur de la liste. Dans une feuille qui défile déjà, passer '' : pas de défilement imbriqué. */
  listeClassName?: string;
}) {
  const [ids, setIds] = useState<string[]>(choisis);
  const [filtre, setFiltre] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const requete = normaliserRecherche(filtre);
  const visibles = catalogue.filter((a) => !requete || normaliserRecherche(a.nom).includes(requete));
  const basculer = (id: string) => {
    const suivant = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
    setIds(suivant);
    onChange?.(suivant);
  };
  return (
    <div className="space-y-2 border-t border-slate-100 pt-3">
      <Input value={filtre} onChange={(e) => setFiltre(e.target.value)} placeholder="Rechercher un article" aria-label="Rechercher un article" />
      <ul className={`${listeClassName} divide-y divide-slate-100 rounded-2xl border border-slate-200`}>
        {visibles.length === 0 && <li className="p-3 text-xs text-slate-500">Aucun article.</li>}
        {visibles.map((a) => {
          const coche = ids.includes(a.id);
          return (
            <li key={a.id}>
              {/* Toute la ligne coche l'article : une cible de 60 px pour le pouce. */}
              <label className="flex items-center gap-3 p-2.5 min-h-[60px] cursor-pointer">
                <input type="checkbox" className="w-5 h-5 shrink-0 accent-suguba-profond" checked={coche} onChange={() => basculer(a.id)} />
                <span className="relative w-10 h-10 rounded-xl overflow-hidden bg-slate-100 shrink-0"><ProductImage src={a.image || ''} alt="" fill className="object-cover" /></span>
                <span className="min-w-0 flex-1 text-xs">
                  <span className="block font-semibold text-slate-900 truncate">{a.nom}</span>
                  <span className="block text-slate-500 tabular-nums">{formatF(a.prix)}</span>
                  {a.note ? <span className="block text-slate-500 break-words">{a.note}</span> : null}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      {onEnregistrer && (
        <Button onClick={async () => { setEnvoi(true); await onEnregistrer(ids); setEnvoi(false); }} loading={envoi} fullWidth>
          <Check className="w-4 h-4" />Enregistrer {ids.length} article(s)
        </Button>
      )}
    </div>
  );
}
