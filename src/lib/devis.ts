import { createHash, randomInt, randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { calculerCommande, calculerTarif, completerReglages, type Devis, type ReglagesPlateforme } from './pricing';
import { genererNumeroCommande } from './order-number';
import { depotsFournisseurs } from './depot-fournisseur';
import { remiseDuProduit, type RemiseOffre } from './offre';
import { recu } from './order-create';

/**
 * Devis enregistrés (2026-09-26, lot 1b) — SERVEUR UNIQUEMENT.
 *
 * Demande du client → proposition du fournisseur (prix client calculé par le
 * moteur puis FIGÉ) → acceptation par le client, qui crée une commande
 * normale au prix du devis (create_order_with_commission, même fonction que
 * toute commande : stock, commission, reçu, idempotence).
 *
 * Le client accède à son devis avec une clé secrète gardée sur son téléphone
 * (seul le hash est en base). Cette même clé devient la clé du reçu de la
 * commande à l'acceptation : le reçu QR s'ouvre directement.
 */

export class DevisError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

const CLE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const hashCle = (cle: string) => createHash('sha256').update(cle.toLowerCase()).digest('hex');
const indisponible = (): never => { throw new DevisError('Service indisponible. Réessayez.', 503); };

export const DEMANDES_OUVERTES_MAX = 5;
export const VALIDITE_JOURS_DEFAUT = 7;

export interface DemandeDevisInput {
  productId: string;
  customerName: string;
  customerPhone: string;
  city: string;
  neighborhood: string;
  landmark: string;
  quantite: number;
  besoin: string;
  resellerCode?: string;
}

export function normaliserDemandeDevis(value: unknown): DemandeDevisInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Demande invalide.');
  const v = value as Record<string, unknown>;
  const texte = (cle: string, libelle: string, max: number, requis = true): string => {
    const x = v[cle];
    if (!requis && (x === undefined || x === null || x === '')) return '';
    if (typeof x !== 'string' || x.trim().length > max || (requis && !x.trim())) throw new Error(`${libelle} invalide.`);
    return x.trim();
  };
  const quantite = Number(v.quantite ?? 1);
  if (!Number.isInteger(quantite) || quantite < 1 || quantite > 50) throw new Error('Choisissez une quantité entre 1 et 50.');
  const tel = texte('customerPhone', 'Numéro de téléphone', 30).replace(/[\s().-]/g, '');
  if (!/^\+?\d{8,15}$/.test(tel)) throw new Error('Numéro de téléphone invalide.');
  const besoin = texte('besoin', 'Description du besoin', 2000);
  if (besoin.length < 10) throw new Error('Décrivez votre besoin en quelques mots (au moins 10 caractères).');
  return {
    productId: texte('productId', 'Offre', 150),
    customerName: texte('customerName', 'Nom', 120),
    customerPhone: tel,
    city: texte('city', 'Ville', 80),
    neighborhood: texte('neighborhood', 'Quartier', 200),
    landmark: texte('landmark', 'Repère', 500, false),
    quantite,
    besoin,
    resellerCode: texte('resellerCode', 'Code revendeur', 80, false).toUpperCase() || undefined,
  };
}

/**
 * Prix client d'un devis — même règle qu'une publication automatique : le
 * prix recommandé pour le prix du fournisseur et la part revendeur choisie,
 * puis le devis complet (livraison ou remise par le fournisseur, commission).
 * Montants TOTAUX pour la quantité demandée.
 */
export function calculerProposition(
  p: { prixTotal: number; partRevendeurTotale: number; quantite: number; remise: RemiseOffre; revendeurAttribue: boolean },
  lieu: { ville: string; quartierClient?: string; quartierFournisseur?: string; positionFournisseur?: unknown },
  r: ReglagesPlateforme,
): Devis {
  const q = Math.max(1, Math.round(p.quantite));
  const pfUnitaire = Math.round(p.prixTotal / q);
  const partUnitaire = Math.max(0, Math.round(p.partRevendeurTotale / q));
  const prixVente = calculerTarif(pfUnitaire, 0, r, partUnitaire).prixRecommande;
  return calculerCommande(
    { prixFournisseur: pfUnitaire, prixVente, commissionProposee: partUnitaire, modePrix: 'fixe', remise: p.remise },
    { quantite: q, ville: lieu.ville, quartierClient: lieu.quartierClient, quartierFournisseur: lieu.quartierFournisseur, positionFournisseur: lieu.positionFournisseur as never, revendeurAttribue: p.revendeurAttribue },
    r,
  );
}

