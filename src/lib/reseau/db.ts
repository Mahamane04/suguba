/**
 * Accès base du module Réseau — SERVEUR UNIQUEMENT.
 *
 * Principe directeur : **dégradation, jamais panne**. Tant que
 * supabase/migration-reseau-v1.sql n'est pas appliqué, ces tables n'existent
 * pas. Aucun écran existant (accueil, fiche produit, commande) ne doit tomber
 * pour autant : chaque lecture renvoie alors un résultat vide, chaque écriture
 * est ignorée en silence avec une trace dans les journaux serveur.
 *
 * Ne jamais importer depuis un composant 'use client'.
 */
import { randomBytes, createHash } from 'node:crypto';
import { getSupabaseAdmin } from '../supabase-admin';
import { genererCodeLien, normaliserCodeLien, type CanalPartage, type CibleLien } from './codes';
import { deciderAttribution, cleClient, type AttributionExistante } from './attribution';
import { permissionsEffectives, type Permission } from './permissions';

type Admin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

/** Code PostgREST d'une table ou d'une colonne absente. */
function schemaIncomplet(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === '42P01' || error.code === 'PGRST205' || error.code === '42703';
}

let migrationSignalee = false;
function signalerMigrationManquante(ou: string) {
  if (migrationSignalee) return;
  migrationSignalee = true;
  console.warn(
    `[RESEAU] Tables du réseau absentes (${ou}). Appliquez supabase/migration-reseau-v1.sql ` +
    'dans l’éditeur SQL Supabase — en attendant, les fonctions réseau restent inertes.'
  );
}

export function admin(): Admin | null {
  return getSupabaseAdmin();
}

// ── Liens trackés ──────────────────────────────────────────────────────────

export interface LienTracke {
  code: string;
  ownerId: string | null;
  cible: CibleLien;
  ref: string | null;
  canal: string;
  libelle: string | null;
  clics: number;
  visiteurs: number;
  commandes: number;
  chiffreAffaires: number;
  creeLe: string;
}

function versLien(r: any): LienTracke {
  return {
    code: r.code,
    ownerId: r.owner_id || null,
    cible: r.target_type,
    ref: r.target_ref || null,
    canal: r.channel || 'autre',
    libelle: r.label || null,
    clics: Number(r.clicks) || 0,
    visiteurs: Number(r.visitors) || 0,
    commandes: Number(r.orders_count) || 0,
    chiffreAffaires: Number(r.revenue) || 0,
    creeLe: r.created_at,
  };
}

/**
 * Crée un lien tracké. Réessaie sur collision de code : 31^6 ≈ 887 millions de
 * combinaisons, une collision reste possible et ne doit pas renvoyer d'erreur
 * au revendeur qui voulait juste partager un produit.
 */
export async function creerLienTracke(params: {
  ownerId: string | null;
  ownerRole?: string | null;
  cible: CibleLien;
  ref: string | null;
  canal: CanalPartage;
  libelle?: string | null;
}): Promise<LienTracke | null> {
  const a = admin();
  if (!a) return null;

  for (let essai = 0; essai < 5; essai++) {
    const code = genererCodeLien((n) => new Uint8Array(randomBytes(n)));
    const { data, error } = await a
      .from('tracking_links')
      .insert({
        code,
        owner_id: params.ownerId,
        owner_role: params.ownerRole || null,
        target_type: params.cible,
        target_ref: params.ref,
        channel: params.canal,
        label: params.libelle || null,
      })
      .select('*')
      .maybeSingle();

    if (!error && data) return versLien(data);
    if (schemaIncomplet(error)) { signalerMigrationManquante('tracking_links'); return null; }
    if (error?.code !== '23505') {
      console.error('[RESEAU] Création de lien impossible:', error?.code);
      return null;
    }
  }
  return null;
}

/**
 * Lien suivi PERMANENT d'une boutique (lot 4 du chantier boutique, 2026-10-03).
 *
 * prechargerLienPartage (src/lib/partage.ts) crée un lien à chaque session : pour
 * une boutique, « Mes partages » se remplirait de doublons et les clics de la
 * boutique seraient éparpillés sur des dizaines de codes. Ici, on relit d'abord
 * le PREMIER lien qui correspond (même propriétaire, cible 'store', même ref
 * « slug » ou « slug~cle », même canal) et on ne le crée qu'à défaut. SHARE n'est
 * journalisé qu'à la création : rouvrir la feuille de partage n'est pas un partage.
 *
 * Lecture en échec : null, sans rien créer (un doublon vaut mieux pas que
 * deux) ; l'appelant partage alors l'adresse brute.
 *
 * `libelle` peut être une fonction (relecture du lot 4, 2026-10-03) : elle n'est
 * appelée qu'à la création, pour calculer le nom du rayon côté serveur sans
 * relire la boutique à chaque préparation d'un lien qui existe déjà.
 */
