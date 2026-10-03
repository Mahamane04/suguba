// TEST-BOUTIQUE-LOT3-001..019 (chantier boutique du revendeur, 2026-10-03, lot 3
// « Mes articles : ranger, coups de cœur, gain visible ») : convention des coups de
// cœur (position négative), rangement par UPDATE seulement, route privée des articles,
// vitrine qui aide à acheter (recherche sans accents, épuisés en fin de rayon,
// « Nouveau », Coups de cœur en tête), alerte du propriétaire, Mes prix filtrés,
// « Message » des affiches sans remise inventée.
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
function fichiers(dossier) {
  return fs.readdirSync(path.join(RACINE, dossier)).flatMap((nom) => {
    const relatif = path.join(dossier, nom);
    return fs.statSync(path.join(RACINE, relatif)).isDirectory() ? fichiers(relatif) : /\.tsx?$/.test(nom) ? [relatif] : [];
  });
}

// ── Base simulée : chaque opération est enregistrée avec ses filtres ─────────
let etat; let fautes; let operations;
function reinitialiser() {
  etat = { stores: [], profiles: [], profile_roles: [], reseller_shop_items: [], products: [], reseller_prices: [], commissions: [], orders: [] };
  fautes = {}; operations = [];
}
const db = {
  from(table) {
    let op = 'select'; let patch; const filtres = []; const egalites = {}; let un = false; let tete = false;
    const q = {
      select(_colonnes, options) { if (options && options.head) tete = true; return q; },
      eq(k, v) { egalites[k] = v; filtres.push((r) => r[k] === v); return q; },
      ilike(k, v) { filtres.push((r) => String(r[k]).toLowerCase() === String(v).toLowerCase()); return q; },
      in(k, v) { filtres.push((r) => v.includes(r[k])); return q; },
      is() { return q; }, order() { return q; }, limit() { return q; }, gt() { return q; }, or() { return q; },
      insert(p) { op = 'insert'; patch = p; return q; },
      update(p) { op = 'update'; patch = p; return q; },
      upsert(p) { op = 'upsert'; patch = p; return q; },
      delete() { op = 'delete'; return q; },
      maybeSingle() { un = true; return q; },
      then(resolve, reject) {
        operations.push({ table, op, patch, egalites });
        if (fautes[`${table}:${op}`]) return Promise.resolve({ data: null, count: null, error: { code: fautes[`${table}:${op}`] } }).then(resolve, reject);
        let lignes = (etat[table] || []).filter((r) => filtres.every((f) => f(r)));
        if (op === 'insert') { const ligne = { ...patch }; (etat[table] ||= []).push(ligne); lignes = [ligne]; }
        if (op === 'update') lignes.forEach((r) => Object.assign(r, patch));
        if (op === 'delete') etat[table] = (etat[table] || []).filter((r) => !lignes.includes(r));
        const data = tete ? null : un ? (lignes[0] ? { ...lignes[0] } : null) : lignes.map((r) => ({ ...r }));
        return Promise.resolve({ data, count: lignes.length, error: null }).then(resolve, reject);
      },
    };
    return q;
  },
  async rpc() { return { data: null, error: null }; },
};
const ecritures = () => operations.filter((o) => o.op !== 'select');
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

// ── Composants simulés ──────────────────────────────────────────────────────
const marqueur = (nom) => ({ __esModule: true, default: (p) => React.createElement('i', { 'data-marqueur': nom, 'data-actif': p && p.actif ? p.actif : '' }) });
for (const [fichier, nom] of [['common/Header', 'entete'], ['common/BottomNav', 'barre'], ['common/Footer', 'pied'],
  ['common/AncrageRevendeur', 'ancrage'], ['shop/ShopShareBar', 'partage'], ['common/QrCode', 'qr']]) {
  require.cache[require.resolve(`../src/components/${fichier}.tsx`)] = { exports: marqueur(nom) };
}
// Carte produit : un marqueur qui garde le nom, l'étiquette et la priorité de l'image.
require.cache[require.resolve('../src/components/product/ProductCard.tsx')] = {
  exports: { __esModule: true, default: ({ produit, priority }) => React.createElement('i', {
    'data-carte': produit.nom, 'data-etiquette': String(produit.etiquetteOffre ?? ''), 'data-priorite': String(Boolean(priority)),
  }) },
};
require.cache[require.resolve('next/link')] = {
  exports: { __esModule: true, default: ({ href, prefetch, children, ...reste }) => React.createElement('a', { href, 'data-prefetch': String(prefetch), ...reste }, children) },
};
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
const poster = (donnees) => requete('/api/reseller/shop', { method: 'POST', body: JSON.stringify(donnees) });
const routeShop = () => require('../src/app/api/reseller/shop/route.ts');

const HIER = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
const IL_Y_A_UN_MOIS = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
const produit = (id, enPlus = {}) => ({
  id, slug: `slug-${id}`, name: `Article ${id}`, category: 'Mode', images: [`https://x/${id}.webp`], public_price: 10000, stock: 5,
  reseller_commission: 1000, pricing_status: 'ok', status: 'approved', ...enPlus,
});
const selection = (uid, liste) => liste.map(([id, position, added_at = IL_Y_A_UN_MOIS]) => ({ reseller_id: uid, product_id: id, position, added_at }));

// ── Règles pures : src/lib/boutique-ordre.ts ────────────────────────────────

