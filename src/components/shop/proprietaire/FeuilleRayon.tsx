'use client';

import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import Sheet from '@/components/ui/Sheet';
import Button from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import SelecteurArticles, { type ArticleACocher } from '@/components/reseau/SelecteurArticles';
import { RAYON_NOM_MAX, RAYON_NOM_MIN } from '@/lib/boutique-reglages';

/**
 * « Nouveau rayon » / « Modifier le rayon » (lot 6 du chantier boutique,
 * 2026-10-03) : la feuille de « Mes rayons ».
 *
 * Un nom court (2 à 24 caractères) et les articles à y ranger, cochés dans la
 * liste des articles de SA boutique. Rien n'est écrit ici : la feuille pose le
 * rayon dans la liste à l'écran, et « Enregistrer » (la barre de « Mes rayons »)
 * envoie le tout en une seule requête (même modèle que « Mes articles »).
 *
 * Ranger un article dans un rayon ne touche jamais à la sélection de la
 * boutique : supprimer un rayon ne retire aucun article, ni aucune offre.
 *
 * L'écran qui l'ouvre la remonte à chaque ouverture (`key`) : le nom et les
 * coches repartent de ce qui est affiché.
 */
export default function FeuilleRayon({
  ouvert,
  onFermer,
  creation,
  nomInitial,
  idsInitial,
  articles,
  refus,
  onValider,
  onSupprimer,
}: {
  ouvert: boolean;
  onFermer: () => void;
  /** Nouveau rayon (vrai) ou rayon existant. */
  creation: boolean;
  nomInitial: string;
  idsInitial: string[];
  /** Articles de la boutique ; `note` dit où chacun est déjà rangé. */
  articles: ArticleACocher[];
  /** Pourquoi ce nom ne convient pas (règle pure de l'écran), ou null. */
  refus: (nom: string) => string | null;
  onValider: (rayon: { nom: string; ids: string[] }) => void;
  /** Rayon existant seulement : suppression (confirmée par l'écran). */
  onSupprimer?: () => void;
}) {
  const [nom, setNom] = useState(nomInitial);
  const [ids, setIds] = useState<string[]>(idsInitial);
  const erreur = refus(nom);
  // Pas de reproche avant d'avoir écrit : le bouton reste simplement inactif.
  const erreurAffichee = nom.trim() ? erreur : null;
  const sansArticle = creation && ids.length === 0;

  return (
    <Sheet
      ouvert={ouvert}
      onFermer={onFermer}
      titre={creation ? 'Nouveau rayon' : 'Modifier le rayon'}
      sousTitre="Un nom court, et les articles à y ranger."
      pied={(
        <Button type="button" fullWidth disabled={Boolean(erreur) || sansArticle} onClick={() => onValider({ nom, ids })}>
          {creation ? 'Ajouter ce rayon' : 'Valider'}
        </Button>
      )}
    >
      <div className="space-y-4">
        <Field
          label="Nom du rayon"
          htmlFor="nom-rayon"
          requis
          erreur={erreurAffichee || undefined}
          aide={`De ${RAYON_NOM_MIN} à ${RAYON_NOM_MAX} caractères. Ex. : Pagnes, Pour la fête.${creation ? '' : ' Renommer un rayon change son lien de partage.'}`}
        >
          <Input id="nom-rayon" value={nom} onChange={(e) => setNom(e.target.value)} maxLength={RAYON_NOM_MAX} placeholder="Ex. : Pagnes" autoComplete="off" />
        </Field>

        <div className="space-y-1">
          <p className="text-xs font-bold text-slate-700">Articles de ce rayon</p>
          <p className="text-xs text-slate-600">
            <strong className="text-slate-900 tabular-nums">{ids.length}</strong> coché{ids.length > 1 ? 's' : ''}.
            {sansArticle ? ' Cochez au moins un article.' : ''} Un article n’est rangé que dans un seul rayon.
          </p>
          {/* La feuille défile déjà : pas de liste qui défile dans la liste. */}
          <SelecteurArticles catalogue={articles} choisis={idsInitial} onChange={setIds} listeClassName="" />
        </div>

        {!creation && onSupprimer && (
          <div className="space-y-1.5">
            <Button type="button" variant="danger" fullWidth onClick={onSupprimer}>
              <Trash2 className="w-4 h-4" />Supprimer ce rayon
            </Button>
            <p className="text-xs text-slate-600 text-center">Ses articles restent dans votre boutique.</p>
          </div>
        )}
      </div>
    </Sheet>
  );
}
