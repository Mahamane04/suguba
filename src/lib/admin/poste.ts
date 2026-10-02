/**
 * Poste de travail admin (lot A1, 2026-09-27) — règles PURES.
 *
 * L'équipe Suguba travaille surtout sur ordinateur : un menu latéral en six
 * rubriques, filtré selon les droits de chacun, une recherche globale et une
 * file « À traiter » par métier. Ce module ne lit rien : il décide quoi
 * montrer à qui. Les droits restent contrôlés par le SERVEUR sur chaque
 * route — masquer une entrée de menu n'est qu'un confort.
 */
import type { Permission, RoleEquipe } from '@/lib/reseau/permissions';

export type Metier = 'direction' | 'support' | 'finance' | 'catalogue' | 'marketing' | 'livraisons';

export const METIERS: { valeur: Metier; libelle: string }[] = [
  { valeur: 'direction', libelle: 'Direction' },
  { valeur: 'support', libelle: 'Support client' },
  { valeur: 'finance', libelle: 'Finance et caisse' },
  { valeur: 'catalogue', libelle: 'Catalogue et fournisseurs' },
  { valeur: 'marketing', libelle: 'Marketing et réseau' },
  { valeur: 'livraisons', libelle: 'Livraisons' },
];

/** Métier d'un rôle d'équipe : page d'accueil et file par défaut. */
export function metierDuRole(role: RoleEquipe | string | null | undefined): Metier {
  switch (role) {
    case 'support': return 'support';
    case 'finance': return 'finance';
    case 'responsable_fournisseurs': case 'moderateur': return 'catalogue';
    case 'marketing': case 'responsable_revendeurs': return 'marketing';
    case 'responsable_livraison': return 'livraisons';
    default: return 'direction';
  }
}

/**
 * Valeur montrée par le sélecteur de métier de « À traiter » (ADM-03, audit
 * UI/UX du 2026-10-02). Pour la Direction, le serveur renvoie « direction »,
 * qui veut dire « toutes les files » (voir preparerTaches) ; la liste proposée
 * n'a pas cette valeur, et le sélecteur affichait « Choisir… ».
 */
export const metierAffiche = (m: Metier | 'toutes' | null): Metier | 'toutes' => (!m || m === 'direction' ? 'toutes' : m);

export function libelleMetier(m: Metier): string {
  return METIERS.find((x) => x.valeur === m)?.libelle || 'Direction';
}

/** Entrée de menu : visible si le membre a la permission (null = tout membre). */
export interface EntreeMenu { libelle: string; href: string; permission: Permission | null }
export interface Rubrique { cle: string; titre: string; entrees: EntreeMenu[] }

/**
 * Les huit rubriques. Chaque entrée pointe vers une page QUI EXISTE ; la
 * permission est celle de la lecture principale de la page (voir
 * PERMISSION_PAR_ROUTE), pour que le menu ne promette jamais une page que le
 * serveur refusera.
 */
