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

export type EvenementAnalytique =
  | 'PRODUCT_VIEW' | 'STORE_VIEW' | 'SHARE' | 'CLICK'
  | 'ORDER' | 'REFERRAL' | 'FOLLOW' | 'MISSION_JOIN' | 'MISSION_DONE';

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
}): Promise<void> {
  const a = admin();
  if (!a) return;
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
 * L'admin connecté a-t-il cette permission ? Un admin sans ligne d'équipe
 * garde tous les droits (voir permissionsEffectives) : la mise en production
 * de ce module ne doit enfermer dehors aucun administrateur existant.
 */
export async function adminPeut(profileId: string, permission: Permission): Promise<boolean> {
  const membre = await membreEquipe(profileId);
  return permissionsEffectives(membre).includes(permission);
}

/**
 * Administrateur GÉNÉRAL (2026-09-19) : admin sans rôle d'équipe restreint,
 * ou « Super Admin ». Seul à voir le guide des parcours (/admin/guide).
 * Strict, contrairement à membreEquipe : une erreur de lecture REFUSE
 * l'accès — sauf table d'équipe absente, où tous les admins sont généraux.
 */
export async function estAdministrateurGeneral(profileId: string): Promise<boolean> {
  const a = admin();
  if (!a) return false;
  const { data, error } = await a
    .from('admin_team_members')
    .select('team_role')
    .eq('profile_id', profileId)
    .maybeSingle();
  if (error) return schemaIncomplet(error);
  return !data || data.team_role === 'super_admin';
}
