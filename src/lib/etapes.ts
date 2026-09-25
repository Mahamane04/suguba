import type { SupabaseClient } from '@supabase/supabase-js';
import { ETAPES, etapesCommande, libelleEtape, type CleEtape } from './offre';
import { assurerBucketPrive } from './sav-photos';
import { notifier } from './reseau/notifications';

/**
 * Prestations à étapes (2026-09-26, lot 1c) — SERVEUR UNIQUEMENT.
 *
 *   fournisseur : déclare une étape terminée, avec sa preuve (note, date,
 *                 photos). Jamais il ne la valide lui-même.
 *   client      : valide ou conteste depuis son reçu (clé du reçu vérifiée
 *                 par la route appelante).
 *   admin       : tranche une contestation (valide après appel, ou rouvre).
 *
 * Les étapes suivent l'ordre du parcours : on ne déclare l'étape N qu'une fois
 * l'étape N-1 validée. La réception finale (scan du reçu QR) n'est acceptée
 * que quand TOUTES sont validées — vérifié ici et, en dernier recours, par un
 * déclencheur en base (voir A-EXECUTER-2026-09-26-prestations-etapes.sql).
 */

export const BUCKET_PHOTOS_ETAPES = 'etapes-photos';
export const PHOTOS_ETAPE_MAX = 3;

export class EtapeError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export type StatutEtape = 'a_faire' | 'declaree' | 'validee' | 'contestee';

export interface EtapeCommande {
  position: number;
  cle: CleEtape;
  libelle: string;
  preuveAttendue: string;
  statut: StatutEtape;
  note: string | null;
  datePrevue: string | null;
  photos: number;
  declareeLe: string | null;
  valideeLe: string | null;
  valideePar: 'client' | 'admin' | null;
  motifContestation: string | null;
  noteAdmin: string | null;
}

const COLONNES_COMMANDE = 'id, order_number, status, assigned_driver_id, pricing_snapshot, product_name, product_id';
const tableAbsente = (code: unknown) => ['42P01', 'PGRST205'].includes(String(code));
const indisponible = (): never => { throw new EtapeError('Service indisponible. Réessayez.', 503); };

function versEtape(r: any): EtapeCommande {
  const def = ETAPES.find((e) => e.cle === r.cle);
  return {
    position: Number(r.position),
    cle: r.cle,
    libelle: libelleEtape(r.cle),
    preuveAttendue: def?.preuve || '',
    statut: r.statut,
    note: r.note || null,
    datePrevue: r.date_prevue || null,
    photos: Number(r.photos) || 0,
    declareeLe: r.declared_at || null,
    valideeLe: r.validated_at || null,
    valideePar: r.validated_by || null,
    motifContestation: r.contest_reason || null,
    noteAdmin: r.admin_note || null,
  };
}

/** Étapes de plusieurs commandes. Table absente (SQL pas encore exécuté) = aucune. */
export async function lireEtapes(admin: SupabaseClient, orderIds: string[]): Promise<Map<string, EtapeCommande[]>> {
  const parCommande = new Map<string, EtapeCommande[]>();
  const ids = [...new Set(orderIds.filter(Boolean))];
  if (!ids.length) return parCommande;
  const { data, error } = await admin.from('order_steps').select('*').in('order_id', ids).order('position', { ascending: true });
  if (error) {
    if (tableAbsente(error.code)) return parCommande;
    indisponible();
  }
  for (const r of data || []) {
    const liste = parCommande.get(r.order_id) || [];
    liste.push(versEtape(r));
    parCommande.set(r.order_id, liste.sort((a, b) => a.position - b.position));
  }
  return parCommande;
}

/**
 * Crée les étapes d'une commande à partir de son instantané (idempotent :
 * une étape déjà créée n'est jamais réécrite).
 */
export async function assurerEtapes(admin: SupabaseClient, commande: { id: string; pricing_snapshot: unknown }): Promise<number> {
  const cles = etapesCommande(commande.pricing_snapshot);
  if (!cles.length) return 0;
  const { error } = await admin.from('order_steps').upsert(
    cles.map((cle, i) => ({ order_id: commande.id, position: i + 1, cle })),
    { onConflict: 'order_id,position', ignoreDuplicates: true },
  );
  if (error) {
    if (tableAbsente(error.code)) throw new EtapeError('Les prestations à étapes seront disponibles après la mise à jour de la base par Suguba.', 503);
    indisponible();
  }
  return cles.length;
}

