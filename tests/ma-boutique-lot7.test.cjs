// TEST-BOUTIQUE-LOT7-001..022 (chantier boutique du revendeur, 2026-10-03, lot 7
// « Boutiques Pro au même niveau ») : les boutiques supplémentaires (formules Pro)
// d'un revendeur reçoivent le mode propriétaire, l'édition d'identité par les
// crayons, le rangement et les coups de cœur, un enregistrement SANS PERTE et
// uniquement des articles qui rapportent quelque chose.
//  - couche commune src/lib/reseau/articles-boutique.ts : reseller_shop_items
//    (principale, effet commercial) ou store_products (boutique Pro), mêmes règles ;
//  - la boutique d'un autre compte est « introuvable » (404), rien n'est lu ni écrit ;
//  - ranger une boutique Pro n'écrit JAMAIS dans reseller_shop_items.
// Supabase, la session et les cookies sont SIMULÉS (require.cache) : aucune base réelle.
require('../scripts/test-typescript.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const RESEAU_INTERDIT = async () => { throw Error('Réseau externe interdit dans les tests'); };
global.fetch = RESEAU_INTERDIT;
const RACINE = path.join(__dirname, '..');
const lire = (f) => fs.readFileSync(path.join(RACINE, f), 'utf8');
const sansCommentaires = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
function fichiers(dossier) {
  return fs.readdirSync(path.join(RACINE, dossier)).flatMap((nom) => {
    const relatif = path.join(dossier, nom);
    return fs.statSync(path.join(RACINE, relatif)).isDirectory() ? fichiers(relatif) : /\.tsx?$/.test(nom) ? [relatif] : [];
  });
}

const BASE = 'https://projet.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_URL = BASE;
const dossier = (uid) => `${BASE}/storage/v1/object/public/product-images/boutiques/${uid}/`;

// ── Base simulée : chaque opération est enregistrée avec ses filtres ─────────
let etat; let fautes; let operations; let serie;
function reinitialiser() {
  etat = {
    stores: [], profiles: [], profile_roles: [], reseller_shop_items: [], store_products: [], products: [], reseller_prices: [],
    store_plans: [], platform_settings: [], suppliers: [], orders: [], tracking_links: [], analytics_events: [],
  };
  fautes = {}; operations = []; serie = 1;
}
const comparer = (a, b) => (typeof a === 'number' && typeof b === 'number' ? a - b : String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0);
const db = {
  from(table) {
    let op = 'select'; let patch; const filtres = []; const egalites = {}; const dans = {}; let un = false; let tete = false; let limite = null; let tri = null;
    const q = {
      select(_colonnes, options) { if (options && options.head) tete = true; return q; },
      eq(k, v) { egalites[k] = v; filtres.push((r) => r[k] === v); return q; },
      neq(k, v) { filtres.push((r) => r[k] !== v); return q; },
      gt(k, v) { filtres.push((r) => Number(r[k]) > Number(v)); return q; },
      gte(k, v) { filtres.push((r) => String(r[k]) >= String(v)); return q; },
      in(k, v) { dans[k] = v; filtres.push((r) => v.includes(r[k])); return q; },
      ilike(k, v) { filtres.push((r) => String(r[k]).toLowerCase() === String(v).toLowerCase()); return q; },
      is(k, v) { filtres.push((r) => (v === null ? r[k] == null : r[k] === v)); return q; },
      not() { return q; }, or() { return q; },
      order(k, o) { tri = { k, asc: !o || o.ascending !== false }; return q; },
      limit(n) { limite = n; return q; },
      insert(p) { op = 'insert'; patch = p; return q; },
      update(p) { op = 'update'; patch = p; return q; },
      upsert(p) { op = 'upsert'; patch = p; return q; },
      delete() { op = 'delete'; return q; },
      maybeSingle() { un = true; return q; },
      then(resolve, reject) {
        operations.push({ table, op, patch, egalites, dans });
        const repondre = (r) => Promise.resolve(r).then(resolve, reject);
        const faute = fautes[`${table}:${op}`];
        if (faute) return repondre({ data: null, count: null, error: { code: faute, message: `faute simulée ${faute}` } });
        let lignes = (etat[table] || []).filter((r) => filtres.every((f) => f(r)));
        if (tri) lignes = [...lignes].sort((a, b) => comparer(a[tri.k], b[tri.k]) * (tri.asc ? 1 : -1));
        if (op === 'insert') {
          const maintenant = new Date().toISOString();
          lignes = (Array.isArray(patch) ? patch : [patch]).map((p) => ({ id: `n${serie++}`, created_at: maintenant, added_at: maintenant, ...p }));
          (etat[table] ||= []).push(...lignes);
        }
        if (op === 'update') lignes.forEach((r) => Object.assign(r, JSON.parse(JSON.stringify(patch))));
        if (op === 'delete') etat[table] = (etat[table] || []).filter((r) => !lignes.includes(r));
        if (limite !== null && op === 'select') lignes = lignes.slice(0, limite);
        const data = tete ? null : un ? (lignes[0] ? { ...lignes[0] } : null) : lignes.map((r) => ({ ...r }));
        return repondre({ data, count: lignes.length, error: null });
      },
    };
    return q;
  },
  async rpc() { return { data: null, error: null }; },
};
const ecritures = () => operations.filter((o) => o.op !== 'select');
const sur = (table) => operations.filter((o) => o.table === table);
require.cache[require.resolve('../src/lib/supabase-admin.ts')] = { exports: { getSupabaseAdmin: () => db } };

let sessionCourante = null;
require.cache[require.resolve('../src/lib/active-session.ts')] = { exports: { verifyActiveSession: async () => sessionCourante } };
const vraieSession = require('../src/lib/session.ts');
require.cache[require.resolve('../src/lib/session.ts')] = { exports: { ...vraieSession, verifySessionToken: async () => sessionCourante } };
require.cache[require.resolve('next/headers')] = {
  exports: { cookies: async () => ({ get: (nom) => (nom === vraieSession.SESSION_COOKIE_NAME ? { value: 'jeton-simule' } : undefined) }) },
};
class Introuvable extends Error {}
let adresse = new URLSearchParams('');
require.cache[require.resolve('next/navigation')] = {
  exports: {
    notFound: () => { throw new Introuvable('page introuvable'); }, usePathname: () => '/', useRouter: () => ({ push() {}, replace() {}, refresh() {} }),
    useSearchParams: () => adresse,
  },
};
require.cache[require.resolve('../src/lib/reseau/contexte-fournisseur.ts')] = {
  exports: { exigerDroitFournisseur: async () => ({ ok: true, contexte: { fournisseurId: 'fou-1' } }) },
};
const revendeur = (uid, extra = {}) => ({ uid, phone: '+22300000000', role: 'reseller', status: 'active', roles: { reseller: 'active' }, iat: 1, exp: 9e9, ...extra });
const fournisseur = (uid) => ({ uid, phone: '+22300000009', role: 'supplier', status: 'active', roles: { supplier: 'active' }, iat: 1, exp: 9e9 });

// ── Composants simulés ──────────────────────────────────────────────────────
const marqueur = (nom) => ({ __esModule: true, default: (p) => React.createElement('i', { 'data-marqueur': nom, 'data-actif': p && p.actif ? p.actif : '' }) });
for (const [fichier, nom] of [['common/Header', 'entete'], ['common/BottomNav', 'barre'], ['common/Footer', 'pied'],
  ['common/AncrageRevendeur', 'ancrage'], ['shop/ShopShareBar', 'partage'], ['common/QrCode', 'qr'], ['shop/VisiteBoutique', 'visite'],
  ['shop/BoutonSuivre', 'suivre'], ['shop/GalerieBoutique', 'galerie']]) {
  require.cache[require.resolve(`../src/components/${fichier}.tsx`)] = { exports: marqueur(nom) };
}
require.cache[require.resolve('../src/components/product/ProductCard.tsx')] = {
  exports: { __esModule: true, default: ({ produit }) => React.createElement('i', { 'data-carte': produit.nom }) },
};
require.cache[require.resolve('../src/components/common/ProductImage.tsx')] = {
  exports: { __esModule: true, default: ({ src }) => React.createElement('i', { 'data-image': src }) },
};
require.cache[require.resolve('next/link')] = {
  exports: { __esModule: true, default: ({ href, prefetch, children, ...reste }) => React.createElement('a', { href, ...reste }, children) },
};
require.cache[require.resolve('next/dynamic')] = {
  exports: { __esModule: true, default: (charger) => {
    const chemin = String(charger).match(/require\(['"]([^'"]+)['"]\)/)[1].replace(/^@\//, `${path.join(RACINE, 'src')}/`);
    return (p) => React.createElement(require(chemin).default, p);
  } },
};
// La vraie feuille passe par un portail (rien au rendu serveur) : ici, son contenu à plat.
require.cache[require.resolve('../src/components/ui/Sheet.tsx')] = {
  exports: { __esModule: true, default: ({ ouvert, titre, sousTitre, children, pied }) => (ouvert
    ? React.createElement('section', { 'data-feuille': titre }, React.createElement('p', null, sousTitre), children, React.createElement('footer', null, pied))
    : null) },
};
// Messages et confirmations : enregistrés, la confirmation répond « oui ».
let messages = []; let confirmations = [];
require.cache[require.resolve('../src/components/ui/Toast.tsx')] = {
  exports: { __esModule: true, useToast: () => ({ toast(texte, options) { messages.push([texte, options]); }, demander: async () => null, confirmer: async (d) => { confirmations.push(d); return true; } }) },
};
require.cache[require.resolve('../src/lib/reseau/recompenses.ts')] = { exports: { lireReglagesReseau: async () => ({}) } };
require.cache[require.resolve('../src/lib/presentation-fournisseur.ts')] = { exports: { appliquerPrioriteReseau: async (_a, v) => v } };

const { NextRequest } = require('next/server');
const requete = (url, init = {}) => new NextRequest(`http://localhost${url}`, {
  ...init, headers: { cookie: 'suguba_session=simule', 'content-type': 'application/json', ...(init.headers || {}) },
});
const ROUTES = {
  '/api/reseller/shop': '../src/app/api/reseller/shop/route.ts',
  '/api/reseller/boutique': '../src/app/api/reseller/boutique/route.ts',
  '/api/reseller/boutique/articles': '../src/app/api/reseller/boutique/articles/route.ts',
  '/api/reseller/boutique/partage': '../src/app/api/reseller/boutique/partage/route.ts',
  '/api/compte/boutiques': '../src/app/api/compte/boutiques/route.ts',
};
const appeler = (methode, url, corps) => require(ROUTES[url.split('?')[0]])[methode](requete(url, { method: methode, ...(corps === undefined ? {} : { body: JSON.stringify(corps) }) }));
const shop = (corps) => appeler('POST', '/api/reseller/shop', corps);
const compte = (corps) => appeler('POST', '/api/compte/boutiques', corps);
const articles = (suite = '') => appeler('GET', `/api/reseller/boutique/articles${suite}`);

// ── Données : Awa a une boutique principale et une boutique Pro ; Moussa aussi ──
const HIER = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
const IL_Y_A_UN_MOIS = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
const produit = (id, enPlus = {}) => ({
  id, slug: `slug-${id}`, name: `Article ${id}`, category: 'Maison', images: [`https://x/${id}.webp`], public_price: 10000, stock: 5,
  reseller_commission: 1000, pricing_status: 'ok', status: 'approved', supplier_id: 'fou-1', created_at: IL_Y_A_UN_MOIS, ...enPlus,
});
const dansPro = (boutique, liste) => liste.map(([id, position, added_at = IL_Y_A_UN_MOIS]) => ({ store_id: boutique, product_id: id, position, added_at }));
const principale = (uid, liste) => liste.map(([id, position, added_at = IL_Y_A_UN_MOIS]) => ({ reseller_id: uid, product_id: id, position, added_at }));
const AWA = { id: 'rev-1', full_name: 'Awa Traoré Diallo', reseller_code: 'AWA1' };
function baseAwa() {
  reinitialiser();
  etat.profiles = [AWA, { id: 'rev-2', full_name: 'Moussa Keita', reseller_code: 'MOU1' }];
  etat.profile_roles = [{ profile_id: 'rev-1', role: 'reseller', status: 'active' }, { profile_id: 'rev-2', role: 'reseller', status: 'active' }];
  etat.stores = [
    { id: 's-awa', owner_type: 'reseller', owner_id: 'rev-1', slug: 'awa-mode', name: 'Awa Mode', status: 'active', followers_count: 4, principale: true, created_at: '2026-01-01T00:00:00Z', logo_url: null, cover_url: null, gallery: [], categories: [] },
    { id: 'b-pro', owner_type: 'reseller', owner_id: 'rev-1', slug: 'awa-maison', name: 'Awa Maison', status: 'active', followers_count: 2, principale: false, created_at: '2026-09-25T00:00:00Z', logo_url: null, cover_url: null, gallery: [], categories: [] },
    { id: 's-mou', owner_type: 'reseller', owner_id: 'rev-2', slug: 'moussa-k', name: 'Moussa K.', status: 'active', followers_count: 0, principale: true, created_at: '2026-02-01T00:00:00Z' },
    { id: 'x-pro', owner_type: 'reseller', owner_id: 'rev-2', slug: 'moussa-deco', name: 'Moussa Déco', status: 'active', followers_count: 0, principale: false, created_at: '2026-09-26T00:00:00Z' },
  ];
  etat.products = [produit('a'), produit('b'), produit('c'), produit('d'), produit('n'),
    produit('zero', { reseller_commission: 0 }), produit('plancher', { pricing_status: 'below_floor' }), produit('refuse', { status: 'rejected' })];
  etat.reseller_shop_items = principale('rev-1', [['a', -1], ['b', 0]]);
  etat.store_products = [...dansPro('b-pro', [['a', 0], ['b', 1], ['c', 2], ['d', 3]]), ...dansPro('x-pro', [['a', 0], ['b', 1]])];
  sessionCourante = revendeur('rev-1');
}
const positionsDe = (boutique) => Object.fromEntries(etat.store_products.filter((l) => l.store_id === boutique).map((l) => [l.product_id, l.position]));
const PRINCIPALE_INTACTE = () => JSON.stringify(principale('rev-1', [['a', -1], ['b', 0]]));

// ── 1. Couche commune : la boutique visée appartient toujours à la session ───

test('cibleArticles : sans identifiant la principale (aucune lecture) ; une boutique Pro du compte ; jamais celle d’un autre, ni la principale par défaut', async () => {
  const { cibleArticles } = require('../src/lib/reseau/articles-boutique.ts');
  baseAwa();
  for (const absent of [undefined, null]) {
    const c = await cibleArticles('rev-1', absent);
    assert.deepEqual([c.table, c.colonne, c.valeur, c.pro], ['reseller_shop_items', 'reseller_id', 'rev-1', false]);
  }
  assert.deepEqual(operations, [], 'la boutique principale ne coûte aucune lecture, comme avant');
  // Identifiant vide ou illisible : null, JAMAIS la principale (elle porte les offres du revendeur).
  for (const illisible of ['', 0, false, {}, ['b-pro'], 'x'.repeat(101)]) assert.equal(await cibleArticles('rev-1', illisible), null, JSON.stringify(illisible));
  assert.deepEqual(operations, [], 'rien n’est lu pour un identifiant illisible');
  const pro = await cibleArticles('rev-1', 'b-pro');
  assert.deepEqual([pro.table, pro.colonne, pro.valeur, pro.pro, pro.boutique.slug], ['store_products', 'store_id', 'b-pro', true, 'awa-maison']);
  // L'identifiant de SA boutique principale mène à reseller_shop_items : ses articles n'ont jamais été dans store_products.
  const sienne = await cibleArticles('rev-1', 's-awa');
  assert.deepEqual([sienne.table, sienne.valeur, sienne.pro], ['reseller_shop_items', 'rev-1', false]);
  // Boutique d'un autre compte (Pro ou principale), ou inconnue : null.
  for (const autre of ['x-pro', 's-mou', 'inconnue']) assert.equal(await cibleArticles('rev-1', autre), null, autre);
  assert.deepEqual(ecritures(), []);
});

test('GET /api/reseller/boutique/articles?boutique= : les articles de SA boutique Pro, dans l’ordre, avec son nom public ; 404 pour celle d’un autre', async () => {
  baseAwa();
  etat.store_products = [...dansPro('b-pro', [['a', 1], ['b', -1], ['c', 0, HIER], ['zero', 2], ['refuse', 3]]), ...dansPro('x-pro', [['d', 0]])];
  let r = await articles('?boutique=b-pro');
  assert.equal(r.status, 200);
  let json = await r.json();
  assert.deepEqual(json.articles.map((a) => [a.id, a.etat, a.coupDeCoeur]), [
    ['b', 'affiche', true], ['c', 'affiche', false], ['a', 'affiche', false], ['zero', 'sans_gain', false], ['refuse', 'retire', false],
  ]);
  assert.equal(json.articles[0].gain, 1000);
  assert.equal(json.articles[1].ajouteLe, HIER);
  assert.deepEqual(json.boutique, { id: 'b-pro', slug: 'awa-maison', nom: 'Awa Maison', enseigne: true, statut: 'active' });
  assert.equal(json.max, 60);
  assert.equal(json.coupsDeCoeurMax, 6);
  assert.doesNotMatch(JSON.stringify(json), /Traoré|Diallo|supplier_price|reseller_commission/);
  assert.equal(sur('reseller_shop_items').length, 0, 'la boutique principale n’est pas lue');
  assert.ok(sur('store_products').every((o) => o.egalites.store_id === 'b-pro'), 'seulement SA boutique');
  assert.deepEqual(ecritures(), [], 'lecture seule');
  // Boutique Pro encore au nom du compte : « Awa D. », jamais le nom complet.
  etat.stores[1].name = 'Awa Traoré Diallo';
  json = await (await articles('?boutique=b-pro')).json();
  assert.deepEqual([json.boutique.nom, json.boutique.enseigne], ['Awa D.', false]);
  assert.doesNotMatch(JSON.stringify(json), /Traoré|Diallo/);

  // Celle d'un autre, une inconnue, un identifiant vide : 404, et aucun de ses articles n'est lu.
  for (const suite of ['?boutique=x-pro', '?boutique=s-mou', '?boutique=inconnue', '?boutique=']) {
    operations = [];
    r = await articles(suite);
    assert.equal(r.status, 404, suite);
    assert.equal((await r.json()).error, 'Boutique introuvable.');
    assert.equal(sur('store_products').length + sur('reseller_shop_items').length + sur('products').length, 0, `${suite} : rien n’est lu`);
  }
  // Sans paramètre : la boutique principale, réponse inchangée (pas de clé `boutique`).
  operations = [];
  json = await (await articles()).json();
  assert.deepEqual(json.articles.map((a) => [a.id, a.coupDeCoeur]), [['a', true], ['b', false]]);
  assert.equal('boutique' in json, false);
  assert.equal('principale' in json, false);
  assert.equal(sur('store_products').length, 0);
  // Avec l'identifiant de SA boutique principale : ses articles habituels, signalés comme tels.
  json = await (await articles('?boutique=s-awa')).json();
  assert.deepEqual([json.articles.map((a) => a.id), json.principale, 'boutique' in json], [['a', 'b'], true, false]);
  assert.equal(sur('store_products').length, 0);
  // Profil illisible : 503 plutôt qu'un nom qu'on ne sait pas vérifier ; sélection illisible : 503, jamais une boutique vide.
  fautes['profiles:select'] = 'XX000';
  assert.equal((await articles('?boutique=b-pro')).status, 503);
  delete fautes['profiles:select'];
  fautes['store_products:select'] = 'XX000';
  assert.equal((await articles('?boutique=b-pro')).status, 503);
  delete fautes['store_products:select'];
  // Session : revendeur seulement.
  sessionCourante = null;
  assert.equal((await articles('?boutique=b-pro')).status, 401);
  sessionCourante = revendeur('rev-1', { role: 'customer', roles: { customer: 'active', reseller: 'active' } });
  assert.equal((await articles('?boutique=b-pro')).status, 401);
});

// ── 2. Ranger, ajouter, retirer une boutique Pro ────────────────────────────

test('Route « ordonner » avec `boutique` : seulement des UPDATE de position dans store_products, pour SA boutique ; la principale n’est jamais touchée', async () => {
  baseAwa();
  const r = await shop({ action: 'ordonner', boutique: 'b-pro', ordre: ['c', 'd', 'a', 'b'], coupsDeCoeur: ['c'], reseller_id: 'rev-2', store_id: 'x-pro' });
  assert.equal(r.status, 200);
  const ecrites = ecritures();
  assert.ok(ecrites.length > 0);
  assert.ok(ecrites.every((o) => o.op === 'update' && o.table === 'store_products'), 'ni delete, ni insert, ni upsert, ni autre table');
  assert.ok(ecrites.every((o) => Object.keys(o.patch).join() === 'position'), 'seule la position change');
  assert.ok(sur('store_products').every((o) => o.egalites.store_id === 'b-pro'), 'la boutique vérifiée, pas celle du corps');
  assert.equal(sur('reseller_shop_items').length, 0, 'la table qui porte les offres n’est ni lue ni écrite');
  assert.deepEqual(positionsDe('b-pro'), { c: -1, d: 0, a: 1, b: 2 });
  assert.deepEqual(positionsDe('x-pro'), { a: 0, b: 1 }, 'la boutique de l’autre est intacte');
  assert.equal(JSON.stringify(etat.reseller_shop_items), PRINCIPALE_INTACTE());
  // Rejouer le même ordre n'écrit rien.
  operations = [];
  assert.equal((await shop({ action: 'ordonner', boutique: 'b-pro', ordre: ['c', 'd', 'a', 'b'], coupsDeCoeur: ['c'] })).status, 200);
  assert.deepEqual(ecritures(), []);
  // Mêmes garde-fous que la principale : ensemble exact (409), 6 coups de cœur au plus (400).
  let refus = await shop({ action: 'ordonner', boutique: 'b-pro', ordre: ['c', 'd', 'a'], coupsDeCoeur: [] });
  assert.equal(refus.status, 409);
  assert.equal((await refus.json()).error, 'Votre boutique a changé, rechargez.');
  refus = await shop({ action: 'ordonner', boutique: 'b-pro', ordre: ['c', 'd', 'a', 'b'], coupsDeCoeur: ['z'] });
  assert.equal(refus.status, 400);
  assert.deepEqual(ecritures(), []);
  // Sans `boutique` : la boutique principale, exactement comme avant ce lot.
  operations = [];
  assert.equal((await shop({ action: 'ordonner', ordre: ['b', 'a'], coupsDeCoeur: ['b'] })).status, 200);
  assert.ok(ecritures().every((o) => o.table === 'reseller_shop_items' && o.op === 'update' && o.egalites.reseller_id === 'rev-1'));
  assert.equal(sur('store_products').length, 0);
  assert.deepEqual(positionsDe('b-pro'), { c: -1, d: 0, a: 1, b: 2 });
});

test('Un revendeur ne peut ni lire ni ranger la boutique Pro d’un autre : 404, rien n’est écrit ; un identifiant vide ne retombe jamais sur la principale', async () => {
  baseAwa();
  const avant = JSON.stringify([etat.store_products, etat.reseller_shop_items, etat.stores]);
  for (const boutique of ['x-pro', 's-mou', 'inconnue', '', 0, { id: 'b-pro' }]) {
    for (const corps of [
      { action: 'ordonner', ordre: ['b', 'a'], coupsDeCoeur: ['b'] },
      { action: 'retirer', productId: 'a' },
      { action: 'ajouter', productId: 'n' },
    ]) {
      operations = [];
      const r = await shop({ ...corps, boutique });
      assert.equal(r.status, 404, `${corps.action} ${JSON.stringify(boutique)}`);
      assert.equal((await r.json()).error, 'Boutique introuvable.');
      assert.deepEqual(ecritures(), []);
      assert.equal(sur('store_products').length + sur('reseller_shop_items').length, 0, 'aucun article lu');
    }
  }
  // Mes boutiques : la sélection et l'identité de la boutique d'un autre sont introuvables elles aussi.
  for (const corps of [
    { action: 'articles', boutiqueId: 'x-pro', produits: [] },
    { action: 'modifier', boutiqueId: 'x-pro', champs: { nom: 'Prise' } },
  ]) {
    operations = [];
    assert.equal((await compte(corps)).status, 404, corps.action);
    assert.deepEqual(ecritures(), []);
  }
  assert.equal(JSON.stringify([etat.store_products, etat.reseller_shop_items, etat.stores]), avant);
  // Sans session revendeur : 401 avant toute lecture.
  sessionCourante = null;
  operations = [];
  assert.equal((await shop({ action: 'ordonner', boutique: 'b-pro', ordre: ['a', 'b', 'c', 'd'], coupsDeCoeur: [] })).status, 401);
  assert.deepEqual(operations, []);
});

test('Routes « retirer » et « ajouter » avec `boutique` : store_products seulement ; un article à commission nulle est refusé', async () => {
  baseAwa();
  // Retirer « a » de la boutique Pro : la ligne de la principale (son offre) reste.
  let r = await shop({ action: 'retirer', productId: 'a', boutique: 'b-pro' });
  assert.equal(r.status, 200);
  assert.deepEqual(ecritures().map((o) => [o.table, o.op, o.egalites.store_id, o.egalites.product_id]), [['store_products', 'delete', 'b-pro', 'a']]);
  assert.deepEqual(positionsDe('b-pro'), { b: 1, c: 2, d: 3 });
  assert.deepEqual(positionsDe('x-pro'), { a: 0, b: 1 });
  assert.equal(JSON.stringify(etat.reseller_shop_items), PRINCIPALE_INTACTE(), 'l’offre du revendeur sur « a » est gardée');
  // Retrait en panne : 503, la ligne reste.
  fautes['store_products:delete'] = 'XX000';
  r = await shop({ action: 'retirer', productId: 'b', boutique: 'b-pro' });
  assert.equal(r.status, 503);
  assert.equal((await r.json()).error, 'Retrait impossible. Réessayez.');
  assert.equal('b' in positionsDe('b-pro'), true);
  delete fautes['store_products:delete'];

  // Ajouter : commission nulle, prix sous le plancher, plus en vente → 400, rien d'écrit.
  for (const id of ['zero', 'plancher', 'refuse', 'inconnu']) {
    operations = [];
    r = await shop({ action: 'ajouter', productId: id, boutique: 'b-pro' });
    assert.equal(r.status, 400, id);
    assert.equal((await r.json()).error, 'Ce produit ne peut pas être ajouté à votre boutique.');
    assert.deepEqual(ecritures(), []);
  }
  // Article qui rapporte : à la suite du dernier, jamais un coup de cœur.
  operations = [];
  r = await shop({ action: 'ajouter', productId: 'n', boutique: 'b-pro', store_id: 'x-pro' });
  assert.equal(r.status, 200);
  assert.deepEqual(ecritures().map((o) => [o.table, o.op, o.patch]), [['store_products', 'insert', { store_id: 'b-pro', product_id: 'n', position: 4 }]]);
  // Déjà là : rien n'est écrit, sa place est gardée.
  operations = [];
  r = await shop({ action: 'ajouter', productId: 'n', boutique: 'b-pro' });
  assert.deepEqual(await r.json(), { success: true, deja: true });
  assert.deepEqual(ecritures(), []);
  assert.equal(sur('reseller_shop_items').length, 0);
  assert.equal(JSON.stringify(etat.reseller_shop_items), PRINCIPALE_INTACTE());
});

// ── 3. « Choisir les articles » : un enregistrement sans perte ───────────────

test('Sélection d’une boutique Pro : l’ordre et les coups de cœur sont gardés après un nouvel enregistrement ; seuls les retirés partent, les nouveaux s’ajoutent à la suite', async () => {
  baseAwa();
  etat.store_products = [...dansPro('b-pro', [['a', -1], ['b', 0], ['c', 1], ['d', 2]]), ...dansPro('x-pro', [['a', 0], ['b', 1]])];
  // Même sélection, renvoyée dans un autre ordre : rien n'est écrit (avant : tout effacé puis réinséré de 0 à n-1).
  let r = await compte({ action: 'articles', boutiqueId: 'b-pro', produits: ['d', 'c', 'b', 'a'] });
  assert.deepEqual(positionsDe('b-pro'), { a: -1, b: 0, c: 1, d: 2 }, 'coup de cœur et ordre gardés');
  assert.deepEqual(ecritures(), [], 'ni suppression ni réinsertion');
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { success: true, refuses: 0 });

  // « c » décoché, « n » coché : une insertion, une suppression ciblée, aucune position réécrite.
  operations = [];
  r = await compte({ action: 'articles', boutiqueId: 'b-pro', produits: ['d', 'a', 'b', 'n'] });
  assert.equal(r.status, 200);
  assert.deepEqual(ecritures().map((o) => [o.table, o.op]), [['store_products', 'insert'], ['store_products', 'delete']], 'les nouveaux d’abord, puis les retirés');
  const [insertion, suppression] = ecritures();
  assert.deepEqual(insertion.patch, [{ store_id: 'b-pro', product_id: 'n', position: 3 }], 'à la suite du dernier, jamais un coup de cœur');
  assert.deepEqual([suppression.egalites.store_id, suppression.dans.product_id], ['b-pro', ['c']], 'seulement l’article décoché, seulement cette boutique');
  assert.deepEqual(positionsDe('b-pro'), { a: -1, b: 0, d: 2, n: 3 }, 'coup de cœur et ordre gardés');
  assert.deepEqual(positionsDe('x-pro'), { a: 0, b: 1 });
  assert.equal(sur('reseller_shop_items').length, 0);
  // « Mes articles » relit le même ordre.
  const lus = await (await articles('?boutique=b-pro')).json();
  assert.deepEqual(lus.articles.map((a) => [a.id, a.coupDeCoeur]), [['a', true], ['b', false], ['d', false], ['n', false]]);
});

test('Sélection d’une boutique Pro : une insertion en panne ne vide plus la boutique ; plus de 60 articles ou une lecture en panne : rien n’est écrit', async () => {
  baseAwa();
  const avant = JSON.stringify(etat.store_products);
  // Avant ce lot : delete de toute la sélection, PUIS insert — en panne, la boutique restait vide.
  fautes['store_products:insert'] = 'XX000';
  let r = await compte({ action: 'articles', boutiqueId: 'b-pro', produits: ['a', 'b', 'n'] });
  assert.equal(JSON.stringify(etat.store_products), avant, 'la sélection existante est intacte : ni « a », ni « b », ni « c », ni « d » ne sont partis');
  assert.equal(ecritures().filter((o) => o.op === 'delete').length, 0, 'aucune suppression avant ni après l’échec');
  assert.equal(r.status, 503);
  assert.match((await r.json()).error, /Rien n’a changé dans cette boutique/);
  delete fautes['store_products:insert'];
  // Sélection illisible : rien n'est écrit (jamais prise pour une boutique vide).
  operations = [];
  fautes['store_products:select'] = '42P01';
  r = await compte({ action: 'articles', boutiqueId: 'b-pro', produits: ['a'] });
  assert.equal(r.status, 503);
  assert.deepEqual(ecritures(), []);
  delete fautes['store_products:select'];
  // Produits illisibles : rien n'est écrit non plus.
  fautes['products:select'] = 'XX000';
  r = await compte({ action: 'articles', boutiqueId: 'b-pro', produits: ['a', 'b', 'c', 'd', 'n'] });
  assert.equal(r.status, 503);
  assert.deepEqual(ecritures(), []);
  delete fautes['products:select'];
  // Liste absente ou illisible : refus (avant : prise pour une liste vide, la boutique était vidée).
  for (const produits of [undefined, null, 'a,b', { 0: 'a' }, ['a', 7], ['a', ''], [['a']]]) {
    r = await compte({ action: 'articles', boutiqueId: 'b-pro', produits });
    assert.equal(r.status, 400, JSON.stringify(produits));
    assert.match((await r.json()).error, /Liste d’articles illisible/);
  }
  assert.deepEqual(ecritures(), []);
  assert.equal(JSON.stringify(etat.store_products), avant);
  // Plus de 60 : refus net (couper la liste aurait retiré des articles gardés).
  r = await compte({ action: 'articles', boutiqueId: 'b-pro', produits: ['a', 'b', 'c', 'd', ...Array.from({ length: 57 }, (_, i) => `p${i}`)] });
  assert.equal(r.status, 400);
  assert.equal((await r.json()).error, '60 articles au plus dans une boutique.');
  assert.deepEqual(ecritures(), []);
  assert.equal(JSON.stringify(etat.store_products), avant);
  // La boutique principale ne se compose pas ici (inchangé).
  assert.equal((await compte({ action: 'articles', boutiqueId: 's-awa', produits: [] })).status, 400);
  assert.equal(JSON.stringify(etat.reseller_shop_items), PRINCIPALE_INTACTE());
});

test('Un article à commission nulle est refusé dans une boutique Pro de revendeur ; un article déjà là qui ne rapporte plus rien y reste', async () => {
  baseAwa();
  let r = await compte({ action: 'articles', boutiqueId: 'b-pro', produits: ['a', 'b', 'c', 'd', 'zero', 'plancher', 'refuse', 'inconnu', 'n'] });
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { success: true, refuses: 4 });
  assert.deepEqual(Object.keys(positionsDe('b-pro')), ['a', 'b', 'c', 'd', 'n'], 'seul l’article qui rapporte est entré');
  // « b » ne rapporte plus rien : il reste dans la sélection (comme dans la boutique principale) ;
  // la vitrine ne l'affiche plus et « Mes articles » le signale.
  etat.products.find((p) => p.id === 'b').reseller_commission = 0;
  operations = [];
  r = await compte({ action: 'articles', boutiqueId: 'b-pro', produits: ['a', 'b', 'c', 'd', 'n'] });
  assert.deepEqual(await r.json(), { success: true, refuses: 0 });
  assert.deepEqual(ecritures(), []);
  const lus = await (await articles('?boutique=b-pro')).json();
  assert.equal(lus.articles.find((a) => a.id === 'b').etat, 'sans_gain');
  const { chargerProduitsDeLaBoutique } = require('../src/lib/shop.ts');
  assert.deepEqual((await chargerProduitsDeLaBoutique('b-pro', 'rev-1')).map((p) => p.id), ['a', 'c', 'd', 'n']);
});

