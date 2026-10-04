// TEST-BOUTIQUE-LOT7-030..041 (chantier boutique du revendeur, 2026-10-03,
// relecture du lot 7 « Boutiques Pro au même niveau ») :
//  - FOURNISSEUR : un produit refusé ou archivé après avoir été mis dans une boutique
//    supplémentaire en sort de nouveau (il restait pour toujours, invisible dans la
//    liste à cocher, compté dans « N article(s) choisis » et dans la limite de 60) ;
//  - une lecture de `stores` en panne n'est plus « Boutique introuvable » (404) mais
//    une panne (503) : « Mes articles » propose « Réessayer » ; rien n'est écrit ;
//  - vérifier qu'une boutique est à la session = UNE lecture (avant : 1 + N) ;
//  - la vignette de la liste à cocher dit sa taille (40 px) et, sans photo, n'écrit
//    plus « Photo indisponible » dans 40 px ;
//  - le guide dit clairement ce qui déroge à la décision du fondateur (outils des
//    boutiques Pro), au lieu de le présenter comme une question ouverte.
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
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://projet.supabase.co';

// ── Base simulée : chaque opération est enregistrée avec ses filtres ─────────
let etat; let fautes; let operations; let serie;
function reinitialiser() {
  etat = {
    stores: [], profiles: [], profile_roles: [], reseller_shop_items: [], store_products: [], products: [], reseller_prices: [],
    store_plans: [], platform_settings: [], suppliers: [],
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
let adresse = new URLSearchParams('');
require.cache[require.resolve('next/navigation')] = {
  exports: { notFound: () => { throw new Error('page introuvable'); }, usePathname: () => '/', useRouter: () => ({ push() {}, replace() {}, refresh() {} }), useSearchParams: () => adresse },
};
require.cache[require.resolve('../src/lib/reseau/contexte-fournisseur.ts')] = {
  exports: { exigerDroitFournisseur: async () => ({ ok: true, contexte: { fournisseurId: 'fou-1' } }) },
};
require.cache[require.resolve('next/link')] = {
  exports: { __esModule: true, default: ({ href, prefetch, children, ...reste }) => React.createElement('a', { href, ...reste }, children) },
};
let messages = [];
require.cache[require.resolve('../src/components/ui/Toast.tsx')] = {
  exports: { __esModule: true, useToast: () => ({ toast(texte, options) { messages.push([texte, options]); }, demander: async () => null, confirmer: async () => true }) },
};
const revendeur = (uid) => ({ uid, phone: '+22300000000', role: 'reseller', status: 'active', roles: { reseller: 'active' }, iat: 1, exp: 9e9 });
const fournisseur = (uid) => ({ uid, phone: '+22300000009', role: 'supplier', status: 'active', roles: { supplier: 'active' }, iat: 1, exp: 9e9 });

const { NextRequest } = require('next/server');
const requete = (url, init = {}) => new NextRequest(`http://localhost${url}`, {
  ...init, headers: { cookie: 'suguba_session=simule', 'content-type': 'application/json', ...(init.headers || {}) },
});
const ROUTES = {
  '/api/reseller/shop': '../src/app/api/reseller/shop/route.ts',
  '/api/reseller/boutique/articles': '../src/app/api/reseller/boutique/articles/route.ts',
  '/api/compte/boutiques': '../src/app/api/compte/boutiques/route.ts',
};
const appeler = (methode, url, corps) => require(ROUTES[url.split('?')[0]])[methode](requete(url, { method: methode, ...(corps === undefined ? {} : { body: JSON.stringify(corps) }) }));
const shop = (corps) => appeler('POST', '/api/reseller/shop', corps);
const compte = (corps) => appeler('POST', '/api/compte/boutiques', corps);
const mesBoutiques = async () => (await appeler('GET', '/api/compte/boutiques')).json();
const articles = (suite = '') => appeler('GET', `/api/reseller/boutique/articles${suite}`);

// ── Données : Awa (revendeuse) et Kadi (fournisseur) ont chacune une boutique Pro ──
const IL_Y_A_UN_MOIS = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
const produit = (id, enPlus = {}) => ({
  id, slug: `slug-${id}`, name: `Article ${id}`, category: 'Maison', images: [`https://x/${id}.webp`], public_price: 10000, stock: 5,
  reseller_commission: 1000, pricing_status: 'ok', status: 'approved', supplier_id: 'fou-1', created_at: IL_Y_A_UN_MOIS, ...enPlus,
});
const dansPro = (boutique, liste) => liste.map(([id, position]) => ({ store_id: boutique, product_id: id, position, added_at: IL_Y_A_UN_MOIS }));
function base() {
  reinitialiser();
  messages = [];
  etat.profiles = [{ id: 'rev-1', full_name: 'Awa Traoré Diallo', reseller_code: 'AWA1' }, { id: 'rev-2', full_name: 'Moussa Keita', reseller_code: 'MOU1' }];
  etat.stores = [
    { id: 's-awa', owner_type: 'reseller', owner_id: 'rev-1', slug: 'awa-mode', name: 'Awa Mode', status: 'active', principale: true, created_at: '2026-01-01T00:00:00Z' },
    { id: 'b-pro', owner_type: 'reseller', owner_id: 'rev-1', slug: 'awa-maison', name: 'Awa Maison', status: 'active', principale: false, created_at: '2026-09-25T00:00:00Z' },
    { id: 'x-pro', owner_type: 'reseller', owner_id: 'rev-2', slug: 'moussa-deco', name: 'Moussa Déco', status: 'active', principale: false, created_at: '2026-09-26T00:00:00Z' },
    { id: 'f-main', owner_type: 'supplier', owner_id: 'fou-1', slug: 'kadi-shop', name: 'Kadi Shop', status: 'active', principale: true, created_at: '2026-01-01T00:00:00Z' },
    { id: 'f-pro', owner_type: 'supplier', owner_id: 'fou-1', slug: 'kadi-annexe', name: 'Kadi Annexe', status: 'active', principale: false, created_at: '2026-09-25T00:00:00Z' },
  ];
  etat.products = [produit('a'), produit('b'), produit('c'), produit('d'), produit('n'), produit('autre', { supplier_id: 'fou-2' })];
  etat.reseller_shop_items = [{ reseller_id: 'rev-1', product_id: 'a', position: -1, added_at: IL_Y_A_UN_MOIS }, { reseller_id: 'rev-1', product_id: 'b', position: 0, added_at: IL_Y_A_UN_MOIS }];
  etat.store_products = [
    ...dansPro('b-pro', [['a', -1], ['b', 0], ['c', 1], ['d', 2]]),
    ...dansPro('x-pro', [['a', 0], ['b', 1]]),
    ...dansPro('f-pro', [['a', 0], ['b', 1], ['c', 2]]),
  ];
  sessionCourante = revendeur('rev-1');
}
const positionsDe = (boutique) => Object.fromEntries(etat.store_products.filter((l) => l.store_id === boutique).map((l) => [l.product_id, l.position]));
const statut = (id, status) => { etat.products.find((p) => p.id === id).status = status; };

// ── 1. Fournisseur : un produit qui n'est plus en vente sort de sa boutique ──

test('Fournisseur : un produit refusé après coup n’est plus compté dans « articles », et le premier enregistrement le retire ; la place des autres ne change pas', async () => {
  base();
  sessionCourante = fournisseur('fou-1');
  statut('b', 'rejected');
  // La liste à cocher ne propose pas « b » ; avant, « articles » le renvoyait quand même :
  // « 3 article(s) choisis », « Enregistrer 3 article(s) », et « b » repartait à chaque envoi.
  let liste = await mesBoutiques();
  assert.equal(liste.type, 'supplier');
  assert.deepEqual(liste.catalogue.map((p) => p.id).sort(), ['a', 'c', 'd', 'n']);
  assert.deepEqual(liste.articles, { 'f-pro': ['a', 'c'] }, 'le produit refusé n’est plus compté ni renvoyé');
  assert.deepEqual(ecritures(), [], 'lire la page n’écrit rien');

  // Ce que la page envoie maintenant (ses seuls articles visibles) : « b » est retiré.
  operations = [];
  let r = await compte({ action: 'articles', boutiqueId: 'f-pro', produits: liste.articles['f-pro'] });
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { success: true, refuses: 0 });
  assert.deepEqual(ecritures().map((o) => [o.table, o.op, o.egalites.store_id, o.dans.product_id]), [['store_products', 'delete', 'f-pro', ['b']]]);
  assert.deepEqual(positionsDe('f-pro'), { a: 0, c: 2 }, 'les autres gardent leur place');

  // Une page ouverte AVANT le refus renvoie encore « b » : le serveur le retire quand même.
  base();
  sessionCourante = fournisseur('fou-1');
  statut('b', 'rejected');
  r = await compte({ action: 'articles', boutiqueId: 'f-pro', produits: ['a', 'b', 'c'] });
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { success: true, refuses: 0 }, 'un article gardé qui n’est plus en vente n’est pas un « nouveau refusé »');
  assert.deepEqual(ecritures().map((o) => [o.table, o.op, o.egalites.store_id, o.dans.product_id]), [['store_products', 'delete', 'f-pro', ['b']]],
    'une suppression ciblée : ni insertion, ni position réécrite');
  assert.deepEqual(positionsDe('f-pro'), { a: 0, c: 2 });
  assert.deepEqual(positionsDe('b-pro'), { a: -1, b: 0, c: 1, d: 2 }, 'la boutique d’un revendeur n’est pas touchée');
  assert.deepEqual(positionsDe('x-pro'), { a: 0, b: 1 });
  // Rejouer : plus rien à écrire.
  operations = [];
  assert.equal((await compte({ action: 'articles', boutiqueId: 'f-pro', produits: ['a', 'c'] })).status, 200);
  assert.deepEqual(ecritures(), []);
});

