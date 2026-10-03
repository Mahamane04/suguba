// TEST-BOUTIQUE-LOT5-001..020 (chantier boutique du revendeur, 2026-10-03, lot 5
// « Prévenir mes abonnés ») : le revendeur annonce ses nouveautés à ses abonnés,
// une fois par 24 h, DANS L'APPLICATION SEULEMENT (aucun envoi WhatsApp, aucun
// appel sortant), avec un texte écrit par Suguba ; chiffres réels (prévenus, sans
// compte) ; bouton « Prévenir mes abonnés (N nouveautés) » et sa feuille ; « Suivre »
// ne promet plus de promotions ; les annonces d'un fournisseur à 2 boutiques ne
// s'arrêtent plus en silence.
// Supabase et la session sont SIMULÉS (require.cache) : aucune base réelle.
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
// `avant` : geste glissé juste avant une opération (un autre onglet qui écrit).
let etat; let fautes; let operations; let avant; let serie;
function reinitialiser() {
  etat = {
    stores: [], profiles: [], profile_roles: [], reseller_shop_items: [], products: [], analytics_events: [],
    store_follows: [], notifications: [], tracking_links: [],
  };
  fautes = {}; operations = []; avant = {}; serie = 1;
}
const valeur = (r, k) => {
  if (k.includes('->>')) { const [col, cle] = k.split('->>'); return r[col] ? r[col][cle] : undefined; }
  return r[k];
};
const comparer = (a, b) => (typeof a === 'number' && typeof b === 'number' ? a - b : String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0);
const db = {
  from(table) {
    let op = 'select'; let patch; const filtres = []; let un = false; let tete = false; let limite = null; let tri = null;
    const q = {
      select(_colonnes, options) { if (options && options.head) tete = true; return q; },
      eq(k, v) { filtres.push((r) => valeur(r, k) === v); return q; },
      neq(k, v) { filtres.push((r) => valeur(r, k) !== v); return q; },
      gt(k, v) { filtres.push((r) => String(valeur(r, k)) > String(v)); return q; },
      gte(k, v) { filtres.push((r) => String(valeur(r, k)) >= String(v)); return q; },
      in(k, v) { filtres.push((r) => v.includes(r[k])); return q; },
      ilike(k, v) { filtres.push((r) => String(r[k]).toLowerCase() === String(v).toLowerCase()); return q; },
      is(k, v) { filtres.push((r) => (v === null ? r[k] == null : r[k] === v)); return q; },
      not(k, operateur, v) {
        if (operateur !== 'is' || v !== null) throw Error(`not(${k}, ${operateur}) non simulé`);
        filtres.push((r) => r[k] != null); return q;
      },
      order(k, o) { tri = { k, asc: !o || o.ascending !== false }; return q; },
      limit(n) { limite = n; return q; },
      insert(p) { op = 'insert'; patch = p; return q; },
      update(p) { op = 'update'; patch = p; return q; },
      delete() { op = 'delete'; return q; },
      maybeSingle() { un = true; return q; },
      then(resolve, reject) {
        if (avant[`${table}:${op}`]) avant[`${table}:${op}`]();
        operations.push({ table, op, patch });
        const repondre = (r) => Promise.resolve(r).then(resolve, reject);
        if (fautes[`${table}:${op}`]) return repondre({ data: null, count: null, error: { code: fautes[`${table}:${op}`] } });
        let lignes = (etat[table] || []).filter((r) => filtres.every((f) => f(r)));
        if (tri) lignes = [...lignes].sort((a, b) => comparer(a[tri.k], b[tri.k]) * (tri.asc ? 1 : -1));
        if (op === 'insert') {
          const maintenant = new Date().toISOString();
          lignes = (Array.isArray(patch) ? patch : [patch]).map((p) => ({ id: serie++, created_at: maintenant, occurred_at: maintenant, ...p }));
          (etat[table] ||= []).push(...lignes);
        }
        if (op === 'update') lignes.forEach((r) => Object.assign(r, patch));
        if (op === 'delete') etat[table] = (etat[table] || []).filter((r) => !lignes.includes(r));
        if (limite !== null && op === 'select') lignes = lignes.slice(0, limite);
        // Comme PostgREST : maybeSingle() sur plusieurs lignes est une ERREUR, pas la première ligne.
        if (un && lignes.length > 1) return repondre({ data: null, count: null, error: { code: 'PGRST116' } });
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
const revendeur = (uid, extra = {}) => ({ uid, phone: '+22300000000', role: 'reseller', status: 'active', roles: { reseller: 'active' }, iat: 1, exp: 9e9, ...extra });

// ── Composants simulés ──────────────────────────────────────────────────────
require.cache[require.resolve('next/link')] = {
  exports: { __esModule: true, default: ({ href, prefetch, children, ...reste }) => React.createElement('a', { href, ...reste }, children) },
};
// La vraie feuille passe par un portail (rien au rendu serveur) : ici, son contenu à plat.
require.cache[require.resolve('../src/components/ui/Sheet.tsx')] = {
  exports: { __esModule: true, default: ({ ouvert, titre, sousTitre, children, pied }) => (ouvert
    ? React.createElement('section', { 'data-feuille': titre }, React.createElement('p', null, sousTitre), children, React.createElement('footer', null, pied))
    : null) },
};

const { NextRequest } = require('next/server');
const requete = (url, init = {}) => new NextRequest(`http://localhost${url}`, {
  ...init, headers: { cookie: 'suguba_session=simule', 'content-type': 'application/json', ...(init.headers || {}) },
});
const ROUTE = '../src/app/api/reseller/boutique/annonce/route.ts';
const lireAnnonce = () => require(ROUTE).GET(requete('/api/reseller/boutique/annonce'));
const annoncer = (corps, entetes = {}) => require(ROUTE).POST(requete('/api/reseller/boutique/annonce', {
  method: 'POST', headers: entetes, ...(corps === undefined ? {} : { body: JSON.stringify(corps) }),
}));

const IL_Y_A = (heures) => new Date(Date.now() - heures * 3600 * 1000).toISOString();
const produit = (id, enPlus = {}) => ({
  id, slug: `slug-${id}`, name: `Article ${id}`, category: 'Mode', images: [], public_price: 10000, stock: 5,
  reseller_commission: 1000, pricing_status: 'ok', status: 'approved', ...enPlus,
});
const NOM_COMPLET = /Traoré|Diallo/;
/** Awa (rev-1) : 2 articles récents, 2 abonnés avec compte et 1 par téléphone. Moussa (rev-2) : une autre boutique. */
function baseAwa() {
  reinitialiser();
  etat.profiles = [
    { id: 'rev-1', full_name: 'Awa Traoré Diallo', reseller_code: 'AWA1', metadata: {} },
    { id: 'rev-2', full_name: 'Moussa Keita', reseller_code: 'MOU2', metadata: {} },
  ];
  etat.stores = [
    { id: 's1', owner_type: 'reseller', owner_id: 'rev-1', slug: 'awa-mode', name: 'Awa Mode', status: 'active', created_at: '2026-09-01T00:00:00Z' },
    { id: 's2', owner_type: 'reseller', owner_id: 'rev-2', slug: 'moussa-k', name: 'Chez Moussa', status: 'active', created_at: '2026-09-02T00:00:00Z' },
  ];
  etat.products = [
    produit('a', { name: 'Pagne wax' }), produit('b', { name: 'Théière' }), produit('c', { name: 'Bol' }),
    produit('x', { name: 'Article de Moussa' }),
  ];
  etat.reseller_shop_items = [
    { reseller_id: 'rev-1', product_id: 'a', position: 0, added_at: IL_Y_A(2) },
    { reseller_id: 'rev-1', product_id: 'b', position: 1, added_at: IL_Y_A(5) },
    { reseller_id: 'rev-2', product_id: 'x', position: 0, added_at: IL_Y_A(1) },
  ];
  etat.store_follows = [
    { store_id: 's1', follower_key: 'p:c1', follower_id: 'c1' },
    { store_id: 's1', follower_key: 'p:c2', follower_id: 'c2' },
    { store_id: 's1', follower_key: 't:22370000001', follower_id: null },
    { store_id: 's2', follower_key: 'p:c9', follower_id: 'c9' },
  ];
  sessionCourante = revendeur('rev-1');
}
const annonces = () => etat.analytics_events.filter((e) => e.event === 'STORE_ANNOUNCE');

// ── Règles pures ────────────────────────────────────────────────────────────

test('annonce-boutique : 24 h entre deux annonces ; nouveautés = ajouts depuis la dernière annonce, 14 jours au plus, affichés et en stock', () => {
  const A = require('../src/lib/annonce-boutique.ts');
  const T = Date.parse('2026-10-03T12:00:00Z');
  const JOUR = 24 * 3600 * 1000;
  assert.equal(A.ANNONCE_DELAI_HEURES, 24);
  assert.equal(A.ANNONCE_ARTICLES_CITES, 3);
  assert.equal(A.prochaineAnnonce(null, T), null);
  assert.equal(A.prochaineAnnonce('illisible', T), null, 'une date illisible ne bloque pas');
  assert.equal(A.prochaineAnnonce('2026-10-02T13:00:00Z', T), '2026-10-03T13:00:00.000Z');
  assert.equal(A.prochaineAnnonce('2026-10-02T12:00:00Z', T), null, '24 h révolues : possible');

  assert.equal(A.debutDesNouveautes('2026-10-01T00:00:00Z', T), Date.parse('2026-10-01T00:00:00Z'), 'depuis la dernière annonce');
  assert.equal(A.debutDesNouveautes(null, T), T - 14 * JOUR, 'jamais annoncé : 14 jours, la durée de « Nouveau »');
  assert.equal(A.debutDesNouveautes('2026-08-01T00:00:00Z', T), T - 14 * JOUR, 'annonce ancienne : 14 jours au plus');

  const ok = { id: 'p', name: 'Pagne', status: 'approved', stock: 3, reseller_commission: 500, pricing_status: 'ok' };
  assert.equal(A.annoncable(ok), true);
  assert.equal(A.annoncable({ ...ok, pricing_status: null }), true);
  for (const [cas, p] of [['épuisé', { stock: 0 }], ['refusé', { status: 'rejected' }], ['sans gain', { reseller_commission: 0 }], ['sous le plancher', { pricing_status: 'sous_plancher' }]]) {
    assert.equal(A.annoncable({ ...ok, ...p }), false, cas);
  }
  assert.equal(A.annoncable(null), false);

  const debut = T - 3 * JOUR;
  const selection = [
    { product_id: 'ancien', added_at: new Date(T - 5 * JOUR).toISOString() },
    { product_id: 'hier', added_at: new Date(T - JOUR).toISOString() },
    { product_id: 'ce-matin', added_at: new Date(T - 3600 * 1000).toISOString() },
    { product_id: 'epuise', added_at: new Date(T - 2 * 3600 * 1000).toISOString() },
    { product_id: 'sans-date', added_at: null },
    { product_id: 'inconnu', added_at: new Date(T - 60 * 1000).toISOString() },
  ];
  const produits = [
    { ...ok, id: 'ancien', name: 'Ancien' }, { ...ok, id: 'hier', name: ' Robe  <b>bazin</b> ' }, { ...ok, id: 'ce-matin', name: 'Bol' },
    { ...ok, id: 'epuise', name: 'Marmite', stock: 0 }, { ...ok, id: 'sans-date', name: 'Sans date' },
  ];
  assert.deepEqual(A.nouveautesAAnnoncer(selection, produits, debut), [{ id: 'ce-matin', nom: 'Bol' }, { id: 'hier', nom: 'Robe bbazin/b' }],
    'du plus récent au plus ancien ; ni balise, ni article épuisé, sans date ou hors de la liste');
});

test('annonce-boutique : texte écrit par Suguba (« Nouveautés chez <enseigne> », 3 noms au plus), sans prix ni pourcentage ; statut WhatsApp prêt', () => {
  const A = require('../src/lib/annonce-boutique.ts');
  const noms = (n) => ['Pagne wax', 'Théière', 'Bol', 'Robe', 'Sac'].slice(0, n).map((nom) => ({ nom }));
  const contenu = (n) => A.contenuAnnonce({ nomBoutique: 'Awa Mode', slug: 'awa-mode', nouveautes: noms(n) });
  assert.deepEqual(contenu(1), { titre: 'Nouveautés chez Awa Mode', texte: 'À découvrir : Pagne wax.', lien: '/boutique/awa-mode', noms: ['Pagne wax'] });
  assert.equal(contenu(2).texte, 'À découvrir : Pagne wax et Théière.');
  assert.equal(contenu(3).texte, 'À découvrir : Pagne wax, Théière et Bol.');
  assert.equal(contenu(4).texte, 'À découvrir : Pagne wax, Théière, Bol et 1 autre article.');
  assert.equal(contenu(5).texte, 'À découvrir : Pagne wax, Théière, Bol et 2 autres articles.');
  assert.deepEqual(contenu(5).noms, ['Pagne wax', 'Théière', 'Bol'], '3 noms cités au plus');
  assert.equal(A.contenuAnnonce({ nomBoutique: 'Awa D.', slug: 'awa-d', nouveautes: noms(1) }).titre, 'Nouveautés chez Awa D.');
  assert.doesNotMatch(JSON.stringify(contenu(5)), /%|\d\s?F\b|promo|remise|À la une/i, 'ni prix, ni pourcentage, ni promesse');
  assert.ok(contenu(5).titre.length <= 140 && contenu(5).texte.length <= 400, 'tient dans une notification');

  const statut = A.texteStatutAnnonce({ titre: 'Nouveautés chez Awa Mode', noms: ['Pagne wax', 'Théière'], url: 'https://app.sugubaml.com/go/AB78X2' });
  assert.equal(statut, ['🆕 *Nouveautés chez Awa Mode*', '', '• Pagne wax', '• Théière', '', '✅ Vous payez à la livraison, livré chez vous à Bamako.', '👉 https://app.sugubaml.com/go/AB78X2'].join('\n'));
  assert.doesNotMatch(statut, /%|\d\s?F\b|commission|gagnez/i);
});

test('annonce-boutique : le bouton n’est proposé qu’avec des nouveautés ET des abonnés ; modes et phrases de la feuille', () => {
  const A = require('../src/lib/annonce-boutique.ts');
  const apercu = { titre: 'Nouveautés chez Awa Mode', texte: 'À découvrir : Bol.', lien: '/boutique/awa-mode', noms: ['Bol'] };
  const e = (enPlus = {}) => ({ nouveautes: 2, apercu, abonnesAvecCompte: 3, abonnesSansCompte: 1, derniereAnnonce: null, possibleLe: null, ...enPlus });
  assert.equal(A.annonceAProposer(e()), true);
  assert.equal(A.annonceAProposer(e({ abonnesAvecCompte: 0, abonnesSansCompte: 2 })), true, 'abonnés par téléphone seulement : la feuille propose le statut WhatsApp');
  assert.equal(A.annonceAProposer(e({ nouveautes: 0, apercu: null })), false, 'aucune nouveauté');
  assert.equal(A.annonceAProposer(e({ abonnesAvecCompte: 0, abonnesSansCompte: 0 })), false, 'aucun abonné');
  assert.equal(A.annonceAProposer(e({ abonnesAvecCompte: null })), false, 'compte illisible : rien n’est proposé');
  assert.equal(A.annonceAProposer(null), false);

  const T = Date.parse('2026-10-03T12:00:00Z');
  assert.equal(A.modeAnnonce(e(), false, T), 'prete');
  assert.equal(A.modeAnnonce(e(), true, T), 'envoyee');
  assert.equal(A.modeAnnonce(e({ possibleLe: '2026-10-03T18:00:00Z' }), false, T), 'limite');
  assert.equal(A.modeAnnonce(e({ possibleLe: '2026-10-03T08:00:00Z' }), false, T), 'prete', 'délai écoulé depuis la lecture');
  assert.equal(A.modeAnnonce(e({ abonnesAvecCompte: 0 }), false, T), 'sans_compte');
  assert.equal(A.modeAnnonce(e({ abonnesAvecCompte: 0, possibleLe: '2026-10-03T18:00:00Z' }), true, T), 'envoyee');

  const { formatNombre } = require('../src/lib/montant.ts');
  assert.equal(A.libelleBoutonAnnonce(1), 'Prévenir mes abonnés (1 nouveauté)');
  assert.equal(A.libelleBoutonAnnonce(2), 'Prévenir mes abonnés (2 nouveautés)');
  assert.equal(A.libelleEnvoiAnnonce(1), 'Prévenir mon abonné');
  assert.equal(A.libelleEnvoiAnnonce(1250), `Prévenir mes ${formatNombre(1250)} abonnés`);
  assert.equal(A.phraseDestinataires(1), '1 abonné avec un compte sera prévenu dans l’application.');
  assert.equal(A.phraseDestinataires(12), '12 abonnés avec un compte seront prévenus dans l’application.');
  assert.equal(A.phraseSansCompte(0), null);
  assert.equal(A.phraseSansCompte(null), null, 'compte illisible : rien d’affirmé');
  assert.equal(A.phraseSansCompte(1), '1 abonné inscrit par téléphone ne reçoit rien.');
  assert.equal(A.phraseSansCompte(3), '3 abonnés inscrits par téléphone ne reçoivent rien.');
  assert.equal(A.phraseResultat(1), '1 abonné prévenu');
  assert.equal(A.phraseResultat(12), '12 abonnés prévenus');
});

// ── Route privée /api/reseller/boutique/annonce ─────────────────────────────

test('GET annonce : session revendeur ; lecture seule ; nouveautés de SA sélection, abonnés réels, jamais le nom complet', async () => {
  baseAwa();
  sessionCourante = null;
  assert.equal((await lireAnnonce()).status, 401);
  sessionCourante = revendeur('rev-1', { role: 'customer', roles: { customer: 'active', reseller: 'active' } });
  assert.equal((await lireAnnonce()).status, 401, 'sous un autre profil : refusé');

  sessionCourante = revendeur('rev-1');
  const r = await lireAnnonce();
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('cache-control'), 'no-store');
  const json = await r.json();
  assert.deepEqual(json, {
    nouveautes: 2,
    apercu: { titre: 'Nouveautés chez Awa Mode', texte: 'À découvrir : Pagne wax et Théière.', lien: '/boutique/awa-mode', noms: ['Pagne wax', 'Théière'] },
    abonnesAvecCompte: 2,
    abonnesSansCompte: 1,
    derniereAnnonce: null,
    possibleLe: null,
  });
  assert.doesNotMatch(JSON.stringify(json), NOM_COMPLET);
  assert.doesNotMatch(JSON.stringify(json), /Moussa/, 'rien de la boutique d’un autre');
  assert.deepEqual(ecritures(), [], 'lecture seule');

  // Boutique créée au nom du compte : « Awa D. », jamais le nom complet.
  etat.stores[0].name = 'Awa Traoré Diallo';
  const sansEnseigne = await (await lireAnnonce()).json();
  assert.equal(sansEnseigne.apercu.titre, 'Nouveautés chez Awa D.');
  assert.doesNotMatch(JSON.stringify(sansEnseigne), NOM_COMPLET);

  // Sans nouveauté : ni le nom, ni les abonnés, ni les articles ne sont lus.
  etat.reseller_shop_items.forEach((l) => { l.added_at = IL_Y_A(24 * 20); });
  operations = [];
  const rien = await (await lireAnnonce()).json();
  assert.deepEqual(rien, { nouveautes: 0, apercu: null, abonnesAvecCompte: null, abonnesSansCompte: null, derniereAnnonce: null, possibleLe: null });
  assert.deepEqual(operations.map((o) => o.table), ['stores', 'analytics_events', 'reseller_shop_items']);
});

test('POST annonce : les abonnés AVEC compte reçoivent la notification ; prevenus et sansCompte réels ; une seconde annonce dans les 24 h donne 429', async () => {
  baseAwa();
  let r = await annoncer();
  assert.equal(r.status, 200);
  const json = await r.json();
  assert.equal(json.prevenus, 2, 'notifications vraiment écrites');
  assert.equal(json.sansCompte, 1, 'abonné inscrit par téléphone seul');
  assert.ok(Date.parse(json.possibleLe) > Date.now() + 23 * 3600 * 1000);

  // Les notifications : composées par le serveur, lien interne vers la vitrine.
  assert.deepEqual(etat.notifications.map((n) => n.profile_id).sort(), ['c1', 'c2'], 'ni l’abonné par téléphone, ni l’abonné d’une autre boutique');
  for (const n of etat.notifications) {
    assert.equal(n.kind, 'nouveaute');
    assert.equal(n.title, 'Nouveautés chez Awa Mode');
    assert.equal(n.body, 'À découvrir : Pagne wax et Théière.');
    assert.equal(n.link, '/boutique/awa-mode');
  }
  // La trace qui fait la limite des 24 h.
  assert.equal(annonces().length, 1);
  const [trace] = annonces();
  assert.equal(trace.reseller_id, 'rev-1');
  assert.equal(trace.actor_id, 'rev-1');
  assert.equal(trace.subject_type, 'store');
  assert.equal(trace.subject_ref, 's1', 'l’identifiant de la boutique');
  assert.equal(trace.meta.prevenus, 2);
  assert.equal(trace.meta.sansCompte, 1);
  assert.equal(trace.meta.nouveautes, 2);

  // Seconde annonce le même jour : refusée, avec l'heure possible ; rien n'est renvoyé.
  operations = [];
  r = await annoncer();
  assert.equal(r.status, 429);
  const refus = await r.json();
  assert.match(refus.error, /une annonce par 24 h/);
  assert.match(refus.error, /Prochaine annonce possible le /);
  assert.ok(Date.parse(refus.possibleLe) > Date.now());
  assert.deepEqual(ecritures(), [], 'ni trace ni notification');
  assert.equal(etat.notifications.length, 2);

  // Un article ajouté après l'annonce : toujours 429 avant 24 h…
  etat.reseller_shop_items.push({ reseller_id: 'rev-1', product_id: 'c', position: 2, added_at: new Date(Date.now() + 1000).toISOString() });
  const lu = await (await lireAnnonce()).json();
  assert.equal(lu.nouveautes, 1, 'seul l’article ajouté depuis la dernière annonce');
  assert.equal(lu.apercu.texte, 'À découvrir : Bol.');
  assert.ok(lu.possibleLe, 'la lecture donne l’heure de la prochaine annonce');
  assert.equal((await annoncer()).status, 429);
  // … et possible 24 h plus tard, pour ce seul article.
  trace.occurred_at = IL_Y_A(25);
  etat.reseller_shop_items.filter((l) => l.reseller_id === 'rev-1' && l.product_id !== 'c').forEach((l) => { l.added_at = IL_Y_A(30); });
  r = await annoncer();
  assert.equal(r.status, 200);
  assert.equal((await r.json()).prevenus, 2);
  assert.equal(etat.notifications.length, 4);
  assert.equal(etat.notifications.at(-1).body, 'À découvrir : Bol.');
  assert.equal(annonces().length, 2);
});

test('POST annonce : aucune nouveauté donne 400, et rien n’est écrit', async () => {
  // Articles ajoutés il y a plus de 14 jours, jamais annoncés : ce ne sont plus des nouveautés.
  baseAwa();
  etat.reseller_shop_items.forEach((l) => { l.added_at = IL_Y_A(24 * 15); });
  let r = await annoncer();
  assert.equal(r.status, 400);
  assert.match((await r.json()).error, /Aucune nouveauté/);
  // Articles récents mais que la vitrine n'affiche pas, ou épuisés.
  baseAwa();
  Object.assign(etat.products[0], { stock: 0 });
  Object.assign(etat.products[1], { status: 'rejected' });
  assert.equal((await annoncer()).status, 400);
  Object.assign(etat.products[1], { status: 'approved', reseller_commission: 0 });
  assert.equal((await annoncer()).status, 400);
  // Boutique vide.
  baseAwa();
  etat.reseller_shop_items = etat.reseller_shop_items.filter((l) => l.reseller_id !== 'rev-1');
  assert.equal((await annoncer()).status, 400);
  assert.deepEqual(ecritures(), [], 'ni trace, ni notification');
  assert.equal(etat.notifications.length, 0);
});

test('POST annonce : seuls les articles de la sélection de la SESSION sont annoncés ; rien n’est lu dans la requête', async () => {
  baseAwa();
  // Un corps qui désigne une autre boutique, d'autres articles et un texte libre : ignoré.
  const r = await annoncer({ resellerId: 'rev-2', boutique: 's2', slug: 'moussa-k', articles: ['x'], titre: 'PROMO -50 %', texte: 'Tout à 500 F', lien: 'https://pirate.example' });
  assert.equal(r.status, 200);
  assert.deepEqual(etat.notifications.map((n) => n.profile_id).sort(), ['c1', 'c2'], 'les abonnés de SA boutique');
  const ecrit = JSON.stringify(etat.notifications);
  assert.doesNotMatch(ecrit, /Moussa|PROMO|500 F|pirate|%/, 'ni article d’un autre, ni texte libre');
  assert.doesNotMatch(ecrit, NOM_COMPLET);
  assert.ok(etat.notifications.every((n) => n.link === '/boutique/awa-mode'));
  assert.equal(annonces()[0].reseller_id, 'rev-1');
  assert.equal(annonces()[0].subject_ref, 's1');
  // La sélection est lue par l'identifiant de la session.
  const route = sansCommentaires(lire('src/app/api/reseller/boutique/annonce/route.ts'));
  assert.match(route, /\.from\('reseller_shop_items'\)\s*\.select\('product_id, added_at'\)\s*\.eq\('reseller_id', uid\)/);
  assert.match(route, /boutiqueDuProprietaire\('reseller', uid\)/);
  assert.doesNotMatch(route, /req\.json\(|req\.text\(|req\.formData\(|searchParams/, 'ni corps ni paramètre lus');
});

test('POST annonce : appel d’un autre site, aperçu admin, boutique masquée ou absente : rien ne part', async () => {
  baseAwa();
  for (const site of ['cross-site', 'same-site', 'none']) {
    assert.equal((await annoncer(undefined, { 'sec-fetch-site': site })).status, 403, site);
  }
  sessionCourante = null;
  assert.equal((await annoncer()).status, 401);
  sessionCourante = revendeur('rev-1', { role: 'supplier', roles: { supplier: 'active', reseller: 'active' } });
  assert.equal((await annoncer()).status, 401);
  sessionCourante = revendeur('rev-1', { apercu: { depuis: { uid: 'admin-1', phone: '+22300000001' } } });
  assert.equal((await annoncer()).status, 403, 'aperçu d’un administrateur');
  sessionCourante = revendeur('rev-1');
  etat.stores[0].status = 'hidden';
  let r = await annoncer();
  assert.equal(r.status, 409);
  assert.match((await r.json()).error, /masquée par Suguba/);
  assert.equal((await lireAnnonce()).status, 409, 'le bouton n’est pas proposé non plus');
  sessionCourante = revendeur('rev-3');
  assert.equal((await annoncer()).status, 404, 'pas de boutique');
  assert.deepEqual(ecritures(), []);
  assert.equal(etat.notifications.length, 0);
  // Même origine (ou navigateur sans Sec-Fetch-Site) : accepté.
  sessionCourante = revendeur('rev-1');
  etat.stores[0].status = 'active';
  assert.equal((await annoncer(undefined, { 'sec-fetch-site': 'same-origin' })).status, 200);
  const route = require(ROUTE);
  assert.deepEqual(Object.keys(route).filter((k) => /^[A-Z]+$/.test(k)).sort(), ['GET', 'POST']);
});

test('POST annonce : aucun abonné avec un compte donne 409 sans consommer les 24 h ; journal illisible ou trace impossible : 503, rien n’est envoyé', async () => {
  baseAwa();
  etat.store_follows = etat.store_follows.filter((f) => f.store_id !== 's1' || !f.follower_id);
  let r = await annoncer();
  assert.equal(r.status, 409);
  const json = await r.json();
  assert.match(json.error, /Aucun abonné avec un compte/);
  assert.equal(json.sansCompte, 1);
  assert.deepEqual(ecritures(), [], 'aucune trace : la prochaine annonce reste possible tout de suite');

  // Journal illisible (table absente, lecture en échec) : la limite ne peut pas être vérifiée.
  for (const code of ['42P01', 'PGRST205', 'XX000']) {
    baseAwa();
    fautes['analytics_events:select'] = code;
    assert.equal((await annoncer()).status, 503, code);
    assert.equal((await lireAnnonce()).status, 503, `${code} : le bouton n’est pas proposé`);
    assert.deepEqual(ecritures(), []);
  }
  // Compte des abonnés illisible : jamais un 0 inventé, rien ne part.
  baseAwa();
  fautes['store_follows:select'] = 'XX000';
  assert.equal((await annoncer()).status, 503);
  assert.equal((await (await lireAnnonce()).json()).abonnesAvecCompte, null);
  assert.deepEqual(ecritures(), []);
  // La trace ne peut pas être écrite : aucune notification.
  baseAwa();
  fautes['analytics_events:insert'] = '42501';
  r = await annoncer();
  assert.equal(r.status, 503);
  assert.match((await r.json()).error, /rien n’a été envoyé/);
  assert.equal(etat.notifications.length, 0);
  // Profil illisible : on ne peut pas vérifier que le nom n'est pas le nom complet.
  baseAwa();
  fautes['profiles:select'] = 'XX000';
  assert.equal((await annoncer()).status, 503);
  assert.deepEqual(ecritures(), []);
});

test('POST annonce : notifications non écrites, la trace est retirée (nouvel essai possible) ; deux envois simultanés, un seul part', async () => {
  baseAwa();
  fautes['notifications:insert'] = 'XX000';
  let r = await annoncer();
  assert.equal(r.status, 503);
  assert.match((await r.json()).error, /n’ont pas pu être prévenus/);
  assert.equal(annonces().length, 0, 'trace retirée : pas de limite de 24 h pour un envoi qui n’a prévenu personne');
  delete fautes['notifications:insert'];
  r = await annoncer();
  assert.equal(r.status, 200, 'le nouvel essai passe tout de suite');
  assert.equal((await r.json()).prevenus, 2);

  // Deux onglets : l'autre a écrit sa trace juste avant la nôtre.
  baseAwa();
  avant['analytics_events:insert'] = () => {
    delete avant['analytics_events:insert'];
    etat.analytics_events.push({ id: serie++, event: 'STORE_ANNOUNCE', reseller_id: 'rev-1', occurred_at: new Date().toISOString(), meta: { reservation: 'autre-onglet' } });
  };
  r = await annoncer();
  assert.equal(r.status, 429);
  const json = await r.json();
  assert.match(json.error, /une annonce par 24 h/);
  assert.ok(Date.parse(json.possibleLe) > Date.now());
  assert.equal(etat.notifications.length, 0, 'cet envoi-ci ne prévient personne');
  assert.deepEqual(annonces().map((e) => e.meta.reservation), ['autre-onglet'], 'sa propre trace est retirée, celle de l’autre reste');

  // Écriture partielle : le chiffre renvoyé et la trace disent ce qui est vraiment écrit.
  const { notifier } = require('../src/lib/reseau/notifications.ts');
  reinitialiser();
  assert.equal(await notifier(['c1', 'c2', 'c1', '', null], { titre: 'T' }), 2, 'destinataires distincts et non vides');
  assert.equal(etat.notifications.length, 2);
  fautes['notifications:insert'] = 'XX000';
  assert.equal(await notifier(['c3'], { titre: 'T' }), 0, 'écriture en échec : 0, pas le nombre visé');
  assert.equal(await notifier([], { titre: 'T' }), 0);
});

// ── Aucun envoi hors de l'application ───────────────────────────────────────

test('Annonce : dans l’application seulement — ni WhatsApp, ni SMS, ni appel sortant ; notifierAbonnes ne vise que les abonnés avec un compte', async () => {
  const route = sansCommentaires(lire('src/app/api/reseller/boutique/annonce/route.ts'));
  const notifications = sansCommentaires(lire('src/lib/reseau/notifications.ts'));
  for (const [nom, src] of [['route', route], ['notifications', notifications]]) {
    assert.doesNotMatch(src, /\bfetch\s*\(/, `${nom} : aucun appel sortant`);
    assert.doesNotMatch(src, /waha|api\.whatsapp|wa\.me|whatsapp-helper|sms-gateway|twilio|https?:\/\//i, `${nom} : aucun service de message`);
  }
  assert.match(route, /await notifierAbonnes\(e\.boutique\.id, \{\s*type: 'nouveaute',\s*titre: contenu\.titre,\s*texte: contenu\.texte,\s*lien: contenu\.lien,\s*\}\)/);
  assert.match(route, /evenement: 'STORE_ANNOUNCE'/);
  // notifierAbonnes : follower_id non nul, en base.
  const corps = notifications.slice(notifications.indexOf('export async function notifierAbonnes'), notifications.indexOf('export async function mesNotifications'));
  assert.match(corps, /\.from\('store_follows'\)\s*\.select\('follower_id'\)\s*\.eq\('store_id', boutiqueId\)\s*\.not\('follower_id', 'is', null\)/);
  assert.match(corps, /return notifier\(ids, contenu\);/, 'le nombre renvoyé est celui des notifications écrites');

  const { notifierAbonnes } = require('../src/lib/reseau/notifications.ts');
  baseAwa();
  assert.equal(await notifierAbonnes('s1', { type: 'nouveaute', titre: 'T', lien: 'https://ailleurs.example/x' }), 2);
  assert.deepEqual(etat.notifications.map((n) => n.profile_id).sort(), ['c1', 'c2']);
  assert.ok(etat.notifications.every((n) => n.link === null), 'un lien de notification reste interne');
  assert.equal(await notifierAbonnes('boutique-sans-abonne', { titre: 'T' }), 0);
  // Le type d'événement est déclaré ; journaliser dit s'il a écrit.
  const journal = sansCommentaires(lire('src/lib/reseau/db.ts'));
  assert.match(journal, /export type EvenementAnalytique =[^;]*\| 'STORE_ANNOUNCE';/);
  const { journaliser } = require('../src/lib/reseau/db.ts');
  reinitialiser();
  assert.equal(await journaliser({ evenement: 'STORE_ANNOUNCE', resellerId: 'rev-1' }), true);
  fautes['analytics_events:insert'] = '42P01';
  assert.equal(await journaliser({ evenement: 'STORE_ANNOUNCE', resellerId: 'rev-1' }), false);
});

// ── Annonces fournisseur : boutique principale ──────────────────────────────

test('annoncerNouveauProduit et annoncerBaissePrix : un fournisseur à 2 boutiques prévient les abonnés de sa boutique PRINCIPALE', async () => {
  const { annoncerNouveauProduit, annoncerBaissePrix } = require('../src/lib/reseau/notifications.ts');
  const base = (boutiques) => {
    reinitialiser();
    etat.products = [produit('tv', { name: 'Téléviseur', slug: 'televiseur', supplier_id: 'four-1' })];
    etat.stores = boutiques;
    etat.store_follows = [
      { store_id: 'b1', follower_key: 'p:c1', follower_id: 'c1' },
      { store_id: 'b1', follower_key: 't:22370000002', follower_id: null },
      { store_id: 'b2', follower_key: 'p:c2', follower_id: 'c2' },
    ];
  };
  const deux = [
    { id: 'b1', owner_type: 'supplier', owner_id: 'four-1', name: 'Électro Bamako', principale: true, created_at: '2026-01-01T00:00:00Z' },
    { id: 'b2', owner_type: 'supplier', owner_id: 'four-1', name: 'Électro Annexe', principale: false, created_at: '2026-09-25T00:00:00Z' },
    { id: 'b9', owner_type: 'supplier', owner_id: 'four-9', name: 'Autre fournisseur', created_at: '2025-01-01T00:00:00Z' },
  ];
  base(deux);
  await annoncerNouveauProduit('tv');
  assert.deepEqual(etat.notifications.map((n) => [n.profile_id, n.kind, n.title, n.body, n.link]),
    [['c1', 'nouveaute', 'Nouveau chez Électro Bamako', 'Téléviseur', '/p/televiseur']],
    'avant : la lecture échouait dès la 2e boutique et personne n’était prévenu');

  base(deux);
  await annoncerBaissePrix('tv', 150000, 120000);
  assert.equal(etat.notifications.length, 1);
  assert.equal(etat.notifications[0].profile_id, 'c1');
  assert.equal(etat.notifications[0].title, 'Baisse de prix chez Électro Bamako');
  await annoncerBaissePrix('tv', 100000, 120000);
  assert.equal(etat.notifications.length, 1, 'une hausse n’est pas annoncée');

  // La principale n'est pas la plus ancienne : c'est elle qui compte.
  base([{ ...deux[0], principale: false }, { ...deux[1], principale: true }]);
  await annoncerNouveauProduit('tv');
  assert.deepEqual(etat.notifications.map((n) => [n.profile_id, n.title]), [['c2', 'Nouveau chez Électro Annexe']]);
  // Base sans la colonne « principale » : la plus ancienne.
  base(deux.map(({ principale, ...b }) => b));
  await annoncerNouveauProduit('tv');
  assert.deepEqual(etat.notifications.map((n) => n.profile_id), ['c1']);
  // Sans boutique, ou lecture en échec : rien, sans exception.
  base([]);
  await annoncerNouveauProduit('tv');
  base(deux);
  fautes['stores:select'] = 'XX000';
  await annoncerNouveauProduit('tv');
  assert.equal(etat.notifications.length, 0);

  const src = sansCommentaires(lire('src/lib/reseau/notifications.ts'));
  const lectureBoutique = src.slice(src.indexOf('async function boutiquePrincipaleFournisseur'), src.indexOf('export async function annoncerNouveauProduit'));
  assert.match(lectureBoutique, /\.order\('created_at', \{ ascending: true \}\)\s*\.limit\(10\)/);
  assert.doesNotMatch(lectureBoutique, /maybeSingle/);
  assert.equal((src.match(/await boutiquePrincipaleFournisseur\(a, produit\.supplier_id\)/g) || []).length, 2, 'les deux annonces passent par la boutique principale');
});

// ── « Suivre » ne promet que ce qui arrive ──────────────────────────────────

test('BoutonSuivre : « Vous serez prévenu des nouveautés de cette boutique », sans « promotions »', () => {
  const bouton = lire('src/components/shop/BoutonSuivre.tsx');
  assert.match(bouton, /Vous serez prévenu des nouveautés de cette boutique\./);
  assert.doesNotMatch(bouton, /promotion/i);
  assert.doesNotMatch(sansCommentaires(lire('src/app/boutiques-suivies/page.tsx')), /promotion/i, 'la page des boutiques suivies non plus');
});

// ── Feuille « Prévenir mes abonnés » ────────────────────────────────────────

const APERCU = { titre: 'Nouveautés chez Awa Mode', texte: 'À découvrir : Pagne wax et Théière.', lien: '/boutique/awa-mode', noms: ['Pagne wax', 'Théière'] };
const etatAnnonce = (enPlus = {}) => ({ nouveautes: 2, apercu: APERCU, abonnesAvecCompte: 12, abonnesSansCompte: 3, derniereAnnonce: null, possibleLe: null, ...enPlus });
function rendreFeuille(props = {}) {
  const Feuille = require('../src/components/shop/proprietaire/FeuilleAnnonce.tsx').default;
  return renderToStaticMarkup(React.createElement(Feuille, {
    ouvert: true, onFermer() {}, etat: etatAnnonce(), resultat: null, envoi: false, erreur: null, onEnvoyer() {},
    urlStatut: 'https://app.sugubaml.com/go/AB78X2', ...props,
  }));
}
const texteDe = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, '\'').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ');

test('FeuilleAnnonce : aperçu de la notification, destinataires réels, une seule action « Prévenir mes N abonnés »', () => {
  const html = rendreFeuille();
  assert.match(html, /data-feuille="Prévenir mes abonnés"/);
  assert.match(html, /Nouveautés chez Awa Mode/);
  assert.match(html, /À découvrir : Pagne wax et Théière\./);
  assert.match(html, /12 abonnés avec un compte seront prévenus dans l’application\./);
  assert.match(html, /3 abonnés inscrits par téléphone ne reçoivent rien\./);
  assert.match(html, /Une annonce par 24 h\./);
  assert.equal((html.match(/<button/g) || []).length, 1, 'une seule action');
  assert.match(html, /<button[^>]*type="button"[^>]*>.*Prévenir mes 12 abonnés<\/button>/);
  assert.doesNotMatch(html, /api\.whatsapp\.com/, 'le statut WhatsApp vient APRÈS l’envoi');
  assert.doesNotMatch(html, /<textarea|<input/, 'aucun texte libre');
  assert.doesNotMatch(html, /À la une|commission|gagnez|promo/i);
  // Un seul abonné, aucun par téléphone.
  const un = rendreFeuille({ etat: etatAnnonce({ abonnesAvecCompte: 1, abonnesSansCompte: 0 }) });
  assert.match(un, /1 abonné avec un compte sera prévenu dans l’application\./);
  assert.match(un, /Prévenir mon abonné<\/button>/);
  assert.doesNotMatch(un, /par téléphone/);
  // Envoi en cours : bouton occupé ; erreur du serveur annoncée.
  assert.match(rendreFeuille({ envoi: true }), /<button[^>]*disabled=""[^>]*aria-busy="true"/);
  assert.match(rendreFeuille({ erreur: 'Vos abonnés n’ont pas pu être prévenus. Réessayez.' }), /<p role="alert"[^>]*>Vos abonnés n’ont pas pu être prévenus\. Réessayez\.<\/p>/);
  // Fermée, ou sans aperçu : rien.
  assert.equal(rendreFeuille({ ouvert: false }), '');
  assert.equal(rendreFeuille({ etat: etatAnnonce({ nouveautes: 0, apercu: null }) }), '');
});

test('FeuilleAnnonce : après l’envoi, le chiffre réel puis « Publier sur mon statut WhatsApp » (partage manuel, texte prêt)', () => {
  const { texteStatutAnnonce } = require('../src/lib/annonce-boutique.ts');
  const html = rendreFeuille({ resultat: { prevenus: 11, sansCompte: 3, possibleLe: '2026-10-04T12:00:00.000Z' } });
  assert.match(html, /role="status"/);
  assert.match(html, /11 abonnés prévenus/, 'le chiffre du serveur, pas celui de l’aperçu');
  assert.match(html, /3 abonnés inscrits par téléphone ne reçoivent rien\./);
  assert.match(html, /Prochaine annonce possible le /);
  assert.doesNotMatch(html, /<button/, 'plus de bouton d’envoi');
  const attendu = `https://api.whatsapp.com/send?text=${encodeURIComponent(texteStatutAnnonce({ titre: APERCU.titre, noms: APERCU.noms, url: 'https://app.sugubaml.com/go/AB78X2' }))}`;
  assert.ok(html.includes(`href="${attendu.replace(/&/g, '&amp;')}"`) || html.includes(`href="${attendu}"`), 'lien WhatsApp avec le texte prêt');
  assert.match(html, /target="_blank"/);
  assert.match(html, /Publier sur mon statut WhatsApp<\/a>/);
  assert.match(texteDe(html), /choisissez « Mon statut »/);
  assert.match(texteDe(html), /👉 https:\/\/app\.sugubaml\.com\/go\/AB78X2/, 'le message montré est celui qui part');
  // sansCompte illisible : rien d'affirmé.
  assert.doesNotMatch(rendreFeuille({ resultat: { prevenus: 1, sansCompte: null, possibleLe: null } }), /par téléphone|Prochaine annonce/);
  assert.match(rendreFeuille({ resultat: { prevenus: 1, sansCompte: null, possibleLe: null } }), /1 abonné prévenu/);
});

test('FeuilleAnnonce : annonce de moins de 24 h ou aucun abonné avec compte — message clair, et seulement le statut WhatsApp', () => {
  const demain = new Date(Date.now() + 6 * 3600 * 1000).toISOString();
  let html = rendreFeuille({ etat: etatAnnonce({ possibleLe: demain }) });
  assert.match(html, /Vous avez déjà prévenu vos abonnés : une annonce par 24 h\. Prochaine annonce possible le /);
  assert.doesNotMatch(html, /<button/, 'pas d’envoi proposé');
  assert.match(html, /Publier sur mon statut WhatsApp<\/a>/);

  html = rendreFeuille({ etat: etatAnnonce({ abonnesAvecCompte: 0, abonnesSansCompte: 4 }) });
  assert.match(html, /Aucun de vos abonnés n’a de compte Suguba\./);
  assert.match(html, /4 abonnés inscrits par téléphone ne reçoivent rien\. Seuls les abonnés avec un compte peuvent être prévenus dans l’application\./);
  assert.doesNotMatch(html, /<button/);
  assert.match(html, /Publier sur mon statut WhatsApp<\/a>/);
});

// ── Bouton « Prévenir mes abonnés (N nouveautés) » ──────────────────────────
//
// Pas de DOM dans node:test : le composant est appelé comme une fonction, avec des
// crochets React SIMULÉS pour lui seul (état gardé entre deux appels, effets
// rejoués à la main). Ses appels réseau arrivent aux VRAIES routes, sur la base simulée.

const BOUTON = path.join(RACINE, 'src/components/shop/proprietaire/BoutonAnnonce.tsx');
let crochets = null;
const fauxReact = {
  ...React, __esModule: true, default: React,
  useState: (init) => crochets.useState(init),
  useRef: (init) => crochets.useRef(init),
  useEffect: (f, deps) => crochets.useEffect(f, deps),
  useCallback: (f) => f,
};
const chargerOriginal = Module._load;
Module._load = function (demande, parent, ...reste) {
  if (demande === 'react' && parent && parent.filename === BOUTON) return fauxReact;
  return chargerOriginal.call(this, demande, parent, ...reste);
};

function monterBouton(props = {}) {
  const valeurs = []; const setters = []; const refs = []; let curseur = 0; let curseurRef = 0; let effets = [];
  crochets = {
    useState(init) {
      const k = curseur++;
      if (!(k in valeurs)) valeurs[k] = typeof init === 'function' ? init() : init;
      setters[k] ||= (v) => { valeurs[k] = typeof v === 'function' ? v(valeurs[k]) : v; };
      return [valeurs[k], setters[k]];
    },
    useRef(init) { const k = curseurRef++; refs[k] ||= { current: init }; return refs[k]; },
    useEffect(f) { effets.push(f); },
  };
  const Bouton = require(BOUTON).default;
  const attendre = async () => { for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r)); };
  let premier = true;
  const page = {
    /** Appelle le composant : renvoie { bouton, feuille } (éléments React, ou null). */
    rendre() {
      curseur = 0; curseurRef = 0; effets = [];
      const arbre = Bouton(props);
      if (!arbre) return { bouton: null, feuille: null };
      const enfants = React.Children.toArray(arbre.props.children);
      return { bouton: enfants.find((e) => e.props && e.props['aria-haspopup'] === 'dialog') || null, feuille: enfants.find((e) => e.props && 'etat' in e.props) || null };
    },
    /** Effets : la lecture de l'état au montage seulement ; les autres à chaque rendu. */
    async effets() { effets.forEach((f, i) => { if (i > 0 || premier) f(); }); premier = false; await attendre(); },
    attendre,
  };
  return page;
}
const libelle = (bouton) => texteDe(renderToStaticMarkup(bouton)).trim();
/** fetch du navigateur → les vraies routes, avec la session simulée. */
function brancherRoutes(appels) {
  global.fetch = async (url, init = {}) => {
    appels.push([init.method || 'GET', String(url), init.body ?? null]);
    const module = String(url) === '/api/reseller/boutique/partage'
      ? require('../src/app/api/reseller/boutique/partage/route.ts') : require(ROUTE);
    assert.ok(['/api/reseller/boutique/annonce', '/api/reseller/boutique/partage'].includes(String(url)), `appel inattendu : ${url}`);
    const r = await module[init.method || 'GET'](requete(String(url), { method: init.method || 'GET', ...(init.body ? { body: init.body } : {}) }));
    return { ok: r.status >= 200 && r.status < 300, status: r.status, json: () => r.json() };
  };
}

test('BoutonAnnonce : rien avant la lecture ; « Prévenir mes abonnés (2 nouveautés) » ; envoi sans corps ; résultat réel, puis le bouton d’annonce disparaît', async () => {
  const appels = [];
  brancherRoutes(appels);
  try {
    baseAwa();
    const page = monterBouton();
    assert.deepEqual(page.rendre(), { bouton: null, feuille: null }, 'avant la lecture : rien');
    await page.effets();
    assert.deepEqual(appels, [['GET', '/api/reseller/boutique/annonce', null]]);

    let vue = page.rendre();
    assert.equal(libelle(vue.bouton), 'Prévenir mes abonnés (2 nouveautés)');
    assert.equal(vue.bouton.props.variant, 'secondary', 'jamais l’action principale de la page');
    assert.equal(vue.feuille.props.ouvert, false);
    assert.deepEqual(ecritures(), [], 'afficher le bouton n’écrit rien');

    // Ouvrir la feuille pour lire l'aperçu ne crée rien (ni lien suivi, ni trace).
    vue.bouton.props.onClick();
    vue = page.rendre();
    await page.effets();
    assert.equal(vue.feuille.props.ouvert, true);
    assert.equal(vue.feuille.props.etat.abonnesAvecCompte, 2);
    assert.equal(vue.feuille.props.urlStatut, '/boutique/awa-mode', 'adresse de la boutique tant que le lien suivi n’est pas prêt');
    assert.deepEqual(ecritures(), []);
    assert.equal(appels.length, 1);

    // Envoi : POST sans corps ; double appui = une seule requête.
    const envoi = vue.feuille.props.onEnvoyer();
    page.rendre().feuille.props.onEnvoyer();
    await envoi;
    assert.deepEqual(appels.slice(1), [['POST', '/api/reseller/boutique/annonce', null]]);
    assert.equal(etat.notifications.length, 2);
    vue = page.rendre();
    assert.deepEqual(vue.feuille.props.resultat && [vue.feuille.props.resultat.prevenus, vue.feuille.props.resultat.sansCompte], [2, 1]);
    // Relecture du lot 5 : le bouton d'annonce laisse la place à l'accès au résultat
    // (voir ma-boutique-lot5-relecture) ; plus rien ne propose un second envoi.
    assert.equal(libelle(vue.bouton), 'Annonce envoyée · Publier sur mon statut', 'plus de nouveauté à annoncer : le bouton d’annonce disparaît');
    assert.equal(vue.feuille.props.erreur, null);

    // Le statut WhatsApp est proposé : le lien suivi de la boutique est préparé (POST), une fois.
    await page.effets();
    page.rendre();
    await page.effets();
    assert.deepEqual(appels.slice(2), [['POST', '/api/reseller/boutique/partage', JSON.stringify({ canal: 'whatsapp' })]]);
    assert.match(page.rendre().feuille.props.urlStatut, /^http:\/\/localhost\/go\/[A-Z0-9]{6}$/);
    assert.equal(etat.tracking_links.length, 1);
    assert.equal(etat.tracking_links[0].owner_id, 'rev-1');
  } finally {
    global.fetch = RESEAU_INTERDIT;
  }
});

test('BoutonAnnonce : pas de bouton sans nouveauté, sans abonné, boutique masquée ou lecture en échec ; un refus 429 passe la feuille en « déjà prévenu »', async () => {
  const appels = [];
  brancherRoutes(appels);
  const lu = async (preparer) => {
    baseAwa();
    preparer();
    const page = monterBouton();
    page.rendre();
    await page.effets();
    return page;
  };
  try {
    let page = await lu(() => { etat.reseller_shop_items.forEach((l) => { l.added_at = IL_Y_A(24 * 30); }); });
    assert.deepEqual(page.rendre(), { bouton: null, feuille: null }, 'aucune nouveauté');
    page = await lu(() => { etat.store_follows = []; });
    assert.equal(page.rendre().bouton, null, 'aucun abonné');
    page = await lu(() => { etat.stores[0].status = 'hidden'; });
    assert.deepEqual(page.rendre(), { bouton: null, feuille: null }, 'boutique masquée');
    page = await lu(() => { fautes['analytics_events:select'] = '42P01'; });
    assert.deepEqual(page.rendre(), { bouton: null, feuille: null }, 'journal absent : option masquée');
    page = await lu(() => { sessionCourante = null; });
    assert.deepEqual(page.rendre(), { bouton: null, feuille: null });

    // Abonnés par téléphone seulement : le bouton reste, la feuille ne propose que le statut WhatsApp.
    page = await lu(() => { etat.store_follows = etat.store_follows.filter((f) => !f.follower_id); });
    let vue = page.rendre();
    assert.equal(libelle(vue.bouton), 'Prévenir mes abonnés (2 nouveautés)');
    const { modeAnnonce } = require('../src/lib/annonce-boutique.ts');
    assert.equal(modeAnnonce(vue.feuille.props.etat, false), 'sans_compte');

    // Une annonce est partie d'un autre téléphone entre la lecture et le toucher.
    page = await lu(() => {});
    page.rendre().bouton.props.onClick();
    etat.analytics_events.push({ id: serie++, event: 'STORE_ANNOUNCE', reseller_id: 'rev-1', occurred_at: IL_Y_A(1), meta: {} });
    await page.rendre().feuille.props.onEnvoyer();
    vue = page.rendre();
    assert.equal(vue.feuille.props.resultat, null);
    assert.equal(modeAnnonce(vue.feuille.props.etat, false), 'limite');
    assert.match(vue.feuille.props.erreur, /une annonce par 24 h/);
    assert.equal(etat.notifications.length, 0);
  } finally {
    global.fetch = RESEAU_INTERDIT;
  }
});

test('Mes articles et Statistiques : le bouton est posé ; les appels du composant sont une lecture puis un POST sans corps', () => {
  const articles = sansCommentaires(lire('src/app/reseller/boutique/articles/page.tsx'));
  assert.match(articles, /import BoutonAnnonce from '@\/components\/shop\/proprietaire\/BoutonAnnonce';/);
  assert.match(articles, /<BoutonAnnonce rafraichir=\{articles\.length\} \/>/);
  const stats = sansCommentaires(lire('src/app/reseller/boutique/statistiques/page.tsx'));
  assert.match(stats, /\{enLigne && <BoutonAnnonce \/>\}/, 'absent quand la boutique est masquée');
  const bouton = sansCommentaires(lire('src/components/shop/proprietaire/BoutonAnnonce.tsx'));
  assert.match(bouton, /fetch\('\/api\/reseller\/boutique\/annonce', \{ cache: 'no-store' \}\)/);
  assert.match(bouton, /fetch\('\/api\/reseller\/boutique\/annonce', \{ method: 'POST', cache: 'no-store' \}\)/, 'sans corps : tout est décidé par le serveur');
  assert.match(bouton, /fetch\('\/api\/reseller\/boutique\/partage', \{\s*method: 'POST'/);
  assert.match(bouton, /if \(verrou\.current\) return;/);
  assert.doesNotMatch(bouton, /localStorage|sessionStorage/, 'rien n’est gardé dans le navigateur');
  const feuille = sansCommentaires(lire('src/components/shop/proprietaire/FeuilleAnnonce.tsx'));
  assert.match(feuille, /import Sheet from '@\/components\/ui\/Sheet';/);
  assert.match(feuille, /formatDate\(possibleLe, 'jourHeure'\)/);
  assert.doesNotMatch(feuille, /fetch\(|toLocale/);
});

// ── Guide et reprise ────────────────────────────────────────────────────────

test('Guide : lot 5 en tête du journal ; fiches Mes articles, Statistiques, vitrine et notifications à jour ; REPRISE', () => {
  const guide = JSON.parse(lire('docs/guide/guide.json'));
  assert.equal(guide.majLe, '2026-10-03');
  const rang = guide.journal.findIndex((j) => j.titre === 'Boutique revendeur, lot 5 : prévenir mes abonnés');
  assert.ok(rang >= 0, 'entrée du lot 5');
  const lot5 = guide.journal[rang];
  assert.equal(lot5.date, '2026-10-03');
  assert.equal(lot5.statut, 'en local');
  assert.match(lot5.demande, /^« “Ma boutique” doit montrer la boutique elle-même/);
  assert.ok(lot5.realise.length >= 5);
  assert.ok(lot5.ecarts.length > 0);
  for (const id of ['rev-boutique-articles', 'rev-boutique-stats', 'vitrine-boutique', 'notifications', 'boutiques-suivies']) assert.ok(lot5.pages.includes(id), id);
  assert.equal(guide.journal[rang + 1].titre, 'Boutique revendeur, lot 4 : corrections de relecture', 'juste avant la relecture du lot 4');
  const fiche = (id) => JSON.stringify(guide.pages.find((p) => p.id === id));
  assert.match(fiche('rev-boutique-articles'), /Prévenir mes abonnés \(N nouveautés\)/);
  assert.match(fiche('rev-boutique-stats'), /Prévenir mes abonnés \(N nouveautés\)/);
  assert.match(fiche('rev-boutique-articles'), /une annonce par 24 h/i);
  assert.match(fiche('rev-boutique-articles'), /Publier sur mon statut WhatsApp/);
  assert.match(fiche('vitrine-boutique'), /Vous serez prévenu des nouveautés de cette boutique/);
  assert.doesNotMatch(fiche('vitrine-boutique'), /promotions/);
  assert.match(fiche('notifications'), /Nouveautés chez/);
  // Relecture du lot 5 : une ligne plus récente passe en tête de REPRISE.
  assert.ok(lire('REPRISE.md').split('\n').some((l) => l.startsWith('> **') && /boutique revendeur, lot 5 « Prévenir mes abonnés »/.test(l)));
});
