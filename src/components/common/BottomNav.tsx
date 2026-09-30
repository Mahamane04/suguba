'use client';

import React, { useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSugubaStore } from '@/lib/store';
import { useClavierOuvert } from '@/lib/useClavierOuvert';
import { useBarreSurEcranVisible } from '@/lib/useBarreSurEcranVisible';
import { usePanier } from '@/lib/panier';
import { useDansPosteAdmin } from '@/components/admin/contexte';
import {
  Home, Grid3X3, ShoppingCart, Wallet, TrendingUp,
  PackagePlus, ShieldCheck, Truck, Store, Users,
  LifeBuoy, PackageSearch, Boxes, ClipboardList,
  ShoppingBag, UserRound,
} from 'lucide-react';

type NavItem = { label: string; href: string; icon: React.ElementType; panier?: boolean };

/**
 * ⚠️ Chaque href ci-dessous doit correspondre à une page réellement présente
 * dans src/app. Six d'entre eux n'existaient pas (/supplier/products,
 * /supplier/orders, /driver/history, /admin/products, /admin/orders,
 * /admin/payouts) : la navigation principale de l'admin était cassée à 75 %,
 * celle du fournisseur et du livreur à 50 %. Corrigé le 2026-09-09 en les
 * pointant vers les pages qui rendent réellement ce service.
 */
function getNavItems(role: string | null): NavItem[] {
  switch (role) {
    case 'reseller':
      return [
        { label: 'Accueil',     href: '/reseller',           icon: Home        },
        { label: 'Produits',   href: '/reseller/catalog',   icon: Grid3X3     },
        { label: 'Ventes',      href: '/reseller/orders',    icon: ShoppingCart},
        { label: 'Gains',       href: '/reseller/payouts',   icon: Wallet      },
        { label: 'Créer',      href: '/reseller/createur',  icon: TrendingUp  },
      ];
    case 'supplier':
      return [
        { label: 'Accueil',   href: '/supplier',              icon: Home       },
        // Anciennement /supplier/products (inexistant) — la gestion du stock
        // et du catalogue du fournisseur vit sur /supplier/inventory.
        { label: 'Stocks',      href: '/supplier/inventory',    icon: Boxes      },
        { label: 'Ajouter',     href: '/supplier/products/new', icon: PackagePlus},
        // Commandes à préparer et code de ramassage (2026-09-24). Le réseau
        // reste accessible depuis le tableau de bord.
        { label: 'Commandes',   href: '/supplier/commandes',    icon: ClipboardList },
        // Solde et retraits du fournisseur (lot C, 2026-09-27).
        { label: 'Paiements',   href: '/supplier/paiements',    icon: Wallet },
      ];
    case 'driver':
      return [
        { label: 'Courses',     href: '/driver',          icon: Truck  },
        // Anciennement /driver/history (inexistant) — l'historique des
        // livraisons est dans le portefeuille.
        { label: 'Portefeuille',href: '/driver/earnings', icon: Wallet },
      ];
    case 'diaspora':
      // Le client diaspora n'avait aucune barre à lui : il voyait celle des
      // visiteurs (Boutique / Suivi / Gagner / Connexion) alors qu'il était connecté.
      return [
        { label: 'Boutique',  href: '/',          icon: Store        },
        { label: 'Commander', href: '/diaspora',  icon: ShoppingCart },
        { label: 'Suivi',     href: '/track',     icon: PackageSearch},
      ];
    case 'admin':
      return [
        // Hors de l'espace équipe seulement (sur le site) : dans l'espace
        // équipe, son menu remplace cette barre (U3, 2026-09-27). « À
        // traiter » est la page d'arrivée de chaque membre depuis A1.
        { label: 'À traiter', href: '/admin/a-traiter',  icon: ClipboardList },
        { label: 'Commandes', href: '/admin/commandes',  icon: ShoppingBag },
        { label: 'Produits',  href: '/admin/products',   icon: Boxes      },
        { label: 'SAV',       href: '/admin/sav',        icon: LifeBuoy   },
      ];
    case 'customer':
      // Client connecté (V1, 2026-09-27) : il tombait dans le cas visiteur
      // et voyait « Connexion » alors qu'il était connecté.
      return [
        { label: 'Accueil',   href: '/',                 icon: Home         },
        { label: 'Panier',    href: '/panier',           icon: ShoppingBag, panier: true },
        { label: 'Commandes', href: '/compte/commandes', icon: PackageSearch},
        { label: 'Compte',    href: '/compte',           icon: UserRound    },
      ];
    default:
      // Visiteur non connecté — l'acheteur, l'utilisateur le plus important
      // d'une vitrine produit. Barre d'achat (V1, 2026-09-27) : chercher,
      // ajouter au panier, commander, retrouver sa commande. « Gagner de
      // l'argent » reste sur l'accueil et dans Compte.
      return [
        // Libellés courts volontairement : la barre tronque à 56px, « Ma
        // commande » s'affichait « Ma comm… ».
        { label: 'Accueil',   href: '/',       icon: Home         },
        { label: 'Panier',    href: '/panier', icon: ShoppingBag, panier: true },
        { label: 'Commandes', href: '/track',  icon: PackageSearch},
        { label: 'Compte',    href: '/compte', icon: UserRound    },
      ];
  }
}