test('Coups de cœur : 2 coups de cœur et 3 autres → positions -2, -1, 0, 1, 2 ; position négative = coup de cœur', () => {
  const O = require('../src/lib/boutique-ordre.ts');
  assert.equal(O.COUPS_DE_COEUR_MAX, 6);
  assert.equal(O.ARTICLES_MAX, 60);
  const r = O.positionsPourOrdre(['a', 'b', 'c', 'd', 'e'], ['b', 'd']);
  assert.equal(r.erreur, undefined);
  // Les coups de cœur passent devant, dans leur ordre d'apparition ; les autres suivent.
  assert.deepEqual(r.positions, [{ id: 'b', position: -2 }, { id: 'd', position: -1 }, { id: 'a', position: 0 }, { id: 'c', position: 1 }, { id: 'e', position: 2 }]);
  assert.deepEqual(O.positionsPourOrdre(['a', 'b', 'c', 'd', 'e'], ['a', 'b']).positions.map((p) => p.position), [-2, -1, 0, 1, 2]);
  assert.equal(O.estCoupDeCoeur(-1), true);
  for (const non of [0, 3, null, undefined, Number.NaN]) assert.equal(O.estCoupDeCoeur(non), false, String(non));
});

test('Coups de cœur : un 7e est refusé ; doublon, coup de cœur hors de l’ordre ou plus de 60 articles aussi', () => {
  const O = require('../src/lib/boutique-ordre.ts');
  const ids = Array.from({ length: 8 }, (_, i) => `p${i}`);
  assert.match(O.positionsPourOrdre(ids, ids.slice(0, 7)).erreur, /6 coups de cœur au plus/);
  assert.equal(O.positionsPourOrdre(ids, ids.slice(0, 6)).erreur, undefined);
  assert.ok(O.positionsPourOrdre(['a', 'a'], []).erreur);
  assert.ok(O.positionsPourOrdre(['a', 'b'], ['z']).erreur);
  assert.ok(O.positionsPourOrdre(Array.from({ length: 61 }, (_, i) => `q${i}`), []).erreur);
  assert.ok(O.positionsPourOrdre('a,b', []).erreur);
  // Rangement à l'écran : le 7e cœur ne passe pas.
  const plein = { coups: ids.slice(0, 6), autres: ids.slice(6) };
  assert.equal(O.basculerCoupDeCoeur(plein, 'p6'), null);
  assert.deepEqual(O.basculerCoupDeCoeur(plein, 'p2'), { coups: ['p0', 'p1', 'p3', 'p4', 'p5'], autres: ['p2', 'p6', 'p7'] });
});

test('Ajout : après un retrait puis un ajout, les positions restent uniques (plus de « count »)', () => {
  const O = require('../src/lib/boutique-ordre.ts');
  let positions = [-1, 0, 1, 2];
  positions = positions.filter((p) => p !== 1); // retrait
  positions.push(O.positionAjout(positions)); // ajout
  assert.deepEqual(positions, [-1, 0, 2, 3]);
  assert.equal(new Set(positions).size, positions.length);
  assert.equal(O.positionAjout([]), 0);
  assert.equal(O.positionAjout([-3, -2, -1]), 0, 'un ajout n’est jamais un coup de cœur');
  assert.equal(O.positionAjout([null, undefined, 4]), 5);
});

test('Ensemble, tri, « Nouveau », rangement à l’écran et carte du créateur', () => {
  const O = require('../src/lib/boutique-ordre.ts');
  assert.equal(O.controlerEnsemble(['a', 'b', 'c'], ['c', 'a', 'b']), true);
  assert.equal(O.controlerEnsemble(['a', 'b', 'c'], ['a', 'b']), false, 'incomplet');
  assert.equal(O.controlerEnsemble(['a', 'b', 'c'], ['a', 'b', 'x']), false, 'identifiant étranger');
  assert.equal(O.controlerEnsemble(['a', 'b'], ['a', 'a']), false, 'doublon');
  assert.deepEqual(O.trierSelection([
    { product_id: 'c', position: 0, added_at: '2026-09-02' }, { product_id: 'a', position: -1 }, { product_id: 'b', position: 0, added_at: '2026-09-01' },
  ]).map((l) => l.product_id), ['a', 'b', 'c'], 'positions en double : date d’ajout');
  assert.equal(O.NOUVEAU_JOURS, 14);
  assert.equal(O.estNouveau(HIER), true);
  assert.equal(O.estNouveau(IL_Y_A_UN_MOIS), false);
  assert.equal(O.estNouveau(new Date(Date.now() - 15 * 24 * 3600 * 1000).toISOString()), false);
  for (const illisible of [null, undefined, '', 'pas une date']) assert.equal(O.estNouveau(illisible), false);
  const r = { coups: ['a'], autres: ['b', 'c', 'd'] };
  assert.deepEqual(O.monterArticle(r, 'c'), { coups: ['a'], autres: ['c', 'b', 'd'] });
  assert.deepEqual(O.monterArticle(r, 'b'), r, 'déjà en tête de son bloc');
  assert.deepEqual(O.mettreEnPremier(r, 'd'), { coups: ['a'], autres: ['d', 'b', 'c'] });
  assert.deepEqual(O.basculerCoupDeCoeur(r, 'c'), { coups: ['a', 'c'], autres: ['b', 'd'] });
  assert.deepEqual(O.basculerCoupDeCoeur(r, 'a'), { coups: [], autres: ['a', 'b', 'c', 'd'] });
  assert.deepEqual(O.sansArticle(r, 'a'), { coups: [], autres: ['b', 'c', 'd'] });
  assert.deepEqual(O.ordreDe(r), ['a', 'b', 'c', 'd']);
  assert.equal(O.memeRangement(r, { coups: ['a'], autres: ['b', 'c', 'd'] }), true);
  assert.equal(O.memeRangement(r, O.monterArticle(r, 'c')), false);
  // Carte « Ma boutique » du créateur : coups de cœur d'abord, prix de la vitrine, articles affichés seulement.
  const a = (nom, enPlus) => ({ nom, image: null, prixVitrine: 5000, coupDeCoeur: false, etat: 'affiche', ...enPlus });
  assert.deepEqual(O.selectionPourCarte([
    a('Un'), a('Épuisé', { etat: 'epuise', coupDeCoeur: true }), a('Deux', { prixVitrine: 7500 }), a('Cœur', { coupDeCoeur: true }), a('Trois'), a('Retiré', { etat: 'retire' }),
  ]), [{ nom: 'Cœur', prix: 5000, image: null }, { nom: 'Un', prix: 5000, image: null }, { nom: 'Deux', prix: 7500, image: null }]);
});

