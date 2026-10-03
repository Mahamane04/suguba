'use client';

import React from 'react';
import Link from 'next/link';
import { Eye, LayoutGrid, PackagePlus, SlidersHorizontal } from 'lucide-react';
import BoutonPartageWhatsApp from '@/components/ui/BoutonPartageWhatsApp';
import { StatusPill } from '@/components/ui/Surface';
import { initiale } from '@/lib/initiale';
import { useProprietaire, type IdentiteVitrine } from './ModeProprietaire';

/**
 * Bandeau du propriétaire sur sa vitrine (lot 2 du chantier boutique, 2026-10-03).
 *
 * « Ma boutique » montrait les réglages ; elle montre maintenant la boutique, et
 * c'est ici qu'on la gère :
 *  - barre collante sous l'en-tête : miniature du logo, « Ma boutique », état,
 *    et l'action principale « Partager » (WhatsApp, adresse de la boutique ; le
 *    lien suivi viendra au lot 4) ;
 *  - trois outils à icône et libellé : Personnaliser (réglages), Articles (le
 *    catalogue, jusqu'à « Mes articles » au lot 3) et Outils (« Tous mes outils »
 *    reste accessible ici, décision du fondateur) ;
 *  - « Voir comme un client », qui masque tous les outils sans recharger.
 *
 * Aucune donnée privée ici (ni gain, ni commission, ni prix de gros) : le
 * bandeau est rendu dans le HTML de la vitrine.
 */
export default function BandeauProprietaire({
  identite: identiteInitiale,
  statut,
  urlPartage,
}: {
  identite: IdentiteVitrine;
  /** 'active', ou 'hidden' / 'suspended' quand Suguba l'a masquée. */
  statut: string;
  urlPartage: string;
}) {
  const proprietaire = useProprietaire();
  const identite = proprietaire?.identite ?? identiteInitiale;
  const enLigne = statut === 'active';
  const texte = `🛍️ Ma boutique Suguba — ${identite.nom}\n\nCommandez, vous payez à la livraison à Bamako.\n👉 ${urlPartage}`;

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
            size="sm"
            className="shrink-0"
            libelle="Partager"
            aria-label="Partager ma boutique sur WhatsApp"
            href={`https://api.whatsapp.com/send?text=${encodeURIComponent(texte)}`}
          />
        )}
      </div>

      <div className="group-data-[vue=client]:hidden space-y-2">
        <nav aria-label="Gérer ma boutique" className="grid grid-cols-3 gap-2">
          <Outil href="/reseller/boutique" icone={SlidersHorizontal} libelle="Personnaliser" />
          <Outil href="/reseller/catalog" icone={PackagePlus} libelle="Articles" />
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
    </>
  );
}

function Outil({ href, icone: Icone, libelle }: { href: string; icone: React.ElementType; libelle: string }) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center justify-center gap-1 min-h-14 rounded-2xl border border-slate-200 bg-white px-1 text-xs font-semibold text-suguba-profond hover:bg-suguba-sauge active:scale-[0.98] transition-all"
    >
      <Icone className="w-5 h-5" />
      <span className="truncate max-w-full">{libelle}</span>
    </Link>
  );
}