test('Boutique supplémentaire d’un FOURNISSEUR : ses produits seulement, sans le filtre « qui rapporte » ; enregistrement sans perte là aussi', async () => {
  baseAwa();
  etat.stores.push(
    { id: 'f-main', owner_type: 'supplier', owner_id: 'fou-1', slug: 'kadi-shop', name: 'Kadi Shop', status: 'active', principale: true, created_at: '2026-01-01T00:00:00Z' },
    { id: 'f-pro', owner_type: 'supplier', owner_id: 'fou-1', slug: 'kadi-annexe', name: 'Kadi Annexe', status: 'active', principale: false, created_at: '2026-09-25T00:00:00Z' },
  );
  etat.products.push(produit('autre', { supplier_id: 'fou-2' }));
  etat.store_products.push(...dansPro('f-pro', [['a', 0], ['b', 1]]));
  sessionCourante = fournisseur('fou-1');
  const r = await compte({ action: 'articles', boutiqueId: 'f-pro', produits: ['b', 'a', 'zero', 'autre', 'refuse'] });
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { success: true, refuses: 2 });
  assert.deepEqual(positionsDe('f-pro'), { a: 0, b: 1, zero: 2 }, 'son produit à commission nulle entre ; celui d’un autre fournisseur et le refusé, non');
  // Sa vitrine : pas de filtre, ni coup de cœur ni « Nouveau » (rendu inchangé).
  const { chargerProduitsDeLaBoutique } = require('../src/lib/shop.ts');
  const servis = await chargerProduitsDeLaBoutique('f-pro');
  assert.deepEqual(servis.map((p) => p.id), ['a', 'b', 'zero']);
  assert.ok(servis.every((p) => p.coupDeCoeur === undefined && p.nouveau === undefined));
  // Son catalogue : ses produits, commission nulle comprise.
  const liste = await (await appeler('GET', '/api/compte/boutiques')).json();
  assert.deepEqual(liste.catalogue.map((p) => p.id).sort(), ['a', 'b', 'c', 'd', 'n', 'plancher', 'zero']);
  assert.equal(liste.type, 'supplier');
});

