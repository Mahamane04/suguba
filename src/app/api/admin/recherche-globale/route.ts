import { NextRequest, NextResponse } from 'next/server';
import { sessionAvecRole } from '@/lib/reseau/route-session';
import { permissionsDuMembre } from '@/lib/reseau/db';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { GROUPES_RECHERCHE, motifRecherche } from '@/lib/admin/poste';

/**
 * Recherche globale de l'équipe (A1, 2026-09-27) : commandes, produits,
 * personnes, boutiques, paiements reçus. Chaque groupe n'est lu QUE si le
 * membre a le droit de le consulter : la recherche ne doit jamais ouvrir ce
 * que les pages refusent.
 */
type Resultat = { titre: string; detail: string; lien: string };

export async function GET(req: NextRequest) {
  const session = await sessionAvecRole(req, 'admin');
  if (!session) return NextResponse.json({ error: 'Session admin requise.' }, { status: 401 });
  const { permissions } = await permissionsDuMembre(session.uid);
  const motif = motifRecherche(req.nextUrl.searchParams.get('q') || '');
  if (!motif) return NextResponse.json({ groupes: [] });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Base indisponible.' }, { status: 503 });
  const brut = (req.nextUrl.searchParams.get('q') || '').trim();

  const lecteurs: Record<string, () => Promise<Resultat[]>> = {
    commandes: async () => {
      const { data, error } = await admin.from('orders').select('order_number, customer_name, product_name, status')
        .or(`order_number.ilike.${motif},customer_name.ilike.${motif},customer_phone.ilike.${motif}`)
        .order('created_at', { ascending: false }).limit(8);
      if (error) throw error;
      return (data || []).map((o: any) => ({ titre: o.order_number, detail: [o.customer_name, o.product_name, o.status].filter(Boolean).join(' · '), lien: `/admin/commandes?q=${encodeURIComponent(o.order_number)}` }));
    },
    produits: async () => {
      const { data, error } = await admin.from('products').select('name, slug, supplier_name, status')
        .or(`name.ilike.${motif},id.ilike.${motif},slug.ilike.${motif}`).neq('status', 'archived').limit(8);
      if (error) throw error;
      return (data || []).map((p: any) => ({ titre: p.name, detail: [p.supplier_name, p.status].filter(Boolean).join(' · '), lien: `/admin/products?q=${encodeURIComponent(p.name)}` }));
    },
    personnes: async () => {
      const { data, error } = await admin.from('profiles').select('full_name, phone, role')
        .or(`full_name.ilike.${motif},phone.ilike.${motif},email.ilike.${motif},reseller_code.ilike.${motif}`).limit(8);
      if (error) throw error;
      return (data || []).map((p: any) => ({ titre: p.full_name || 'Sans nom', detail: [p.role, p.phone].filter(Boolean).join(' · '), lien: `/admin/utilisateurs?q=${encodeURIComponent(p.phone || p.full_name || '')}` }));
    },
    boutiques: async () => {
      const { data, error } = await admin.from('stores').select('name, slug, owner_type, status')
        .or(`name.ilike.${motif},slug.ilike.${motif}`).limit(8);
      if (error) throw error;
      return (data || []).map((b: any) => ({ titre: b.name, detail: [b.owner_type, b.status].filter(Boolean).join(' · '), lien: `/boutique/${b.slug}` }));
    },
    paiements: async () => {
      const { data, error } = await admin.from('paiements_recus').select('reference, montant, cible, annule_le')
        .ilike('reference', motif).limit(8);
      if (error) {
        if (['42P01', 'PGRST205', '42703'].includes(String(error.code))) return [];
        throw error;
      }
      return (data || []).map((p: any) => ({ titre: p.reference, detail: `${Math.round(Number(p.montant) || 0).toLocaleString('fr-FR')} F${p.cible ? ` · ${p.cible}` : ''}${p.annule_le ? ' · annulé' : ''}`,
        // Paiement reçu pour une campagne (missions) ou une sponsorisation : la page où il figure.
        lien: p.cible === 'campagne' ? '/admin/missions' : '/admin/sponsorisations' }));
    },
  };

  const groupes = GROUPES_RECHERCHE.filter((g) => permissions.includes(g.permission));
  const reponses = await Promise.allSettled(groupes.map((g) => lecteurs[g.cle]()));
  return NextResponse.json({
    q: brut,
    groupes: groupes.map((g, i) => {
      const r = reponses[i];
      return r.status === 'fulfilled'
        ? { cle: g.cle, titre: g.titre, resultats: r.value }
        : { cle: g.cle, titre: g.titre, resultats: [], erreur: 'Recherche indisponible pour ce groupe.' };
    }),
  }, { headers: { 'Cache-Control': 'private, no-store' } });
}
