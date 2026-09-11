/**
 * Publication AUTOMATIQUE d'un produit — SERVEUR UNIQUEMENT (2026-09-11).
 *
 * Décision de l'utilisateur : plus de validation manuelle avant la mise en
 * vente. Un produit déposé est publié tout de suite au PRIX RECOMMANDÉ par le
 * moteur de tarification (src/lib/pricing.ts), avec sa commission ; l'admin
 * contrôle après coup (liste « Nouveautés fournisseurs » de /admin/products)
 * et peut ajuster le prix ou retirer le produit.
 *
 * Deux garde-fous, sans lesquels le produit reste en attente avec la raison :
 *  - au moins une photo : sans elle, le produit se partage mal ;
 *  - un prix rentable : si le moteur ne trouve aucun prix couvrant les coûts,
 *    un humain doit trancher.
 * Un produit RETIRÉ par l'admin (rejected, archived) n'est jamais republié
 * automatiquement.
 *
 * Ne jamais importer ce fichier depuis un composant 'use client'.
 */
import { getSupabaseAdmin } from './supabase-admin';
import { chargerReglages } from './platform-settings';
import { calculerTarif } from './pricing';

type ClientAdmin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

export interface ResultatPublication {
  publie: boolean;
  prix?: number;
  commission?: number;
  /** Pourquoi le produit n'a pas été publié, en clair pour le fournisseur. */
  raison?: string;
}

export async function publierAutomatiquement(admin: ClientAdmin, productId: string): Promise<ResultatPublication> {
  const { data: p } = await admin
    .from('products')
    .select('id, status, supplier_price, images')
    .eq('id', productId)
    .maybeSingle();

  if (!p) return { publie: false, raison: 'Produit introuvable.' };
  if (p.status === 'approved') return { publie: false, raison: 'Déjà en vente.' };
  if (!['submitted', 'pending', 'draft'].includes(p.status)) {
    return { publie: false, raison: 'Produit retiré de la vente : seul un administrateur peut le remettre en vente.' };
  }

  const photos = Array.isArray(p.images) ? p.images.filter(Boolean) : [];
  if (photos.length === 0) {
    return { publie: false, raison: 'Ajoutez au moins une photo : le produit sera alors publié automatiquement.' };
  }

  const prixFournisseur = Number(p.supplier_price) || 0;
  if (prixFournisseur <= 0) return { publie: false, raison: 'Prix fournisseur manquant.' };

  const { reglages } = await chargerReglages();
  // Le prix recommandé ne dépend que du prix fournisseur et des réglages.
  const prix = calculerTarif(prixFournisseur, 0, reglages).prixRecommande;
  const tarif = calculerTarif(prixFournisseur, prix, reglages);
  if (!(prix > 0) || tarif.statut === 'sous_plancher') {
    return { publie: false, raison: 'Aucun prix de vente rentable trouvé : un administrateur doit fixer le prix.' };
  }

  const { error } = await admin
    .from('products')
    .update({
      public_price: prix,
      reseller_commission: tarif.commission,
      status: 'approved',
      pricing_status: tarif.statut,
      pricing_computed_at: new Date().toISOString(),
    })
    .eq('id', productId)
    // Garde contre une course : ne publier que si le statut n'a pas bougé
    // entre-temps (retrait par l'admin au même moment, par exemple).
    .eq('status', p.status);
  if (error) return { publie: false, raison: error.message };

  return { publie: true, prix, commission: tarif.commission };
}
