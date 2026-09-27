'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import PageReseau from '@/components/reseau/PageReseau';
import { Card, StatCard } from '@/components/ui/Surface';
import { useSugubaStore } from '@/lib/store';
import { usePosteAdmin } from '@/components/admin/contexte';
import { TACHES, type TypeTache } from '@/lib/admin/poste';

/**
 * Vue d'ensemble (refaite en U2, 2026-09-27).
 *
 * L'ancien tableau de bord concentrait toutes les actions (confirmer une
 * commande, attribuer un livreur, payer un retrait, débloquer une commission,
 * vérifier un livreur) ET les réglages économiques, sur une seule longue page
 * que le Support ne voyait même pas dans son menu. Chaque action a
 * maintenant sa page ; ici ne restent que les chiffres et les files, chacune
 * menant là où on la traite.
 */

/** Où traiter chaque type de dossier. */
const DESTINATION: Record<TypeTache, string> = {
  commande_a_confirmer: '/admin/commandes?statut=pending_call',
  livraison_a_attribuer: '/admin/commandes?statut=confirmed',
  retrait_a_payer: '/admin/retraits',
  versement_en_retard: '/admin/caisse-livreurs',
  validation_a_decider: '/admin/validations',
  produit_a_verifier: '/admin/products',
  verification_en_attente: '/admin/verifications',
  sav_ouvert: '/admin/sav',
  prestation_contestee: '/admin/prestations',
  message_a_verifier: '/admin/messages',
  devis_sans_reponse: '/admin/devis',
  sponsorisation_a_examiner: '/admin/sponsorisations',
};

const fcfa = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} F`;

export default function VueEnsemblePage() {
  const state = useSugubaStore();
  const { poste, compteurs } = usePosteAdmin();
  const pret = state.ordersSync === 'ready';

  const volume = state.orders.reduce((s, o) => s + o.totalAmount, 0);
  const commissions = state.commissions
    .filter((c) => c.status === 'available' || c.status === 'locked')
    .reduce((s, c) => s + c.amount, 0);

  const types = (Object.keys(DESTINATION) as TypeTache[]).filter((t) => poste?.permissions.includes(TACHES[t].permission));
  const nombre = (t: TypeTache) => compteurs?.[t] || 0;
  const enAttente = types.filter((t) => nombre(t) > 0);
  const aJour = types.filter((t) => nombre(t) === 0);

  return (
    <PageReseau titre="Vue d’ensemble" large sousTitre="Les chiffres du moment et les files qui attendent une action.">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Volume des commandes" valeur={pret ? fcfa(volume) : '—'} aide={pret ? `${state.orders.length} commandes au total` : 'Total pas encore chargé'} />
        <StatCard label="Commissions générées" valeur={fcfa(commissions)} aide="Pour le réseau de revendeurs" />
        <StatCard label="Appels à passer" valeur={compteurs ? nombre('commande_a_confirmer') : '—'} aide="Commandes à confirmer par téléphone" />
        <StatCard label="Retraits à payer" valeur={compteurs ? nombre('retrait_a_payer') : '—'} aide="Mobile Money ou espèces" />
      </div>

      <section className="space-y-2" aria-labelledby="titre-files">
        <div className="flex items-end justify-between gap-3">
          <h2 id="titre-files" className="text-sm font-bold text-slate-900">Files qui attendent une action</h2>
          <Link href="/admin/a-traiter" className="text-sm font-semibold text-suguba-profond hover:underline inline-flex items-center gap-1">Tout voir dans « À traiter »<ArrowRight className="w-4 h-4" /></Link>
        </div>
        {!compteurs ? (
          <Card padding="p-4" className="text-sm text-slate-500">Lecture des files…</Card>
        ) : enAttente.length === 0 ? (
          <Card padding="p-4" className="text-sm text-slate-700 flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-suguba-brand-dark" />Rien n’attend une action dans vos files.</Card>
        ) : (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {enAttente.map((t) => (
              <Link key={t} href={DESTINATION[t]} className="group bg-white rounded-3xl border border-slate-200 hover:border-suguba-profond p-4 flex items-center justify-between gap-3">
                <span className="min-w-0">
                  <span className="block text-2xl font-bold text-slate-900 tabular-nums">{nombre(t) >= 50 ? '50+' : nombre(t)}</span>
                  <span className="block text-sm font-semibold text-slate-800">{TACHES[t].libelle}</span>
                  <span className="block text-xs text-slate-500">{TACHES[t].action}</span>
                </span>
                <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-suguba-profond shrink-0" />
              </Link>
            ))}
          </div>
        )}
        {compteurs && aJour.length > 0 && (
          <p className="text-xs text-slate-500">À jour : {aJour.map((t) => TACHES[t].libelle.toLowerCase()).join(', ')}.</p>
        )}
      </section>
    </PageReseau>
  );
}
