import type { SupabaseClient } from '@supabase/supabase-js';
import { nomPublic, type Boutique } from './shop';
import { venteDirectePermise, type ReglagesReseau } from './reseau/reglages';

/**
 * Boutique fournisseur en page de présentation (2026-09-26, lot C « Priorité
 * au réseau ») — SERVEUR UNIQUEMENT.
 *
 * Tant que la vente directe n'est pas ouverte pour ce fournisseur, sa
 * boutique présente l'entreprise et ses produits SANS prix ni achat, et met
 * en avant les revendeurs partenaires qui les proposent : elle ne doit pas
 * devenir une caisse concurrente du réseau. Les prix sont retirés côté
 * serveur (ils n'arrivent jamais dans la page), pas seulement masqués.
 */
export async function appliquerPrioriteReseau(
  admin: SupabaseClient,
  vitrine: Boutique,
  fournisseurId: string | null | undefined,
  reglages: ReglagesReseau,
): Promise<Boutique> {
  if (venteDirectePermise(reglages, fournisseurId)) return { ...vitrine, presentation: null };

  const ids = vitrine.produits.map((p) => p.id);
  let revendeurs: { nom: string; lien: string }[] = [];
  if (ids.length) {
    const { data: lignes } = await admin.from('reseller_shop_items').select('reseller_id').in('product_id', ids.slice(0, 500)).limit(2000);
    // Les revendeurs qui en proposent le plus d'abord.
    const compte = new Map<string, number>();
    for (const l of lignes || []) compte.set(l.reseller_id, (compte.get(l.reseller_id) || 0) + 1);
    const candidats = [...compte.keys()];
    if (candidats.length) {
      const [{ data: roles }, { data: profils }] = await Promise.all([
        admin.from('profile_roles').select('profile_id, status').eq('role', 'reseller').in('profile_id', candidats),
        admin.from('profiles').select('id, full_name, reseller_code').in('id', candidats),
      ]);
      const actifs = new Set((roles || []).filter((r: any) => r.status === 'active').map((r: any) => r.profile_id));
      revendeurs = (profils || [])
        .filter((p: any) => actifs.has(p.id) && p.reseller_code)
        .sort((a: any, b: any) => (compte.get(b.id) || 0) - (compte.get(a.id) || 0))
        .slice(0, 12)
        .map((p: any) => ({ nom: nomPublic(p.full_name), lien: `/r/${encodeURIComponent(p.reseller_code)}` }));
    }
  }

  return {
    ...vitrine,
    produits: vitrine.produits.map((p) => ({ ...p, prix: 0 })),
    presentation: { revendeurs },
  };
}

