/**
 * Boutiques proches d'un quartier (2026-09-18) — logique pure, testée.
 *
 * Sert à DÉCOUVRIR les boutiques voisines (passer les voir, les suivre), pas à
 * calculer une livraison : la livraison se règle dans la fenêtre de commande.
 *
 * Ordre : même quartier d'abord, puis par distance entre les centres de
 * quartiers (coordonnées estimées, voir bamako-quartiers.ts) ; à distance
 * égale, la boutique la plus suivie passe devant. Au-delà de RAYON_KM, une
 * boutique n'est plus « à proximité » et n'est pas montrée.
 */
import { BAMAKO_NEIGHBORHOODS_FLAT, communeDuQuartier } from '../bamako-neighborhoods';
import { distanceKm, trouverQuartier } from '../bamako-quartiers';

export const RAYON_KM = 5;

export type NiveauProximite = 'quartier' | 'proche';

export interface BoutiqueLocalisable {
  quartier: string | null;
  abonnes: number;
}

export interface ResultatProximite<T> {
  boutique: T;
  niveau: NiveauProximite;
  /** Distance approximative entre centres de quartiers, arrondie à 0,5 km. */
  distanceKm: number;
}

function normaliser(nom: string): string {
  return nom.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/** Quartier de la liste canonique uniquement : « Autre quartier » ou un texte libre ne se localise pas. */
export function quartierReconnu(quartier: string | null | undefined): boolean {
  return !!communeDuQuartier(quartier) && !!trouverQuartier(quartier);
}

export function classerParProximite<T extends BoutiqueLocalisable>(
  quartierClient: string,
  boutiques: T[],
  rayonKm = RAYON_KM,
): ResultatProximite<T>[] {
  const origine = trouverQuartier(quartierClient);
  if (!origine) return [];
  const cle = normaliser(quartierClient);

  const resultats: ResultatProximite<T>[] = [];
  for (const boutique of boutiques) {
    if (!boutique.quartier) continue;
    if (normaliser(boutique.quartier) === cle) {
      resultats.push({ boutique, niveau: 'quartier', distanceKm: 0 });
      continue;
    }
    const position = trouverQuartier(boutique.quartier);
    if (!position) continue;
    const d = distanceKm(origine, position);
    if (d > rayonKm) continue;
    resultats.push({ boutique, niveau: 'proche', distanceKm: Math.max(0.5, Math.round(d * 2) / 2) });
  }

  return resultats.sort((a, b) =>
    a.distanceKm - b.distanceKm || b.boutique.abonnes - a.boutique.abonnes);
}

/**
 * Quartiers connus les plus proches d'un quartier (lui exclu) — raccourcis
 * « quartiers voisins » quand il n'y a rien près de chez le client.
 */
export function quartiersVoisins(quartier: string, nombre = 4): string[] {
  const origine = trouverQuartier(quartier);
  if (!origine) return [];
  const cle = normaliser(quartier);
  return BAMAKO_NEIGHBORHOODS_FLAT
    .filter((q) => normaliser(q) !== cle)
    .map((q) => ({ q, position: trouverQuartier(q) }))
    .filter((x): x is { q: string; position: NonNullable<ReturnType<typeof trouverQuartier>> } => !!x.position)
    .map(({ q, position }) => ({ q, d: distanceKm(origine, position) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, nombre)
    .map((x) => x.q);
}

/** « Dans votre quartier » ou « Missira · ~2 km ». */
export function libelleProximite(r: { niveau: NiveauProximite; distanceKm: number }, quartierBoutique: string): string {
  if (r.niveau === 'quartier') return 'Dans votre quartier';
  return `${quartierBoutique} · ~${String(r.distanceKm).replace('.', ',')} km`;
}
