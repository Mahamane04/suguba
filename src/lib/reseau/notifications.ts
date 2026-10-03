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

/**
 * Écrit une notification pour chaque compte. Renvoie le nombre de notifications
 * VRAIMENT écrites (lot 5 du chantier boutique, 2026-10-03) : « N prévenus » doit
 * être un chiffre réel, pas le nombre de destinataires visés. Les appelants qui
 * n'en ont pas besoin l'ignorent.
 */
export async function notifier(
  profileIds: string | string[],
  contenu: { type?: string; titre: string; texte?: string | null; lien?: string | null },
): Promise<number> {
  const a = getSupabaseAdmin();
  const ids = Array.from(new Set((Array.isArray(profileIds) ? profileIds : [profileIds]).filter(Boolean)));
  if (!a || ids.length === 0) return 0;
  let ecrites = 0;
  // Par lots : une boutique très suivie ne doit pas produire une requête géante.
  for (let i = 0; i < ids.length; i += 500) {
    const lot = ids.slice(i, i + 500);
    const { error } = await a.from('notifications').insert(
      lot.map((id) => ({
        profile_id: id,
        kind: contenu.type || 'info',
        title: contenu.titre.slice(0, 140),
        body: contenu.texte ? contenu.texte.slice(0, 400) : null,
        link: lienInterne(contenu.lien),
      })),
    );
    if (error) {
      console.warn('[NOTIF] non écrite:', error.code);
      return ecrites;
    }
    ecrites += lot.length;
  }
  return ecrites;
}

/**
 * Prévient les abonnés AVEC COMPTE d'une boutique. Les abonnés inscrits par
 * téléphone seul ne reçoivent rien automatiquement : leur écrire sur WhatsApp
 * depuis un numéro Suguba sans qu'ils l'aient demandé, en masse, ferait
 * bannir le numéro (règles anti-ban du projet).
 *
 * Renvoie le nombre d'abonnés réellement prévenus (notifications écrites), et
 * non plus le nombre visé (lot 5 du chantier boutique, 2026-10-03).
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
  const ids = data.map((f: any) => f.follower_id as string).filter(Boolean);
  return notifier(ids, contenu);
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
 * Boutique PRINCIPALE d'un fournisseur (lot 5 du chantier boutique, 2026-10-03).
 *
 * Les annonces lisaient sa boutique avec .maybeSingle() : depuis les boutiques
 * multiples (2026-09-24), dès qu'un fournisseur en a deux, la lecture échoue et
 * l'annonce s'arrêtait EN SILENCE. Même règle que boutiqueDuProprietaire : la
 * principale, sinon la plus ancienne. `*` : la colonne principale peut manquer.
 */
async function boutiquePrincipaleFournisseur(
  a: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  fournisseurId: string,
): Promise<{ id: string; name: string } | null> {
  const { data, error } = await a
    .from('stores')
    .select('*')
    .eq('owner_type', 'supplier')
    .eq('owner_id', fournisseurId)
    .order('created_at', { ascending: true })
    .limit(10);
  if (error || !Array.isArray(data) || data.length === 0) return null;
  const principale = data.find((b: any) => b.principale !== false) || data[0];
  return principale?.id ? { id: String(principale.id), name: String(principale.name || '') } : null;
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
    const boutique = await boutiquePrincipaleFournisseur(a, produit.supplier_id);
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
    const boutique = await boutiquePrincipaleFournisseur(a, produit.supplier_id);
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