test('Fournisseur : archivé, repassé en attente de validation, ou devenu le produit d’un autre fournisseur — retiré de même, avec les décochés ; les nouveaux s’ajoutent à la suite', async () => {
  base();
  sessionCourante = fournisseur('fou-1');
  etat.store_products.push(...dansPro('f-pro', [['autre', 3], ['d', 4]]));
  statut('c', 'archived');
  // Prix modifié : le produit attend une nouvelle validation de Suguba (même règle qu'avant le lot 7).
  statut('d', 'submitted');
  assert.deepEqual((await mesBoutiques()).articles, { 'f-pro': ['a', 'b'] }, 'ni l’archivé, ni celui qui attend sa validation, ni celui d’un autre fournisseur');
  // « a » décoché, « n » coché ; « c », « d » et « autre » reviennent d'une page ancienne.
  operations = [];
  const r = await compte({ action: 'articles', boutiqueId: 'f-pro', produits: ['b', 'c', 'autre', 'd', 'n'] });
  assert.deepEqual(await r.json(), { success: true, refuses: 0 });
  assert.deepEqual(ecritures().map((o) => [o.table, o.op]), [['store_products', 'insert'], ['store_products', 'delete']], 'les nouveaux d’abord, puis les retirés');
  const [insertion, suppression] = ecritures();
  assert.deepEqual(insertion.patch, [{ store_id: 'f-pro', product_id: 'n', position: 5 }]);
  assert.deepEqual([suppression.egalites.store_id, [...suppression.dans.product_id].sort()], ['f-pro', ['a', 'autre', 'c', 'd']]);
  assert.deepEqual(positionsDe('f-pro'), { b: 1, n: 5 });
  // La validité est lue UNE fois, pour toute la liste voulue, et seulement chez ce fournisseur.
  const lectures = sur('products');
  assert.equal(lectures.length, 1);
  assert.deepEqual([lectures[0].egalites.status, lectures[0].egalites.supplier_id], ['approved', 'fou-1']);
  assert.deepEqual([...lectures[0].dans.id].sort(), ['autre', 'b', 'c', 'd', 'n']);
});

