/**
 * Listes professionnelles (A4, 2026-09-27) — règles PURES.
 *
 * Tableau du catalogue : filtres, tri et colonnes autorisés (listes
 * blanches), export CSV sûr, aperçu des actions groupées. Tout ce qui touche
 * aux données passe par le serveur ; ce module décide seulement de la forme.
 */
import { normaliserUniteVente, suffixeUnite, type UniteVente, type MesureContenu } from '@/lib/unite-vente';

export const TAILLE_PAGE = 50;

export interface FiltresCatalogue {
  q: string;
  statut: '' | 'approved' | 'submitted' | 'pending' | 'rejected' | 'hidden';
  categorie: string;
  sansPhoto: boolean;
  sansUnite: boolean;
  tri: 'created_at' | 'name' | 'public_price' | 'stock' | 'supplier_name';
  sens: 'asc' | 'desc';
}

export const FILTRES_PAR_DEFAUT: FiltresCatalogue = { q: '', statut: '', categorie: '', sansPhoto: false, sansUnite: false, tri: 'created_at', sens: 'desc' };

const STATUTS = ['', 'approved', 'submitted', 'pending', 'rejected', 'hidden'] as const;
const TRIS = ['created_at', 'name', 'public_price', 'stock', 'supplier_name'] as const;

/** Paramètres d'URL / vue enregistrée → filtres sûrs (valeurs inconnues ignorées). */
export function lireFiltres(p: Record<string, unknown> | URLSearchParams): FiltresCatalogue {
  const v = (k: string) => (p instanceof URLSearchParams ? p.get(k) : (p as Record<string, unknown>)[k]);
  const texte = (x: unknown, n: number) => String(x ?? '').trim().slice(0, n).replace(/[\\%_,()]/g, ' ').replace(/\s+/g, ' ').trim();
  const oui = (x: unknown) => x === true || x === 'true' || x === '1';
  const statut = String(v('statut') ?? '');
  const tri = String(v('tri') ?? '');
  return {
    q: texte(v('q'), 60),
    statut: (STATUTS as readonly string[]).includes(statut) ? statut as FiltresCatalogue['statut'] : '',
    categorie: texte(v('categorie'), 60),
    sansPhoto: oui(v('sansPhoto')),
    sansUnite: oui(v('sansUnite')),
    tri: (TRIS as readonly string[]).includes(tri) ? tri as FiltresCatalogue['tri'] : 'created_at',
    sens: v('sens') === 'asc' ? 'asc' : 'desc',
  };
}

export interface Colonne { cle: string; titre: string; parDefaut: boolean }

export const COLONNES_CATALOGUE: Colonne[] = [
  { cle: 'nom', titre: 'Produit', parDefaut: true },
  { cle: 'categorie', titre: 'Catégorie', parDefaut: true },
  { cle: 'fournisseur', titre: 'Fournisseur', parDefaut: true },
  { cle: 'prix', titre: 'Prix', parDefaut: true },
  { cle: 'unite', titre: 'Unité', parDefaut: true },
  { cle: 'stock', titre: 'Stock', parDefaut: true },
  { cle: 'statut', titre: 'Statut', parDefaut: true },
  { cle: 'photos', titre: 'Photos', parDefaut: false },
  { cle: 'creeLe', titre: 'Créé le', parDefaut: false },
];

export function colonnesValides(demandees: unknown): string[] {
  const connues = COLONNES_CATALOGUE.map((c) => c.cle);
  const liste = Array.isArray(demandees) ? demandees.filter((c): c is string => typeof c === 'string' && connues.includes(c)) : [];
  return liste.length ? [...new Set(liste)] : COLONNES_CATALOGUE.filter((c) => c.parDefaut).map((c) => c.cle);
}

/**
 * Cellule CSV sûre : guillemets doublés, et une valeur qui commence par = + -
 * @ (formule de tableur) est neutralisée — sinon Excel l'exécuterait.
 */
export function celluleCsv(v: unknown): string {
  let t = v === null || v === undefined ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`;
  return /[";\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

/** CSV séparé par des points-virgules (Excel en français), avec BOM pour les accents. */
export function construireCsv(entetes: string[], lignes: unknown[][]): string {
  return '﻿' + [entetes, ...lignes].map((l) => l.map(celluleCsv).join(';')).join('\r\n');
}

// ── Actions groupées ────────────────────────────────────────────────────────

export type ActionGroupee = 'categorie' | 'unite';

export interface ProduitGroupe { id: string; nom: string; statut: string; typeOffre?: string | null; categorie?: string | null; uniteVente?: string | null }

export interface Apercu {
  concernes: { id: string; nom: string; avant: string; apres: string }[];
  exclus: { id: string; nom: string; raison: string }[];
  erreur?: string;
}

export const MAX_GROUPE = 500;

/**
 * Ce que ferait l'action : dossiers concernés (avant → après), dossiers exclus
 * et pourquoi. Rien n'est modifié ici. Un produit déjà dans l'état voulu est
 * exclu (« déjà à jour ») : l'action ne touche que ce qui change.
 */
export function apercuAction(produits: ProduitGroupe[], action: ActionGroupee, valeur: unknown): Apercu {
  const exclus: Apercu['exclus'] = [];
  const concernes: Apercu['concernes'] = [];
  if (action === 'categorie') {
    const cat = String(valeur ?? '').trim().replace(/\s+/g, ' ').slice(0, 60);
    if (cat.length < 2) return { concernes, exclus, erreur: 'Indiquez la nouvelle catégorie (2 caractères au moins).' };
    for (const p of produits) {
      if (p.statut === 'archived') exclus.push({ id: p.id, nom: p.nom, raison: 'Produit archivé' });
      else if ((p.categorie || '') === cat) exclus.push({ id: p.id, nom: p.nom, raison: 'Déjà dans cette catégorie' });
      else concernes.push({ id: p.id, nom: p.nom, avant: p.categorie || '—', apres: cat });
    }
    return { concernes, exclus };
  }
  const v = (valeur || {}) as Record<string, unknown>;
  const u = normaliserUniteVente(v.unite, v.contenu, v.mesure, v.quantiteMin);
  if (!u.ok) return { concernes, exclus, erreur: u.erreur };
  const apres = u.unite ? suffixeUnite(u.unite, u.contenu, u.mesure).replace('/ ', '') : 'non renseignée';
  for (const p of produits) {
    if (p.statut === 'archived') exclus.push({ id: p.id, nom: p.nom, raison: 'Produit archivé' });
    else if (p.typeOffre === 'service') exclus.push({ id: p.id, nom: p.nom, raison: 'Service : pas d’unité de vente' });
    else concernes.push({ id: p.id, nom: p.nom, avant: p.uniteVente ? suffixeUnite(p.uniteVente as UniteVente, null, null as MesureContenu | null).replace('/ ', '') : 'non renseignée', apres });
  }
  return { concernes, exclus };
}
