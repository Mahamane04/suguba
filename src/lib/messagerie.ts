import type { SupabaseClient } from '@supabase/supabase-js';
import { analyserMessage, LIBELLE_MOTIF, type MotifMessage } from './protection';
import { notifier } from './reseau/notifications';
import { devisAccessible } from './devis';
import { nomMasque } from './acces-contacts';

/**
 * Messagerie interne (2026-09-26, Protection Suguba — lot 3) — SERVEUR.
 *
 * Chaque échange est rattaché à un DOSSIER :
 *   • « offre » : un revendeur pose une question au fournisseur d'un produit ;
 *   • « devis » : le client (clé de son devis) et le fournisseur échangent.
 * Les montants et conditions ne se négocient pas ici : ils passent par les
 * actions prévues (devis, commande). Un message qui contient un numéro, un
 * lien, une adresse e-mail ou une invitation à traiter hors Suguba ATTEND la
 * vérification de l'équipe avant d'être remis ; une référence de pièce ou un
 * numéro de série passe.
 */

export class MessageError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export type Auteur = { type: 'revendeur' | 'fournisseur' | 'client'; id: string | null };
export const MESSAGES_PAR_JOUR = 30;
const tableAbsente = (code: unknown) => ['42P01', 'PGRST205'].includes(String(code));
function indisponible(e: { code?: string } | null): never {
  if (e && tableAbsente(e.code)) throw new MessageError('La messagerie sera disponible après la mise à jour de la base par Suguba.', 503);
  throw new MessageError('Messagerie indisponible. Réessayez.', 503);
}

// ── Ouvrir un fil ───────────────────────────────────────────────────────────
export async function ouvrirFilOffre(admin: SupabaseClient, revendeurId: string, produitId: unknown) {
  if (typeof produitId !== 'string' || !produitId) throw new MessageError('Produit manquant.', 400);
  const { data: p } = await admin.from('products').select('id, supplier_id, status').eq('id', produitId).maybeSingle();
  if (!p || p.status !== 'approved' || !p.supplier_id) throw new MessageError('Produit introuvable.', 404);
  if (p.supplier_id === revendeurId) throw new MessageError('C’est votre propre produit.', 400);
  return ouvrir(admin, { sujet_type: 'offre', sujet_id: p.id, fournisseur_id: p.supplier_id, revendeur_id: revendeurId });
}

export async function ouvrirFilDevis(admin: SupabaseClient, quote: { id: string; supplier_id: string | null }) {
  if (!quote.supplier_id) throw new MessageError('Devis sans fournisseur.', 400);
  return ouvrir(admin, { sujet_type: 'devis', sujet_id: quote.id, fournisseur_id: quote.supplier_id, revendeur_id: null });
}

async function ouvrir(
  admin: SupabaseClient, ligne: { sujet_type: string; sujet_id: string; fournisseur_id: string; revendeur_id: string | null }, essai = 0,
): Promise<{ id: string }> {
  let q = admin.from('conversations').select('id').eq('sujet_type', ligne.sujet_type).eq('sujet_id', ligne.sujet_id);
  q = ligne.revendeur_id ? q.eq('revendeur_id', ligne.revendeur_id) : q.is('revendeur_id', null);
  const { data: existant, error } = await q.maybeSingle();
  if (error) indisponible(error);
  if (existant) return { id: existant.id as string };
  const { data, error: e2 } = await admin.from('conversations').insert(ligne).select('id').maybeSingle();
  if (e2?.code === '23505' && essai === 0) return ouvrir(admin, ligne, 1); // créé au même instant ailleurs
  if (e2 || !data) indisponible(e2);
  return { id: data.id as string };
}

// ── Accès ───────────────────────────────────────────────────────────────────
async function conversation(admin: SupabaseClient, id: unknown) {
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) throw new MessageError('Conversation introuvable.', 404);
  const { data, error } = await admin.from('conversations').select('*').eq('id', id).maybeSingle();
  if (error) indisponible(error);
  if (!data) throw new MessageError('Conversation introuvable.', 404);
  return data;
}

function autorise(c: any, auteur: Auteur): boolean {
  if (auteur.type === 'revendeur') return c.sujet_type === 'offre' && c.revendeur_id === auteur.id;
  if (auteur.type === 'fournisseur') return c.fournisseur_id === auteur.id;
  return false; // le client passe par la clé de son devis (fil déjà vérifié)
}

