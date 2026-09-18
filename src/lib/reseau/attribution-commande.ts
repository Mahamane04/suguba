/**
 * Attribution autour de la création d'une commande — SERVEUR.
 *
 * Partagé par la commande seule (/api/orders/create) et le panier
 * (/api/orders/cart) : les deux doivent créditer les revendeurs selon les
 * MÊMES règles, sinon un revendeur perdrait ses ventes selon le chemin
 * d'achat choisi par le client.
 */
import type { Order } from '@/types';
import { getSupabaseAdmin } from '../supabase-admin';
import { attribuerClient, enregistrerConversion, journaliser, referentDuClient } from './db';

export async function corpsAvecReferent(corps: unknown, codeCookie: string | null): Promise<unknown> {
  if (!corps || typeof corps !== 'object') return corps;
  const objet = corps as Record<string, unknown>;
  if (typeof objet.resellerCode === 'string' && objet.resellerCode.trim()) return corps;
  if (typeof objet.customerPhone !== 'string') return corps;

  // Ordre de priorité, fidèle à la règle du premier contact :
  //   1. le référent déjà connu pour CE téléphone ;
  //   2. à défaut, le revendeur du lien cliqué sur cet appareil (cookie posé
  //      par /go/<code>) — le client a pu revenir par l'accueil, sans ?ref.
  //   Un code de cookie n'est retenu que s'il désigne un revendeur existant :
  //   un vieux cookie (compte supprimé) ne doit JAMAIS faire refuser une vente.
  let repli: unknown = corps;
  try {
    if (codeCookie && /^[A-Z0-9-]{3,40}$/.test(codeCookie)) {
      const { data } = (await getSupabaseAdmin()?.from('profiles').select('id').eq('reseller_code', codeCookie).maybeSingle()) || { data: null };
      if (data) repli = { ...objet, resellerCode: codeCookie };
    }
  } catch { /* repli sans code : la vente passe quand même */ }
  try {
    const referentId = await referentDuClient(objet.customerPhone);
    if (!referentId) return repli;
    const admin = getSupabaseAdmin();
    const { data } = (await admin?.from('profiles').select('reseller_code').eq('id', referentId).maybeSingle()) || { data: null };
    if (!data?.reseller_code) return repli;
    return { ...objet, resellerCode: data.reseller_code };
  } catch (erreur) {
    // Une attribution impossible ne doit jamais empêcher une vente.
    console.error('[ORDER ATTRIBUTION]', (erreur as Error).message);
    return repli;
  }
}

/**
 * Après création : attribution du client, rattachement au lien, conversion,
 * journal. N'échoue jamais — la commande EST créée, un compteur manqué ne doit
 * pas faire croire au client que sa commande a échoué.
 */
export async function apresCommande(commande: Order, codeLien: string | null): Promise<void> {
  try {
    await attribuerClient({
      telephone: commande.customerPhone,
      resellerId: commande.resellerId || null,
      source: codeLien ? 'lien' : 'direct',
      linkCode: codeLien,
      nomClient: commande.customerName,
      motif: 'commande',
    });
    if (codeLien) {
      await getSupabaseAdmin()?.from('orders')
        .update({ link_code: codeLien, attribution_source: 'lien' })
        .eq('id', commande.id);
    }
    await enregistrerConversion({
      linkCode: codeLien,
      telephone: commande.customerPhone,
      resellerId: commande.resellerId || null,
      montant: commande.totalAmount,
      productId: commande.productId,
    });
    await journaliser({
      evenement: 'ORDER',
      resellerId: commande.resellerId || null,
      sujetType: 'product',
      sujetRef: commande.productId,
      linkCode: codeLien,
      montant: commande.totalAmount,
    });
  } catch (erreur) {
    console.error('[ORDER RESEAU]', (erreur as Error).message);
  }
}
