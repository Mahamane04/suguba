// TEST-BOUTIQUE-LOT4-001..020 (chantier boutique du revendeur, 2026-10-03, lot 4
// « Partager et mesurer ») : lien suivi PERMANENT de la boutique (réutilisé par
// canal), rayon dans la ref (« slug~cle »), feuille « Partager ma boutique »
// (message, choix, libellés de « Mes partages »), visites mesurées honnêtement
// (2 s visibles, hors propriétaire et robots, une par visiteur et par jour, aucune
// IP), statistiques sans chiffre inventé, canonical, retour vers la boutique depuis
// la fiche produit, preuve sociale réelle, étape « Partager ma boutique ».
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

// ── Base simulée : chaque opération est enregistrée avec ses filtres ─────────
let etat; let fautes; let operations;
function reinitialiser() {
  etat = {
    stores: [], profiles: [], profile_roles: [], reseller_shop_items: [], products: [], reseller_prices: [],
    tracking_links: [], tracking_clicks: [], analytics_events: [], orders: [], store_follows: [], visites_mesurees: [], commissions: [],
  };
  fautes = {}; operations = [];
}
const valeur = (r, k) => {
  if (k.includes('->>')) { const [col, cle] = k.split('->>'); return r[col] ? r[col][cle] : undefined; }
  return r[k];
};
const db = {
  from(table) {
    let op = 'select'; let patch; const filtres = []; const egalites = {}; let un = false; let tete = false; let limite = null; let tri = null;
    const q = {
      select(_colonnes, options) { if (options && options.head) tete = true; return q; },
      eq(k, v) { egalites[k] = v; filtres.push((r) => valeur(r, k) === v); return q; },
      neq(k, v) { filtres.push((r) => valeur(r, k) !== v); return q; },
      gte(k, v) { filtres.push((r) => String(valeur(r, k)) >= String(v)); return q; },
      gt(k, v) { filtres.push((r) => String(valeur(r, k)) > String(v)); return q; },
      ilike(k, v) { filtres.push((r) => String(r[k]).toLowerCase() === String(v).toLowerCase()); return q; },
      in(k, v) { filtres.push((r) => v.includes(r[k])); return q; },
      is() { return q; }, or() { return q; },
      order(k, o) { tri = { k, asc: !o || o.ascending !== false }; return q; },
      limit(n) { limite = n; return q; },
      insert(p) { op = 'insert'; patch = p; return q; },
      update(p) { op = 'update'; patch = p; return q; },
      upsert(p) { op = 'upsert'; patch = p; return q; },
      delete() { op = 'delete'; return q; },
      maybeSingle() { un = true; return q; },
      then(resolve, reject) {
        operations.push({ table, op, patch, egalites });
        if (fautes[`${table}:${op}`]) return Promise.resolve({ data: null, count: null, error: { code: fautes[`${table}:${op}`] } }).then(resolve, reject);
        let lignes = (etat[table] || []).filter((r) => filtres.every((f) => f(r)));
        if (tri) lignes = [...lignes].sort((a, b) => (String(a[tri.k]) < String(b[tri.k]) ? -1 : String(a[tri.k]) > String(b[tri.k]) ? 1 : 0) * (tri.asc ? 1 : -1));
        if (op === 'insert') { const ligne = { created_at: new Date().toISOString(), occurred_at: new Date().toISOString(), ...patch }; (etat[table] ||= []).push(ligne); lignes = [ligne]; }
        if (op === 'update') lignes.forEach((r) => Object.assign(r, patch));
        if (op === 'delete') etat[table] = (etat[table] || []).filter((r) => !lignes.includes(r));
        if (limite !== null && op === 'select') lignes = lignes.slice(0, limite);
        const data = tete ? null : un ? (lignes[0] ? { ...lignes[0] } : null) : lignes.map((r) => ({ ...r }));
        return Promise.resolve({ data, count: lignes.length, error: null }).then(resolve, reject);
      },
    };
    return q;
  },
  async rpc(nom) { return { data: nom === 'rafraichir_abonnes_boutique' ? 1 : null, error: null }; },
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
const marqueur = (nom) => ({ __esModule: true, default: (p) => React.createElement('i', { 'data-marqueur': nom, 'data-props': JSON.stringify(p || {}) }) });
for (const [fichier, nom] of [['common/Header', 'entete'], ['common/BottomNav', 'barre'], ['common/Footer', 'pied'],
  ['common/AncrageRevendeur', 'ancrage'], ['shop/ShopShareBar', 'partage'], ['common/QrCode', 'qr'], ['shop/VisiteBoutique', 'visite']]) {
  require.cache[require.resolve(`../src/components/${fichier}.tsx`)] = { exports: marqueur(nom) };
}
require.cache[require.resolve('../src/components/product/ProductCard.tsx')] = {
  exports: { __esModule: true, default: ({ produit }) => React.createElement('i', { 'data-carte': produit.nom }) },
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
const NAVIGATEUR = 'Mozilla/5.0 (Linux; Android 13; SM-A135F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36';
const IL_Y_A = (jours) => new Date(Date.now() - jours * 24 * 3600 * 1000).toISOString();
const produit = (id, enPlus = {}) => ({
  id, slug: `slug-${id}`, name: `Article ${id}`, category: 'Mode', images: [], public_price: 10000, stock: 5,
  reseller_commission: 1000, pricing_status: 'ok', status: 'approved', ...enPlus,
});
const boutiqueAwa = (enPlus = {}) => ({ id: 's1', owner_type: 'reseller', owner_id: 'rev-1', slug: 'awa-mode', name: 'Awa Mode', tagline: null, status: 'active', followers_count: 0, ...enPlus });
function baseAwa() {
  reinitialiser();
  etat.profiles = [{ id: 'rev-1', full_name: 'Awa Traoré Diallo', reseller_code: 'AWA1', metadata: {} }];
  etat.profile_roles = [{ profile_id: 'rev-1', role: 'reseller', status: 'active' }];
  etat.stores = [boutiqueAwa()];
}

// ── Codes : ref « slug~cle » ────────────────────────────────────────────────

test('destinationDuLien : « slug~cle » ouvre le rayon ; une clé invalide est ignorée', () => {
  const C = require('../src/lib/reseau/codes.ts');
  assert.equal(C.destinationDuLien('store', 'awa-mode~pagnes', 'SG-1', 'AB78X2'), '/boutique/awa-mode?rayon=pagnes&ref=SG-1&via=AB78X2');
  assert.equal(C.destinationDuLien('store', 'awa-mode~coups-de-coeur', null, 'AB78X2'), '/boutique/awa-mode?rayon=coups-de-coeur&via=AB78X2');
  for (const invalide of ['awa-mode~Pagnes', 'awa-mode~', 'awa-mode~a b', `awa-mode~${'x'.repeat(41)}`, 'awa-mode~../admin']) {
    assert.equal(C.destinationDuLien('store', invalide, 'SG-1', 'AB78X2'), '/boutique/awa-mode?ref=SG-1&via=AB78X2', invalide);
  }
  assert.equal(C.destinationDuLien('store', '~pagnes', 'SG-1', 'AB78X2'), '/?ref=SG-1&via=AB78X2', 'sans adresse : l’accueil');
  // Cas existants inchangés.
  assert.equal(C.destinationDuLien('store', 'awa-mode', 'SG-1', 'AB78X2'), '/boutique/awa-mode?ref=SG-1&via=AB78X2');
  assert.equal(C.destinationDuLien('product', 'tv', 'SG-1', 'AB78X2'), '/p/tv?ref=SG-1&via=AB78X2');
  assert.equal(C.refBoutique('awa-mode', 'pagnes'), 'awa-mode~pagnes');
  assert.equal(C.refBoutique('awa-mode', 'Pagnes!'), 'awa-mode', 'clé invalide jamais écrite');
  assert.deepEqual(C.lireRefBoutique('awa-mode~pagnes'), { slug: 'awa-mode', rayon: 'pagnes' });
});

// ── lienPermanent ───────────────────────────────────────────────────────────

test('lienPermanent : un lien existant (même propriétaire, ref et canal) est renvoyé sans insert ; un autre canal crée un lien', async () => {
  const { lienPermanent } = require('../src/lib/reseau/db.ts');
  reinitialiser();
  etat.tracking_links = [
    { code: 'ANCIEN', owner_id: 'rev-1', target_type: 'store', target_ref: 'awa-mode', channel: 'whatsapp', created_at: '2026-10-01T00:00:00Z', clicks: 4 },
    { code: 'RECENT', owner_id: 'rev-1', target_type: 'store', target_ref: 'awa-mode', channel: 'whatsapp', created_at: '2026-10-02T00:00:00Z', clicks: 0 },
    { code: 'AUTRUI', owner_id: 'rev-2', target_type: 'store', target_ref: 'awa-mode', channel: 'qr', created_at: '2026-10-01T00:00:00Z' },
  ];
  let r = await lienPermanent({ ownerId: 'rev-1', ownerRole: 'reseller', cible: 'store', ref: 'awa-mode', canal: 'whatsapp' });
  assert.equal(r.cree, false);
  assert.equal(r.lien.code, 'ANCIEN', 'le PREMIER lien qui correspond');
  assert.deepEqual(ecritures(), [], 'ni lien ni SHARE');

  r = await lienPermanent({ ownerId: 'rev-1', ownerRole: 'reseller', cible: 'store', ref: 'awa-mode', canal: 'qr' });
  assert.equal(r.cree, true);
  assert.notEqual(r.lien.code, 'AUTRUI', 'jamais le lien d’un autre revendeur');
  const inserts = ecritures();
  assert.deepEqual(inserts.map((o) => [o.table, o.op]), [['tracking_links', 'insert'], ['analytics_events', 'insert']]);
  assert.equal(inserts[0].patch.owner_id, 'rev-1');
  assert.equal(inserts[0].patch.channel, 'qr');
  assert.equal(inserts[0].patch.target_ref, 'awa-mode');
  assert.equal(inserts[1].patch.event, 'SHARE', 'SHARE journalisé à la création');
  assert.equal(inserts[1].patch.reseller_id, 'rev-1');
  // Rejoué : le lien qr existe désormais, aucune écriture.
  operations = [];
  r = await lienPermanent({ ownerId: 'rev-1', ownerRole: 'reseller', cible: 'store', ref: 'awa-mode', canal: 'qr' });
  assert.equal(r.cree, false);
  assert.deepEqual(ecritures(), []);
  // Lecture en échec : rien n'est créé (un doublon vaut moins que l'adresse brute).
  fautes['tracking_links:select'] = 'XX000';
  operations = [];
  assert.equal(await lienPermanent({ ownerId: 'rev-1', cible: 'store', ref: 'awa-mode~pagnes', canal: 'whatsapp' }), null);
  assert.deepEqual(ecritures(), []);
});

// ── Route privée GET /api/reseller/boutique/partage ─────────────────────────

test('GET /api/reseller/boutique/partage : session revendeur, boutique de la SESSION, /go/<code> réutilisé, repli brut', async () => {
  const { GET } = require('../src/app/api/reseller/boutique/partage/route.ts');
  baseAwa();
  sessionCourante = null;
  assert.equal((await GET(requete('/api/reseller/boutique/partage'))).status, 401);
  sessionCourante = revendeur('rev-1', { role: 'customer', roles: { customer: 'active', reseller: 'active' } });
  assert.equal((await GET(requete('/api/reseller/boutique/partage'))).status, 401);

  sessionCourante = revendeur('rev-1');
  assert.equal((await GET(requete('/api/reseller/boutique/partage?canal=facebook'))).status, 400);
  assert.equal((await GET(requete('/api/reseller/boutique/partage?rayon=Pagnes'))).status, 400);

  let json = await (await GET(requete('/api/reseller/boutique/partage?canal=whatsapp&owner=rev-2'))).json();
  assert.equal(json.suivi, true);
  assert.match(json.url, /^http:\/\/localhost\/go\/[A-Z0-9]{6}$/);
  const premier = json.url;
  json = await (await GET(requete('/api/reseller/boutique/partage?canal=whatsapp'))).json();
  assert.equal(json.url, premier, 'un second partage WhatsApp réutilise le même /go/<code>');
  assert.equal(etat.tracking_links.length, 1);
  assert.equal(etat.tracking_links[0].owner_id, 'rev-1');

  // Rayon : ref « slug~cle », libellé gardé pour « Mes partages ».
  json = await (await GET(requete('/api/reseller/boutique/partage?canal=whatsapp&rayon=pagnes&nom=%3Cb%3EPagnes%3C%2Fb%3E'))).json();
  assert.equal(json.suivi, true);
  const rayon = etat.tracking_links.find((l) => l.target_ref === 'awa-mode~pagnes');
  assert.ok(rayon);
  assert.equal(rayon.label, 'bPagnes/b', 'ni balise ni caractère de contrôle');
  assert.equal(etat.analytics_events.filter((e) => e.event === 'SHARE').length, 2, 'SHARE à la création seulement');

  // Suivi indisponible : l'adresse brute, jamais d'erreur.
  fautes['tracking_links:select'] = '42P01';
  json = await (await GET(requete('/api/reseller/boutique/partage?canal=qr&rayon=coups-de-coeur'))).json();
  assert.deepEqual(json, { url: 'http://localhost/boutique/awa-mode?rayon=coups-de-coeur', suivi: false });

  // Boutique masquée : on ne partage pas une page introuvable.
  delete fautes['tracking_links:select'];
  etat.stores[0].status = 'hidden';
  assert.equal((await GET(requete('/api/reseller/boutique/partage'))).status, 409);
});

// ── Règles pures du partage ─────────────────────────────────────────────────

test('partage-boutique : choix (boutique, coups de cœur, rayons), 3 articles au vrai prix, « vous payez à la livraison »', () => {
  const P = require('../src/lib/partage-boutique.ts');
  const { formatF } = require('../src/lib/montant.ts');
  assert.equal(P.cleRayon('Électroménager & cuisine'), 'electromenager-cuisine');
  assert.equal(P.cleRayon('Cœur de Bamako'), 'coeur-de-bamako', 'ligature œ');
  assert.equal(P.cleRayon(''), 'autres-articles');
  assert.equal(P.cleRayon('Coups de cœur'), 'coups-de-coeur-rayon', 'clé réservée jamais prise par un rayon');
  assert.match(P.cleRayon('x'.repeat(80)), /^[a-z0-9-]{1,40}$/);
  const articles = [
    { nom: 'Pagne wax', prix: 12500, categorie: 'Pagnes', coupDeCoeur: true, enStock: true },
    { nom: 'Bazin', prix: 30000, categorie: 'Pagnes', enStock: true },
    { nom: 'Théière', prix: 3500, categorie: 'Cuisine', enStock: true },
    { nom: 'Marmite', prix: 9000, categorie: 'Cuisine', enStock: false },
    { nom: 'Bol', prix: 1500, categorie: 'Cuisine', enStock: true },
  ];
  assert.deepEqual(P.choixDePartage(articles), [
    { cle: null, libelle: 'Toute ma boutique', nombre: 5 },
    { cle: 'coups-de-coeur', libelle: 'Mes coups de cœur', nombre: 1 },
    { cle: 'pagnes', libelle: 'Pagnes', nombre: 1 },
    { cle: 'cuisine', libelle: 'Cuisine', nombre: 3 },
  ]);
  // Un seul rayon : pas de choix de rayon (ce serait la boutique entière).
  assert.deepEqual(P.choixDePartage(articles.slice(2)).map((c) => c.cle), [null]);
  assert.deepEqual(P.articlesAAnnoncer(articles, null).map((a) => a.nom), ['Pagne wax', 'Bazin', 'Théière'], 'coups de cœur d’abord');
  assert.deepEqual(P.articlesAAnnoncer(articles, 'cuisine').map((a) => a.nom), ['Théière', 'Bol'], 'épuisé jamais cité');
  const texte = P.texteBoutique({ identite: { nom: 'Awa Mode', enseigne: true }, choix: null, articles: P.articlesAAnnoncer(articles, null), url: 'https://app.sugubaml.com/go/AB78X2' });
  assert.match(texte, /^🛍️ \*Awa Mode\* sur Suguba/);
  assert.ok(texte.includes(`• Pagne wax : ${formatF(12500)}`), 'prix en formatF');
  assert.match(texte, /Vous payez à la livraison/);
  assert.ok(texte.endsWith('👉 https://app.sugubaml.com/go/AB78X2'));
  const sansEnseigne = P.texteBoutique({ identite: { nom: 'Awa D.', enseigne: false }, choix: { cle: 'cuisine', libelle: 'Cuisine' }, articles: [], url: 'u' });
  assert.match(sansEnseigne, /Cuisine · \*La sélection de Awa D\.\*/);
  assert.doesNotMatch(sansEnseigne, /•/, 'aucun article inventé');
  assert.match(P.texteBoutique({ identite: { nom: 'Awa Mode', enseigne: true }, choix: { cle: 'coups-de-coeur', libelle: 'Mes coups de cœur' }, articles: [], url: 'u' }), /Mes coups de cœur · \*Awa Mode\*/);
  assert.doesNotMatch(texte + sansEnseigne, /À la une|commission|gagnez/i);
  // « Mes partages » : libellés.
  assert.equal(P.libellePartageBoutique('awa-mode', null), 'Ma boutique');
  assert.equal(P.libellePartageBoutique('awa-mode~coups-de-coeur', null), 'Ma boutique · Coups de cœur');
  assert.equal(P.libellePartageBoutique('awa-mode~pagnes', 'Pagnes'), 'Ma boutique · Pagnes');
  assert.equal(P.libellePartageBoutique('awa-mode~electromenager', null), 'Ma boutique · Electromenager');
  // Articles de « Mes articles » : affichés et épuisés seulement, sans gain.
  const vus = P.versArticlesPartage([
    { nom: 'A', prixVitrine: 1000, categorie: 'X', coupDeCoeur: false, etat: 'affiche', gain: 300 },
    { nom: 'B', prixVitrine: 2000, categorie: null, coupDeCoeur: true, etat: 'epuise' },
    { nom: 'C', prixVitrine: 3000, categorie: 'X', coupDeCoeur: false, etat: 'retire' },
  ]);
  assert.deepEqual(vus, [
    { nom: 'A', prix: 1000, categorie: 'X', coupDeCoeur: false, enStock: true },
    { nom: 'B', prix: 2000, categorie: null, coupDeCoeur: true, enStock: false },
  ]);
  const partages = sansCommentaires(lire('src/app/reseller/partages/page.tsx'));
  assert.match(partages, /if \(l\.cible === 'store'\) return libellePartageBoutique\(l\.ref, l\.libelle\);/);
});

// ── Visites mesurées : POST /api/reseau/visite-boutique ─────────────────────

const visiter = (corps, entetes = {}) => require('../src/app/api/reseau/visite-boutique/route.ts')
  .POST(requete('/api/reseau/visite-boutique', { method: 'POST', body: JSON.stringify(corps), headers: { 'user-agent': NAVIGATEUR, 'x-real-ip': '41.73.1.2', ...entetes } }));

test('visite-boutique : rien d’écrit pour le propriétaire, un robot d’aperçu WhatsApp ou une boutique masquée ; toujours 204', async () => {
  baseAwa();
  sessionCourante = revendeur('rev-1');
  let r = await visiter({ slug: 'awa-mode' });
  assert.equal(r.status, 204);
  sessionCourante = revendeur('rev-1', { role: 'customer', roles: { customer: 'active', reseller: 'active' } });
  assert.equal((await visiter({ slug: 'awa-mode' })).status, 204, 'même sous un autre profil');
  sessionCourante = null;
  assert.equal((await visiter({ slug: 'awa-mode' }, { 'user-agent': 'WhatsApp/2.23.20.0 A' })).status, 204);
  assert.equal((await visiter({ slug: 'awa-mode' }, { 'user-agent': '' })).status, 204);
  etat.stores[0].status = 'hidden';
  assert.equal((await visiter({ slug: 'awa-mode' })).status, 204);
  assert.equal((await visiter({ slug: 'inconnue' })).status, 204);
  etat.stores[0].status = 'active';
  assert.equal((await visiter({ slug: 'awa-mod_' })).status, 204, 'jamais de joker dans l’adresse');
  assert.equal((await visiter({ slug: '%' })).status, 204);
  assert.deepEqual(ecritures(), [], 'aucune visite comptée');
});

test('visite-boutique : deux appels du même visiteur le même jour = 1 visite ; meta sans IP ni navigateur en clair ; origine du lien', async () => {
  baseAwa();
  sessionCourante = null;
  etat.tracking_links = [{ code: 'AB78X2', owner_id: 'rev-1', target_type: 'store', target_ref: 'awa-mode', channel: 'qr' }];
  assert.equal((await visiter({ slug: 'awa-mode', via: 'ab78x2' })).status, 204);
  assert.equal((await visiter({ slug: 'awa-mode', via: 'ab78x2' })).status, 204);
  const vues = etat.analytics_events.filter((e) => e.event === 'STORE_VIEW');
  assert.equal(vues.length, 1, 'une visite par visiteur et par jour');
  const v = vues[0];
  assert.equal(v.reseller_id, 'rev-1');
  assert.equal(v.subject_type, 'store');
  assert.equal(v.subject_ref, 's1', 'l’identifiant de la boutique, stable si l’adresse change');
  assert.equal(v.link_code, 'AB78X2');
  assert.equal(v.actor_id, null);
  assert.equal(v.meta.canal, 'qr');
  assert.match(v.meta.v, /^[0-9a-f]{32}$/);
  const brut = JSON.stringify(v);
  assert.doesNotMatch(brut, /41\.73\.1\.2|Mozilla|Android/, 'ni IP ni navigateur en clair');
  // Un autre visiteur (autre adresse) : une seconde visite, origine « direct » sans lien.
  await visiter({ slug: 'awa-mode' }, { 'x-real-ip': '41.73.9.9' });
  assert.equal(etat.analytics_events.filter((e) => e.event === 'STORE_VIEW').length, 2);
  assert.equal(etat.analytics_events.at(-1).meta.canal, 'direct');
  assert.equal(etat.analytics_events.at(-1).link_code, null);
  // Le lien d'un AUTRE revendeur ne donne pas d'origine à cette boutique.
  etat.tracking_links.push({ code: 'ZZZ999', owner_id: 'rev-2', target_type: 'store', target_ref: 'autre', channel: 'whatsapp' });
  await visiter({ slug: 'awa-mode', via: 'ZZZ999' }, { 'x-real-ip': '41.73.8.8' });
  assert.equal(etat.analytics_events.at(-1).meta.canal, 'direct');
  // Lecture préalable en échec : rien n'est écrit.
  const avant = etat.analytics_events.length;
  fautes['analytics_events:select'] = 'XX000';
  await visiter({ slug: 'awa-mode' }, { 'x-real-ip': '41.73.7.7' });
  assert.equal(etat.analytics_events.length, avant);
});

test('VisiteBoutique : après 2 s de page visible, en keepalive ; monté seulement pour un visiteur d’une boutique en ligne', async () => {
  const src = sansCommentaires(lire('src/components/shop/VisiteBoutique.tsx'));
  assert.match(src, /DELAI_VISITE_MS = 2000/);
  assert.match(src, /document\.visibilityState !== 'visible'/);
  assert.match(src, /visibilitychange/);
  assert.match(src, /keepalive: true/);
  assert.match(src, /'\/api\/reseau\/visite-boutique'/);
  // La page : visite pour un visiteur, jamais pour le propriétaire ni une boutique masquée.
  const page = require('../src/app/boutique/[slug]/page.tsx');
  const ouvrir = (slug, recherche = {}) => page.default({ params: Promise.resolve({ slug }), searchParams: Promise.resolve(recherche) });
  baseAwa();
  sessionCourante = null;
  let el = await ouvrir('awa-mode', { via: 'ab78x2', rayon: 'pagnes' });
  assert.deepEqual(el.props.visite, { slug: 'awa-mode', via: 'AB78X2' });
  assert.equal(el.props.rayon, 'pagnes');
  assert.equal(el.props.suiviProprietaire, null, 'aucune mesure du propriétaire dans le HTML d’un visiteur');
  assert.equal(el.props.partager, false);
  el = await ouvrir('awa-mode', { rayon: '../x' });
  assert.equal(el.props.rayon, null, 'clé invalide ignorée');
  sessionCourante = revendeur('rev-1');
  el = await ouvrir('awa-mode', { partager: '1' });
  assert.equal(el.props.visite, null, 'le propriétaire n’est jamais compté');
  assert.equal(el.props.partager, true);
  sessionCourante = revendeur('rev-1', { role: 'customer', roles: { customer: 'active', reseller: 'active' } });
  el = await ouvrir('awa-mode', { partager: '1' });
  assert.equal(el.props.visite, null);
  assert.equal(el.props.partager, false, 'feuille de partage seulement en gestion');
  assert.deepEqual(ecritures(), [], 'afficher une vitrine n’écrit rien');
  // ShopView : le marqueur de visite pour un visiteur, jamais pour le propriétaire.
  const ShopView = require('../src/components/shop/ShopView.tsx').default;
  const vitrine = { type: 'revendeur', nom: 'Awa Mode', enseigne: true, categorie: null, logo: null, couverture: null, description: null,
    produits: [{ id: 'p1', slug: 'p1', nom: 'Robe', categorie: 'Mode', image: null, images: [], prix: 5000, enStock: true, garantieMois: 0 }], livraisons: 0, selectionVide: false, code: 'AWA1' };
  assert.match(renderToStaticMarkup(React.createElement(ShopView, { boutique: vitrine, urlPartage: 'u', refCode: 'AWA1', visite: { slug: 'awa-mode', via: null } })), /data-marqueur="visite"/);
  assert.doesNotMatch(renderToStaticMarkup(React.createElement(ShopView, { boutique: vitrine, urlPartage: 'u', refCode: 'AWA1', visite: { slug: 'awa-mode', via: null }, proprietaire: { statut: 'active', abonnes: 0, gestion: true } })), /data-marqueur="visite"/);
});

// ── Vitrine du propriétaire : Stats « 7 j : N visites », premier partage ────

test('/boutique/<adresse> : « 7 j : N visites » et premier partage calculés pour le propriétaire seul', async () => {
  const page = require('../src/app/boutique/[slug]/page.tsx');
  baseAwa();
  etat.analytics_events = [
    { event: 'STORE_VIEW', subject_ref: 's1', occurred_at: IL_Y_A(1), meta: { v: 'a' } },
    { event: 'STORE_VIEW', subject_ref: 's1', occurred_at: IL_Y_A(3), meta: { v: 'b' } },
    { event: 'STORE_VIEW', subject_ref: 's1', occurred_at: IL_Y_A(20), meta: { v: 'c' } },
    { event: 'STORE_VIEW', subject_ref: 'autre', occurred_at: IL_Y_A(1), meta: { v: 'd' } },
  ];
  sessionCourante = revendeur('rev-1');
  let el = await page.default({ params: Promise.resolve({ slug: 'awa-mode' }), searchParams: Promise.resolve({}) });
  assert.deepEqual(el.props.suiviProprietaire, { visites7j: 2, dejaPartage: false });
  etat.tracking_links = [{ code: 'AB78X2', owner_id: 'rev-1', target_type: 'store', target_ref: 'awa-mode', channel: 'whatsapp' }];
  el = await page.default({ params: Promise.resolve({ slug: 'awa-mode' }), searchParams: Promise.resolve({}) });
  assert.equal(el.props.suiviProprietaire.dejaPartage, true);
  // Mesure illisible : « — », jamais 0.
  fautes['analytics_events:select'] = 'XX000';
  el = await page.default({ params: Promise.resolve({ slug: 'awa-mode' }), searchParams: Promise.resolve({}) });
  assert.equal(el.props.suiviProprietaire.visites7j, null);

  const Bandeau = require('../src/components/shop/proprietaire/BandeauProprietaire.tsx').default;
  const identite = { nom: 'Awa Mode', enseigne: true, accroche: null, logo: null, couverture: null };
  const rendre = (visites7j) => renderToStaticMarkup(React.createElement(Bandeau, { identite, statut: 'active', urlPartage: 'https://x/boutique/awa-mode', visites7j }));
  assert.match(rendre(12), /<a href="\/reseller\/boutique\/statistiques"[^>]*>[\s\S]*?Stats<\/span><span[^>]*>7 j : 12 visites<\/span>/);
  assert.match(rendre(1), /7 j : 1 visite</);
  assert.match(rendre(null), /7 j : —</);
  assert.match(rendre(0), /href="\/reseller\/outils"/, '« Tous mes outils » reste dans le bandeau');
  assert.doesNotMatch(rendre(3), /commission|gagnez|\bgains?\b|À la une/i);
});

test('Étape « Partager ma boutique » : 8e étape, cochée par un lien suivi de la boutique ; /api/reseller/me la lit', async () => {
  const { etapesBoutique } = require('../src/lib/reseau/etapes-boutique.ts');
  const etape = (partage) => etapesBoutique({ enseigne: true, logo: 'l', couverture: 'c', accueil: 'a', articles: 5, coupsDeCoeur: 1, partage }).find((e) => e.cle === 'partage');
  assert.deepEqual([etape(true).fait, etape(false).fait, etape(null).fait, etape(undefined).fait], [true, false, false, false]);
  assert.equal(etape(true).href, '/reseller/ma-boutique?partager=1');
  assert.equal(etape(true).libelle, 'Partager ma boutique');

  const { GET } = require('../src/app/api/reseller/me/route.ts');
  baseAwa();
  sessionCourante = revendeur('rev-1');
  let json = await (await GET(requete('/api/reseller/me?avec=boutique'))).json();
  assert.equal(json.boutique.etapes.find((e) => e.cle === 'partage').fait, false);
  assert.equal(json.boutique.enseigne, true);
  etat.tracking_links = [{ code: 'P1', owner_id: 'rev-1', target_type: 'product', target_ref: 'tv', channel: 'whatsapp' }];
  json = await (await GET(requete('/api/reseller/me?avec=boutique'))).json();
  assert.equal(json.boutique.etapes.find((e) => e.cle === 'partage').fait, false, 'un lien de produit ne compte pas');
  etat.tracking_links.push({ code: 'S1', owner_id: 'rev-1', target_type: 'store', target_ref: 'awa-mode', channel: 'qr' });
  json = await (await GET(requete('/api/reseller/me?avec=boutique'))).json();
  assert.equal(json.boutique.etapes.find((e) => e.cle === 'partage').fait, true);
  assert.deepEqual(ecritures(), [], 'lecture seule');
});

// ── Statistiques ────────────────────────────────────────────────────────────

const stats = (q = '') => require('../src/app/api/reseller/boutique/stats/route.ts').GET(requete(`/api/reseller/boutique/stats${q}`));

test('GET /api/reseller/boutique/stats : 401 sans session revendeur ; période 7 ou 30 seulement', async () => {
  baseAwa();
  sessionCourante = null;
  assert.equal((await stats()).status, 401);
  sessionCourante = revendeur('rev-1', { role: 'supplier', roles: { supplier: 'active', reseller: 'active' } });
  assert.equal((await stats()).status, 401);
  sessionCourante = revendeur('rev-1');
  assert.equal((await stats('?jours=14')).status, 400);
  assert.equal((await stats('?jours=30')).status, 200);
});

test('Stats, base vide : 0 là où la source existe ; null pour les articles vus quand visites_mesurees répond 42P01 ; rien sans source', async () => {
  baseAwa();
  sessionCourante = revendeur('rev-1');
  fautes['visites_mesurees:select'] = '42P01';
  let json = await (await stats('?jours=7')).json();
  assert.equal(json.jours, 7);
  for (const cle of ['visites', 'visiteurs', 'clics', 'commandes', 'livrees', 'gains', 'abonnes', 'nouveauxAbonnes']) assert.equal(json[cle], 0, cle);
  assert.equal(json.articlesVus, null);
  assert.equal(json.mesureDepuis, null, 'aucune visite : pas de date inventée');
  assert.equal(json.serie.length, 7);
  assert.ok(json.serie.every((p) => p.valeur === 0));
  assert.deepEqual(json.origine, { whatsapp: 0, qr: 0, autre: 0, direct: 0 });
  assert.deepEqual(json.boutique, { slug: 'awa-mode', nom: 'Awa Mode', enseigne: true, statut: 'active' });
  assert.doesNotMatch(JSON.stringify(json), /Traoré|Diallo|conversion|taux/i, 'ni nom complet, ni taux calculé');
  assert.equal(typeof json.conseil, 'string');
  // Une source qui manque : null, jamais 0 ; et aucun conseil sans visites mesurées.
  fautes['analytics_events:select'] = 'XX000';
  fautes['orders:select'] = 'XX000';
  fautes['tracking_links:select'] = 'XX000';
  json = await (await stats()).json();
  for (const cle of ['visites', 'visiteurs', 'serie', 'origine', 'commandes', 'livrees', 'gains', 'clics', 'conseil']) assert.equal(json[cle], null, cle);
  assert.deepEqual(ecritures(), [], 'lecture seule');
  // Sans boutique : rien de la boutique, les commandes restent comptées.
  reinitialiser();
  etat.profiles = [{ id: 'rev-1', full_name: 'Awa Traoré Diallo', reseller_code: 'AWA1' }];
  json = await (await stats()).json();
  assert.equal(json.boutique, null);
  assert.equal(json.visites, null);
  assert.equal(json.commandes, 0);
});

test('Stats avec données : visites, visiteurs distincts, origine, commandes à son nom hors annulées, gains livrés, abonnés, 3 articles les plus vus', async () => {
  baseAwa();
  etat.stores[0].followers_count = 5;
  sessionCourante = revendeur('rev-1');
  etat.analytics_events = [
    { event: 'STORE_VIEW', subject_ref: 's1', occurred_at: IL_Y_A(0), meta: { v: 'a', canal: 'whatsapp' } },
    { event: 'STORE_VIEW', subject_ref: 's1', occurred_at: IL_Y_A(1), meta: { v: 'a', canal: 'whatsapp' } },
    { event: 'STORE_VIEW', subject_ref: 's1', occurred_at: IL_Y_A(2), meta: { v: 'b', canal: 'qr' } },
    { event: 'STORE_VIEW', subject_ref: 's1', occurred_at: IL_Y_A(3), meta: { v: 'c', canal: 'direct' } },
    { event: 'STORE_VIEW', subject_ref: 's1', occurred_at: IL_Y_A(40), meta: { v: 'd', canal: 'direct' } },
    { event: 'STORE_VIEW', subject_ref: 'autre', occurred_at: IL_Y_A(0), meta: { v: 'e' } },
    { event: 'CLICK', subject_ref: 's1', occurred_at: IL_Y_A(0), meta: {} },
  ];
  etat.tracking_links = [{ code: 'AB78X2', owner_id: 'rev-1', target_type: 'store' }, { code: 'PROD01', owner_id: 'rev-1', target_type: 'product' }];
  etat.tracking_clicks = [
    { link_code: 'AB78X2', occurred_at: IL_Y_A(1) }, { link_code: 'AB78X2', occurred_at: IL_Y_A(2) },
    { link_code: 'AB78X2', occurred_at: IL_Y_A(60) }, { link_code: 'PROD01', occurred_at: IL_Y_A(1) },
  ];
  etat.orders = [
    { reseller_id: 'rev-1', status: 'delivered', reseller_commission: 1500, created_at: IL_Y_A(2) },
    { reseller_id: 'rev-1', status: 'pending_call', reseller_commission: 900, created_at: IL_Y_A(1) },
    { reseller_id: 'rev-1', status: 'cancelled', reseller_commission: 700, created_at: IL_Y_A(1) },
    { reseller_id: 'rev-1', status: 'delivered', reseller_commission: 4000, created_at: IL_Y_A(50) },
    { reseller_id: 'rev-2', status: 'delivered', reseller_commission: 9999, created_at: IL_Y_A(1) },
  ];
  etat.store_follows = [{ store_id: 's1', created_at: IL_Y_A(2) }, { store_id: 's1', created_at: IL_Y_A(90) }];
  etat.products = [produit('p1', { name: 'Pagne wax' }), produit('p2', { name: 'Théière' }), produit('p3', { name: 'Bol' }), produit('p4', { name: 'Robe' })];
  const vue = (product_id, jours, etatVisite = 'qualifiee') => ({ reseller_id: 'rev-1', product_id, jour: IL_Y_A(jours).slice(0, 10), etat: etatVisite });
  etat.visites_mesurees = [vue('p2', 1), vue('p2', 2), vue('p2', 3), vue('p1', 1), vue('p1', 2), vue('p3', 1), vue('p4', 1, 'robot'), vue('p4', 1, 'robot'), vue('p4', 1, 'robot'), vue('p4', 40)];
  const json = await (await stats('?jours=7')).json();
  assert.equal(json.visites, 4);
  assert.equal(json.visiteurs, 3);
  assert.deepEqual(json.origine, { whatsapp: 2, qr: 1, autre: 0, direct: 1 });
  assert.equal(json.serie.reduce((s, p) => s + p.valeur, 0), 4);
  assert.equal(json.clics, 2, 'clics des seuls liens de la boutique, sur la période');
  assert.equal(json.commandes, 2, 'à son nom, hors annulées, sur la période');
  assert.equal(json.livrees, 1);
  assert.equal(json.gains, 1500);
  assert.equal(json.abonnes, 5);
  assert.equal(json.nouveauxAbonnes, 1);
  assert.deepEqual(json.articlesVus, [{ nom: 'Théière', vues: 3 }, { nom: 'Pagne wax', vues: 2 }, { nom: 'Bol', vues: 1 }], 'robots écartés');
  assert.ok(json.mesureDepuis.startsWith(IL_Y_A(40).slice(0, 10)), 'première visite mesurée');
  const json30 = await (await stats('?jours=30')).json();
  assert.equal(json30.serie.length, 30);
});

test('Statistiques (page) : coquille, période, 3 tuiles, « — » sans mesure, mesuré depuis, partage ; conseil à règles fixes', () => {
  const { conseilBoutique, origineDeVisite } = require('../src/lib/reseau/stats.ts');
  assert.equal(conseilBoutique({ visites: null, commandes: 3 }), null);
  assert.match(conseilBoutique({ visites: 0, commandes: 0 }), /Partagez votre boutique/);
  assert.match(conseilBoutique({ visites: 5, commandes: 0, coupsDeCoeur: 0 }), /coups de cœur/);
  assert.match(conseilBoutique({ visites: 12, commandes: 2, origine: { whatsapp: 12, qr: 0, autre: 0, direct: 0 } }), /QR/);
  assert.deepEqual([origineDeVisite('whatsapp'), origineDeVisite('qr'), origineDeVisite('sms'), origineDeVisite(null)], ['whatsapp', 'qr', 'autre', 'direct']);
  const page = sansCommentaires(lire('src/app/reseller/boutique/statistiques/page.tsx'));
  assert.match(page, /<PageReseau/);
  assert.match(page, /titre="Statistiques de ma boutique"/);
  assert.match(page, /role="radiogroup" aria-label="Période"/);
  assert.match(page, /label="Visites"/);
  assert.match(page, /label="Commandes à votre nom"/);
  assert.match(page, /Tous vos liens, pas seulement la boutique/);
  assert.match(page, /label="Gains des ventes livrées" valeur=\{formatF\(stats\.gains\)\}/);
  assert.match(page, /v == null \? '—'/);
  assert.match(page, /<GraphiqueBarres titre="Visites par jour"/);
  assert.match(page, /mesurées depuis le \{formatDate\(stats\.mesureDepuis, 'complet'\)\}/);
  assert.match(page, /<PartageBoutique/);
  assert.match(page, /\/api\/reseller\/boutique\/stats\?jours=/);
  assert.doesNotMatch(page, /À la une/);
  assert.match(lire('src/lib/reseau/porte-boutique.ts'), /PAGE_STATISTIQUES = '\/reseller\/boutique\/statistiques'/);
});

// ── Métadonnées : canonical, accroche, titre du rayon ; /r/ ─────────────────

test('Métadonnées : canonical /boutique/<slug>, description = accroche, titre propre au rayon ; /r/<code> canonical sans redirection', async () => {
  const { URL_APP } = require('../src/lib/shop.ts');
  const page = require('../src/app/boutique/[slug]/page.tsx');
  baseAwa();
  etat.stores[0].tagline = 'Pagnes et bazins de qualité';
  etat.products = [produit('a', { category: 'Pagnes' }), produit('b', { category: 'Cuisine' })];
  etat.reseller_shop_items = [{ reseller_id: 'rev-1', product_id: 'a', position: 0 }, { reseller_id: 'rev-1', product_id: 'b', position: 1 }];
  sessionCourante = null;
  let meta = await page.generateMetadata({ params: Promise.resolve({ slug: 'awa-mode' }), searchParams: Promise.resolve({}) });
  assert.equal(meta.alternates.canonical, `${URL_APP}/boutique/awa-mode`);
  assert.equal(meta.openGraph.url, `${URL_APP}/boutique/awa-mode`);
  assert.equal(meta.description, 'Pagnes et bazins de qualité');
  assert.equal(meta.title, 'Awa Mode — Suguba');
  meta = await page.generateMetadata({ params: Promise.resolve({ slug: 'awa-mode' }), searchParams: Promise.resolve({ rayon: 'pagnes', via: 'AB78X2' }) });
  assert.equal(meta.title, 'Pagnes · Awa Mode — Suguba');
  assert.equal(meta.alternates.canonical, `${URL_APP}/boutique/awa-mode`, 'sans ?rayon ni ?via');
  meta = await page.generateMetadata({ params: Promise.resolve({ slug: 'awa-mode' }), searchParams: Promise.resolve({ rayon: 'inconnu' }) });
  assert.equal(meta.title, 'Awa Mode — Suguba');
  // Sans accroche : le nombre d'articles, comme avant.
  etat.stores[0].tagline = null;
  meta = await page.generateMetadata({ params: Promise.resolve({ slug: 'awa-mode' }) });
  assert.match(meta.description, /^2 articles livrés à Bamako/);
  // Masquée : jamais de canonical ni rien d'elle.
  etat.stores[0].status = 'hidden';
  meta = await page.generateMetadata({ params: Promise.resolve({ slug: 'awa-mode' }) });
  assert.equal(meta.alternates, undefined);

  const r = require('../src/app/r/[code]/page.tsx');
  etat.stores[0].status = 'active';
  meta = await r.generateMetadata({ params: Promise.resolve({ code: 'AWA1' }) });
  assert.equal(meta.alternates.canonical, `${URL_APP}/boutique/awa-mode`);
  etat.stores[0].status = 'hidden';
  meta = await r.generateMetadata({ params: Promise.resolve({ code: 'AWA1' }) });
  assert.equal(meta.alternates, undefined, 'boutique masquée : /r/ reste la seule vitrine');
  assert.doesNotMatch(lire('src/app/r/[code]/page.tsx'), /redirect\(/, 'pas de redirection (décision du fondateur)');
  assert.deepEqual(ecritures(), []);
});

// ── Vitrine : preuve sociale réelle, ?rayon= ────────────────────────────────

test('« N livraisons réussies » : le vrai compte des commandes livrées à son nom (orders.reseller_id), rien sinon', async () => {
  const { chargerBoutiqueRevendeur } = require('../src/lib/shop.ts');
  baseAwa();
  etat.products = [produit('a')];
  etat.reseller_shop_items = [{ reseller_id: 'rev-1', product_id: 'a', position: 0 }];
  let v = await chargerBoutiqueRevendeur('AWA1');
  assert.equal(v.livraisons, 0);
  assert.equal(v.slugBoutique, 'awa-mode');
  etat.orders = [
    { reseller_id: 'rev-1', status: 'delivered' }, { reseller_id: 'rev-1', status: 'delivered' },
    { reseller_id: 'rev-1', status: 'cancelled' }, { reseller_id: 'rev-2', status: 'delivered' },
  ];
  v = await chargerBoutiqueRevendeur('AWA1');
  assert.equal(v.livraisons, 2);
  fautes['orders:select'] = 'XX000';
  v = await chargerBoutiqueRevendeur('AWA1');
  assert.equal(v.livraisons, 0, 'lecture en échec : rien d’affiché, jamais un chiffre inventé');
  const ShopView = require('../src/components/shop/ShopView.tsx').default;
  const rendre = (livraisons) => renderToStaticMarkup(React.createElement(ShopView, { boutique: { ...v, livraisons }, urlPartage: 'u', refCode: 'AWA1' }));
  assert.match(rendre(1), /<strong[^>]*>1<\/strong> livraison réussie/);
  assert.doesNotMatch(rendre(0), /livraisons? réussies?/);
});

test('BoutiqueProduits : ?rayon=<cle> vise le bon rayon (ou les coups de cœur) ; une clé inconnue ne fait rien', () => {
  const { ancreDuRayon, organiserVitrine } = require('../src/components/shop/BoutiqueProduits.tsx');
  const p = (nom, categorie, enPlus = {}) => ({ id: nom, slug: nom, nom, categorie, image: null, images: [], prix: 5000, enStock: true, garantieMois: 0, ...enPlus });
  const { coups, groupes } = organiserVitrine([p('Théière', 'Cuisine'), p('Pagne', 'Pagnes'), p('Robe', 'Électroménager'), p('Châle', 'Pagnes', { coupDeCoeur: true })], '');
  assert.equal(ancreDuRayon('cuisine', coups, groupes), 'rayon-1');
  assert.equal(ancreDuRayon('pagnes', coups, groupes), 'rayon-2');
  assert.equal(ancreDuRayon('electromenager', coups, groupes), 'rayon-3');
  assert.equal(ancreDuRayon('coups-de-coeur', coups, groupes), 'coups-de-coeur');
  assert.equal(ancreDuRayon('coups-de-coeur', [], groupes), null);
  assert.equal(ancreDuRayon('inconnu', coups, groupes), null);
  assert.equal(ancreDuRayon(null, coups, groupes), null);
  const src = sansCommentaires(lire('src/components/shop/BoutiqueProduits.tsx'));
  assert.match(src, /scrollIntoView\(/);
  assert.match(src, /rayon=\{rayon\}|rayon = null/);
  assert.match(sansCommentaires(lire('src/components/shop/ShopView.tsx')), /rayon=\{rayon\}/);
});

// ── Fiche produit : retour vers la boutique ─────────────────────────────────

test('/api/shop/revendeur : enseigne et adresse de la boutique principale ACTIVE ; jamais le nom complet', async () => {
  const { GET } = require('../src/app/api/shop/revendeur/route.ts');
  const lireApi = async (code) => (await GET(new Request(`http://localhost/api/shop/revendeur?code=${code}`))).json();
  baseAwa();
  let json = await lireApi('AWA1');
  assert.deepEqual(json, { nom: 'Awa D.', enseigne: 'Awa Mode', slug: 'awa-mode' });
  etat.stores[0].name = 'Awa Traoré Diallo';
  json = await lireApi('AWA1');
  assert.deepEqual(json, { nom: 'Awa D.', enseigne: null, slug: 'awa-mode' }, 'pas d’enseigne : son nom public');
  etat.stores[0].status = 'hidden';
  assert.deepEqual(await lireApi('AWA1'), { nom: 'Awa D.', enseigne: null, slug: null }, 'boutique masquée : pas de lien');
  etat.profile_roles[0].status = 'suspended';
  assert.deepEqual(await lireApi('AWA1'), { nom: null, enseigne: null, slug: null });
  assert.deepEqual(await lireApi('x'), { nom: null, enseigne: null, slug: null });
  assert.deepEqual(ecritures(), []);
  // Bandeau de la fiche produit : « Boutique de <enseigne> · Voir sa boutique », jetons de la charte.
  const fiche = sansCommentaires(lire('src/app/p/[slug]/page.tsx'));
  assert.match(fiche, /`Boutique de \$\{recommandeur\.enseigne \|\| recommandeur\.nom\}`/);
  assert.match(fiche, /href=\{`\/boutique\/\$\{encodeURIComponent\(recommandeur\.slug\)\}`\}/);
  assert.match(fiche, /Voir sa boutique/);
  const bandeau = fiche.slice(fiche.indexOf('{recommandeur && ('), fiche.indexOf('Voir sa boutique') + 400);
  assert.doesNotMatch(bandeau, /emerald/, 'plus de classes emerald');
  assert.match(bandeau, /bg-suguba-sauge/);
});

// ── Abonnement : FOLLOW rattaché au revendeur ───────────────────────────────

test('/api/reseau/suivre : FOLLOW journalisé avec resellerId pour une boutique de revendeur (jamais tiré de la requête)', async () => {
  const { POST } = require('../src/app/api/reseau/suivre/route.ts');
  baseAwa();
  sessionCourante = null;
  const r = await POST(requete('/api/reseau/suivre', { method: 'POST', body: JSON.stringify({ boutique: 'awa-mode', telephone: '70 00 00 01', resellerId: 'rev-9' }) }));
  assert.equal(r.status, 200);
  const follow = etat.analytics_events.find((e) => e.event === 'FOLLOW');
  assert.ok(follow);
  assert.equal(follow.reseller_id, 'rev-1');
  assert.equal(follow.supplier_id, null);
  assert.equal(follow.subject_type, 'store');
});

// ── Branchements : bandeau, accueil, Mes articles, Statistiques, badge, créateur ──

test('Source : la feuille « Partager ma boutique » est branchée partout ; QR de la carte et carte du créateur en lien suivi', () => {
  const feuille = sansCommentaires(lire('src/components/shop/proprietaire/PartageBoutique.tsx'));
  assert.match(feuille, /<Sheet ouvert=\{ouvert\} onFermer=\{onFermer\} titre="Partager ma boutique"/);
  assert.match(feuille, /role="radiogroup" aria-label="Que partager \?"/);
  assert.match(feuille, /onPointerDown=\{\(\) => precharger\('whatsapp', c\.cle, true\)\}/, 'lien préchargé au toucher');
  assert.match(feuille, /deja === 'echec' && !toucher/, 'un échec n’est relancé que par un geste, jamais en boucle');
  assert.match(feuille, /\/api\/reseller\/boutique\/partage\?/);
  assert.match(feuille, /adresseBoutique\(/, 'repli sur l’adresse brute');
  assert.match(feuille, /Copier le lien/);
  assert.match(feuille, />QR\s*</);
  assert.doesNotMatch(feuille, /localStorage|sessionStorage/, 'aucun lien gardé dans le navigateur');
  assert.doesNotMatch(feuille, /commission|\bgains?\b|À la une/i);
  // Bandeau (vitrine), accueil, Mes articles, Statistiques.
  assert.match(sansCommentaires(lire('src/components/shop/proprietaire/BandeauProprietaire.tsx')), /<PartageBoutique/);
  const accueil = sansCommentaires(lire('src/app/reseller/page.tsx'));
  assert.match(accueil, /<PartageBoutique/);
  assert.doesNotMatch(accueil, /Ma boutique Suguba — \$\{nom\}/, 'plus le message à l’adresse brute');
  assert.match(sansCommentaires(lire('src/app/reseller/boutique/articles/page.tsx')), /<PartageBoutique ouvert=\{partage\}/);
  assert.match(sansCommentaires(lire('src/app/reseller/boutique/statistiques/page.tsx')), /<PartageBoutique/);
  // Mes clients : ?partager=1 par la porte, ouvert par la vitrine puis retiré de l'adresse.
  assert.match(lire('src/app/reseller/clients/page.tsx'), /\/reseller\/ma-boutique\?partager=1/);
  const mode = sansCommentaires(lire('src/components/shop/proprietaire/ModeProprietaire.tsx'));
  assert.match(mode, /searchParams\.delete\('partager'\)/);
  // Carte professionnelle : QR en lien suivi de canal « qr », repli sur l'adresse brute.
  const badge = sansCommentaires(lire('src/app/reseller/badge/page.tsx'));
  assert.match(badge, /\/api\/reseller\/boutique\/partage\?canal=qr/);
  assert.match(badge, /const valeurQr = lienQr \|\| personalCatalogUrl;/);
  assert.match(badge, /<QrCode value=\{valeurQr\}/);
  // Créateur : carte de la boutique en lien suivi.
  const createur = sansCommentaires(lire('src/app/reseller/createur/page.tsx'));
  assert.match(createur, /lien = await lienSuiviBoutique\(\) \|\| `\$\{window\.location\.origin\}\/boutique\/\$\{boutique\.slug\}`;/);
});
