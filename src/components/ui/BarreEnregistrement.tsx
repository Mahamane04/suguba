'use client';

import React from 'react';
import { CheckCircle2, RotateCcw } from 'lucide-react';
import Button from '@/components/ui/Button';

/**
 * Barre d'enregistrement des réglages (ADM-13, lot 6 de l'audit UI/UX du
 * 2026-10-02).
 *
 * Les réglages de l'équipe s'enregistraient de cinq façons : barre collante
 * (Paramètres), « Publier » + « Annuler les changements » (Accueil client),
 * bouton pleine largeur (Priorité au réseau), bouton toujours actif sans
 * savoir si quelque chose avait changé (Sécurité)… Le modèle retenu est celui
 * de Paramètres : la barre n'apparaît que s'il y a quelque chose à dire, reste
 * visible pendant le défilement (au-dessus de la barre du bas sur téléphone),
 * dit « Non enregistré » ou « Tout est enregistré », propose « Annuler », et
 * son bouton n'est actif que quand une modification attend.
 *
 * `barreDuBasPermanente` (relecture du lot 2 du chantier boutique, 2026-10-03) :
 * pour les pages des rôles métier (revendeur, fournisseur, livreur), dont la
 * barre du bas reste affichée sur tablette et ordinateur. Sans elle, la barre
 * redescendait à 12 px du bas à partir de 768 px et passait dessous.
 */
export default function BarreEnregistrement({
  modifie,
  envoi = false,
  onEnregistrer,
  onAnnuler,
  libelle = 'Enregistrer les modifications',
  erreurs = [],
  message = '',
  actionDisponible,
  bloque = false,
  note,
  barreDuBasPermanente = false,
}: {
  modifie: boolean;
  envoi?: boolean;
  onEnregistrer: () => void;
  onAnnuler?: () => void;
  libelle?: string;
  erreurs?: string[];
  /** Confirmation après enregistrement (« Réglages enregistrés »). */
  message?: string;
  /** Bouton actif même sans modification (reprise d'un traitement interrompu). */
  actionDisponible?: boolean;
  /** Saisie invalide : le bouton reste inactif (une erreur du serveur, elle, n'empêche pas de réessayer). */
  bloque?: boolean;
  /** Rappel sous la barre (« Ne modifie jamais une commande déjà passée »). */
  note?: string;
  /** La barre du bas reste affichée à toutes les largeurs (rôles métier) : on reste au-dessus. */
  barreDuBasPermanente?: boolean;
}) {
  if (!modifie && !erreurs.length && !message && !actionDisponible) return null;
  const position = barreDuBasPermanente
    ? 'bottom-[calc(5.75rem+env(safe-area-inset-bottom,0px))]'
    : 'bottom-[calc(5.75rem+env(safe-area-inset-bottom,0px))] md:bottom-3';
  return (
    <div className={`sticky ${position} z-30 rounded-3xl bg-white/95 backdrop-blur border border-slate-200 shadow-float p-3 space-y-2`}>
      {erreurs.length > 0 && (
        <div role="alert" className="bg-rose-50 border border-rose-200 rounded-2xl p-2.5 text-sm text-rose-800 space-y-0.5">
          {erreurs.map((e) => <p key={e}>• {e}</p>)}
        </div>
      )}
      {message && !modifie && (
        <div role="status" className="flex items-start gap-2 bg-suguba-menthe rounded-2xl p-2.5 text-sm text-suguba-profond">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /><span>{message}</span>
        </div>
      )}
      {/* Téléphone (2026-10-03) : l'état passe sur sa propre ligne, au-dessus des
          boutons. Sur une seule ligne, « Non enregistré » était rogné par « Annuler »
          dès que le bouton principal avait un libellé long (« Enregistrer l'ordre »). */}
      <div className="flex flex-wrap items-center gap-2">
        <p className="basis-full sm:basis-0 sm:flex-1 min-w-0 text-sm text-slate-600">
          {modifie ? <strong className="text-slate-900">Non enregistré<span className="hidden sm:inline"> : vos modifications attendent</span></strong> : 'Tout est enregistré'}
        </p>
        {modifie && onAnnuler && (
          <Button type="button" variant="ghost" onClick={onAnnuler} disabled={envoi}>
            <RotateCcw className="w-4 h-4" />Annuler
          </Button>
        )}
        <Button type="button" onClick={onEnregistrer} loading={envoi} disabled={(!modifie && !actionDisponible) || bloque} className="flex-1 sm:flex-none">
          {libelle}
        </Button>
      </div>
      {note && <p className="text-xs text-slate-600">{note}</p>}
    </div>
  );
}