async function reglagesEnBase(admin: SupabaseClient) {
  const { data, error } = await admin.from('platform_settings').select('valeurs, updated_at').eq('id', 1).maybeSingle();
  if (error) indisponible();
  return { reglages: completerReglages(data?.valeurs || {}), majLe: data?.updated_at || null };
}

// ── 1. Demande du client ────────────────────────────────────────────────────
export async function creerDemandeDevis(admin: SupabaseClient, value: unknown, cle: unknown) {
  if (typeof cle !== 'string' || !CLE.test(cle)) throw new DevisError('Référence de demande invalide. Rechargez la page.', 400);
  let input: DemandeDevisInput;
  try { input = normaliserDemandeDevis(value); } catch (e) { throw new DevisError((e as Error).message, 400); }
  const cleHash = hashCle(cle);

  // Même clé = même demande (double envoi, coupure réseau).
  const deja = await admin.from('quote_requests').select('quote_number').eq('access_key_hash', cleHash).maybeSingle();
  if (deja.error) indisponible();
  if (deja.data) return { quoteNumber: deja.data.quote_number as string, created: false };

  const { data: produit, error: e1 } = await admin.from('products').select('*').eq('id', input.productId).maybeSingle();
  if (e1) indisponible();
  if (!produit || produit.status !== 'approved') throw new DevisError('Cette offre n’est pas disponible.', 400);
  if (produit.mode_commande !== 'devis') throw new DevisError('Cette offre se commande directement, sans devis.', 400);

  // Anti-abus : quelques demandes ouvertes par numéro, une seule par offre.
  const { data: ouvertes, error: e2 } = await admin.from('quote_requests')
    .select('product_id').eq('customer_phone', input.customerPhone).in('status', ['demande', 'proposee']);
  if (e2) indisponible();
  if ((ouvertes || []).some((o) => o.product_id === produit.id)) {
    throw new DevisError('Vous avez déjà une demande en cours pour cette offre. Retrouvez-la dans « Suivre ma commande ».', 409);
  }
  if ((ouvertes || []).length >= DEMANDES_OUVERTES_MAX) throw new DevisError('Trop de demandes en cours pour ce numéro. Attendez une réponse avant d’en envoyer d’autres.', 429);

  let revendeur: { id: string; full_name: string; reseller_code: string } | null = null;
  if (input.resellerCode) {
    const r = await admin.from('profiles').select('id, full_name, reseller_code').eq('reseller_code', input.resellerCode).maybeSingle();
    if (r.error) indisponible();
    revendeur = r.data || null;
  }

  const quoteNumber = `DV-${genererNumeroCommande().slice(3)}`;
  const { error } = await admin.from('quote_requests').insert({
    quote_number: quoteNumber, access_key_hash: cleHash,
    product_id: produit.id, supplier_id: produit.supplier_id || null,
    reseller_id: revendeur?.id || null, reseller_code: revendeur?.reseller_code || null, reseller_name: revendeur?.full_name || null,
    customer_name: input.customerName, customer_phone: input.customerPhone,
    city: input.city, neighborhood: input.neighborhood, landmark: input.landmark || null,
    quantite: input.quantite, besoin: input.besoin, status: 'demande',
  });
  if (error) {
    console.error('[DEVIS CREATE]', error.code);
    indisponible();
  }
  return { quoteNumber, created: true };
}

