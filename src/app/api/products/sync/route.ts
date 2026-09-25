import { refusSansPermissionAdmin } from '@/lib/reseau/permission-admin';
import { verifyActiveSession } from '@/lib/active-session';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { SESSION_COOKIE_NAME } from '@/lib/session';
import { contexteFournisseur } from '@/lib/reseau/contexte-fournisseur';
import { publierAutomatiquement } from '@/lib/publication-auto';
import { normaliserEtapes, normaliserModeRemise, normaliserTypeOffre } from '@/lib/offre';

/**
 * Création et modification des fiches produit — fournisseur ou admin.
 *
 * Remplace l'ancien `pushProductToCloud` (écriture directe anon-key). Le
 * schéma ne donne plus qu'un accès public en LECTURE aux produits approuvés.
 *
 * ── Ce que cette route n'accepte plus du navigateur ──────────────────────
 * Elle enregistrait telles quelles les valeurs envoyées : prix de vente,
 * commission revendeur et STATUT. Un fournisseur pouvait donc publier son
 * propre article en « approuvé », sans modération, avec la commission de son
 * choix. Et un fournisseur pouvait écraser la fiche d'un autre en réutilisant
 * son identifiant.
 *
 * Désormais :
 *  - prix de vente et commission ne sont JAMAIS lus du navigateur : ils sont
 *    calculés par le moteur de tarification, soit à la publication
 *    automatique (src/lib/publication-auto.ts), soit via
 *    /api/admin/products/price quand l'admin ajuste le prix ;
 *  - un dépôt fournisseur est publié AUTOMATIQUEMENT au prix recommandé
 *    (décision du 2026-09-11 : plus de validation manuelle préalable), s'il a
 *    une photo et qu'un prix rentable existe ; sinon il reste en attente avec
 *    la raison, renvoyée au fournisseur ;
 *  - un fournisseur ne modifie que ses propres fiches ;
 *  - l'adresse (slug) d'un produit ne change jamais après sa création : elle
 *    figure dans les liens déjà partagés sur WhatsApp ;
 *  - un changement de prix fournisseur sur un produit en vente le fait
 *    RETARIFER automatiquement (plancher recalculé). Sans cela, un fournisseur
 *    pourrait augmenter son prix et faire passer le produit sous le plancher
 *    de Suguba sans que personne ne le voie.
 */
