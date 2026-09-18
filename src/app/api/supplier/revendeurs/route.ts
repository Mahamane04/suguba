import { NextRequest, NextResponse } from 'next/server';
import { exigerDroitFournisseur } from '@/lib/reseau/contexte-fournisseur';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * Réseau de revendeurs d'un fournisseur (§ 8, § 22 des écrans) : qui vend ses
 * produits, combien, et depuis quand.
 *
 * Seuls le prénom et l'initiale sont exposés — un fournisseur n'a pas besoin
 * du fichier nominatif des revendeurs de Suguba.
 */

function nomPublic(nomComplet: string | null): string {
  const mots = String(nomComplet || '').trim().split(/\s+/).filter(Boolean);
  if (mots.length === 0) return 'Revendeur';
  if (mots.length === 1) return mots[0];
  return `${mots[0]} ${mots[mots.length - 1].charAt(0).toUpperCase()}.`;
}

export async function GET(req: NextRequest) {
  const acces = await exigerDroitFournisseur(req, 'revendeurs');
  if (!acces.ok) return NextResponse.json({ error: acces.erreur }, { status: acces.statut });
  const fournisseurId = acces.contexte.fournisseurId;

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ revendeurs: [], produitsPhares: [] });

  const { data: produits } = await admin.from('products').select('id, name').eq('supplier_id', fournisseurId);
  const ids = (produits || []).map((p: any) => p.id);
  if (ids.length === 0) return NextResponse.json({ revendeurs: [], produitsPhares: [] });

  const { data: selections } = await admin
    .from('reseller_shop_items')
    .select('reseller_id, product_id, added_at')
    .in('product_id', ids);

  const parRevendeur = new Map<string, { articles: number; depuis: string }>();
  const parProduit = new Map<string, number>();
  for (const s of selections || []) {
    const actuel = parRevendeur.get(s.reseller_id);
    parRevendeur.set(s.reseller_id, {
      articles: (actuel?.articles || 0) + 1,
      depuis: actuel && actuel.depuis < s.added_at ? actuel.depuis : s.added_at,
    });
    parProduit.set(s.product_id, (parProduit.get(s.product_id) || 0) + 1);
  }

  const idsRevendeurs = [...parRevendeur.keys()];
  const { data: profils } = idsRevendeurs.length
    ? await admin.from('profiles').select('id, full_name, reseller_code, city').in('id', idsRevendeurs)
    : { data: [] as any[] };

  // Ventes réelles générées par ces revendeurs sur les produits du fournisseur.
  const { data: commandes } = await admin
    .from('orders')
    .select('reseller_id, total_amount, status, created_at')
    .in('product_id', ids)
    .not('reseller_id', 'is', null)
    .limit(2000);

  const ventes = new Map<string, { commandes: number; ca: number; derniere: string | null }>();
  for (const c of commandes || []) {
    if (!c.reseller_id) continue;
    const actuel = ventes.get(c.reseller_id) || { commandes: 0, ca: 0, derniere: null };
    ventes.set(c.reseller_id, {
      commandes: actuel.commandes + 1,
      ca: actuel.ca + (c.status === 'delivered' ? Number(c.total_amount) || 0 : 0),
      derniere: !actuel.derniere || actuel.derniere < c.created_at ? c.created_at : actuel.derniere,
    });
  }

  const revendeurs = (profils || []).map((p: any) => ({
    id: p.id,
    nom: nomPublic(p.full_name),
    code: p.reseller_code,
    ville: p.city || null,
    articles: parRevendeur.get(p.id)?.articles || 0,
    depuis: parRevendeur.get(p.id)?.depuis || null,
    commandes: ventes.get(p.id)?.commandes || 0,
    chiffreAffaires: ventes.get(p.id)?.ca || 0,
    derniereActivite: ventes.get(p.id)?.derniere || null,
  }));
  revendeurs.sort((a, b) => b.chiffreAffaires - a.chiffreAffaires || b.articles - a.articles);

  const nomProduit = new Map((produits || []).map((p: any) => [p.id, p.name]));
  const produitsPhares = [...parProduit.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, n]) => ({ id, nom: nomProduit.get(id) || 'Produit', revendeurs: n }));

  return NextResponse.json({ revendeurs, produitsPhares });
}
