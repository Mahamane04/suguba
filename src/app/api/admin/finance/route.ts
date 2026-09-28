import { refusSansPermissionAdmin } from '@/lib/reseau/permission-admin';
import { NextRequest, NextResponse } from 'next/server';
import { sessionAvecRole } from '@/lib/reseau/route-session';
import { adminPeut } from '@/lib/reseau/db';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { syntheseFinance } from '@/lib/admin/finance';
export async function GET(req: NextRequest) {
  const refus = await refusSansPermissionAdmin(req, 'GET /api/admin/finance');
  if (refus) return refus;
  const session=await sessionAvecRole(req,'admin');
  if(!session)return NextResponse.json({error:'Session admin requise.'},{status:401});
  if(!await adminPeut(session.uid,'finance.lire'))return NextResponse.json({error:'Accès finance requis.'},{status:403});
  const debut=req.nextUrl.searchParams.get('debut') || undefined, fin=req.nextUrl.searchParams.get('fin') || undefined;
  if([debut,fin].some(x=>x && (!/^\d{4}-\d{2}-\d{2}$/.test(x)||!Number.isFinite(Date.parse(x))||new Date(x).toISOString().slice(0,10)!==x)) || (debut&&fin&&debut>fin)) return NextResponse.json({error:'Période invalide.'},{status:400});
  const a=getSupabaseAdmin();if(!a)return NextResponse.json({error:'Finance indisponible.'},{status:503});
  async function lire(table:string, colonnes:string){const lignes:any[]=[];for(let page=0;page<100;page++){
    const {data,error}=await a!.from(table).select(colonnes).order('id').range(page*1000,page*1000+999);
    if(error)throw Error('Données financières indisponibles. Réessayez.');lignes.push(...(data||[]));if(!data||data.length<1000)return lignes;
  }throw Error('Volume trop important pour cette synthèse.');}
  try {const [orders,commissions]=await Promise.all([
    lire('orders','id, order_number, product_name, reseller_name, quantity, total_product_amount, total_amount, delivery_fee, reseller_commission, pricing_snapshot, created_at, delivered_at, status, payment_collected'),
    lire('commissions','id, order_id, order_number, amount, status, unlock_at')
  ]);return NextResponse.json({...syntheseFinance(orders,commissions,debut,fin),misAJourLe:new Date().toISOString()},{headers:{'Cache-Control':'no-store'}});
  }catch(e){return NextResponse.json({error:(e as Error).message},{status:503});}
}
