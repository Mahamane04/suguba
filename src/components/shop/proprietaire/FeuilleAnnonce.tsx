'use client';

import React from 'react';
import { BellRing, CheckCircle2, Clock, Users } from 'lucide-react';
import Sheet from '@/components/ui/Sheet';
import Button from '@/components/ui/Button';
import BoutonPartageWhatsApp from '@/components/ui/BoutonPartageWhatsApp';
import { formatDate } from '@/lib/montant';
import {
  libelleEnvoiAnnonce, modeAnnonce, phraseDestinataires, phraseResultat, phraseSansCompte, sousTitreAnnonce, texteStatutAnnonce,
  type EtatAnnonce, type ResultatAnnonce,
} from '@/lib/annonce-boutique';

/**
 * « Prévenir mes abonnés » (lot 5 du chantier boutique, 2026-10-03) : la feuille
 * ouverte par le bouton « Prévenir mes abonnés (N nouveautés) » de « Mes articles »
 * et des Statistiques (BoutonAnnonce, qui lit l'état et envoie).
 *
 * Demande du fondateur : des outils « qui aident à vendre ». Le bouton « Suivre »
 * promettait des nouveautés que personne n'envoyait. Ici :
 *  - l'aperçu de la notification, écrite par Suguba (aucun texte libre : ni
 *    remise promise, ni prix inventé) ;
 *  - les destinataires RÉELS : « N abonnés avec un compte seront prévenus dans
 *    l'application », et ceux inscrits par téléphone, qui ne reçoivent rien ;
 *  - une seule action principale : « Prévenir mes N abonnés ». Une annonce par 24 h ;
 *  - après l'envoi : le chiffre réel des prévenus, puis « Publier sur mon statut
 *    WhatsApp », un partage MANUEL avec un texte prêt (Suguba n'écrit jamais à ses
 *    abonnés sur WhatsApp : règle anti-ban).
 *
 * Quand rien ne peut partir dans l'application (annonce de moins de 24 h, ou aucun
 * abonné avec un compte), la feuille le dit et propose seulement le statut WhatsApp.
 *
 * Relecture du lot 5 (2026-10-03) :
 *  - feuille FERMÉE, rien n'est composé. Elle est montée dès qu'un aperçu existe,
 *    et le lien du statut WhatsApp était calculé à chaque rendu : un nom d'article
 *    mal formé (emoji coupé en deux) faisait tomber « Mes articles » et les
 *    Statistiques au chargement, feuille fermée. Le message est de plus toujours
 *    bien formé (texteStatutAnnonce) ;
 *  - le sous-titre suit le mode : il promettait « dans leurs notifications
 *    Suguba » même quand aucun abonné n'a de compte.
 *
 * Composant d'affichage : l'état, l'envoi et le lien viennent de BoutonAnnonce.
 */
