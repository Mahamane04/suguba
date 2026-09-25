import { NextRequest, NextResponse } from 'next/server';
import { exigerDroitFournisseur } from '@/lib/reseau/contexte-fournisseur';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { preparerRemise } from '@/lib/remise-qr';
import { assurerEtapes, etapesNonValidees, EtapeError } from '@/lib/etapes';

/**
 * Remise par le fournisseur lui-même (2026-09-26, lot 1a) — véhicule remis
 * par le vendeur, installation, retrait dans ses locaux.
 *
 *   prendre    → « Organiser la remise » : la commande confirmée lui est
 *                assignée (prendre_en_charge_remise), aucun livreur Suguba.
 *   preparer   → scan du QR du client : vérifie la preuve, sans rien valider.
 *   confirmer  → « Confirmer la remise » : verify_delivery_atomic, la même
 *                fonction que pour un livreur (3 essais, idempotente).
 *
 * L'intervenant est toujours le fournisseur PROPRIÉTAIRE (celui qui porte
 * products.supplier_id), même si c'est un membre de son équipe ayant le
 * droit « commandes » qui agit.
 */
export async function POST(req: NextRequest) {
  const acces = await exigerDroitFournisseur(req, 'commandes');
  if (!acces.ok) return NextResponse.json({ error: acces.erreur }, { status: acces.statut });
  const fournisseurId = acces.contexte.fournisseurId;

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Base indisponible.' }, { status: 503 });

  const { action, orderId, qr, code } = await req.json().catch(() => ({}));
  if (typeof orderId !== 'string' || !orderId) return NextResponse.json({ error: 'Commande manquante.' }, { status: 400 });

  if (action === 'prendre') {
    const { data: fiche } = await admin.from('suppliers').select('company_name').eq('profile_id', fournisseurId).maybeSingle();
    const { data, error } = await admin.rpc('prendre_en_charge_remise', {
      p_order_id: orderId, p_supplier_id: fournisseurId, p_supplier_name: fiche?.company_name || 'Fournisseur',
    });
    if (error) {
      const manque = ['42883', 'PGRST202'].includes(String(error.code));
      return NextResponse.json({ error: manque ? 'La remise par le fournisseur sera disponible après la mise à jour de la base par Suguba.' : 'Action impossible. Réessayez.' }, { status: 503 });
    }
    const r = (data || {}) as { success?: boolean; error?: string; http?: number };
    if (!r.success) return NextResponse.json({ error: r.error || 'Action impossible.' }, { status: r.http || 400 });
    // Prestation à étapes (lot 1c) : le parcours est créé dès la prise en
    // charge. Un échec ici n'annule rien : il sera recréé à la première lecture.
    const { data: commande } = await admin.from('orders').select('id, pricing_snapshot').eq('id', orderId).maybeSingle();
    if (commande) await assurerEtapes(admin, commande).catch(() => 0);
    return NextResponse.json(r);
  }

  // Réception finale : seulement quand le client a validé toutes les étapes.
  if (action === 'preparer' || action === 'confirmer') {
    const { data: commande } = await admin.from('orders').select('id, pricing_snapshot, assigned_driver_id').eq('id', orderId).maybeSingle();
    if (commande && commande.assigned_driver_id === fournisseurId) {
      try {
        const restantes = await etapesNonValidees(admin, commande);
        if (restantes > 0) {
          return NextResponse.json({ error: `Le client doit d’abord valider ${restantes > 1 ? `les ${restantes} étapes restantes` : 'la dernière étape'} depuis son reçu.` }, { status: 409 });
        }
      } catch (e) {
        const err = e as EtapeError;
        return NextResponse.json({ error: err.message }, { status: err.status || 503 });
      }
    }
  }

  if (action === 'preparer') {
    const r = await preparerRemise(admin, fournisseurId, orderId, qr);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json(r.corps, { headers: { 'Cache-Control': 'no-store' } });
  }

  if (action === 'confirmer') {
    if (typeof code !== 'string' || !/^\d{4}$/.test(code)) return NextResponse.json({ error: 'Code à quatre chiffres requis.' }, { status: 400 });
    const { data, error } = await admin.rpc('verify_delivery_atomic', { p_order_id: orderId, p_driver_id: fournisseurId, p_code: code });
    if (error && /ETAPES_NON_VALIDEES/.test(error.message)) {
      return NextResponse.json({ error: 'Le client doit d’abord valider toutes les étapes depuis son reçu.' }, { status: 409 });
    }
    if (error || !data) return NextResponse.json({ error: 'Remise non confirmée. Réessayez avec le même code.' }, { status: 503 });
    const r = data as { success?: boolean; error?: string; http?: number };
    return NextResponse.json(r.error ? { error: r.error } : r, { status: r.http || 200 });
  }

  return NextResponse.json({ error: 'Action inconnue.' }, { status: 400 });
}
