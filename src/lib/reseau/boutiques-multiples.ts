/**
 * Plusieurs boutiques par compte et formules Pro (2026-09-24) — SERVEUR.
 *
 * Version gratuite : une seule boutique (la principale, qui existait déjà).
 * Les formules Pro, réglées par l'admin (Réglages économiques › Formules
 * boutiques), débloquent des boutiques supplémentaires : 1 500 F/mois pour 2,
 * 5 000 F/mois pour 5 au lancement. Une formule est DEMANDÉE par le revendeur
 * ou le fournisseur, payée par Mobile Money avec une référence, puis ACTIVÉE
 * par l'admin pour une durée (1 mois) — jamais activée par le navigateur.
 *
 * Une boutique supplémentaire a sa propre sélection d'articles
 * (store_products) ; la principale garde son fonctionnement historique.
 */
import { randomBytes } from 'node:crypto';
import { getSupabaseAdmin } from '../supabase-admin';
import { slugifier } from '../shop';
import { chargerReglages } from '../platform-settings';
import { FORMULES_BOUTIQUES_PAR_DEFAUT, type FormuleBoutique } from '../pricing';
import { boutiqueParSlug, type BoutiqueReseau } from './boutiques';
import { quartierReconnu } from './proximite';

export type TypeCompteBoutique = 'reseller' | 'supplier';

export const MAX_ARTICLES_BOUTIQUE = 60;
const DUREE_FORMULE_JOURS = 30;

export interface PlanBoutique {
  id: string;
  formuleId: string;
  formuleNom: string;
  boutiquesMax: number;
  prixMensuel: number;
  statut: 'demande' | 'active' | 'refusee' | 'expiree';
  reference: string;
  demandeLe: string;
  activeLe: string | null;
  expireLe: string | null;
}

function versPlan(r: any): PlanBoutique {
  const expire = r.expire_le && new Date(r.expire_le).getTime() < Date.now();
  return {
    id: r.id, formuleId: r.formule_id, formuleNom: r.formule_nom,
    boutiquesMax: Number(r.boutiques_max) || 1, prixMensuel: Number(r.prix_mensuel) || 0,
    statut: r.statut === 'active' && expire ? 'expiree' : r.statut,
    reference: r.reference, demandeLe: r.demande_le, activeLe: r.active_le || null, expireLe: r.expire_le || null,
  };
}

export async function formulesBoutiques(): Promise<FormuleBoutique[]> {
  const { reglages } = await chargerReglages();
  return reglages.formulesBoutiques?.length ? reglages.formulesBoutiques : FORMULES_BOUTIQUES_PAR_DEFAUT;
}

/** Toutes les boutiques d'un compte, la principale en premier. */
export async function boutiquesDuCompte(type: TypeCompteBoutique, proprietaireId: string): Promise<BoutiqueReseau[]> {
  const a = getSupabaseAdmin();
  if (!a) return [];
  const { data, error } = await a.from('stores').select('slug')
    .eq('owner_type', type).eq('owner_id', proprietaireId).order('created_at', { ascending: true }).limit(60);
  if (error || !data) return [];
  const boutiques = (await Promise.all(data.map((b: any) => boutiqueParSlug(b.slug)))).filter(Boolean) as BoutiqueReseau[];
  return boutiques.sort((x, y) => Number(y.principale) - Number(x.principale));
}

/** Formule en cours et limite de boutiques. Table absente : version gratuite. */
export async function situationFormule(type: TypeCompteBoutique, profileId: string): Promise<{
  limite: number; formule: FormuleBoutique; planActif: PlanBoutique | null; demande: PlanBoutique | null; disponible: boolean;
}> {
  const formules = await formulesBoutiques();
  const gratuite = formules.find((f) => f.prixMensuel === 0) || formules[0];
  const a = getSupabaseAdmin();
  const repli = { limite: gratuite.boutiques, formule: gratuite, planActif: null, demande: null, disponible: false };
  if (!a) return repli;
  const { data, error } = await a.from('store_plans').select('*')
    .eq('profile_id', profileId).eq('owner_type', type).in('statut', ['demande', 'active'])
    .order('demande_le', { ascending: false }).limit(20);
  if (error) return repli;
  const plans = (data || []).map(versPlan);
  const actifs = plans.filter((p) => p.statut === 'active');
  const meilleur = actifs.sort((x, y) => y.boutiquesMax - x.boutiquesMax)[0] || null;
  const demande = plans.find((p) => p.statut === 'demande') || null;
  const formule = meilleur ? (formules.find((f) => f.id === meilleur.formuleId) || { id: meilleur.formuleId, nom: meilleur.formuleNom, prixMensuel: meilleur.prixMensuel, boutiques: meilleur.boutiquesMax }) : gratuite;
  return { limite: Math.max(gratuite.boutiques, meilleur?.boutiquesMax || 0), formule, planActif: meilleur, demande, disponible: true };
}

