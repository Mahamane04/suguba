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
      'Bagadadji', 'Bozola', 'Hippodrome', 'Médina-Coura', 'Missira',
      "N'Tomikorobougou", 'Niaréla', 'Quinzambougou', 'TSF', 'Zone Industrielle',
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
