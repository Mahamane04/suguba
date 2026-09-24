/**
 * Guide des parcours (2026-09-19) — SERVEUR uniquement.
 *
 * Source unique : docs/guide/guide.json (pages, boutons, parcours, journal
 * des demandes) et docs/guide/captures/<id>.jpg. Ni l'un ni l'autre n'est
 * dans /public : ils ne sont servis qu'à l'administrateur général, par
 * /admin/guide et /api/admin/guide/capture/<id>.
 *
 * À chaque modification de l'application, ce fichier JSON est mis à jour
 * (voir CLAUDE.md du projet, section « Guide des parcours »).
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { verifySessionToken, type SugubaSession } from './session';
import { estAdministrateurGeneral } from './reseau/db';

export const DOSSIER_GUIDE = path.join(process.cwd(), 'docs', 'guide');

export interface ElementPage { nom: string; role: string }
export interface PageGuide {
  id: string;
  role: string;
  titre: string;
  chemin: string;
  but: string;
  elements: ElementPage[];
  suite: { id: string; libelle: string }[];
  note?: string;
  attention?: boolean;
  /** null = page décrite sans capture (voir sa note). */
  capture: { chemin: string; geste?: string } | null;
}
export interface EntreeJournal {
  date: string;
  titre: string;
  /** La demande, dans les mots de l'utilisateur. */
  demande: string;
  realise: string[];
  /** Ce qui diffère de la demande, reste à faire ou à décider. */
  ecarts: string[];
  pages: string[];
  commit?: string;
  statut: 'en ligne' | 'en local';
}
export interface BlocTexte { titre: string; points: string[]; alerte?: boolean }
export interface Guide {
  majLe: string;
  roles: { cle: string; titre: string; lettre: string; acces: string; intro: string; sessionDemo: string | null }[];
  communs: BlocTexte[];
  parcours: { titre: string; etapes: { texte: string; page?: string }[] }[];
  aSavoir: BlocTexte[];
  journal: EntreeJournal[];
  pages: PageGuide[];
}

export async function chargerGuide(): Promise<Guide> {
  return JSON.parse(await readFile(path.join(DOSSIER_GUIDE, 'guide.json'), 'utf8')) as Guide;
}

/**
 * Session de l'administrateur général, ou null. Une session d'aperçu
 * (« Tester un profil ») n'est plus une session admin : refusée aussi.
 */
export async function sessionAdministrateurGeneral(jeton: string | undefined | null): Promise<SugubaSession | null> {
  const session = await verifySessionToken(jeton);
  if (!session || session.role !== 'admin' || session.status !== 'active') return null;
  return (await estAdministrateurGeneral(session.uid)) ? session : null;
}

/** Numéros « V1 », « R4 »… dans l'ordre des pages de chaque profil. */
export function numerosDesPages(guide: Guide): Record<string, string> {
  const numeros: Record<string, string> = {};
  for (const r of guide.roles) {
    guide.pages.filter((p) => p.role === r.cle).forEach((p, i) => { numeros[p.id] = `${r.lettre}${i + 1}`; });
  }
  return numeros;
}
