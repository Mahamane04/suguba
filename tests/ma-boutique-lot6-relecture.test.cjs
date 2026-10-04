// TEST-BOUTIQUE-LOT6-040..052 (chantier boutique du revendeur, 2026-10-03,
// relecture du lot 6 « Rayons personnalisés et annonce datée ») :
//  - un nom de rayon ou une annonce démesurés sont refusés AVANT d'être nettoyés
//    (80 000 « < » occupaient le serveur plus de 3 secondes) ;
//  - le nom d'un rayon refuse un prix d'un seul tenant (« Tout à 5000 ») ;
//  - « ni numéro ni lien » reconnaît un lien tapé sans « http », une adresse e-mail
//    et un numéro séparé par « / », « _ » ou « , » ;
//  - deux rayons aux noms différents en arabe, en n'ko ou en bambara ont deux clés ;
//  - « Partager » un rayon ne crée plus d'abord un lien de toute la boutique ;
//  - la barre de « Mes rayons » dit « Enregistrer » (place pour « Non enregistré »
//    à 390 px) ; la précision d'un article à cocher n'est plus coupée.
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

// ── Base simulée : chaque opération est enregistrée ─────────────────────────
let etat; let operations; let serie;
function reinitialiser() {
  etat = {
    stores: [], profiles: [], profile_roles: [], reseller_shop_items: [], products: [], reseller_prices: [],
    tracking_links: [], analytics_events: [], orders: [], store_follows: [], suppliers: [],
  };
  operations = []; serie = 1;
}
const db = {
  from(table) {
    let op = 'select'; let patch; const filtres = []; let un = false; let tete = false; let limite = null; let tri = null;
    const q = {
      select(_colonnes, options) { if (options && options.head) tete = true; return q; },
      eq(k, v) { filtres.push((r) => r[k] === v); return q; },
      neq(k, v) { filtres.push((r) => r[k] !== v); return q; },
      gt(k, v) { filtres.push((r) => String(r[k]) > String(v)); return q; },
      gte(k, v) { filtres.push((r) => String(r[k]) >= String(v)); return q; },
      in(k, v) { filtres.push((r) => v.includes(r[k])); return q; },
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
        operations.push({ table, op, patch });
        const repondre = (r) => Promise.resolve(r).then(resolve, reject);
        let lignes = (etat[table] || []).filter((r) => filtres.every((f) => f(r)));
        if (tri) lignes = [...lignes].sort((a, b) => (String(a[tri.k]) < String(b[tri.k]) ? -1 : String(a[tri.k]) > String(b[tri.k]) ? 1 : 0) * (tri.asc ? 1 : -1));
        if (op === 'insert') {
          const maintenant = new Date().toISOString();
          lignes = (Array.isArray(patch) ? patch : [patch]).map((p) => ({ id: `n${serie++}`, created_at: maintenant, occurred_at: maintenant, ...p }));
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
require.cache[require.resolve('../src/lib/supabase-admin.ts')] = { exports: { getSupabaseAdmin: () => db } };

let sessionCourante = null;
require.cache[require.resolve('../src/lib/active-session.ts')] = { exports: { verifyActiveSession: async () => sessionCourante } };
const vraieSession = require('../src/lib/session.ts');
require.cache[require.resolve('../src/lib/session.ts')] = { exports: { ...vraieSession, verifySessionToken: async () => sessionCourante } };
require.cache[require.resolve('next/headers')] = {
  exports: { cookies: async () => ({ get: (nom) => (nom === vraieSession.SESSION_COOKIE_NAME ? { value: 'jeton-simule' } : undefined) }) },
};
const revendeur = (uid) => ({ uid, phone: '+22300000000', role: 'reseller', status: 'active', roles: { reseller: 'active' }, iat: 1, exp: 9e9 });

// ── Composants simulés ──────────────────────────────────────────────────────
require.cache[require.resolve('../src/components/common/ProductImage.tsx')] = {
  exports: { __esModule: true, default: ({ src }) => React.createElement('i', { 'data-image': src }) },
};
require.cache[require.resolve('next/link')] = {
  exports: { __esModule: true, default: ({ href, prefetch, children, ...reste }) => React.createElement('a', { href, ...reste }, children) },
};
// Le QR n'est jamais affiché ici : un simple repère.
require.cache[require.resolve('next/dynamic')] = { exports: { __esModule: true, default: () => () => React.createElement('i', { 'data-qr': '' }) } };
require.cache[require.resolve('../src/components/ui/Toast.tsx')] = {
  exports: { __esModule: true, useToast: () => ({ toast() {}, demander: async () => null, confirmer: async () => true }) },
};

const { NextRequest } = require('next/server');
const requete = (url, init = {}) => new NextRequest(`http://localhost${url}`, {
  ...init, headers: { cookie: 'suguba_session=simule', 'content-type': 'application/json', ...(init.headers || {}) },
});
const ROUTE = '../src/app/api/reseller/boutique/route.ts';
const patcher = (corps) => require(ROUTE).PATCH(requete('/api/reseller/boutique', { method: 'PATCH', body: JSON.stringify(corps) }));

const produit = (id, enPlus = {}) => ({
  id, slug: `slug-${id}`, name: `Article ${id}`, category: 'Mode', images: [], public_price: 10000, stock: 5,
  reseller_commission: 1000, pricing_status: 'ok', status: 'approved', ...enPlus,
});
const JOUR = 24 * 3600 * 1000;
const jour = (decalage = 0) => new Date(Date.now() + decalage * JOUR).toISOString().slice(0, 10);

/** Awa (rev-1) : boutique « Awa Mode », base MIGRÉE (colonne stores.reglages), 5 articles (3 pagnes, 2 de cuisine). */
function baseAwa(reglages = {}) {
  reinitialiser();
  etat.profiles = [{ id: 'rev-1', full_name: 'Awa Traoré Diallo', reseller_code: 'AWA1', metadata: {} }];
  etat.profile_roles = [{ profile_id: 'rev-1', role: 'reseller', status: 'active' }];
  etat.stores = [{
    id: 's1', owner_type: 'reseller', owner_id: 'rev-1', slug: 'awa-mode', name: 'Awa Mode', tagline: 'Pagnes et bazins', status: 'active',
    followers_count: 0, created_at: '2026-09-01T00:00:00Z', reglages: JSON.parse(JSON.stringify(reglages)),
  }];
  etat.products = [
    produit('p1', { name: 'Pagne wax', category: 'Tissus' }), produit('p2', { name: 'Bazin riche', category: 'Tissus' }),
    produit('p3', { name: 'Pagne tissé', category: 'Mode' }), produit('c1', { name: 'Théière', category: 'Cuisine' }),
    produit('c2', { name: 'Bol', category: 'Cuisine' }),
  ];
  etat.reseller_shop_items = ['c1', 'p1', 'p2', 'c2', 'p3'].map((id, i) => ({ reseller_id: 'rev-1', product_id: id, position: i, added_at: '2026-09-10T00:00:00Z' }));
  sessionCourante = revendeur('rev-1');
}
const reglagesDe = () => etat.stores[0].reglages;

/** Durée d'un appel, en millisecondes. */
const chrono = async (f) => { const debut = process.hrtime.bigint(); const resultat = await f(); return [resultat, Number(process.hrtime.bigint() - debut) / 1e6]; };
// Seuil large : la suite tourne en parallèle sur une machine chargée. Avant la
// correction, 80 000 « < » prenaient déjà 2,8 s, et 300 000 près de 40 s.
const VITE = 1000;

// ── 1. Un texte démesuré n'occupe plus le serveur ───────────────────────────

test('Règles pures : 300 000 « < » dans un nom de rayon ou une annonce sont refusés tout de suite, sans être nettoyés', async () => {
  const R = require('../src/lib/boutique-reglages.ts');
  assert.equal(R.TEXTE_BRUT_MAX, 200);
  const T = Date.parse('2026-10-03T12:00:00Z');
  const NOM = 'Le nom d’un rayon fait 24 caractères au plus.';
  for (const hostile of ['<'.repeat(300000), '<a'.repeat(150000), `<${'a'.repeat(300000)}`, ' '.repeat(300000), '\uD83D'.repeat(300000), `Pagnes${'<b>'.repeat(100000)}`]) {
    const etiquette = JSON.stringify(hostile.slice(0, 8));
    let [r, ms] = await chrono(() => R.normaliserReglages({ rayons: [{ nom: hostile, ids: [] }] }, { selection: [] }));
    assert.deepEqual(r, { ok: false, erreur: NOM }, etiquette);
    assert.ok(ms < VITE, `rayon ${etiquette} : ${ms} ms`);
    [r, ms] = await chrono(() => R.normaliserReglages({ annonce: { texte: hostile, fin: '2026-10-10' } }, { maintenant: T }));
    assert.deepEqual(r, { ok: false, erreur: '90 caractères au plus.' }, `${etiquette} : avant, pris pour « pas d’annonce » et accepté`);
    assert.ok(ms < VITE, `annonce ${etiquette} : ${ms} ms`);
    // Les règles des écrans, appelées seules, répondent aussi vite.
    [r, ms] = await chrono(() => [R.refusNomRayon(hostile), R.refusAnnonce(hostile), R.refusRayon([], null, hostile), R.poserRayon([], null, { nom: hostile, ids: [] }).length]);
    assert.deepEqual(r, [NOM, '90 caractères au plus.', NOM, 1], etiquette);
    assert.ok(ms < VITE, `écran ${etiquette} : ${ms} ms`);
  }
  // La limite brute est large : 200 caractères avec balises et espaces passent, 201 non.
  const large = `<b>Pagnes</b>${' '.repeat(187)}`;
  assert.equal(large.length, 200);
  assert.deepEqual(R.normaliserReglages({ rayons: [{ nom: large, ids: [] }] }, { selection: [] }).reglages.rayons, [{ cle: 'pagnes', nom: 'Pagnes', ids: [] }]);
  assert.deepEqual(R.normaliserReglages({ rayons: [{ nom: `${large} `, ids: [] }] }, { selection: [] }), { ok: false, erreur: NOM });
  assert.deepEqual(R.normaliserReglages({ annonce: { texte: `<i>Bonjour</i>${' '.repeat(186)}`, fin: '2026-10-10' } }, { maintenant: T }).reglages.annonce, { texte: 'Bonjour', fin: '2026-10-10' });
  assert.equal(R.normaliserReglages({ annonce: { texte: `<i>Bonjour</i>${' '.repeat(187)}`, fin: '2026-10-10' } }, { maintenant: T }).ok, false);
  // Les limites réelles n'ont pas bougé.
  assert.equal(R.normaliserReglages({ rayons: [{ nom: 'x'.repeat(24), ids: [] }] }, { selection: [] }).ok, true);
  assert.equal(R.normaliserReglages({ rayons: [{ nom: 'x'.repeat(25), ids: [] }] }, { selection: [] }).erreur, NOM);
  assert.equal(R.normaliserReglages({ annonce: { texte: 'x'.repeat(90), fin: '2026-10-10' } }, { maintenant: T }).ok, true);
  assert.equal(R.normaliserReglages({ annonce: { texte: 'x'.repeat(91), fin: '2026-10-10' } }, { maintenant: T }).erreur, '90 caractères au plus.');
  // Une balise ouverte dans une autre : le texte autour est gardé, jamais un « < » affiché.
  assert.equal(R.normaliserReglages({ rayons: [{ nom: 'Pagnes < bazins <b>wax</b>', ids: [] }] }, { selection: [] }).reglages.rayons[0].nom, 'Pagnes bazins wax');
  // La recherche de balise ne relit plus toute la suite à chaque « < ».
  const source = sansCommentaires(lire('src/lib/boutique-reglages.ts'));
  assert.ok(!source.includes('/<[^>]*>/g'), 'ancienne expression quadratique retirée');
  assert.ok(source.includes('brut.slice(0, TEXTE_BRUT_MAX)'), 'coupé avant le premier remplacement');
  assert.ok(source.indexOf('brut.slice(0, TEXTE_BRUT_MAX)') < source.indexOf('.replace(/<[^<>]*>/g'), 'la coupe précède le nettoyage');
});

test('PATCH /api/reseller/boutique : 80 000 « < » dans un nom de rayon ou dans l’annonce → 400 sans attendre, rien d’écrit', async () => {
  const avant = { rayons: [{ cle: 'pagnes', nom: 'Pagnes', ids: ['p1'] }], annonce: { texte: 'Bonjour', fin: jour(3) } };
  baseAwa(avant);
  // Témoin (et chargement de la route) : un enregistrement ordinaire passe.
  assert.equal((await patcher({ reglages: { annonce: { texte: 'Nouveaux pagnes', fin: jour(3) } } })).status, 200);
  const enregistre = JSON.stringify(reglagesDe());
  const hostile = '<'.repeat(80000);
  for (const [reglages, message] of [
    [{ rayons: [{ nom: hostile, ids: [] }] }, 'Le nom d’un rayon fait 24 caractères au plus.'],
    [{ annonce: { texte: hostile, fin: jour(3) } }, '90 caractères au plus.'],
    [{ rayons: [{ nom: 'Fête', ids: ['c1'] }], annonce: { texte: hostile, fin: jour(3) } }, '90 caractères au plus.'],
  ]) {
    operations = [];
    const [reponse, ms] = await chrono(() => patcher({ accroche: 'Refusé avec', reglages }));
    assert.equal(reponse.status, 400, Object.keys(reglages).join('+'));
    assert.deepEqual(await reponse.json(), { error: message });
    assert.ok(ms < VITE, `${Object.keys(reglages).join('+')} : ${ms} ms (avant : plus de 3 000 ms)`);
    assert.deepEqual(ecritures(), [], 'rien n’est écrit');
  }
  assert.equal(JSON.stringify(reglagesDe()), enregistre, 'rayons et annonce intacts');
  assert.equal(etat.stores[0].tagline, 'Pagnes et bazins');
});

test('Lecture tolérante : un contenu démesuré en base est coupé avant d’être nettoyé — jamais d’erreur, jamais d’attente', async () => {
  const R = require('../src/lib/boutique-reglages.ts');
  const [lus, ms] = await chrono(() => R.lireReglages({
    rayons: [
      { nom: '<'.repeat(300000), ids: ['p1'] },
      { nom: `Pagnes du grand marché de Bamako${'x'.repeat(300000)}`, ids: ['p2'] },
      { nom: 'Fête', ids: ['p3'] },
    ],
    annonce: { texte: `Bonjour ${'<b>'.repeat(100000)}`, fin: '2026-10-10' },
  }));
  assert.ok(ms < VITE, `${ms} ms`);
  assert.deepEqual(lus.rayons.map((r) => [r.nom, r.ids]), [['Pagnes du grand marché d', ['p2']], ['Fête', ['p3']]], 'nom illisible ignoré, nom trop long coupé à 24');
  assert.deepEqual(lus.annonce, { texte: 'Bonjour', fin: '2026-10-10' }, 'ce qui reste lisible est gardé');
  // Annonce coupée à la borne brute, puis refusée par sa vraie limite (90) : pas affichée.
  const [longue, ms2] = await chrono(() => R.lireReglages({ annonce: { texte: `Bonjour ${'x'.repeat(300000)}`, fin: '2026-10-10' } }));
  assert.ok(ms2 < VITE, `${ms2} ms`);
  assert.equal(longue.annonce, null);
});

// ── 2. Nom d'un rayon : ni prix, ni lien ────────────────────────────────────

test('Nom d’un rayon : un prix écrit d’un seul tenant est refusé (« Tout à 5000 »), comme dans l’annonce ; une année reste permise', async () => {
  const R = require('../src/lib/boutique-reglages.ts');
  const PRIX = 'Pas de prix ni de remise dans le nom d’un rayon.';
  const ecrire = (nom) => R.normaliserReglages({ rayons: [{ nom, ids: [] }] }, { selection: [] });
  for (const nom of ['Tout à 5000', 'Pagnes à 2500', 'Prix 1000', 'Tout à 500', 'Tout à 2000', 'Tout à 5 000', 'Tout à 5000 F', 'Promo -20 %', 'Soldes 50']) {
    assert.deepEqual(ecrire(nom), { ok: false, erreur: PRIX }, nom);
    assert.equal(R.refusNomRayon(nom), PRIX, nom);
    assert.notEqual(R.refusAnnonce(nom), null, `${nom} : refusé aussi dans l’annonce`);
  }
  for (const nom of ['Pagnes 2026', 'Bazin 2027', 'Taille 44', 'Lot de 12', 'Télé 4K', 'Pagnes', 'Pour la fête']) {
    assert.equal(ecrire(nom).ok, true, nom);
  }
  // À l'écran (feuille « Nouveau rayon ») : la raison sous le champ.
  assert.equal(R.refusRayon([], null, 'Tout à 5000'), PRIX);
  // En base (ligne modifiée à la main) : un tel nom n'est pas affiché.
  assert.deepEqual(R.lireReglages({ rayons: [{ nom: 'Tout à 5000', ids: ['p1'] }, { nom: 'Pagnes 2026', ids: ['p1'] }] }).rayons.map((r) => r.nom), ['Pagnes 2026']);
  // Par la route : 400, rien d'écrit.
  baseAwa();
  const refus = await patcher({ reglages: { rayons: [{ nom: 'Pagnes à 2500', ids: ['p1'] }] } });
  assert.equal(refus.status, 400);
  assert.deepEqual(await refus.json(), { error: PRIX });
  assert.deepEqual(ecritures(), []);
});

test('Ni numéro ni lien : un lien tapé sans « http », une adresse e-mail et un numéro séparé par « / », « _ » ou « , » sont refusés', () => {
  const R = require('../src/lib/boutique-reglages.ts');
  const ANNONCE = 'Pas de numéro de téléphone ni de lien : la commande se passe sur Suguba.';
  const RAYON = 'Pas de numéro de téléphone ni de lien dans le nom d’un rayon.';
  for (const texte of [
    // Constat de relecture : tous acceptés avant.
    'Commandez sur wa.link/ab12cd', 'Ma page : facebook.com/awamode', 'tiktok.com/@awamode', 'bit.ly/awa', 'Écrivez-moi : awa@gmail.com',
    'Appelez le 76/12/34/56', 'Tel 76_12_34_56',
    // Mêmes familles.
    'Tel 76,12,34,56', 'linktr.ee/awa', 'Voir awamode.shop', 'awa@yahoo.de', 'awa.exemple.de/boutique', 't.me/awa', 'youtu.be/abc', 'WWW.AWA.ML', 'snapchat.com',
    // Déjà refusés au lot 6 : toujours refusés.
    'WhatsApp 76 12 34 56', 'Appelez le 76123456', '+223 76-12-34-56', 'Écrivez sur wa.me/abc', 'https://exemple.ml', 'www.exemple',
  ]) {
    assert.equal(R.refusAnnonce(texte), ANNONCE, texte);
  }
  for (const nom of ['wa.link/ab12cd', 'facebook.com/awa', 'bit.ly/awa', 'awa@gmail.com', '76/12/34/56', 'Tel 76_12_34_56', 'Appel 76 12 34 56', 'wa.me/22376']) {
    assert.equal(R.refusNomRayon(nom), RAYON, nom);
  }
  // Ce qui n'est ni un numéro ni un lien reste permis : une date, une liste, une phrase sans espace après le point.
  for (const texte of [
    'Arrivage le 10/10/2026', 'Fermé du 10/10 au 12/10', 'Livraison le 05/11', 'Tailles 38, 40, 42, 44', 'Ouvert 7j/7', 'Ouvert de 8 h à 18 h',
    'Bonjour.Merci de votre visite', 'Merci.Me voici de retour', 'Arrivage samedi.Commandez vite', 'Nouveautés : pagnes, bazins, etc.', 'Pagnes Wax & Co',
    'Nouveaux pagnes arrivés', 'Fermé le 12 octobre', 'Collection Tabaski 2027', 'Livré en 24 h à Bamako',
  ]) {
    assert.equal(R.refusAnnonce(texte), null, texte);
  }
  for (const nom of ['Tailles 38, 40, 42', 'Wax & Co', 'N°1 du bazin', 'Pagnes, bazins, etc.']) assert.equal(R.refusNomRayon(nom), null, nom);
  // Une vraie date n'ouvre pas la porte à un numéro écrit comme une date impossible.
  assert.equal(R.refusAnnonce('Appelez le 76/12/2034'), ANNONCE);
});

// ── 3. Deux noms différents, deux clés ──────────────────────────────────────

test('cleRayon : un nom en arabe, en n’ko ou en bambara a sa propre clé, stable ; les clés des noms en a-z ne changent pas', () => {
  const P = require('../src/lib/partage-boutique.ts');
  const { estCleRayon } = require('../src/lib/reseau/codes.ts');
  // Inchangées (lot 4) : les liens déjà calculés pour ces noms restent les mêmes.
  for (const [nom, cle] of [
    ['Électroménager & cuisine', 'electromenager-cuisine'], ['Cœur de Bamako', 'coeur-de-bamako'], ['', 'autres-articles'], [null, 'autres-articles'],
    ['Coups de cœur', 'coups-de-coeur-rayon'], ['Pagnes', 'pagnes'], ['Pour la fête', 'pour-la-fete'], ['Fête 🎉', 'fete'], ['!!!', 'rayon'], ['x'.repeat(80), 'x'.repeat(40)],
  ]) assert.equal(P.cleRayon(nom), cle, String(nom));

  const noms = ['بازار', 'عطور', 'ߒߞߏ', 'Мода', 'Fɛrɛ', 'Fɔrɔ', 'Bazin بازار', 'Bazin عطور', 'ߒߞߏ'.repeat(30)];
  const cles = noms.map((n) => P.cleRayon(n));
  assert.equal(new Set(cles).size, noms.length, `clés distinctes : ${cles.join(', ')}`);
  for (const [i, cle] of cles.entries()) {
    assert.ok(estCleRayon(cle), `${noms[i]} → ${cle} : [a-z0-9-], 40 caractères au plus`);
    assert.equal(P.cleRayon(noms[i]), cle, 'stable');
    assert.notEqual(cle, 'rayon');
  }
  assert.match(P.cleRayon('بازار'), /^rayon-[a-z0-9]{7}$/);
  assert.match(P.cleRayon('Bazin بازار'), /^bazin-[a-z0-9]{7}$/, 'la partie lisible est gardée');
  // Le même nom, écrit autrement, garde la même clé : espaces, ponctuation, casse, forme des accents.
  assert.equal(P.cleRayon('  بازار  '), P.cleRayon('بازار'));
  assert.equal(P.cleRayon('بازار !'), P.cleRayon('بازار'));
  assert.equal(P.cleRayon('МОДА'), P.cleRayon('мода'));
  assert.equal(P.cleRayon('Fɛ́rɛ'), P.cleRayon('Fɛrɛ'), 'accent ignoré, comme pour « Fête » et « Fete »');
});

test('Rayons en arabe ou en bambara : deux noms différents sont acceptés (avant : « Deux rayons portent le même nom ») ; le même nom deux fois reste refusé', async () => {
  const R = require('../src/lib/boutique-reglages.ts');
  const P = require('../src/lib/partage-boutique.ts');
  const { organiserVitrine, ancreDuRayon } = require('../src/components/shop/BoutiqueProduits.tsx');
  const ecrit = R.normaliserReglages({ rayons: [{ nom: 'بازار', ids: ['p1', 'p2'] }, { nom: 'عطور', ids: ['c1'] }, { nom: 'Fɛrɛ', ids: ['p3'] }, { nom: 'Fɔrɔ', ids: ['c2'] }] }, { selection: ['p1', 'p2', 'p3', 'c1', 'c2'] });
  assert.equal(ecrit.ok, true);
  const rayons = ecrit.reglages.rayons;
  assert.deepEqual(rayons.map((r) => r.nom), ['بازار', 'عطور', 'Fɛrɛ', 'Fɔrɔ']);
  assert.equal(new Set(rayons.map((r) => r.cle)).size, 4);
  assert.deepEqual(rayons.map((r) => r.cle), rayons.map((r) => P.cleRayon(r.nom)), 'la clé est toujours cleRayon(nom)');
  assert.deepEqual(R.lireReglages({ rayons }).rayons, rayons, 'relus à l’identique');
  // Le même nom deux fois : refusé, avec le bon message.
  assert.match(R.normaliserReglages({ rayons: [{ nom: 'بازار', ids: [] }, { nom: ' بازار ', ids: [] }] }, { selection: [] }).erreur, /Deux rayons portent le même nom/);
  // À l'écran.
  assert.equal(R.refusRayon(rayons, null, 'ߒߞߏ'), null);
  assert.equal(R.refusRayon(rayons, null, 'عطور'), 'Vous avez déjà un rayon de ce nom.');
  assert.equal(R.refusRayon(rayons, 1, 'عطور'), null, 'son propre nom');
  assert.equal(R.poserRayon(rayons, null, { nom: 'ߒߞߏ', ids: [] })[4].cle, P.cleRayon('ߒߞߏ'));

  // Vitrine : quatre rayons, chacun visé par sa clé ; partage : chacun avec ses articles.
  const p = (id, nom, categorie) => ({ id, slug: id, nom, categorie, image: null, images: [], prix: 1000, enStock: true, garantieMois: 0 });
  const produits = [p('c1', 'Théière', 'Cuisine'), p('p1', 'Pagne wax', 'Tissus'), p('p2', 'Bazin', 'Tissus'), p('c2', 'Bol', 'Cuisine'), p('p3', 'Pagne tissé', 'Mode')];
  const v = organiserVitrine(produits, '', rayons);
  assert.deepEqual(v.groupes.map(([nom, items]) => [nom, items.map((x) => x.id)]), [['بازار', ['p1', 'p2']], ['عطور', ['c1']], ['Fɛrɛ', ['p3']], ['Fɔrɔ', ['c2']]]);
  assert.deepEqual(rayons.map((r) => ancreDuRayon(r.cle, v.coups, v.groupes)), ['rayon-1', 'rayon-2', 'rayon-3', 'rayon-4']);
  const articles = produits.map((x) => ({ id: x.id, nom: x.nom, prix: x.prix, categorie: x.categorie, enStock: true }));
  assert.deepEqual(P.rayonsDeLaVitrine(articles, rayons).map((c) => [c.libelle, c.nombre]), [['بازار', 2], ['عطور', 1], ['Fɛrɛ', 1], ['Fɔrɔ', 1]]);
  assert.deepEqual(P.articlesDuChoix(articles, rayons[1].cle, rayons).map((a) => a.id), ['c1']);
  // Deux CATÉGORIES de fournisseur dans ces écritures ne se fondent plus en un seul rayon.
  const parCategorie = [{ id: 'a', nom: 'A', prix: 1, categorie: 'بازار', enStock: true }, { id: 'b', nom: 'B', prix: 1, categorie: 'عطور', enStock: true }];
  assert.deepEqual(P.rayonsDeLaVitrine(parCategorie).map((c) => [c.libelle, c.nombre]), [['بازار', 1], ['عطور', 1]]);

  // Route du partage : le lien d'un rayon en arabe porte son nom.
  baseAwa({ rayons: [{ cle: P.cleRayon('بازار'), nom: 'بازار', ids: ['p1'] }, { cle: P.cleRayon('عطور'), nom: 'عطور', ids: ['c1'] }] });
  const { POST } = require('../src/app/api/reseller/boutique/partage/route.ts');
  const reponse = await POST(requete('/api/reseller/boutique/partage', { method: 'POST', body: JSON.stringify({ canal: 'whatsapp', rayon: P.cleRayon('عطور') }) }));
  assert.equal((await reponse.json()).suivi, true);
  assert.deepEqual(etat.tracking_links.map((l) => [l.target_ref, l.label]), [[`awa-mode~${P.cleRayon('عطور')}`, 'عطور']]);
});

// ── 4. « Partager » un rayon ────────────────────────────────────────────────

// Pas de DOM dans node:test : la feuille est appelée comme une fonction, avec des
// crochets React SIMULÉS pour elle seule, joués comme React les joue :
//  - un changement d'état PENDANT le rendu rejoue le rendu tout de suite, sans
//    lancer les effets du rendu abandonné ;
//  - après le rendu, les effets dont les dépendances ont changé partent dans
//    l'ordre de leur déclaration, avec les valeurs de CE rendu ;
//  - un changement d'état dans un effet, ou à l'arrivée d'une réponse, provoque
//    un nouveau rendu.
const FEUILLE_PARTAGE = path.join(RACINE, 'src/components/shop/proprietaire/PartageBoutique.tsx');
let crochets = null;
const fauxReact = {
  ...React, __esModule: true, default: React,
  useState: (init) => crochets.useState(init),
  useRef: (init) => crochets.useRef(init),
  useEffect: (f, deps) => crochets.useEffect(f, deps),
  useMemo: (f, deps) => crochets.useMemo(f, deps),
  useCallback: (f, deps) => crochets.useMemo(() => f, deps),
};
const chargerOriginal = Module._load;
Module._load = function (demande, parent, ...reste) {
  if (demande === 'react' && parent && parent.filename === FEUILLE_PARTAGE) return fauxReact;
  return chargerOriginal.call(this, demande, parent, ...reste);
};
function monterComposant(fichier) {
  const etats = []; const refs = []; const memos = []; const depsEffets = [];
  let iEtat = 0; let iRef = 0; let iMemo = 0; let effets = []; let aRendre = false; let props = {};
  const memes = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  crochets = {
    useState(init) {
      const k = iEtat++;
      if (!(k in etats)) etats[k] = typeof init === 'function' ? init() : init;
      return [etats[k], (v) => {
        const suivant = typeof v === 'function' ? v(etats[k]) : v;
        if (!Object.is(suivant, etats[k])) { etats[k] = suivant; aRendre = true; }
      }];
    },
    useRef(init) { const k = iRef++; refs[k] ||= { current: init }; return refs[k]; },
    useEffect(f, deps) { effets.push({ f, deps }); },
    useMemo(f, deps) { const k = iMemo++; if (!memos[k] || !memes(memos[k].deps, deps)) memos[k] = { valeur: f(), deps }; return memos[k].valeur; },
  };
  const Composant = require(fichier).default;
  const rendre = () => {
    let arbre; let tours = 0;
    do {
      iEtat = 0; iRef = 0; iMemo = 0; effets = []; aRendre = false;
      arbre = Composant(props);
      assert.ok(++tours < 20, 'rendu en boucle');
    } while (aRendre);
    const aLancer = effets.filter((e, i) => { const change = !memes(depsEffets[i], e.deps); depsEffets[i] = e.deps; return change; });
    aLancer.forEach((e) => e.f());
    return arbre;
  };
  const attendre = async () => { for (let i = 0; i < 30; i++) await new Promise((r) => setImmediate(r)); };
  return {
    /** Nouvelles propriétés, puis rendus et effets jusqu'à ce que plus rien ne bouge (réponses réseau comprises). */
    async afficher(nouvelles) {
      props = { ...props, ...nouvelles };
      let arbre = rendre();
      for (let tour = 0; tour < 20; tour++) {
        await attendre();
        if (!aRendre) break;
        arbre = rendre();
      }
      return arbre;
    },
  };
}
/** fetch du navigateur → la vraie route du partage, avec la session simulée. */
function brancherPartage(appels) {
  global.fetch = async (url, init = {}) => {
    const methode = init.method || 'GET';
    appels.push(`${methode} ${url} ${init.body ?? ''}`.trim());
    assert.equal(String(url), '/api/reseller/boutique/partage', `appel inattendu : ${url}`);
    const r = await require('../src/app/api/reseller/boutique/partage/route.ts')[methode](requete(String(url), { method: methode, body: init.body }));
    return { ok: r.status >= 200 && r.status < 300, status: r.status, json: () => r.json() };
  };
}

test('Feuille de partage ouverte sur un rayon (« Mes rayons ») : UN seul lien préparé, celui du rayon — plus de lien « Ma boutique » créé au passage', async () => {
  const appels = [];
  brancherPartage(appels);
  try {
    const maison = [{ cle: 'pagnes', nom: 'Pagnes', ids: ['p1', 'p2'] }];
    baseAwa({ rayons: maison });
    const boutique = { nom: 'Awa Mode', enseigne: true, slug: 'awa-mode', statut: 'active', rayons: maison };
    const articles = [
      { id: 'c1', nom: 'Théière', prix: 3500, categorie: 'Cuisine', enStock: true },
      { id: 'p1', nom: 'Pagne wax', prix: 12500, categorie: 'Tissus', enStock: true },
      { id: 'p2', nom: 'Bazin', prix: 30000, categorie: 'Tissus', enStock: true },
      { id: 'c2', nom: 'Bol', prix: 1500, categorie: 'Cuisine', enStock: true },
    ];
    // Comme « Mes rayons » : la feuille est montée fermée, sans rayon demandé.
    const feuille = monterComposant(FEUILLE_PARTAGE);
    let arbre = await feuille.afficher({ ouvert: false, onFermer() {}, boutique, articles, choixInitial: null });
    assert.deepEqual(appels, [], 'feuille fermée : rien n’est préparé');
    assert.equal(arbre.props.ouvert, false);

    // « Partager » sur le rayon « Pagnes ».
    arbre = await feuille.afficher({ ouvert: true, choixInitial: 'pagnes' });
    assert.deepEqual(appels, ['POST /api/reseller/boutique/partage {"canal":"whatsapp","rayon":"pagnes"}'], 'un seul appel, pour le rayon');
    assert.deepEqual(etat.tracking_links.map((l) => [l.target_ref, l.channel, l.label]), [['awa-mode~pagnes', 'whatsapp', 'Pagnes']], 'aucun lien de toute la boutique');
    assert.deepEqual(etat.analytics_events.map((e) => [e.event, e.subject_ref]), [['SHARE', 'awa-mode~pagnes']], 'un seul partage journalisé');
    const choix = arbre.props.children.props.children[0].props.children;
    assert.deepEqual(choix.map((b) => [b.key, b.props['aria-checked']]), [['tout', false], ['pagnes', true], ['cuisine', false]], 'la feuille s’ouvre sur le rayon demandé');
    assert.match(arbre.props.pied.props.children[0].props.href, /Pagnes%20%C2%B7%20\*Awa%20Mode\*/, 'le message est celui du rayon');

    // Fermée puis rouverte sur un autre rayon : encore un seul appel.
    appels.length = 0;
    await feuille.afficher({ ouvert: false, choixInitial: null });
    assert.deepEqual(appels, []);
    await feuille.afficher({ ouvert: true, choixInitial: 'cuisine' });
    assert.deepEqual(appels, ['POST /api/reseller/boutique/partage {"canal":"whatsapp","rayon":"cuisine"}']);
    // Rouverte sur « Pagnes » : son lien existe déjà dans la feuille, aucun appel.
    appels.length = 0;
    await feuille.afficher({ ouvert: false, choixInitial: null });
    arbre = await feuille.afficher({ ouvert: true, choixInitial: 'pagnes' });
    assert.deepEqual(appels, []);
    assert.equal(arbre.props.children.props.children[0].props.children.find((b) => b.props['aria-checked']).key, 'pagnes', 'chaque ouverture repart du rayon demandé');
    assert.deepEqual(etat.tracking_links.map((l) => l.target_ref).sort(), ['awa-mode~cuisine', 'awa-mode~pagnes']);

    // Sans rayon demandé (vitrine, accueil, Mes articles, Statistiques) : toute la boutique, comme avant.
    appels.length = 0;
    const entiere = monterComposant(FEUILLE_PARTAGE);
    await entiere.afficher({ ouvert: false, onFermer() {}, boutique, articles });
    assert.deepEqual(appels, []);
    arbre = await entiere.afficher({ ouvert: true });
    assert.deepEqual(appels, ['POST /api/reseller/boutique/partage {"canal":"whatsapp"}']);
    assert.equal(arbre.props.children.props.children[0].props.children.find((b) => b.props['aria-checked']).key, 'tout');
  } finally { global.fetch = RESEAU_INTERDIT; }

  // Le rayon demandé est appliqué pendant le rendu : plus d'effet qui arrive après la préparation du lien.
  const source = sansCommentaires(lire('src/components/shop/proprietaire/PartageBoutique.tsx'));
  assert.doesNotMatch(source, /useEffect\(\(\) => \{ if \(ouvert && choixInitial\) setChoix\(choixInitial\); \}/);
  assert.match(source, /const demande = ouvert \? choixInitial : null;/);
  assert.match(source, /if \(demande !== applique\) \{\s*setApplique\(demande\);\s*if \(demande\) setChoix\(demande\);\s*\}/);
});

// ── 5. Écrans à 390 px ──────────────────────────────────────────────────────

test('Mes rayons : la barre dit « Enregistrer » (avec « Annuler », « Enregistrer mes rayons » ne laissait aucune place à « Non enregistré » à 390 px)', () => {
  const page = sansCommentaires(lire('src/app/reseller/boutique/rayons/page.tsx'));
  assert.match(page, /<BarreEnregistrement[\s\S]*?libelle="Enregistrer"[\s\S]*?barreDuBasPermanente/);
  for (const f of ['src/app/reseller/boutique/rayons/page.tsx', 'src/components/shop/proprietaire/FeuilleRayon.tsx']) {
    assert.doesNotMatch(lire(f), /Enregistrer mes rayons/, `${f} : l’ancien libellé n’est plus cité`);
  }
  // Le bouton reste le seul bouton principal de la barre, et l'état reste écrit à côté.
  const barre = lire('src/components/ui/BarreEnregistrement.tsx');
  assert.match(barre, /Non enregistré/);
  // Vérifié à l'écran (2026-10-03) : sur téléphone l'état a sa propre ligne, il n'est plus rogné.
  assert.match(barre, /<div className="flex flex-wrap items-center gap-2">/);
  assert.match(barre, /<p className="basis-full sm:basis-0 sm:flex-1 min-w-0 /);
  // Même libellé que « Personnaliser » (le titre de la page dit déjà « Mes rayons »).
  assert.match(page, /<PageReseau\s+titre="Mes rayons"/);
});

test('SelecteurArticles : la précision (« Dans « … » », « Coup de cœur, affiché en tête ») a sa propre ligne, entière, sous le prix', () => {
  const SelecteurArticles = require('../src/components/reseau/SelecteurArticles.tsx').default;
  const { formatF } = require('../src/lib/montant.ts');
  const catalogue = [
    { id: 'p1', nom: 'Pagne wax', image: null, prix: 12500, note: 'Dans « Pour la fête de Tabaski »' },
    { id: 'p2', nom: 'Bazin riche', image: null, prix: 125000, note: 'Coup de cœur, affiché en tête' },
    { id: 'c1', nom: 'Théière', image: null, prix: 3500 },
  ];
  const html = renderToStaticMarkup(React.createElement(SelecteurArticles, { catalogue, choisis: [], onChange() {}, listeClassName: '' }));
  const lignes = html.split('<li>').slice(1);
  assert.equal(lignes.length, 3);
  const blocs = (ligne) => [...ligne.matchAll(/<span class="block ([^"]*)">([^<]*)<\/span>/g)].map((m) => [m[2], m[1]]);
  // Nom (coupé s'il est long), prix seul sur sa ligne, puis la précision.
  assert.deepEqual(blocs(lignes[0]).map(([texte]) => texte), ['Pagne wax', formatF(12500), 'Dans « Pour la fête de Tabaski »']);
  assert.deepEqual(blocs(lignes[1]).map(([texte]) => texte), ['Bazin riche', formatF(125000), 'Coup de cœur, affiché en tête']);
  assert.deepEqual(blocs(lignes[2]).map(([texte]) => texte), ['Théière', formatF(3500)], 'sans précision : deux lignes, comme avant');
  for (const ligne of lignes.slice(0, 2)) {
    const [, , [, classes]] = blocs(ligne);
    assert.doesNotMatch(classes, /truncate|line-clamp/, 'la précision n’est jamais coupée par « … »');
    assert.match(classes, /break-words/);
  }
  assert.ok(!html.includes(' · '), 'plus de « prix · précision » sur une seule ligne coupée');
  assert.match(html, /min-h-\[60px\]/, 'la ligne reste une cible de 60 px au moins');
  // « Mes rayons » garde ses textes : la fiche du guide les cite.
  assert.match(lire('src/app/reseller/boutique/rayons/page.tsx'), /'Coup de cœur, affiché en tête'/);
});

// ── 6. Guide et reprise ─────────────────────────────────────────────────────

test('Guide : relecture du lot 6 en tête, juste avant le lot 6 ; la fiche « Mes rayons » et le journal disent ce que fait le code ; REPRISE', () => {
  const guide = JSON.parse(lire('docs/guide/guide.json'));
  assert.ok(guide.majLe >= '2026-10-03');
  const rang = guide.journal.findIndex((j) => j.titre === 'Boutique revendeur, lot 6 : corrections de relecture');
  assert.ok(rang >= 0, 'entrée de relecture');
  const relecture = guide.journal[rang];
  assert.equal(guide.journal[rang + 1].titre, 'Boutique revendeur, lot 6 : rayons personnalisés et annonce datée');
  assert.equal(relecture.date, '2026-10-03');
  assert.ok(['en local', 'en ligne'].includes(relecture.statut));
  assert.match(relecture.demande, /^« “Ma boutique” doit montrer la boutique elle-même/);
  assert.ok(relecture.realise.length >= 6);
  assert.ok(relecture.ecarts.length > 0);
  for (const id of ['rev-boutique-rayons', 'rev-boutique', 'vitrine-boutique']) assert.ok(relecture.pages.includes(id), id);
  assert.match(relecture.ecarts.join('\n'), /Mes articles/, 'le même défaut, plus léger, sur « Mes articles » est signalé');

  const fiche = JSON.stringify(guide.pages.find((p) => p.id === 'rev-boutique-rayons'));
  assert.doesNotMatch(fiche, /Enregistrer mes rayons/);
  assert.match(fiche, /"nom":"Enregistrer"/);
  assert.match(fiche, /Tout à 5000/);
  assert.match(fiche, /un lien/);
  // L'entrée du lot 6 ne promet plus l'ancien libellé, et dit la règle du prix dans un nom de rayon.
  const lot6 = JSON.stringify(guide.journal[rang + 1]);
  assert.doesNotMatch(lot6, /Enregistrer mes rayons/);
  assert.doesNotMatch(JSON.stringify(relecture) + fiche, /À la une/);
  assert.ok(lire('REPRISE.md').split('\n').some((l) => l.startsWith('> **') && /boutique revendeur, lot 6 : corrections de relecture/.test(l)));
});
