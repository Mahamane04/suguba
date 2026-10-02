import React from 'react';

/**
 * Ligne de liste commune (lot 3 de l'audit UI/UX du 2026-10-02) : le texte se
 * replie, le montant ne se coupe jamais, le statut se range sous le montant.
 *
 * Sans elle, chaque liste refaisait sa mise en page : chez le livreur, « 24 950 F
 * Payé en ligne » se cassait sur cinq lignes (colonne de droite compressible) ;
 * chez le fournisseur, la pastille de statut écrasait le titre et le montant.
 */
export default function LigneListe({ visuel, titre, meta, valeur, statut, action }: {
  /** Vignette ou icône, à gauche. */
  visuel?: React.ReactNode;
  titre: React.ReactNode;
  /** Ligne secondaire : numéro, lieu, date. */
  meta?: React.ReactNode;
  /** Montant, à droite, jamais coupé. */
  valeur?: React.ReactNode;
  /** Statut court sous le montant (texte ou pastille). */
  statut?: React.ReactNode;
  /** Bouton éventuel, tout à droite. */
  action?: React.ReactNode;
}) {
  return (
    <div className="py-3 flex items-center gap-3">
      {visuel && <div className="shrink-0">{visuel}</div>}
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-sm text-slate-900 truncate">{titre}</p>
        {meta && <p className="text-xs text-slate-600 truncate">{meta}</p>}
      </div>
      {(valeur != null || statut) && (
        <div className="text-right shrink-0">
          {valeur != null && <p className="text-sm font-bold text-slate-900 tabular-nums whitespace-nowrap">{valeur}</p>}
          {statut && <div className="text-xs font-semibold whitespace-nowrap">{statut}</div>}
        </div>
      )}
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