/** Le client du devis (numéro + clé du téléphone) ouvre le fil de son devis. */
export async function filDuClient(admin: SupabaseClient, numero: unknown, cle: unknown) {
  const q = await devisAccessible(admin, numero, cle).catch(() => null);
  if (!q) throw new MessageError('Ce devis s’ouvre sur le téléphone qui l’a demandé.', 403);
  return ouvrirFilDevis(admin, { id: q.id, supplier_id: q.supplier_id });
}

// ── Lire ────────────────────────────────────────────────────────────────────
export interface MessageVue {
  id: string; auteur: 'revendeur' | 'fournisseur' | 'client' | 'suguba'; deMoi: boolean; texte: string;
  statut: 'publie' | 'en_attente' | 'refuse'; motifRefus: string | null; envoyeLe: string;
}

export async function lireFil(admin: SupabaseClient, conversationId: unknown, lecteur: Auteur, dejaVerifie = false) {
  const c = await conversation(admin, conversationId);
  if (!dejaVerifie && !autorise(c, lecteur)) throw new MessageError('Conversation introuvable.', 404);
  const { data, error } = await admin.from('messages').select('*').eq('conversation_id', c.id).order('created_at', { ascending: true }).limit(300);
  if (error) indisponible(error);
  const estDeMoi = (m: any) => m.auteur_type === lecteur.type && (lecteur.type === 'client' || m.auteur_id === lecteur.id);
  const messages: MessageVue[] = (data || [])
    // Un message en vérification ou refusé n'est montré qu'à son auteur.
    .filter((m) => m.statut === 'publie' || estDeMoi(m))
    .map((m) => ({
      id: m.id, auteur: m.auteur_type, deMoi: estDeMoi(m), texte: m.texte, statut: m.statut,
      motifRefus: m.motif_refus || null, envoyeLe: m.created_at,
    }));
  return { conversation: { id: c.id as string, sujet: c.sujet_type as string, sujetId: c.sujet_id as string }, messages };
}

// ── Écrire ──────────────────────────────────────────────────────────────────
export async function envoyer(admin: SupabaseClient, conversationId: unknown, auteur: Auteur, texteBrut: unknown, dejaVerifie = false) {
  const texte = typeof texteBrut === 'string' ? texteBrut.trim().slice(0, 1000) : '';
  if (!texte) throw new MessageError('Écrivez votre message.', 400);
  const c = await conversation(admin, conversationId);
  if (!dejaVerifie && !autorise(c, auteur)) throw new MessageError('Conversation introuvable.', 404);

  // Anti-abus : un nombre raisonnable de messages par jour et par auteur.
  const depuis = new Date(Date.now() - 86_400_000).toISOString();
  let q = admin.from('messages').select('id', { count: 'exact', head: true }).eq('auteur_type', auteur.type).gte('created_at', depuis);
  q = auteur.id ? q.eq('auteur_id', auteur.id) : q.eq('conversation_id', c.id);
  const { count } = await q;
  if ((count || 0) >= MESSAGES_PAR_JOUR) throw new MessageError('Trop de messages aujourd’hui. Réessayez demain.', 429);

  const motifs = analyserMessage(texte);
  const statut = motifs.length ? 'en_attente' : 'publie';
  const { error } = await admin.from('messages').insert({ conversation_id: c.id, auteur_type: auteur.type, auteur_id: auteur.id, texte, statut, motifs });
  if (error) indisponible(error);
  await admin.from('conversations').update({ dernier_message_le: new Date().toISOString() }).eq('id', c.id);
  if (statut === 'publie') await prevenir(c, auteur.type);
  return {
    statut,
    avertissement: motifs.length
      ? `Votre message contient ${motifs.map((m) => LIBELLE_MOTIF[m as MotifMessage]).join(', ')} : l’équipe Suguba le vérifie avant de le remettre. Les échanges, prix et paiements restent dans Suguba.`
      : null,
  };
}

async function prevenir(c: any, de: string) {
  const lien = c.sujet_type === 'offre' ? (de === 'revendeur' ? '/supplier/questions' : '/reseller/questions') : '/supplier/devis';
  const dest = de === 'revendeur' ? c.fournisseur_id : de === 'fournisseur' ? c.revendeur_id : c.fournisseur_id;
  if (!dest) return; // le client sans compte voit la réponse sur son devis
  await notifier(dest, { type: 'info', titre: c.sujet_type === 'offre' ? 'Nouvelle question sur une offre' : 'Nouveau message sur un devis', texte: 'Ouvrez la conversation pour répondre.', lien });
}

