/**
 * Agrégations statistiques — logique PURE.
 *
 * Une série par jour doit contenir TOUS les jours de la période, y compris
 * ceux à zéro : sinon un graphique en barres « saute » les jours sans vente et
 * trois ventes espacées d'une semaine ressemblent à trois jours consécutifs.
 */

export interface PointJour {
  /** AAAA-MM-JJ (fuseau de Bamako = UTC, voir CLAUDE.md). */
  jour: string;
  valeur: number;
}

function cleJour(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function serieParJour(
  evenements: { date: string; valeur?: number }[],
  jours: number,
  maintenant: Date,
): PointJour[] {
  const fin = new Date(Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth(), maintenant.getUTCDate()));
  const serie: PointJour[] = [];
  const index = new Map<string, number>();
  for (let i = jours - 1; i >= 0; i--) {
    const d = new Date(fin.getTime() - i * 86400000);
    index.set(cleJour(d), serie.length);
    serie.push({ jour: cleJour(d), valeur: 0 });
  }
  for (const e of evenements) {
    const t = new Date(e.date);
    if (!Number.isFinite(t.getTime())) continue;
    const i = index.get(cleJour(t));
    if (i === undefined) continue;
    serie[i].valeur += e.valeur ?? 1;
  }
  return serie;
}

/** Retour sur investissement d'une sponsorisation, en FCFA de CA par FCFA dépensé. null si rien n'a été dépensé. */
export function retourSurInvestissement(chiffreAffaires: number, budget: number): number | null {
  if (!budget || budget <= 0) return null;
  return Math.round((chiffreAffaires / budget) * 10) / 10;
}

/** Évolution en % entre deux périodes. null quand la période de référence est vide (division par zéro). */
export function evolution(actuel: number, precedent: number): number | null {
  if (!precedent) return null;
  return Math.round(((actuel - precedent) / precedent) * 100);
}