// ── 2. Proposition du fournisseur ───────────────────────────────────────────
export async function proposerDevis(admin: SupabaseClient, fournisseurId: string, value: unknown) {
  const v = (value || {}) as Record<string, unknown>;
  const quoteId = typeof v.quoteId === 'string' ? v.quoteId : '';
  const prixTotal = Math.round(Number(v.prixTotal));
  const partTotale = Math.round(Number(v.partRevendeur ?? 0));
  const jours = Math.round(Number(v.validiteJours ?? VALIDITE_JOURS_DEFAUT));
  const conditions = typeof v.conditions === 'string' ? v.conditions.trim().slice(0, 2000) : '';
  if (!quoteId) throw new DevisError('Demande manquante.', 400);
  if (!Number.isFinite(prixTotal) || prixTotal < 500 || prixTotal > 500_000_000) throw new DevisError('Indiquez votre prix (en FCFA).', 400);
  if (!Number.isFinite(partTotale) || partTotale < 0 || partTotale >= prixTotal) throw new DevisError('Part du revendeur invalide.', 400);
  if (!Number.isInteger(jours) || jours < 1 || jours > 60) throw new DevisError('Validité : entre 1 et 60 jours.', 400);

  const { data: q, error } = await admin.from('quote_requests').select('*').eq('id', quoteId).maybeSingle();
  if (error) indisponible();
  if (!q || q.supplier_id !== fournisseurId) throw new DevisError('Demande introuvable.', 404);
  if (!['demande', 'proposee'].includes(q.status)) throw new DevisError('Cette demande est déjà traitée.', 409);

  const { data: produit } = await admin.from('products').select('*').eq('id', q.product_id).maybeSingle();
  if (!produit) throw new DevisError('Offre introuvable.', 404);
  const { reglages, majLe } = await reglagesEnBase(admin);
  const depot = (await depotsFournisseurs(admin, [fournisseurId])).get(fournisseurId) || {};
  const remise = remiseDuProduit(produit);
  const devis = calculerProposition(
    { prixTotal, partRevendeurTotale: partTotale, quantite: q.quantite, remise, revendeurAttribue: Boolean(q.reseller_id) },
    { ville: q.city, quartierClient: q.neighborhood || undefined, quartierFournisseur: depot.quartier, positionFournisseur: depot.position },
    reglages,
  );
  if (devis.tarif.statut === 'sous_plancher' || !Number.isFinite(devis.total) || devis.total <= 0) {
    throw new DevisError('Ce prix ne permet pas de vendre : augmentez-le ou réduisez la part du revendeur.', 409);
  }
  const valable = new Date(Date.now() + jours * 86_400_000).toISOString();
  const { data: maj, error: e2 } = await admin.from('quote_requests').update({
    status: 'proposee', prix_fournisseur: prixTotal, part_revendeur: partTotale,
    conditions: conditions || null, valable_jusqu: valable,
    proposition: { devis, remise, reglagesDu: majLe, calculeLe: new Date().toISOString() },
    proposed_at: new Date().toISOString(),
  }).eq('id', quoteId).in('status', ['demande', 'proposee']).select('id').maybeSingle();
  if (e2) indisponible();
  if (!maj) throw new DevisError('Cette demande vient d’être traitée. Rechargez la page.', 409);
  return { totalClient: devis.total, gainRevendeur: devis.commissionTotale, valableJusqu: valable };
}

export async function refuserDemande(admin: SupabaseClient, fournisseurId: string, value: unknown) {
  const v = (value || {}) as Record<string, unknown>;
  const quoteId = typeof v.quoteId === 'string' ? v.quoteId : '';
  const motif = typeof v.motif === 'string' ? v.motif.trim().slice(0, 500) : '';
  if (!quoteId) throw new DevisError('Demande manquante.', 400);
  if (!motif) throw new DevisError('Indiquez le motif (hors zone, indisponible…).', 400);
  const { data, error } = await admin.from('quote_requests')
    .update({ status: 'refusee_fournisseur', motif_refus: motif, decided_at: new Date().toISOString() })
    .eq('id', quoteId).eq('supplier_id', fournisseurId).in('status', ['demande', 'proposee']).select('id').maybeSingle();
  if (error) indisponible();
  if (!data) throw new DevisError('Demande introuvable ou déjà traitée.', 409);
  return { ok: true };
}