// ── Route POST /api/reseller/shop ───────────────────────────────────────────

test('Route « ordonner » : un ensemble incomplet ou un identifiant étranger donne 409, sans rien écrire', async () => {
  const { POST } = routeShop();
  reinitialiser();
  etat.reseller_shop_items = selection('rev-1', [['a', 0], ['b', 1], ['c', 2]]).concat(selection('rev-2', [['x', 0]]));
  sessionCourante = revendeur('rev-1');
  for (const ordre of [['a', 'b'], ['a', 'b', 'x'], ['a', 'b', 'c', 'x']]) {
    const r = await POST(poster({ action: 'ordonner', ordre, coupsDeCoeur: [] }));
    assert.equal(r.status, 409, JSON.stringify(ordre));
    assert.equal((await r.json()).error, 'Votre boutique a changé, rechargez.');
  }
  // Plus de 6 coups de cœur, ou un coup de cœur hors de l'ordre : 400.
  assert.equal((await POST(poster({ action: 'ordonner', ordre: ['a', 'b', 'c'], coupsDeCoeur: ['z'] }))).status, 400);
  assert.equal((await POST(poster({ action: 'ordonner', ordre: 'a,b,c', coupsDeCoeur: [] }))).status, 400);
  assert.deepEqual(ecritures(), [], 'rien n’est écrit');
  sessionCourante = null;
  assert.equal((await POST(poster({ action: 'ordonner', ordre: ['a', 'b', 'c'], coupsDeCoeur: [] }))).status, 401);
  sessionCourante = revendeur('rev-1', { role: 'customer', roles: { customer: 'active', reseller: 'active' } });
  assert.equal((await POST(poster({ action: 'ordonner', ordre: ['a', 'b', 'c'], coupsDeCoeur: [] }))).status, 401);
});

test('Route « ordonner » : seulement des UPDATE de position, sur la sélection de la SESSION (uid du corps ignoré)', async () => {
  const { POST } = routeShop();
  reinitialiser();
  etat.reseller_shop_items = selection('rev-1', [['a', 0], ['b', 1], ['c', 2], ['d', 3], ['e', 4]]).concat(selection('rev-2', [['a', 0], ['b', 1]]));
  sessionCourante = revendeur('rev-1');
  const r = await POST(poster({ action: 'ordonner', ordre: ['c', 'a', 'b', 'd', 'e'], coupsDeCoeur: ['c', 'e'], uid: 'rev-2', reseller_id: 'rev-2' }));
  assert.equal(r.status, 200);
  const ecrites = ecritures();
  assert.ok(ecrites.length > 0);
  assert.ok(ecrites.every((o) => o.op === 'update' && o.table === 'reseller_shop_items'), 'ni delete, ni insert, ni upsert');
  assert.ok(ecrites.every((o) => Object.keys(o.patch).join() === 'position'), 'seule la position change');
  assert.ok(operations.filter((o) => o.table === 'reseller_shop_items').every((o) => o.egalites.reseller_id === 'rev-1'), 'identité de la session');
  const positions = Object.fromEntries(etat.reseller_shop_items.filter((l) => l.reseller_id === 'rev-1').map((l) => [l.product_id, l.position]));
  assert.deepEqual(positions, { c: -2, e: -1, a: 0, b: 1, d: 2 });
  assert.deepEqual(etat.reseller_shop_items.filter((l) => l.reseller_id === 'rev-2').map((l) => l.position), [0, 1], 'l’autre boutique est intacte');
  // Rejouer le même ordre n'écrit rien : seules les places qui changent sont écrites.
  operations = [];
  assert.equal((await POST(poster({ action: 'ordonner', ordre: ['c', 'e', 'a', 'b', 'd'], coupsDeCoeur: ['c', 'e'] }))).status, 200);
  assert.deepEqual(ecritures(), []);
});