test('GET /api/compte/boutiques (revendeur) : le catalogue ne propose que des articles qui rapportent ; commission et état du prix jamais renvoyés', async () => {
  baseAwa();
  const r = await appeler('GET', '/api/compte/boutiques');
  assert.equal(r.status, 200);
  const json = await r.json();
  assert.deepEqual(json.catalogue.map((p) => p.id).sort(), ['a', 'b', 'c', 'd', 'n']);
  assert.deepEqual(Object.keys(json.catalogue[0]).sort(), ['id', 'image', 'nom', 'prix']);
  assert.doesNotMatch(JSON.stringify(json.catalogue), /reseller_commission|pricing_status|supplier/);
  assert.deepEqual(json.articles, { 'b-pro': ['a', 'b', 'c', 'd'] }, 'ses boutiques Pro seulement, dans l’ordre de leur vitrine');
  assert.deepEqual(ecritures(), []);
});

// ── 4. Vitrine d'une boutique Pro ───────────────────────────────────────────

test('chargerProduitsDeLaBoutique (revendeur) : coups de cœur en tête, « Nouveau », et jamais un article qui ne rapporte rien', async () => {
  const { chargerProduitsDeLaBoutique } = require('../src/lib/shop.ts');
  baseAwa();
  etat.store_products = dansPro('b-pro', [['a', 1], ['b', -1], ['c', 0, HIER], ['zero', -2], ['plancher', 2], ['refuse', 3]]);
  const servis = await chargerProduitsDeLaBoutique('b-pro', 'rev-1');
  assert.deepEqual(servis.map((p) => [p.id, Boolean(p.coupDeCoeur), Boolean(p.nouveau)]), [['b', true, false], ['c', false, true], ['a', false, false]]);
  assert.doesNotMatch(JSON.stringify(servis), /reseller_commission|pricing_status|"position"/);
  assert.deepEqual(await chargerProduitsDeLaBoutique('vide', 'rev-1'), []);
  assert.deepEqual(ecritures(), []);
});

