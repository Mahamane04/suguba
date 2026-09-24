import React from 'react';
import { BadgeCheck, MapPin, Star, Zap, Truck, Gem } from 'lucide-react';
import { badge } from '@/lib/reseau/badges';

/**
 * Badge de CONFIANCE d'un compte ou d'une boutique (charte verte du
 * 2026-09-23). À ne pas confondre avec StatusPill, qui décrit l'ÉTAT d'une
 * commande ou d'un retrait : ici un sceau rond, là un point.
 *
 *   menthe  = vérifié par Suguba (rassurant)
 *   citron  = performance (top vendeur, actif, livraison)
 *   profond = premium
 */
type Famille = 'verifie' | 'performance' | 'premium';

const FAMILLE: Record<string, { famille: Famille; Icone: React.ElementType }> = {
  profil_verifie: { famille: 'verifie', Icone: BadgeCheck },
  localisation_verifiee: { famille: 'verifie', Icone: MapPin },
  revendeur_verifie: { famille: 'verifie', Icone: BadgeCheck },
  fournisseur_verifie: { famille: 'verifie', Icone: BadgeCheck },
  livreur_verifie: { famille: 'verifie', Icone: BadgeCheck },
  boutique_verifiee: { famille: 'verifie', Icone: BadgeCheck },
  top_vendeur: { famille: 'performance', Icone: Star },
  revendeur_actif: { famille: 'performance', Icone: Zap },
  livraison_excellente: { famille: 'performance', Icone: Truck },
  fournisseur_premium: { famille: 'premium', Icone: Gem },
};

const STYLES: Record<Famille, { badge: string; sceau: string }> = {
  verifie: { badge: 'bg-suguba-menthe text-[#055C00]', sceau: 'bg-suguba-brand text-suguba-profond' },
  performance: { badge: 'bg-[#EEFBD2] text-[#3D5200]', sceau: 'bg-suguba-citron text-suguba-profond' },
  premium: { badge: 'bg-suguba-profond text-white', sceau: 'bg-suguba-citron text-suguba-profond' },
};

export default function BadgeConfiance({ cle }: { cle: string }) {
  const { famille, Icone } = FAMILLE[cle] || { famille: 'verifie' as Famille, Icone: BadgeCheck };
  const s = STYLES[famille];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full py-1 pl-1 pr-3 text-xs font-semibold whitespace-nowrap ${s.badge}`}>
      <span className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${s.sceau}`}>
        <Icone className="w-3 h-3" strokeWidth={2.5} aria-hidden="true" />
      </span>
      {badge(cle).libelle}
    </span>
  );
}