test('Route « ajouter » : rien n’est écrit pour un article déjà présent ; sinon la position suit la dernière', async () => {
  const { POST } = routeShop();
  reinitialiser();
  etat.products = [produit('a'), produit('b'), produit('n')];
  etat.reseller_shop_items = selection('rev-1', [['a', -1], ['b', 2]]);
  sessionCourante = revendeur('rev-1');
  let r = await POST(poster({ productId: 'a', action: 'ajouter' }));
  assert.equal(r.status, 200);
  assert.deepEqual(ecritures(), [], 'déjà là : ni upsert qui remettrait sa position à zéro, ni insert');
  assert.equal(etat.reseller_shop_items.find((l) => l.product_id === 'a').position, -1, 'le coup de cœur est gardé');
  r = await POST(poster({ productId: 'n', action: 'ajouter', reseller_id: 'rev-2' }));
  assert.equal(r.status, 200);
  const insertion = ecritures();
  assert.equal(insertion.length, 1);
  assert.equal(insertion[0].op, 'insert');
  assert.deepEqual(insertion[0].patch, { reseller_id: 'rev-1', product_id: 'n', position: 3 });
  // Boutique pleine : 409.
  reinitialiser();
  etat.products = [produit('n')];
  etat.reseller_shop_items = selection('rev-1', Array.from({ length: 60 }, (_, i) => [`p${i}`, i]));
  assert.equal((await POST(poster({ productId: 'n', action: 'ajouter' }))).status, 409);
  assert.deepEqual(ecritures(), []);
});

// ── Lecture du source ───────────────────────────────────────────────────────