/**
 * Crée une boutique SUPPLÉMENTAIRE. `forcer` : création par l'admin, qui
 * peut dépasser la limite de la formule (décision commerciale de Suguba).
 */
export async function creerBoutiqueSupplementaire(params: {
  type: TypeCompteBoutique; proprietaireId: string; nom: string; quartier?: string | null; forcer?: boolean;
}): Promise<{ ok: true; boutique: BoutiqueReseau } | { ok: false; erreur: string; statut: number }> {
  const a = getSupabaseAdmin();
  if (!a) return { ok: false, erreur: 'Base indisponible.', statut: 503 };
  const nom = params.nom.trim().slice(0, 80);
  if (nom.length < 2) return { ok: false, erreur: 'Donnez un nom à la boutique.', statut: 400 };
  if (params.quartier && !quartierReconnu(params.quartier)) return { ok: false, erreur: 'Choisissez un quartier de la liste.', statut: 400 };

  const existantes = await boutiquesDuCompte(params.type, params.proprietaireId);
  if (!params.forcer) {
    const { limite, disponible } = await situationFormule(params.type, params.proprietaireId);
    if (!disponible) return { ok: false, erreur: 'Les boutiques supplémentaires seront disponibles après la mise à jour de la base par Suguba.', statut: 503 };
    if (existantes.length >= limite) {
      return { ok: false, erreur: `Votre formule permet ${limite} boutique${limite > 1 ? 's' : ''}. Passez à une formule supérieure pour en ouvrir une autre.`, statut: 402 };
    }
  }

  const base = slugifier(nom);
  for (let i = 0; i < 30; i++) {
    const candidat = i === 0 ? base : `${base}-${i + 1}`;
    const ligne: Record<string, unknown> = {
      owner_type: params.type, owner_id: params.proprietaireId, slug: candidat, name: nom,
      // La toute première boutique d'un compte devient la principale.
      principale: existantes.length === 0,
    };
    if (params.quartier) ligne.neighborhood = params.quartier;
    const { data, error } = await a.from('stores').insert(ligne).select('slug').maybeSingle();
    if (!error && data) {
      const boutique = await boutiqueParSlug(data.slug);
      return boutique ? { ok: true, boutique } : { ok: false, erreur: 'Boutique créée mais illisible.', statut: 500 };
    }
    if (error?.code === '42703') return { ok: false, erreur: 'Les boutiques supplémentaires seront disponibles après la mise à jour de la base par Suguba.', statut: 503 };
    if (error?.code !== '23505') return { ok: false, erreur: 'Création impossible pour le moment.', statut: 500 };
    // 23505 : adresse déjà prise, ou ancienne contrainte « une boutique par compte ».
    if (/stores_owner_key/.test(error.message || '')) return { ok: false, erreur: 'Les boutiques supplémentaires seront disponibles après la mise à jour de la base par Suguba.', statut: 503 };
  }
  return { ok: false, erreur: 'Choisissez un autre nom de boutique.', statut: 409 };
}

/** Vérifie qu'une boutique appartient bien au compte. */
export async function boutiqueDuCompte(type: TypeCompteBoutique, proprietaireId: string, boutiqueId: string): Promise<BoutiqueReseau | null> {
  const toutes = await boutiquesDuCompte(type, proprietaireId);
  return toutes.find((b) => b.id === boutiqueId) || null;
}

export async function articlesDeLaBoutique(boutiqueId: string): Promise<string[]> {
  const a = getSupabaseAdmin();
  if (!a) return [];
  const { data, error } = await a.from('store_products').select('product_id, position')
    .eq('store_id', boutiqueId).order('position', { ascending: true });
  if (error || !data) return [];
  return data.map((l: any) => l.product_id);
}

/**
 * Remplace la sélection d'une boutique supplémentaire. Un fournisseur ne peut
 * y mettre que SES produits ; un revendeur, n'importe quel produit en vente.
 */
