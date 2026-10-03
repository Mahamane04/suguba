'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BellRing } from 'lucide-react';
import Button from '@/components/ui/Button';
import FeuilleAnnonce from '@/components/shop/proprietaire/FeuilleAnnonce';
import {
  annonceAProposer, libelleBoutonAnnonce, modeAnnonce, type EtatAnnonce, type ResultatAnnonce,
} from '@/lib/annonce-boutique';

/**
 * Bouton « Prévenir mes abonnés (N nouveautés) » (lot 5 du chantier boutique,
 * 2026-10-03), posé dans « Mes articles » et dans les Statistiques.
 *
 * Il n'apparaît que « quand il y a lieu » : des articles ajoutés à la boutique
 * depuis la dernière annonce ET au moins un abonné. L'état vient de la route
 * PRIVÉE /api/reseller/boutique/annonce (GET, lecture seule : la boutique est
 * celle de la session) ; tant qu'il n'est pas lu, ou si la lecture échoue
 * (boutique masquée, journal indisponible), rien ne s'affiche : jamais un bouton
 * qui ne mènerait à rien.
 *
 * L'envoi est un POST SANS CORPS : le texte, les articles et les destinataires
 * sont décidés par le serveur. Une seule requête à la fois. Après l'envoi, le
 * bouton disparaît (il n'y a plus de nouveauté à annoncer) et la feuille montre
 * le résultat réel.
 *
 * Statut WhatsApp : le lien est le lien suivi de la boutique (/go/<code>, le même
 * que « Partager ma boutique » sur WhatsApp), préparé seulement quand la feuille
 * propose le statut ; s'il n'est pas prêt, l'adresse de la boutique.
 */
export default function BoutonAnnonce({
  rafraichir,
  className = '',
}: {
  /** Change quand la boutique change à l'écran (article retiré) : l'état est relu. */
  rafraichir?: string | number;
  className?: string;
}) {
  const [etat, setEtat] = useState<EtatAnnonce | null>(null);
  const [ouvert, setOuvert] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const verrou = useRef(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [resultat, setResultat] = useState<ResultatAnnonce | null>(null);
  const [lienSuivi, setLienSuivi] = useState<string | null>(null);
  const lienDemande = useRef(false);

  useEffect(() => {
    let annule = false;
    fetch('/api/reseller/boutique/annonce', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (annule) return;
        setEtat(d && typeof d.nouveautes === 'number' ? d as EtatAnnonce : null);
        // État relu (article retiré) : le résultat d'un envoi précédent n'a plus cours.
        setResultat(null);
      })
      .catch(() => { if (!annule) setEtat(null); });
    return () => { annule = true; };
  }, [rafraichir]);

  const envoyer = async () => {
    if (verrou.current) return; // une seule requête à la fois
    verrou.current = true;
    setEnvoi(true);
    setErreur(null);
    try {
      const r = await fetch('/api/reseller/boutique/annonce', { method: 'POST', cache: 'no-store' });
      const d = await r.json().catch(() => ({}));
      if (r.ok && typeof d.prevenus === 'number') { setResultat(d as ResultatAnnonce); return; }
      // Une annonce est déjà partie (autre onglet, autre téléphone) : la feuille
      // l'explique et donne l'heure de la prochaine.
      if (r.status === 429 && typeof d.possibleLe === 'string') setEtat((e) => (e ? { ...e, possibleLe: d.possibleLe } : e));
      // Plus aucun abonné avec un compte depuis la lecture : la feuille propose le statut WhatsApp.
      else if (r.status === 409 && 'sansCompte' in d) {
        setEtat((e) => (e ? { ...e, abonnesAvecCompte: 0, abonnesSansCompte: typeof d.sansCompte === 'number' ? d.sansCompte : e.abonnesSansCompte } : e));
      }
      setErreur(typeof d.error === 'string' && d.error ? d.error : 'Envoi impossible. Réessayez.');
    } catch {
      setErreur('Connexion impossible. Vérifiez votre réseau, puis réessayez.');
    } finally {
      verrou.current = false;
      setEnvoi(false);
    }
  };

  /** Lien suivi de la boutique (canal WhatsApp), réutilisé s'il existe déjà. Un échec laisse l'adresse brute. */
  const preparerLien = useCallback(() => {
    if (lienDemande.current) return;
    lienDemande.current = true;
    fetch('/api/reseller/boutique/partage', {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ canal: 'whatsapp' }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((d) => {
        if (typeof d?.url === 'string' && d.url) setLienSuivi(d.url);
        else lienDemande.current = false; // nouvel essai au prochain toucher
      });
  }, []);

  // Le lien n'est préparé que si la feuille propose le statut WhatsApp (après
  // l'envoi, annonce de moins de 24 h, aucun abonné avec un compte) : ouvrir la
  // feuille pour lire l'aperçu ne crée rien.
  const statutPropose = Boolean(ouvert && etat?.apercu && modeAnnonce(etat, Boolean(resultat)) !== 'prete');
  useEffect(() => { if (statutPropose) preparerLien(); }, [statutPropose, preparerLien]);

  if (!etat?.apercu) return null;
  // Adresse brute : origine lue seulement dans le navigateur (feuille fermée au rendu serveur).
  const brute = typeof window !== 'undefined' ? `${window.location.origin}${etat.apercu.lien}` : etat.apercu.lien;

  return (
    <>
      {annonceAProposer(etat) && !resultat && (
        <Button type="button" variant="secondary" fullWidth className={className} aria-haspopup="dialog"
          onClick={() => { setErreur(null); setOuvert(true); }}>
          <BellRing className="w-4 h-4 shrink-0" />{libelleBoutonAnnonce(etat.nouveautes)}
        </Button>
      )}
      <FeuilleAnnonce
        ouvert={ouvert}
        onFermer={() => setOuvert(false)}
        etat={etat}
        resultat={resultat}
        envoi={envoi}
        erreur={erreur}
        onEnvoyer={envoyer}
        urlStatut={lienSuivi || brute}
        onToucherStatut={preparerLien}
      />
    </>
  );
}