test('Source : plus de « position: count », aucune écriture de position hors de boutique-ordre et de la route shop', () => {
  for (const f of fichiers('src/app/api')) assert.doesNotMatch(lire(f), /position:\s*count/, f);
  const autorises = new Set(['src/lib/boutique-ordre.ts', 'src/app/api/reseller/shop/route.ts']);
  for (const f of fichiers('src')) {
    if (autorises.has(f)) continue;
    const src = sansCommentaires(lire(f));
    if (!src.includes('reseller_shop_items')) continue;
    assert.doesNotMatch(src, /\.(insert|update|upsert)\(\s*[^)]*\bposition\b/, `${f} écrit une position`);
  }
  const shop = sansCommentaires(lire('src/app/api/reseller/shop/route.ts'));
  assert.match(shop, /from '@\/lib\/boutique-ordre'/);
  assert.match(shop, /position: positionAjout\(/);
  assert.match(shop, /\.update\(\{ position: p\.position \}\)/);
  assert.doesNotMatch(shop, /\.upsert\(/, 'plus d’upsert qui remettrait une position à zéro');
});

// ── Route privée GET /api/reseller/boutique/articles ────────────────────────

test('GET /api/reseller/boutique/articles : 401 sans session revendeur ; gain, prix affiché et état dans l’ordre de la vitrine', async () => {
  const { GET } = require('../src/app/api/reseller/boutique/articles/route.ts');
  const P = require('../src/lib/pricing.ts');
  reinitialiser();
  sessionCourante = null;
  assert.equal((await GET(requete('/api/reseller/boutique/articles'))).status, 401);
  sessionCourante = revendeur('rev-1', { role: 'customer', roles: { customer: 'active', reseller: 'active' } });
  assert.equal((await GET(requete('/api/reseller/boutique/articles'))).status, 401);

  etat.products = [
    produit('fixe', { reseller_commission: 1500 }),
    produit('gros', { mode_prix: 'gros', supplier_price: 20000, public_price: 26000 }),
    produit('vide', { stock: 0 }),
    produit('refuse', { status: 'rejected' }),
    produit('zero', { reseller_commission: 0 }),
  ];
  etat.reseller_prices = [{ reseller_id: 'rev-1', product_id: 'gros', price: 28000 }];
  etat.reseller_shop_items = selection('rev-1', [['fixe', 0, HIER], ['gros', -1], ['vide', 1], ['refuse', 2], ['zero', 3]]);
  sessionCourante = revendeur('rev-1');
  const r = await GET(requete('/api/reseller/boutique/articles'));
  assert.equal(r.status, 200);
  const json = await r.json();
  assert.equal(json.max, 60);
  assert.equal(json.coupsDeCoeurMax, 6);
  assert.deepEqual(json.articles.map((a) => [a.id, a.etat, a.coupDeCoeur]), [
    ['gros', 'affiche', true], ['fixe', 'affiche', false], ['vide', 'epuise', false], ['refuse', 'retire', false], ['zero', 'sans_gain', false],
  ]);
  const parId = Object.fromEntries(json.articles.map((a) => [a.id, a]));
  assert.equal(parId.fixe.gain, 1500);
  assert.equal(parId.fixe.prixVitrine, 10000);
  assert.equal(parId.fixe.modePrix, 'fixe');
  assert.equal(parId.fixe.ajouteLe, HIER);
  assert.equal(parId.gros.modePrix, 'gros');
  assert.equal(parId.gros.monPrix, 28000);
  assert.equal(parId.gros.prixVitrine, 28000, 'son prix, celui de la vitrine');
  assert.equal(parId.gros.gain, P.calculerTarifGros(20000, 28000, P.REGLAGES_PAR_DEFAUT).commission);
  assert.equal(parId.gros.prixMinimal, P.prixMinimalGros(20000, P.REGLAGES_PAR_DEFAUT));
  assert.equal(parId.refuse.gain, null, 'plus en vente : « — », jamais un 0 inventé');
  assert.doesNotMatch(JSON.stringify(json), /supplier_price|reseller_commission/);
  assert.deepEqual(ecritures(), [], 'lecture seule');
  // Lecture impossible : 503, jamais une boutique vide inventée.
  fautes['reseller_shop_items:select'] = 'TEST';
  assert.equal((await GET(requete('/api/reseller/boutique/articles'))).status, 503);
});

test('Données privées : ni commission ni gain dans la vitrine publique ; jamais « À la une » dans src/components/shop', () => {
  for (const f of ['src/app/boutique/[slug]/page.tsx', 'src/components/shop/ShopView.tsx', 'src/components/shop/BoutiqueProduits.tsx', 'src/components/shop/EnteteBoutique.tsx']) {
    const src = lire(f);
    assert.doesNotMatch(src, /reseller_commission/, f);
    assert.doesNotMatch(src, /\bgains?\b/i, f);
  }
  for (const f of fichiers('src/components/shop')) assert.doesNotMatch(lire(f), /À la une/, f);
  // La route des articles exige une session revendeur, identité tirée de la session.
  const route = lire('src/app/api/reseller/boutique/articles/route.ts');
  assert.match(route, /session\.role === 'reseller'/);
  assert.match(route, /\.eq\('reseller_id', session\.uid\)/);
});

// ── Vitrine ─────────────────────────────────────────────────────────────────

test('chargerBoutiqueRevendeur : position -1 → coupDeCoeur ; ajouté hier → nouveau ; ordre des positions', async () => {
  const { chargerBoutiqueRevendeur } = require('../src/lib/shop.ts');
  reinitialiser();
  etat.profiles = [{ id: 'rev-1', full_name: 'Awa Traoré Diallo', reseller_code: 'AWA1' }];
  etat.profile_roles = [{ profile_id: 'rev-1', role: 'reseller', status: 'active' }];
  etat.products = [produit('a'), produit('b'), produit('c')];
  etat.reseller_shop_items = selection('rev-1', [['a', 0], ['b', -1], ['c', 1, HIER]]);
  const vitrine = await chargerBoutiqueRevendeur('AWA1');
  assert.deepEqual(vitrine.produits.map((p) => [p.id, Boolean(p.coupDeCoeur), Boolean(p.nouveau)]), [['b', true, false], ['a', false, false], ['c', false, true]]);
  // Sélection vide : le catalogue Suguba montré à la place n'a ni coup de cœur ni « Nouveau ».
  etat.reseller_shop_items = [];
  const catalogue = await chargerBoutiqueRevendeur('AWA1');
  assert.equal(catalogue.selectionVide, true);
  assert.ok(catalogue.produits.every((p) => !p.coupDeCoeur && !p.nouveau));
  assert.deepEqual(ecritures(), []);
});

const vitrineProduit = (id, enPlus = {}) => ({ id, slug: id, nom: id, categorie: 'Cuisine', image: null, images: [], prix: 5000, enStock: true, garantieMois: 0, ...enPlus });

test('BoutiqueProduits : « theiere » trouve « Théière » ; épuisés en fin de rayon ; coups de cœur en tête sans doublon', () => {
  const { organiserVitrine } = require('../src/components/shop/BoutiqueProduits.tsx');
  const produits = [
    vitrineProduit('Théière en fonte'), vitrineProduit('Marmite', { enStock: false }), vitrineProduit('Bol'),
    vitrineProduit('Robe', { categorie: 'Mode' }), vitrineProduit('Pagne', { categorie: 'Mode', coupDeCoeur: true }),
    vitrineProduit('Sac', { categorie: 'Mode', coupDeCoeur: true, enStock: false }), vitrineProduit('Châle', { categorie: 'Mode', coupDeCoeur: true }),
  ];
  assert.deepEqual(organiserVitrine(produits, 'theiere').groupes.map(([c, l]) => [c, l.map((p) => p.nom)]), [['Cuisine', ['Théière en fonte']]]);
  assert.deepEqual(organiserVitrine(produits, 'CHALE').coups.map((p) => p.nom), ['Châle']);
  assert.equal(organiserVitrine(produits, 'cuisine').groupes[0][1].length, 3, 'la catégorie est cherchée aussi');
  const tout = organiserVitrine(produits, '');
  assert.deepEqual(tout.coups.map((p) => p.nom), ['Pagne', 'Châle', 'Sac'], 'épuisé en dernier, ordre choisi gardé');
  assert.deepEqual(tout.groupes.map(([c, l]) => [c, l.map((p) => p.nom)]), [['Cuisine', ['Théière en fonte', 'Bol', 'Marmite']], ['Mode', ['Robe']]]);

  const BoutiqueProduits = require('../src/components/shop/BoutiqueProduits.tsx').default;
  const html = renderToStaticMarkup(React.createElement(BoutiqueProduits, { produits, refCode: 'AWA1' }));
  assert.ok(html.indexOf('Coups de cœur') < html.indexOf('data-carte="Théière en fonte"'), 'la section « Coups de cœur » vient en premier');
  assert.equal((html.match(/data-carte="Pagne"/g) || []).length, 1, 'pas de doublon sous les coups de cœur');
  assert.match(html, /<section id="coups-de-coeur"/);
  assert.match(html, /data-carte="Pagne"[^>]*data-priorite="true"/, 'images des coups de cœur en priorité');
  assert.ok(html.indexOf('data-carte="Bol"') < html.indexOf('data-carte="Marmite"'), 'l’épuisé passe après les articles en stock de son rayon');
  // Pastilles de rayons : des ancres dès 2 rayons.
  assert.match(html, /<nav aria-label="Rayons de la boutique"/);
  for (const ancre of ['#coups-de-coeur', '#rayon-1', '#rayon-2']) assert.match(html, new RegExp(`href="${ancre}"`), ancre);
  assert.match(html, /id="rayon-1"[\s\S]*id="rayon-2"/);
  assert.doesNotMatch(html, /À la une/);
  // Un seul rayon : pas de pastilles.
  assert.doesNotMatch(renderToStaticMarkup(React.createElement(BoutiqueProduits, { produits: produits.slice(0, 3), refCode: null })), /Rayons de la boutique/);
});

test('BoutiqueProduits : « Nouveau » seulement quand l’article n’a pas déjà d’étiquette d’offre', () => {
  const BoutiqueProduits = require('../src/components/shop/BoutiqueProduits.tsx').default;
  const html = renderToStaticMarkup(React.createElement(BoutiqueProduits, {
    refCode: null,
    produits: [vitrineProduit('Neuf', { nouveau: true }), vitrineProduit('Devis', { nouveau: true, etiquetteOffre: 'Sur devis' }), vitrineProduit('Ancien')],
  }));
  assert.match(html, /data-carte="Neuf" data-etiquette="Nouveau"/);
  assert.match(html, /data-carte="Devis" data-etiquette="Sur devis"/);
  assert.match(html, /data-carte="Ancien" data-etiquette=""/);
  assert.match(lire('src/components/shop/BoutiqueProduits.tsx'), /etiquetteOffre: p\.etiquetteOffre/, 'règle du lot 5 de l’audit gardée');
});

// ── Propriétaire : alerte, bandeau, étapes ──────────────────────────────────

test('/boutique/<adresse> : « N articles ne s’affichent plus » calculé pour le propriétaire seulement', async () => {
  const page = require('../src/app/boutique/[slug]/page.tsx');
  const ouvrir = (slug) => page.default({ params: Promise.resolve({ slug }), searchParams: Promise.resolve({}) });
  reinitialiser();
  etat.profiles = [{ id: 'rev-1', full_name: 'Awa Traoré Diallo', reseller_code: 'AWA1' }];
  etat.profile_roles = [{ profile_id: 'rev-1', role: 'reseller', status: 'active' }];
  etat.stores = [{ id: 's1', owner_type: 'reseller', owner_id: 'rev-1', slug: 'awa-mode', name: 'Awa Mode', status: 'active', followers_count: 2 }];
  etat.products = [produit('a'), produit('b', { status: 'rejected' }), produit('c', { reseller_commission: 0 })];
  etat.reseller_shop_items = selection('rev-1', [['a', 0], ['b', 1], ['c', 2]]);
  sessionCourante = revendeur('rev-1');
  let el = await ouvrir('awa-mode');
  assert.equal(el.props.proprietaire.articlesMasques, 2);
  // Visiteur : aucun calcul, aucune alerte.
  sessionCourante = null;
  operations = [];
  el = await ouvrir('awa-mode');
  assert.equal(el.props.proprietaire, null);
  assert.equal(operations.filter((o) => o.table === 'reseller_shop_items' && o.op === 'select').length, 1, 'seule la lecture de la vitrine');

  const ShopView = require('../src/components/shop/ShopView.tsx').default;
  const vitrine = { type: 'revendeur', nom: 'Awa Mode', enseigne: true, categorie: null, logo: null, couverture: null, description: null,
    produits: [vitrineProduit('Robe', { coupDeCoeur: true })], livraisons: 0, selectionVide: false, code: 'AWA1' };
  const rendre = (proprietaire) => renderToStaticMarkup(React.createElement(ShopView, { boutique: vitrine, urlPartage: 'u', refCode: 'AWA1', proprietaire }));
  const html = rendre({ statut: 'active', abonnes: 1, gestion: true, articlesMasques: 2 });
  assert.match(html, /<div role="status" class="[^"]*group-data-\[vue=client\]:hidden">[\s\S]*?2<\/strong> articles de votre sélection ne s’affichent plus\.[\s\S]*?href="\/reseller\/boutique\/articles"/);
  assert.doesNotMatch(rendre({ statut: 'active', abonnes: 1, gestion: true }), /ne s’affiche/);
  assert.doesNotMatch(renderToStaticMarkup(React.createElement(ShopView, { boutique: vitrine, urlPartage: 'u', refCode: 'AWA1' })), /ne s’affiche|reseller\/boutique\/articles/);
  // Étape « Choisir un coup de cœur » cochée par le coup de cœur affiché : 3 étapes sur 8
  // (créée, nom, coup de cœur) au lieu de 2 (lot 4 : + « Partager ma boutique »).
  assert.match(html, /Ma boutique est prête à <span[^>]*>38 %<\/span>/);
  const sansCoup = renderToStaticMarkup(React.createElement(ShopView, {
    boutique: { ...vitrine, produits: [vitrineProduit('Robe')] }, urlPartage: 'u', refCode: 'AWA1', proprietaire: { statut: 'active', abonnes: 1, gestion: true },
  }));
  assert.match(sansCoup, /Ma boutique est prête à <span[^>]*>25 %<\/span>/);
});

test('Bandeau « Articles » → Mes articles ; étape « Choisir un coup de cœur » ; /api/reseller/me la compte', async () => {
  const Bandeau = require('../src/components/shop/proprietaire/BandeauProprietaire.tsx').default;
  const bandeau = renderToStaticMarkup(React.createElement(Bandeau, { identite: { nom: 'Awa Mode', enseigne: true, accroche: null, logo: null, couverture: null }, statut: 'active', urlPartage: 'u' }));
  assert.match(bandeau, /<a href="\/reseller\/boutique\/articles"[^>]*>[\s\S]*?Articles<\/span>/);
  assert.doesNotMatch(bandeau, /\bgains?\b|commission/i);

  const { etapesBoutique } = require('../src/lib/reseau/etapes-boutique.ts');
  const etape = (n) => etapesBoutique({ enseigne: true, logo: 'l', couverture: 'c', accueil: 'a', articles: 5, coupsDeCoeur: n }).find((e) => e.cle === 'coupDeCoeur');
  assert.deepEqual([etape(0).fait, etape(1).fait, etape(null).fait, etape(undefined).fait], [false, true, false, false]);
  assert.equal(etape(1).href, '/reseller/boutique/articles');
  assert.equal(etape(1).libelle, 'Choisir un coup de cœur');

  const { GET } = require('../src/app/api/reseller/me/route.ts');
  reinitialiser();
  etat.profiles = [{ id: 'rev-1', reseller_code: 'AWA1', full_name: 'Awa Diallo', metadata: {} }];
  etat.stores = [{ id: 's1', owner_type: 'reseller', owner_id: 'rev-1', slug: 'awa-mode', name: 'Awa Mode', status: 'active', followers_count: 0 }];
  etat.products = [produit('a'), produit('b', { status: 'rejected' })];
  // Un coup de cœur sur un article qui ne s'affiche plus ne compte pas.
  etat.reseller_shop_items = selection('rev-1', [['b', -1], ['a', 0]]);
  sessionCourante = revendeur('rev-1');
  let json = await (await GET(requete('/api/reseller/me?avec=boutique'))).json();
  assert.equal(json.boutique.etapes.find((e) => e.cle === 'coupDeCoeur').fait, false);
  etat.reseller_shop_items = selection('rev-1', [['a', -1]]);
  json = await (await GET(requete('/api/reseller/me?avec=boutique'))).json();
  assert.equal(json.boutique.etapes.find((e) => e.cle === 'coupDeCoeur').fait, true);
  assert.equal(json.boutique.articles, 1);
});

// ── Mes prix ────────────────────────────────────────────────────────────────

test('Mes prix : ?boutique=1 ne garde que la sélection de la session (ordre de la vitrine), ?produit=<id> un seul article', async () => {
  const { GET } = require('../src/app/api/reseller/prix/route.ts');
  reinitialiser();
  etat.products = ['g1', 'g2', 'g3'].map((id) => produit(id, { mode_prix: 'gros', supplier_price: 20000, public_price: 26000 })).concat(produit('fixe'));
  etat.reseller_shop_items = selection('rev-1', [['g3', -1], ['g1', 0], ['fixe', 1]]).concat(selection('rev-2', [['g2', 0]]));
  sessionCourante = revendeur('rev-1');
  let json = await (await GET(requete('/api/reseller/prix'))).json();
  assert.deepEqual(json.articles.map((a) => a.id).sort(), ['g1', 'g2', 'g3'], 'sans filtre : tous les articles au prix de gros');
  json = await (await GET(requete('/api/reseller/prix?boutique=1'))).json();
  assert.deepEqual(json.articles.map((a) => a.id), ['g3', 'g1']);
  json = await (await GET(requete('/api/reseller/prix?produit=g2'))).json();
  assert.deepEqual(json.articles.map((a) => a.id), ['g2']);
  json = await (await GET(requete('/api/reseller/prix?boutique=1&produit=g2'))).json();
  assert.deepEqual(json.articles, [], 'pas dans sa boutique');
  assert.equal((await GET(requete(`/api/reseller/prix?produit=${'x'.repeat(101)}`))).status, 400);
  assert.deepEqual(ecritures(), []);
  const pagePrix = sansCommentaires(lire('src/app/reseller/prix/page.tsx'));
  assert.match(pagePrix, /q\.get\('boutique'\) === '1'/);
  assert.match(pagePrix, /q\.get\('produit'\)/);
  assert.match(pagePrix, /\/api\/reseller\/prix\$\{suite \? `\?\$\{suite\}` : ''\}/);
});

// ── Créateur : « Message » sans remise inventée, carte de la vraie sélection ──

test('Message des affiches : ni pourcentage ni montant ; « Nouveau », « Stock limité » permis', () => {
  const { refusMessageAffiche, MESSAGE_AFFICHE_MAX } = require('../src/lib/message-affiche.ts');
  assert.equal(MESSAGE_AFFICHE_MAX, 40);
  for (const ok of ['', null, 'Nouveau', 'Stock limité', 'Livré en 24 h', 'Spécial Tabaski', 'Pack de 3', 'Top 10']) {
    assert.equal(refusMessageAffiche(ok), null, String(ok));
  }
  for (const non of ['-10 % ce week-end', '10%', 'Moins 20 pour cent', '5 000 F seulement', '2500fr', '10 000 francs', 'Prix 15.000', '3500', '-10 ce week-end', 'moins 500', '10k']) {
    assert.ok(refusMessageAffiche(non), non);
  }
  assert.ok(refusMessageAffiche('x'.repeat(41)));
  const createur = sansCommentaires(lire('src/app/reseller/createur/page.tsx'));
  assert.match(createur, /label="Message \(facultatif\)"/);
  assert.doesNotMatch(createur, /Bandeau promo/);
  assert.match(createur, /erreur=\{refusMessage \|\| undefined\}/);
  assert.match(createur, /fetch\('\/api\/reseller\/boutique\/articles'/);
  // Relecture du lot 3 : la lecture est vérifiée avant de composer la carte.
  assert.match(createur, /const articles = await lireArticlesBoutique\(\);[\s\S]*?selectionPourCarte\(articles\)/);
  assert.doesNotMatch(createur, /genererCarteBoutique\(boutique, produits\.slice\(0, 3\)/, 'plus le catalogue en premier');
  const affiche = lire('src/lib/affiche.ts');
  assert.match(affiche, /const refus = refusMessageAffiche\(promo\);\s*if \(refus\) throw new Error\(refus\);/);
});

// ── Écrans : Mes articles, feuille « Cet article », catalogue ───────────────

test('Source : Mes articles (coquille, compteurs, blocs, gain, une requête à la fois) et feuille « Cet article »', () => {
  const page = sansCommentaires(lire('src/app/reseller/boutique/articles/page.tsx'));
  assert.match(page, /<PageReseau/);
  assert.match(page, /titre="Mes articles"/);
  assert.match(page, /\{articles\.length\}\/\{ARTICLES_MAX\}/);
  assert.match(page, /\{rangement\.coups\.length\}\/\{COUPS_DE_COEUR_MAX\}/);
  assert.match(page, />Coups de cœur\s*</);
  assert.match(page, />Autres articles\s*</);
  assert.match(page, /<LigneListe/);
  assert.match(page, /Vous gagnez \{formatF\(a\.gain\)\}/);
  assert.match(page, /aria-label=\{`Monter \$\{a\.nom\}`\}/);
  assert.match(page, /className="w-10 h-10 rounded-full/);
  assert.match(page, /<BarreEnregistrement[\s\S]*?libelle="Enregistrer l’ordre"/);
  assert.match(page, /if \(verrou\.current\) return;/);
  assert.match(page, /action: 'ordonner', ordre: ordreDe\(envoye\), coupsDeCoeur: envoye\.coups/);
  assert.match(page, /r\.status === 409/);
  assert.match(page, /<EmptyState[\s\S]*?Ajouter des articles/);
  assert.match(page, /CATALOGUE_DEPUIS_BOUTIQUE/);
  assert.doesNotMatch(page, /À la une/);
  const feuille = sansCommentaires(lire('src/components/shop/proprietaire/FeuilleArticle.tsx'));
  assert.match(feuille, /<Sheet ouvert=\{ouvert\} onFermer=\{onFermer\} titre="Cet article">/);
  for (const action of ['Mettre en premier', 'Coup de cœur', 'Mon prix', 'Partager cet article', 'Voir dans ma boutique', 'Retirer de ma boutique']) {
    assert.ok(feuille.includes(action), action);
  }
  assert.match(feuille, /Votre offre disparaîtra aussi de la fiche produit de cet article\./);
  assert.match(feuille, /\/reseller\/prix\?boutique=1&produit=\$\{encodeURIComponent\(article\.id\)\}/);
  assert.match(feuille, /partagerProduit\(/);
  assert.match(feuille, /if \(!ok\) return;/, 'le retrait attend la confirmation');
  // PageHeader : le retour vers la porte « Ma boutique » n'est jamais préchargé.
  const { PageHeader } = require('../src/components/ui/Surface.tsx');
  assert.match(renderToStaticMarkup(React.createElement(PageHeader, { titre: 'Mes articles', retour: { href: '/reseller/ma-boutique', libelle: 'Ma boutique' } })), /data-prefetch="false"/);
  assert.match(renderToStaticMarkup(React.createElement(PageHeader, { titre: 'X', retour: { href: '/reseller', libelle: 'Espace' } })), /data-prefetch="undefined"/);
});

test('Source : catalogue « Dans ma boutique (N) », « Ajouté à ma boutique · Voir ma boutique », ?depuis=boutique, retrait confirmé', () => {
  const cat = sansCommentaires(lire('src/app/reseller/catalog/page.tsx'));
  assert.match(cat, /Dans ma boutique \(\{maSelection\.size\}\)/);
  assert.match(cat, /aria-pressed=\{seulementBoutique\}/);
  assert.match(cat, /const dansBoutique = !seulementBoutique \|\| maSelection\.has\(p\.id\);/);
  assert.match(cat, /get\('depuis'\) === 'boutique'/);
  assert.match(cat, /sticky top-16/);
  assert.match(cat, /Revenir à ma boutique/);
  assert.match(cat, /Ajouté à ma boutique/);
  assert.match(cat, /<Link href=\{PORTE_MA_BOUTIQUE\} prefetch=\{false\}[^>]*>\s*Voir ma boutique/);
  assert.match(cat, /Votre offre disparaîtra aussi de la fiche produit de cet article\./);
  assert.match(lire('src/lib/reseau/porte-boutique.ts'), /CATALOGUE_DEPUIS_BOUTIQUE = '\/reseller\/catalog\?depuis=boutique'/);
});
