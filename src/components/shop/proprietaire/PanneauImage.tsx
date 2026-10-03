'use client';

import React, { useState } from 'react';
import Sheet from '@/components/ui/Sheet';
import SugubaLoader from '@/components/ui/SugubaLoader';
import LogoUploader from '@/components/common/LogoUploader';
import CouvertureEditeur from '@/components/reseau/CouvertureEditeur';
import { useToast } from '@/components/ui/Toast';

/**
 * Panneau « Mon logo » ou « Ma photo de couverture » de la vitrine (lot 2 du
 * chantier boutique, 2026-10-03). Un seul sujet par panneau.
 *
 * L'image est ENREGISTRÉE dès la fin de l'envoi (PATCH /api/reseller/boutique).
 * Avant, il fallait toucher « Enregistrer », placé sous quatre champs : un
 * revendeur qui quittait la page après avoir choisi son logo le perdait.
 * Enregistrement refusé : l'aperçu revient à l'image enregistrée (`key`), pour
 * ne jamais montrer comme acquise une image qui ne l'est pas.
 * Relecture du lot 2 (2026-10-03) : retrait confirmé d'abord, puisqu'il est
 * enregistré aussitôt (bouton « Retirer » de 40 px dans LogoUploader).
 *
 * Lot 7 (2026-10-03) : pour une boutique supplémentaire (formule Pro,
 * `boutiquePro`), l'image passe par l'action « modifier » de « Mes boutiques »
 * (POST /api/compte/boutiques), qui vérifie que la boutique appartient à la
 * session et applique la même liste blanche (image du dossier du compte).
 */
export type SujetImage = 'logo' | 'couverture';

export default function PanneauImage({
  sujet,
  ouvert,
  onFermer,
  valeur,
  nom,
  onEnregistre,
  boutiquePro = null,
}: {
  sujet: SujetImage;
  ouvert: boolean;
  onFermer: () => void;
  /** Image actuellement enregistrée. */
  valeur: string | null;
  /** Nom de la boutique, pour l'initiale du logo par défaut. */
  nom: string;
  /** Appelé une fois l'image enregistrée (null = retirée). */
  onEnregistre: (url: string | null) => void;
  /** Identifiant d'une boutique supplémentaire (formule Pro) ; absent : la principale. */
  boutiquePro?: string | null;
}) {
  const { toast } = useToast();
  const [envoi, setEnvoi] = useState(false);
  const [essai, setEssai] = useState(0);
  const logo = sujet === 'logo';

  const enregistrer = async (url: string | null) => {
    setEnvoi(true);
    try {
      const reponse = boutiquePro
        ? await fetch('/api/compte/boutiques', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'modifier', boutiqueId: boutiquePro, champs: { [sujet]: url } }),
        })
        : await fetch('/api/reseller/boutique', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [sujet]: url }),
        });
      const data = await reponse.json().catch(() => ({}));
      if (!reponse.ok) {
        toast(data.error || 'Enregistrement impossible.', { ton: 'erreur' });
        setEssai((n) => n + 1);
        return;
      }
      onEnregistre(url);
      toast(url ? (logo ? 'Logo enregistré.' : 'Couverture enregistrée.') : (logo ? 'Logo retiré.' : 'Couverture retirée.'), { ton: 'succes' });
      onFermer();
    } catch {
      toast('Enregistrement impossible. Vérifiez votre connexion.', { ton: 'erreur' });
      setEssai((n) => n + 1);
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <Sheet
      ouvert={ouvert}
      onFermer={onFermer}
      titre={logo ? 'Mon logo' : 'Ma photo de couverture'}
      sousTitre="Enregistré dès la fin de l’envoi."
    >
      <div className="space-y-3" aria-busy={envoi || undefined}>
        {logo ? (
          <LogoUploader key={essai} value={valeur} onChange={enregistrer} nomPourInitiale={nom} forme="carre" confirmerRetrait />
        ) : (
          <CouvertureEditeur key={essai} valeur={valeur} onChange={enregistrer} hauteur="h-28" confirmerRetrait />
        )}
        {envoi && (
          <p role="status" className="flex items-center gap-2 text-sm text-slate-600">
            <SugubaLoader className="w-4 h-4" />Enregistrement…
          </p>
        )}
        <p className="text-xs text-slate-600">
          {logo
            ? 'Une photo de vous ou votre logo. C’est ce que vos clients voient en premier.'
            : 'Une photo en largeur : votre étal, vos articles, votre quartier.'}
        </p>
      </div>
    </Sheet>
  );
}
