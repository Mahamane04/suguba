import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { sessionAvecRole } from '@/lib/reseau/route-session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
const motifs = ['Fournisseur indisponible', 'Client absent', 'Client refuse le colis', 'Colis endommagé', 'Code de remise manquant'];
export async function POST(req: NextRequest) {
  const session = await sessionAvecRole(req, 'driver');
  if (!session) return NextResponse.json({ error: 'Session livreur requise.' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  if (typeof body.orderId !== 'string' || !motifs.includes(body.motif)) return NextResponse.json({ error: 'Choisissez une course et un motif.' }, { status: 400 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Service indisponible.' }, { status: 503 });
  const { data: order, error } = await admin.from('orders').select('id,order_number,customer_name,customer_phone,product_name,status').eq('id', body.orderId).eq('assigned_driver_id', session.uid).maybeSingle();
  if (error) return NextResponse.json({ error: 'Connexion impossible. Réessayez.' }, { status: 503 });
  if (!order || !['dispatched', 'in_transit'].includes(order.status)) return NextResponse.json({ error: 'Cette course ne vous est pas attribuée ou est déjà terminée.' }, { status: 403 });
  const description = `[Incident de course — décision équipe requise]\nLivreur : ${session.uid}\nMotif : ${body.motif}\n${typeof body.detail === 'string' ? body.detail.trim().slice(0, 1000) : ''}`;
  const { data: open, error: readError } = await admin.from('sav_tickets').select('ticket_number').eq('order_id', order.id).eq('status', 'open').like('issue_description', '[Incident de course%').limit(1);
  if (readError) return NextResponse.json({ error: 'Service indisponible. Réessayez.' }, { status: 503 });
  if (open?.length) return NextResponse.json({ ticketNumber: open[0].ticket_number });
  const ticketNumber = `COURSE-${randomUUID()}`;
  const { error: insertError } = await admin.from('sav_tickets').insert({ id: randomUUID(), ticket_number: ticketNumber, order_id: order.id, order_number: order.order_number, customer_name: order.customer_name, customer_phone: order.customer_phone, product_name: order.product_name, issue_description: description, resolution_type: 'repair', status: 'open', driver_id: session.uid, notes: 'Incident logistique : aucune modification de commande, remboursement ou échange autorisé par ce signalement.' });
  if (insertError) return NextResponse.json({ error: 'Signalement non enregistré. Réessayez.' }, { status: 503 });
  return NextResponse.json({ ticketNumber });
}
