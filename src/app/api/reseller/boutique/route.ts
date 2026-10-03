import { NextRequest, NextResponse } from 'next/server';
import { sessionAvecRole } from '@/lib/reseau/route-session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { boutiqueDuProprietaire, majBoutique, obtenirOuCreerBoutique, MAX_GALERIE, type BoutiqueReseau } from '@/lib/reseau/boutiques';
import { estEnseigne, nomPublic } from '@/lib/enseigne';
import { imageAutorisee } from '@/lib/reseau/images-boutique';
import { FAMILLES_CATEGORIES } from '@/lib/product-categories';

/**
 * Boutique du revendeur (§ 6) — /boutique/<adresse>.
 *
 * GET : créée au premier accès à partir du prénom et de l'initiale du compte :
 * un revendeur ne doit pas avoir à « créer une boutique » avant de pouvoir
 * partager quoi que ce soit. ?creer=non lit sans rien créer (démarrage).
 *
 * POST {nom} (lot 2 du chantier boutique, 2026-10-03) : création AVEC le nom
 * choisi à l'étape « Nom de votre boutique » du démarrage, qui donne son adresse.
 * Le démarrage ouvrait cette route en GET dès son affichage : la boutique naissait
 * avant que le revendeur ait choisi son nom, et l'adresse ne changeait plus.
 *
 * PATCH : identité de la vitrine, durcie au lot 2 (images de son dossier
 * seulement, ni recrutement ni WhatsApp, familles de l'annuaire seulement).
 *
 * Chaque réponse porte `vitrine` {nom, enseigne} : le nom que voient les clients,
 * calculé ICI à partir du nom du compte, qui ne quitte jamais le serveur.
 */

type Admin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

const FAMILLES = new Set(FAMILLES_CATEGORIES.map((f) => f.famille));
/** Mêmes limites que les écrans (nom 60, mot d'accueil 90). */
const NOM_MAX = 60;
const ACCUEIL_MAX = 90;

async function lireProfil(admin: Admin | null, uid: string) {
  if (!admin) return { profil: null, illisible: true };
  const { data, error } = await admin.from('profiles').select('full_name, reseller_code').eq('id', uid).maybeSingle();
  return { profil: data as { full_name: string | null; reseller_code: string | null } | null, illisible: Boolean(error) || !data };
}

/** Nom affiché aux clients : l'enseigne, ou « Awa D. » (jamais le nom complet). */
function vitrineDe(boutique: BoutiqueReseau | null, nomComplet: string | null | undefined) {
  if (!boutique) return null;
  const enseigne = estEnseigne(boutique.nom, nomComplet);
  return { nom: enseigne ? boutique.nom : nomPublic(nomComplet || null), enseigne };
}

export async function GET(req: NextRequest) {
  const session = await sessionAvecRole(req, 'reseller');
  if (!session) return NextResponse.json({ error: 'Session revendeur requise.' }, { status: 401 });

  const admin = getSupabaseAdmin();
  const { profil, illisible } = await lireProfil(admin, session.uid);
  const sansCreation = req.nextUrl.searchParams.get('creer') === 'non';

  // Relecture du lot 1 du chantier boutique (2026-10-03) : création avec
  // « Prénom I. » (nomPublic), comme la porte /reseller/ma-boutique qui renvoie
  // ici en cas d'échec — jamais le nom complet, dont l'adresse était tirée pour
  // toujours. Profil illisible : rien n'est créé (une boutique « Revendeur
  // Suguba » garderait cette adresse) ; la page affiche son écran d'attente.
  const boutique =
    (await boutiqueDuProprietaire('reseller', session.uid)) ||
    (!sansCreation && !illisible && profil
      ? await obtenirOuCreerBoutique({
        typeProprietaire: 'reseller',
        proprietaireId: session.uid,
        nom: nomPublic(profil.full_name || null),
      })
      : null);

  return NextResponse.json({
    boutique,
    codeRevendeur: profil?.reseller_code || null,
    vitrine: illisible ? null : vitrineDe(boutique, profil?.full_name),
    maxGalerie: MAX_GALERIE,
  });
}

/**
 * Création avec le nom choisi au démarrage. 409 si la boutique existe déjà (le
 * démarrage fait alors un PATCH). Un nom qui reprend celui de la personne
 * n'est pas une enseigne : l'adresse est alors tirée de « Prénom I. ».
 */
