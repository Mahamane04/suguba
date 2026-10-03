'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Coins, Eye, Lightbulb, MousePointerClick, QrCode, ShoppingBag, Store, Users } from 'lucide-react';
import PageReseau from '@/components/reseau/PageReseau';
import GraphiqueBarres from '@/components/reseau/GraphiqueBarres';
import Button from '@/components/ui/Button';
import BoutonPartageWhatsApp from '@/components/ui/BoutonPartageWhatsApp';
import WhatsAppIcon from '@/components/ui/WhatsAppIcon';
import { Card, EmptyState, Skeleton, StatCard, StatusPill } from '@/components/ui/Surface';
import PartageBoutique from '@/components/shop/proprietaire/PartageBoutique';
import { formatF, formatNombre, formatDate } from '@/lib/montant';
import { PORTE_MA_BOUTIQUE } from '@/lib/reseau/porte-boutique';
import { PERIODES_STATS, statsDeLaPeriode, type OrigineVisite, type PointJour } from '@/lib/reseau/stats';

/**
 * Statistiques de ma boutique (lot 4 du chantier boutique, 2026-10-03).
 *
 * Demande du fondateur : des outils pour gérer sa boutique, « et ce qui aide à
 * vendre ». Le revendeur ne savait pas si quelqu'un ouvrait sa boutique. Ici,
 * sur 7 ou 30 jours, des chiffres VRAIS (route privée /api/reseller/boutique/stats) :
 *  - visites (vrai navigateur, 2 s de page visible, hors propriétaire et robots,
 *    un visiteur une fois par jour), par jour et par origine ;
 *  - commandes à votre nom (tous vos liens : le premier revendeur garde son
 *    client 30 jours, on ne prétend pas savoir lesquelles viennent de la boutique) ;
 *  - gains des ventes livrées (formatF) ;
 *  - abonnés, clics des liens de la boutique, 3 articles les plus vus ;
 *  - une phrase de conseil à règles fixes et « mesuré depuis le … ».
 * Une mesure indisponible s'affiche « — », jamais 0. Action principale : partager.
 */

interface Stats {
  jours: number;
  boutique: { slug: string; nom: string; enseigne: boolean; statut: string } | null;
  visites: number | null;
  visiteurs: number | null;
  serie: PointJour[] | null;
  origine: Record<OrigineVisite, number> | null;
  clics: number | null;
  commandes: number | null;
  livrees: number | null;
  gains: number | null;
  abonnes: number | null;
  nouveauxAbonnes: number | null;
  articlesVus: { nom: string; vues: number }[] | null;
  mesureDepuis: string | null;
  conseil: string | null;
}

const ORIGINES: { cle: OrigineVisite; libelle: string; icone: React.ElementType }[] = [
  { cle: 'whatsapp', libelle: 'Liens WhatsApp', icone: WhatsAppIcon },
  { cle: 'qr', libelle: 'QR code', icone: QrCode },
  { cle: 'autre', libelle: 'Autres liens', icone: MousePointerClick },
  { cle: 'direct', libelle: 'Adresse directe', icone: Store },
];

const nombre = (v: number | null | undefined) => (v == null ? '—' : formatNombre(v));
const pluriel = (n: number | null | undefined, mot: string) => `${mot}${n != null && n > 1 ? 's' : ''}`;