export async function lienPermanent(params: {
  ownerId: string;
  ownerRole?: string | null;
  cible: 'store';
  ref: string;
  canal: CanalPartage;
  libelle?: string | null | (() => Promise<string | null>);
}): Promise<{ lien: LienTracke; cree: boolean } | null> {
  const a = admin();
  if (!a || !params.ownerId || !params.ref) return null;
  const { data, error } = await a
    .from('tracking_links')
    .select('*')
    .eq('owner_id', params.ownerId)
    .eq('target_type', params.cible)
    .eq('target_ref', params.ref)
    .eq('channel', params.canal)
    .order('created_at', { ascending: true })
    .limit(1);
  if (error) {
    if (schemaIncomplet(error)) signalerMigrationManquante('tracking_links');
    else console.error('[RESEAU] Lecture du lien de boutique impossible:', error.code);
    return null;
  }
  if (Array.isArray(data) && data[0]) return { lien: versLien(data[0]), cree: false };

  // Libellé illisible : le lien est créé quand même, « Mes partages » lit la clé du rayon.
  const libelle = typeof params.libelle === 'function'
    ? await params.libelle().catch(() => null)
    : params.libelle ?? null;
  const lien = await creerLienTracke({
    ownerId: params.ownerId,
    ownerRole: params.ownerRole ?? null,
    cible: params.cible,
    ref: params.ref,
    canal: params.canal,
    libelle,
  });
  if (!lien) return null;
  await journaliser({
    evenement: 'SHARE',
    acteurId: params.ownerId,
    resellerId: params.ownerRole === 'reseller' ? params.ownerId : null,
    sujetType: lien.cible,
    sujetRef: lien.ref,
    linkCode: lien.code,
  });
  return { lien, cree: true };
}

/**
 * La boutique a-t-elle déjà un lien suivi (étape « Premier partage » de « Ma
 * boutique est prête à X % », lot 4) ? null si la lecture échoue : l'étape reste
 * à faire, jamais cochée par défaut.
 */
export async function aUnLienDeBoutique(ownerId: string): Promise<boolean | null> {
  const a = admin();
  if (!a) return null;
  const { data, error } = await a
    .from('tracking_links')
    .select('code')
    .eq('owner_id', ownerId)
    .eq('target_type', 'store')
    .limit(1);
  if (error || !Array.isArray(data)) return null;
  return data.length > 0;
}

/**
 * Visites mesurées d'une boutique depuis une date (STORE_VIEW, sujet = id de la
 * boutique, voir /api/reseau/visite-boutique). null si la lecture échoue : « — »,
 * jamais un 0 inventé.
 */
export async function compterVisitesBoutique(storeId: string, depuis: string): Promise<number | null> {
  const a = admin();
  if (!a) return null;
  const { count, error } = await a
    .from('analytics_events')
    .select('id', { count: 'exact', head: true })
    .eq('event', 'STORE_VIEW')
    .eq('subject_ref', storeId)
    .gte('occurred_at', depuis);
  if (error || typeof count !== 'number') return null;
  return count;
}

export async function lienParCode(codeBrut: string): Promise<LienTracke | null> {
  const a = admin();
  const code = normaliserCodeLien(codeBrut);
  if (!a || !code) return null;
  const { data, error } = await a.from('tracking_links').select('*').eq('code', code).maybeSingle();
  if (error) { if (schemaIncomplet(error)) signalerMigrationManquante('tracking_links'); return null; }
  return data ? versLien(data) : null;
}

export async function liensDuProprietaire(ownerId: string, limite = 100): Promise<LienTracke[]> {
  const a = admin();
  if (!a) return [];
  const { data, error } = await a
    .from('tracking_links')
    .select('*')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false })
    .limit(limite);
  if (error) { if (schemaIncomplet(error)) signalerMigrationManquante('tracking_links'); return []; }
  return (data || []).map(versLien);
}

/** Empreinte d'un visiteur : ni IP ni user-agent en clair ne sont stockés. */
export function empreinteVisiteur(ip: string | null, userAgent: string | null): string {
  const sel = process.env.SESSION_SECRET || 'suguba';
  return createHash('sha256').update(`${sel}|${ip || ''}|${userAgent || ''}`).digest('hex').slice(0, 32);
}

