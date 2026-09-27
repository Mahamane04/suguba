/**
 * Unité de vente (V2 vue client, 2026-09-27 ; élargie le même jour aux
 * habitudes des marchés de Bamako) — règles PURES, utilisables partout
 * (navigateur, serveur, tests). Mêmes règles que la base :
 * public.unite_vente_valide (A-EXECUTER-2026-09-27-unite-vente-v2.sql).
 *
 * À quoi correspond le prix ? « 24 000 F / lot de 4 », « 6 500 F / sac de
 * 50 kg », « 8 000 F / m » (bazin), « 45 000 F / pagne de 6 yards » (wax),
 * « 5 800 F / m² » (carreaux)… Sans unité renseignée (anciens produits), rien
 * n'est affiché plutôt qu'une unité devinée.
 *
 * Les quantités commandées restent des nombres ENTIERS (3 m, 12 m², 5 sacs) :
 * commandes, stock et reçus sont en entiers. `quantiteMin` impose un minimum
 * (« minimum 2 m »).
 */

export const UNITES_VENTE = [
  // À la pièce
  'unite', 'paire', 'douzaine', 'lot', 'paquet', 'carton', 'boite',
  // Tissus
  'metre', 'yard', 'pagne',
  // Surface, poids, volume
  'm2', 'kg', 'tonne', 'litre',
  // Conditionnements
  'sac', 'bidon', 'rouleau', 'barre', 'feuille', 'voyage',
] as const;
export type UniteVente = (typeof UNITES_VENTE)[number];

/** Mesure du contenu : « de 50 kg », « de 1,44 m² », « de 6 yards »… */
export const MESURES_CONTENU = ['piece', 'kg', 'l', 'm', 'm2', 'm3', 'yard'] as const;
export type MesureContenu = (typeof MESURES_CONTENU)[number];

export const FAMILLES_UNITE: { titre: string; unites: UniteVente[] }[] = [
  { titre: 'À la pièce', unites: ['unite', 'paire', 'douzaine', 'lot', 'paquet', 'carton', 'boite'] },
  { titre: 'Tissus', unites: ['metre', 'yard', 'pagne'] },
  { titre: 'Surface, poids, volume', unites: ['m2', 'kg', 'tonne', 'litre'] },
  { titre: 'Conditionnements', unites: ['sac', 'bidon', 'rouleau', 'barre', 'feuille', 'voyage'] },
];

export const LIBELLES_UNITE: Record<UniteVente, string> = {
  unite: 'À la pièce (unité)', paire: 'Par paire', douzaine: 'Par douzaine', lot: 'Par lot',
  paquet: 'Par paquet', carton: 'Par carton', boite: 'Par boîte',
  metre: 'Au mètre', yard: 'Au yard', pagne: 'Au pagne (coupon)',
  m2: 'Au m²', kg: 'Au kilo', tonne: 'À la tonne', litre: 'Au litre',
  sac: 'Au sac', bidon: 'Au bidon', rouleau: 'Au rouleau', barre: 'À la barre',
  feuille: 'À la feuille', voyage: 'Au voyage (camion)',
};

/** Nom court affiché après le prix (« / sac… », « / m² »). */
const COURT: Record<UniteVente, string> = {
  unite: 'unité', paire: 'paire', douzaine: 'douzaine', lot: 'lot', paquet: 'paquet', carton: 'carton', boite: 'boîte',
  metre: 'm', yard: 'yard', pagne: 'pagne', m2: 'm²', kg: 'kg', tonne: 'tonne', litre: 'litre',
  sac: 'sac', bidon: 'bidon', rouleau: 'rouleau', barre: 'barre', feuille: 'feuille', voyage: 'voyage',
};

export const LIBELLES_MESURE: Record<MesureContenu, string> = {
  piece: 'articles', kg: 'kg', l: 'L', m: 'm', m2: 'm²', m3: 'm³', yard: 'yards',
};

/** Mesures possibles du contenu, par unité. [] = pas de contenu. `requis` : contenu obligatoire. */
export const CONTENU_PAR_UNITE: Record<UniteVente, { mesures: MesureContenu[]; requis?: boolean; defaut?: number }> = {
  unite: { mesures: [] }, paire: { mesures: [] }, douzaine: { mesures: [] },
  lot: { mesures: ['piece'], requis: true },
  paquet: { mesures: ['piece', 'kg', 'l'] },
  carton: { mesures: ['piece', 'm2', 'kg', 'l'] },
  boite: { mesures: ['piece', 'kg', 'l'] },
  metre: { mesures: [] }, yard: { mesures: [] },
  pagne: { mesures: ['yard', 'm'], defaut: 6 },
  m2: { mesures: [] }, kg: { mesures: [] }, tonne: { mesures: [] }, litre: { mesures: [] },
  sac: { mesures: ['kg'] },
  bidon: { mesures: ['l'] },
  rouleau: { mesures: ['m', 'm2'] },
  barre: { mesures: ['m'] },
  feuille: { mesures: ['m2'] },
  voyage: { mesures: ['m3'] },
};

export function mesuresContenu(unite: UniteVente | null | undefined): MesureContenu[] {
  return unite ? CONTENU_PAR_UNITE[unite].mesures : [];
}