export default function StatistiquesBoutiquePage() {
  const [jours, setJours] = useState<number>(7);
  // Dernière réponse reçue, de N'IMPORTE QUELLE période (relecture du lot 4) :
  // seule celle de la période cochée s'affiche (statsDeLaPeriode, plus bas).
  const [lues, setLues] = useState<Stats | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(false);
  const [partage, setPartage] = useState(false);

  const charger = useCallback(async (periode: number, signal?: AbortSignal) => {
    setChargement(true);
    setErreur(false);
    try {
      const r = await fetch(`/api/reseller/boutique/stats?jours=${periode}`, { cache: 'no-store', signal });
      const d = await r.json().catch(() => null);
      if (!r.ok || !d) { setErreur(true); return; }
      setLues(d as Stats);
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') setErreur(true);
    } finally {
      if (!signal?.aborted) setChargement(false);
    }
  }, []);

  useEffect(() => {
    const controle = new AbortController();
    charger(jours, controle.signal);
    return () => controle.abort();
  }, [jours, charger]);

  // Relecture du lot 4 (2026-10-03) : après un changement de période, les chiffres de
  // l'ancienne période restaient affichés sous la nouvelle étiquette, et pour de bon
  // si la lecture échouait (le message d'erreur n'apparaissait que sans aucun
  // chiffre). Ils ne s'affichent plus que pour la période cochée : sinon le
  // chargement, ou l'erreur avec « Réessayer ».
  const stats = statsDeLaPeriode(lues, jours);
  // La boutique ne dépend pas de la période : l'action « Partager » reste en place.
  const boutique = lues?.boutique ?? null;
  const enLigne = boutique?.statut === 'active';

  return (
    <PageReseau
      titre="Statistiques de ma boutique"
      sousTitre="Ce que votre boutique attire, mesuré par Suguba."
      retour={{ href: PORTE_MA_BOUTIQUE, libelle: 'Ma boutique' }}
      action={enLigne ? (
        <BoutonPartageWhatsApp type="button" size="sm" libelle="Partager ma boutique"
          aria-haspopup="dialog" onClick={() => setPartage(true)} />
      ) : undefined}
    >
      <div role="radiogroup" aria-label="Période" className="grid grid-cols-2 gap-2">
        {PERIODES_STATS.map((p) => (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={jours === p}
            onClick={() => setJours(p)}
            className={`min-h-11 rounded-full text-sm font-semibold transition-colors ${jours === p ? 'bg-suguba-profond text-white' : 'bg-white border border-slate-200 text-suguba-profond hover:bg-suguba-sauge'}`}
          >
            {p} derniers jours
          </button>
        ))}
      </div>

      {chargement && !stats ? (
        <div className="space-y-3"><Skeleton className="h-24" /><Skeleton className="h-40" /><Skeleton className="h-32" /></div>
      ) : erreur && !stats ? (
        <EmptyState erreur titre="Vos statistiques n’ont pas pu être lues" texte="Vérifiez votre réseau, puis réessayez." onReessayer={() => charger(jours)} />
      ) : stats && !boutique ? (
        <EmptyState
          icone={Store}
          titre="Votre boutique n’est pas encore ouverte"
          texte="Ouvrez-la : chaque visite y sera comptée ici."
          action={<Button href={PORTE_MA_BOUTIQUE}><Store className="w-4 h-4" />Ouvrir ma boutique</Button>}
        />
      ) : stats ? (
        <div className={`space-y-4 transition-opacity ${chargement ? 'opacity-60' : ''}`} aria-busy={chargement || undefined}>
          {!enLigne && (
            <div role="status" className="rounded-2xl bg-amber-50 border border-amber-200 p-3 space-y-1">
              <StatusPill ton="attente">Masquée par Suguba</StatusPill>
              <p className="text-sm text-amber-950">Votre boutique n’est plus visible par vos clients : elle ne reçoit plus de visites.</p>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <StatCard label="Visites" valeur={nombre(stats.visites)} icone={Eye} accent
              aide={stats.visiteurs != null ? `${formatNombre(stats.visiteurs)} ${pluriel(stats.visiteurs, 'personne')} ${pluriel(stats.visiteurs, 'différente')}` : undefined} />
            <StatCard label="Commandes à votre nom" valeur={nombre(stats.commandes)} icone={ShoppingBag}
              aide={`Tous vos liens, pas seulement la boutique${stats.livrees != null ? ` · ${formatNombre(stats.livrees)} ${pluriel(stats.livrees, 'livrée')}` : ''}`} />
            <div className="col-span-2 sm:col-span-1">
              <StatCard label="Gains des ventes livrées" valeur={formatF(stats.gains)} icone={Coins} />
            </div>
          </div>

          {stats.conseil && (
            <Card padding="p-4" className="flex items-start gap-3">
              <Lightbulb className="w-5 h-5 shrink-0 text-suguba-brand-dark" aria-hidden="true" />
              <p className="text-sm text-slate-800">{stats.conseil}</p>
            </Card>
          )}

          {stats.serie ? (
            <GraphiqueBarres titre="Visites par jour" points={stats.serie} />
          ) : (
            <Card padding="p-4"><p className="text-sm text-slate-600">Visites par jour : mesure indisponible pour le moment (—).</p></Card>
          )}

          <Card padding="px-4 pt-4 pb-2" className="space-y-1">
            <h2 className="text-sm font-bold text-slate-900">D’où viennent vos visites</h2>
            <ul className="divide-y divide-slate-100">
              {ORIGINES.map(({ cle, libelle, icone: Icone }) => (
                <li key={cle} className="flex items-center justify-between gap-3 min-h-11 text-sm">
                  <span className="inline-flex items-center gap-2 text-slate-700"><Icone className="w-4 h-4 text-suguba-brand-dark" aria-hidden="true" />{libelle}</span>
                  <strong className="tabular-nums text-slate-900">{nombre(stats.origine ? stats.origine[cle] : null)}</strong>
                </li>
              ))}
              <li className="flex items-center justify-between gap-3 min-h-11 text-sm">
                <span className="inline-flex items-center gap-2 text-slate-700"><MousePointerClick className="w-4 h-4 text-suguba-brand-dark" aria-hidden="true" />Clics sur vos liens de boutique</span>
                <strong className="tabular-nums text-slate-900">{nombre(stats.clics)}</strong>
              </li>
            </ul>
          </Card>

          <Card padding="p-4" className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 text-sm text-slate-700"><Users className="w-4 h-4 text-suguba-brand-dark" aria-hidden="true" />Abonnés</span>
            <span className="text-sm text-slate-600 text-right">
              <strong className="text-base text-slate-900 tabular-nums">{nombre(stats.abonnes)}</strong>
              {stats.nouveauxAbonnes != null && <> · <span className="tabular-nums">+{formatNombre(stats.nouveauxAbonnes)}</span> sur la période</>}
            </span>
          </Card>

          <Card padding="px-4 pt-4 pb-2" className="space-y-1">
            <h2 className="text-sm font-bold text-slate-900">Vos articles les plus vus</h2>
            <p className="text-xs text-slate-600">Ouverts par vos liens, sur la période.</p>
            {stats.articlesVus === null ? (
              <p className="py-2 text-sm text-slate-600">— Mesure indisponible pour le moment.</p>
            ) : stats.articlesVus.length === 0 ? (
              <p className="py-2 text-sm text-slate-600">Aucun article vu par vos liens sur la période.</p>
            ) : (
              <ol className="divide-y divide-slate-100">
                {stats.articlesVus.map((a, i) => (
                  <li key={`${a.nom}-${i}`} className="flex items-center justify-between gap-3 min-h-11 text-sm">
                    <span className="min-w-0 truncate text-slate-800"><span className="text-slate-500 tabular-nums">{i + 1}.</span> {a.nom}</span>
                    <span className="shrink-0 text-slate-600 tabular-nums">{formatNombre(a.vues)} {pluriel(a.vues, 'vue')}</span>
                  </li>
                ))}
              </ol>
            )}
          </Card>

          <p className="text-xs text-slate-600 px-1">
            {stats.mesureDepuis
              ? <>Visites mesurées depuis le {formatDate(stats.mesureDepuis, 'complet')}. </>
              : <>Aucune visite mesurée pour l’instant. </>}
            Une visite = un client qui reste au moins 2 secondes sur votre boutique ; vous-même et les aperçus de liens ne sont pas comptés, et un même client compte une fois par jour.
            {/* Relecture du lot 4 (2026-10-03) : /r/<code> affiche la même vitrine sans
                la mesurer (canonical sans redirection, décision du fondateur). Le dire
                évite qu'un revendeur qui partage encore son ancien lien croie à zéro visiteur. */}
            {' '}Les clients venus par votre ancien lien de boutique (adresse en /r/…) ne sont pas comptés.
          </p>
        </div>
      ) : null}

      {boutique && enLigne && (
        <PartageBoutique
          ouvert={partage}
          onFermer={() => setPartage(false)}
          boutique={{ nom: boutique.nom, enseigne: boutique.enseigne, slug: boutique.slug, statut: boutique.statut }}
        />
      )}
    </PageReseau>
  );
}
