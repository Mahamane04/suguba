import { NextRequest, NextResponse } from 'next/server';
import { exigerDroitFournisseur } from '@/lib/reseau/contexte-fournisseur';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { chargerReglages } from '@/lib/platform-settings';
import { libererGainsFournisseursEchus, lotCAbsent, resumerSoldeFournisseur, type SoldeFournisseur } from '@/lib/gains-fournisseur';
import { retraitAffiche } from '@/lib/retraits-affichage';

/**
 * Solde du fournisseur (lot C, 2026-09-27) : ce que Suguba lui doit pour ses
 * commandes livrées, où en est chaque montant, et ses retraits.
 *
 * Propriétaire seul (droit « retraits ») : un collaborateur de l'équipe
 * (stock, commercial, marketing) ne voit ni ne retire l'argent.
 */

const AUCUN_SOLDE: SoldeFournisseur = { disponible: 0, enAttente: 0, attenteFonds: 0, enRetrait: 0, verse: 0, prochainDeblocage: null };

export async function GET(req: NextRequest) {
  const acces = await exigerDroitFournisseur(req, 'retraits');
  if (!acces.ok) return NextResponse.json({ error: acces.erreur }, { status: acces.statut });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ actif: false, soldes: AUCUN_SOLDE, gains: [], retraits: [] });
  const fournisseur = acces.contexte.fournisseurId;

  // D'abord libérer ce qui a fini son délai : sinon le solde affiché serait en retard.
  await libererGainsFournisseursEchus(admin);
  const { data: lignes, error } = await admin.from('gains_fournisseurs')
    .select('id, order_id, order_number, amount, status, unlock_at, created_at')
    .eq('supplier_id', fournisseur)
    .order('created_at', { ascending: false })
    .limit(5000);
  if (error) {
    // SQL du lot C pas encore exécuté : aucun solde, sans erreur pour le fournisseur.
    if (lotCAbsent(error)) return NextResponse.json({ actif: false, soldes: AUCUN_SOLDE, gains: [], retraits: [] });
    return NextResponse.json({ error: 'Solde illisible pour le moment.' }, { status: 500 });
  }

  const recents = (lignes || []).slice(0, 100);
  const ids = [...new Set(recents.map((g) => g.order_id).filter(Boolean))] as string[];
  const lireCommandes = async () => ids.length
    ? (await admin.from('orders').select('id, product_name, quantity, delivered_at').in('id', ids)).data || []
    : [];
  const lireRetraits = async () => (await admin.from('payouts').select('*')
    .eq('reseller_id', fournisseur).eq('beneficiaire', 'fournisseur')
    .order('created_at', { ascending: false }).limit(50)).data || [];
  const lireTelephone = async () => (await admin.from('suppliers').select('contact_phone')
    .eq('profile_id', fournisseur).maybeSingle()).data?.contact_phone || '';
  const [commandes, retraits, telephone, { reglages }] = await Promise.all([lireCommandes(), lireRetraits(), lireTelephone(), chargerReglages()]);
  const parCommande = new Map(commandes.map((o: any) => [o.id, o]));

  return NextResponse.json({
    actif: true,
    soldes: resumerSoldeFournisseur(lignes || []),
    delaiJours: reglages.delaiGainFournisseurJours,
    gains: recents.map((g) => {
      const o: any = g.order_id ? parCommande.get(g.order_id) : null;
      return {
        id: g.id,
        commande: g.order_number || null,
        produit: o?.product_name || null,
        quantite: Number(o?.quantity) || 1,
        livreeLe: o?.delivered_at || null,
        montant: Number(g.amount) || 0,
        statut: g.status,
        disponibleLe: g.unlock_at || null,
      };
    }),
    retraits: retraits.map(retraitAffiche),
    telephone,
  });
}