/** Nombre d'étapes pas encore validées par le client (0 = réception finale possible). */
export async function etapesNonValidees(admin: SupabaseClient, commande: { id: string; pricing_snapshot: unknown }): Promise<number> {
  if (!etapesCommande(commande.pricing_snapshot).length) return 0;
  await assurerEtapes(admin, commande);
  const etapes = (await lireEtapes(admin, [commande.id])).get(commande.id) || [];
  return etapes.filter((e) => e.statut !== 'validee').length;
}

async function commandeParId(admin: SupabaseClient, orderId: string) {
  const { data, error } = await admin.from('orders').select(COLONNES_COMMANDE).eq('id', orderId).maybeSingle();
  if (error) indisponible();
  if (!data) throw new EtapeError('Commande introuvable.', 404);
  return data;
}

async function deposerPhotos(admin: SupabaseClient, orderId: string, position: number, photos: Buffer[]) {
  const dossier = `${orderId}/${position}`;
  await assurerBucketPrive(admin, BUCKET_PHOTOS_ETAPES);
  // Une étape redéclarée (après contestation) remplace ses anciennes photos.
  const { data: anciennes } = await admin.storage.from(BUCKET_PHOTOS_ETAPES).list(dossier, { limit: 10 });
  if (anciennes?.length) await admin.storage.from(BUCKET_PHOTOS_ETAPES).remove(anciennes.map((f) => `${dossier}/${f.name}`));
  const deposees: string[] = [];
  try {
    for (const [i, image] of photos.entries()) {
      const chemin = `${dossier}/${i + 1}.webp`;
      const { error } = await admin.storage.from(BUCKET_PHOTOS_ETAPES).upload(chemin, image, { contentType: 'image/webp', upsert: true });
      if (error) throw new Error(error.message);
      deposees.push(chemin);
    }
  } catch (e) {
    if (deposees.length) await admin.storage.from(BUCKET_PHOTOS_ETAPES).remove(deposees);
    throw e;
  }
}

/** Liens temporaires (10 min) vers les photos d'une étape. */
export async function liensPhotosEtape(admin: SupabaseClient, orderId: string, position: number): Promise<string[]> {
  const dossier = `${orderId}/${position}`;
  const { data, error } = await admin.storage.from(BUCKET_PHOTOS_ETAPES).list(dossier, { limit: PHOTOS_ETAPE_MAX + 2 });
  if (error || !data?.length) return [];
  const chemins = data.map((f) => `${dossier}/${f.name}`).sort();
  const { data: signes } = await admin.storage.from(BUCKET_PHOTOS_ETAPES).createSignedUrls(chemins, 600);
  return (signes || []).map((s) => s.signedUrl).filter((u): u is string => Boolean(u));
}

