import { NextRequest, NextResponse } from 'next/server';
import { exigerDroitFournisseur } from '@/lib/reseau/contexte-fournisseur';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { slugifier } from '@/lib/shop';
import { publierAutomatiquement } from '@/lib/publication-auto';

/**
 * Créer une variante d'un produit du fournisseur (taille, couleur, capacité).
 *
 * La variante reprend nom, catégorie, description et photos de l'original ;
 * le fournisseur ne saisit que ce qui change : le libellé, son prix et son
 * stock. Elle passe ensuite par la MÊME publication automatique que tout
 * nouveau produit (prix recommandé, garde-fous de rentabilité).
 */
/**
 * Nom sans le libellé de variante de l'original : « TV TCL – 43 pouces »
 * donne « TV TCL », pour nommer la sœur « TV TCL – 55 pouces ». On ne retire
 * QUE ce libellé exact — couper au dernier tiret abîmerait « T-shirt ».
 */
function nomDeBase(nom: string, libelle: string | null): string {
  const suffixe = libelle ? ` – ${libelle}` : '';
  return suffixe && nom.endsWith(suffixe) ? nom.slice(0, -suffixe.length) : nom;
}

export async function POST(req: NextRequest) {
  const acces = await exigerDroitFournisseur(req, 'catalogue');
  if (!acces.ok) return NextResponse.json({ error: acces.erreur }, { status: acces.statut });
  const fournisseurId = acces.contexte.fournisseurId;
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Base indisponible.' }, { status: 503 });

  const c = await req.json().catch(() => ({}));
  const libelle = typeof c.libelle === 'string' ? c.libelle.trim().slice(0, 40) : '';
  const libelleOriginal = typeof c.libelleOriginal === 'string' ? c.libelleOriginal.trim().slice(0, 40) : '';
  const prix = Math.round(Number(c.prixFournisseur) || 0);
  const stock = Math.max(0, Math.min(100000, Math.round(Number(c.stock) || 0)));
  if (libelle.length < 1) return NextResponse.json({ error: 'Indiquez ce qui change (ex. « 55 pouces »).' }, { status: 400 });
  if (!(prix > 0)) return NextResponse.json({ error: 'Indiquez votre prix pour cette variante.' }, { status: 400 });

  const { data: original, error: lecture } = await admin.from('products').select('*')
    .eq('id', c.productId).eq('supplier_id', fournisseurId).maybeSingle();
  if (lecture?.code === '42703') return NextResponse.json({ error: 'Variantes indisponibles (migration à appliquer).' }, { status: 503 });
  if (!original) return NextResponse.json({ error: 'Produit introuvable ou qui ne vous appartient pas.' }, { status: 404 });

  const groupe = original.variant_group || original.id;
  if (!original.variant_group) {
    const { error } = await admin.from('products')
      .update({ variant_group: groupe, variant_label: libelleOriginal || original.variant_label || null })
      .eq('id', original.id);
    if (error) return NextResponse.json({ error: 'Variantes indisponibles (migration à appliquer).' }, { status: 503 });
  }

  const { data: soeurs } = await admin.from('products').select('variant_label').eq('variant_group', groupe);
  if ((soeurs || []).some((s: any) => String(s.variant_label || '').toLowerCase() === libelle.toLowerCase())) {
    return NextResponse.json({ error: 'Cette variante existe déjà.' }, { status: 409 });
  }
  if ((soeurs || []).length >= 12) return NextResponse.json({ error: '12 variantes au maximum.' }, { status: 409 });

  // Adresse : celle de l'original + le libellé. Suffixe si elle est prise.
  const base = `${original.slug}-${slugifier(libelle)}`.slice(0, 80);
  let slug = base;
  for (let i = 2; i < 20; i++) {
    const { data: pris } = await admin.from('products').select('id').eq('slug', slug).maybeSingle();
    if (!pris) break;
    slug = `${base}-${i}`;
  }

  const { data: cree, error } = await admin.from('products').insert({
    name: `${nomDeBase(original.name, original.variant_label)} – ${libelle}`.slice(0, 150),
    slug,
    category: original.category,
    description: original.description,
    images: original.images,
    supplier_price: prix,
    public_price: 0,
    reseller_commission: 0,
    commission_proposee: original.commission_proposee,
    stock,
    status: 'submitted',
    supplier_id: fournisseurId,
    supplier_name: original.supplier_name,
    variant_group: groupe,
    variant_label: libelle,
  }).select('id').maybeSingle();
  if (error || !cree) return NextResponse.json({ error: error?.message || 'Création impossible.' }, { status: 500 });

  const publication = await publierAutomatiquement(admin, cree.id);
  return NextResponse.json({ id: cree.id, slug, publication });
}