test('Fournisseur : les articles qui ne sont plus en vente ne comptent pas dans la limite de 60', async () => {
  base();
  sessionCourante = fournisseur('fou-1');
  const ids = Array.from({ length: 60 }, (_, i) => `p${i}`);
  etat.products.push(...ids.map((id) => produit(id)));
  etat.store_products = dansPro('f-pro', ids.map((id, i) => [id, i]));
  for (const id of ['p0', 'p1', 'p2']) statut(id, 'rejected');
  assert.equal((await mesBoutiques()).articles['f-pro'].length, 57, '57 articles choisis, pas 60');
  // Avant : 60 cochés au départ (dont 3 invisibles), un 61e produit → « 60 articles au plus », pour 58 affichables.
  let r = await compte({ action: 'articles', boutiqueId: 'f-pro', produits: [...ids, 'n'] });
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { success: true, refuses: 0 });
  const apres = positionsDe('f-pro');
  assert.equal(Object.keys(apres).length, 58);
  for (const id of ['p0', 'p1', 'p2']) assert.equal(id in apres, false, id);
  assert.equal(apres.n, 60, 'à la suite du dernier');
  assert.equal(apres.p59, 59, 'place gardée');

  // 61 articles réellement en vente : refus net, rien n'est écrit (jamais une liste coupée).
  base();
  sessionCourante = fournisseur('fou-1');
  etat.products.push(...ids.map((id) => produit(id)));
  etat.store_products = dansPro('f-pro', ids.map((id, i) => [id, i]));
  const avant = JSON.stringify(etat.store_products);
  r = await compte({ action: 'articles', boutiqueId: 'f-pro', produits: [...ids, 'n'] });
  assert.equal(r.status, 400);
  assert.equal((await r.json()).error, '60 articles au plus dans une boutique.');
  assert.deepEqual(ecritures(), []);
  // Liste démesurée (plus du double) : refusée sans rien lire des articles ni des produits.
  operations = [];
  r = await compte({ action: 'articles', boutiqueId: 'f-pro', produits: Array.from({ length: 121 }, (_, i) => `q${i}`) });
  assert.equal(r.status, 400);
  assert.equal(sur('store_products').length + sur('products').length, 0);
  assert.equal(JSON.stringify(etat.store_products), avant);
});