// ── Fournisseur : déclarer une étape ─────────────────────────────────────────
export async function declarerEtape(
  admin: SupabaseClient,
  fournisseurId: string,
  params: { orderId: unknown; position: unknown; note?: unknown; datePrevue?: unknown; photos?: Buffer[] },
): Promise<EtapeCommande> {
  const orderId = typeof params.orderId === 'string' ? params.orderId : '';
  const position = Math.round(Number(params.position));
  const note = typeof params.note === 'string' ? params.note.trim().slice(0, 1000) : '';
  const photos = params.photos || [];
  if (!orderId || !Number.isInteger(position) || position < 1) throw new EtapeError('Étape manquante.', 400);
  if (photos.length > PHOTOS_ETAPE_MAX) throw new EtapeError(`${PHOTOS_ETAPE_MAX} photos au maximum.`, 400);

  const commande = await commandeParId(admin, orderId);
  if (commande.assigned_driver_id !== fournisseurId) throw new EtapeError('Cette commande ne vous est pas assignée.', 403);
  if (commande.status !== 'in_transit') throw new EtapeError('Organisez d’abord la remise de cette commande.', 409);
  await assurerEtapes(admin, commande);
  const etapes = (await lireEtapes(admin, [orderId])).get(orderId) || [];
  const etape = etapes.find((e) => e.position === position);
  if (!etape) throw new EtapeError('Étape introuvable.', 404);
  if (etape.statut === 'validee') throw new EtapeError('Cette étape est déjà validée par le client.', 409);
  if (etape.statut === 'declaree') throw new EtapeError('Étape déjà déclarée : le client doit la valider.', 409);
  if (etapes.some((e) => e.position < position && e.statut !== 'validee')) {
    throw new EtapeError('Faites d’abord valider l’étape précédente par le client.', 409);
  }

  let datePrevue: string | null = null;
  if (etape.cle === 'rendez_vous') {
    const t = typeof params.datePrevue === 'string' ? Date.parse(params.datePrevue) : NaN;
    if (!Number.isFinite(t)) throw new EtapeError('Indiquez la date et l’heure du rendez-vous.', 400);
    if (t < Date.now() - 86_400_000 || t > Date.now() + 180 * 86_400_000) throw new EtapeError('Date de rendez-vous invalide.', 400);
    datePrevue = new Date(t).toISOString();
  } else if (note.length < 5 && photos.length === 0) {
    // Sans preuve, le client n'a rien à vérifier.
    throw new EtapeError('Ajoutez une photo ou décrivez ce qui a été fait.', 400);
  }

  if (photos.length) {
    try { await deposerPhotos(admin, orderId, position, photos); } catch (e) {
      console.error('[ETAPES photos]', (e as Error).message);
      throw new EtapeError('Envoi des photos impossible. Réessayez.', 503);
    }
  }

  const { data, error } = await admin.from('order_steps').update({
    statut: 'declaree', note: note || null, date_prevue: datePrevue, photos: photos.length,
    declared_at: new Date().toISOString(),
  }).eq('order_id', orderId).eq('position', position).in('statut', ['a_faire', 'contestee']).select('*').maybeSingle();
  if (error) indisponible();
  if (!data) throw new EtapeError('Cette étape vient de changer. Rechargez la page.', 409);
  return versEtape(data);
}

// ── Client : valider ou contester (clé du reçu vérifiée par la route) ────────
export async function repondreEtape(
  admin: SupabaseClient,
  orderNumber: string,
  params: { position: unknown; decision: unknown; motif?: unknown },
): Promise<EtapeCommande> {
  const position = Math.round(Number(params.position));
  const motif = typeof params.motif === 'string' ? params.motif.trim().slice(0, 1000) : '';
  if (!Number.isInteger(position) || position < 1) throw new EtapeError('Étape manquante.', 400);
  if (params.decision !== 'valider' && params.decision !== 'contester') throw new EtapeError('Réponse inconnue.', 400);
  if (params.decision === 'contester' && motif.length < 5) throw new EtapeError('Expliquez ce qui ne va pas.', 400);

  const { data: commande, error: e1 } = await admin.from('orders').select(COLONNES_COMMANDE).eq('order_number', orderNumber).maybeSingle();
  if (e1) indisponible();
  if (!commande) throw new EtapeError('Commande introuvable.', 404);

  const now = new Date().toISOString();
  const maj = params.decision === 'valider'
    ? { statut: 'validee', validated_at: now, validated_by: 'client' }
    : { statut: 'contestee', contest_reason: motif, contested_at: now };
  const { data, error } = await admin.from('order_steps').update(maj)
    .eq('order_id', commande.id).eq('position', position).eq('statut', 'declaree').select('*').maybeSingle();
  if (error) indisponible();
  if (!data) throw new EtapeError('Cette étape n’attend pas votre réponse. Rechargez la page.', 409);
  const etape = versEtape(data);

  if (commande.assigned_driver_id) {
    await notifier(commande.assigned_driver_id, params.decision === 'valider'
      ? { type: 'prestation', titre: `Étape validée · ${etape.libelle}`, texte: `Le client a validé cette étape de la commande #${commande.order_number}.`, lien: '/supplier/commandes' }
      : { type: 'prestation', titre: `Étape contestée · ${etape.libelle}`, texte: `Commande #${commande.order_number} : le client signale un problème. Corrigez puis déclarez l’étape à nouveau. Suguba peut vous appeler.`, lien: '/supplier/commandes' });
  }
  return etape;
}

