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

// ── Statistiques de ma boutique (lot 4 du chantier boutique, 2026-10-03) ──────
//
// Une visite de boutique (STORE_VIEW, voir /api/reseau/visite-boutique) porte
// l'empreinte salée du visiteur (meta.v) et son origine (meta.canal). Tout ce qui
// suit est calculé sur ces événements réels ; une source qui manque donne null,
// affiché « — », jamais 0.

export type OrigineVisite = 'whatsapp' | 'qr' | 'autre' | 'direct';

/** Origine d'une visite : le canal du lien suivi de la boutique, sinon « direct ». */
export function origineDeVisite(canal: string | null | undefined): OrigineVisite {
  if (!canal) return 'direct';
  if (canal === 'whatsapp' || canal === 'qr') return canal;
  return 'autre';
}

/** Périodes proposées par « Statistiques de ma boutique ». */
export const PERIODES_STATS = [7, 30] as const;

/** Début (minuit UTC) d'une période de `jours` jours qui finit aujourd'hui, comme serieParJour. */
export function debutPeriode(jours: number, maintenant: Date): Date {
  const minuit = Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth(), maintenant.getUTCDate());
  return new Date(minuit - (Math.max(1, jours) - 1) * 86400000);
}

export interface ResumeVisites {
  visites: number;
  visiteurs: number;
  serie: PointJour[];
  origine: Record<OrigineVisite, number>;
}

/** Visites, visiteurs distincts, série par jour et origine, sur les événements STORE_VIEW lus. */
export function resumeVisites(
  evenements: { occurred_at: string; meta?: Record<string, unknown> | null }[],
  jours: number,
  maintenant: Date,
): ResumeVisites {
  const origine: Record<OrigineVisite, number> = { whatsapp: 0, qr: 0, autre: 0, direct: 0 };
  const visiteurs = new Set<string>();
  for (const e of evenements) {
    const meta = e.meta || {};
    if (typeof meta.v === 'string' && meta.v) visiteurs.add(meta.v);
    const canal = meta.canal;
    origine[canal === 'whatsapp' || canal === 'qr' || canal === 'autre' ? canal : 'direct'] += 1;
  }
  return {
    visites: evenements.length,
    visiteurs: visiteurs.size,
    serie: serieParJour(evenements.map((e) => ({ date: e.occurred_at })), jours, maintenant),
    origine,
  };
}

/** Les `nombre` articles les plus vus (visites mesurées par produit), du plus vu au moins vu. */
export function plusVus(lignes: { product_id: string | null }[], nombre = 3): { id: string; vues: number }[] {
  const compte = new Map<string, number>();
  for (const l of lignes) if (l.product_id) compte.set(l.product_id, (compte.get(l.product_id) || 0) + 1);
  return Array.from(compte.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, nombre)
    .map(([id, vues]) => ({ id, vues }));
}

/**
 * Une phrase de conseil, à règles FIXES, calculée sur les chiffres affichés.
 * Jamais de conseil quand les visites ne sont pas mesurées (null).
 *
 * Relecture du lot 4 (2026-10-03) : « Vos liens WhatsApp marchent » s'affichait
 * sans regarder l'origine des visites, y compris avec « Liens WhatsApp : 0 » juste
 * en dessous. La phrase n'affirme plus que ce que montrent les chiffres : au moins
 * la moitié des visites viennent de ses liens WhatsApp. Sinon, le conseil de la
 * carte avec QR reste, sans rien affirmer sur WhatsApp.
 */
export function conseilBoutique(s: {
  visites: number | null;
  commandes: number | null;
  coupsDeCoeur?: number | null;
  origine?: Record<OrigineVisite, number> | null;
}): string | null {
  if (s.visites === null) return null;
  if (s.visites === 0) return 'Partagez votre boutique sur WhatsApp : chaque visite sera comptée ici.';
  if (s.commandes === 0) {
    return s.coupsDeCoeur === 0
      ? 'Des clients visitent votre boutique : choisissez vos coups de cœur pour les aider à choisir.'
      : 'Des clients visitent votre boutique : partagez un rayon ou vos coups de cœur pour les aider à choisir.';
  }
  if (s.origine && s.origine.qr === 0 && s.visites >= 10) {
    return s.origine.whatsapp > 0 && s.origine.whatsapp * 2 >= s.visites
      ? 'Vos liens WhatsApp marchent : imprimez aussi votre carte avec son QR pour vos clients du quartier.'
      : 'Imprimez votre carte avec son QR pour vos clients du quartier : chaque scan sera compté ici.';
  }
  return 'Continuez : partagez votre boutique chaque semaine pour garder vos clients.';
}

/**
 * Chiffres à afficher pour la période COCHÉE (relecture du lot 4, 2026-10-03).
 *
 * Après un changement de période, la page gardait les chiffres de l'ancienne
 * période sous l'étiquette de la nouvelle : pendant la lecture, et pour de bon si
 * la lecture échouait (réseau mobile), sans aucun message. Des chiffres de 7 jours
 * présentés comme ceux de 30 jours sont des chiffres inventés : un résultat ne
 * s'affiche que si sa période (`jours`, renvoyée par la route) est celle cochée ;
 * sinon la page montre le chargement ou l'erreur avec « Réessayer ».
 */
export function statsDeLaPeriode<T extends { jours: number }>(stats: T | null | undefined, jours: number): T | null {
  return stats && stats.jours === jours ? stats : null;
}