test('Fournisseur : produits illisibles — rien n’est écrit (jamais « plus rien en vente ») ; la liste renvoyée reste entière', async () => {
  base();
  sessionCourante = fournisseur('fou-1');
  statut('b', 'rejected');
  const avant = JSON.stringify(etat.store_products);
  fautes['products:select'] = 'XX000';
  const r = await compte({ action: 'articles', boutiqueId: 'f-pro', produits: ['a', 'b', 'c'] });
  assert.equal(r.status, 503);
  assert.equal((await r.json()).error, 'Enregistrement impossible. Réessayez.');
  assert.deepEqual(ecritures(), []);
  assert.equal(JSON.stringify(etat.store_products), avant);
  // Lecture de la page : un retrait n'est pas inventé quand la vérification échoue.
  assert.deepEqual((await mesBoutiques()).articles, { 'f-pro': ['a', 'b', 'c'] });
  delete fautes['products:select'];
  // Tout décocher ne demande aucune lecture de produits : la boutique est vidée, comme demandé.
  operations = [];
  assert.equal((await compte({ action: 'articles', boutiqueId: 'f-pro', produits: [] })).status, 200);
  assert.equal(sur('products').length, 0);
  assert.deepEqual(positionsDe('f-pro'), {});
});

test('Revendeur : règle inchangée — un article gardé qui n’est plus en vente reste dans sa boutique Pro (« Mes articles » le signale et permet de le retirer)', async () => {
  base();
  statut('b', 'rejected');
  const r = await compte({ action: 'articles', boutiqueId: 'b-pro', produits: ['a', 'b', 'c', 'd'] });
  assert.deepEqual(await r.json(), { success: true, refuses: 0 });
  assert.deepEqual(ecritures(), []);
  assert.deepEqual(sur('products'), [], 'aucun nouvel article : aucune lecture de produits');
  assert.deepEqual(positionsDe('b-pro'), { a: -1, b: 0, c: 1, d: 2 });
  const lus = await (await articles('?boutique=b-pro')).json();
  assert.equal(lus.articles.find((x) => x.id === 'b').etat, 'retire');
  // « articles » d'un revendeur n'est pas filtré : « Mes articles » doit pouvoir montrer cet article.
  assert.deepEqual((await mesBoutiques()).articles, { 'b-pro': ['a', 'b', 'c', 'd'] });
  // Limite stricte à 60 pour lui, comme avant.
  const trop = await compte({ action: 'articles', boutiqueId: 'b-pro', produits: Array.from({ length: 61 }, (_, i) => `p${i}`) });
  assert.equal(trop.status, 400);
});

// ── 2. Une panne de lecture n'est pas une boutique introuvable ───────────────

