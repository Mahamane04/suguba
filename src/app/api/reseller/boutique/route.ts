import { NextRequest, NextResponse } from 'next/server';
import { sessionAvecRole } from '@/lib/reseau/route-session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { boutiqueDuProprietaire, majBoutique, obtenirOuCreerBoutique, MAX_GALERIE, type BoutiqueReseau } from '@/lib/reseau/boutiques';
import { estEnseigne, nomPublic, nomPublicBoutique, nomReserve } from '@/lib/enseigne';
import { champsBoutiqueRevendeur, NOM_BOUTIQUE_MAX } from '@/lib/reseau/champs-boutique-revendeur';

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
 * La liste blanche est partagée avec POST /api/compte/boutiques « modifier »
 * (src/lib/reseau/champs-boutique-revendeur.ts, relecture du lot 2).
 *
 * Relecture du lot 2 (2026-10-03) : un nom réservé à Suguba (« Suguba
 * Officiel », « Admin »…) est refusé, et un nom qui n'est pas une enseigne (le
 * nom complet tapé au démarrage) est enregistré en « Prénom I. » : le nom
 * complet n'est plus écrit dans stores.name, que lisent l'annuaire et la recherche.
 *
 * Chaque réponse porte `vitrine` {nom, enseigne} : le nom que voient les clients,
 * calculé ICI à partir du nom du compte, qui ne quitte jamais le serveur.
 */

type Admin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

async function lireProfil(admin: Admin | null, uid: string) {
  if (!admin) return { profil: null, illisible: true };
  const { data, error } = await admin.from('profiles').select('full_name, reseller_code').eq('id', uid).maybeSingle();
  return { profil: data as { full_name: string | null; reseller_code: string | null } | null, illisible: Boolean(error) || !data };
}

/** Nom affiché aux clients : l'enseigne, ou « Awa D. » (jamais le nom complet). */
function vitrineDe(boutique: BoutiqueReseau | null, nomComplet: string | null | undefined) {
  if (!boutique) return null;
  return { nom: nomPublicBoutique(boutique.nom, nomComplet), enseigne: estEnseigne(boutique.nom, nomComplet) };
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
  if (nom.length < 2 || nom.length > NOM_BOUTIQUE_MAX) {
    return NextResponse.json({ error: 'Le nom de la boutique doit faire entre 2 et 60 caractères.' }, { status: 400 });
  }
  if (nomReserve(nom)) {
    return NextResponse.json({ error: 'Ce nom est réservé à Suguba. Choisissez le nom de votre boutique.' }, { status: 400 });
  }

  const existante = await boutiqueDuProprietaire('reseller', session.uid);
  if (existante) return NextResponse.json({ error: 'Votre boutique existe déjà.', boutique: existante }, { status: 409 });

  const admin = getSupabaseAdmin();
  const { profil, illisible } = await lireProfil(admin, session.uid);
  if (illisible || !profil) return NextResponse.json({ error: 'Votre profil est indisponible. Réessayez.' }, { status: 503 });

  // Nom qui n'est pas une enseigne (son propre nom) : « Prénom I. » pour le nom
  // ET pour l'adresse. Le nom complet tapé n'est jamais enregistré.
  const nomEnregistre = nomPublicBoutique(nom, profil.full_name);
  const boutique = await obtenirOuCreerBoutique({
    typeProprietaire: 'reseller',
    proprietaireId: session.uid,
    nom: nomEnregistre,
    adresseDepuis: nomEnregistre,
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

  // Liste blanche (lot 2, 2026-10-03). `recrute` est une notion fournisseur
  // (« je recherche des revendeurs ») et `whatsapp` attend la décision du
  // fondateur (pas de WhatsApp du revendeur sur sa vitrine pour l'instant) :
  // tous deux sont ignorés, même envoyés.
  const filtre = champsBoutiqueRevendeur(corps, { uid: session.uid, baseSupabase: process.env.NEXT_PUBLIC_SUPABASE_URL, boutique });
  if (!filtre.ok) return NextResponse.json({ error: filtre.erreur }, { status: 400 });
  const champs = filtre.champs;

  const admin = getSupabaseAdmin();
  const avant = await lireProfil(admin, session.uid);
  // Son propre nom (complet, ou « Awa Traoré ») n'est pas une enseigne : il est
  // enregistré en « Prénom I. », comme le voient les clients (relecture du lot 2).
  if (typeof champs.nom === 'string' && champs.nom.trim() && !avant.illisible && avant.profil) {
    champs.nom = nomPublicBoutique(champs.nom.trim().replace(/\s+/g, ' '), avant.profil.full_name);
  }

  const resultat = await majBoutique(boutique.id, session.uid, champs);
  if (!resultat.ok) return NextResponse.json({ error: resultat.erreur }, { status: 400 });

  const apres = await boutiqueDuProprietaire('reseller', session.uid);
  const { profil, illisible } = await lireProfil(admin, session.uid);
  return NextResponse.json({ boutique: apres, vitrine: illisible ? null : vitrineDe(apres, profil?.full_name) });
}
