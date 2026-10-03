/**
 * Ce qu'un revendeur peut changer sur une de SES boutiques — règle PURE
 * (relecture du lot 2 du chantier boutique, 2026-10-03).
 *
 * Le lot 2 avait durci PATCH /api/reseller/boutique (images de son dossier,
 * ni recrutement ni WhatsApp, familles de l'annuaire, nom 60 et accueil 90).
 * Mais l'action « modifier » de POST /api/compte/boutiques acceptait aussi une
 * session revendeur et sa boutique PRINCIPALE, et transmettait les champs bruts
 * à majBoutique : logo pris n'importe où sur Internet, `recrute: true` (la
 * boutique apparaissait dans « Boutiques qui recrutent », publique), nom ou
 * accroche de 160 caractères. La liste blanche vit donc ICI, appliquée par les
 * deux routes.
 *
 * Sans accès à la base : les valeurs déjà enregistrées sont passées par l'appelant.
 */
import { FAMILLES_CATEGORIES } from '../product-categories';
import { nomReserve } from '../enseigne';
import { imageAutorisee } from './images-boutique';

/** Mêmes limites que les écrans (nom 60, mot d'accueil 90). */
export const NOM_BOUTIQUE_MAX = 60;
export const ACCUEIL_MAX = 90;

const FAMILLES = new Set(FAMILLES_CATEGORIES.map((f) => f.famille));

/** Espaces réduits : « Awa   Mode » et « Awa Mode » sont le même nom. */
const nomPropre = (v: unknown) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '');

export type ResultatChamps = { ok: true; champs: Record<string, unknown> } | { ok: false; erreur: string };

/**
 * Filtre ce que le navigateur envoie. Une seule valeur refusée = rien n'est écrit
 * (l'appelant n'appelle pas majBoutique).
 *
 *  - textes : nom, accroche, description, quartier (le quartier est vérifié par majBoutique) ;
 *  - nom ≤ 60, accroche ≤ 90, et jamais un nom réservé à Suguba, sauf le nom
 *    déjà enregistré (une boutique « Revendeur Suguba » doit pouvoir enregistrer
 *    son mot d'accueil, l'écran renvoie son nom tel quel) ;
 *  - logo, couverture, galerie : images du dossier boutiques/<uid>/ ou déjà en place ;
 *  - categories : familles de l'annuaire /boutiques seulement ;
 *  - recrute, whatsapp et tout autre champ : ignorés.
 */
export function champsBoutiqueRevendeur(
  source: unknown,
  contexte: {
    uid: string;
    baseSupabase: string | null | undefined;
    /** Boutique visée, telle qu'enregistrée. */
    boutique: { nom: string; logo: string | null; couverture: string | null; galerie: string[] };
  },
): ResultatChamps {
  const entree = source && typeof source === 'object' && !Array.isArray(source) ? source as Record<string, unknown> : {};
  const champs: Record<string, unknown> = {};

  for (const cle of ['nom', 'accroche', 'description', 'quartier'] as const) {
    if (cle in entree) champs[cle] = entree[cle];
  }
  if (typeof champs.nom === 'string') {
    const nom = nomPropre(champs.nom);
    if (nom.length > NOM_BOUTIQUE_MAX) return { ok: false, erreur: 'Le nom de la boutique fait 60 caractères au plus.' };
    if (nomReserve(nom) && nom !== nomPropre(contexte.boutique.nom)) {
      return { ok: false, erreur: 'Ce nom est réservé à Suguba. Choisissez le nom de votre boutique.' };
    }
  }
  if (typeof champs.accroche === 'string' && champs.accroche.trim().length > ACCUEIL_MAX) {
    return { ok: false, erreur: 'Le mot d’accueil fait 90 caractères au plus.' };
  }

  // Images : seulement celles envoyées par CE compte (dossier boutiques/<uid>/),
  // ou celles déjà enregistrées. Une seule image refusée = rien n'est écrit.
  for (const cle of ['logo', 'couverture'] as const) {
    if (!(cle in entree)) continue;
    const valeur = entree[cle];
    if (valeur === null || valeur === '') { champs[cle] = null; continue; }
    if (!imageAutorisee(valeur, contexte.uid, contexte.baseSupabase, [contexte.boutique[cle]])) {
      return { ok: false, erreur: 'Image refusée : envoyez-la depuis votre téléphone.' };
    }
    champs[cle] = valeur;
  }
  if ('galerie' in entree) {
    const galerie = entree.galerie;
    if (!Array.isArray(galerie) || !galerie.every((u) => imageAutorisee(u, contexte.uid, contexte.baseSupabase, contexte.boutique.galerie))) {
      return { ok: false, erreur: 'Photo refusée : envoyez-la depuis votre téléphone.' };
    }
    champs.galerie = galerie;
  }

  // « Ce que je vends » : familles de l'annuaire /boutiques seulement.
  if (Array.isArray(entree.categories)) {
    champs.categories = Array.from(new Set(entree.categories.filter((c): c is string => typeof c === 'string' && FAMILLES.has(c))));
  }

  return { ok: true, champs };
}
