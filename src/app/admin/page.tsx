'use client';
import { useFinance } from '@/lib/admin/useFinance';


import React from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import PageReseau from '@/components/reseau/PageReseau';
import { Card, StatCard } from '@/components/ui/Surface';
import { useSugubaStore } from '@/lib/store';
import { usePosteAdmin } from '@/components/admin/contexte';
import { TACHES, type TypeTache } from '@/lib/admin/poste';
import { formatF } from '@/lib/montant';

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

const fcfa = formatF;

export default function VueEnsemblePage() {
  const state = useSugubaStore();
  const { poste, compteurs } = usePosteAdmin();
  const pret = state.ordersSync === 'ready';

  const {data:finance,error:erreurFinance} = useFinance();
  // Arbitrage du lot 4 (audit UI/UX du 2026-10-02) : « aujourd'hui » à l'heure de Bamako (UTC).
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const { data: jour } = useFinance(aujourdhui, aujourdhui);
  const volume = finance?.volumeCree ?? 0;
  const commissions = finance ? finance.grandLivre.available + finance.grandLivre.locked : 0;
  const types = (Object.keys(DESTINATION) as TypeTache[]).filter((t) => poste?.permissions.includes(TACHES[t].permission));
  const nombre = (t: TypeTache) => compteurs?.[t] || 0;
  const enAttente = types.filter((t) => nombre(t) > 0);
  const aJour = types.filter((t) => nombre(t) === 0);

  return (
    <PageReseau titre="Vue d’ensemble" large sousTitre="Ce qui attend une action, puis les chiffres du moment.">
      {erreurFinance && <p role="alert" className="text-rose-800">{erreurFinance}</p>}

      <section className="space-y-2" aria-labelledby="titre-files">
        <div className="flex items-end justify-between gap-3">
          <h2 id="titre-files" className="text-base font-bold text-slate-900">À faire maintenant</h2>
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
          <ul className="flex flex-wrap gap-2" aria-label="Files à jour">
            {aJour.map((t) => (
              <li key={t} className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                <CheckCircle2 className="w-3.5 h-3.5 text-suguba-brand-dark" />{TACHES[t].libelle}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ADM-10 (audit UI/UX du 2026-10-02) : les chiffres viennent APRÈS ce qu'il faut
          faire ; chacun dit sa période et mène à son détail. « Appels à passer »
          répétait la file « Commande à confirmer » juste au-dessus : retiré. */}
      <section className="space-y-2" aria-labelledby="titre-jour">
        <h2 id="titre-jour" className="text-sm font-bold text-slate-900">Aujourd’hui</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatCard href="/admin/commandes" label="Commandes du jour" valeur={jour ? jour.creees : '—'}
            aide={jour ? `${fcfa(jour.volumeCree)} commandés depuis minuit` : 'Chargement…'} />
          <StatCard href="/admin/commandes?statut=delivered" label="Livrées aujourd’hui" valeur={jour ? jour.livrees : '—'}
            aide={jour ? `${fcfa(jour.volumeLivre)} livrés` : 'Chargement…'} />
          <StatCard href="/admin/commandes?statut=pending_call" label="Appels en retard" valeur={jour ? jour.appelsEnRetard : '—'}
            alerte={Boolean(jour && jour.appelsEnRetard > 0)} aide="Clients pas encore appelés après 4 h" />
        </div>
      </section>

      <section className="space-y-2" aria-labelledby="titre-chiffres">
        <h2 id="titre-chiffres" className="text-sm font-bold text-slate-900">Les chiffres</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatCard href="/admin/analytics" label="Commandes depuis l’ouverture" valeur={finance ? fcfa(volume) : '—'} aide={pret ? `${finance?.creees ?? 0} commandes passées en tout` : 'Total pas encore chargé'} />
          <StatCard href="/admin/retraits" label="Commissions dues aux revendeurs" valeur={finance ? fcfa(commissions) : '—'} aide="Retirables ou en délai de sécurité (hors retraits en cours et déjà versés)" />
          <StatCard href="/admin/retraits" label="Retraits à payer" valeur={compteurs ? nombre('retrait_a_payer') : '—'} aide="Mobile Money ou espèces, en ce moment" />
        </div>
      </section>
    </PageReseau>
  );
}
