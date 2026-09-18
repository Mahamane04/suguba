export interface NeighborhoodGroup {
  commune: string;
  quartiers: string[];
}

// Liste réelle des quartiers de Bamako, groupés par commune (I à VI), plus
// quelques localités périurbaines très demandées par les revendeurs
// (Kalaban-Coro, Kati, Sénou, Moribabougou sont hors Bamako intra-muros
// mais font partie du bassin de livraison habituel).
export const BAMAKO_NEIGHBORHOODS: NeighborhoodGroup[] = [
  {
    commune: 'Commune I',
    quartiers: [
      'Banconi', 'Boulkassoumbougou', 'Djélibougou', 'Doumanzana',
      'Fadjiguila', 'Korofina Nord', 'Korofina Sud', 'Sikoroni',
    ],
  },
  {
    commune: 'Commune II',
    quartiers: [
      'Bagadadji', 'Bozola', 'Grand Marché', 'Hippodrome', 'Médina-Coura',
      'Missira', "N'Tomikorobougou", 'Niaréla', 'Quinzambougou', 'TSF',
      'Zone Industrielle',
    ],
  },
  {
    commune: 'Commune III',
    quartiers: [
      'Bamako-Coura', 'Centre Commercial', 'Dar-Salam', 'Hamdallaye',
      'Point G', 'Sans-Fil',
    ],
  },
  {
    commune: 'Commune IV',
    quartiers: [
      'Djicoroni Para', 'Hamdallaye ACI 2000', 'Lafiabougou', 'Lassa',
      'Sébénicoro', 'Sotuba', 'Taliko',
    ],
  },
  {
    commune: 'Commune V',
    quartiers: [
      'Badalabougou', 'Baco-Djicoroni', 'Daoudabougou', 'Garantibougou',
      'Kalaban-Coura', 'Quartier Mali', 'Sabalibougou', 'Torokorobougou',
    ],
  },
  {
    commune: 'Commune VI',
    quartiers: [
      'Banankabougou', 'Faladié', 'Magnambougou', 'Missabougou',
      'Niamakoro', 'Sogoniko', 'Sokorodji', 'Yirimadio',
    ],
  },
  {
    commune: 'Périphérie de Bamako',
    quartiers: [
      'Kalaban-Coro', 'Kati', 'Moribabougou', 'Sénou',
    ],
  },
];

export const BAMAKO_NEIGHBORHOODS_FLAT: string[] = BAMAKO_NEIGHBORHOODS.flatMap((g) => g.quartiers);

export const DEFAULT_NEIGHBORHOOD = 'Hamdallaye ACI 2000';

/** Minuscules, sans accents ni ponctuation : « Djélibougou » = « djelibougou ». */
function normaliserNom(nom: string): string {
  return nom.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

const COMMUNE_PAR_QUARTIER = new Map<string, string>(
  BAMAKO_NEIGHBORHOODS.flatMap((g) => g.quartiers.map((q) => [normaliserNom(q), g.commune] as [string, string])),
);

/** Commune d'un quartier connu, `null` sinon. */
export function communeDuQuartier(quartier: string | null | undefined): string | null {
  if (!quartier) return null;
  return COMMUNE_PAR_QUARTIER.get(normaliserNom(quartier)) || null;
}

/**
 * Rive du fleuve Niger : les Communes V et VI sont sur la rive droite, les
 * Communes I à IV sur la rive gauche. Traverser un pont aux heures de pointe
 * coûte au livreur bien plus que la distance à vol d'oiseau ne le laisse
 * croire — c'est ce que le tarif par zones sait refléter.
 */
export function riveDeLaCommune(commune: string | null): 'gauche' | 'droite' | 'peripherie' | null {
  if (!commune) return null;
  if (commune === 'Commune V' || commune === 'Commune VI') return 'droite';
  if (commune === 'Périphérie de Bamako') return 'peripherie';
  return 'gauche';
}