const RUBRIQUES_DETAIL: Rubrique[] = [
  { cle: 'pilotage', titre: 'Pilotage', entrees: [
    { libelle: 'À traiter', href: '/admin/a-traiter', permission: null },
    { libelle: 'Vue d’ensemble', href: '/admin', permission: 'finance.lire' },
    { libelle: 'Analyses', href: '/admin/analytics', permission: 'finance.lire' },
    { libelle: 'Rapport du soir', href: '/admin/reports/daily', permission: 'finance.lire' },
    { libelle: 'Pourquoi c’est bloqué ?', href: '/admin/diagnostic', permission: null },
  ] },
  { cle: 'operations', titre: 'Opérations', entrees: [
    { libelle: 'Commandes', href: '/admin/commandes', permission: 'commande.lire' },
    { libelle: 'Devis', href: '/admin/devis', permission: 'commande.lire' },
    { libelle: 'Prestations', href: '/admin/prestations', permission: 'commande.lire' },
    { libelle: 'Service après-vente', href: '/admin/sav', permission: 'commande.lire' },
    { libelle: 'Modération des messages', href: '/admin/messages', permission: 'utilisateur.moderer' },
  ] },
  { cle: 'catalogue', titre: 'Catalogue', entrees: [
    { libelle: 'Produits', href: '/admin/products', permission: 'produit.lire' },
    { libelle: 'Catalogue', href: '/admin/catalogue', permission: 'produit.lire' },
    { libelle: 'Nouveau produit', href: '/admin/products/new', permission: 'produit.moderer' },
    { libelle: 'Recherche et synonymes', href: '/admin/recherche', permission: 'produit.lire' },
    { libelle: 'Boutique Suguba', href: '/admin/boutique-suguba', permission: 'boutique.moderer' },
  ] },
  { cle: 'reseau', titre: 'Utilisateurs et réseau', entrees: [
    { libelle: 'Utilisateurs', href: '/admin/utilisateurs', permission: 'utilisateur.lire' },
    { libelle: 'Livreurs', href: '/admin/livreurs', permission: 'livraison.lire' },
    { libelle: 'Boutiques', href: '/admin/boutiques', permission: 'boutique.lire' },
    { libelle: 'Identité et documents', href: '/admin/verifications', permission: 'verification.lire' },
    { libelle: 'Accès aux coordonnées', href: '/admin/acces-coordonnees', permission: 'commande.lire' },
  ] },
  { cle: 'finance', titre: 'Finance', entrees: [
    { libelle: 'Retraits et commissions', href: '/admin/retraits', permission: 'finance.lire' },
    { libelle: 'Caisse livreurs', href: '/admin/caisse-livreurs', permission: 'finance.lire' },
    { libelle: 'Récompenses', href: '/admin/recompenses', permission: 'finance.lire' },
  ] },
  { cle: 'visibilite', titre: 'Visibilité et campagnes', entrees: [
    { libelle: 'Missions', href: '/admin/missions', permission: 'mission.gerer' },
    { libelle: 'Qualité des mesures', href: '/admin/resultats', permission: 'mission.gerer' },
    { libelle: 'Sponsorisation', href: '/admin/sponsorisations', permission: 'sponsorisation.gerer' },
    { libelle: 'Diffusion', href: '/admin/broadcast', permission: 'marketing.lire' },
  ] },
  { cle: 'plateforme', titre: 'Contrôle de la plateforme', entrees: [
    { libelle: 'Centre des modules', href: '/admin/modules', permission: null },
    { libelle: 'Accueil client', href: '/admin/accueil', permission: 'plateforme.parametres' },
    { libelle: 'Simulateur de réglages', href: '/admin/simulateur', permission: 'finance.lire' },
    { libelle: 'Priorité au réseau', href: '/admin/priorite-reseau', permission: 'boutique.lire' },
    { libelle: 'Paramètres et commissions', href: '/admin/parametres', permission: 'plateforme.parametres' },
  ] },
  { cle: 'equipe', titre: 'Équipe et sécurité', entrees: [
    { libelle: 'Équipe et permissions', href: '/admin/equipe', permission: 'plateforme.equipe' },
    { libelle: 'Guide des parcours', href: '/admin/guide', permission: 'plateforme.equipe' },
    { libelle: 'Journal des actions', href: '/admin/journal', permission: 'plateforme.equipe' },
    { libelle: 'Sécurité de l’équipe', href: '/admin/securite', permission: 'plateforme.equipe' },
    { libelle: 'Approbations financières', href: '/admin/validations', permission: 'finance.payer' },
  ] },
];

/** Six destinations desktop, with permissions retained on every child. */
export const RUBRIQUES: Rubrique[] = [
  {cle:'pilotage',titre:'Aujourd’hui',entrees:RUBRIQUES_DETAIL[0].entrees.filter(e=>['/admin/a-traiter','/admin'].includes(e.href))},
  {cle:'operations',titre:'Commandes',entrees:RUBRIQUES_DETAIL[1].entrees.filter(e=>e.href!=='/admin/messages')},
  {cle:'catalogue',titre:'Catalogue',entrees:RUBRIQUES_DETAIL[2].entrees.filter(e=>!['/admin/products/new','/admin/boutique-suguba','/admin/products'].includes(e.href))},
  {cle:'reseau',titre:'Réseau',entrees:[...RUBRIQUES_DETAIL[3].entrees.filter(e=>e.href!=='/admin/acces-coordonnees'),...RUBRIQUES_DETAIL[1].entrees.filter(e=>e.href==='/admin/messages')]},
  {cle:'finance',titre:'Finance',entrees:[...RUBRIQUES_DETAIL[4].entrees,...RUBRIQUES_DETAIL[7].entrees.filter(e=>e.href==='/admin/validations')]},
  {cle:'plus',titre:'Plus',entrees:[...RUBRIQUES_DETAIL[0].entrees.filter(e=>!['/admin/a-traiter','/admin'].includes(e.href)),...RUBRIQUES_DETAIL[5].entrees,...RUBRIQUES_DETAIL[6].entrees,...RUBRIQUES_DETAIL[7].entrees.filter(e=>e.href!=='/admin/validations'),...RUBRIQUES_DETAIL[3].entrees.filter(e=>e.href==='/admin/acces-coordonnees')]},
];

