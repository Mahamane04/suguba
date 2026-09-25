'use client';

import React from 'react';
import Link from 'next/link';
import {
  ShoppingBag, Boxes, Store, Users, Wallet, Megaphone, Target,
  ShieldCheck, Settings, BarChart3, LifeBuoy, UserCog, Radio, ChevronRight, Gift, Banknote, FileText, Hammer,
} from 'lucide-react';
import PageReseau from '@/components/reseau/PageReseau';
import { Card } from '@/components/ui/Surface';
import StatsReseauAdmin from '@/components/reseau/StatsReseauAdmin';

/**
 * Back-office par domaines (§ 22 du cahier des charges).
 *
 * Exigence explicite : « éviter de concentrer toutes les configurations dans
 * une seule grande page ». Cet écran est l'index du back-office — six
 * domaines, chacun menant à des écrans qui font une chose.
 *
 * Les entrées pointent TOUTES vers une page qui existe réellement. Une entrée
 * de navigation vers une page absente est un bug visible par l'utilisateur,
 * et c'est exactement ce qui était arrivé à la barre du bas (voir BottomNav).
 */

interface Entree { libelle: string; href: string; icone: React.ElementType; aide: string }
interface Domaine { titre: string; couleur: string; entrees: Entree[] }

const DOMAINES: Domaine[] = [
  {
    titre: 'Commerce',
    couleur: 'bg-suguba-brand/10 text-suguba-brand',
    entrees: [
      { libelle: 'Commandes', href: '/admin/commandes', icone: ShoppingBag, aide: 'Toutes les commandes, recherche, paniers' },
      { libelle: 'Produits', href: '/admin/products', icone: Boxes, aide: 'Catalogue, modération, prix' },
      { libelle: 'Nouveau produit', href: '/admin/products/new', icone: Store, aide: 'Ajouter un article au catalogue' },
      { libelle: 'Boutique Suguba', href: '/admin/boutique-suguba', icone: Store, aide: 'Suguba vendeuse de ses propres produits' },
    ],
  },
  {
    titre: 'Utilisateurs',
    couleur: 'bg-sky-50 text-sky-700',
    entrees: [
      { libelle: 'Utilisateurs', href: '/admin/utilisateurs', icone: Users, aide: 'Clients, revendeurs, fournisseurs, livreurs, badges' },
      { libelle: 'Boutiques', href: '/admin/boutiques', icone: Store, aide: 'Toutes les vitrines, modération' },
    ],
  },
  {
    titre: 'Finance',
    couleur: 'bg-amber-50 text-amber-800',
    entrees: [
      { libelle: 'Retraits et commissions', href: '/admin', icone: Wallet, aide: 'Demandes de retrait, paiements' },
      { libelle: 'Caisse livreurs', href: '/admin/caisse-livreurs', icone: Banknote, aide: 'Espèces à remettre, versements reçus' },
      { libelle: 'Récompenses', href: '/admin/recompenses', icone: Gift, aide: 'Missions et parrainages à verser' },
      { libelle: 'Analyses', href: '/admin/analytics', icone: BarChart3, aide: 'Chiffre d’affaires et marges' },
      { libelle: 'Rapport du soir', href: '/admin/reports/daily', icone: Radio, aide: 'Le point de la journée' },
    ],
  },
  {
    titre: 'Marketing',
    couleur: 'bg-fuchsia-50 text-fuchsia-700',
    entrees: [
      { libelle: 'Missions', href: '/admin/missions', icone: Target, aide: 'Créer et suivre les missions du réseau' },
      { libelle: 'Sponsorisation', href: '/admin/sponsorisations', icone: Megaphone, aide: 'Packs, demandes, emplacements' },
      { libelle: 'Diffusion', href: '/admin/broadcast', icone: Radio, aide: 'Messages au réseau' },
    ],
  },
  {
    titre: 'Sécurité',
    couleur: 'bg-rose-50 text-rose-700',
    entrees: [
      { libelle: 'Vérifications', href: '/admin/verifications', icone: ShieldCheck, aide: 'File d’attente des pièces à valider' },
      { libelle: 'Devis', href: '/admin/devis', icone: FileText, aide: 'Demandes de devis, relances fournisseurs' },
      { libelle: 'Prestations', href: '/admin/prestations', icone: Hammer, aide: 'Installations à étapes, contestations' },
      { libelle: 'Service après-vente', href: '/admin/sav', icone: LifeBuoy, aide: 'Litiges et réclamations' },
    ],
  },
  {
    titre: 'Plateforme',
    couleur: 'bg-slate-100 text-slate-700',
    entrees: [
      { libelle: 'Équipe et permissions', href: '/admin/equipe', icone: UserCog, aide: 'Qui a le droit de faire quoi' },
      { libelle: 'Paramètres et commissions', href: '/admin#reglages', icone: Settings, aide: 'Frais, commissions, livraison, points relais' },
    ],
  },
];

export default function BackOfficePage() {
  return (
    <PageReseau
      titre="Back-office"
      sousTitre="Tout l’outillage Suguba, rangé par domaine."
      retour={{ href: '/admin', libelle: 'Vue globale' }}
      large
    >
      <StatsReseauAdmin />

      <div className="grid gap-4 sm:grid-cols-2">
        {DOMAINES.map((domaine) => (
          <Card key={domaine.titre} padding="p-0" className="overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100">
              <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold uppercase ${domaine.couleur}`}>
                {domaine.titre}
              </span>
            </div>
            <div className="divide-y divide-slate-100">
              {domaine.entrees.map((entree) => {
                const Icone = entree.icone;
                return (
                  <Link
                    key={`${domaine.titre}-${entree.libelle}`}
                    href={entree.href}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 active:bg-slate-100 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                      <Icone className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-900">{entree.libelle}</p>
                      <p className="text-xs text-slate-500 truncate">{entree.aide}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                  </Link>
                );
              })}
            </div>
          </Card>
        ))}
      </div>
    </PageReseau>
  );
}
