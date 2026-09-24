import type { SupabaseClient } from '@supabase/supabase-js';
import { positionValide, type Coord } from './bamako-quartiers';

/**
 * Dépôt d'un fournisseur, point de départ de la livraison (2026-09-24).
 *
 * Remplace cinq copies de la même lecture (`warehouse_neighborhood`) dans le
 * devis, la commande, le devis panier et la création panier. On lit toute la
 * fiche (`select('*')`) pour que la position GPS soit prise dès que la base a
 * les colonnes warehouse_lat / warehouse_lng, sans casser avant.
 */
export interface DepotFournisseur {
  quartier?: string;
  position?: Coord | null;
}

export function depotDepuisFiche(f: Record<string, any> | null | undefined): DepotFournisseur {
  if (!f) return {};
  return {
    quartier: f.warehouse_neighborhood || undefined,
    position: positionValide({ lat: f.warehouse_lat, lng: f.warehouse_lng }),
  };
}

export async function depotsFournisseurs(
  admin: SupabaseClient,
  ids: (string | null | undefined)[],
): Promise<Map<string, DepotFournisseur>> {
  const uniques = Array.from(new Set(ids.filter(Boolean))) as string[];
  const depots = new Map<string, DepotFournisseur>();
  if (uniques.length === 0) return depots;
  const { data } = await admin.from('suppliers').select('*').in('profile_id', uniques);
  for (const f of data || []) depots.set((f as any).profile_id, depotDepuisFiche(f as any));
  return depots;
}