const page = () => require('../src/app/boutique/[slug]/page.tsx');
const ouvrir = (slug, recherche = {}) => page().default({ params: Promise.resolve({ slug }), searchParams: Promise.resolve(recherche) });

test('/boutique/<adresse> d’une boutique Pro : mode propriétaire pour son revendeur (boutiquePro), rien pour un visiteur ; outils de la principale non proposés', async () => {
  baseAwa();
  etat.stores[1].reglages = {}; // base migrée : la tuile « Rayons » ne doit pas apparaître pour autant
  etat.store_products = dansPro('b-pro', [['a', 0], ['b', -1], ['zero', 1], ['refuse', 2]]);
  let el = await ouvrir('awa-maison');
  assert.deepEqual(el.props.proprietaire, { statut: 'active', abonnes: 2, gestion: true, boutiquePro: 'b-pro', articlesMasques: 2 });
  assert.deepEqual(el.props.boutique.produits.map((p) => [p.id, Boolean(p.coupDeCoeur)]), [['b', true], ['a', false]]);
  assert.equal(el.props.boutique.nom, 'Awa Maison');
  assert.equal(el.props.boutique.selectionVide, false, 'une boutique Pro ne montre jamais le catalogue Suguba à la place');
  assert.equal(el.props.reglages.option, false, '« Mes rayons » ne règle que la boutique principale');
  assert.equal(el.props.suiviProprietaire, null, 'Stats et premier partage : boutique principale seulement');
  assert.equal(el.props.lienModifier, null);
  assert.equal(el.props.visite, null, 'le propriétaire n’est jamais compté comme visiteur');
  // ?editer=logo ouvre le panneau du crayon, comme sur la principale.
  assert.equal((await ouvrir('awa-maison', { editer: 'logo' })).props.editer, 'logo');
  // Profil actif autre que revendeur : pas d'outils, mais toujours SA boutique (bandeau « Gérer »).
  sessionCourante = revendeur('rev-1', { role: 'customer', roles: { customer: 'active', reseller: 'active' } });
  el = await ouvrir('awa-maison', { editer: 'logo' });
  assert.deepEqual(el.props.proprietaire, { statut: 'active', abonnes: 2, gestion: false, boutiquePro: 'b-pro', articlesMasques: 2 });
  assert.equal(el.props.editer, null);
  // Autre revendeur, visiteur : aucun mode propriétaire, aucun calcul réservé.
  for (const s of [revendeur('rev-2'), null]) {
    sessionCourante = s;
    operations = [];
    el = await ouvrir('awa-maison');
    assert.equal(el.props.proprietaire, null);
    assert.equal(el.props.lienModifier, null);
    assert.deepEqual(el.props.visite, { slug: 'awa-maison', via: null });
    assert.equal(sur('store_products').length, 1, 'seule la lecture de la vitrine');
  }
  // La boutique principale garde exactement son mode propriétaire (pas de clé boutiquePro).
  sessionCourante = revendeur('rev-1');
  el = await ouvrir('awa-mode');
  assert.deepEqual(el.props.proprietaire, { statut: 'active', abonnes: 4, gestion: true });
  assert.equal(el.props.lienModifier, '/reseller/boutique');
  assert.deepEqual(ecritures(), [], 'afficher une vitrine n’écrit rien');
});

const ShopView = () => require('../src/components/shop/ShopView.tsx').default;
const vitrine = (enPlus = {}) => ({
  type: 'revendeur', nom: 'Awa Maison', enseigne: true, categorie: null, logo: null, couverture: null, description: null,
  produits: [{ id: 'p1', slug: 'robe', nom: 'Robe', categorie: 'Mode', prix: 15000, image: null, images: [], enStock: true, garantieMois: 0 }],
  livraisons: 0, selectionVide: false, code: 'AWA1', ...enPlus,
});
const rendreVitrine = (props) => renderToStaticMarkup(React.createElement(ShopView(), {
  boutique: vitrine(), urlPartage: 'https://app.sugubaml.com/boutique/awa-maison', refCode: 'AWA1',
  suivre: React.createElement('b', { 'data-marqueur': 'suivre' }), ...props,
}));
const tuiles = (html) => [...html.matchAll(/<a href="([^"]+)"[^>]*min-h-14[^>]*>[\s\S]*?<span class="truncate max-w-full">([^<]+)<\/span>/g)].map((m) => [m[2], m[1]]);

