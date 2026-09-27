import { NextRequest, NextResponse } from 'next/server';
import { refusSansPermissionAdmin } from '@/lib/reseau/permission-admin';
import { sessionAvecRole } from '@/lib/reseau/route-session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { chargerReglages } from '@/lib/platform-settings';
import { completerReglages, tarifProduit, validerReglages } from '@/lib/pricing';
import { CHAMPS_SIMULATION, lireModifs } from '@/lib/admin/pilotage';

/**
 * Simulateur de réglages (A5, 2026-09-27) : l'effet d'un changement
 * économique sur les produits en vente, AVANT de l'enregistrer. Rien n'est
 * écrit : ni réglage, ni prix, ni commission. Pour appliquer, passer par
 * « Paramètres et commissions » (droit et motif habituels).
 */
export async function GET(req: NextRequest) {
  const refus = await refusSansPermissionAdmin(req, 'GET /api/admin/simulateur');
  if (refus) return refus;
  if (!(await sessionAvecRole(req, 'admin'))) return NextResponse.json({ error: 'Session admin requise.' }, { status: 401 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Base indisponible.' }, { status: 503 });

  let brut: unknown = {};
  try { brut = JSON.parse(req.nextUrl.searchParams.get('modifs') || '{}'); } catch { return NextResponse.json({ error: 'Modifications illisibles.' }, { status: 400 }); }
  const modifs = lireModifs(brut);
  const { reglages: actuels } = await chargerReglages();
  const simules = completerReglages({ ...actuels, ...modifs });
  const erreurs = validerReglages(simules);

  const { data, error } = await admin.from('products')
    .select('id, name, supplier_price, public_price, commission_proposee, mode_prix, prix_conseille, mode_remise, frais_remise')
    .eq('status', 'approved').gt('public_price', 0).order('created_at', { ascending: false }).limit(40);
  if (error) return NextResponse.json({ error: 'Produits indisponibles.' }, { status: 503 });

  const lignes = (data || []).map((p: any) => {
    const produit = {
      prixFournisseur: Number(p.supplier_price) || 0,
      prixVente: Number(p.mode_prix === 'gros' ? p.prix_conseille || p.public_price : p.public_price) || 0,
      commissionProposee: p.commission_proposee == null ? null : Number(p.commission_proposee),
      modePrix: p.mode_prix === 'gros' ? 'gros' as const : 'fixe' as const,
      remise: p.mode_remise && p.mode_remise !== 'livreur' ? { mode: p.mode_remise, frais: Number(p.frais_remise) || 0 } : null,
    };
    const avant = tarifProduit(produit, actuels);
    const apres = tarifProduit(produit, simules);
    return {
      id: p.id, nom: p.name, prix: produit.prixVente,
      avant: { commission: avant.commission, margeNette: avant.margeNetteSuguba, partageable: avant.partageable, prixMinimal: avant.prixMinimal },
      apres: { commission: apres.commission, margeNette: apres.margeNetteSuguba, partageable: apres.partageable, prixMinimal: apres.prixMinimal },
    };
  });
  const somme = (f: (l: typeof lignes[number]) => number) => lignes.reduce((s, l) => s + f(l), 0);
  return NextResponse.json({
    champs: CHAMPS_SIMULATION.map((c) => ({ ...c, actuel: Number((actuels as unknown as Record<string, unknown>)[c.cle]) || 0 })),
    modifs, erreurs, lignes,
    totaux: {
      margeNetteAvant: somme((l) => l.avant.margeNette), margeNetteApres: somme((l) => l.apres.margeNette),
      commissionsAvant: somme((l) => l.avant.commission), commissionsApres: somme((l) => l.apres.commission),
      nonPartageablesAvant: lignes.filter((l) => !l.avant.partageable).length, nonPartageablesApres: lignes.filter((l) => !l.apres.partageable).length,
    },
  }, { headers: { 'Cache-Control': 'private, no-store' } });
}
