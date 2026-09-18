/**
 * Notifications dans l'application (§ W) — SERVEUR.
 *
 * Une notification ne doit JAMAIS faire échouer l'action qui la déclenche :
 * valider une mission ou approuver un produit reste valide même si l'avis
 * n'a pas pu être écrit. D'où l'absence totale d'exception ici.
 */
import { getSupabaseAdmin } from '../supabase-admin';

export interface Notification {
  id: number;
  type: string;
  titre: string;
  texte: string | null;
  lien: string | null;
  lue: boolean;
  creeLe: string;
}

/** Un lien de notification reste interne : jamais une URL tierce. */
function lienInterne(lien: string | null | undefined): string | null {
  if (!lien) return null;
  return lien.startsWith('/') && !lien.startsWith('//') ? lien.slice(0, 300) : null;
}

export async function notifier(
  profileIds: string | string[],
  contenu: { type?: string; titre: string; texte?: string | null; lien?: string | null },
): Promise<void> {
  const a = getSupabaseAdmin();
  const ids = Array.from(new Set((Array.isArray(profileIds) ? profileIds : [profileIds]).filter(Boolean)));
  if (!a || ids.length === 0) return;
  // Par lots : une boutique très suivie ne doit pas produire une requête géante.
  for (let i = 0; i < ids.length; i += 500) {
    const { error } = await a.from('notifications').insert(
      ids.slice(i, i + 500).map((id) => ({
        profile_id: id,
        kind: contenu.type || 'info',
        title: contenu.titre.slice(0, 140),
        body: contenu.texte ? contenu.texte.slice(0, 400) : null,
        link: lienInterne(contenu.lien),
      })),
    );
    if (error) {
      console.warn('[NOTIF] non écrite:', error.code);
      return;
    }
  }
}

/**
 * Prévient les abonnés AVEC COMPTE d'une boutique. Les abonnés inscrits par
 * téléphone seul ne reçoivent rien automatiquement : leur écrire sur WhatsApp
 * depuis un numéro Suguba sans qu'ils l'aient demandé, en masse, ferait
 * bannir le numéro (règles anti-ban du projet).
 */
export async function notifierAbonnes(
  boutiqueId: string,
  contenu: { type?: string; titre: string; texte?: string | null; lien?: string | null },
): Promise<number> {
  const a = getSupabaseAdmin();
  if (!a) return 0;
  const { data, error } = await a
    .from('store_follows')
    .select('follower_id')
    .eq('store_id', boutiqueId)
    .not('follower_id', 'is', null)
    .limit(5000);
  if (error || !data) return 0;
  const ids = data.map((f: any) => f.follower_id as string);
  await notifier(ids, contenu);
  return ids.length;
}

export async function mesNotifications(profileId: string, limite = 50): Promise<{ notifications: Notification[]; nonLues: number }> {
  const a = getSupabaseAdmin();
  if (!a) return { notifications: [], nonLues: 0 };
  const { data, error } = await a
    .from('notifications')
    .select('*')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false })
    .limit(limite);
  if (error || !data) return { notifications: [], nonLues: 0 };
  const { count } = await a
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('profile_id', profileId)
    .is('read_at', null);
  return {
    notifications: data.map((n: any) => ({
      id: n.id, type: n.kind, titre: n.title, texte: n.body, lien: n.link,
      lue: Boolean(n.read_at), creeLe: n.created_at,
    })),
    nonLues: count ?? 0,
  };
}

export async function marquerLues(profileId: string): Promise<void> {
  const a = getSupabaseAdmin();
  if (!a) return;
  await a.from('notifications').update({ read_at: new Date().toISOString() }).eq('profile_id', profileId).is('read_at', null);
}

/**
 * Nouveau produit en ligne : prévient les abonnés (avec compte) de la
 * boutique du fournisseur (§ 10 — « nouveau produit »). Appelée seulement au
 * PASSAGE en approuvé, jamais à chaque changement de prix : sinon chaque
 * retouche tarifaire spammerait les abonnés.
 */
export async function annoncerNouveauProduit(productId: string): Promise<void> {
  const a = getSupabaseAdmin();
  if (!a) return;
  try {
    const { data: produit } = await a.from('products').select('name, slug, supplier_id').eq('id', productId).maybeSingle();
    if (!produit?.supplier_id) return;
    const { data: boutique } = await a
      .from('stores')
      .select('id, name')
      .eq('owner_type', 'supplier')
      .eq('owner_id', produit.supplier_id)
      .maybeSingle();
    if (!boutique) return;
    await notifierAbonnes(boutique.id, {
      type: 'nouveaute',
      titre: `Nouveau chez ${boutique.name}`,
      texte: produit.name,
      lien: `/p/${produit.slug}`,
    });
  } catch (erreur) {
    console.warn('[NOTIF] annonce produit impossible:', (erreur as Error).message);
  }
}

/**
 * Baisse de prix d'un produit DÉJÀ en vente : prévient les abonnés (avec
 * compte) de la boutique du fournisseur (§ 10 — « baisse de prix »).
 * Seulement à la baisse : une hausse de prix n'est pas une nouvelle à annoncer.
 */
export async function annoncerBaissePrix(productId: string, ancien: number, nouveau: number): Promise<void> {
  if (!(nouveau > 0) || !(ancien > nouveau)) return;
  const a = getSupabaseAdmin();
  if (!a) return;
  try {
    const { data: produit } = await a.from('products').select('name, slug, supplier_id').eq('id', productId).maybeSingle();
    if (!produit?.supplier_id) return;
    const { data: boutique } = await a.from('stores').select('id, name')
      .eq('owner_type', 'supplier').eq('owner_id', produit.supplier_id).maybeSingle();
    if (!boutique) return;
    await notifierAbonnes(boutique.id, {
      type: 'promotion',
      titre: `Baisse de prix chez ${boutique.name}`,
      texte: `${produit.name} : ${nouveau.toLocaleString('fr-FR')} F au lieu de ${ancien.toLocaleString('fr-FR')} F.`,
      lien: `/p/${produit.slug}`,
    });
  } catch (erreur) {
    console.warn('[NOTIF] annonce baisse de prix impossible:', (erreur as Error).message);
  }
}
