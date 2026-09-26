import { getSupabaseAdmin } from './supabase-admin';

/**
 * Page de marque d'une campagne (2026-09-26, lot 2b) — SERVEUR.
 *
 * Une campagne fournisseur a sa page publique : la marque, le produit mis en
 * avant et le message de la campagne. Les revendeurs la partagent avec leur
 * code (?ref=) ; la commande passe par la fiche du produit, qui garde ce code.
 * Jamais le prix fournisseur ni le budget de la campagne.
 */
export interface PageCampagne {
  id: string;
  titre: string;
  message: string | null;
  active: boolean;
  finitLe: string | null;
  marque: { nom: string; logo: string | null; couverture: string | null };
  produit: { nom: string; slug: string; images: string[]; prix: number | null };
}

export async function chargerPageCampagne(id: string): Promise<PageCampagne | null> {
  const admin = getSupabaseAdmin();
  if (!admin || !/^[\w-]{1,64}$/.test(id)) return null;
  const { data: m } = await admin.from('missions').select('*').eq('id', id).maybeSingle();
  if (!m || !m.supplier_id || !m.product_id || !['active', 'paused', 'ended'].includes(m.status)) return null;

  const [{ data: p }, { data: fiche }, { data: boutique }] = await Promise.all([
    admin.from('products').select('name, slug, images, public_price, mode_prix, status').eq('id', m.product_id).maybeSingle(),
    admin.from('suppliers').select('*').eq('profile_id', m.supplier_id).maybeSingle(),
    admin.from('stores').select('name, logo_url, cover_url').eq('owner_type', 'supplier').eq('owner_id', m.supplier_id).order('created_at').limit(1).maybeSingle(),
  ]);
  if (!p || p.status !== 'approved') return null;

  const fin = m.ends_at ? Date.parse(m.ends_at) : null;
  return {
    id: m.id,
    titre: m.title,
    message: m.description || null,
    active: m.status === 'active' && (fin === null || fin > Date.now()),
    finitLe: m.ends_at || null,
    marque: {
      nom: boutique?.name || fiche?.shop_display_name || fiche?.company_name || 'Marque partenaire',
      logo: boutique?.logo_url || fiche?.logo_url || null,
      couverture: boutique?.cover_url || null,
    },
    produit: {
      nom: p.name,
      slug: p.slug,
      images: Array.isArray(p.images) ? p.images.filter(Boolean) : [],
      // Article au prix de gros : chaque revendeur fixe son prix.
      prix: p.mode_prix === 'gros' ? null : Number(p.public_price) || null,
    },
  };
}