// ── 3. Côté client ──────────────────────────────────────────────────────────
async function devisDuClient(admin: SupabaseClient, numero: unknown, cle: unknown) {
  if (typeof numero !== 'string' || !numero.trim() || typeof cle !== 'string' || !CLE.test(cle)) {
    throw new DevisError('Ce devis s’ouvre sur le téléphone qui l’a demandé.', 403);
  }
  const { data, error } = await admin.from('quote_requests').select('*')
    .eq('quote_number', numero.trim()).eq('access_key_hash', hashCle(cle)).maybeSingle();
  if (error) indisponible();
  if (!data) throw new DevisError('Ce devis s’ouvre sur le téléphone qui l’a demandé.', 403);
  return data;
}

/** Vue client : jamais le prix du fournisseur ni la commission. */
export async function lireDevisClient(admin: SupabaseClient, numero: unknown, cle: unknown) {
  const q = await devisDuClient(admin, numero, cle);
  const { data: produit } = await admin.from('products').select('name, slug, images').eq('id', q.product_id).maybeSingle();
  const d = q.proposition?.devis as Devis | undefined;
  const expire = q.status === 'proposee' && q.valable_jusqu && Date.parse(q.valable_jusqu) < Date.now();
  return {
    numero: q.quote_number,
    statut: expire ? 'expiree' : q.status,
    creeLe: q.created_at,
    produit: { nom: produit?.name || '', slug: produit?.slug || null, image: Array.isArray(produit?.images) ? produit.images[0] || null : null },
    quantite: q.quantite,
    besoin: q.besoin,
    prix: d && q.status !== 'demande' ? {
      articles: d.montantArticles, livraison: d.fraisLivraison, modeLivraison: d.modeLivraison, total: d.total,
    } : null,
    conditions: q.conditions || null,
    valableJusqu: q.valable_jusqu || null,
    motifRefus: q.status === 'refusee_fournisseur' ? q.motif_refus || null : null,
    orderNumber: q.order_number || null,
  };
}

export async function deciderDevisClient(admin: SupabaseClient, numero: unknown, cle: unknown, decision: unknown) {
  const q = await devisDuClient(admin, numero, cle);

  if (decision === 'refuser') {
    if (!['demande', 'proposee'].includes(q.status)) throw new DevisError('Ce devis est déjà traité.', 409);
    const { error } = await admin.from('quote_requests').update({ status: 'refusee_client', decided_at: new Date().toISOString() })
      .eq('id', q.id).in('status', ['demande', 'proposee']);
    if (error) indisponible();
    return { statut: 'refusee_client' as const };
  }
  if (decision !== 'accepter') throw new DevisError('Décision inconnue.', 400);
  if (!['proposee', 'acceptee'].includes(q.status) || !q.proposition?.devis) throw new DevisError('Ce devis ne peut plus être accepté.', 409);
  if (q.status === 'proposee' && q.valable_jusqu && Date.parse(q.valable_jusqu) < Date.now()) {
    throw new DevisError('Ce devis a expiré. Demandez-en un nouveau.', 410);
  }

  const { data: produit, error: e1 } = await admin.from('products').select('*').eq('id', q.product_id).maybeSingle();
  if (e1) indisponible();
  if (!produit || produit.status !== 'approved') throw new DevisError('Cette offre n’est plus disponible.', 409);

  const devis = q.proposition.devis as Devis;
  const remise = (q.proposition.remise || remiseDuProduit(produit)) as RemiseOffre;
  const now = new Date().toISOString();
  const row = {
    id: randomUUID(), order_number: genererNumeroCommande(),
    product_id: produit.id, product_name: produit.name,
    product_image: Array.isArray(produit.images) ? produit.images[0] || null : null,
    reseller_id: q.reseller_id || null, reseller_name: q.reseller_name || null,
    reseller_code: q.reseller_code || null, reseller_commission: devis.commissionTotale,
    quantity: devis.quantite, unit_price: devis.prixUnitaire,
    total_product_amount: devis.montantArticles, delivery_fee: devis.fraisLivraison,
    total_amount: devis.total, platform_margin: devis.margeSuguba,
    pricing_snapshot: {
      devis, reglagesDu: q.proposition.reglagesDu || null, calculeLe: q.proposition.calculeLe || now,
      livraison: { position: null }, remise,
      // Commande née d'un devis accepté : prix figé à la proposition.
      devisAccepte: { numero: q.quote_number, accepteLe: now },
    },
    customer_name: q.customer_name, customer_phone: q.customer_phone,
    city: devis.ville || q.city, neighborhood: q.neighborhood || '', landmark: q.landmark || '',
    delivery_notes: `Devis ${q.quote_number} : ${String(q.besoin).slice(0, 500)}`,
    status: 'pending_call', delivery_otp: String(randomInt(1000, 10000)),
    payment_method: 'cash_on_delivery', payment_collected: false, created_at: now,
  };
  // Clé du devis = clé du reçu : même personne, même téléphone. Une nouvelle
  // tentative (double clic, coupure) rend le même reçu, sans doublon.
  const { data, error } = await admin.rpc('create_order_with_commission', {
    p_key_hash: hashCle(String(cle)),
    p_fingerprint: createHash('sha256').update(`devis:${q.id}`).digest('hex'),
    p_order: row,
    p_product: {
      supplier_price: Number(produit.supplier_price), public_price: Number(produit.public_price),
      commission_proposee: produit.commission_proposee == null ? null : Number(produit.commission_proposee),
    },
  });
  if (error) {
    if (error.message === 'STOCK_UNAVAILABLE') throw new DevisError('Plus de disponibilité pour cette offre. Contactez Suguba.', 409);
    if (error.code === '40001') throw new DevisError('L’offre vient d’être modifiée. Réessayez dans un instant.', 409);
    console.error('[DEVIS ACCEPT]', error.code);
    indisponible();
  }
  if (!data?.order) indisponible();
  const commande = recu(data.order);
  await admin.from('quote_requests').update({
    status: 'acceptee', order_id: commande.id, order_number: commande.orderNumber, decided_at: now,
  }).eq('id', q.id).eq('status', 'proposee');
  return { statut: 'acceptee' as const, order: commande };
}

