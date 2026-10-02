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
}) {
  if (!modifie && !erreurs.length && !message && !actionDisponible) return null;
  return (
    <div className="sticky bottom-[calc(5.75rem+env(safe-area-inset-bottom,0px))] md:bottom-3 z-30 rounded-3xl bg-white/95 backdrop-blur border border-slate-200 shadow-float p-3 space-y-2">
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
      <div className="flex items-center gap-2">
        <p className="flex-1 min-w-0 text-sm text-slate-600">
          {modifie ? <strong className="text-slate-900">Non enregistré<span className="hidden sm:inline"> : vos modifications attendent</span></strong> : 'Tout est enregistré'}
        </p>
        {modifie && onAnnuler && (
          <Button type="button" variant="ghost" onClick={onAnnuler} disabled={envoi}>
            <RotateCcw className="w-4 h-4" />Annuler
          </Button>
        )}
        <Button type="button" onClick={onEnregistrer} loading={envoi} disabled={(!modifie && !actionDisponible) || bloque}>
          {libelle}
        </Button>
      </div>
      {note && <p className="text-xs text-slate-600">{note}</p>}
    </div>
  );
}
