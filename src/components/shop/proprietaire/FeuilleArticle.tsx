'use client';

import React, { useState } from 'react';
import { ArrowUpToLine, Eye, Heart, Tag, Trash2 } from 'lucide-react';
import Sheet from '@/components/ui/Sheet';
import Button from '@/components/ui/Button';
import BoutonPartageWhatsApp from '@/components/ui/BoutonPartageWhatsApp';
import ProductImage from '@/components/common/ProductImage';
import { StatusPill } from '@/components/ui/Surface';
import { useToast } from '@/components/ui/Toast';
import { formatF } from '@/lib/montant';
import { partagerProduit, prechargerImage, prechargerLienPartage, useCodeRevendeur } from '@/lib/partage';
import { COUPS_DE_COEUR_MAX, PASTILLE_ETAT, type ArticleBoutique } from '@/lib/boutique-ordre';
import { PORTE_MA_BOUTIQUE } from '@/lib/reseau/porte-boutique';

/**
 * « Cet article » (lot 3 du chantier boutique, 2026-10-03) : la feuille ouverte
 * en touchant une ligne de « Mes articles ».
 *
 * Action principale : Coup de cœur. « Mettre en premier » et « Coup de cœur »
 * changent le rangement à l'écran ; rien n'est écrit avant « Enregistrer
 * l'ordre » (une seule requête, des UPDATE de position seulement).
 *
 * « Retirer de ma boutique » est le seul geste qui supprime la ligne : il est
 * confirmé, et sa conséquence est annoncée. La table des articles de la
 * boutique a un effet commercial : l'offre du revendeur disparaît aussi de la
 * fiche produit, et l'achat direct d'un article au prix de gros peut se rouvrir.
 *
 * Page privée : le gain affiché ici vient de /api/reseller/boutique/articles,
 * jamais de la vitrine publique.
 */
export default function FeuilleArticle({
  article,
  ouvert,
  onFermer,
  coupDeCoeur,
  premierDeSonBloc,
  coupsPleins,
  onBasculerCoup,
  onMettreEnPremier,
  onRetirer,
}: {
  article: ArticleBoutique | null;
  ouvert: boolean;
  onFermer: () => void;
  /** État À L'ÉCRAN (peut différer de l'enregistré tant que l'ordre n'est pas enregistré). */
  coupDeCoeur: boolean;
  premierDeSonBloc: boolean;
  /** Déjà 6 coups de cœur : on ne peut qu'en retirer. */
  coupsPleins: boolean;
  onBasculerCoup: () => void;
  onMettreEnPremier: () => void;
  /** Retrait confirmé : true quand la boutique l'a bien retiré. */
  onRetirer: () => Promise<boolean>;
}) {
  const { confirmer } = useToast();
  const code = useCodeRevendeur();
  const [partage, setPartage] = useState(false);
  const [retrait, setRetrait] = useState(false);
  if (!article) return null;

  const pastille = PASTILLE_ETAT[article.etat];
  const enVente = article.etat === 'affiche' || article.etat === 'epuise';
  const produitPartage = article.slug && article.prixVitrine
    ? { nom: article.nom, prix: article.prixVitrine, slug: article.slug, images: article.image ? [article.image] : [] }
    : null;

  const partager = async () => {
    if (!produitPartage) return;
    setPartage(true);
    try { await partagerProduit(produitPartage, code); } finally { setPartage(false); }
  };
  const precharger = () => {
    if (!produitPartage) return;
    prechargerImage(produitPartage.images[0], produitPartage.slug);
    if (code) prechargerLienPartage(produitPartage.slug);
  };

  const retirer = async () => {
    const ok = await confirmer({
      titre: `Retirer « ${article.nom} » de votre boutique ?`,
      message: 'Il disparaîtra de votre vitrine. Votre offre disparaîtra aussi de la fiche produit de cet article.',
      confirmer: 'Retirer',
      annuler: 'Garder',
      danger: true,
    });
    if (!ok) return;
    setRetrait(true);
    try {
      if (await onRetirer()) onFermer();
    } finally {
      setRetrait(false);
    }
  };

  return (
    <Sheet ouvert={ouvert} onFermer={onFermer} titre="Cet article">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="relative w-16 h-16 shrink-0 rounded-2xl overflow-hidden bg-slate-100">
            <ProductImage src={article.image || ''} alt="" fill sizes="64px" className="object-cover" compact />
          </div>
          <div className="min-w-0 space-y-0.5">
            <p className="text-sm font-bold text-slate-900 line-clamp-2">{article.nom}</p>
            <p className="text-sm text-slate-600 tabular-nums">
              {article.prixVitrine != null ? formatF(article.prixVitrine) : '—'} dans votre boutique
            </p>
            <p className="text-sm font-semibold text-suguba-brand-dark">
              Vous gagnez <span className="tabular-nums">{formatF(article.gain)}</span> par vente
            </p>
            {pastille && <StatusPill ton={article.etat === 'epuise' ? 'attente' : 'neutre'}>{pastille}</StatusPill>}
          </div>
        </div>

        {!enVente && (
          <p className="text-sm text-slate-700 bg-slate-100 rounded-2xl p-3">
            {article.etat === 'retire'
              ? 'Cet article n’est plus en vente : il ne s’affiche plus dans votre boutique.'
              : 'Cet article ne vous rapporte plus rien pour le moment : il ne s’affiche plus dans votre boutique.'}
          </p>
        )}

        <div className="space-y-2">
          <Button type="button" fullWidth variant={coupDeCoeur ? 'ghost' : 'primary'} onClick={() => { onBasculerCoup(); onFermer(); }}
            disabled={!coupDeCoeur && coupsPleins} aria-pressed={coupDeCoeur}>
            <Heart className="w-4 h-4" fill={coupDeCoeur ? 'currentColor' : 'none'} />
            {coupDeCoeur ? 'Retirer des coups de cœur' : 'Coup de cœur'}
          </Button>
          {!coupDeCoeur && coupsPleins && (
            <p className="text-xs text-slate-600 text-center">{COUPS_DE_COEUR_MAX} coups de cœur au plus : retirez-en un d’abord.</p>
          )}
          <Button type="button" fullWidth variant="ghost" onClick={() => { onMettreEnPremier(); onFermer(); }} disabled={premierDeSonBloc}>
            <ArrowUpToLine className="w-4 h-4" />Mettre en premier
          </Button>
          {article.modePrix === 'gros' && (
            <Button href={`/reseller/prix?boutique=1&produit=${encodeURIComponent(article.id)}`} fullWidth variant="ghost">
              <Tag className="w-4 h-4" />Mon prix
            </Button>
          )}
          {enVente && produitPartage && (
            <BoutonPartageWhatsApp fullWidth onClick={partager} onPointerDown={precharger} loading={partage}
              libelle="Partager cet article" aria-label={`Partager ${article.nom} sur WhatsApp`} />
          )}
          <Button href={PORTE_MA_BOUTIQUE} fullWidth variant="ghost">
            <Eye className="w-4 h-4" />Voir dans ma boutique
          </Button>
          <Button type="button" fullWidth variant="danger" onClick={retirer} loading={retrait}>
            <Trash2 className="w-4 h-4" />Retirer de ma boutique
          </Button>
        </div>
        <p className="text-xs text-slate-600">
          « Coup de cœur » et « Mettre en premier » changent l’ordre à l’écran : touchez « Enregistrer l’ordre » pour l’appliquer à votre boutique.
        </p>
      </div>
    </Sheet>
  );
}