// ── 4. Liste du fournisseur ─────────────────────────────────────────────────
export async function listerDevisFournisseur(admin: SupabaseClient, fournisseurId: string) {
  const { data, error } = await admin.from('quote_requests').select('*')
    .eq('supplier_id', fournisseurId).order('created_at', { ascending: false }).limit(200);
  if (error) {
    if (['42P01', 'PGRST205'].includes(String(error.code))) return { devis: [], migrationRequise: true };
    indisponible();
  }
  const ids = [...new Set((data || []).map((q) => q.product_id))];
  const noms = new Map<string, string>();
  if (ids.length) {
    const { data: produits } = await admin.from('products').select('id, name').in('id', ids);
    for (const p of produits || []) noms.set(p.id, p.name);
  }
  return {
    migrationRequise: false,
    devis: (data || []).map((q) => {
      const ouvert = ['demande', 'proposee'].includes(q.status);
      const d = q.proposition?.devis as Devis | undefined;
      const expire = q.status === 'proposee' && q.valable_jusqu && Date.parse(q.valable_jusqu) < Date.now();
      return {
        id: q.id, numero: q.quote_number, statut: expire ? 'expiree' : q.status, creeLe: q.created_at,
        produit: noms.get(q.product_id) || '', quantite: q.quantite, besoin: q.besoin,
        lieu: [q.neighborhood, q.city].filter(Boolean).join(', '),
        // Le fournisseur doit pouvoir qualifier le besoin : contact tant que la demande est ouverte.
        client: { nom: q.customer_name, telephone: ouvert ? q.customer_phone : null, repere: ouvert ? q.landmark || null : null },
        viaRevendeur: Boolean(q.reseller_id),
        proposition: d ? {
          prixFournisseur: Number(q.prix_fournisseur) || 0, partRevendeur: Number(q.part_revendeur) || 0,
          totalClient: d.total, gainRevendeur: d.commissionTotale, conditions: q.conditions || null, valableJusqu: q.valable_jusqu,
        } : null,
        motifRefus: q.motif_refus || null,
        commande: q.order_number || null,
      };
    }),
  };
}