test('Vitrine d’une boutique Pro en gestion : bandeau (Articles de CETTE boutique, Mes boutiques, Outils), 3 crayons, vue client ; ni Personnaliser, ni Stats, ni « prête à X % »', () => {
  const html = rendreVitrine({ proprietaire: { statut: 'active', abonnes: 2, gestion: true, boutiquePro: 'b-pro', articlesMasques: 1 } });
  assert.match(html, /<div data-vue="gestion" class="group space-y-6">/);
  assert.deepEqual(tuiles(html), [['Articles', '/reseller/boutique/articles?boutique=b-pro'], ['Mes boutiques', '/compte/boutiques'], ['Outils', '/reseller/outils']]);
  assert.match(html, /<nav aria-label="Gérer ma boutique" class="grid grid-cols-3 gap-2">/);
  for (const absent of [/href="\/reseller\/boutique"/, /\/reseller\/boutique\/statistiques/, /\/reseller\/boutique\/rayons/, /Ma boutique est prête à/, /7 j :/]) assert.doesNotMatch(html, absent);
  for (const libelle of ['Changer la photo de couverture', 'Changer le logo', 'Modifier le nom et le mot d’accueil']) {
    assert.match(html, new RegExp(`<button type="button" aria-label="${libelle}" class="group-data-\\[vue=client\\]:hidden w-10 h-10`), libelle);
  }
  assert.match(html, /aria-label="Partager ma boutique" aria-haspopup="dialog"/);
  assert.match(html, /Voir comme un client/);
  assert.match(html, /Vue client ·[\s\S]*?Revenir/);
  // L'alerte « ne s'affiche plus » mène à « Mes articles » de CETTE boutique.
  assert.match(html, /1<\/strong> article de votre sélection ne s’affiche plus\.[\s\S]{0,200}<a href="\/reseller\/boutique\/articles\?boutique=b-pro"/);
  assert.doesNotMatch(html, /href="\/reseller\/boutique\/articles"/, 'jamais vers les articles de la principale');
  assert.doesNotMatch(html, /data-marqueur="(ancrage|visite)"/);
  assert.match(html, /data-marqueur="barre" data-actif="\/reseller\/ma-boutique"/, 'l’onglet « Boutique » reste allumé');
  // Le bandeau lui-même : aucune donnée privée, jamais « À la une ».
  const Bandeau = require('../src/components/shop/proprietaire/BandeauProprietaire.tsx').default;
  const bandeau = renderToStaticMarkup(React.createElement(Bandeau, {
    identite: { nom: 'Awa Maison', enseigne: true, accroche: null, logo: null, couverture: null }, statut: 'active',
    urlPartage: 'https://app.sugubaml.com/boutique/awa-maison', boutiquePro: 'b-pro', visites7j: 12, optionRayons: true,
  }));
  assert.deepEqual(tuiles(bandeau).map(([nom]) => nom), ['Articles', 'Mes boutiques', 'Outils'], 'même si la base permet les rayons');
  assert.doesNotMatch(bandeau, /commission|gagnez|Gains?\b|gain|prix de gros|À la une|visite/i);
  assert.equal((bandeau.match(/group-data-\[vue=client\]:hidden/g) || []).length, 2, 'barre et outils masqués en vue client');
  // Boutique Pro sans article : le propriétaire reçoit l'action, masquée en vue client.
  const vide = rendreVitrine({ boutique: vitrine({ produits: [] }), proprietaire: { statut: 'active', abonnes: 0, gestion: true, boutiquePro: 'b-pro' } });
  assert.match(vide, /<div class="[^"]*group-data-\[vue=client\]:hidden"><p[^>]*>Cette boutique n’a pas encore d’articles : vos clients la voient vide\.<\/p><a[^>]*href="\/reseller\/boutique\/articles\?boutique=b-pro"[^>]*>[\s\S]*?Choisir ses articles<\/a>/);
  assert.match(vide, /Aucun article pour le moment/);
  // La boutique principale garde ses outils (régression).
  const principaleHtml = rendreVitrine({ proprietaire: { statut: 'active', abonnes: 2, gestion: true } });
  assert.deepEqual(tuiles(principaleHtml).map(([nom]) => nom), ['Personnaliser', 'Articles', 'Stats', 'Outils']);
  assert.match(principaleHtml, /<a href="\/reseller\/boutique\/articles"/);
  assert.match(principaleHtml, /Ma boutique est prête à/);
  assert.doesNotMatch(principaleHtml, /Cette boutique n’a pas encore d’articles/);
});

test('Vitrine d’une boutique Pro sous un autre profil : un seul bandeau « C’est votre boutique · Gérer », qui ramène à ELLE ; visiteur : aucun outil', () => {
  const html = rendreVitrine({ proprietaire: { statut: 'active', abonnes: 2, gestion: false, boutiquePro: 'b-pro' } });
  assert.match(html, /<a href="\/reseller\/ma-boutique\?boutique=b-pro"[^>]*>[\s\S]*?C’est votre boutique[\s\S]*?Gérer/);
  for (const outil of [/data-vue=/, /Voir comme un client/, /Changer le logo/, /group-data-\[vue=client\]/, /inert=""/, /Mes boutiques/]) assert.doesNotMatch(html, outil);
  assert.doesNotMatch(html, /data-marqueur="ancrage"/, 'il ne devient pas son propre revendeur d’origine');
  // Boutique principale : la porte sans paramètre, comme avant.
  assert.match(rendreVitrine({ proprietaire: { statut: 'active', abonnes: 2, gestion: false } }), /<a href="\/reseller\/ma-boutique"[^>]*>[\s\S]*?C’est votre boutique/);
  const visiteur = rendreVitrine({});
  for (const outil of [/data-vue=/, /C’est votre boutique/, /Changer le logo/, /boutique=b-pro/]) assert.doesNotMatch(visiteur, outil);
});

// ── 5. Crayons d'une boutique Pro : action « modifier » de Mes boutiques ─────

test('Action « modifier » sur une boutique Pro : logo de son dossier enregistré, nom public renvoyé, son propre nom gardé en « Prénom I. » ; la principale n’est pas touchée', async () => {
  baseAwa();
  const logo = `${dossier('rev-1')}logo-pro.webp`;
  let r = await compte({ action: 'modifier', boutiqueId: 'b-pro', champs: { logo, recrute: true, whatsapp: '+22370000000' } });
  assert.equal(r.status, 200);
  let json = await r.json();
  assert.equal(json.success, true);
  assert.equal(json.boutique.logo, logo);
  assert.deepEqual(json.vitrine, { nom: 'Awa Maison', enseigne: true });
  const ecrite = ecritures();
  assert.deepEqual(ecrite.map((o) => [o.table, o.op, o.egalites.id, o.egalites.owner_id]), [['stores', 'update', 'b-pro', 'rev-1']]);
  assert.equal('is_recruiting' in ecrite[0].patch, false);
  assert.equal('whatsapp' in ecrite[0].patch, false);
  assert.equal(etat.stores[0].logo_url, null, 'la boutique principale garde son logo');
  assert.equal(etat.stores[1].logo_url, logo);
  // Nom et mot d'accueil ; son propre nom n'est pas une enseigne : « Awa D. », jamais le nom complet.
  r = await compte({ action: 'modifier', boutiqueId: 'b-pro', champs: { nom: 'Awa   Traoré Diallo', accroche: 'Tout pour la maison' } });
  json = await r.json();
  assert.equal(etat.stores[1].name, 'Awa D.');
  assert.equal(etat.stores[1].tagline, 'Tout pour la maison');
  assert.deepEqual(json.vitrine, { nom: 'Awa D.', enseigne: false });
  assert.equal(json.boutique.accroche, 'Tout pour la maison');
  assert.doesNotMatch(JSON.stringify(json), /Traoré|Diallo/);
  // Même liste blanche que la principale : image d'ailleurs, nom réservé, mot d'accueil trop long.
  operations = [];
  for (const champs of [{ logo: 'https://ailleurs.example/x.png' }, { couverture: `${dossier('rev-2')}x.webp` }, { nom: 'Suguba Officiel' }, { accroche: 'x'.repeat(91) }]) {
    assert.equal((await compte({ action: 'modifier', boutiqueId: 'b-pro', champs })).status, 400, JSON.stringify(champs));
  }
  assert.deepEqual(ecritures(), []);
  // Fournisseur : réponse inchangée ({success}), sans nom public calculé.
  etat.stores.push({ id: 'f-main', owner_type: 'supplier', owner_id: 'fou-1', slug: 'kadi-shop', name: 'Kadi Shop', status: 'active', principale: true, created_at: '2026-01-01T00:00:00Z' });
  sessionCourante = fournisseur('fou-1');
  assert.deepEqual(await (await compte({ action: 'modifier', boutiqueId: 'f-main', champs: { accroche: 'Bonjour' } })).json(), { success: true });
});

