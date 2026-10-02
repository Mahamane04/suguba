'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  PackageSearch, Heart, Users, Store, Repeat, TrendingUp, MessageCircle, LogOut, LogIn, UserPlus, ChevronRight,
} from 'lucide-react';
import PageReseau from '@/components/reseau/PageReseau';
import Button from '@/components/ui/Button';
import { Card, Skeleton } from '@/components/ui/Surface';
import { sugubaStore } from '@/lib/store';
import { invaliderIdentite } from '@/lib/identite';
import { supabase } from '@/lib/supabase';
import { statutVente } from '@/lib/libelles-vente';

/**
 * Compte (V1 vue client, 2026-09-27) — dernier onglet de la barre du bas
 * pour le visiteur et le client. Connecté : ses achats, favoris,
 * destinataires, boutiques suivies, profils. Visiteur : se connecter, sans
 * laisser croire qu'un compte est obligatoire pour acheter. « Gagner de
 * l'argent » vit ici (et sur l'accueil), plus dans la barre.
 */

const NUMERO_AIDE = '22389460000';

interface Ligne { href: string; libelle: string; aide: string; icone: React.ElementType; externe?: boolean }

function Liste({ lignes }: { lignes: Ligne[] }) {
  return (
    <Card className="!p-0 overflow-hidden">
      <ul className="divide-y divide-slate-100">
        {lignes.map(({ href, libelle, aide, icone: Icone, externe }) => {
          const contenu = (
            <>
              <span className="w-10 h-10 rounded-2xl bg-suguba-50 text-suguba-brand-dark flex items-center justify-center shrink-0">
                <Icone className="w-5 h-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-slate-900">{libelle}</span>
                <span className="block text-xs text-slate-500">{aide}</span>
              </span>
              <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
            </>
          );
          const classe = 'flex items-center gap-3 px-4 py-3 min-h-[60px] hover:bg-slate-50';
          return (
            <li key={href}>
              {externe
                ? <a href={href} target="_blank" rel="noopener noreferrer" className={classe}>{contenu}</a>
                : <Link href={href} className={classe}>{contenu}</Link>}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

export default function ComptePage() {
  const router = useRouter();
  const [moi, setMoi] = useState<{ connecte: boolean; nom?: string } | null>(null);
  const [sortie, setSortie] = useState(false);
  // PUB-14 (lot 5 de l'audit UI/UX du 2026-10-02) : la commande en cours, en tête
  // du compte. Avant, il fallait ouvrir « Mes commandes » puis le reçu pour la suivre.
  const [enCours, setEnCours] = useState<{ numero: string; produit: string; statut: string } | null>(null);

  useEffect(() => {
    fetch('/api/auth/me', { cache: 'no-store', credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : null))
      .then((m) => setMoi(m?.authenticated ? { connecte: true, nom: m.fullName } : { connecte: false }))
      .catch(() => setMoi({ connecte: false }));
  }, []);
  useEffect(() => {
    if (!moi?.connecte) return;
    fetch('/api/compte/commandes', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setEnCours(((j?.commandes || []) as { numero: string; produit: string; statut: string }[])
        .find((c) => !['delivered', 'cancelled', 'returned'].includes(c.statut)) || null))
      .catch(() => undefined);
  }, [moi?.connecte]);

  const aide: Ligne = {
    href: `https://api.whatsapp.com/send?phone=${NUMERO_AIDE}&text=${encodeURIComponent('Bonjour Suguba, j’ai une question.')}`,
    libelle: 'Aide', aide: 'Une question ? Écrivez-nous sur WhatsApp', icone: MessageCircle, externe: true,
  };
  const gagner: Ligne = { href: '/rejoindre', libelle: 'Gagner de l’argent avec Suguba', aide: 'Revendeur, fournisseur ou livreur', icone: TrendingUp };

  async function seDeconnecter() {
    setSortie(true);
    const r = await fetch('/api/auth/logout', { method: 'POST' }).catch(() => null);
    if (!r?.ok) { setSortie(false); window.alert('Déconnexion non confirmée. Rétablissez la connexion puis réessayez.'); return; }
    invaliderIdentite();
    await supabase?.auth.signOut({ scope: 'local' }).catch(() => undefined);
    sugubaStore.definirUtilisateur(null, true);
    router.push('/');
  }

  return (
    <PageReseau titre="Compte" sousTitre={moi?.connecte && moi.nom ? `Bonjour ${moi.nom.split(' ')[0]}` : 'Vos achats et vos réglages.'}>
      {!moi ? <Skeleton className="h-64" /> : moi.connecte ? (
        <>
          {enCours && (
            <Card className="space-y-3 bg-suguba-menthe border-transparent">
              <div>
                <p className="text-xs font-bold text-suguba-profond">Commande en cours</p>
                <p className="text-base font-bold text-slate-900 truncate">{enCours.produit}</p>
                <p className="text-sm text-slate-700">{statutVente(enCours.statut).libelle} · {enCours.numero}</p>
              </div>
              <Button href={`/track/${encodeURIComponent(enCours.numero)}`} fullWidth>
                <PackageSearch className="w-4 h-4" />Suivre ma commande
              </Button>
            </Card>
          )}
          <Liste lignes={[
            { href: '/compte/commandes', libelle: 'Mes commandes', aide: 'Suivi, reçus, sur tous vos téléphones', icone: PackageSearch },
            { href: '/compte/favoris', libelle: 'Favoris', aide: 'Les produits que vous gardez sous la main', icone: Heart },
            { href: '/compte/destinataires', libelle: 'Destinataires', aide: 'Vos adresses et celles de vos proches', icone: Users },
            { href: '/boutiques-suivies', libelle: 'Boutiques suivies', aide: 'Retrouvez vos boutiques préférées', icone: Store },
          ]} />
          <Liste lignes={[
            { href: '/compte/profils', libelle: 'Mes profils', aide: 'Passer d’un espace à l’autre', icone: Repeat },
            gagner,
            aide,
          ]} />
          {/* Se déconnecter : geste rare, plus le bouton le plus visible de l'écran. */}
          <Button type="button" variant="ghost" fullWidth onClick={seDeconnecter} loading={sortie}>
            <LogOut className="w-4 h-4" />Se déconnecter
          </Button>
        </>
      ) : (
        <>
          <Card className="space-y-3 text-center">
            <p className="text-sm font-bold text-slate-900">Retrouvez vos commandes sur tous vos téléphones</p>
            <p className="text-xs text-slate-500">Un compte n’est pas obligatoire pour acheter : vous pouvez commander et payer à la livraison sans compte.</p>
            <Button href="/login" size="lg" fullWidth><LogIn className="w-4 h-4" />Se connecter</Button>
            <Button href="/register?role=customer" variant="secondary" size="lg" fullWidth><UserPlus className="w-4 h-4" />Créer un compte</Button>
          </Card>
          <Liste lignes={[
            { href: '/track', libelle: 'Suivre une commande', aide: 'Avec le numéro de commande', icone: PackageSearch },
            { href: '/boutiques-suivies', libelle: 'Boutiques suivies', aide: 'Sur ce téléphone', icone: Store },
            gagner,
            aide,
          ]} />
        </>
      )}
    </PageReseau>
  );
}