/**
 * Compteurs du menu (U3, 2026-09-27) : les tâches « À traiter » de chaque
 * type s'affichent à côté de la page où on les traite. « À traiter »
 * lui-même montre le total.
 */
export const TYPES_PAR_ENTREE: Record<string, TypeTache[]> = {
  '/admin/commandes': ['commande_a_confirmer', 'livraison_a_attribuer'],
  '/admin/retraits': ['retrait_a_payer'],
  '/admin/caisse-livreurs': ['versement_en_retard'],
  '/admin/prestations': ['prestation_contestee'],
  '/admin/messages': ['message_a_verifier'],
  '/admin/verifications': ['verification_en_attente'],
  '/admin/catalogue': ['produit_a_verifier'],
  '/admin/sav': ['sav_ouvert'],
  '/admin/devis': ['devis_sans_reponse'],
  '/admin/sponsorisations': ['sponsorisation_a_examiner'],
  '/admin/validations': ['validation_a_decider'],
};

/** Nombre à afficher à côté d'une entrée de menu (0 = rien). */
export function compteurEntree(href: string, compteurs: Partial<Record<TypeTache, number>> | null): number {
  if (!compteurs) return 0;
  if (href === '/admin/a-traiter') return Object.values(compteurs).reduce((s, n) => s + (n || 0), 0);
  return (TYPES_PAR_ENTREE[href] || []).reduce((s, t) => s + (compteurs[t] || 0), 0);
}

/** Rubriques et entrées que ce membre peut ouvrir ; rubriques vides retirées. */
export function rubriquesVisibles(permissions: readonly string[], rubriques: Rubrique[] = RUBRIQUES): Rubrique[] {
  // Sans aucun rôle d'équipe : aucun menu (chaque page le refuserait).
  if (!permissions.length) return [];
  return rubriques
    .map((r) => ({ ...r, entrees: r.entrees.filter((e) => e.permission === null || permissions.includes(e.permission)) }))
    .filter((r) => r.entrees.length > 0);
}

// ── File « À traiter » ──────────────────────────────────────────────────────

export type TypeTache =
  | 'commande_a_confirmer' | 'livraison_a_attribuer' | 'retrait_a_payer' | 'versement_en_retard'
  | 'prestation_contestee' | 'message_a_verifier' | 'verification_en_attente' | 'produit_a_verifier'
  | 'sav_ouvert' | 'devis_sans_reponse' | 'sponsorisation_a_examiner' | 'validation_a_decider';

export interface DefinitionTache { libelle: string; metier: Metier; permission: Permission; action: string }

/** Chaque type de tâche : son métier, la permission pour la voir, l'action proposée. */
export const TACHES: Record<TypeTache, DefinitionTache> = {
  commande_a_confirmer: { libelle: 'Commande à confirmer', metier: 'support', permission: 'commande.lire', action: 'Appeler le client et confirmer' },
  livraison_a_attribuer: { libelle: 'Livraison à attribuer', metier: 'livraisons', permission: 'livraison.lire', action: 'Attribuer un livreur' },
  retrait_a_payer: { libelle: 'Retrait à payer', metier: 'finance', permission: 'finance.lire', action: 'Vérifier et payer' },
  versement_en_retard: { libelle: 'Espèces non versées', metier: 'finance', permission: 'finance.lire', action: 'Récupérer les espèces' },
  prestation_contestee: { libelle: 'Prestation contestée', metier: 'support', permission: 'commande.lire', action: 'Examiner et décider' },
  message_a_verifier: { libelle: 'Message à vérifier', metier: 'support', permission: 'utilisateur.moderer', action: 'Autoriser ou refuser' },
  verification_en_attente: { libelle: 'Pièce à vérifier', metier: 'catalogue', permission: 'verification.lire', action: 'Valider ou refuser' },
  produit_a_verifier: { libelle: 'Produit à vérifier', metier: 'catalogue', permission: 'produit.moderer', action: 'Fixer le prix ou refuser' },
  sav_ouvert: { libelle: 'Réclamation SAV', metier: 'support', permission: 'commande.lire', action: 'Traiter la réclamation' },
  devis_sans_reponse: { libelle: 'Devis sans réponse', metier: 'catalogue', permission: 'commande.lire', action: 'Relancer le fournisseur' },
  sponsorisation_a_examiner: { libelle: 'Sponsorisation à examiner', metier: 'marketing', permission: 'sponsorisation.gerer', action: 'Valider ou refuser' },
  validation_a_decider: { libelle: 'Validation à décider', metier: 'finance', permission: 'finance.payer', action: 'Approuver ou refuser (pas sa propre demande)' },
};