/**
 * Empreinte de l'adresse IP SEULE, pour un jour donné (relecture finale du chantier
 * boutique, 2026-10-04) : elle sert aux plafonds des visites de boutique.
 *
 * empreinteVisiteur mêle l'IP et le navigateur déclaré, que l'appelant choisit :
 * en changeant ce texte, une seule machine se faisait passer pour autant de
 * visiteurs qu'elle voulait. Ici, rien d'autre que l'adresse — rien sur l'appareil.
 * Salée par le secret du serveur ET par le jour (`jour` : « 2026-10-04 ») : elle
 * change chaque jour, deux jours ne se relient pas, et l'adresse ne se retrouve
 * pas sans le secret. L'IP en clair n'est jamais stockée.
 */
export function empreinteAdresseDuJour(ip: string | null, jour: string): string {
  const sel = process.env.SESSION_SECRET || 'suguba';
  return createHash('sha256').update(`${sel}|adresse-du-jour|${jour}|${ip || ''}`).digest('hex').slice(0, 32);
}

export async function enregistrerClic(params: {
  code: string;
  visiteur: string;
  referer: string | null;
  device: string | null;
}): Promise<void> {
  const a = admin();
  if (!a) return;
  const { error } = await a.rpc('enregistrer_clic_tracking', {
    p_code: params.code,
    p_visitor_hash: params.visiteur,
    p_referer: params.referer,
    p_device: params.device,
  });
  if (error) {
    if (schemaIncomplet(error) || error.code === 'PGRST202') signalerMigrationManquante('enregistrer_clic_tracking');
    else console.error('[RESEAU] Clic non enregistré:', error.code);
  }
}

// ── Attribution ────────────────────────────────────────────────────────────

/**
 * Enregistre un contact client → revendeur. Applique la règle du premier
 * contact (voir attribution.ts) et renvoie le revendeur référent effectif,
 * qui n'est pas forcément celui du lien qui vient d'être cliqué.
 */
export async function attribuerClient(params: {
  telephone: string;
  resellerId: string | null;
  source: string;
  linkCode?: string | null;
  nomClient?: string | null;
  motif?: 'visite' | 'commande' | 'admin';
}): Promise<string | null> {
  const a = admin();
  const cle = cleClient(params.telephone);
  if (!a || !cle) return null;

  const { data, error } = await a
    .from('customer_attributions')
    .select('reseller_id, source, link_code, first_seen_at')
    .eq('customer_phone', cle)
    .maybeSingle();
  if (error) { if (schemaIncomplet(error)) signalerMigrationManquante('customer_attributions'); return null; }

  const existante: AttributionExistante | null = data
    ? { resellerId: data.reseller_id, source: data.source, linkCode: data.link_code, firstSeenAt: data.first_seen_at }
    : null;

  const decision = deciderAttribution(existante, {
    resellerId: params.resellerId,
    source: params.source,
    linkCode: params.linkCode ?? null,
    motif: params.motif ?? 'visite',
  });

  if (!existante && !decision.changeLeReferent) return null;

  const ligne: Record<string, unknown> = {
    customer_phone: cle,
    last_source: params.source,
    last_link_code: params.linkCode ?? null,
    last_seen_at: new Date().toISOString(),
  };
  if (params.nomClient) ligne.customer_name = params.nomClient;
  if (decision.changeLeReferent) {
    ligne.reseller_id = decision.resellerId;
    ligne.source = params.source;
    ligne.link_code = params.linkCode ?? null;
  }

  const { error: ecriture } = await a
    .from('customer_attributions')
    .upsert(ligne, { onConflict: 'customer_phone' });
  if (ecriture) console.error('[RESEAU] Attribution non enregistrée:', ecriture.code);

  return decision.resellerId;
}

export async function referentDuClient(telephone: string): Promise<string | null> {
  const a = admin();
  const cle = cleClient(telephone);
  if (!a || !cle) return null;
  const { data, error } = await a
    .from('customer_attributions')
    .select('reseller_id')
    .eq('customer_phone', cle)
    .maybeSingle();
  if (error) { if (schemaIncomplet(error)) signalerMigrationManquante('customer_attributions'); return null; }
  return data?.reseller_id || null;
}

export async function enregistrerConversion(params: {
  linkCode: string | null;
  telephone: string | null;
  resellerId: string | null;
  montant: number;
  productId?: string | null;
}): Promise<void> {
  const a = admin();
  if (!a) return;
  const communs = {
    p_link_code: params.linkCode,
    p_customer_phone: params.telephone ? cleClient(params.telephone) : null,
    p_reseller_id: params.resellerId,
    p_amount: params.montant,
  };
  // Version qui ne fait avancer que les missions du BON produit (réseau V3) ;
  // repli sur la première version tant que la migration V3 n'est pas passée.
  let { error } = await a.rpc('enregistrer_conversion_produit', { ...communs, p_product_id: params.productId ?? null });
  if (error && (error.code === 'PGRST202' || schemaIncomplet(error))) {
    ({ error } = await a.rpc('enregistrer_conversion', communs));
  }
  if (error) {
    if (schemaIncomplet(error) || error.code === 'PGRST202') signalerMigrationManquante('enregistrer_conversion');
    else console.error('[RESEAU] Conversion non enregistrée:', error.code);
  }
}

