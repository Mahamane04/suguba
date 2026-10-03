'use client';

import React, { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import Sheet from '@/components/ui/Sheet';
import Button from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';

/**
 * Panneau « Nom et mot d'accueil » de la vitrine (lot 2 du chantier boutique,
 * 2026-10-03) : deux champs courts (nom 60, mot d'accueil 90) et un bouton
 * Enregistrer en pied de panneau.
 *
 * Sans enseigne choisie, le champ du nom part VIDE : le nom de la boutique est
 * alors « Awa D. » (ou le nom complet sur les plus anciennes), que le revendeur
 * n'a jamais choisi. Le nom complet n'est d'ailleurs jamais envoyé au navigateur.
 * L'adresse de la boutique ne change pas quand on la renomme.
 */
export interface NomAccueil {
  nom: string;
  enseigne: boolean;
  accroche: string | null;
}

export default function PanneauNomAccueil({
  ouvert,
  onFermer,
  valeur,
  onEnregistre,
}: {
  ouvert: boolean;
  onFermer: () => void;
  valeur: NomAccueil;
  onEnregistre: (nouveau: NomAccueil) => void;
}) {
  const { toast } = useToast();
  const nomInitial = valeur.enseigne ? valeur.nom : '';
  const [nom, setNom] = useState(nomInitial);
  const [accueil, setAccueil] = useState(valeur.accroche || '');
  const [envoi, setEnvoi] = useState(false);

  // Chaque ouverture repart de ce qui est enregistré.
  useEffect(() => {
    if (!ouvert) return;
    setNom(nomInitial);
    setAccueil(valeur.accroche || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ouvert]);

  const nomPropre = nom.trim().replace(/\s+/g, ' ');
  const nomInvalide = nomPropre.length > 0 && nomPropre.length < 2;

  const enregistrer = async () => {
    const corps: Record<string, string> = {};
    if (nomPropre && nomPropre !== nomInitial) corps.nom = nomPropre;
    if (accueil.trim() !== (valeur.accroche || '').trim()) corps.accroche = accueil.trim();
    if (Object.keys(corps).length === 0) { onFermer(); return; }
    setEnvoi(true);
    try {
      const reponse = await fetch('/api/reseller/boutique', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corps),
      });
      const data = await reponse.json().catch(() => ({}));
      if (!reponse.ok) { toast(data.error || 'Enregistrement impossible.', { ton: 'erreur' }); return; }
      // Nom affiché calculé par le serveur (enseigne, ou « Awa D. »).
      const vitrine = data.vitrine && typeof data.vitrine.nom === 'string' ? data.vitrine : null;
      onEnregistre({
        nom: vitrine ? vitrine.nom : corps.nom ?? valeur.nom,
        enseigne: vitrine ? Boolean(vitrine.enseigne) : Boolean(corps.nom) || valeur.enseigne,
        accroche: data.boutique ? data.boutique.accroche ?? null : (corps.accroche ?? valeur.accroche) || null,
      });
      toast('Boutique mise à jour.', { ton: 'succes' });
      onFermer();
    } catch {
      toast('Enregistrement impossible. Vérifiez votre connexion.', { ton: 'erreur' });
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <Sheet
      ouvert={ouvert}
      onFermer={onFermer}
      titre="Nom et mot d’accueil"
      sousTitre="Ce que vos clients lisent en haut de votre boutique."
      pied={(
        <Button fullWidth onClick={enregistrer} loading={envoi} disabled={nomInvalide}>
          <Save className="w-4 h-4" />Enregistrer
        </Button>
      )}
    >
      <div className="space-y-4">
        <Field
          label="Nom de ma boutique"
          htmlFor="vitrine-nom"
          erreur={nomInvalide ? 'Au moins 2 caractères.' : undefined}
          aide={valeur.enseigne
            ? 'Votre adresse ne change pas.'
            : `Pour l’instant, vos clients lisent « La sélection de ${valeur.nom} ». Votre adresse ne change pas.`}
        >
          <Input
            id="vitrine-nom"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            maxLength={60}
            placeholder="Ex. : Chez Awa — Mode et beauté"
            autoComplete="off"
          />
        </Field>
        <Field label="Mot d’accueil" htmlFor="vitrine-accueil" aide="Une phrase courte, sous le nom (90 caractères au plus).">
          <Input
            id="vitrine-accueil"
            value={accueil}
            onChange={(e) => setAccueil(e.target.value)}
            maxLength={90}
            placeholder="Bienvenue ! Livraison partout à Bamako."
          />
        </Field>
      </div>
    </Sheet>
  );
}