export interface Tache {
  type: TypeTache;
  /** Identifiant du dossier (commande, retrait, livreur…). */
  id: string;
  titre: string;
  detail: string;
  /** Date d'origine (ISO) : l'ancienneté se calcule à l'affichage. */
  depuis: string;
  lien: string;
  /** Montant concerné, s'il y en a un (F CFA). */
  montant?: number | null;
}

export interface TacheAffichee extends Tache {
  libelle: string;
  metier: Metier;
  action: string;
  /** Clé de dossier pour l'affectation : « type:id ». */
  dossier: string;
  responsable: { id: string; nom: string } | null;
  /** Version de l'affectation vue (A2) : null = sans responsable ; sert à détecter un changement concurrent. */
  version: string | null;
}

export function cleDossier(type: TypeTache, id: string): string {
  return `${type}:${id}`;
}

/**
 * Tâches visibles par ce membre (permission), enrichies de leur définition et
 * de leur responsable, les plus anciennes d'abord. Filtre de métier facultatif
 * (« direction » = toutes). Une tâche sans permission n'est JAMAIS renvoyée.
 */
export function preparerTaches(
  taches: Tache[],
  permissions: readonly string[],
  affectations: Map<string, { id: string; nom: string; version?: string }>,
  metier: Metier | 'toutes' = 'toutes',
): TacheAffichee[] {
  return taches
    .filter((t) => permissions.includes(TACHES[t.type].permission))
    .map((t) => {
      const def = TACHES[t.type];
      const dossier = cleDossier(t.type, t.id);
      const a = affectations.get(dossier);
      return {
        ...t, libelle: def.libelle, metier: def.metier, action: def.action, dossier,
        responsable: a ? { id: a.id, nom: a.nom } : null, version: a?.version ?? null,
      };
    })
    .filter((t) => metier === 'toutes' || metier === 'direction' || t.metier === metier)
    .sort((a, b) => Date.parse(a.depuis) - Date.parse(b.depuis) || a.dossier.localeCompare(b.dossier));
}

/** « il y a 3 h », « il y a 2 j » — l'ancienneté d'une tâche. */
export function anciennete(depuis: string, maintenant = Date.now()): string {
  const ms = Math.max(0, maintenant - Date.parse(depuis));
  const min = Math.floor(ms / 60000);
  if (min < 60) return `il y a ${Math.max(1, min)} min`;
  const h = Math.floor(min / 60);
  if (h < 48) return `il y a ${h} h`;
  return `il y a ${Math.floor(h / 24)} j`;
}

/** Niveau d'urgence selon l'ancienneté : sert à colorer la ligne. */
export function urgence(depuis: string, maintenant = Date.now()): 'normale' | 'a_surveiller' | 'en_retard' {
  const h = (maintenant - Date.parse(depuis)) / 3_600_000;
  return h >= 24 ? 'en_retard' : h >= 4 ? 'a_surveiller' : 'normale';
}

// ── Recherche globale ───────────────────────────────────────────────────────

/** Texte cherché → motif ilike sûr (jokers échappés, séparateurs de filtre retirés). */
export function motifRecherche(q: string): string | null {
  const t = String(q || '').slice(0, 60).replace(/[,()]/g, ' ').replace(/\s+/g, ' ').trim();
  if (t.length < 2) return null;
  return `%${t.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/** Groupes de résultats et permission nécessaire pour chacun. */
export const GROUPES_RECHERCHE: { cle: string; titre: string; permission: Permission }[] = [
  { cle: 'commandes', titre: 'Commandes', permission: 'commande.lire' },
  { cle: 'produits', titre: 'Produits', permission: 'produit.lire' },
  { cle: 'personnes', titre: 'Personnes', permission: 'utilisateur.lire' },
  { cle: 'boutiques', titre: 'Boutiques', permission: 'boutique.lire' },
  { cle: 'paiements', titre: 'Paiements reçus', permission: 'finance.lire' },
];
