// TEST-BOUTIQUE-LOT2-002..016 (chantier boutique du revendeur, 2026-10-03, lot 2
// « Je gère là où le client regarde ») : enseigne et titre public, « prête à X % »,
// images de la boutique limitées à son dossier, création au démarrage avec le nom
// choisi, bandeau et mode propriétaire, vue client sans outils.
// (TEST-BOUTIQUE-LOT2-001 : galerie validée par majBoutique, dans boutique-images.test.cjs.)
// Supabase, la session et les cookies sont SIMULÉS (require.cache) : aucune base réelle.
require('../scripts/test-typescript.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

global.fetch = async () => { throw Error('Réseau externe interdit dans les tests'); };
const RACINE = path.join(__dirname, '..');
const lire = (f) => fs.readFileSync(path.join(RACINE, f), 'utf8');
const sansCommentaires = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

const BASE = 'https://projet.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_URL = BASE;
const dossier = (uid) => `${BASE}/storage/v1/object/public/product-images/boutiques/${uid}/`;

// ── Base simulée (les mises à jour s'appliquent, pour relire après écriture) ──
let etat; let fautes; let ecritures;
function reinitialiser() {
  etat = { stores: [], profiles: [], profile_roles: [], reseller_shop_items: [], products: [], commissions: [], orders: [], suppliers: [] };
  fautes = {}; ecritures = [];
}
const db = {
  from(table) {
    let op = 'select'; let patch; const filtres = []; let un = false; let tete = false;
    const q = {
      select(_colonnes, options) { if (options && options.head) tete = true; return q; },
      eq(k, v) { filtres.push((r) => r[k] === v); return q; },
      ilike(k, v) { filtres.push((r) => String(r[k]).toLowerCase() === String(v).toLowerCase()); return q; },
      in(k, v) { filtres.push((r) => v.includes(r[k])); return q; },
      is() { return q; }, order() { return q; }, limit() { return q; }, gt() { return q; }, or() { return q; },
      insert(p) { op = 'insert'; patch = p; return q; },
      update(p) { op = 'update'; patch = p; return q; },
      upsert(p) { op = 'upsert'; patch = p; return q; },
      delete() { op = 'delete'; return q; },
      maybeSingle() { un = true; return q; },
      then(resolve, reject) {
        if (op !== 'select') ecritures.push({ table, op, patch });
        if (fautes[`${table}:${op}`]) return Promise.resolve({ data: null, count: null, error: { code: fautes[`${table}:${op}`] } }).then(resolve, reject);
        if (op === 'insert' && table === 'stores' && (etat.stores || []).some((r) => String(r.slug).toLowerCase() === String(patch.slug).toLowerCase())) {
          return Promise.resolve({ data: null, count: null, error: { code: '23505' } }).then(resolve, reject);
        }
        let lignes = (etat[table] || []).filter((r) => filtres.every((f) => f(r)));
        if (op === 'insert') {
          const ligne = { id: `cree-${ecritures.length}`, status: 'active', followers_count: 0, ...patch };
          (etat[table] ||= []).push(ligne); lignes = [ligne];
        }
        if (op === 'update') lignes.forEach((r) => Object.assign(r, patch));
        const data = tete ? null : un ? (lignes[0] ? { ...lignes[0] } : null) : lignes.map((r) => ({ ...r }));
        return Promise.resolve({ data, count: lignes.length, error: null }).then(resolve, reject);
      },
    };
    return q;
  },
  async rpc() { return { data: null, error: null }; },
};
require.cache[require.resolve('../src/lib/supabase-admin.ts')] = { exports: { getSupabaseAdmin: () => db } };

let sessionCourante = null;
require.cache[require.resolve('../src/lib/active-session.ts')] = { exports: { verifyActiveSession: async () => sessionCourante } };
const vraieSession = require('../src/lib/session.ts');
require.cache[require.resolve('../src/lib/session.ts')] = { exports: { ...vraieSession, verifySessionToken: async () => sessionCourante } };
require.cache[require.resolve('next/headers')] = {
  exports: { cookies: async () => ({ get: (nom) => (nom === vraieSession.SESSION_COOKIE_NAME ? { value: 'jeton-simule' } : undefined) }) },
};
class Introuvable extends Error {}
require.cache[require.resolve('next/navigation')] = {
  exports: { notFound: () => { throw new Introuvable('page introuvable'); }, usePathname: () => '/', useRouter: () => ({ push() {}, replace() {}, refresh() {} }) },
};
const revendeur = (uid, extra = {}) => ({ uid, phone: '+22300000000', role: 'reseller', status: 'active', roles: { reseller: 'active' }, iat: 1, exp: 9e9, ...extra });

// ── Composants simulés par des marqueurs ─────────────────────────────────────
const marqueur = (nom) => ({ __esModule: true, default: (p) => React.createElement('i', { 'data-marqueur': nom, 'data-actif': p && p.actif ? p.actif : '' }) });
for (const [fichier, nom] of [['common/Header', 'entete'], ['common/BottomNav', 'barre'], ['common/Footer', 'pied'],
  ['common/AncrageRevendeur', 'ancrage'], ['shop/ShopShareBar', 'partage'], ['common/QrCode', 'qr'], ['shop/BoutiqueProduits', 'articles']]) {
  require.cache[require.resolve(`../src/components/${fichier}.tsx`)] = { exports: marqueur(nom) };
}
require.cache[require.resolve('next/link')] = {
  exports: { __esModule: true, default: ({ href, prefetch, children, ...reste }) => React.createElement('a', { href, 'data-prefetch': String(prefetch), ...reste }, children) },
};
// Outils du propriétaire chargés par next/dynamic : le module visé est chargé tout de suite.
require.cache[require.resolve('next/dynamic')] = {
  exports: { __esModule: true, default: (charger) => {
    const chemin = String(charger).match(/require\(['"]([^'"]+)['"]\)/)[1].replace(/^@\//, `${path.join(RACINE, 'src')}/`);
    return (p) => React.createElement(require(chemin).default, p);
  } },
};
require.cache[require.resolve('../src/lib/reseau/recompenses.ts')] = { exports: { lireReglagesReseau: async () => ({}) } };
require.cache[require.resolve('../src/lib/presentation-fournisseur.ts')] = { exports: { appliquerPrioriteReseau: async (_a, v) => v } };

const { NextRequest } = require('next/server');
const requete = (url, init = {}) => new NextRequest(`http://localhost${url}`, {
  ...init, headers: { cookie: 'suguba_session=simule', 'content-type': 'application/json', ...(init.headers || {}) },
});
const corps = (methode, donnees) => ({ method: methode, body: JSON.stringify(donnees) });
const route = () => require('../src/app/api/reseller/boutique/route.ts');

function boutiqueAwa(enPlus = {}) {
  return { id: 's1', owner_type: 'reseller', owner_id: 'rev-1', slug: 'awa-traore-diallo', name: 'Awa Traoré Diallo', status: 'active', followers_count: 3,
    logo_url: 'https://ancien.example/logo.webp', cover_url: null, gallery: ['https://ancien.example/g1.webp'], categories: [], ...enPlus };
}

// ── Règles pures ────────────────────────────────────────────────────────────

test('Enseigne : un nom qui reprend celui de la personne n’en est pas une ; titre public', () => {
  const { estEnseigne, nomPublic, titreVitrine } = require('../src/lib/enseigne.ts');
  const nom = 'Awa Traoré Diallo';
  assert.equal(nomPublic(nom), 'Awa D.');
  assert.equal(require('../src/lib/shop.ts').nomPublic(nom), 'Awa D.', 'toujours exportée par lib/shop');
  for (const pas of [nom, 'awa traore diallo', 'Awa D.', 'Awa D', 'Awa Traoré', 'Traoré Awa', '  ', 'A']) {
    assert.equal(estEnseigne(pas, nom), false, `« ${pas} » n’est pas une enseigne`);
  }
  for (const oui of ['Awa Mode', 'Chez Awa', 'Électro Diarra & Fils']) assert.equal(estEnseigne(oui, nom), true, oui);
  assert.equal(estEnseigne('Revendeur Suguba', null), false);
  assert.equal(estEnseigne('Boutique Kadi', null), true);
  assert.equal(titreVitrine({ type: 'revendeur', nom: 'Awa Mode', enseigne: true }), 'Awa Mode');
  assert.equal(titreVitrine({ type: 'revendeur', nom: 'Awa D.', enseigne: false }), 'La sélection de Awa D.');
  assert.equal(titreVitrine({ type: 'revendeur', nom: 'Awa D.' }), 'La sélection de Awa D.');
  assert.equal(titreVitrine({ type: 'fournisseur', nom: 'Kadi Shop' }), 'Kadi Shop');
});

test('Ma boutique est prête à X % : une boutique neuve part à 1 étape sur 6, une boutique complète à 100 %', () => {
  const { etapesBoutique, progressionBoutique, ARTICLES_POUR_ETRE_PRETE } = require('../src/lib/reseau/etapes-boutique.ts');
  assert.equal(ARTICLES_POUR_ETRE_PRETE, 5);
  const neuve = etapesBoutique({ enseigne: false, logo: null, couverture: null, accueil: null, articles: 0 });
  assert.deepEqual(neuve.map((e) => e.cle), ['creee', 'enseigne', 'logo', 'couverture', 'accueil', 'articles']);
  assert.deepEqual(progressionBoutique(neuve), { faites: 1, total: 6, pourcentage: 17 });
  // Chaque étape mène à son outil : panneau de la vitrine par la porte, ou catalogue.
  assert.deepEqual(neuve.filter((e) => e.editer).map((e) => [e.cle, e.editer, e.href]), [
    ['enseigne', 'nom', '/reseller/ma-boutique?editer=nom'], ['logo', 'logo', '/reseller/ma-boutique?editer=logo'],
    ['couverture', 'couverture', '/reseller/ma-boutique?editer=couverture'], ['accueil', 'nom', '/reseller/ma-boutique?editer=nom'],
  ]);
  assert.equal(neuve.find((e) => e.cle === 'articles').href, '/reseller/catalog');
  const complete = etapesBoutique({ enseigne: true, logo: 'https://x/l.webp', couverture: 'https://x/c.webp', accueil: 'Bienvenue', articles: 5 });
  assert.deepEqual(progressionBoutique(complete), { faites: 6, total: 6, pourcentage: 100 });
  assert.equal(progressionBoutique(etapesBoutique({ enseigne: true, logo: 'l', couverture: 'c', accueil: 'a', articles: 4 })).pourcentage, 83);
  // Compte d'articles illisible : l'étape reste à faire, jamais cochée par défaut.
  assert.equal(etapesBoutique({ enseigne: true, logo: 'l', couverture: 'c', accueil: '  ', articles: null }).filter((e) => !e.fait).length, 2);
});

test('Images de la boutique : seulement le dossier boutiques/<uid de la session>/, ou l’image déjà enregistrée', () => {
  const { imageAutorisee, dossierImagesBoutique } = require('../src/lib/reseau/images-boutique.ts');
  assert.equal(dossierImagesBoutique('rev-1', `${BASE}/`), dossier('rev-1'));
  assert.equal(dossierImagesBoutique('rev-1', ''), null);
  assert.equal(imageAutorisee(`${dossier('rev-1')}4b97bc74-cdab-4660-9bcd-a1f1158c0000.webp`, 'rev-1', BASE), true);
  for (const refusee of [
    `${dossier('rev-2')}a.webp`, // dossier d'un autre compte
    `${dossier('rev-1')}../rev-2/a.webp`, // remontée de dossier
    `${dossier('rev-1')}sous/a.webp`, `${dossier('rev-1')}a.webp?x=1`, `${dossier('rev-1')}a.svg`,
    'https://ailleurs.example/boutiques/rev-1/a.webp', `${BASE}/storage/v1/object/public/product-images/a.webp`,
    null, 42, '',
  ]) assert.equal(imageAutorisee(refusee, 'rev-1', BASE), false, String(refusee));
  assert.equal(imageAutorisee('https://ancien.example/logo.webp', 'rev-1', BASE, ['https://ancien.example/logo.webp']), true, 'image déjà enregistrée');
  assert.equal(imageAutorisee(`${dossier('rev-1')}a.webp`, 'rev-1', undefined), false, 'sans adresse Supabase, seule l’image enregistrée passe');
});

// ── Route /api/reseller/boutique ────────────────────────────────────────────

test('PATCH : une image hors du dossier boutiques/<uid>/ est refusée sans rien écrire, sauf la valeur enregistrée', async () => {
  const { PATCH } = route();
  reinitialiser();
  etat.profiles = [{ id: 'rev-1', full_name: 'Awa Traoré Diallo', reseller_code: 'AWA1' }];
  etat.stores = [boutiqueAwa()];
  sessionCourante = revendeur('rev-1');
  for (const champs of [
    { logo: 'https://ailleurs.example/marque.webp' },
    { couverture: `${dossier('rev-2')}x.webp` },
    { logo: `${dossier('rev-1')}../rev-2/x.webp`, nom: 'Awa Mode' },
    { galerie: ['https://ancien.example/g1.webp', 'https://ailleurs.example/x.webp'] },
    { galerie: 'pas-une-liste' },
  ]) {
    const r = await PATCH(requete('/api/reseller/boutique', corps('PATCH', champs)));
    assert.equal(r.status, 400, JSON.stringify(champs));
  }
  assert.deepEqual(ecritures, [], 'aucune écriture, pas même le nom');

  // Images de son dossier, ou déjà enregistrées : acceptées. Réordonner la galerie aussi.
  const nouvelle = `${dossier('rev-1')}4b97bc74-cdab-4660-9bcd-a1f1158c0000.webp`;
  let r = await PATCH(requete('/api/reseller/boutique', corps('PATCH', { logo: 'https://ancien.example/logo.webp', couverture: nouvelle, galerie: [nouvelle, 'https://ancien.example/g1.webp'] })));
  assert.equal(r.status, 200);
  const ecrite = ecritures.find((e) => e.op === 'update').patch;
  assert.equal(ecrite.logo_url, 'https://ancien.example/logo.webp');
  assert.equal(ecrite.cover_url, nouvelle);
  assert.deepEqual(ecrite.gallery, [nouvelle, 'https://ancien.example/g1.webp']);
  // Retirer une image reste possible.
  ecritures = [];
  r = await PATCH(requete('/api/reseller/boutique', corps('PATCH', { logo: null })));
  assert.equal(r.status, 200);
  assert.equal(ecritures.find((e) => e.op === 'update').patch.logo_url, null);
});

test('PATCH : recrute et whatsapp ignorés, familles de l’annuaire seulement ; nom public renvoyé, jamais le nom complet', async () => {
  const { PATCH } = route();
  reinitialiser();
  etat.profiles = [{ id: 'rev-1', full_name: 'Awa Traoré Diallo', reseller_code: 'AWA1' }];
  etat.stores = [boutiqueAwa()];
  sessionCourante = revendeur('rev-1');
  let r = await PATCH(requete('/api/reseller/boutique', corps('PATCH', {
    accroche: 'Bienvenue', recrute: true, whatsapp: '+22370000000', owner_id: 'rev-2', followers_count: 9999, slug: 'pirate',
    categories: ['Mode & Beauté', 'Inventée', 'Mode & Beauté', 7],
  })));
  assert.equal(r.status, 200);
  const ecrite = ecritures.find((e) => e.op === 'update').patch;
  for (const interdit of ['is_recruiting', 'whatsapp', 'owner_id', 'followers_count', 'slug']) assert.equal(interdit in ecrite, false, interdit);
  assert.deepEqual(ecrite.categories, ['Mode & Beauté']);
  assert.equal(ecrite.tagline, 'Bienvenue');
  let json = await r.json();
  assert.deepEqual(json.vitrine, { nom: 'Awa D.', enseigne: false }, 'boutique au nom du compte : « Awa D. »');
  assert.doesNotMatch(JSON.stringify(json.vitrine), /Traoré|Diallo/);
  // Une vraie enseigne devient le nom public.
  r = await PATCH(requete('/api/reseller/boutique', corps('PATCH', { nom: 'Awa Mode' })));
  json = await r.json();
  assert.deepEqual(json.vitrine, { nom: 'Awa Mode', enseigne: true });
  assert.equal(json.boutique.slug, 'awa-traore-diallo', 'l’adresse ne change pas en renommant');
  // Limites des écrans : nom 60, mot d'accueil 90.
  assert.equal((await PATCH(requete('/api/reseller/boutique', corps('PATCH', { nom: 'x'.repeat(61) })))).status, 400);
  assert.equal((await PATCH(requete('/api/reseller/boutique', corps('PATCH', { accroche: 'x'.repeat(91) })))).status, 400);
  // Session revendeur exigée.
  sessionCourante = revendeur('rev-1', { role: 'customer', roles: { customer: 'active', reseller: 'active' } });
  assert.equal((await PATCH(requete('/api/reseller/boutique', corps('PATCH', { nom: 'X Y' })))).status, 401);
});

test('POST {nom} : crée la boutique avec ce nom et l’adresse qui en est tirée ; 409 si elle existe', async () => {
  const { POST } = route();
  reinitialiser();
  etat.profiles = [{ id: 'rev-1', full_name: 'Awa Traoré Diallo', reseller_code: 'AWA1' }];
  sessionCourante = revendeur('rev-1');
  let r = await POST(requete('/api/reseller/boutique', corps('POST', { nom: '  Awa   Mode ' })));
  assert.equal(r.status, 201);
  const insertion = ecritures.find((e) => e.table === 'stores' && e.op === 'insert');
  assert.equal(insertion.patch.slug, 'awa-mode');
  assert.equal(insertion.patch.name, 'Awa Mode');
  assert.equal(insertion.patch.owner_id, 'rev-1');
  assert.deepEqual((await r.json()).vitrine, { nom: 'Awa Mode', enseigne: true });
  // Elle existe : 409, rien de plus n'est inséré (le démarrage fait alors un PATCH).
  ecritures = [];
  r = await POST(requete('/api/reseller/boutique', corps('POST', { nom: 'Autre nom' })));
  assert.equal(r.status, 409);
  assert.deepEqual(ecritures, []);

  // Son propre nom tapé comme nom de boutique : l'adresse vient de « Awa D. ».
  reinitialiser();
  etat.profiles = [{ id: 'rev-1', full_name: 'Awa Traoré Diallo' }];
  r = await POST(requete('/api/reseller/boutique', corps('POST', { nom: 'Awa Traoré Diallo' })));
  assert.equal(r.status, 201);
  assert.equal(ecritures.find((e) => e.op === 'insert').patch.slug, 'awa-d');
  assert.deepEqual((await r.json()).vitrine, { nom: 'Awa D.', enseigne: false });

  // Nom trop court ou trop long, profil illisible, aperçu admin : rien n'est créé.
  reinitialiser();
  etat.profiles = [{ id: 'rev-1', full_name: 'Awa Traoré Diallo' }];
  for (const nom of ['A', 'x'.repeat(61), 12]) assert.equal((await POST(requete('/api/reseller/boutique', corps('POST', { nom })))).status, 400);
  fautes['profiles:select'] = 'TEST';
  assert.equal((await POST(requete('/api/reseller/boutique', corps('POST', { nom: 'Awa Mode' })))).status, 503);
  fautes = {};
  sessionCourante = revendeur('apercu-reseller', { apercu: { depuis: { uid: 'admin-1', phone: '+22300000001' } } });
  assert.equal((await POST(requete('/api/reseller/boutique', corps('POST', { nom: 'Awa Mode' })))).status, 403);
  assert.deepEqual(ecritures, []);
});

test('GET ?creer=non lit sans jamais créer ; GET sans paramètre crée en « Prénom I. »', async () => {
  const { GET } = route();
  reinitialiser();
  etat.profiles = [{ id: 'rev-1', full_name: 'Awa Traoré Diallo', reseller_code: 'AWA1' }];
  sessionCourante = revendeur('rev-1');
  let json = await (await GET(requete('/api/reseller/boutique?creer=non'))).json();
  assert.equal(json.boutique, null);
  assert.equal(json.vitrine, null);
  assert.deepEqual(ecritures, [], 'aucune insertion');
  etat.stores = [boutiqueAwa({ name: 'Awa Mode', slug: 'awa-mode' })];
  json = await (await GET(requete('/api/reseller/boutique?creer=non'))).json();
  assert.equal(json.boutique.slug, 'awa-mode');
  assert.deepEqual(json.vitrine, { nom: 'Awa Mode', enseigne: true });
  assert.equal(json.maxGalerie, 10);
  assert.deepEqual(ecritures, []);
  etat.stores = [];
  json = await (await GET(requete('/api/reseller/boutique'))).json();
  assert.equal(json.boutique.slug, 'awa-d');
  assert.equal(ecritures.filter((e) => e.op === 'insert').length, 1);
});

// ── Titre public : enseigne seule, ou « La sélection de Awa D. » ─────────────

const ShopView = () => require('../src/components/shop/ShopView.tsx').default;

test('chargerBoutiqueRevendeur : boutique au nom complet → « Awa D. », enseigne faux ; le nom complet n’apparaît jamais dans la vitrine', async () => {
  const { chargerBoutiqueRevendeur } = require('../src/lib/shop.ts');
  reinitialiser();
  etat.profiles = [{ id: 'rev-1', full_name: 'Awa Traoré Diallo', reseller_code: 'AWA1' }];
  etat.profile_roles = [{ profile_id: 'rev-1', role: 'reseller', status: 'active' }];
  etat.stores = [boutiqueAwa()];
  let vitrine = await chargerBoutiqueRevendeur('awa1');
  assert.equal(vitrine.nom, 'Awa D.');
  assert.equal(vitrine.enseigne, false);
  const html = renderToStaticMarkup(React.createElement(ShopView(), { boutique: vitrine, urlPartage: 'https://app.sugubaml.com/r/AWA1', refCode: 'AWA1' }));
  assert.match(html, /<h1[^>]*>La sélection de Awa D\.<\/h1>/);
  assert.doesNotMatch(html, /Traoré|Diallo/);

  etat.stores[0].name = 'Awa Mode';
  vitrine = await chargerBoutiqueRevendeur('AWA1');
  assert.equal(vitrine.nom, 'Awa Mode');
  assert.equal(vitrine.enseigne, true);
  const avecEnseigne = renderToStaticMarkup(React.createElement(ShopView(), { boutique: vitrine, urlPartage: 'u', refCode: 'AWA1' }));
  assert.match(avecEnseigne, /<h1[^>]*>Awa Mode<\/h1>/, 'l’enseigne seule');
  assert.doesNotMatch(avecEnseigne, /La sélection de/);
  // Boutique masquée : jamais son nom ni son enseigne sur /r/ (règle du lot 1 conservée).
  etat.stores[0].status = 'hidden';
  vitrine = await chargerBoutiqueRevendeur('AWA1');
  assert.deepEqual([vitrine.nom, vitrine.enseigne], ['Awa D.', false]);
});

test('/boutique/<adresse> : titre et métadonnées sans nom complet ; ?editer= seulement pour le propriétaire qui gère', async () => {
  const page = require('../src/app/boutique/[slug]/page.tsx');
  const ouvrir = (slug, recherche = {}) => page.default({ params: Promise.resolve({ slug }), searchParams: Promise.resolve(recherche) });
  reinitialiser();
  etat.profiles = [{ id: 'rev-1', full_name: 'Awa Traoré Diallo', reseller_code: 'AWA1' }];
  etat.profile_roles = [{ profile_id: 'rev-1', role: 'reseller', status: 'active' }];
  etat.stores = [boutiqueAwa()];
  sessionCourante = null;
  let el = await ouvrir('awa-traore-diallo', { editer: 'logo' });
  assert.equal(el.props.boutique.nom, 'Awa D.');
  assert.equal(el.props.boutique.enseigne, false);
  assert.equal(el.props.editer, null, 'un visiteur n’ouvre aucun panneau');
  const meta = await page.generateMetadata({ params: Promise.resolve({ slug: 'awa-traore-diallo' }) });
  assert.equal(meta.title, 'La sélection de Awa D. — Suguba');
  assert.doesNotMatch(JSON.stringify(meta), /Traoré|Diallo/);

  sessionCourante = revendeur('rev-1');
  el = await ouvrir('awa-traore-diallo', { editer: 'logo' });
  assert.equal(el.props.editer, 'logo');
  for (const editer of ['x', ['logo'], undefined]) assert.equal((await ouvrir('awa-traore-diallo', { editer })).props.editer, null, String(editer));
  sessionCourante = revendeur('rev-1', { role: 'customer', roles: { customer: 'active', reseller: 'active' } });
  assert.equal((await ouvrir('awa-traore-diallo', { editer: 'nom' })).props.editer, null, 'profil client : bandeau « Gérer », pas de panneau');

  etat.stores[0].name = 'Awa Mode';
  sessionCourante = null;
  el = await ouvrir('awa-traore-diallo');
  assert.deepEqual([el.props.boutique.nom, el.props.boutique.enseigne], ['Awa Mode', true]);
  assert.equal((await page.generateMetadata({ params: Promise.resolve({ slug: 'awa-traore-diallo' }) })).title, 'Awa Mode — Suguba');
  assert.deepEqual(ecritures, [], 'afficher une vitrine n’écrit rien');
});

test('/api/reseller/me?avec=boutique : nom public et étapes de « prête à X % »', async () => {
  const { GET } = require('../src/app/api/reseller/me/route.ts');
  const { progressionBoutique } = require('../src/lib/reseau/etapes-boutique.ts');
  reinitialiser();
  etat.profiles = [{ id: 'rev-1', reseller_code: 'AWA1', full_name: 'Awa Traoré Diallo', metadata: {} }];
  etat.stores = [boutiqueAwa({ logo_url: 'https://x/logo.webp', tagline: 'Bienvenue' })];
  sessionCourante = revendeur('rev-1');
  const json = await (await GET(requete('/api/reseller/me?avec=boutique'))).json();
  assert.equal(json.boutique.nom, 'Awa D.');
  assert.doesNotMatch(JSON.stringify(json.boutique), /Traoré|Diallo/);
  const fait = Object.fromEntries(json.boutique.etapes.map((e) => [e.cle, e.fait]));
  assert.deepEqual(fait, { creee: true, enseigne: false, logo: true, couverture: false, accueil: true, articles: false });
  assert.equal(progressionBoutique(json.boutique.etapes).pourcentage, 50);
  assert.ok(ecritures.every((e) => e.table !== 'stores'), 'lecture seule');
});

// ── Bandeau et mode propriétaire ────────────────────────────────────────────

const identite = (enPlus = {}) => ({ nom: 'Awa Mode', enseigne: true, accroche: null, logo: null, couverture: null, ...enPlus });

test('BandeauProprietaire : Partager, Personnaliser, Articles, Outils et « Voir comme un client » ; ni gain ni commission', () => {
  const Bandeau = require('../src/components/shop/proprietaire/BandeauProprietaire.tsx').default;
  const html = renderToStaticMarkup(React.createElement(Bandeau, { identite: identite(), statut: 'active', urlPartage: 'https://app.sugubaml.com/boutique/awa-mode' }));
  assert.match(html, /aria-label="Partager ma boutique sur WhatsApp"[^>]*>[\s\S]*?Partager<\/a>/);
  assert.match(html, /href="https:\/\/api\.whatsapp\.com\/send\?text=[^"]*Awa%20Mode[^"]*app\.sugubaml\.com%2Fboutique%2Fawa-mode"/);
  assert.match(html, /<a href="\/reseller\/boutique"[^>]*>[\s\S]*?Personnaliser<\/span>/);
  assert.match(html, /<a href="\/reseller\/catalog"[^>]*>[\s\S]*?Articles<\/span>/);
  assert.match(html, /<a href="\/reseller\/outils"[^>]*>[\s\S]*?Outils<\/span>/, '« Tous mes outils » reste accessible');
  assert.match(html, /<button type="button"[^>]*>[\s\S]*?Voir comme un client<\/button>/);
  assert.match(html, /En ligne/);
  assert.doesNotMatch(html, /commission|gagnez|Gains?\b|gain|prix de gros|À la une/i);
  assert.equal((html.match(/group-data-\[vue=client\]:hidden/g) || []).length, 2, 'barre et outils masqués en vue client');
  // Boutique masquée : pas de partage vers une page introuvable.
  const masquee = renderToStaticMarkup(React.createElement(Bandeau, { identite: identite(), statut: 'hidden', urlPartage: 'u' }));
  assert.match(masquee, /Masquée par Suguba/);
  assert.doesNotMatch(masquee, /Partager/);
});

const vitrine = (enPlus = {}) => ({
  type: 'revendeur', nom: 'Awa D.', enseigne: false, categorie: null, logo: null, couverture: null, description: null,
  produits: [{ id: 'p1', nom: 'Robe', prix: 15000, image: null }], livraisons: 0, selectionVide: false, code: 'AWA1', ...enPlus,
});
const rendre = (props) => renderToStaticMarkup(React.createElement(ShopView(), {
  boutique: vitrine(), urlPartage: 'https://app.sugubaml.com/boutique/awa-d', refCode: 'AWA1',
  suivre: React.createElement('b', { 'data-marqueur': 'suivre' }), ...props,
}));

test('Vitrine du propriétaire en gestion : outils, 3 crayons, « prête à X % » ; tous masqués en vue client', () => {
  const html = rendre({ lienModifier: '/reseller/boutique', proprietaire: { statut: 'active', abonnes: 2, gestion: true } });
  assert.match(html, /<div data-vue="gestion" class="group space-y-6">/);
  for (const libelle of ['Changer la photo de couverture', 'Changer le logo', 'Modifier le nom et le mot d’accueil']) {
    assert.match(html, new RegExp(`<button type="button" aria-label="${libelle}" class="group-data-\\[vue=client\\]:hidden w-10 h-10`), libelle);
  }
  assert.match(html, /<section aria-labelledby="boutique-prete-titre" class="[^"]*group-data-\[vue=client\]:hidden">[\s\S]*?Ma boutique est prête à <span[^>]*>17 %<\/span>/);
  assert.match(html, /<h1[^>]*>La sélection de Awa D\.<\/h1>/);
  assert.match(html, /Vue client ·[\s\S]*?Revenir/);
  assert.doesNotMatch(html, /Modifier la boutique/);
  assert.doesNotMatch(html, /href="\/reseller\/boutique" class="absolute/, 'le crayon remplace « Personnaliser » sur la couverture');
  assert.doesNotMatch(html, /data-marqueur="ancrage"/);
  assert.doesNotMatch(html, /À la une/);
  // Boutique complète : la carte disparaît.
  const complete = rendre({
    boutique: vitrine({ nom: 'Awa Mode', enseigne: true, logo: 'https://x/l.webp', couverture: 'https://x/c.webp', produits: Array.from({ length: 5 }, (_, i) => ({ id: `p${i}` })) }),
    accroche: 'Bienvenue', proprietaire: { statut: 'active', abonnes: 2, gestion: true },
  });
  assert.doesNotMatch(complete, /Ma boutique est prête à/);
  assert.match(complete, /<h1[^>]*>Awa Mode<\/h1>/);
});

test('Visiteur, /r/ et propriétaire sous un autre profil : aucun outil de gestion dans la page', () => {
  for (const props of [{}, { proprietaire: { statut: 'active', abonnes: 1, gestion: false }, lienModifier: '/reseller/boutique' }]) {
    const html = rendre(props);
    for (const outil of [/data-vue=/, /Voir comme un client/, /Changer le logo/, /Ma boutique est prête/, /Vue client/, /group-data-\[vue=client\]/, /inert=""/]) {
      assert.doesNotMatch(html, outil, `${outil} (${JSON.stringify(props)})`);
    }
  }
});

// ── Lecture du source ───────────────────────────────────────────────────────

test('Source : vue client sans requête, sessionStorage protégé, outils chargés à la demande, LogoUploader suit sa valeur', () => {
  const mode = lire('src/components/shop/proprietaire/ModeProprietaire.tsx');
  assert.match(mode, /data-vue=\{vue\}/);
  assert.match(mode, /group-data-\[vue=client\]:inline-flex/);
  assert.match(mode, /try \{\s*if \(window\.sessionStorage\.getItem\(CLE_VUE\)/);
  assert.match(mode, /try \{\s*window\.sessionStorage\.setItem\(CLE_VUE, nouvelle\)/);
  assert.doesNotMatch(sansCommentaires(mode), /fetch\(|router\.refresh|location\.reload/, 'basculer de vue n’envoie aucune requête');
  for (const f of ['src/components/shop/proprietaire/BandeauProprietaire.tsx', 'src/components/shop/proprietaire/EnteteEditable.tsx', 'src/components/shop/ShopView.tsx']) {
    assert.match(lire(f), /group-data-\[vue=client\]:hidden/, f);
  }
  const vue = lire('src/components/shop/ShopView.tsx');
  for (const outil of ['ModeProprietaire', 'BandeauProprietaire', 'EnteteEditable']) {
    assert.match(vue, new RegExp(`const ${outil} = dynamic\\(\\(\\) => import\\('@/components/shop/proprietaire/${outil}'\\)\\);`), outil);
  }
  assert.match(vue, /<div inert className="hidden group-data-\[vue=client\]:block">/);
  const entete = sansCommentaires(lire('src/components/shop/proprietaire/EnteteEditable.tsx'));
  assert.doesNotMatch(entete, /router\.refresh/);
  assert.match(lire('src/components/shop/proprietaire/PanneauImage.tsx'), /method: 'PATCH'[\s\S]*?JSON\.stringify\(\{ \[sujet\]: url \}\)/);
  const logo = lire('src/components/common/LogoUploader.tsx');
  assert.match(logo, /useEffect\(\(\) => \{\s*if \(!envoiEnCours\) setApercu\(value\);[\s\S]*?\}, \[value\]\);/);
  assert.match(logo, /forme\?: 'rond' \| 'carre'/);
  assert.match(logo, /accept="image\/\*"/);
  assert.match(lire('src/components/reseau/CouvertureEditeur.tsx'), /accept="image\/\*"/);
  for (const f of ['src/components/shop/proprietaire/BandeauProprietaire.tsx', 'src/components/shop/proprietaire/EnteteEditable.tsx',
    'src/components/shop/proprietaire/PanneauImage.tsx', 'src/components/shop/proprietaire/PanneauNomAccueil.tsx', 'src/components/shop/EnteteBoutique.tsx']) {
    assert.doesNotMatch(lire(f), /À la une/, f);
  }
});

test('Source : démarrage sans création à l’ouverture, créateur vers le panneau du logo, Personnaliser complétée', () => {
  const demarrer = sansCommentaires(lire('src/app/reseller/demarrer/page.tsx'));
  assert.match(demarrer, /fetch\('\/api\/reseller\/boutique\?creer=non'\)/);
  assert.doesNotMatch(demarrer, /fetch\('\/api\/reseller\/boutique'\)\.then/, 'plus de GET qui crée la boutique à l’ouverture');
  assert.match(demarrer, /envoyer\(boutiqueExiste \? 'PATCH' : 'POST'\)/);
  assert.match(demarrer, /if \(r\.status === 409\) r = await envoyer\('PATCH'\);/);
  const createur = lire('src/app/reseller/createur/page.tsx');
  assert.match(createur, /const EDITER_LOGO = `\$\{PORTE_MA_BOUTIQUE\}\?editer=logo`;/);
  assert.equal((createur.match(/prefetch=\{false\}/g) || []).length, 2, 'la porte n’est jamais préchargée');
  assert.doesNotMatch(sansCommentaires(createur), /href="\/reseller\/boutique"/);
  const reglages = sansCommentaires(lire('src/app/reseller/boutique/page.tsx'));
  assert.match(reglages, /<GalerieEditeur images=\{boutique\.galerie \|\| \[\]\}/);
  assert.match(reglages, /enregistrerImage\(\{ galerie: nouvelles \}/);
  assert.match(reglages, /enregistrerImage\(\{ logo: url \}/);
  assert.match(reglages, /enregistrerImage\(\{ couverture: url \}/);
  assert.match(reglages, /Ce que je vends/);
  assert.match(reglages, /FAMILLES_CATEGORIES\.map/);
  assert.match(reglages, /<BarreEnregistrement/);
  assert.doesNotMatch(reglages, /Enregistrer ma boutique/, 'plus de bouton en bas de page');
  // ListeEtapes : extraite de l'accueil, partagée avec la vitrine.
  const accueil = lire('src/app/reseller/page.tsx');
  assert.match(accueil, /<ListeEtapes id="demarrage-titre" titre="Vers votre première vente" etapes=\{etapes\} \/>/);
  assert.match(accueil, /Ma boutique est prête à/);
  assert.match(accueil, /prete && prete\.pourcentage < 100 &&/);
});