test('cibleArticles : `stores` illisible → BOUTIQUE_ILLISIBLE (ni null, ni la principale) ; une seule lecture, propriétaire compris', async () => {
  const { cibleArticles, BOUTIQUE_ILLISIBLE } = require('../src/lib/reseau/articles-boutique.ts');
  base();
  let c = await cibleArticles('rev-1', 'b-pro');
  assert.deepEqual([c.table, c.valeur, c.pro, c.boutique.slug], ['store_products', 'b-pro', true, 'awa-maison']);
  assert.deepEqual(sur('stores').map((o) => [o.op, o.egalites]), [['select', { id: 'b-pro', owner_type: 'reseller', owner_id: 'rev-1' }]],
    'une lecture, par l’identifiant ET le propriétaire (avant : toutes les boutiques du compte, puis chacune)');
  c = await cibleArticles('rev-1', 's-awa');
  assert.deepEqual([c.table, c.valeur, c.pro], ['reseller_shop_items', 'rev-1', false]);
  for (const autre of ['x-pro', 'f-pro', 'inconnue']) assert.equal(await cibleArticles('rev-1', autre), null, autre);

  fautes['stores:select'] = 'XX000';
  assert.equal(BOUTIQUE_ILLISIBLE, 'illisible');
  for (const id of ['b-pro', 's-awa', 'x-pro', 'inconnue']) assert.equal(await cibleArticles('rev-1', id), BOUTIQUE_ILLISIBLE, id);
  // Sans identifiant : la principale, sans aucune lecture — la panne ne la concerne pas.
  operations = [];
  c = await cibleArticles('rev-1', undefined);
  assert.deepEqual([c.table, c.valeur], ['reseller_shop_items', 'rev-1']);
  assert.deepEqual(operations, []);
  // Identifiant vide ou illisible : toujours null, sans lecture.
  for (const illisible of ['', 0, {}, 'x'.repeat(101)]) assert.equal(await cibleArticles('rev-1', illisible), null);
  assert.deepEqual(operations, []);

  const { lireBoutiqueDuCompte } = require('../src/lib/reseau/boutiques.ts');
  assert.deepEqual(await lireBoutiqueDuCompte('reseller', 'rev-1', 'b-pro'), { boutique: null, illisible: true });
  delete fautes['stores:select'];
  assert.deepEqual(await lireBoutiqueDuCompte('reseller', 'rev-1', 'x-pro'), { boutique: null, illisible: false }, 'celle d’un autre : absente, pas en panne');
  assert.deepEqual(await lireBoutiqueDuCompte('supplier', 'rev-1', 'b-pro'), { boutique: null, illisible: false }, 'le type de compte fait partie de la question');
  assert.equal((await lireBoutiqueDuCompte('reseller', 'rev-1', 'b-pro')).boutique.slug, 'awa-maison');
});

test('Routes : `stores` en panne → 503 et « Réessayez », plus « Boutique introuvable » ; rien n’est lu des articles, rien n’est écrit', async () => {
  base();
  const avant = JSON.stringify([etat.store_products, etat.reseller_shop_items, etat.stores]);
  fautes['stores:select'] = 'XX000';

  let r = await articles('?boutique=b-pro');
  assert.equal(r.status, 503);
  assert.deepEqual(await r.json(), { error: 'Vos articles sont indisponibles. Réessayez.' });

  for (const corps of [
    { action: 'ordonner', ordre: ['d', 'c', 'b', 'a'], coupsDeCoeur: ['d'] },
    { action: 'retirer', productId: 'a' },
    { action: 'ajouter', productId: 'n' },
  ]) {
    r = await shop({ ...corps, boutique: 'b-pro' });
    assert.equal(r.status, 503, corps.action);
    assert.deepEqual(await r.json(), { error: 'Votre boutique est illisible pour le moment. Réessayez.' });
  }
  for (const corps of [
    { action: 'articles', boutiqueId: 'b-pro', produits: [] },
    { action: 'modifier', boutiqueId: 'b-pro', champs: { accroche: 'Bonjour' } },
  ]) {
    r = await compte(corps);
    assert.equal(r.status, 503, corps.action);
    assert.deepEqual(await r.json(), { error: 'Vos boutiques sont indisponibles pour le moment. Réessayez.' });
  }
  // Fournisseur : même réponse.
  sessionCourante = fournisseur('fou-1');
  assert.equal((await compte({ action: 'articles', boutiqueId: 'f-pro', produits: [] })).status, 503);
  sessionCourante = revendeur('rev-1');

  assert.deepEqual(ecritures(), [], 'aucune écriture');
  assert.equal(sur('store_products').length + sur('reseller_shop_items').length + sur('products').length, 0, 'aucun article lu');
  assert.equal(JSON.stringify([etat.store_products, etat.reseller_shop_items, etat.stores]), avant, 'une liste vide envoyée pendant la panne n’a rien vidé');

  // La boutique PRINCIPALE (sans identifiant) ne lit pas `stores` : elle n'est pas concernée par cette panne.
  operations = [];
  assert.equal((await articles()).status, 200);
  assert.equal((await shop({ action: 'ordonner', ordre: ['b', 'a'], coupsDeCoeur: ['b'] })).status, 200);
  assert.equal(sur('stores').length, 0);

  // Panne passée : tout répond, et la boutique d'un autre reste « introuvable » (404), pas « en panne ».
  delete fautes['stores:select'];
  operations = [];
  r = await articles('?boutique=b-pro');
  assert.equal(r.status, 200);
  assert.equal(sur('stores').length, 1, 'une seule lecture de `stores` (avant : 3 pour un compte à 2 boutiques)');
  for (const autre of ['x-pro', 'f-pro', 'inconnue']) {
    r = await articles(`?boutique=${autre}`);
    assert.equal(r.status, 404, autre);
    assert.deepEqual(await r.json(), { error: 'Boutique introuvable.' });
    assert.equal((await shop({ action: 'retirer', productId: 'a', boutique: autre })).status, 404, autre);
    assert.equal((await compte({ action: 'articles', boutiqueId: autre, produits: [] })).status, 404, autre);
  }
  // Identifiant absent, vide ou démesuré dans « Mes boutiques » : 404 sans lecture.
  operations = [];
  for (const boutiqueId of [undefined, '', 7, 'x'.repeat(101)]) assert.equal((await compte({ action: 'articles', boutiqueId, produits: [] })).status, 404);
  assert.equal(sur('stores').length, 0);
  const [articlesAvant, , boutiquesAvant] = JSON.parse(avant);
  assert.deepEqual([etat.store_products, etat.stores], [articlesAvant, boutiquesAvant], 'aucune boutique Pro touchée, ni la sienne ni celle d’un autre');
});

