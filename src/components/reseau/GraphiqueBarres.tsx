'use client';

import React, { useState } from 'react';
import type { PointJour } from '@/lib/reseau/stats';

/**
 * Barres verticales, une série, par jour.
 *
 * Règles appliquées (skill dataviz) : une seule couleur de marque, en vert
 * FONCÉ (#078000) car le vert d'action (#09b500) n'a que 2,7:1 de contraste
 * sur fond blanc ; extrémités arrondies de 4 px ancrées sur la ligne de base ;
 * 2 px d'écart entre barres ; grille discrète ; une seule étiquette directe
 * (le maximum) ; infobulle au survol et au toucher ; vue tableau pour qui ne
 * lit pas le graphique.
 */
export default function GraphiqueBarres({
  titre,
  points,
  unite = '',
  formater = (v) => v.toLocaleString('fr-FR'),
}: {
  titre: string;
  points: PointJour[];
  unite?: string;
  formater?: (v: number) => string;
}) {
  const [actif, setActif] = useState<number | null>(null);
  const [tableau, setTableau] = useState(false);

  const max = Math.max(1, ...points.map((p) => p.valeur));
  const iMax = points.findIndex((p) => p.valeur === max);
  const total = points.reduce((s, p) => s + p.valeur, 0);
  const L = 320;
  const H = 120;
  const pas = L / Math.max(1, points.length);
  const largeur = Math.max(2, pas - 2);
  const jourCourt = (j: string) => new Date(`${j}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

  return (
    <figure className="bg-white rounded-3xl border border-slate-200 p-4 space-y-3">
      <figcaption className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-slate-900">{titre}</p>
          <p className="text-xs text-slate-500">
            {formater(total)}{unite} sur {points.length} jours
          </p>
        </div>
        <button
          type="button"
          onClick={() => setTableau((v) => !v)}
          className="text-xs font-bold text-slate-600 underline underline-offset-2 min-h-[32px]"
        >
          {tableau ? 'Voir le graphique' : 'Voir les chiffres'}
        </button>
      </figcaption>

      {tableau ? (
        <div className="max-h-56 overflow-y-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-slate-500"><th className="text-left font-bold py-1">Jour</th><th className="text-right font-bold py-1">Valeur</th></tr></thead>
            <tbody>
              {[...points].reverse().map((p) => (
                <tr key={p.jour} className="border-t border-slate-100">
                  <td className="py-1.5 text-slate-700">{jourCourt(p.jour)}</td>
                  <td className="py-1.5 text-right text-slate-900 font-bold tabular-nums">{formater(p.valeur)}{unite}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative">
          <svg viewBox={`0 0 ${L} ${H + 18}`} className="w-full h-auto" role="img" aria-label={`${titre} : ${formater(total)}${unite} au total`}>
            {[0.5, 1].map((f) => (
              <line key={f} x1={0} x2={L} y1={H - H * f} y2={H - H * f} stroke="#e2e8f0" strokeWidth={1} strokeDasharray="2 3" />
            ))}
            <line x1={0} x2={L} y1={H} y2={H} stroke="#cbd5e1" strokeWidth={1} />
            {points.map((p, i) => {
              const h = p.valeur > 0 ? Math.max(3, (p.valeur / max) * (H - 14)) : 0;
              const x = i * pas + 1;
              return (
                <g key={p.jour}>
                  {h > 0 && (
                    <path
                      d={`M${x},${H} L${x},${H - h + 4} Q${x},${H - h} ${x + 4},${H - h} L${x + largeur - 4},${H - h} Q${x + largeur},${H - h} ${x + largeur},${H - h + 4} L${x + largeur},${H} Z`}
                      fill="#078000"
                      opacity={actif === null || actif === i ? 1 : 0.45}
                    />
                  )}
                  {/* Zone de survol plus large que la barre : visable au doigt. */}
                  <rect
                    x={i * pas} y={0} width={pas} height={H} fill="transparent"
                    onMouseEnter={() => setActif(i)} onMouseLeave={() => setActif(null)}
                    onTouchStart={() => setActif(i)}
                  />
                </g>
              );
            })}
            {iMax >= 0 && points[iMax].valeur > 0 && actif === null && (
              <text x={Math.min(L - 4, Math.max(4, iMax * pas + pas / 2))} y={H - (H - 14) - 3} textAnchor="middle" fontSize={9} fontWeight={700} fill="#334155">
                {formater(points[iMax].valeur)}
              </text>
            )}
            <text x={0} y={H + 13} fontSize={9} fill="#64748b">{jourCourt(points[0]?.jour || '')}</text>
            <text x={L} y={H + 13} fontSize={9} fill="#64748b" textAnchor="end">{jourCourt(points[points.length - 1]?.jour || '')}</text>
          </svg>
          {actif !== null && points[actif] && (
            <div
              className="absolute top-0 -translate-x-1/2 px-2.5 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-bold whitespace-nowrap pointer-events-none"
              style={{ left: `${Math.min(88, Math.max(12, ((actif + 0.5) / points.length) * 100))}%` }}
            >
              {jourCourt(points[actif].jour)} · {formater(points[actif].valeur)}{unite}
            </div>
          )}
        </div>
      )}
    </figure>
  );
}