/** Rétro-compatibilité : l'ancien nom (contenu pour lot, paquet, carton). */
export function uniteAvecContenu(unite: UniteVente | null | undefined): boolean {
  return mesuresContenu(unite).length > 0;
}

export interface UniteNormalisee {
  unite: UniteVente | null;
  contenu: number | null;
  mesure: MesureContenu | null;
  quantiteMin: number | null;
}

/**
 * Valeurs saisies → valeurs enregistrées, ou message d'erreur.
 * `contenu` accepte la virgule (« 1,44 »). null = non renseigné.
 */
export function normaliserUniteVente(
  unite: unknown, contenu?: unknown, mesure?: unknown, quantiteMin?: unknown,
): ({ ok: true } & UniteNormalisee) | { ok: false; erreur: string } {
  let min: number | null = null;
  if (quantiteMin !== undefined && quantiteMin !== null && quantiteMin !== '') {
    const n = Number(quantiteMin);
    if (!Number.isInteger(n) || n < 1 || n > 1000) return { ok: false, erreur: 'La quantité minimale doit être un nombre entier entre 1 et 1000.' };
    min = n > 1 ? n : null;
  }
  if (unite === null || unite === undefined || unite === '') return { ok: true, unite: null, contenu: null, mesure: null, quantiteMin: min };
  if (!UNITES_VENTE.includes(unite as UniteVente)) return { ok: false, erreur: 'Unité de vente inconnue.' };
  const u = unite as UniteVente;
  const regle = CONTENU_PAR_UNITE[u];

  const brut = contenu === null || contenu === undefined ? '' : String(contenu).trim().replace(',', '.');
  if (!regle.mesures.length) return { ok: true, unite: u, contenu: null, mesure: null, quantiteMin: min };
  if (!brut) {
    if (regle.requis) return { ok: false, erreur: 'Indiquez combien d’articles contient le lot (2 ou plus).' };
    return { ok: true, unite: u, contenu: null, mesure: null, quantiteMin: min };
  }
  const m = (mesure === null || mesure === undefined || mesure === '' ? regle.mesures[0] : mesure) as MesureContenu;
  if (!regle.mesures.includes(m)) return { ok: false, erreur: 'Mesure du contenu non prévue pour cette unité.' };
  const n = Number(brut);
  if (!Number.isFinite(n) || n <= 0 || n > 100000) return { ok: false, erreur: 'Le contenu doit être un nombre positif.' };
  if (m === 'piece' && (!Number.isInteger(n) || n < 2)) return { ok: false, erreur: 'Le nombre d’articles doit être un entier de 2 ou plus.' };
  if (Math.round(n * 1000) !== n * 1000) return { ok: false, erreur: 'Trois chiffres après la virgule au plus.' };
  return { ok: true, unite: u, contenu: n, mesure: m, quantiteMin: min };
}

/** 1.44 → « 1,44 » ; 50 → « 50 ». */
function nombre(n: number): string {
  return n.toLocaleString('fr-FR', { maximumFractionDigits: 3 });
}

/** Texte à côté du prix : « / lot de 4 », « / sac de 50 kg », « / m² »… ; vide si non renseignée. */
export function suffixeUnite(unite: UniteVente | null | undefined, contenu?: number | null, mesure?: MesureContenu | null): string {
  if (!unite) return '';
  const base = `/ ${COURT[unite]}`;
  if (!contenu || !uniteAvecContenu(unite)) return base;
  const m = mesure || mesuresContenu(unite)[0];
  if (m === 'piece') return `${base} de ${nombre(contenu)}`;
  const libelle = m === 'yard' && contenu === 1 ? 'yard' : LIBELLES_MESURE[m];
  return `${base} de ${nombre(contenu)} ${libelle}`;
}

/** « Minimum : 2 m » / « Minimum : 3 sacs » ; vide sans minimum. */
export function texteMinimum(unite: UniteVente | null | undefined, quantiteMin?: number | null): string {
  if (!quantiteMin || quantiteMin < 2) return '';
  const nom = unite ? COURT[unite] : 'unité';
  const invariable = ['m', 'm²', 'kg'].includes(nom);
  return `Minimum : ${quantiteMin} ${invariable ? nom : `${nom}s`}`;
}

/** Valeurs lues en base → valeurs connues ou null. */
export function lireUniteVente(valeur: unknown): UniteVente | null {
  return UNITES_VENTE.includes(valeur as UniteVente) ? (valeur as UniteVente) : null;
}
export function lireMesure(valeur: unknown): MesureContenu | null {
  return MESURES_CONTENU.includes(valeur as MesureContenu) ? (valeur as MesureContenu) : null;
}

/**
 * Peut-on ajouter l'article au panier directement depuis la carte ? Oui pour
 * une offre simple : en stock, achat direct (pas de devis), prix fixe (au prix
 * de gros, le client choisit l'offre d'un revendeur sur la fiche), sans
 * variantes à choisir, remise par Suguba (sans étapes de prestation).
 */
export function ajoutDirectPossible(p: {
  enStock: boolean; modeCommande?: string; modePrix?: string; variantes?: boolean; modeRemise?: string;
}): boolean {
  return p.enStock && p.modeCommande !== 'devis' && p.modePrix !== 'gros' && !p.variantes && (p.modeRemise ?? 'livreur') === 'livreur';
}