// ── 3. Écran « Mes articles » : la panne se réessaie ────────────────────────

// Pas de DOM dans node:test : l'écran est appelé comme une fonction, avec des
// crochets React SIMULÉS pour lui seul (même montage que tests/ma-boutique-lot7).
const PAGE_ARTICLES = path.join(RACINE, 'src/app/reseller/boutique/articles/page.tsx');
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
  if (demande === 'react' && parent && parent.filename === PAGE_ARTICLES) return fauxReact;
  return chargerOriginal.call(this, demande, parent, ...reste);
};
function trouver(noeud, critere, resultats = []) {
  if (Array.isArray(noeud)) { noeud.forEach((n) => trouver(n, critere, resultats)); return resultats; }
  if (!noeud || typeof noeud !== 'object' || !noeud.props) return resultats;
  if (critere(noeud)) resultats.push(noeud);
  for (const emplacement of ['children', 'action', 'titre']) if (noeud.props[emplacement]) trouver(noeud.props[emplacement], critere, resultats);
  return resultats;
}
function monterMesArticles(recherche) {
  adresse = new URLSearchParams(recherche);
  const Page = require(PAGE_ARTICLES).default;
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
    try { const ecran = Page().props.children; return ecran.type(ecran.props); } finally { crochets = null; }
  };
  return {
    rendre, attendre,
    du: (arbre, nom) => trouver(arbre, (e) => typeof e.type === 'function' && e.type.name === nom),
    async monter() { rendre(); effets.forEach((f) => f()); await attendre(); return rendre(); },
  };
}

test('Écran « Mes articles » d’une boutique Pro : base en panne → « Vos articles n’ont pas pu être lus » et « Réessayer », jamais « Boutique introuvable »', async () => {
  const appels = [];
  global.fetch = async (url, init = {}) => {
    const methode = init.method || 'GET';
    appels.push([methode, String(url)]);
    const r = await require(ROUTES[String(url).split('?')[0]])[methode](requete(String(url), { method: methode, ...(init.body ? { body: init.body } : {}) }));
    return { ok: r.status >= 200 && r.status < 300, status: r.status, json: () => r.json() };
  };
  try {
    base();
    fautes['stores:select'] = 'XX000';
    const ecran = monterMesArticles('boutique=b-pro');
    let arbre = await ecran.monter();
    assert.deepEqual(appels, [['GET', '/api/reseller/boutique/articles?boutique=b-pro']]);
    const etats = ecran.du(arbre, 'EmptyState');
    assert.equal(etats.length, 1);
    assert.equal(etats[0].props.titre, 'Vos articles n’ont pas pu être lus');
    assert.equal(etats[0].props.erreur, true);
    assert.equal(typeof etats[0].props.onReessayer, 'function', '« Réessayer » est proposé');
    assert.notEqual(etats[0].props.titre, 'Boutique introuvable');
    assert.equal(ecran.du(arbre, 'BarreEnregistrement').length, 0);
    assert.equal(arbre.props.action, undefined, 'pas d’« Ajouter des articles » sur un écran en panne');

    // La base répond de nouveau : « Réessayer » ouvre la boutique, sans recharger la page.
    delete fautes['stores:select'];
    etats[0].props.onReessayer();
    await ecran.attendre();
    arbre = ecran.rendre();
    assert.equal(ecran.du(arbre, 'EmptyState').length, 0);
    assert.equal(arbre.props.sousTitre, 'Boutique « Awa Maison » : son ordre et ses coups de cœur.');
    assert.equal(ecran.du(arbre, 'BarreEnregistrement').length, 1);
    assert.deepEqual(ecritures(), [], 'lire n’écrit rien');

    // Boutique d'un autre : toujours « Boutique introuvable », sans « Réessayer ».
    const autre = monterMesArticles('boutique=x-pro');
    arbre = await autre.monter();
    const vide = autre.du(arbre, 'EmptyState');
    assert.deepEqual([vide[0].props.titre, vide[0].props.onReessayer], ['Boutique introuvable', undefined]);
  } finally { global.fetch = RESEAU_INTERDIT; adresse = new URLSearchParams(''); }
});