export async function POST(req: NextRequest) {
  const denied = await refusSansPermissionAdmin(req, 'POST /api/products/sync');
  if (denied) return denied;
  const session = await verifyActiveSession(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!session || !['admin', 'supplier'].includes(session.role)) {
    return NextResponse.json({ error: 'Authentification fournisseur ou admin requise.' }, { status: 401 });
  }

  // Un collaborateur de l'équipe agit pour SON fournisseur, avec le droit
  // « catalogue » (voir src/lib/reseau/contexte-fournisseur.ts). Le
  // propriétaire reste son propre fournisseur, comme avant.
  let fournisseurId = session.uid;
  if (session.role === 'supplier') {
    const contexte = await contexteFournisseur(session.uid);
    if (!contexte || !contexte.droits.includes('catalogue')) {
      return NextResponse.json({ error: 'Votre rôle dans l’équipe ne permet pas de modifier le catalogue.' }, { status: 403 });
    }
    fournisseurId = contexte.fournisseurId;
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ success: true, cloud: false });
  }

  try {
    const body = await req.json();
    const product = body.product;
    if (!product?.id || !product?.slug) {
      return NextResponse.json({ error: 'Produit invalide.' }, { status: 400 });
    }

    const { data: existant } = await admin
      .from('products')
      .select('*')
      .eq('id', product.id)
      .maybeSingle();

    const estFournisseur = session.role === 'supplier';

    if (estFournisseur && existant && existant.supplier_id !== fournisseurId) {
      return NextResponse.json({ error: 'Ce produit ne vous appartient pas.' }, { status: 403 });
    }

    // Un fournisseur ne peut jamais attribuer son dépôt à un autre
    // supplier_id que le sien. Un admin, lui, peut légitimement créer ou
    // corriger une fiche au nom d'un fournisseur donné.
    let supplierId = product.supplierId;
    let supplierName = product.supplierName;
    if (estFournisseur) {
      supplierId = fournisseurId;
      const { data: ownSupplier } = await admin
        .from('suppliers')
        .select('company_name')
        .eq('profile_id', fournisseurId)
        .maybeSingle();
      supplierName = ownSupplier?.company_name || supplierName;
    }

    const descriptif = {
      name: product.name,
      category: product.category,
      description: product.description,
      stock: product.stockQuantity,
      images: product.images,
    };
    const prixFournisseur = Number(product.supplierPrice);

    // Part revendeur choisie par le fournisseur : le SEUL montant accepté du
    // navigateur, parce que c'est l'argent du fournisseur qu'il décide de
    // partager. Suguba ne la prend jamais telle quelle pour fixer un prix : le
    // moteur calcule le prix client autour d'elle et le relève au plancher.
    // undefined = non envoyée (on ne touche pas à la valeur en base).
    let partProposee: number | null | undefined;
    if (product.resellerCommissionProposee !== undefined) {
      const v = Number(product.resellerCommissionProposee);
      if (!Number.isFinite(v) || v < 0 || v > 10_000_000) {
        return NextResponse.json({ error: 'Part revendeur invalide.' }, { status: 400 });
      }
      partProposee = v > 0 ? v : null;
    }

    // Prix de gros (2026-09-24) : le revendeur fixera son prix. Colonnes
    // envoyées SEULEMENT quand elles servent, pour qu'un produit à prix fixe
    // s'enregistre même si la base n'a pas encore ces colonnes.
    let prixDeGros: { mode_prix: 'fixe' | 'gros'; prix_conseille: number | null } | undefined;
    if (product.modePrix === 'gros' || product.modePrix === 'fixe') {
      const conseil = Number(product.prixConseille);
      prixDeGros = {
        mode_prix: product.modePrix,
        prix_conseille: product.modePrix === 'gros' && Number.isFinite(conseil) && conseil > 0 && conseil <= 100_000_000 ? Math.round(conseil) : null,
      };
      if (prixDeGros.mode_prix === 'gros') partProposee = null;
    }
    const avecPrixDeGros = (ligne: Record<string, unknown>) =>
      prixDeGros && (prixDeGros.mode_prix === 'gros' || existant?.mode_prix === 'gros') ? { ...ligne, ...prixDeGros } : ligne;

    // Offre (2026-09-26) : nature (produit / service) et qui la remet au
    // client. Même principe que le prix de gros : colonnes envoyées seulement
    // quand elles servent, pour qu'un produit ordinaire s'enregistre même si
    // la base n'a pas encore été mise à jour.
    let offre: { type_offre: string; mode_remise: string; frais_remise: number; offre_inclus: string | null } | undefined;
    if ([product.typeOffre, product.modeRemise, product.fraisRemise, product.offreInclus].some((v) => v !== undefined)) {
      const mode = normaliserModeRemise(product.modeRemise);
      const frais = Number(product.fraisRemise ?? 0);
      if (mode === 'fournisseur' && (!Number.isFinite(frais) || frais < 0 || frais > 10_000_000)) {
        return NextResponse.json({ error: 'Frais de remise invalides.' }, { status: 400 });
      }
      offre = {
        type_offre: normaliserTypeOffre(product.typeOffre),
        mode_remise: mode,
        frais_remise: mode === 'fournisseur' ? Math.round(frais) : 0,
        offre_inclus: typeof product.offreInclus === 'string' ? product.offreInclus.trim().slice(0, 1000) || null : null,
      };
    }
    const offreParDefaut = !offre || (offre.type_offre === 'produit' && offre.mode_remise === 'livreur' && !offre.offre_inclus);
    const colonnesOffre = Boolean(existant && 'mode_remise' in existant);
    // Commande sur devis (lot 1b) : colonne à part, envoyée seulement quand
    // elle sert (même principe que les autres colonnes récentes).
    const modeCommande = product.modeCommande === 'devis' ? 'devis' : product.modeCommande === 'achat' ? 'achat' : undefined;
    // Étapes de prestation (lot 1c) : seulement si le fournisseur remet
    // lui-même ; même principe d'envoi que les autres colonnes récentes.
    const etapes = product.etapes === undefined ? undefined
      : offre && offre.mode_remise !== 'livreur' ? normaliserEtapes(product.etapes) : [];
    const avecEtapes = (ligne: Record<string, unknown>) =>
      etapes && (etapes.length > 0 || (existant && 'etapes' in existant)) ? { ...ligne, etapes: etapes.length ? etapes : null } : ligne;
    const avecDevis = (ligne: Record<string, unknown>) => avecEtapes(
      modeCommande && (modeCommande === 'devis' || (existant && 'mode_commande' in existant)) ? { ...ligne, mode_commande: modeCommande } : ligne);
    const avecOffre = (ligne: Record<string, unknown>) => avecDevis(offre && (!offreParDefaut || colonnesOffre) ? { ...ligne, ...offre } : ligne);

    const erreurColonne = (e: { code?: string; message: string }) => {
      if (/etapes/.test(e.message)) {
        return NextResponse.json({ error: 'Les prestations à étapes seront disponibles après la mise à jour de la base par Suguba.' }, { status: 503 });
      }
      if (/mode_commande/.test(e.message)) {
        return NextResponse.json({ error: 'Les offres sur devis seront disponibles après la mise à jour de la base par Suguba.' }, { status: 503 });
      }
      if (/type_offre|mode_remise|frais_remise|offre_inclus/.test(e.message)) {
        return NextResponse.json({ error: 'Les services et la remise par vous-même seront disponibles après la mise à jour de la base par Suguba.' }, { status: 503 });
      }
      return (e.code === '42703' || /mode_prix|prix_conseille/.test(e.message))
        ? NextResponse.json({ error: 'La vente au prix de gros sera disponible après la mise à jour de la base par Suguba.' }, { status: 503 })
        : NextResponse.json({ error: e.message }, { status: 500 });
    };

    // ── Création ──────────────────────────────────────────────────────────
    if (!existant) {
      // Aucun produit ne naît approuvé : l'approbation passe par la
      // tarification admin, qui calcule la commission.
      const statut = estFournisseur || product.status === 'approved' ? 'submitted' : (product.status || 'submitted');
      const { error } = await admin.from('products').insert(avecOffre(avecPrixDeGros({
        id: product.id,
        slug: product.slug,
        ...descriptif,
        supplier_price: Number.isFinite(prixFournisseur) ? prixFournisseur : 0,
        public_price: 0,
        reseller_commission: 0,
        commission_proposee: partProposee ?? null,
        status: statut,
        supplier_id: supplierId,
        supplier_name: supplierName,
        created_at: product.createdAt,
      })));
      if (error) return erreurColonne(error);

      // Dépôt fournisseur : publication automatique. L'admin, lui, publie avec
      // SON prix juste après (voir /admin/products/new).
      if (estFournisseur) {
        const publication = await publierAutomatiquement(admin, product.id);
        return NextResponse.json({
          success: true, cloud: true, status: publication.publie ? 'approved' : statut, publication,
        });
      }
      return NextResponse.json({ success: true, cloud: true, status: statut });
    }

    // ── Modification ──────────────────────────────────────────────────────
    const maj: Record<string, unknown> = { ...descriptif };
    let statut = existant.status as string;

    if (Number.isFinite(prixFournisseur) && prixFournisseur !== Number(existant.supplier_price)) {
      maj.supplier_price = prixFournisseur;
      if (existant.status === 'approved') {
        statut = 'submitted';
        maj.reseller_commission = 0;
        maj.pricing_status = null;
      }
    }

    // Nouvelle part revendeur : même traitement qu'un nouveau prix fournisseur,
    // le produit est retarifé automatiquement autour d'elle.
    if (partProposee !== undefined && (partProposee ?? null) !== (existant.commission_proposee == null ? null : Number(existant.commission_proposee))) {
      maj.commission_proposee = partProposee;
      if (existant.status === 'approved') {
        statut = 'submitted';
        maj.reseller_commission = 0;
        maj.pricing_status = null;
      }
    }

    if (!estFournisseur) {
      if (product.supplierId) maj.supplier_id = supplierId;
      if (product.supplierName) maj.supplier_name = supplierName;
      // L'admin peut rejeter, archiver ou renvoyer en modération — jamais
      // approuver par ici. Demander « approuvé » sur un produit qui l'est déjà
      // ne change rien ; sur un produit qui ne l'est pas, c'est ignoré.
      const demande = product.status;
      if (demande && demande !== 'approved' && statut !== 'submitted') statut = demande;
      if (demande && demande !== 'approved' && existant.status !== 'approved') statut = demande;
    }

    // Passage au prix de gros, ou nouveau prix conseillé : retarifé comme un nouveau prix.
    if (prixDeGros && (prixDeGros.mode_prix !== (existant.mode_prix || 'fixe')
        || (prixDeGros.prix_conseille ?? null) !== (existant.prix_conseille == null ? null : Number(existant.prix_conseille)))) {
      Object.assign(maj, prixDeGros);
      if (prixDeGros.mode_prix === 'gros') maj.commission_proposee = null;
      if (existant.status === 'approved') {
        statut = 'submitted';
        maj.reseller_commission = 0;
        maj.pricing_status = null;
      }
    }

    // Offre : nature et mode de remise. Ne change pas le prix, donc pas de
    // nouvelle tarification.
    if (offre && (!offreParDefaut || colonnesOffre)) Object.assign(maj, offre);
    Object.assign(maj, avecDevis({}));

    maj.status = statut;
    const { error } = await admin.from('products').update(maj).eq('id', product.id);
    if (error) return erreurColonne(error);

    // Revenu en attente (prix fournisseur changé) ou jamais publié : on
    // retente la publication automatique au nouveau prix recommandé.
    if (statut === 'submitted') {
      const publication = await publierAutomatiquement(admin, product.id);
      return NextResponse.json({
        success: true, cloud: true, status: publication.publie ? 'approved' : statut, publication,
      });
    }
    return NextResponse.json({ success: true, cloud: true, status: statut });
  } catch (error: any) {
    console.error('[API products/sync ERROR]', error);
    return NextResponse.json({ error: error.message || 'Erreur serveur.' }, { status: 500 });
  }
}