// ── Listes ──────────────────────────────────────────────────────────────────
export async function mesFils(admin: SupabaseClient, qui: Auteur) {
  let q = admin.from('conversations').select('*').eq('sujet_type', 'offre').order('dernier_message_le', { ascending: false, nullsFirst: false }).limit(100);
  q = qui.type === 'revendeur' ? q.eq('revendeur_id', qui.id) : q.eq('fournisseur_id', qui.id);
  const { data, error } = await q;
  if (error) { if (tableAbsente(error.code)) return []; indisponible(error); }
  const lignes = (data || []).filter((c) => c.dernier_message_le);
  if (!lignes.length) return [];
  const idsRevendeurs = [...new Set(lignes.map((c) => c.revendeur_id).filter(Boolean))];
  const [{ data: produits }, { data: profils }] = await Promise.all([
    admin.from('products').select('id, name').in('id', [...new Set(lignes.map((c) => c.sujet_id))]),
    idsRevendeurs.length ? admin.from('profiles').select('id, full_name').in('id', idsRevendeurs) : Promise.resolve({ data: [] as any[] }),
  ]);
  const p = new Map((produits || []).map((x: any) => [x.id, x.name]));
  const r = new Map((profils || []).map((x: any) => [x.id, x.full_name]));
  return lignes.map((c) => ({
    id: c.id as string, produit: (p.get(c.sujet_id) as string) || 'Produit',
    // Le fournisseur ne voit que « Awa D. » : pas de coordonnées.
    avec: qui.type === 'fournisseur' ? nomMasque(r.get(c.revendeur_id) as string) : 'Fournisseur',
    dernierLe: c.dernier_message_le as string,
  }));
}

// ── Admin : vérification ────────────────────────────────────────────────────
export async function messagesAVerifier(admin: SupabaseClient) {
  const { data, error } = await admin.from('messages').select('*').eq('statut', 'en_attente').order('created_at', { ascending: true }).limit(100);
  if (error) { if (tableAbsente(error.code)) return { migrationRequise: true, messages: [] }; indisponible(error); }
  const lignes = data || [];
  const ids = [...new Set(lignes.map((m) => m.auteur_id).filter(Boolean))];
  const [{ data: profils }, { data: refus }] = await Promise.all([
    ids.length ? admin.from('profiles').select('id, full_name').in('id', ids) : Promise.resolve({ data: [] as any[] }),
    ids.length ? admin.from('messages').select('auteur_id').eq('statut', 'refuse').in('auteur_id', ids) : Promise.resolve({ data: [] as any[] }),
  ]);
  const noms = new Map((profils || []).map((x: any) => [x.id, x.full_name]));
  const refuses = new Map<string, number>();
  for (const m of refus || []) refuses.set(m.auteur_id, (refuses.get(m.auteur_id) || 0) + 1);
  return {
    migrationRequise: false,
    messages: lignes.map((m) => ({
      id: m.id as string, texte: m.texte as string, motifs: ((m.motifs || []) as MotifMessage[]).map((x) => LIBELLE_MOTIF[x] || x),
      auteur: m.auteur_type as string, nom: m.auteur_id ? (noms.get(m.auteur_id) as string) || '' : 'Client', envoyeLe: m.created_at as string,
      dejaRefuses: m.auteur_id ? refuses.get(m.auteur_id) || 0 : 0,
    })),
  };
}

export async function deciderMessage(admin: SupabaseClient, adminId: string, params: { id: unknown; decision: unknown; motif?: unknown }) {
  const id = typeof params.id === 'string' ? params.id : '';
  const motif = typeof params.motif === 'string' ? params.motif.trim().slice(0, 300) : '';
  if (!id) throw new MessageError('Message manquant.', 400);
  if (params.decision !== 'publier' && params.decision !== 'refuser') throw new MessageError('Décision inconnue.', 400);
  if (params.decision === 'refuser' && motif.length < 3) throw new MessageError('Indiquez le motif du refus (l’auteur le verra).', 400);
  const { data, error } = await admin.from('messages').update({
    statut: params.decision === 'publier' ? 'publie' : 'refuse', motif_refus: params.decision === 'refuser' ? motif : null,
    modere_par: adminId, modere_le: new Date().toISOString(),
  }).eq('id', id).eq('statut', 'en_attente').select('conversation_id, auteur_type').maybeSingle();
  if (error) indisponible(error);
  if (!data) throw new MessageError('Ce message a déjà été traité.', 409);
  if (params.decision === 'publier') await prevenir(await conversation(admin, data.conversation_id), data.auteur_type);
  return { ok: true };
}