// ── 4. Liste à cocher : une vignette de 40 px ne télécharge pas une photo d'écran ──

test('SelecteurArticles : la vignette dit sa taille (sizes="40px") ; sans photo, l’icône seule — jamais « Photo indisponible » dans 40 px', () => {
  const SelecteurArticles = require('../src/components/reseau/SelecteurArticles.tsx').default;
  const catalogue = [
    { id: 'p1', nom: 'Pagne wax', image: '/photos/p1.webp', prix: 12500 },
    { id: 'p2', nom: 'Bazin', image: null, prix: 9000 },
  ];
  // Rendu RÉEL de next/image (aucune simulation de ProductImage dans ce fichier).
  const html = renderToStaticMarkup(React.createElement(SelecteurArticles, { catalogue, choisis: [], onChange() {}, listeClassName: '' }));
  const image = html.match(/<img [^>]*>/)[0];
  assert.match(image, / sizes="40px"/);
  assert.doesNotMatch(image, /sizes="100vw"/, 'sans `sizes`, une image en `fill` est supposée large comme l’écran');
  const largeurs = [...image.match(/srcSet="([^"]*)"/)[1].matchAll(/ (\d+)w/g)].map((m) => Number(m[1]));
  assert.ok(largeurs.includes(48) && largeurs.includes(96), 'des variantes à la taille de la vignette (×1 à ×3) sont proposées');
  assert.ok(Math.min(...largeurs) < 640, 'avant : la plus petite variante proposée faisait 640 px');
  assert.match(html, /<span class="relative w-10 h-10 rounded-xl overflow-hidden bg-slate-100 shrink-0"><img /);
  // Sans photo : icône de 20 px, sans texte (le libellé reste lu par les lecteurs d'écran).
  const repli = html.match(/<div class="[^"]*" role="img" aria-label="Photo indisponible">[\s\S]*?<\/div>/)[0];
  assert.match(repli, /lucide-image-off w-5 h-5/);
  assert.doesNotMatch(repli, /w-8 h-8/);
  assert.doesNotMatch(repli, />Photo indisponible</, 'le texte ne tient pas dans 40 px');
  // Les trois écrans qui cochent des articles passent par ce composant.
  const src = sansCommentaires(lire('src/components/reseau/SelecteurArticles.tsx'));
  assert.match(src, /<ProductImage src=\{a\.image \|\| ''\} alt="" fill sizes="40px" className="object-cover" compact \/>/);
  for (const f of ['src/components/shop/proprietaire/FeuilleSelectionPro.tsx', 'src/components/shop/proprietaire/FeuilleRayon.tsx', 'src/app/compte/boutiques/page.tsx']) {
    assert.match(sansCommentaires(lire(f)), /<SelecteurArticles\s/, f);
  }
});

// ── 5. Source, guide et reprise ─────────────────────────────────────────────

