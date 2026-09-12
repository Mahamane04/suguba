/**
 * Coordonnées des quartiers de Bamako — pour un tarif de livraison à la
 * distance réelle (2026-09-11), au lieu d'un tarif plat « Bamako ».
 *
 * Les NOMS viennent de `src/lib/bamako-neighborhoods.ts` — LA liste
 * canonique déjà utilisée partout (inscription fournisseur, revendeur,
 * diaspora, `NeighborhoodPicker`). Ce fichier n'en crée pas une deuxième :
 * il attache juste une coordonnée approximative à chacun de ces noms.
 * Une coordonnée manquante ne bloque rien — voir `trouverQuartier`.
 *
 * ⚠️ Coordonnées ESTIMÉES (centre approximatif de chaque quartier), pas
 * relevées au GPS. Suffisant pour un tarif de livraison réaliste (± quelques
 * centaines de mètres n'y change rien) ; à affiner un jour avec de vraies
 * coordonnées (relevés livreurs, Google Places…) si Suguba en obtient.
 */
import { BAMAKO_NEIGHBORHOODS_FLAT } from './bamako-neighborhoods';

interface Coord { lat: number; lng: number }

const COORDS_QUARTIERS: Record<string, Coord> = {
  // ── Commune I ──
  'Banconi': { lat: 12.6667, lng: -7.9967 },
  'Boulkassoumbougou': { lat: 12.6608, lng: -8.0092 },
  'Djélibougou': { lat: 12.6595, lng: -8.0055 },
  'Doumanzana': { lat: 12.6650, lng: -8.0150 },
  'Fadjiguila': { lat: 12.6580, lng: -8.0100 },
  'Korofina Nord': { lat: 12.6620, lng: -7.9950 },
  'Korofina Sud': { lat: 12.6580, lng: -7.9930 },
  'Sikoroni': { lat: 12.6750, lng: -8.0050 },

  // ── Commune II ──
  'Bagadadji': { lat: 12.6450, lng: -7.9950 },
  'Bozola': { lat: 12.6480, lng: -7.9980 },
  'Grand Marché': { lat: 12.6470, lng: -7.9880 },
  'Hippodrome': { lat: 12.6520, lng: -7.9900 },
  'Médina-Coura': { lat: 12.6430, lng: -7.9920 },
  'Missira': { lat: 12.6420, lng: -8.0000 },
  "N'Tomikorobougou": { lat: 12.6400, lng: -7.9930 },
  'Niaréla': { lat: 12.6470, lng: -7.9850 },
  'Quinzambougou': { lat: 12.6500, lng: -7.9870 },
  'TSF': { lat: 12.6550, lng: -7.9800 },
  'Zone Industrielle': { lat: 12.6400, lng: -7.9800 },

  // ── Commune III ──
  'Bamako-Coura': { lat: 12.6380, lng: -8.0050 },
  'Centre Commercial': { lat: 12.6440, lng: -7.9920 },
  'Dar-Salam': { lat: 12.6420, lng: -8.0080 },
  'Hamdallaye': { lat: 12.6380, lng: -8.0200 },
  'Point G': { lat: 12.6450, lng: -8.0100 },
  'Sans-Fil': { lat: 12.6350, lng: -8.0080 },

  // ── Commune IV ──
  'Djicoroni Para': { lat: 12.6200, lng: -8.0450 },
  'Hamdallaye ACI 2000': { lat: 12.6250, lng: -8.0350 },
  'Lafiabougou': { lat: 12.6350, lng: -8.0300 },
  'Lassa': { lat: 12.6150, lng: -8.0550 },
  'Sébénicoro': { lat: 12.6400, lng: -8.0450 },
  'Sotuba': { lat: 12.6550, lng: -7.9600 },
  'Taliko': { lat: 12.6300, lng: -8.0400 },

  // ── Commune V ──
  'Badalabougou': { lat: 12.6250, lng: -7.9950 },
  'Baco-Djicoroni': { lat: 12.6100, lng: -8.0100 },
  'Daoudabougou': { lat: 12.6080, lng: -7.9950 },
  'Garantibougou': { lat: 12.5980, lng: -8.0200 },
  'Kalaban-Coura': { lat: 12.5950, lng: -8.0100 },
  'Quartier Mali': { lat: 12.6050, lng: -8.0000 },
  'Sabalibougou': { lat: 12.6000, lng: -8.0150 },
  'Torokorobougou': { lat: 12.6150, lng: -8.0000 },

  // ── Commune VI ──
  'Banankabougou': { lat: 12.6100, lng: -7.9500 },
  'Faladié': { lat: 12.6050, lng: -7.9600 },
  'Magnambougou': { lat: 12.6150, lng: -7.9600 },
  'Missabougou': { lat: 12.5950, lng: -7.9450 },
  'Niamakoro': { lat: 12.5850, lng: -7.9500 },
  'Sogoniko': { lat: 12.6200, lng: -7.9700 },
  'Sokorodji': { lat: 12.6250, lng: -7.9650 },
  'Yirimadio': { lat: 12.5800, lng: -7.9300 },

  // ── Périphérie ──
  'Kalaban-Coro': { lat: 12.5700, lng: -8.0350 },
  'Kati': { lat: 12.7440, lng: -8.0720 },
  'Moribabougou': { lat: 12.7200, lng: -7.9300 },
  'Sénou': { lat: 12.5350, lng: -7.9500 },
};

// Vérification en développement seulement : un nom présent dans la liste
// canonique mais sans coordonnée retombe simplement sur le tarif plat — pas
// une erreur — donc pas besoin de bloquer le build pour ça, juste un rappel.
if (process.env.NODE_ENV !== 'production') {
  const manquants = BAMAKO_NEIGHBORHOODS_FLAT.filter((q) => !COORDS_QUARTIERS[q]);
  if (manquants.length) {
    // eslint-disable-next-line no-console
    console.warn('[bamako-quartiers] Sans coordonnée (tarif plat utilisé) :', manquants.join(', '));
  }
}

/** Recherche insensible à la casse, aux tirets et aux accents. */
function normaliser(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[-\s]+/g, ' ')
    .trim()
    .toLowerCase();
}

const INDEX_NORMALISE: Record<string, Coord> = Object.fromEntries(
  Object.entries(COORDS_QUARTIERS).map(([nom, coord]) => [normaliser(nom), coord]),
);

export function trouverQuartier(nom: string | null | undefined): Coord | null {
  if (!nom) return null;
  return INDEX_NORMALISE[normaliser(nom)] || null;
}

/**
 * Quartier connu le plus proche d'une coordonnée (2026-09-12) — pour le
 * bouton « Utiliser ma position actuelle » du sélecteur de quartier. Renvoie
 * le nom EXACT de la liste canonique (bamako-neighborhoods.ts) et la distance
 * réelle jusqu'à lui : à l'appelant de refuser une position trop éloignée de
 * Bamako (test depuis un autre pays, GPS erratique) plutôt que de proposer
 * silencieusement un quartier n'ayant aucun rapport.
 */
export function quartierLePlusProche(position: Coord): { nom: string; distanceKm: number } | null {
  let meilleur: string | null = null;
  let distanceMin = Infinity;
  for (const [nom, coord] of Object.entries(COORDS_QUARTIERS)) {
    const d = distanceKm(position, coord);
    if (d < distanceMin) { distanceMin = d; meilleur = nom; }
  }
  return meilleur ? { nom: meilleur, distanceKm: distanceMin } : null;
}

/** Distance à vol d'oiseau (km) entre deux points — formule de haversine. */
export function distanceKm(a: Coord, b: Coord): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}