export async function definirArticlesDeLaBoutique(params: {
  type: TypeCompteBoutique; proprietaireId: string; boutiqueId: string; produits: string[];
}): Promise<{ ok: boolean; erreur?: string }> {
  const a = getSupabaseAdmin();
  if (!a) return { ok: false, erreur: 'Base indisponible.' };
  const ids = Array.from(new Set(params.produits.filter((x) => typeof x === 'string'))).slice(0, MAX_ARTICLES_BOUTIQUE);
  let valides: string[] = [];
  if (ids.length) {
    let requete = a.from('products').select('id').in('id', ids).eq('status', 'approved');
    if (params.type === 'supplier') requete = requete.eq('supplier_id', params.proprietaireId);
    const { data } = await requete;
    const ok = new Set((data || []).map((p: any) => p.id));
    valides = ids.filter((id) => ok.has(id));
  }
  const { error: effacement } = await a.from('store_products').delete().eq('store_id', params.boutiqueId);
  if (effacement) return { ok: false, erreur: 'Enregistrement impossible (mise à jour de la base à faire ?).' };
  if (valides.length) {
    const { error } = await a.from('store_products').insert(valides.map((product_id, position) => ({ store_id: params.boutiqueId, product_id, position })));
    if (error) return { ok: false, erreur: 'Enregistrement impossible.' };
  }
  return { ok: true };
}

/** Demande de formule : une seule demande en attente à la fois, avec sa référence de paiement. */
export async function demanderFormule(type: TypeCompteBoutique, profileId: string, formuleId: string): Promise<
  { ok: true; plan: PlanBoutique } | { ok: false; erreur: string; statut: number }
> {
  const a = getSupabaseAdmin();
  if (!a) return { ok: false, erreur: 'Base indisponible.', statut: 503 };
  const formule = (await formulesBoutiques()).find((f) => f.id === formuleId && f.prixMensuel > 0);
  if (!formule) return { ok: false, erreur: 'Formule inconnue.', statut: 400 };
  const situation = await situationFormule(type, profileId);
  if (!situation.disponible) return { ok: false, erreur: 'Les formules Pro seront disponibles après la mise à jour de la base par Suguba.', statut: 503 };
  if (situation.demande) return { ok: false, erreur: 'Une demande est déjà en attente de validation.', statut: 409 };

  const reference = `BQ-${randomBytes(3).toString('hex').toUpperCase()}`;
  const { data, error } = await a.from('store_plans').insert({
    profile_id: profileId, owner_type: type, formule_id: formule.id, formule_nom: formule.nom,
    boutiques_max: formule.boutiques, prix_mensuel: formule.prixMensuel, statut: 'demande', reference,
  }).select('*').maybeSingle();
  if (error || !data) return { ok: false, erreur: 'Demande impossible pour le moment.', statut: 500 };
  return { ok: true, plan: versPlan(data) };
}

/** Décision de l'admin sur une demande : activer (pour 30 jours) ou refuser. */
export async function deciderFormule(planId: string, decision: 'activer' | 'refuser', adminId: string): Promise<{ ok: boolean; erreur?: string; plan?: PlanBoutique }> {
  const a = getSupabaseAdmin();
  if (!a) return { ok: false, erreur: 'Base indisponible.' };
  const maintenant = new Date();
  const valeurs = decision === 'activer'
    ? { statut: 'active', active_le: maintenant.toISOString(), expire_le: new Date(maintenant.getTime() + DUREE_FORMULE_JOURS * 86_400_000).toISOString(), decide_par: adminId }
    : { statut: 'refusee', decide_par: adminId };
  const { data, error } = await a.from('store_plans').update(valeurs).eq('id', planId).in('statut', ['demande', 'active', 'expiree']).select('*').maybeSingle();
  if (error || !data) return { ok: false, erreur: 'Demande introuvable.' };
  return { ok: true, plan: versPlan(data) };
}

/** Demandes et formules en cours, pour l'admin. */
export async function plansPourAdmin(): Promise<(PlanBoutique & { profileId: string; type: TypeCompteBoutique; nomCompte: string | null })[]> {
  const a = getSupabaseAdmin();
  if (!a) return [];
  const { data, error } = await a.from('store_plans').select('*').in('statut', ['demande', 'active']).order('demande_le', { ascending: false }).limit(200);
  if (error || !data) return [];
  const ids = Array.from(new Set(data.map((p: any) => p.profile_id)));
  const { data: profils } = await a.from('profiles').select('id, full_name').in('id', ids);
  const noms = new Map((profils || []).map((p: any) => [p.id, p.full_name]));
  return data.map((p: any) => ({ ...versPlan(p), profileId: p.profile_id, type: p.owner_type, nomCompte: noms.get(p.profile_id) || null }));
}
