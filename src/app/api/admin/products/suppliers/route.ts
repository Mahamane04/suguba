import { refusSansPermissionAdmin } from '@/lib/reseau/permission-admin';
import { NextRequest, NextResponse } from 'next/server';
import { sessionAvecRole } from '@/lib/reseau/route-session';
import { adminPeut } from '@/lib/reseau/db';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
export async function GET(req:NextRequest){
  const refus = await refusSansPermissionAdmin(req, 'GET /api/admin/products/suppliers');
  if (refus) return refus;
  const session=await sessionAvecRole(req,'admin');if(!session)return NextResponse.json({error:'Session requise.'},{status:401});
  if(!await adminPeut(session.uid,'produit.moderer'))return NextResponse.json({error:'Accès catalogue requis.'},{status:403});
  const a=getSupabaseAdmin();if(!a)return NextResponse.json({error:'Fournisseurs indisponibles.'},{status:503});
  const {data,error}=await a.from('suppliers').select('profile_id, company_name').order('company_name').limit(1000);
  if(error)return NextResponse.json({error:'Fournisseurs indisponibles.'},{status:503});
  return NextResponse.json({fournisseurs:data||[]},{headers:{'Cache-Control':'no-store'}});
}
