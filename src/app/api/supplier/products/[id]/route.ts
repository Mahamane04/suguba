import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { exigerDroitFournisseur } from '@/lib/reseau/contexte-fournisseur';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { publierAutomatiquement } from '@/lib/publication-auto';

type Contexte = { params: Promise<{ id: string }> };
async function contexte(req: NextRequest, ctx: Contexte) {
  const acces = await exigerDroitFournisseur(req, 'catalogue');
  if (!acces.ok) return { erreur: NextResponse.json({ error: acces.erreur }, { status: acces.statut }) };
  const admin = getSupabaseAdmin();
  if (!admin) return { erreur: NextResponse.json({ error: 'Service indisponible.' }, { status: 503 }) };
  const { id } = await ctx.params;
  const fournisseurId = acces.contexte.fournisseurId;
  const { data: produit, error } = await admin.from('products').select('*').eq('id', id).eq('supplier_id', fournisseurId).maybeSingle();
  if (error) return { erreur: NextResponse.json({ error: 'Offre indisponible. Réessayez.' }, { status: 503 }) };
  if (!produit) return { erreur: NextResponse.json({ error: 'Offre introuvable.' }, { status: 404 }) };
  return { admin, produit, fournisseurId, id };
}
export async function GET(req: NextRequest, ctx: Contexte) {
  const c = await contexte(req, ctx);
  if (c.erreur) return c.erreur;
  return NextResponse.json({ produit: c.produit });
}
/** Copie serveur seulement : jamais prix, statut, attribution ou stock du navigateur. */
export async function POST(req: NextRequest, ctx: Contexte) {
  const c = await contexte(req, ctx); if (c.erreur) return c.erreur;
  if (['rejected', 'archived'].includes(c.produit.status)) return NextResponse.json({ error: 'Une offre retirée ne peut pas être dupliquée. Contactez Suguba.' }, { status: 409 });
  const id = randomUUID();
  const copie: Record<string, unknown> = { id, slug: `offre-${id}`, supplier_id: c.fournisseurId, name: `${c.produit.name} — copie`.slice(0, 120), status: 'draft', stock: 0, public_price: 0, reseller_commission: 0 };
  for (const champ of ['supplier_name', 'category', 'description', 'images', 'supplier_price', 'commission_proposee', 'mode_prix', 'prix_conseille', 'type_offre', 'mode_remise', 'frais_remise', 'offre_inclus', 'unite_vente', 'contenu_valeur', 'contenu_mesure', 'quantite_min', 'mode_commande', 'etapes', 'warranty_months']) {
    if (c.produit[champ] !== undefined) copie[champ] = c.produit[champ];
  }
  const { data, error } = await c.admin.from('products').insert(copie).select('id').maybeSingle();
  if (error || !data) return NextResponse.json({ error: 'Copie non enregistrée. Réessayez.' }, { status: 503 });
  return NextResponse.json({ id: data.id }, { status: 201 });
}
export async function PATCH(req: NextRequest, ctx: Contexte) {
  const c = await contexte(req, ctx); if (c.erreur) return c.erreur;
  const corps = await req.json().catch(() => null);
  if (!corps || typeof corps !== 'object' || Array.isArray(corps)) return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  if (Object.keys(corps).some(k => !['nom', 'description', 'stock', 'partRevendeur', 'publier'].includes(k))) return NextResponse.json({ error: 'Seuls le descriptif, le stock et la part revendeur sont modifiables ici.' }, { status: 400 });
  const modification: Record<string, unknown> = {};
  if ('nom' in corps) {
    if (typeof corps.nom !== 'string' || corps.nom.trim().length < 2 || corps.nom.trim().length > 120) return NextResponse.json({ error: 'Nom de 2 à 120 caractères requis.' }, { status: 400 });
    modification.name = corps.nom.trim();
  }
  if ('description' in corps) {
    if (typeof corps.description !== 'string' || corps.description.length > 4000) return NextResponse.json({ error: 'Présentation invalide.' }, { status: 400 });
    modification.description = corps.description.trim();
  }
  if ('stock' in corps) {
    if (typeof corps.stock !== 'number' || !Number.isInteger(corps.stock) || corps.stock < 0 || corps.stock > 100000) return NextResponse.json({ error: 'Quantité de 0 à 100 000 requise.' }, { status: 400 });
    modification.stock = corps.stock;
  }
  if ('partRevendeur' in corps) {
    if (c.produit.mode_prix === 'gros') return NextResponse.json({ error: 'Pour une offre de gros, la marge est choisie par le revendeur.' }, { status: 400 });
    if (typeof corps.partRevendeur !== 'number' || !Number.isInteger(corps.partRevendeur) || corps.partRevendeur <= 0 || corps.partRevendeur > 10000000) return NextResponse.json({ error: 'Part revendeur positive requise.' }, { status: 400 });
    modification.commission_proposee = corps.partRevendeur;
  }
  if ('publier' in corps && typeof corps.publier !== 'boolean') return NextResponse.json({ error: 'Confirmation de publication invalide.' }, { status: 400 });
  if (['rejected', 'archived'].includes(c.produit.status) && (corps.publier || 'partRevendeur' in corps)) return NextResponse.json({ error: 'Offre retirée : Suguba doit autoriser sa remise en vente.' }, { status: 409 });
  const retarifer = 'partRevendeur' in corps && corps.partRevendeur !== Number(c.produit.commission_proposee);
  if (retarifer || corps.publier === true) Object.assign(modification, { status: 'submitted', public_price: 0, reseller_commission: 0 });
  if (!Object.keys(modification).length) return NextResponse.json({ error: 'Aucun changement.' }, { status: 400 });
  const { data, error } = await c.admin.from('products').update(modification).eq('id', c.id).eq('supplier_id', c.fournisseurId).eq('status', c.produit.status).select('id').maybeSingle();
  if (error) return NextResponse.json({ error: 'Modification non enregistrée. Réessayez.' }, { status: 503 });
  if (!data) return NextResponse.json({ error: 'L’offre a changé entre-temps. Rechargez-la avant de modifier.' }, { status: 409 });
  const publication = retarifer || corps.publier === true ? await publierAutomatiquement(c.admin, c.id) : null;
  return NextResponse.json({ success: true, publication });
}