test('Source : les crayons d’une boutique Pro passent par « modifier » ; la principale garde PATCH /api/reseller/boutique', () => {
  const image = sansCommentaires(lire('src/components/shop/proprietaire/PanneauImage.tsx'));
  assert.match(image, /boutiquePro\s*\? await fetch\('\/api\/compte\/boutiques', \{\s*method: 'POST',[\s\S]*?JSON\.stringify\(\{ action: 'modifier', boutiqueId: boutiquePro, champs: \{ \[sujet\]: url \} \}\)/);
  assert.match(image, /: await fetch\('\/api\/reseller\/boutique', \{\s*method: 'PATCH',[\s\S]*?JSON\.stringify\(\{ \[sujet\]: url \}\)/);
  const nom = sansCommentaires(lire('src/components/shop/proprietaire/PanneauNomAccueil.tsx'));
  assert.match(nom, /boutiquePro\s*\? await fetch\('\/api\/compte\/boutiques', \{\s*method: 'POST',[\s\S]*?JSON\.stringify\(\{ action: 'modifier', boutiqueId: boutiquePro, champs: corps \}\)/);
  assert.match(nom, /: await fetch\('\/api\/reseller\/boutique', \{\s*method: 'PATCH',[\s\S]*?JSON\.stringify\(corps\)/);
  const entete = sansCommentaires(lire('src/components/shop/proprietaire/EnteteEditable.tsx'));
  assert.equal((entete.match(/boutiquePro=\{boutiquePro\}/g) || []).length, 3, 'les trois panneaux reçoivent la boutique visée');
  assert.match(entete, /\{!boutiquePro && prete\.pourcentage < 100 && \(/, '« prête à X % » : boutique principale seulement');
  // Le partage d'une boutique Pro ne demande jamais le lien suivi de la principale.
  const partage = sansCommentaires(lire('src/components/shop/proprietaire/PartageBoutique.tsx'));
  assert.match(partage, /if \(!slug \|\| !enLigne \|\| !suivi\) return;/);
  assert.match(sansCommentaires(lire('src/components/shop/proprietaire/BandeauProprietaire.tsx')), /suivi=\{!boutiquePro\}/);
  // Retrait d'un article d'une boutique Pro : pas d'offre annoncée comme perdue (elle n'en porte pas).
  const feuille = sansCommentaires(lire('src/components/shop/proprietaire/FeuilleArticle.tsx'));
  assert.match(feuille, /message: pro\s*\? 'Il disparaîtra de la vitrine de cette boutique\.'\s*: 'Il disparaîtra de votre vitrine\. Votre offre disparaîtra aussi de la fiche produit de cet article\.'/);
  assert.match(feuille, /<Button href=\{pro \? pro\.vitrine : PORTE_MA_BOUTIQUE\}/);
  for (const f of fichiers('src/components/shop')) assert.doesNotMatch(lire(f), /À la une/, f);
});

// ── 6. Porte « Ma boutique » et liens ───────────────────────────────────────

test('Porte /reseller/ma-boutique?boutique=<id> : ouvre SA boutique Pro ; celle d’un autre ou une inconnue mène à sa principale', async () => {
  const { GET } = require('../src/app/reseller/ma-boutique/route.ts');
  baseAwa();
  const vers = async (suite) => (await GET(requete(`/reseller/ma-boutique${suite}`))).headers.get('location');
  assert.equal(await vers('?boutique=b-pro'), 'http://localhost/boutique/awa-maison');
  assert.equal(await vers('?boutique=b-pro&editer=logo&next=//evil.example'), 'http://localhost/boutique/awa-maison?editer=logo');
  assert.equal(await vers('?boutique=b-pro&partager=1'), 'http://localhost/boutique/awa-maison?partager=1');
  for (const autre of ['x-pro', 's-mou', 'inconnue', '', 'x'.repeat(101)]) assert.equal(await vers(`?boutique=${autre}`), 'http://localhost/boutique/awa-mode', autre);
  assert.equal(await vers(''), 'http://localhost/boutique/awa-mode');
  // Le bandeau « Gérer » y passe avec un profil actif « client » : le rôle revendeur actif suffit.
  sessionCourante = revendeur('rev-1', { role: 'customer', roles: { customer: 'active', reseller: 'active' } });
  assert.equal(await vers('?boutique=b-pro'), 'http://localhost/boutique/awa-maison');
  assert.deepEqual(ecritures(), [], 'ouvrir une boutique n’écrit rien');
  sessionCourante = null;
  assert.match(await vers('?boutique=b-pro'), /\/login\?denied=reseller/);

  const P = require('../src/lib/reseau/porte-boutique.ts');
  assert.equal(P.pageMesArticles(), '/reseller/boutique/articles');
  assert.equal(P.pageMesArticles(null), '/reseller/boutique/articles');
  assert.equal(P.pageMesArticles('b pro/1'), '/reseller/boutique/articles?boutique=b%20pro%2F1');
  assert.equal(P.porteMaBoutique(), '/reseller/ma-boutique');
  assert.equal(P.porteMaBoutique('b-pro'), '/reseller/ma-boutique?boutique=b-pro');
  assert.equal(P.sansPrechargement(P.porteMaBoutique('b-pro')), true, 'la porte n’est jamais préchargée');
  assert.equal(P.PAGE_MES_BOUTIQUES, '/compte/boutiques');
});

test('Mes boutiques : « Choisir les articles » d’un revendeur mène à Mes articles ; un fournisseur garde sa liste à cocher', () => {
  const src = sansCommentaires(lire('src/app/compte/boutiques/page.tsx'));
  assert.match(src, /\) : d\.type === 'reseller' \? \(\s*<Button href=\{pageMesArticles\(b\.id\)\} variant="secondary" size="sm">\s*<ListChecks className="w-4 h-4" \/>Choisir les articles/);
  assert.match(src, /<Button variant="secondary" size="sm" onClick=\{\(\) => setSelection\(selection === b\.id \? null : b\.id\)\}>/);
  // Relecture finale (2026-10-04) : plus de « || [] » — une sélection illisible (null) n'ouvre pas la liste.
  assert.match(src, /<SelecteurArticles\s+catalogue=\{d\.catalogue\}\s+choisis=\{choisis\}\s+onEnregistrer=/);
  assert.match(src, /Logo, couverture et nom : touchez « Voir », puis les crayons de la boutique\./);
  assert.doesNotMatch(src, /target="_blank"/);
});

test('Mes prix : « Mon prix » ouvert depuis une boutique Pro revient à Mes articles de CETTE boutique', () => {
  const { default: MesPrix } = require('../src/app/reseller/prix/page.tsx');
  adresse = new URLSearchParams('produit=g1&boutiquePro=b-pro');
  assert.match(renderToStaticMarkup(React.createElement(MesPrix)), /href="\/reseller\/boutique\/articles\?boutique=b-pro"/);
  adresse = new URLSearchParams('boutique=1&produit=g1');
  assert.match(renderToStaticMarkup(React.createElement(MesPrix)), /href="\/reseller\/boutique\/articles"/);
  adresse = new URLSearchParams('');
  const feuille = sansCommentaires(lire('src/components/shop/proprietaire/FeuilleArticle.tsx'));
  assert.match(feuille, /`\/reseller\/prix\?produit=\$\{encodeURIComponent\(article\.id\)\}&boutiquePro=\$\{encodeURIComponent\(pro\.id\)\}`/);
});

// ── 7. Écrans montés : « Mes articles » d'une boutique Pro ──────────────────

// Pas de DOM dans node:test : l'écran est appelé comme une fonction, avec des
// crochets React SIMULÉS pour lui seul (état gardé entre deux appels, effets de
// montage rejoués à la main). Ses appels réseau arrivent aux VRAIES routes, sur la
// base simulée. Hors de ce montage, les mêmes fichiers gardent le vrai React.
const PAGE_ARTICLES = path.join(RACINE, 'src/app/reseller/boutique/articles/page.tsx');
const FEUILLE_SELECTION = path.join(RACINE, 'src/components/shop/proprietaire/FeuilleSelectionPro.tsx');
const FEUILLE_PARTAGE = path.join(RACINE, 'src/components/shop/proprietaire/PartageBoutique.tsx');
const MONTES = new Set([PAGE_ARTICLES, FEUILLE_SELECTION, FEUILLE_PARTAGE]);
let crochets = null;
const fauxReact = {
  ...React, __esModule: true, default: React,
  useState: (init) => (crochets ? crochets.useState(init) : React.useState(init)),
  useRef: (init) => (crochets ? crochets.useRef(init) : React.useRef(init)),
  useEffect: (f, d) => (crochets ? crochets.useEffect(f) : React.useEffect(f, d)),
  useMemo: (f, d) => (crochets ? f() : React.useMemo(f, d)),
  useCallback: (f, d) => (crochets ? f : React.useCallback(f, d)),
};
const chargerOriginal = Module._load;
Module._load = function (demande, parent, ...reste) {
  if (demande === 'react' && parent && MONTES.has(parent.filename)) return fauxReact;
  return chargerOriginal.call(this, demande, parent, ...reste);
};
/** Éléments de l'arbre rendu (enfants et emplacements `action`, `titre`), sans exécuter ses composants. */
function trouver(noeud, critere, resultats = []) {
  if (Array.isArray(noeud)) { noeud.forEach((n) => trouver(n, critere, resultats)); return resultats; }
  if (!noeud || typeof noeud !== 'object' || !noeud.props) return resultats;
  if (critere(noeud)) resultats.push(noeud);
  for (const emplacement of ['children', 'action', 'titre']) if (noeud.props[emplacement]) trouver(noeud.props[emplacement], critere, resultats);
  return resultats;
}
const texteDe = (element) => renderToStaticMarkup(element).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
function monter(appelerComposant) {
  const valeurs = []; const setters = []; const refs = []; let curseur = 0; let curseurRef = 0; let effets = [];
  const miens = {
    useState(init) {
      const k = curseur++;
      if (!(k in valeurs)) valeurs[k] = typeof init === 'function' ? init() : init;
      setters[k] ||= (v) => { valeurs[k] = typeof v === 'function' ? v(valeurs[k]) : v; };
      return [valeurs[k], setters[k]];
    },
    useRef(init) { const k = curseurRef++; refs[k] ||= { current: init }; return refs[k]; },
    useEffect(f) { effets.push(f); },
  };
  const attendre = async () => { for (let i = 0; i < 40; i++) await new Promise((r) => setImmediate(r)); };
  const rendre = () => {
    curseur = 0; curseurRef = 0; effets = [];
    crochets = miens;
    try { return appelerComposant(); } finally { crochets = null; }
  };
  const du = (arbre, nom) => trouver(arbre, (e) => typeof e.type === 'function' && e.type.name === nom);
  return {
    rendre, attendre, du,
    /** Montage : premier rendu, effets, puis l'écran après ses lectures. */
    async monter() { rendre(); effets.forEach((f) => f()); await attendre(); return rendre(); },
    boutons: (arbre, libelle) => trouver(arbre, (e) => (e.type === 'button' || (typeof e.type === 'function' && /^(Button|BoutonPartageWhatsApp)$/.test(e.type.name)))
      && (e.props['aria-label'] === libelle || texteDe(e) === libelle)),
  };
}
/** « Mes articles » : la page exportée pose la frontière Suspense ; l'écran est son enfant. */
function monterMesArticles(recherche) {
  adresse = new URLSearchParams(recherche);
  const Page = require(PAGE_ARTICLES).default;
  return monter(() => { const ecran = Page().props.children; return ecran.type(ecran.props); });
}
/** fetch du navigateur → les vraies routes, avec la session simulée. */
function brancherRoutes(appels) {
  global.fetch = async (url, init = {}) => {
    const methode = init.method || 'GET';
    appels.push([methode, String(url), init.body ?? null]);
    const fichier = ROUTES[String(url).split('?')[0]];
    if (!fichier) return { ok: false, status: 599, json: async () => ({ error: `appel inattendu : ${url}` }) };
    const r = await require(fichier)[methode](requete(String(url), { method: methode, ...(init.body ? { body: init.body } : {}) }));
    return { ok: r.status >= 200 && r.status < 300, status: r.status, json: () => r.json() };
  };
}

test('Écran « Mes articles » d’une boutique Pro : ranger 3 articles et mettre 1 coup de cœur, recharger — tout est gardé, la principale n’a pas bougé', async () => {
  const appels = [];
  brancherRoutes(appels);
  try {
    baseAwa();
    const ecran = monterMesArticles('boutique=b-pro');
    assert.equal(ecran.du(ecran.rendre(), 'Skeleton').length, 2, 'avant la lecture : chargement');
    let arbre = await ecran.monter();
    assert.deepEqual(appels, [['GET', '/api/reseller/boutique/articles?boutique=b-pro', null]]);
    assert.equal(arbre.props.titre, 'Mes articles');
    assert.equal(arbre.props.sousTitre, 'Boutique « Awa Maison » : son ordre et ses coups de cœur.');
    assert.deepEqual(arbre.props.retour, { href: '/boutique/awa-maison', libelle: 'Ma boutique' });
    assert.equal(ecran.du(arbre, 'BoutonAnnonce').length, 0, 'l’annonce aux abonnés est celle de la boutique principale');
    assert.equal(typeof ecran.du(arbre, 'BoutonAjouter')[0].props.onChoisir, 'function', 'liste à cocher, pas le catalogue');
    assert.deepEqual(ecran.du(arbre, 'FeuilleArticle')[0].props.pro, { id: 'b-pro', vitrine: '/boutique/awa-maison' });
    const partage = ecran.du(arbre, 'PartageBoutique')[0];
    assert.deepEqual(partage.props.boutique, { nom: 'Awa Maison', enseigne: true, slug: 'awa-maison', statut: 'active' });
    assert.equal(partage.props.suivi, false, 'adresse de la boutique, sans lien suivi de la principale');

    // Ranger : « d » monte de deux crans (a, d, b, c), « c » d'un cran (a, d, c, b) ; « b » devient coup de cœur.
    ecran.boutons(arbre, 'Monter Article d')[0].props.onClick();
    ecran.boutons(ecran.rendre(), 'Monter Article d')[0].props.onClick();
    ecran.boutons(ecran.rendre(), 'Monter Article c')[0].props.onClick();
    ecran.boutons(ecran.rendre(), 'Mettre Article b en coup de cœur')[0].props.onClick();
    arbre = ecran.rendre();
    let barre = ecran.du(arbre, 'BarreEnregistrement')[0];
    assert.equal(barre.props.modifie, true);
    assert.deepEqual(ecritures(), [], 'rien n’est écrit avant « Enregistrer l’ordre »');
    // « Ajouter des articles » attend l'enregistrement : la relecture perdrait le rangement.
    ecran.du(arbre, 'BoutonAjouter')[0].props.onChoisir();
    assert.equal(ecran.du(ecran.rendre(), 'FeuilleSelectionPro')[0].props.ouvert, false);
    assert.match(messages.at(-1)[0], /Enregistrez d’abord l’ordre/);

    appels.length = 0;
    await barre.props.onEnregistrer();
    assert.deepEqual(appels, [['POST', '/api/reseller/shop', JSON.stringify({ action: 'ordonner', ordre: ['b', 'a', 'd', 'c'], coupsDeCoeur: ['b'], boutique: 'b-pro' })]]);
    assert.ok(ecritures().length > 0 && ecritures().every((o) => o.table === 'store_products' && o.op === 'update' && o.egalites.store_id === 'b-pro'));
    assert.deepEqual(positionsDe('b-pro'), { b: -1, a: 0, d: 1, c: 2 });
    barre = ecran.du(ecran.rendre(), 'BarreEnregistrement')[0];
    assert.equal(barre.props.modifie, false);
    assert.equal(barre.props.message, 'Ordre enregistré : votre boutique est à jour.');

    // Recharger : l'écran relit le même ordre et le même coup de cœur.
    const recharge = monterMesArticles('boutique=b-pro');
    arbre = await recharge.monter();
    assert.equal(recharge.boutons(arbre, 'Retirer Article b des coups de cœur').length, 1);
    assert.deepEqual(trouver(arbre, (e) => e.type === 'button' && /^Monter /.test(e.props['aria-label'] || '')).map((e) => e.props['aria-label']),
      ['Monter Article b', 'Monter Article a', 'Monter Article d', 'Monter Article c']);
    // La vitrine publique sert le même ordre, coup de cœur en tête.
    const { chargerProduitsDeLaBoutique } = require('../src/lib/shop.ts');
    assert.deepEqual((await chargerProduitsDeLaBoutique('b-pro', 'rev-1')).map((p) => [p.id, Boolean(p.coupDeCoeur)]), [['b', true], ['a', false], ['d', false], ['c', false]]);

    // « Choisir les articles » puis nouvel enregistrement de la sélection : ordre et coup de cœur gardés.
    recharge.du(arbre, 'BoutonAjouter')[0].props.onChoisir();
    const feuille = recharge.du(recharge.rendre(), 'FeuilleSelectionPro')[0];
    assert.deepEqual([feuille.props.ouvert, feuille.props.boutiqueId, feuille.props.choisis], [true, 'b-pro', ['b', 'a', 'd', 'c']]);
    assert.equal((await compte({ action: 'articles', boutiqueId: 'b-pro', produits: ['a', 'b', 'c', 'd', 'n'] })).status, 200);
    assert.deepEqual(positionsDe('b-pro'), { b: -1, a: 0, d: 1, c: 2, n: 3 });

    // Retirer un article (feuille « Cet article ») : la boutique Pro seulement.
    appels.length = 0;
    operations = [];
    feuille.props.onEnregistre();
    await recharge.attendre();
    arbre = recharge.rendre();
    trouver(arbre, (e) => e.type === 'button' && e.props['aria-haspopup'] === 'dialog' && texteDe(e) === 'Article a')[0].props.onClick();
    assert.equal(await recharge.du(recharge.rendre(), 'FeuilleArticle')[0].props.onRetirer(), true);
    assert.deepEqual(appels.at(-1), ['POST', '/api/reseller/shop', JSON.stringify({ productId: 'a', action: 'retirer', boutique: 'b-pro' })]);
    assert.deepEqual(ecritures().map((o) => [o.table, o.op]), [['store_products', 'delete']]);
    assert.deepEqual(positionsDe('b-pro'), { b: -1, d: 1, c: 2, n: 3 });
    assert.equal(JSON.stringify(etat.reseller_shop_items), PRINCIPALE_INTACTE(), 'aucune offre du revendeur n’a bougé');
    assert.deepEqual(positionsDe('x-pro'), { a: 0, b: 1 });
  } finally { global.fetch = RESEAU_INTERDIT; adresse = new URLSearchParams(''); }
});

test('Écran « Mes articles » : boutique d’un autre → « Boutique introuvable » ; sans ?boutique=, la boutique principale comme avant', async () => {
  const appels = [];
  brancherRoutes(appels);
  try {
    baseAwa();
    for (const recherche of ['boutique=x-pro', 'boutique=inconnue', 'boutique=']) {
      const ecran = monterMesArticles(recherche);
      const arbre = await ecran.monter();
      const vide = ecran.du(arbre, 'EmptyState');
      assert.deepEqual([vide.length, vide[0].props.titre, vide[0].props.action.props.href], [1, 'Boutique introuvable', '/compte/boutiques'], recherche);
      assert.deepEqual(arbre.props.retour, { href: '/compte/boutiques', libelle: 'Mes boutiques' });
      assert.equal(arbre.props.action, undefined, 'pas d’« Ajouter des articles »');
      assert.equal(ecran.du(arbre, 'BarreEnregistrement').length + ecran.du(arbre, 'FeuilleSelectionPro').length + ecran.du(arbre, 'PartageBoutique').length, 0);
    }
    assert.deepEqual(ecritures(), []);

    // Boutique principale : aucune différence avec le lot 6.
    appels.length = 0;
    const ecran = monterMesArticles('');
    const arbre = await ecran.monter();
    assert.deepEqual(appels, [['GET', '/api/reseller/boutique/articles', null]]);
    assert.equal(arbre.props.sousTitre, 'Rangez votre vitrine et choisissez vos coups de cœur.');
    assert.deepEqual(arbre.props.retour, { href: '/reseller/ma-boutique', libelle: 'Ma boutique' });
    assert.equal(ecran.du(arbre, 'BoutonAnnonce').length, 1);
    assert.equal(ecran.du(arbre, 'BoutonAjouter')[0].props.onChoisir, undefined, 'le catalogue, comme avant');
    assert.equal(ecran.du(arbre, 'FeuilleSelectionPro').length, 0);
    assert.equal(ecran.du(arbre, 'FeuilleArticle')[0].props.pro, null);
    const partage = ecran.du(arbre, 'PartageBoutique')[0];
    assert.deepEqual([partage.props.boutique, partage.props.suivi], [undefined, true]);
    ecran.boutons(arbre, 'Monter Article b')[0].props.onClick();
    appels.length = 0;
    await ecran.du(ecran.rendre(), 'BarreEnregistrement')[0].props.onEnregistrer();
    assert.deepEqual(appels, [['POST', '/api/reseller/shop', JSON.stringify({ action: 'ordonner', ordre: ['a', 'b'], coupsDeCoeur: ['a'] })]], 'aucun champ `boutique` : la principale');
    assert.equal(sur('store_products').filter((o) => o.op !== 'select').length, 0);
    // ?boutique=<identifiant de SA boutique principale> (adresse tapée à la main) : la principale, sans rien de « Pro ».
    appels.length = 0;
    const parIdentifiant = monterMesArticles('boutique=s-awa');
    const arbrePrincipale = await parIdentifiant.monter();
    assert.deepEqual(appels, [['GET', '/api/reseller/boutique/articles?boutique=s-awa', null]]);
    assert.deepEqual(arbrePrincipale.props.retour, { href: '/reseller/ma-boutique', libelle: 'Ma boutique' });
    assert.equal(parIdentifiant.du(arbrePrincipale, 'BoutonAnnonce').length, 1);
    assert.equal(parIdentifiant.du(arbrePrincipale, 'BoutonAjouter')[0].props.onChoisir, undefined);
    assert.equal(parIdentifiant.du(arbrePrincipale, 'PartageBoutique')[0].props.suivi, true);
    parIdentifiant.boutons(arbrePrincipale, 'Monter Article a')[0].props.onClick();
    appels.length = 0;
    await parIdentifiant.du(parIdentifiant.rendre(), 'BarreEnregistrement')[0].props.onEnregistrer();
    assert.equal('boutique' in JSON.parse(appels[0][2]), false);
    // Rendu réel de BoutonAjouter : lien vers le catalogue, ou bouton qui ouvre la liste.
    const src = sansCommentaires(lire('src/app/reseller/boutique/articles/page.tsx'));
    assert.match(src, /\{!pro && <BoutonAnnonce rafraichir=\{articles\.length\} \/>\}/);
    assert.match(src, /<Button href=\{CATALOGUE_DEPUIS_BOUTIQUE\} size=\{taille\}>/);
    assert.match(src, /<Suspense fallback=\{<ChargementPage libelle="Ouverture de vos articles…" \/>\}><MesArticles \/><\/Suspense>/);
  } finally { global.fetch = RESEAU_INTERDIT; adresse = new URLSearchParams(''); }
});

test('Feuille « Choisir les articles » : seuls les articles qui rapportent sont proposés ; un seul envoi, sans perte ; refus annoncé', async () => {
  const appels = [];
  brancherRoutes(appels);
  try {
    baseAwa();
    const Feuille = require(FEUILLE_SELECTION).default;
    let enregistre = 0; let ferme = 0;
    const props = { ouvert: true, onFermer() { ferme++; }, boutiqueId: 'b-pro', choisis: ['a', 'b', 'c', 'd'], onEnregistre() { enregistre++; } };
    const feuille = monter(() => Feuille(props));
    assert.equal(feuille.rendre().props.pied, undefined, 'pas de bouton avant la liste');
    let arbre = await feuille.monter();
    assert.deepEqual(appels, [['GET', '/api/compte/boutiques', null]]);
    assert.equal(arbre.props.titre, 'Choisir les articles');
    const liste = feuille.du(arbre, 'SelecteurArticles')[0];
    assert.deepEqual(liste.props.catalogue.map((a) => a.id).sort(), ['a', 'b', 'c', 'd', 'n'], 'ni commission nulle, ni prix sous le plancher, ni refusé');
    assert.deepEqual(liste.props.choisis, ['a', 'b', 'c', 'd']);
    assert.equal(liste.props.onEnregistrer, undefined, 'une seule action, dans le pied de la feuille');
    assert.equal(texteDe(arbre.props.pied), 'Enregistrer 4 articles');
    // « c » décoché, « n » coché.
    liste.props.onChange(['a', 'b', 'd', 'n']);
    arbre = feuille.rendre();
    assert.equal(texteDe(arbre.props.pied), 'Enregistrer 4 articles');
    appels.length = 0;
    await arbre.props.pied.props.onClick();
    assert.deepEqual(appels, [['POST', '/api/compte/boutiques', JSON.stringify({ action: 'articles', boutiqueId: 'b-pro', produits: ['a', 'b', 'd', 'n'] })]]);
    assert.deepEqual(positionsDe('b-pro'), { a: 0, b: 1, d: 3, n: 4 });
    assert.deepEqual([enregistre, ferme], [1, 1]);
    assert.deepEqual(messages.at(-1), ['Articles enregistrés.', { ton: 'succes' }]);
    // Plus de 60 cochés : bouton inactif, avec la raison.
    liste.props.onChange(Array.from({ length: 61 }, (_, i) => `p${i}`));
    arbre = feuille.rendre();
    assert.equal(arbre.props.pied.props.disabled, true);
    assert.match(texteDe(React.createElement('div', null, arbre.props.children)), /60 articles au plus : décochez-en\./);
    // Enregistrement refusé par le serveur : message, la feuille reste ouverte.
    liste.props.onChange(['a', 'b', 'd', 'n', 'c']);
    fautes['store_products:insert'] = 'XX000';
    await feuille.rendre().props.pied.props.onClick();
    assert.match(messages.at(-1)[0], /Rien n’a changé dans cette boutique/);
    assert.deepEqual([enregistre, ferme], [1, 1]);
    delete fautes['store_products:insert'];
    // Liste illisible : un message, jamais une liste vide qui retirerait tout.
    fautes['stores:select'] = 'XX000';
    sessionCourante = null;
    const illisible = monter(() => Feuille(props));
    arbre = await illisible.monter();
    assert.equal(illisible.du(arbre, 'SelecteurArticles').length, 0);
    assert.equal(arbre.props.pied, undefined);
    assert.match(texteDe(React.createElement('div', null, arbre.props.children)), /La liste des articles n’a pas pu être lue\. Rien n’a changé dans cette boutique\./);
  } finally { global.fetch = RESEAU_INTERDIT; }
});

test('Feuille « Partager ma boutique » d’une boutique Pro : son adresse, sans appel à la route du lien suivi (celle de la principale)', async () => {
  const appels = [];
  brancherRoutes(appels);
  global.window = { location: { origin: 'https://app.test' } };
  try {
    baseAwa();
    const Partage = require(FEUILLE_PARTAGE).default;
    const boutique = { nom: 'Awa Maison', enseigne: true, slug: 'awa-maison', statut: 'active' };
    const liste = [{ id: 'a', nom: 'Article a', prix: 10000, categorie: 'Maison', coupDeCoeur: false, enStock: true }];
    const feuille = monter(() => Partage({ ouvert: true, onFermer() {}, boutique, articles: liste, suivi: false }));
    const arbre = await feuille.monter();
    assert.deepEqual(appels, [], 'aucun lien suivi demandé');
    const whatsapp = feuille.boutons(arbre.props.pied, 'Partager ma boutique sur WhatsApp')[0];
    assert.ok(decodeURIComponent(whatsapp.props.href).includes('https://app.test/boutique/awa-maison'), whatsapp.props.href);
    whatsapp.props.onPointerDown();
    await feuille.attendre();
    assert.deepEqual(appels, [], 'même au toucher');
    assert.deepEqual(ecritures(), []);
    // Boutique principale (suivi par défaut) : le lien suivi est demandé, comme avant.
    const principaleFeuille = monter(() => Partage({ ouvert: true, onFermer() {}, boutique: { nom: 'Awa Mode', enseigne: true, slug: 'awa-mode', statut: 'active' }, articles: liste }));
    await principaleFeuille.monter();
    assert.deepEqual(appels.map(([m, u]) => `${m} ${u}`), ['POST /api/reseller/boutique/partage']);
  } finally { global.fetch = RESEAU_INTERDIT; delete global.window; }
});

// ── 8. Garde-fous du source et guide ────────────────────────────────────────

test('Source : store_products n’est écrit que par la couche commune et definirArticlesDeLaBoutique ; jamais une boutique entière effacée', () => {
  const autorises = new Set(['src/lib/reseau/articles-boutique.ts', 'src/lib/reseau/boutiques-multiples.ts']);
  for (const f of fichiers('src')) {
    const src = sansCommentaires(lire(f));
    if (!src.includes('store_products') || autorises.has(f)) continue;
    assert.doesNotMatch(src, /from\('store_products'\)[\s\S]{0,80}\.(insert|update|upsert|delete)\(/, `${f} écrit dans store_products`);
  }
  const multiples = sansCommentaires(lire('src/lib/reseau/boutiques-multiples.ts'));
  assert.match(multiples, /\.delete\(\)\.eq\('store_id', params\.boutiqueId\)\.in\('product_id', retires\)/);
  assert.doesNotMatch(multiples, /\.delete\(\)\.eq\('store_id', params\.boutiqueId\);/, 'plus d’effacement de toute la sélection');
  assert.match(multiples, /const suite = positionAjout\(/);
  assert.ok(multiples.indexOf('.insert(acceptes.map') < multiples.indexOf('.delete().eq('), 'les nouveaux sont insérés AVANT toute suppression');
  const couche = sansCommentaires(lire('src/lib/reseau/articles-boutique.ts'));
  // Relecture du lot 7 : la vérification lit la boutique elle-même (lireBoutiqueDuCompte), pour distinguer une panne d'une absence.
  assert.match(couche, /lireBoutiqueDuCompte\('reseller', uid, boutiqueId\)/);
  assert.equal((couche.match(/\.delete\(\)/g) || []).length, 1, 'une seule suppression : celle d’UN article nommé');
  assert.match(couche, /\.delete\(\)\.eq\(cible\.colonne, cible\.valeur\)\.eq\('product_id', productId\)/);
  assert.doesNotMatch(couche, /\.upsert\(/);
  // La règle « qui rapporte quelque chose » est écrite une fois (lib/shop) et partagée.
  for (const f of ['src/lib/reseau/articles-boutique.ts', 'src/lib/reseau/boutiques-multiples.ts', 'src/app/api/compte/boutiques/route.ts', 'src/app/api/reseller/boutique/articles/route.ts']) {
    assert.match(sansCommentaires(lire(f)), /\bpartageable\(/, f);
  }
  assert.match(lire('src/lib/shop.ts'), /export function partageable\(p: any\): boolean/);
  // La vitrine publique ne reçoit toujours ni gain ni commission.
  for (const f of ['src/app/boutique/[slug]/page.tsx', 'src/components/shop/ShopView.tsx']) assert.doesNotMatch(lire(f), /reseller_commission|\bgains?\b/i, f);
});

test('Guide : le lot 7 au journal, juste avant la relecture du lot 6 ; les fiches « Mes articles », « Mes boutiques » et la vitrine décrivent les boutiques Pro', () => {
  const guide = JSON.parse(lire('docs/guide/guide.json'));
  assert.ok(guide.majLe >= '2026-10-03');
  // Relecture du lot 7 : son entrée passe devant celle-ci, qui n'est plus la première.
  const rang = guide.journal.findIndex((j) => j.titre === 'Boutique revendeur, lot 7 : boutiques Pro au même niveau');
  assert.ok(rang >= 0, 'entrée du lot 7');
  const entree = guide.journal[rang];
  assert.equal(guide.journal[rang + 1].titre, 'Boutique revendeur, lot 6 : corrections de relecture', 'juste avant la relecture du lot 6');
  assert.equal(entree.date, '2026-10-03');
  assert.ok(['en local', 'en ligne'].includes(entree.statut));
  assert.match(entree.demande, /^« .*Ma boutique.*doit montrer la boutique elle-même/);
  assert.ok(entree.realise.length >= 5 && entree.ecarts.length >= 3);
  for (const id of ['mes-boutiques', 'rev-boutique-articles', 'vitrine-boutique']) assert.ok(entree.pages.includes(id), id);
  const fiche = (id) => guide.pages.find((p) => p.id === id);
  assert.equal(fiche('rev-boutique-articles').chemin, '/reseller/boutique/articles');
  assert.ok(fiche('rev-boutique-articles').elements.some((e) => /boutique Pro|supplémentaire/i.test(`${e.nom} ${e.role}`) && /\?boutique=/.test(e.role)));
  assert.ok(fiche('mes-boutiques').elements.some((e) => e.nom === 'Choisir les articles' && /Mes articles/.test(e.role)));
  assert.ok(fiche('mes-boutiques').suite.some((s) => s.id === 'rev-boutique-articles'));
  assert.ok(fiche('vitrine-boutique').elements.some((e) => /Boutique supplémentaire|formule Pro/i.test(e.nom)));
  assert.doesNotMatch(JSON.stringify([entree, fiche('rev-boutique-articles'), fiche('mes-boutiques')]), /À la une/);
  assert.ok(lire('REPRISE.md').split('\n').some((l) => l.startsWith('> **') && /boutique revendeur, lot 7 « Boutiques Pro au même niveau »/.test(l)));
});
