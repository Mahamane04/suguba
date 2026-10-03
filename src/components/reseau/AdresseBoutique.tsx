'use client';

import React, { useState } from 'react';
import { Link2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { Card, StatusPill } from '@/components/ui/Surface';
import { useToast } from '@/components/ui/Toast';
import { ADRESSE_INDISPONIBLE, adresseDepuis, adresseProposee, refusAdresse } from '@/lib/adresse-boutique';

/**
 * « Adresse de ma boutique » (lot 8 du chantier boutique, 2026-10-03) — section de
 * « Personnaliser ma boutique », rendue seulement quand la base le permet
 * (`options.adresse` de GET /api/reseller/boutique).
 *
 * Décision du fondateur : le revendeur peut donner à sa boutique une adresse à son
 * enseigne, UNE seule fois. Beaucoup ont une adresse tirée de leur nom complet
 * (/boutique/prenom-nom), attribuée au premier accès.
 *
 *  - le champ accepte ce que le revendeur tape (« Awa Mode ») ; l'APERÇU montre
 *    l'adresse exacte qui sera enregistrée (« …/boutique/awa-mode »), calculée par
 *    les mêmes règles que le serveur (src/lib/adresse-boutique.ts) ;
 *  - l'avertissement est écrit avant le bouton, puis redit dans la confirmation :
 *    une seule fois, sans retour ; l'ancienne adresse et les QR codes déjà
 *    partagés continuent d'ouvrir la boutique ;
 *  - « Changer mon adresse » vérifie d'abord que l'adresse est libre (GET), demande
 *    confirmation, puis seulement change (POST). Le serveur revérifie tout : la
 *    boutique et son propriétaire viennent de la session, jamais de cette page.
 *
 * Une fois le changement fait, la section le dit et ne propose plus rien.
 */
export default function AdresseBoutique({
  origine,
  actuelle,
  ancienne,
  nomPublic,
  onChange,
}: {
  /** « https://app.sugubaml.com » : pour écrire l'adresse comme les clients la tapent. */
  origine: string;
  /** Adresse actuelle de la boutique (son slug). */
  actuelle: string;
  /** Adresse d'avant le changement, s'il a déjà eu lieu. */
  ancienne: string | null;
  /** Nom que voient les clients (l'enseigne, ou « Awa D. ») : il donne l'adresse proposée. */
  nomPublic: string | null;
  /** Changement enregistré : la page met à jour son lien, son QR et l'adresse affichée. */
  onChange: (nouvelle: string, ancienne: string) => void;
}) {
  const { toast, confirmer } = useToast();
  const [saisie, setSaisie] = useState(() => adresseProposee(nomPublic, actuelle));
  const [envoi, setEnvoi] = useState(false);
  const [erreurServeur, setErreurServeur] = useState('');

  const hote = origine.replace(/^https?:\/\//, '');
  const titre = (
    <p className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
      <Link2 className="w-4 h-4 text-suguba-brand-dark" aria-hidden="true" />Adresse de ma boutique
    </p>
  );

  if (ancienne) {
    return (
      <Card id="adresse" className="space-y-2 scroll-mt-24">
        {titre}
        <p className="text-sm font-semibold text-slate-900 break-all">{hote}/boutique/{actuelle}</p>
        <StatusPill ton="succes">Adresse changée</StatusPill>
        <p className="text-xs text-slate-600">
          Votre ancienne adresse (<span className="break-all">{hote}/boutique/{ancienne}</span>) et vos QR codes déjà partagés ouvrent toujours votre boutique.
          Ce changement n’était possible qu’une fois.
        </p>
      </Card>
    );
  }

  const apercu = adresseDepuis(saisie);
  const refus = saisie.trim() ? refusAdresse(apercu, actuelle) : null;
  const erreur = refus || erreurServeur || undefined;

  const changer = async () => {
    if (!apercu || refus || envoi) return;
    setEnvoi(true);
    setErreurServeur('');
    try {
      // 1. L'adresse est-elle libre ? Rien n'est réservé : le serveur revérifie au changement.
      const lecture = await fetch(`/api/reseller/boutique/adresse?adresse=${encodeURIComponent(apercu)}`, { cache: 'no-store' });
      const etat = await lecture.json().catch(() => ({}));
      if (!lecture.ok || !etat.demande) { setErreurServeur(etat.error || ADRESSE_INDISPONIBLE); return; }
      if (etat.demande.etat !== 'libre' || etat.demande.adresse !== apercu) {
        setErreurServeur(etat.demande.message || ADRESSE_INDISPONIBLE);
        return;
      }
      // 2. Changement unique et sans retour : toujours confirmé, conséquence annoncée.
      const accord = await confirmer({
        titre: 'Changer l’adresse de votre boutique ?',
        message: `Nouvelle adresse : ${hote}/boutique/${apercu}\n\nVous ne pourrez plus la changer ensuite, ni revenir à l’ancienne. Votre ancienne adresse et vos QR codes déjà partagés continueront d’ouvrir votre boutique.`,
        confirmer: 'Changer',
        annuler: 'Garder l’actuelle',
        danger: true,
      });
      if (!accord) return;
      // 3. Le changement. Seule l'adresse confirmée est envoyée.
      const reponse = await fetch('/api/reseller/boutique/adresse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adresse: apercu }),
      });
      const data = await reponse.json().catch(() => ({}));
      if (!reponse.ok || typeof data.adresse !== 'string') { setErreurServeur(data.error || ADRESSE_INDISPONIBLE); return; }
      toast('Adresse changée. L’ancienne mène toujours à votre boutique.', { ton: 'succes' });
      onChange(data.adresse, typeof data.ancienne === 'string' ? data.ancienne : actuelle);
    } catch {
      setErreurServeur('Changement impossible. Vérifiez votre connexion.');
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <Card id="adresse" className="space-y-4 scroll-mt-24">
      <div>
        {titre}
        <p className="text-xs text-slate-600 mt-0.5">
          Donnez à votre boutique une adresse à son nom. Aujourd’hui : <span className="font-semibold text-slate-900 break-all">{hote}/boutique/{actuelle}</span>
        </p>
      </div>

      <Field label="Nouvelle adresse" htmlFor="adresse-boutique" erreur={erreur}
        aide="Le nom de votre boutique, en lettres, chiffres et tirets. Ex. : awa-mode">
        <Input id="adresse-boutique" value={saisie} maxLength={60} placeholder="awa-mode"
          autoCapitalize="none" autoCorrect="off" spellCheck={false} disabled={envoi}
          onChange={(e) => { setSaisie(e.target.value); setErreurServeur(''); }} />
      </Field>

      {apercu && !refus && (
        <p role="status" className="rounded-2xl bg-suguba-sauge px-3.5 py-2.5 text-xs text-slate-700">
          Vos clients ouvriront : <strong className="block text-sm text-suguba-profond break-all">{hote}/boutique/{apercu}</strong>
        </p>
      )}

      <div role="note" className="rounded-2xl bg-amber-50 border border-amber-200 px-3.5 py-2.5 space-y-1 text-sm text-amber-950">
        <p><strong>Une seule fois.</strong> Vous ne pourrez plus changer d’adresse ensuite, ni revenir à l’ancienne.</p>
        <p>Votre ancienne adresse et vos QR codes déjà partagés continuent d’ouvrir votre boutique.</p>
      </div>

      <Button type="button" variant="ghost" fullWidth loading={envoi} disabled={!apercu || Boolean(refus)} onClick={changer}>
        Changer mon adresse
      </Button>
    </Card>
  );
}