export async function POST(req: NextRequest) {
  const session = await sessionAvecRole(req, 'reseller');
  if (!session) return NextResponse.json({ error: 'Session revendeur requise.' }, { status: 401 });
  // Aperçu d'un administrateur : identité fictive, aucune boutique à créer.
  if (session.apercu) return NextResponse.json({ error: 'Aperçu : rien n’est enregistré.' }, { status: 403 });

  const corps = await req.json().catch(() => ({}));
  const nom = typeof corps.nom === 'string' ? corps.nom.trim().replace(/\s+/g, ' ') : '';
  if (nom.length < 2 || nom.length > NOM_MAX) {
    return NextResponse.json({ error: 'Le nom de la boutique doit faire entre 2 et 60 caractères.' }, { status: 400 });
  }

  const existante = await boutiqueDuProprietaire('reseller', session.uid);
  if (existante) return NextResponse.json({ error: 'Votre boutique existe déjà.', boutique: existante }, { status: 409 });

  const admin = getSupabaseAdmin();
  const { profil, illisible } = await lireProfil(admin, session.uid);
  if (illisible || !profil) return NextResponse.json({ error: 'Votre profil est indisponible. Réessayez.' }, { status: 503 });

  const enseigne = estEnseigne(nom, profil.full_name);
  const boutique = await obtenirOuCreerBoutique({
    typeProprietaire: 'reseller',
    proprietaireId: session.uid,
    nom,
    adresseDepuis: enseigne ? nom : nomPublic(profil.full_name || null),
  });
  if (!boutique) return NextResponse.json({ error: 'Boutique indisponible pour le moment. Réessayez.' }, { status: 503 });
  return NextResponse.json({ boutique, vitrine: vitrineDe(boutique, profil.full_name) }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await sessionAvecRole(req, 'reseller');
  if (!session) return NextResponse.json({ error: 'Session revendeur requise.' }, { status: 401 });

  const boutique = await boutiqueDuProprietaire('reseller', session.uid);
  if (!boutique) return NextResponse.json({ error: 'Boutique introuvable.' }, { status: 404 });

  const corps = await req.json().catch(() => ({}));
  const source = corps && typeof corps === 'object' ? corps as Record<string, unknown> : {};

  // Liste blanche (lot 2, 2026-10-03). `recrute` est une notion fournisseur
  // (« je recherche des revendeurs ») et `whatsapp` attend la décision du
  // fondateur (pas de WhatsApp du revendeur sur sa vitrine pour l'instant) :
  // tous deux sont ignorés, même envoyés.
  const champs: Record<string, unknown> = {};
  for (const cle of ['nom', 'accroche', 'description', 'quartier'] as const) {
    if (cle in source) champs[cle] = source[cle];
  }
  if (typeof champs.nom === 'string' && champs.nom.trim().length > NOM_MAX) {
    return NextResponse.json({ error: 'Le nom de la boutique fait 60 caractères au plus.' }, { status: 400 });
  }
  if (typeof champs.accroche === 'string' && champs.accroche.trim().length > ACCUEIL_MAX) {
    return NextResponse.json({ error: 'Le mot d’accueil fait 90 caractères au plus.' }, { status: 400 });
  }

  // Images : seulement celles envoyées par CE compte (dossier boutiques/<uid>/),
  // ou celles déjà enregistrées. Une seule image refusée = rien n'est écrit.
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  for (const cle of ['logo', 'couverture'] as const) {
    if (!(cle in source)) continue;
    const valeur = source[cle];
    if (valeur === null || valeur === '') { champs[cle] = null; continue; }
    if (!imageAutorisee(valeur, session.uid, base, [boutique[cle]])) {
      return NextResponse.json({ error: 'Image refusée : envoyez-la depuis votre téléphone.' }, { status: 400 });
    }
    champs[cle] = valeur;
  }
  if ('galerie' in source) {
    if (!Array.isArray(source.galerie) || !source.galerie.every((u) => imageAutorisee(u, session.uid, base, boutique.galerie))) {
      return NextResponse.json({ error: 'Photo refusée : envoyez-la depuis votre téléphone.' }, { status: 400 });
    }
    champs.galerie = source.galerie;
  }

  // « Ce que je vends » : familles de l'annuaire /boutiques seulement.
  if (Array.isArray(source.categories)) {
    champs.categories = Array.from(new Set(source.categories.filter((c): c is string => typeof c === 'string' && FAMILLES.has(c))));
  }

  const resultat = await majBoutique(boutique.id, session.uid, champs);
  if (!resultat.ok) return NextResponse.json({ error: resultat.erreur }, { status: 400 });

  const apres = await boutiqueDuProprietaire('reseller', session.uid);
  const { profil, illisible } = await lireProfil(getSupabaseAdmin(), session.uid);
  return NextResponse.json({ boutique: apres, vitrine: illisible ? null : vitrineDe(apres, profil?.full_name) });
}