// ── Admin : trancher une contestation ────────────────────────────────────────
export async function trancherEtape(
  admin: SupabaseClient,
  params: { orderId: unknown; position: unknown; action: unknown; note?: unknown },
): Promise<EtapeCommande> {
  const orderId = typeof params.orderId === 'string' ? params.orderId : '';
  const position = Math.round(Number(params.position));
  const note = typeof params.note === 'string' ? params.note.trim().slice(0, 1000) : '';
  if (!orderId || !Number.isInteger(position) || position < 1) throw new EtapeError('Étape manquante.', 400);
  if (params.action !== 'valider' && params.action !== 'rouvrir') throw new EtapeError('Action inconnue.', 400);
  // Valider à la place du client doit toujours être justifié (appel, visite…).
  if (note.length < 5) throw new EtapeError('Indiquez la raison (ex. « client appelé, travail conforme »).', 400);

  const commande = await commandeParId(admin, orderId);
  const maj = params.action === 'valider'
    ? { statut: 'validee', validated_at: new Date().toISOString(), validated_by: 'admin', admin_note: note }
    : { statut: 'a_faire', admin_note: note, declared_at: null };
  const { data, error } = await admin.from('order_steps').update(maj)
    .eq('order_id', orderId).eq('position', position).in('statut', ['declaree', 'contestee']).select('*').maybeSingle();
  if (error) indisponible();
  if (!data) throw new EtapeError('Cette étape n’est pas en attente. Rechargez la page.', 409);
  const etape = versEtape(data);
  if (commande.assigned_driver_id) {
    await notifier(commande.assigned_driver_id, {
      type: 'prestation',
      titre: params.action === 'valider' ? `Étape validée par Suguba · ${etape.libelle}` : `Étape à refaire · ${etape.libelle}`,
      texte: `Commande #${commande.order_number} : ${note}`,
      lien: '/supplier/commandes',
    });
  }
  return etape;
}

// ── Admin : prestations qui demandent une attention ──────────────────────────
/** Une étape déclarée sans réponse du client depuis ce délai est signalée. */
export const ATTENTE_CLIENT_HEURES = 48;

export async function listerEtapesAdmin(admin: SupabaseClient) {
  const { data, error } = await admin.from('order_steps').select('order_id')
    .in('statut', ['declaree', 'contestee', 'a_faire']).order('created_at', { ascending: false }).limit(1000);
  if (error) {
    if (tableAbsente(error.code)) return { prestations: [], migrationRequise: true, attenteHeures: ATTENTE_CLIENT_HEURES };
    indisponible();
  }
  const ids = [...new Set((data || []).map((r) => r.order_id as string))];
  if (!ids.length) return { prestations: [], migrationRequise: false, attenteHeures: ATTENTE_CLIENT_HEURES };
  const [{ data: commandes, error: e2 }, etapes] = await Promise.all([
    admin.from('orders').select('id, order_number, status, product_name, customer_name, customer_phone, assigned_driver_name, created_at').in('id', ids),
    lireEtapes(admin, ids),
  ]);
  if (e2) indisponible();
  const maintenant = Date.now();
  const prestations = (commandes || [])
    .filter((o) => !['cancelled', 'returned', 'delivered'].includes(o.status))
    .map((o) => {
      const liste = etapes.get(o.id) || [];
      const contestee = liste.some((e) => e.statut === 'contestee');
      const sansReponse = liste.some((e) => e.statut === 'declaree' && Boolean(e.declareeLe)
        && maintenant - Date.parse(e.declareeLe as string) > ATTENTE_CLIENT_HEURES * 3_600_000);
      return {
        orderId: o.id, numero: o.order_number, produit: o.product_name, creeLe: o.created_at,
        client: { nom: o.customer_name, telephone: o.customer_phone },
        fournisseur: o.assigned_driver_name || null,
        etapes: liste, contestee, sansReponse,
        validees: liste.filter((e) => e.statut === 'validee').length,
      };
    })
    .sort((a, b) => Number(b.contestee) - Number(a.contestee) || Number(b.sansReponse) - Number(a.sansReponse));
  return { prestations, migrationRequise: false, attenteHeures: ATTENTE_CLIENT_HEURES };
}