// ── Journal analytique ─────────────────────────────────────────────────────

/**
 * Lot 5 du chantier boutique (2026-10-03) : STORE_ANNOUNCE = un revendeur a
 * prévenu ses abonnés de ses nouveautés (/api/reseller/boutique/annonce). C'est
 * cet événement, lu par reseller_id (index existant), qui tient la limite d'une
 * annonce par 24 h : aucune migration.
 */
export type EvenementAnalytique =
  | 'PRODUCT_VIEW' | 'STORE_VIEW' | 'SHARE' | 'CLICK'
  | 'ORDER' | 'REFERRAL' | 'FOLLOW' | 'MISSION_JOIN' | 'MISSION_DONE'
  | 'STORE_ANNOUNCE';

/**
 * Écrit un événement. Renvoie vrai quand il est bien écrit (lot 5, 2026-10-03) :
 * l'annonce aux abonnés ne part que si sa trace, qui fait la limite des 24 h, est
 * en base. Les autres appelants ignorent ce retour, comme avant.
 */
export async function journaliser(params: {
  evenement: EvenementAnalytique;
  acteurId?: string | null;
  resellerId?: string | null;
  supplierId?: string | null;
  sujetType?: string | null;
  sujetRef?: string | null;
  linkCode?: string | null;
  montant?: number | null;
  meta?: Record<string, unknown>;
}): Promise<boolean> {
  const a = admin();
  if (!a) return false;
  const { error } = await a.from('analytics_events').insert({
    event: params.evenement,
    actor_id: params.acteurId ?? null,
    reseller_id: params.resellerId ?? null,
    supplier_id: params.supplierId ?? null,
    subject_type: params.sujetType ?? null,
    subject_ref: params.sujetRef ?? null,
    link_code: params.linkCode ?? null,
    amount: params.montant ?? null,
    meta: params.meta ?? {},
  });
  if (error && schemaIncomplet(error)) signalerMigrationManquante('analytics_events');
  return !error;
}

// ── Équipe administrative ──────────────────────────────────────────────────

export interface MembreEquipe {
  profileId: string;
  teamRole: string | null;
  permissions: string[];
}

export async function membreEquipe(profileId: string): Promise<MembreEquipe | null> {
  const a = admin();
  if (!a) return null;
  const { data, error } = await a
    .from('admin_team_members')
    .select('profile_id, team_role, permissions')
    .eq('profile_id', profileId)
    .maybeSingle();
  if (error) { if (schemaIncomplet(error)) signalerMigrationManquante('admin_team_members'); return null; }
  if (!data) return null;
  return { profileId: data.profile_id, teamRole: data.team_role, permissions: data.permissions || [] };
}

/**
 * Permissions effectives d'un membre de l'équipe (lot A1, 2026-09-27) : sert
 * aux écrans qui s'adaptent aux droits (menu, file « À traiter », recherche
 * globale). Liste vide = aucun droit (pas de membre, ou erreur de lecture).
 */
export async function permissionsDuMembre(profileId: string): Promise<{ permissions: Permission[]; teamRole: string | null }> {
  const membre = await membreEquipe(profileId);
  return { permissions: permissionsEffectives(membre), teamRole: membre?.teamRole ?? null };
}

/**
 * L'admin connecté a-t-il cette permission ? Un admin sans ligne d'équipe
 * n’obtient aucun droit implicite. L’affectation explicite est obligatoire.
 */
export async function adminPeut(profileId: string, permission: Permission): Promise<boolean> {
  const membre = await membreEquipe(profileId);
  return permissionsEffectives(membre).includes(permission);
}

/**
 * Administrateur GÉNÉRAL (2026-09-19) : admin sans rôle d'équipe restreint,
 * ou « Super Admin ». Seul à voir le guide des parcours (/admin/guide).
 * Toute erreur ou absence d’affectation refuse l’accès.
 */
export async function estAdministrateurGeneral(profileId: string): Promise<boolean> {
  const a = admin();
  if (!a) return false;
  const { data, error } = await a
    .from('admin_team_members')
    .select('team_role')
    .eq('profile_id', profileId)
    .maybeSingle();
  if (error) return false;
  return data?.team_role === 'super_admin';
}
