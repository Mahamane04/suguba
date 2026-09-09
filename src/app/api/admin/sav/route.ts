import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * Tickets après-vente — lecture, création et mise à jour, admin uniquement.
 *
 * Remplace les trois actions purement locales du store (createSavTicket,
 * dispatchSavCourier, resolveSavTicket) : une réclamation client n'existait
 * que dans le navigateur de l'admin qui l'avait saisie, invisible à ses
 * collègues et perdue au premier vidage de cache.
 *
 * Le numéro de ticket et le code d'échange sont générés ICI : ce sont des
 * identifiants de confiance, ils n'ont pas à venir du navigateur.
 */

async function exigerAdmin(req: NextRequest) {
  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!session || session.role !== 'admin') return null;
  return session;
}

export async function GET(req: NextRequest) {
  if (!(await exigerAdmin(req))) {
    return NextResponse.json({ error: 'Authentification admin requise.' }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ tickets: [] });

  const { data, error } = await admin
    .from('sav_tickets')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const tickets = (data || []).map((t) => ({
    id: t.id,
    ticketNumber: t.ticket_number,
    orderId: t.order_id,
    orderNumber: t.order_number,
    customerName: t.customer_name,
    customerPhone: t.customer_phone,
    productName: t.product_name,
    supplierName: t.supplier_name,
    issueDescription: t.issue_description,
    resolutionType: t.resolution_type,
    status: t.status,
    driverId: t.driver_id,
    driverName: t.driver_name,
    driverPhone: t.driver_phone,
    swapOtp: t.swap_otp,
    notes: t.notes,
    createdAt: t.created_at,
    resolvedAt: t.resolved_at,
  }));

  return NextResponse.json({ tickets });
}

export async function POST(req: NextRequest) {
  if (!(await exigerAdmin(req))) {
    return NextResponse.json({ error: 'Authentification admin requise.' }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Base indisponible.' }, { status: 503 });

  try {
    const body = await req.json();
    const { orderId, issueDescription, resolutionType } = body as {
      orderId?: string; issueDescription?: string; resolutionType?: string;
    };

    if (!orderId || !issueDescription?.trim()) {
      return NextResponse.json({ error: 'Commande et description du problème requises.' }, { status: 400 });
    }

    // Les informations client et produit sont relues sur la commande, jamais
    // prises depuis le navigateur : un ticket doit décrire la vraie commande.
    const { data: commande } = await admin
      .from('orders')
      .select('id, order_number, customer_name, customer_phone, product_name')
      .eq('id', orderId)
      .maybeSingle();

    if (!commande) {
      return NextResponse.json({ error: 'Commande introuvable.' }, { status: 404 });
    }

    const ticketNumber = `SAV-${Date.now().toString().slice(-6)}`;

    const { data, error } = await admin.from('sav_tickets').insert({
      ticket_number: ticketNumber,
      order_id: commande.id,
      order_number: commande.order_number,
      customer_name: commande.customer_name,
      customer_phone: commande.customer_phone,
      product_name: commande.product_name,
      issue_description: issueDescription.trim(),
      resolution_type: ['swap_new', 'repair', 'refund'].includes(String(resolutionType))
        ? resolutionType
        : 'swap_new',
      status: 'open',
    }).select().maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true, ticketNumber, id: data?.id });
  } catch (error: any) {
    console.error('[API admin/sav POST ERROR]', error);
    return NextResponse.json({ error: error.message || 'Erreur serveur.' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!(await exigerAdmin(req))) {
    return NextResponse.json({ error: 'Authentification admin requise.' }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Base indisponible.' }, { status: 503 });

  try {
    const body = await req.json();
    const { ticketId, action, driverId, notes } = body as {
      ticketId?: string; action?: string; driverId?: string; notes?: string;
    };

    if (!ticketId || !action) {
      return NextResponse.json({ error: 'Ticket et action requis.' }, { status: 400 });
    }

    const { data: ticket } = await admin
      .from('sav_tickets').select('id, status').eq('id', ticketId).maybeSingle();
    if (!ticket) {
      return NextResponse.json({ error: 'Ticket introuvable.' }, { status: 404 });
    }

    if (action === 'dispatch') {
      if (!driverId) {
        return NextResponse.json({ error: 'Livreur requis.' }, { status: 400 });
      }
      // Le livreur est relu en base : l'ancienne version le cherchait dans le
      // tableau de livreurs fictifs du navigateur (mock-data.ts).
      const { data: profil } = await admin
        .from('profiles').select('id, full_name, phone').eq('id', driverId).maybeSingle();
      if (!profil) {
        return NextResponse.json({ error: 'Livreur introuvable.' }, { status: 404 });
      }

      const swapOtp = String(Math.floor(1000 + Math.random() * 9000));
      const { error } = await admin.from('sav_tickets').update({
        status: 'courier_dispatched',
        driver_id: profil.id,
        driver_name: profil.full_name,
        driver_phone: profil.phone,
        swap_otp: swapOtp,
      }).eq('id', ticketId);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, swapOtp });
    }

    if (action === 'resolve') {
      if (ticket.status === 'resolved') {
        return NextResponse.json({ success: true, ignore: 'déjà résolu' });
      }
      const { error } = await admin.from('sav_tickets').update({
        status: 'resolved',
        notes: notes || null,
        resolved_at: new Date().toISOString(),
      }).eq('id', ticketId);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Action inconnue.' }, { status: 400 });
  } catch (error: any) {
    console.error('[API admin/sav PATCH ERROR]', error);
    return NextResponse.json({ error: error.message || 'Erreur serveur.' }, { status: 500 });
  }
}
