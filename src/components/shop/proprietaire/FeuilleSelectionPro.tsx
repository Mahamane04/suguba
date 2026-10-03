'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import Sheet from '@/components/ui/Sheet';
import Button from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Surface';
import { useToast } from '@/components/ui/Toast';
import SelecteurArticles, { type ArticleACocher } from '@/components/reseau/SelecteurArticles';
import { ARTICLES_MAX } from '@/lib/boutique-ordre';

/**
 * « Choisir les articles » d'une boutique SUPPLÉMENTAIRE (formule Pro) — lot 7
 * du chantier boutique, 2026-10-03.
 *
 * Ouverte par « Ajouter des articles » de « Mes articles » (?boutique=<id>). Une
 * boutique Pro ne se remplit pas depuis le catalogue (son bouton « Boutique »
 * compose la boutique principale, qui porte les offres du revendeur) : ses
 * articles se cochent ici, dans la liste déjà utilisée par « Mes boutiques ».
 *
 *  - La liste (/api/compte/boutiques) ne propose que des articles qui rapportent
 *    quelque chose au revendeur ; elle n'est lue qu'à l'ouverture de la feuille ;
 *  - l'enregistrement passe par l'action « articles » de la même route, devenue
 *    SANS PERTE : seuls les articles décochés sont retirés, les nouveaux
 *    s'ajoutent à la suite, l'ordre et les coups de cœur des autres sont gardés ;
 *  - la boutique est vérifiée par le serveur (elle doit appartenir à la session).
 *
 * Une seule action dans le pied de la feuille : la liste peut compter 300 lignes,
 * un bouton placé dessous serait hors d'atteinte.
 */
export default function FeuilleSelectionPro({
  ouvert,
  onFermer,
  boutiqueId,
  choisis,
  onEnregistre,
}: {
  ouvert: boolean;
  onFermer: () => void;
  /** Boutique Pro visée (vérifiée par le serveur). */
  boutiqueId: string;
  /** Articles déjà dans la boutique, y compris ceux que la liste ne propose plus. */
  choisis: string[];
  /** Sélection enregistrée : l'écran relit ses articles. */
  onEnregistre: () => void;
}) {
  const { toast } = useToast();
  const [catalogue, setCatalogue] = useState<ArticleACocher[] | null>(null);
  const [erreur, setErreur] = useState(false);
  const [ids, setIds] = useState<string[]>(choisis);
  const [envoi, setEnvoi] = useState(false);
  const verrou = useRef(false);

  // Chaque ouverture relit la liste et repart de la sélection enregistrée.
  useEffect(() => {
    if (!ouvert) return;
    let annule = false;
    setCatalogue(null);
    setErreur(false);
    setIds(choisis);
    fetch('/api/compte/boutiques', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (annule) return;
        if (Array.isArray(d?.catalogue)) setCatalogue(d.catalogue);
        else setErreur(true);
      })
      .catch(() => { if (!annule) setErreur(true); });
    return () => { annule = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ouvert]);

  const trop = ids.length > ARTICLES_MAX;

  const enregistrer = async () => {
    if (verrou.current) return; // une seule requête à la fois
    verrou.current = true;
    setEnvoi(true);
    try {
      const r = await fetch('/api/compte/boutiques', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'articles', boutiqueId, produits: ids }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { toast(d.error || 'Enregistrement impossible. Réessayez.', { ton: 'erreur' }); return; }
      const refuses = Number(d.refuses) || 0;
      toast(refuses > 0
        ? `Articles enregistrés. ${refuses} article${refuses > 1 ? 's' : ''} n’${refuses > 1 ? 'ont' : 'a'} pas pu être ajouté${refuses > 1 ? 's' : ''} (plus en vente, ou sans gain).`
        : 'Articles enregistrés.', { ton: refuses > 0 ? 'info' : 'succes' });
      onEnregistre();
      onFermer();
    } catch {
      toast('Connexion impossible. Vérifiez votre réseau, puis réessayez.', { ton: 'erreur' });
    } finally {
      verrou.current = false;
      setEnvoi(false);
    }
  };

  return (
    <Sheet
      ouvert={ouvert}
      onFermer={onFermer}
      titre="Choisir les articles"
      sousTitre="Cochez les articles de cette boutique. L’ordre et les coups de cœur sont gardés."
      pied={catalogue ? (
        <Button type="button" fullWidth onClick={enregistrer} loading={envoi} disabled={trop}>
          <Check className="w-4 h-4" />Enregistrer {ids.length} article{ids.length > 1 ? 's' : ''}
        </Button>
      ) : undefined}
    >
      {erreur ? (
        <p role="alert" className="text-sm text-slate-700 bg-slate-100 rounded-2xl p-3">
          La liste des articles n’a pas pu être lue. Rien n’a changé dans cette boutique. Vérifiez votre réseau, puis rouvrez cette fenêtre.
        </p>
      ) : catalogue === null ? (
        <div className="space-y-2" role="status" aria-label="Lecture des articles">
          <Skeleton className="h-11" /><Skeleton className="h-16" /><Skeleton className="h-16" /><Skeleton className="h-16" />
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-slate-600">
            <strong className="text-slate-900 tabular-nums">{ids.length}/{ARTICLES_MAX}</strong> coché{ids.length > 1 ? 's' : ''}. Seuls les articles qui vous rapportent quelque chose sont proposés.
          </p>
          {trop && <p role="alert" className="text-xs font-semibold text-rose-700">{ARTICLES_MAX} articles au plus : décochez-en.</p>}
          {/* La feuille défile déjà : pas de liste qui défile dans la liste. */}
          <SelecteurArticles catalogue={catalogue} choisis={choisis} onChange={setIds} listeClassName="" />
        </div>
      )}
    </Sheet>
  );
}