test('Source : la vérification d’une boutique ne relit plus toutes les boutiques du compte ; le fournisseur est revalidé, le revendeur non', () => {
  const multiples = sansCommentaires(lire('src/lib/reseau/boutiques-multiples.ts'));
  assert.match(multiples, /export async function boutiqueDuCompte\([^)]*\): Promise<BoutiqueReseau \| null> \{\s*return \(await lireBoutiqueDuCompte\(type, proprietaireId, boutiqueId\)\)\.boutique;\s*\}/);
  assert.match(multiples, /if \(fournisseur\) \{[\s\S]*?produitsEnVenteDuFournisseur\(params\.proprietaireId, voulus\)[\s\S]*?retires\.push\(\.\.\.horsVente\);[\s\S]*?\} else if \(nouveaux\.length\) \{/);
  assert.match(multiples, /\.in\('id', ids\)\.eq\('status', 'approved'\)\.eq\('supplier_id', fournisseurId\)/);
  // Les routes qui répondraient « introuvable » distinguent la panne.
  const couche = sansCommentaires(lire('src/lib/reseau/articles-boutique.ts'));
  assert.match(couche, /const \{ boutique, illisible \} = await lireBoutiqueDuCompte\('reseller', uid, boutiqueId\);\s*if \(illisible\) return BOUTIQUE_ILLISIBLE;\s*if \(!boutique\) return null;/);
  assert.doesNotMatch(couche, /boutiques-multiples/, 'la couche commune ne dépend plus de la liste des boutiques');
  for (const f of ['src/app/api/reseller/shop/route.ts', 'src/app/api/reseller/boutique/articles/route.ts']) {
    assert.match(sansCommentaires(lire(f)), /if \(cible === BOUTIQUE_ILLISIBLE\) return NextResponse\.json\(\{ error: '[^']+Réessayez\.' \}, \{ status: 503 \}\);\s*if \(!cible\) return NextResponse\.json\(\{ error: 'Boutique introuvable\.' \}, \{ status: 404 \}\);/, f);
  }
  const route = sansCommentaires(lire('src/app/api/compte/boutiques/route.ts'));
  assert.match(route, /if \(lue\.illisible\) return NextResponse\.json\(\{ error: '[^']+Réessayez\.' \}, \{ status: 503 \}\);/);
  assert.doesNotMatch(route, /\bboutiqueDuCompte\(/);
  // L'écran garde son état d'erreur avec « Réessayer » pour tout ce qui n'est pas un 404.
  const page = sansCommentaires(lire('src/app/reseller/boutique/articles/page.tsx'));
  assert.match(page, /if \(r\.status === 404\) \{ setIntrouvable\(true\); return; \}/);
  assert.match(page, /<EmptyState erreur titre="Vos articles n’ont pas pu être lus"[^>]*onReessayer=\{charger\} \/>/);
});

test('Guide : relecture du lot 7 en tête, juste avant le lot 7 ; l’écart sur les outils des boutiques Pro n’est plus une question ouverte ; REPRISE', () => {
  const guide = JSON.parse(lire('docs/guide/guide.json'));
  assert.ok(guide.majLe >= '2026-10-03');
  const rang = guide.journal.findIndex((j) => j.titre === 'Boutique revendeur, lot 7 : corrections de relecture');
  assert.ok(rang >= 0, 'entrée de relecture');
  const relecture = guide.journal[rang];
  assert.equal(guide.journal[rang + 1].titre, 'Boutique revendeur, lot 7 : boutiques Pro au même niveau');
  assert.equal(relecture.date, '2026-10-03');
  assert.ok(['en local', 'en ligne'].includes(relecture.statut));
  assert.match(relecture.demande, /^« “Ma boutique” doit montrer la boutique elle-même/);
  assert.ok(relecture.realise.length >= 4);
  for (const id of ['mes-boutiques', 'rev-boutique-articles', 'vitrine-boutique']) assert.ok(relecture.pages.includes(id), id);
  for (const id of relecture.pages) assert.ok(guide.pages.some((p) => p.id === id), id);

  // La décision est prise : l'écart la cite, et dit ce qui reste à livrer.
  const ecarts = relecture.ecarts.join('\n');
  assert.match(ecarts, /ÉCART AVEC VOTRE DÉCISION/);
  assert.match(ecarts, /s’appliquent aussi à chaque boutique Pro/);
  for (const outil of ['Personnaliser', 'Statistiques', 'Mes rayons', 'annonce datée', 'Prévenir mes abonnés', 'lien suivi']) assert.ok(ecarts.includes(outil), outil);
  const lot7 = guide.journal[rang + 1];
  const ecartsLot7 = lot7.ecarts.join('\n');
  assert.doesNotMatch(ecartsLot7, /À décider : les ouvrir aussi aux boutiques Pro/);
  assert.match(ecartsLot7, /ÉCART AVEC VOTRE DÉCISION/);
  // Les lots 5 et 6 ne promettent plus ces outils « au lot 7 » sans dire qu'ils n'y sont pas.
  for (const titre of ['Boutique revendeur, lot 6 : rayons personnalisés et annonce datée', 'Boutique revendeur, lot 5 : prévenir mes abonnés']) {
    const entree = guide.journal.find((j) => j.titre === titre);
    for (const ecart of entree.ecarts.filter((e) => /lot 7/.test(e))) assert.match(ecart, /pas encore|n’a pas/, `${titre} : ${ecart}`);
  }

  const fiche = (id) => JSON.stringify(guide.pages.find((p) => p.id === id));
  assert.match(fiche('mes-boutiques'), /plus en vente/);
  assert.match(fiche('rev-boutique-articles'), /Réessayer/);
  assert.match(fiche('vitrine-boutique'), /Pas encore de Personnaliser, de Stats, de Rayons/);
  assert.doesNotMatch(JSON.stringify(relecture) + fiche('mes-boutiques') + fiche('rev-boutique-articles'), /À la une/);
  assert.ok(lire('REPRISE.md').split('\n').some((l) => l.startsWith('> **') && /boutique revendeur, lot 7 : corrections de relecture/.test(l)));
});