export default function FeuilleAnnonce({
  ouvert,
  onFermer,
  etat,
  resultat,
  envoi,
  erreur,
  onEnvoyer,
  urlStatut,
  onToucherStatut,
}: {
  ouvert: boolean;
  onFermer: () => void;
  /** Lu sur /api/reseller/boutique/annonce (GET). */
  etat: EtatAnnonce;
  /** Réponse de l'envoi ; null tant que rien n'est parti. */
  resultat: ResultatAnnonce | null;
  envoi: boolean;
  erreur: string | null;
  onEnvoyer: () => void;
  /** Lien de la boutique pour le statut WhatsApp : lien suivi /go/<code>, sinon l'adresse brute. */
  urlStatut: string;
  /** Toucher du bouton WhatsApp : dernière chance de préparer le lien suivi. */
  onToucherStatut?: () => void;
}) {
  const apercu = etat.apercu;
  if (!apercu) return null;
  const titre = 'Prévenir mes abonnés';
  // Fermée : la même feuille (elle garde son état et rend le focus), sans contenu.
  if (!ouvert) return <Sheet ouvert={false} onFermer={onFermer} titre={titre}>{null}</Sheet>;

  const mode = modeAnnonce(etat, Boolean(resultat));
  const avecCompte = etat.abonnesAvecCompte ?? 0;
  const sansCompte = phraseSansCompte(resultat ? resultat.sansCompte : etat.abonnesSansCompte);
  const possibleLe = resultat?.possibleLe ?? etat.possibleLe;
  const texteStatut = texteStatutAnnonce({ titre: apercu.titre, noms: apercu.noms, url: urlStatut });

  const notification = (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold text-slate-600">Ce que vos abonnés reçoivent</p>
      <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-3">
        <span className="mt-1.5 w-2 h-2 rounded-full shrink-0 bg-suguba-brand" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-900 break-words">{apercu.titre}</p>
          <p className="text-xs text-slate-600 mt-0.5 break-words">{apercu.texte}</p>
        </div>
      </div>
    </div>
  );

  // Partage manuel : WhatsApp s'ouvre avec ce texte, le revendeur choisit « Mon statut ».
  const statut = (
    <div className="space-y-1.5">
      <p className="text-sm text-slate-700">
        Publiez vos nouveautés sur votre statut WhatsApp : WhatsApp s’ouvre, choisissez « Mon statut ».
      </p>
      <p className="text-xs font-semibold text-slate-600">Votre message</p>
      <p className="whitespace-pre-line break-words rounded-2xl bg-slate-50 border border-slate-200 p-3 text-sm text-slate-800">{texteStatut}</p>
    </div>
  );

  const pied = mode === 'prete' ? (
    <div className="space-y-2">
      {erreur && <p role="alert" className="text-sm text-rose-700">{erreur}</p>}
      <Button type="button" fullWidth onClick={onEnvoyer} loading={envoi}>
        <BellRing className="w-4 h-4" />{libelleEnvoiAnnonce(avecCompte)}
      </Button>
    </div>
  ) : (
    <BoutonPartageWhatsApp
      fullWidth
      href={`https://api.whatsapp.com/send?text=${encodeURIComponent(texteStatut)}`}
      onPointerDown={onToucherStatut}
      libelle="Publier sur mon statut WhatsApp"
    />
  );

  return (
    <Sheet
      ouvert={ouvert}
      onFermer={onFermer}
      titre={titre}
      sousTitre={sousTitreAnnonce(mode)}
      pied={pied}
    >
      <div className="space-y-4">
        {mode === 'prete' && (
          <>
            {notification}
            <div className="flex items-start gap-3 rounded-2xl bg-suguba-sauge p-3">
              <Users className="w-5 h-5 shrink-0 text-suguba-brand-dark" aria-hidden="true" />
              <div className="min-w-0 space-y-1 text-sm">
                <p className="font-semibold text-slate-900">{phraseDestinataires(avecCompte)}</p>
                {sansCompte && <p className="text-slate-700">{sansCompte}</p>}
              </div>
            </div>
            <p className="text-xs text-slate-600">
              Une annonce par 24 h. Le texte est écrit par Suguba à partir de vos derniers articles : ni prix, ni remise.
            </p>
          </>
        )}

        {mode === 'envoyee' && resultat && (
          <>
            <div role="status" className="flex items-start gap-3 rounded-2xl bg-suguba-menthe p-3">
              <CheckCircle2 className="w-5 h-5 shrink-0 text-suguba-brand-dark" aria-hidden="true" />
              <div className="min-w-0 space-y-1 text-sm">
                <p className="font-bold text-suguba-profond">{phraseResultat(resultat.prevenus)}</p>
                {sansCompte && <p className="text-slate-800">{sansCompte}</p>}
                {possibleLe && <p className="text-slate-700">Prochaine annonce possible le {formatDate(possibleLe, 'jourHeure')}.</p>}
              </div>
            </div>
            {statut}
          </>
        )}

        {mode === 'limite' && (
          <>
            <div role="status" className="flex items-start gap-3 rounded-2xl bg-amber-50 border border-amber-200 p-3">
              <Clock className="w-5 h-5 shrink-0 text-amber-700" aria-hidden="true" />
              <p className="min-w-0 text-sm text-amber-950">
                Vous avez déjà prévenu vos abonnés : une annonce par 24 h. Prochaine annonce possible le {formatDate(possibleLe, 'jourHeure')}.
              </p>
            </div>
            {statut}
          </>
        )}

        {mode === 'sans_compte' && (
          <>
            <div role="status" className="flex items-start gap-3 rounded-2xl bg-slate-100 p-3">
              <Users className="w-5 h-5 shrink-0 text-slate-600" aria-hidden="true" />
              <div className="min-w-0 space-y-1 text-sm text-slate-800">
                <p className="font-semibold text-slate-900">Aucun de vos abonnés n’a de compte Suguba.</p>
                <p>{sansCompte ? `${sansCompte} ` : ''}Seuls les abonnés avec un compte peuvent être prévenus dans l’application.</p>
              </div>
            </div>
            {statut}
          </>
        )}
      </div>
    </Sheet>
  );
}
