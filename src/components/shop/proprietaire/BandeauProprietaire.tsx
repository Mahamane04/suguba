'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { BarChart3, Eye, LayoutGrid, PackagePlus, SlidersHorizontal } from 'lucide-react';
import BoutonPartageWhatsApp from '@/components/ui/BoutonPartageWhatsApp';
import { StatusPill } from '@/components/ui/Surface';
import { initiale } from '@/lib/initiale';
import { PAGE_MES_ARTICLES, PAGE_STATISTIQUES } from '@/lib/reseau/porte-boutique';
import type { ArticlePartage } from '@/lib/partage-boutique';
import { useProprietaire, type IdentiteVitrine } from './ModeProprietaire';
import PartageBoutique from './PartageBoutique';

/**
 * Bandeau du propriétaire sur sa vitrine (lot 2 du chantier boutique, 2026-10-03).
 *
 * « Ma boutique » montrait les réglages ; elle montre maintenant la boutique, et
 * c'est ici qu'on la gère :
 *  - barre collante sous l'en-tête : miniature du logo, « Ma boutique », état,
 *    et l'action principale « Partager » ;
 *  - outils à icône et libellé : Personnaliser (réglages), Articles (« Mes
 *    articles » depuis le lot 3 : ranger, coups de cœur, retirer), Stats et
 *    Outils (« Tous mes outils » reste accessible ici, décision du fondateur) ;
 *  - « Voir comme un client », qui masque tous les outils sans recharger.
 *
 * Lot 4 (2026-10-03) :
 *  - « Partager » ouvre la feuille « Partager ma boutique » (toute la boutique,
 *    coups de cœur ou un rayon ; message avec 3 articles et leur prix ; lien
 *    suivi réutilisé). Elle s'ouvre aussi à l'arrivée par ?partager=1 ;
 *  - « Stats » mène à « Statistiques de ma boutique » et affiche « 7 j : N
 *    visites », compté par le serveur pour le propriétaire seul (« — » si la
 *    mesure manque, jamais un 0 inventé).
 *
 * Aucune donnée privée ici (ni gain, ni commission, ni prix de gros) : le
 * bandeau est rendu dans le HTML de la vitrine du propriétaire.
 */
export default function BandeauProprietaire({
  identite: identiteInitiale,
  statut,
  urlPartage,
  slug,
  articles = [],
  visites7j = null,
}: {
  identite: IdentiteVitrine;
  /** 'active', ou 'hidden' / 'suspended' quand Suguba l'a masquée. */
  statut: string;
  urlPartage: string;
  /** Adresse de la boutique (/boutique/<slug>) : repli quand le lien suivi n'est pas prêt. */
  slug?: string;
  /** Articles affichés par la vitrine (données publiques), pour le message de partage. */
  articles?: ArticlePartage[];
  /** Visites des 7 derniers jours ; null quand la mesure manque. */
  visites7j?: number | null;
}) {
  const proprietaire = useProprietaire();
  const identite = proprietaire?.identite ?? identiteInitiale;
  const enLigne = statut === 'active';
  // Hors de l'enveloppe (rendu isolé), la feuille garde son propre état.
  const [partageLocal, setPartageLocal] = useState(false);
  const partageOuvert = proprietaire ? proprietaire.partage : partageLocal;
  const ouvrirPartage = () => (proprietaire ? proprietaire.ouvrirPartage() : setPartageLocal(true));
  const fermerPartage = () => (proprietaire ? proprietaire.fermerPartage() : setPartageLocal(false));
  const adresse = slug || adresseDe(urlPartage);
  const boutique = useMemo(
    () => ({ nom: identite.nom, enseigne: identite.enseigne, slug: adresse, statut }),
    [identite.nom, identite.enseigne, adresse, statut],
  );

  return (
    <>
      <div className="sticky top-16 z-30 group-data-[vue=client]:hidden flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/95 backdrop-blur shadow-sm px-3 py-2">
        {identite.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={identite.logo} alt="" className="w-10 h-10 shrink-0 rounded-xl object-cover bg-white border border-slate-100" />
        ) : (
          <span aria-hidden="true" className="w-10 h-10 shrink-0 rounded-xl bg-suguba-menthe text-suguba-profond flex items-center justify-center font-bold">
            {initiale(identite.nom)}
          </span>
        )}
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="text-sm font-bold text-slate-900 truncate">Ma boutique</p>
          {enLigne ? <StatusPill ton="succes">En ligne</StatusPill> : <StatusPill ton="attente">Masquée par Suguba</StatusPill>}
        </div>
        {/* Boutique masquée : un lien partagé mènerait le client à une page introuvable. */}
        {enLigne && (
          <BoutonPartageWhatsApp
            type="button"
            size="sm"
            className="shrink-0"
            libelle="Partager"
            aria-label="Partager ma boutique sur WhatsApp"
            aria-haspopup="dialog"
            onClick={ouvrirPartage}
          />
        )}
      </div>

      <div className="group-data-[vue=client]:hidden space-y-2">
        <nav aria-label="Gérer ma boutique" className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Outil href="/reseller/boutique" icone={SlidersHorizontal} libelle="Personnaliser" />
          <Outil href={PAGE_MES_ARTICLES} icone={PackagePlus} libelle="Articles" />
          <Outil
            href={PAGE_STATISTIQUES}
            icone={BarChart3}
            libelle="Stats"
            detail={`7 j : ${visites7j == null ? '—' : `${visites7j} visite${visites7j > 1 ? 's' : ''}`}`}
          />
          <Outil href="/reseller/outils" icone={LayoutGrid} libelle="Outils" />
        </nav>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => proprietaire?.changerVue('client')}
            className="inline-flex items-center gap-1.5 min-h-10 px-1 text-sm font-semibold text-suguba-brand-dark hover:underline underline-offset-2"
          >
            <Eye className="w-4 h-4" />Voir comme un client
          </button>
        </div>
      </div>

      {enLigne && adresse && (
        <PartageBoutique
          ouvert={partageOuvert}
          onFermer={fermerPartage}
          boutique={boutique}
          articles={articles}
          onLienPret={proprietaire?.marquerPartage}
        />
      )}
    </>
  );
}

/** « https://…/boutique/awa-mode » → « awa-mode » ; vide si l'adresse ne se lit pas. */
function adresseDe(url: string): string {
  try {
    return decodeURIComponent(url.split('/boutique/')[1]?.split(/[?#]/)[0] || '');
  } catch {
    return '';
  }
}

function Outil({ href, icone: Icone, libelle, detail }: { href: string; icone: React.ElementType; libelle: string; detail?: string }) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center justify-center gap-0.5 min-h-14 rounded-2xl border border-slate-200 bg-white px-1 py-1.5 text-xs font-semibold text-suguba-profond hover:bg-suguba-sauge active:scale-[0.98] transition-all"
    >
      <Icone className="w-5 h-5" aria-hidden="true" />
      <span className="truncate max-w-full">{libelle}</span>
      {detail && <span className="truncate max-w-full font-normal text-slate-600 tabular-nums">{detail}</span>}
    </Link>
  );
}