/**
 * La barre se basait sur `sugubaStore.currentUser`, c'est-à-dire le store de
 * démo local, dont le rôle par défaut est « reseller » : un visiteur anonyme
 * voyait donc une navigation Revendeur (Ventes, Gains, Marketing) menant à des
 * pages que le middleware renvoie aussitôt vers /login. Même reliquat que
 * celui déjà corrigé sur le Header — la source de vérité est /api/auth/me.
 *
 * ⚠️ Correctif du 2026-09-11 : chaque page.tsx monte SON PROPRE `<BottomNav />`
 * (pas de layout partagé) — ce composant est donc une instance TOUTE NEUVE à
 * chaque navigation. Il refaisait un `fetch('/api/auth/me')` à chaque fois,
 * avec un état local `role` qui redémarrait à `null` : le temps de la requête
 * réseau, la barre affichait la version « visiteur » (Boutique/Suivi/Gagner/
 * Connexion), même pour un admin ou un revendeur connecté — un flash visible
 * à chaque tape sur une icône, filmé et signalé par l'utilisateur. Le rôle est
 * désormais lu depuis `useSugubaStore()`, déjà résolu une fois pour toutes par
 * `CloudSyncInitializer` (monté dans layout.tsx, qui NE remonte PAS lui) et
 * disponible de façon SYNCHRONE dès le tout premier rendu de ce composant :
 * plus de requête ici, plus de flash.
 */
export default function BottomNav() {
  const pathname = usePathname();
  const state = useSugubaStore();
  // id vide = personne connue pour l'instant (visiteur, ou identité pas
  // encore résolue lors du tout premier chargement de l'app).
  const role = state.currentUser.id ? state.currentUser.role : null;
  // Masquée pendant la saisie : sur iPhone, elle restait décalée de la hauteur
  // du clavier après sa fermeture (voir src/lib/useClavierOuvert.ts).
  const champActif = useClavierOuvert();
  // Barre collée au bas de l'écran réellement visible (iPhone), et masquée
  // dès que le clavier occupe l'écran : voir useBarreSurEcranVisible.
  const barre = useRef<HTMLElement>(null);
  // Un champ sélectionné sans clavier affiché (sélection automatique à
  // l'ouverture d'une page) ne doit pas masquer la barre : on se fie à la
  // hauteur réelle de l'écran quand le navigateur la donne.
  const { clavier, mesure } = useBarreSurEcranVisible(barre);
  const clavierOuvert = mesure ? clavier : champActif;

  const navItems = getNavItems(role);
  const articlesPanier = usePanier().reduce((s, a) => s + a.quantity, 0);

  // Racines d'espace : elles ne doivent s'allumer qu'en correspondance exacte.
  // Sans « / » dans cette liste, `pathname.startsWith('/')` est toujours vrai
  // et l'onglet Boutique resterait allumé sur toutes les pages du site.
  const RACINES = ['/', '/reseller', '/supplier', '/driver', '/admin', '/compte'];

  // Espace équipe (U3, 2026-09-27) : son propre menu remplace cette barre,
  // qui menait encore à l'ancien tableau de bord.
  const dansPoste = useDansPosteAdmin();
  if (dansPoste) return null;

  return (
    <>
      {/* Réserve dans le flux la place occupée par la barre fixe ci-dessous.
          Sans cela, le dernier contenu de chaque page passait sous la barre et
          restait inaccessible même défilement au maximum (constaté sur /,
          /register, /reseller/join, /diaspora, /legal/terms — WCAG 2.4.11).
          Les pages réservaient chacune leur propre marge (pb-16, pb-20...),
          toutes insuffisantes et divergentes ; la hauteur est désormais tenue
          au même endroit que la barre, donc les deux ne peuvent plus se
          désynchroniser. h-16 (64px) + mb-2 (8px) + la zone sûre iOS. */}
      <div
        aria-hidden="true"
        className="md:hidden shrink-0"
        style={{ height: 'calc(5rem + env(safe-area-inset-bottom, 0px))' }}
      />
    <nav
      ref={barre}
      hidden={clavierOuvert}
      className="fixed bottom-0 left-0 right-0 z-40 md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {/* Glass background */}
      <div className="mx-2 mb-2 bg-white/90 backdrop-blur-xl rounded-2xl border border-gray-100 shadow-float">
        <div className={`flex items-center justify-around px-1 h-16`}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (!RACINES.includes(item.href) && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={`flex flex-col items-center justify-center flex-1 min-w-0 py-2 px-1 rounded-xl transition-colors duration-150 active:scale-95 ${
                  isActive
                    ? 'text-suguba-brand-dark'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {/* Le halo pulsant (animate-pulse) donnait une impression de
                    clignotement à chaque changement de page plutôt qu'une
                    transition fluide — remplacé par un simple fondu du
                    fond, qui suit naturellement le changement d'onglet. */}
                <div className={`relative flex items-center justify-center w-8 h-8 rounded-xl transition-all duration-200 ${
                  isActive
                    ? 'bg-suguba-50 shadow-brand-sm'
                    : ''
                }`}>
                  <Icon
                    className={`w-4.5 h-4.5 transition-all duration-150 ${
                      isActive ? 'stroke-[2.5]' : 'stroke-[1.75]'
                    }`}
                    style={{ width: '1.125rem', height: '1.125rem' }}
                  />
                  {item.panier && articlesPanier > 0 && (
                    <span aria-label={`${articlesPanier} article${articlesPanier > 1 ? 's' : ''}`}
                      className="absolute -top-1 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-suguba-profond text-white text-xs font-bold flex items-center justify-center tabular-nums">
                      {articlesPanier > 9 ? '9+' : articlesPanier}
                    </span>
                  )}
                </div>
                <span
                  className={`text-xs mt-0.5 tracking-tight font-medium w-full text-center leading-tight transition-all duration-150 ${
                    isActive ? 'font-bold' : ''
                  }`}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
    </>
  );
}
