// TEST-BOUTIQUE-LOT1-001..010 (chantier boutique du revendeur, 2026-10-03, lot 1
// « Ma boutique ouvre ma boutique ») : porte unique /reseller/ma-boutique, carte de
// l'accueil, onglet « Boutique », vue du propriétaire sur sa vitrine, « Ouvrir »
// dans CarteLien, boutique illisible sans 503 sur /api/reseller/me.
// Supabase et la session sont SIMULÉS (require.cache) : aucune base réelle.
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

// ── Base simulée ────────────────────────────────────────────────────────────
let etat; let fautes; let ecritures;
function reinitialiser() {
  etat = { stores: [], profiles: [], reseller_shop_items: [], commissions: [], orders: [], products: [] };
  fautes = {}; ecritures = [];
}
const db = {
  from(table) {
    if (fautes[`${table}:exception`]) throw new Error('panne simulée');
    let op = 'select'; let patch; const filtres = []; let un = false; let tete = false;
    const q = {
      select(_colonnes, options) { if (options && options.head) tete = true; return q; },
      eq(k, v) { filtres.push((r) => r[k] === v); return q; },
      ilike(k, v) { filtres.push((r) => String(r[k]).toLowerCase() === String(v).toLowerCase()); return q; },
      in(k, v) { filtres.push((r) => v.includes(r[k])); return q; },
      is() { return q; }, order() { return q; }, limit() { return q; },
      insert(p) { op = 'insert'; patch = p; return q; },
      update(p) { op = 'update'; patch = p; return q; },
      upsert(p) { op = 'upsert'; patch = p; return q; },
      delete() { op = 'delete'; return q; },
      maybeSingle() { un = true; return q; },
      then(resolve, reject) {
        if (op !== 'select') ecritures.push({ table, op, patch });
        if (fautes[`${table}:${op}`]) return Promise.resolve({ data: null, count: null, error: { code: fautes[`${table}:${op}`] } }).then(resolve, reject);
        // Index unique sur lower(slug) de stores : une adresse prise renvoie 23505.
        if (op === 'insert' && table === 'stores' && (etat.stores || []).some((r) => String(r.slug).toLowerCase() === String(patch.slug).toLowerCase())) {
          return Promise.resolve({ data: null, count: null, error: { code: '23505' } }).then(resolve, reject);
        }
        let lignes = (etat[table] || []).filter((r) => filtres.every((f) => f(r)));
        if (op === 'insert') {
          const ligne = { id: `cree-${ecritures.length}`, status: 'active', followers_count: 0, ...patch };
          (etat[table] ||= []).push(ligne); lignes = [ligne];
        }
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
const sessionRevendeur = (uid, extra = {}) => ({ uid, phone: '+22300000000', role: 'reseller', status: 'active', roles: { reseller: 'active' }, iat: 1, exp: 9e9, ...extra });

// ── Composants simulés par des marqueurs (rendu serveur sans navigateur) ──
const marqueur = (nom) => ({ __esModule: true, default: (p) => React.createElement('i', { 'data-marqueur': nom, 'data-actif': p && p.actif ? p.actif : '' }) });
for (const [fichier, nom] of [['common/Header', 'entete'], ['common/BottomNav', 'barre'], ['common/Footer', 'pied'],
  ['common/AncrageRevendeur', 'ancrage'], ['shop/ShopShareBar', 'partage'], ['common/QrCode', 'qr']]) {
  require.cache[require.resolve(`../src/components/${fichier}.tsx`)] = { exports: marqueur(nom) };
}
// Articles : le marqueur garde le code des liens d'achat (?ref=) et celui du partage.
require.cache[require.resolve('../src/components/shop/BoutiqueProduits.tsx')] = {
  exports: { __esModule: true, default: (p) => React.createElement('i', { 'data-marqueur': 'articles', 'data-ref': String(p.refCode), 'data-code-partage': String(p.codePartage) }) },
};
require.cache[require.resolve('next/link')] = {
  exports: { __esModule: true, default: ({ href, prefetch, children, ...reste }) => React.createElement('a', { href, 'data-prefetch': String(prefetch), ...reste }, children) },
};
// Lot 2 (2026-10-03) : les outils du propriétaire sont chargés par next/dynamic. Ici,
// le module visé par import() est chargé tout de suite, pour lire leur rendu.
require.cache[require.resolve('next/dynamic')] = {
  exports: { __esModule: true, default: (charger) => {
    const chemin = String(charger).match(/require\(['"]([^'"]+)['"]\)/)[1].replace(/^@\//, `${path.join(RACINE, 'src')}/`);
    return (p) => React.createElement(require(chemin).default, p);
  } },
};

const { NextRequest } = require('next/server');
const requete = (url) => new NextRequest(`http://localhost${url}`, { headers: { cookie: 'suguba_session=simule' } });

test('Porte unique : seuls ?editer=logo|couverture|nom et ?partager=1 sont recopiés', () => {
  const { adresseVitrine, sansPrechargement, PORTE_MA_BOUTIQUE } = require('../src/lib/reseau/porte-boutique.ts');
  assert.equal(PORTE_MA_BOUTIQUE, '/reseller/ma-boutique');
  assert.equal(adresseVitrine('awa-mode', new URLSearchParams('editer=logo')), '/boutique/awa-mode?editer=logo');
  assert.equal(adresseVitrine('awa-mode', new URLSearchParams('editer=x&next=//evil.example')), '/boutique/awa-mode');
  assert.equal(adresseVitrine('awa-mode', new URLSearchParams('partager=1&editer=couverture')), '/boutique/awa-mode?editer=couverture&partager=1');
  assert.equal(adresseVitrine('awa-mode', new URLSearchParams('partager=oui')), '/boutique/awa-mode');
  assert.equal(sansPrechargement('/reseller/ma-boutique'), true);
  assert.equal(sansPrechargement('/reseller/ma-boutique?partager=1'), true);
  assert.equal(sansPrechargement('/reseller/boutique'), false);
});

test('Route /reseller/ma-boutique : 307 vers /boutique/<adresse>, paramètres filtrés, profil actif non revendeur accepté', async () => {
  const { GET } = require('../src/app/reseller/ma-boutique/route.ts');
  reinitialiser();
  etat.stores = [{ id: 's1', owner_type: 'reseller', owner_id: 'rev-1', slug: 'awa-mode', name: 'Awa Mode', status: 'active' }];
  sessionCourante = sessionRevendeur('rev-1');
  let r = await GET(requete('/reseller/ma-boutique'));
  assert.equal(r.status, 307);
  assert.equal(r.headers.get('location'), 'http://localhost/boutique/awa-mode');
  r = await GET(requete('/reseller/ma-boutique?editer=logo'));
  assert.equal(r.headers.get('location'), 'http://localhost/boutique/awa-mode?editer=logo');
  r = await GET(requete('/reseller/ma-boutique?editer=x&next=//evil.example'));
  assert.equal(r.headers.get('location'), 'http://localhost/boutique/awa-mode');
  // Le middleware pose le nouveau rôle dans la RÉPONSE : le jeton lu ici peut
  // encore dire « client ». Le rôle revendeur actif suffit.
  sessionCourante = sessionRevendeur('rev-1', { role: 'customer', roles: { customer: 'active', reseller: 'active' } });
  r = await GET(requete('/reseller/ma-boutique?partager=1'));
  assert.equal(r.headers.get('location'), 'http://localhost/boutique/awa-mode?partager=1');
  // Une boutique masquée par Suguba s'ouvre quand même : son propriétaire y voit la pastille.
  etat.stores[0].status = 'hidden';
  r = await GET(requete('/reseller/ma-boutique'));
  assert.equal(r.headers.get('location'), 'http://localhost/boutique/awa-mode');
  assert.deepEqual(ecritures, [], 'ouvrir sa boutique n’écrit rien');
});

test('Route /reseller/ma-boutique : sans boutique, création avec « Prénom I. », jamais le nom complet', async () => {
  const { GET } = require('../src/app/reseller/ma-boutique/route.ts');
  reinitialiser();
  etat.profiles = [{ id: 'rev-2', full_name: 'Awa Traoré Diallo' }];
  sessionCourante = sessionRevendeur('rev-2');
  const r = await GET(requete('/reseller/ma-boutique'));
  const insertion = ecritures.find((e) => e.table === 'stores' && e.op === 'insert');
  assert.ok(insertion, 'la boutique est créée');
  assert.equal(insertion.patch.name, 'Awa D.');
  assert.doesNotMatch(JSON.stringify(insertion.patch), /Traoré|Diallo/);
  assert.equal(insertion.patch.owner_id, 'rev-2');
  assert.equal(r.headers.get('location'), 'http://localhost/boutique/awa-d');
  assert.ok(ecritures.every((e) => e.table === 'stores'), 'aucune autre table touchée (reseller_shop_items intacte)');
  // Base pas encore migrée : la page de réglages garde son écran d'attente.
  reinitialiser();
  etat.profiles = [{ id: 'rev-3', full_name: 'Moussa Keita' }];
  fautes['stores:insert'] = '42P01';
  sessionCourante = sessionRevendeur('rev-3');
  assert.equal((await GET(requete('/reseller/ma-boutique'))).headers.get('location'), 'http://localhost/reseller/boutique');
});

test('Création de boutique : profil illisible ou absent, rien n’est créé (relecture du lot 1)', async () => {
  const { GET } = require('../src/app/reseller/ma-boutique/route.ts');
  reinitialiser();
  etat.profiles = [{ id: 'rev-4', full_name: 'Moussa Traoré' }];
  fautes['profiles:select'] = 'TEST';
  sessionCourante = sessionRevendeur('rev-4');
  let r = await GET(requete('/reseller/ma-boutique'));
  assert.equal(r.headers.get('location'), 'http://localhost/reseller/boutique');
  assert.deepEqual(ecritures, [], 'pas de boutique « Revendeur Suguba » à l’adresse définitive');
  reinitialiser();
  sessionCourante = sessionRevendeur('rev-4');
  r = await GET(requete('/reseller/ma-boutique'));
  assert.equal(r.headers.get('location'), 'http://localhost/reseller/boutique');
  assert.deepEqual(ecritures, []);
});

test('Création de boutique : homonymes « Prénom I. » au-delà de 5, suffixe tiré du compte au lieu de 30 essais (relecture du lot 1)', async () => {
  const { slugsCandidats } = require('../src/lib/reseau/boutiques.ts');
  const uid = '7f3a9c21-0000-4000-8000-000000000001';
  const candidats = slugsCandidats('moussa-t', uid);
  assert.equal(candidats.length, 10, '10 essais au plus');
  assert.deepEqual(candidats.slice(0, 9), ['moussa-t', 'moussa-t-2', 'moussa-t-3', 'moussa-t-4', 'moussa-t-5',
    'moussa-t-7f3a', 'moussa-t-7f3a9c', 'moussa-t-7f3a9c21', 'moussa-t-7f3a9c210000']);
  assert.match(candidats[9], /^moussa-t-[a-z0-9]{8}$/);
  assert.ok(slugsCandidats('boutique', null).length <= 6);

  const { GET } = require('../src/app/reseller/ma-boutique/route.ts');
  reinitialiser();
  etat.profiles = [{ id: uid, full_name: 'Moussa Traoré' }];
  etat.stores = ['moussa-t', 'moussa-t-2', 'moussa-t-3', 'moussa-t-4', 'moussa-t-5']
    .map((slug, i) => ({ id: `h${i}`, owner_type: 'reseller', owner_id: `autre-${i}`, slug, name: 'Moussa T.', status: 'active' }));
  sessionCourante = sessionRevendeur(uid);
  const r = await GET(requete('/reseller/ma-boutique'));
  assert.equal(r.headers.get('location'), 'http://localhost/boutique/moussa-t-7f3a');
  const essais = ecritures.filter((e) => e.table === 'stores' && e.op === 'insert');
  assert.equal(essais.length, 6, '5 adresses prises, la 6e réussit');
  assert.ok(essais.every((e) => e.patch.name === 'Moussa T.'), 'jamais le nom complet');
});

test('/api/reseller/boutique (GET, où la porte renvoie en cas d’échec) : création en « Prénom I. », rien si le profil est illisible', async () => {
  const { GET } = require('../src/app/api/reseller/boutique/route.ts');
  reinitialiser();
  etat.profiles = [{ id: 'rev-5', full_name: 'Fatoumata Coulibaly Diarra', reseller_code: 'FATO' }];
  sessionCourante = sessionRevendeur('rev-5');
  let json = await (await GET(requete('/api/reseller/boutique'))).json();
  assert.equal(json.boutique.nom, 'Fatoumata D.');
  assert.equal(json.boutique.slug, 'fatoumata-d');
  assert.equal(json.codeRevendeur, 'FATO');
  assert.doesNotMatch(JSON.stringify(ecritures), /Coulibaly|Diarra/);
  reinitialiser();
  etat.profiles = [{ id: 'rev-6', full_name: 'Awa Traoré' }];
  fautes['profiles:select'] = 'TEST';
  sessionCourante = sessionRevendeur('rev-6');
  json = await (await GET(requete('/api/reseller/boutique'))).json();
  assert.equal(json.boutique, null);
  assert.deepEqual(ecritures, []);
});

test('Route /reseller/ma-boutique : sans rôle revendeur actif, sans session ou en aperçu admin, aucune boutique', async () => {
  const { GET } = require('../src/app/reseller/ma-boutique/route.ts');
  reinitialiser();
  etat.stores = [{ id: 's1', owner_type: 'reseller', owner_id: 'cli-1', slug: 'pas-a-moi', name: 'X', status: 'active' }];
  sessionCourante = { uid: 'cli-1', phone: '+22300000000', role: 'customer', status: 'active', roles: { customer: 'active', reseller: 'pending_approval' }, iat: 1, exp: 9e9 };
  let r = await GET(requete('/reseller/ma-boutique'));
  assert.equal(r.status, 307);
  assert.match(r.headers.get('location'), /\/login\?denied=reseller/);
  sessionCourante = null;
  r = await GET(requete('/reseller/ma-boutique'));
  assert.match(r.headers.get('location'), /\/login/);
  sessionCourante = sessionRevendeur('apercu-reseller', { apercu: { depuis: { uid: 'admin-1', phone: '+22300000001' } } });
  r = await GET(requete('/reseller/ma-boutique'));
  assert.equal(r.headers.get('location'), 'http://localhost/reseller/boutique');
  assert.deepEqual(ecritures, []);
});

test('/api/reseller/me?avec=boutique : aperçu de la boutique ; boutique illisible → null et statut 200', async () => {
  const { GET } = require('../src/app/api/reseller/me/route.ts');
  reinitialiser();
  etat.profiles = [{ id: 'rev-1', reseller_code: 'AWA1', full_name: 'Awa Diallo', metadata: {} }];
  etat.stores = [{ id: 's1', owner_type: 'reseller', owner_id: 'rev-1', slug: 'awa-mode', name: 'Awa Mode', logo_url: 'https://x/logo.webp', cover_url: null, status: 'active', followers_count: 4 }];
  // Relecture du lot 1 : seuls les articles que la vitrine AFFICHE comptent
  // (approuvés, commission > 0, prix « ok » ou non renseigné) — p4 refusé et p5
  // sans commission n'y apparaissent pas, p3 appartient à un autre revendeur.
  etat.reseller_shop_items = ['p1', 'p2', 'p4', 'p5'].map((id) => ({ reseller_id: 'rev-1', product_id: id })).concat({ reseller_id: 'autre', product_id: 'p3' });
  etat.products = [
    { id: 'p1', status: 'approved', reseller_commission: 1000, pricing_status: 'ok' },
    { id: 'p2', status: 'approved', reseller_commission: 500, pricing_status: null },
    { id: 'p3', status: 'approved', reseller_commission: 500, pricing_status: 'ok' },
    { id: 'p4', status: 'rejected', reseller_commission: 800, pricing_status: 'ok' },
    { id: 'p5', status: 'approved', reseller_commission: 0, pricing_status: 'ok' },
  ];
  sessionCourante = sessionRevendeur('rev-1');
  let r = await GET(requete('/api/reseller/me?avec=boutique'));
  assert.equal(r.status, 200);
  let json = await r.json();
  // Lot 2 (2026-10-03) : + étapes de « Ma boutique est prête à X % » (vérifiées dans ma-boutique-lot2).
  const { etapes, ...apercu } = json.boutique;
  assert.deepEqual(apercu, { slug: 'awa-mode', nom: 'Awa Mode', logo: 'https://x/logo.webp', couverture: null, articles: 2, abonnes: 4, statut: 'active' });
  assert.ok(Array.isArray(etapes));
  assert.equal(json.reseller.referralCode, 'AWA1');
  // Tous les articles choisis retirés ou refusés : 0, comme la vitrine qui montre le
  // catalogue Suguba (l'étape « Choisir mes articles » n'est pas cochée).
  etat.products = etat.products.map((p) => ({ ...p, status: 'rejected' }));
  json = await (await GET(requete('/api/reseller/me?avec=boutique'))).json();
  assert.equal(json.boutique.articles, 0);
  // Lecture des produits en échec : « — » (null), jamais 0 inventé.
  fautes['products:select'] = 'TEST';
  json = await (await GET(requete('/api/reseller/me?avec=boutique'))).json();
  assert.equal(json.boutique.articles, null);
  fautes = {};
  // Sans le paramètre : aucune requête de plus, aucune clé boutique.
  r = await GET(requete('/api/reseller/me'));
  assert.equal('boutique' in (await r.json()), false);
  // Compte d'articles illisible : « — » (null), jamais 0 inventé.
  fautes['reseller_shop_items:select'] = 'TEST';
  json = await (await GET(requete('/api/reseller/me?avec=boutique'))).json();
  assert.equal(json.boutique.articles, null);
  // Erreur, puis panne franche, sur stores : le solde reste servi.
  fautes = { 'stores:select': 'TEST' };
  r = await GET(requete('/api/reseller/me?avec=boutique'));
  assert.equal(r.status, 200);
  json = await r.json();
  assert.equal(json.boutique, null);
  assert.equal(typeof json.reseller.availableBalance, 'number');
  fautes = { 'stores:exception': true };
  r = await GET(requete('/api/reseller/me?avec=boutique'));
  assert.equal(r.status, 200);
  assert.equal((await r.json()).boutique, null);
  assert.ok(ecritures.every((e) => e.table !== 'stores' && e.table !== 'reseller_shop_items'), 'lecture seule : rien n’est créé ici');
});

const ShopView = () => require('../src/components/shop/ShopView.tsx').default;
const vitrine = (enPlus = {}) => ({
  type: 'revendeur', nom: 'Awa Mode', categorie: null, logo: null, couverture: null, description: null,
  produits: [{ id: 'p1', nom: 'Robe', prix: 15000, image: null }], livraisons: 0, selectionVide: true, code: 'AWA1', ...enPlus,
});
const rendreVitrine = (props) => renderToStaticMarkup(React.createElement(ShopView(), {
  boutique: vitrine(), urlPartage: 'https://app.sugubaml.com/boutique/awa-mode', refCode: 'AWA1',
  suivre: React.createElement('b', { 'data-marqueur': 'suivre' }), ...props,
}));

test('ShopView, propriétaire en gestion : ni ancrage ; Suivre et « Devenir revendeur » seulement en vue client, inertes (lot 2) ; abonnés, état, action', () => {
  const html = rendreVitrine({ lienModifier: '/reseller/boutique', proprietaire: { statut: 'active', abonnes: 3, gestion: true } });
  assert.doesNotMatch(html, /data-marqueur="ancrage"/, 'le propriétaire ne devient pas son propre revendeur d’origine');
  // Relecture du lot 1 : ses liens d'achat ne portent pas ?ref=<son code> (l'ancrage
  // global du layout l'aurait rattaché à lui-même au premier article touché) ; ses
  // partages d'article gardent son code.
  assert.match(html, /data-marqueur="articles" data-ref="null" data-code-partage="AWA1"/);
  // Lot 2 (2026-10-03) : « Voir comme un client » montre exactement la vitrine du
  // client. Suivre, « Devenir revendeur » et l'avis « Sélection en préparation » sont
  // donc rendus, mais inertes et cachés tant que la vue client n'est pas choisie.
  const inerte = '<div inert="" class="hidden group-data-\\[vue=client\\]:block">';
  assert.match(html, new RegExp(`${inerte}<div class="flex-none"><b data-marqueur="suivre">`));
  assert.match(html, new RegExp(`${inerte}<div class="bg-white rounded-3xl[^"]*">[\\s\\S]*?Devenir revendeur`));
  assert.match(html, new RegExp(`${inerte}<p[^>]*>Sélection en préparation`));
  assert.equal((html.match(/data-marqueur="suivre"/g) || []).length, 1);
  assert.match(html, /<strong[^>]*>3<\/strong> abonnés/);
  assert.match(html, /En ligne/);
  assert.match(html, /Personnaliser/);
  assert.doesNotMatch(html, /Modifier la boutique/);
  assert.match(html, /Vos clients voient le catalogue Suguba en attendant vos articles/);
  assert.match(html, /href="\/reseller\/catalog"[^>]*>[\s\S]*?Choisir mes articles/);
  assert.match(html, /data-marqueur="barre" data-actif="\/reseller\/ma-boutique"/, 'l’onglet Boutique reste allumé');
  assert.doesNotMatch(html, /C’est votre boutique/);
  assert.doesNotMatch(html, /À la une/);
});

test('ShopView, propriétaire d’une boutique masquée, autre profil actif : pastille, support, bandeau « Gérer »', () => {
  const html = rendreVitrine({ proprietaire: { statut: 'hidden', abonnes: 1, gestion: false } });
  assert.match(html, /Masquée par Suguba/);
  // Message exact (relecture du lot 1) : seule cette adresse est introuvable pour les
  // clients, l'ancien lien /r/<code> montre encore la sélection.
  assert.match(html, /Cette adresse affiche « page introuvable » à vos clients : vous seul la voyez ici\./);
  assert.doesNotMatch(html, /Vos clients ne la voient pas/);
  assert.match(html, /data-marqueur="articles" data-ref="null" data-code-partage="AWA1"/);
  assert.match(html, /href="https:\/\/api\.whatsapp\.com\/send\?phone=22389460000/);
  assert.match(html, /<a href="\/reseller\/ma-boutique"[^>]*>[\s\S]*?C’est votre boutique[\s\S]*?Gérer/);
  assert.match(html, /<strong[^>]*>1<\/strong> abonné</);
  assert.doesNotMatch(html, /En ligne/);
  assert.doesNotMatch(html, /data-marqueur="partage"/, 'pas de partage d’une boutique que les clients ne voient pas');
  assert.match(rendreVitrine({ proprietaire: { statut: 'active', abonnes: 0, gestion: true } }), /data-marqueur="partage"/);
});

test('ShopView sans propriétaire (/r/, /s/, visiteur) : rendu du visiteur inchangé', () => {
  const html = rendreVitrine({});
  assert.match(html, /data-marqueur="ancrage"/);
  assert.match(html, /data-marqueur="articles" data-ref="AWA1" data-code-partage="null"/, 'le visiteur garde ?ref= sur les liens d’achat');
  assert.match(html, /data-marqueur="suivre"/);
  assert.match(html, /Devenir revendeur/);
  assert.match(html, /Sélection en préparation/);
  assert.match(html, /La sélection de Awa Mode/);
  assert.match(html, /data-marqueur="barre" data-actif=""/);
  for (const proprio of [/En ligne/, /Masquée par Suguba/, /C’est votre boutique/, /Choisir mes articles/, /abonné/, /Personnaliser/]) {
    assert.doesNotMatch(html, proprio);
  }
});

test('CarteLien : « Ouvrir » dans le même onglet ; Button ne précharge jamais la porte', () => {
  const CarteLien = require('../src/components/reseau/CarteLien.tsx').default;
  const html = renderToStaticMarkup(React.createElement(CarteLien, { titre: 'Ma boutique', url: 'https://app.sugubaml.com/boutique/awa-mode', lienOuvrir: '/boutique/awa-mode' }));
  const ouvrir = html.match(/<a [^>]*href="\/boutique\/awa-mode"[^>]*>[\s\S]*?<\/a>/);
  assert.ok(ouvrir, 'lien « Ouvrir » vers la vitrine');
  assert.match(ouvrir[0], /Ouvrir/);
  assert.doesNotMatch(ouvrir[0], /target=/);
  assert.doesNotMatch(renderToStaticMarkup(React.createElement(CarteLien, { titre: 'Lien', url: 'https://x' })), />Ouvrir</);
  const Button = require('../src/components/ui/Button.tsx').default;
  assert.match(renderToStaticMarkup(React.createElement(Button, { href: '/reseller/ma-boutique' }, 'Voir')), /data-prefetch="false"/);
  assert.match(renderToStaticMarkup(React.createElement(Button, { href: '/reseller/catalog' }, 'Voir')), /data-prefetch="undefined"/);
});

test('Entrées « Ma boutique » : porte unique, plus de /r/<code> ni de nouvel onglet vers une boutique', () => {
  const sources = fichiers('src/app/reseller').map((f) => [f, lire(f)]);
  for (const [f, src] of sources) assert.doesNotMatch(src, /\/r\/\$\{/, `${f} : ancienne vitrine /r/<code>`);
  for (const [f, src] of [...sources, ...fichiers('src/app/compte/boutiques').map((g) => [g, lire(g)])]) {
    const balises = sansCommentaires(src).match(/<[A-Za-z][^<>]*>/g) || [];
    for (const b of balises) assert.ok(!(b.includes('/boutique/') && b.includes('target="_blank"')), `${f} : ${b}`);
  }
  const accueil = lire('src/app/reseller/page.tsx');
  assert.match(accueil, /\{ libelle: 'Ma boutique', href: PORTE_MA_BOUTIQUE,[^}]*aide: 'Voir, gérer et partager ma vitrine' \}/);
  assert.match(accueil, /fetch\('\/api\/reseller\/me\?avec=boutique'/);
  assert.match(accueil, /libelle: 'Choisir mes articles'/);
  assert.match(accueil, /href="\/reseller\/outils"[\s\S]{0,200}Tous mes outils/);
  assert.match(lire('src/app/reseller/outils/page.tsx'), /href: PORTE_MA_BOUTIQUE, titre: 'Ma boutique'/);
  assert.match(lire('src/app/reseller/clients/page.tsx'), /<Button href="\/reseller\/ma-boutique\?partager=1">Partager ma boutique<\/Button>/);
  assert.match(lire('src/app/reseller/catalog/page.tsx'), /<Button href=\{PORTE_MA_BOUTIQUE\}[^>]*>[\s\S]{0,80}<span>Voir ma boutique<\/span>/);
  assert.match(lire('src/app/reseller/badge/page.tsx'), /<Link href=\{PORTE_MA_BOUTIQUE\}[^>]*>Ouvrir Ma boutique<\/Link>/);
  const demarrer = lire('src/app/reseller/demarrer/page.tsx');
  assert.match(demarrer, /Votre boutique est créée\. Il reste à choisir vos articles\./);
  assert.match(demarrer, /terminer\(PORTE_MA_BOUTIQUE\)[\s\S]{0,120}Ouvrir ma boutique/);
  assert.match(demarrer, /terminer\('\/reseller\/catalog'\)[\s\S]{0,120}Choisir mes articles/);
  for (const f of ['src/app/reseller/boutique/page.tsx', 'src/app/supplier/boutique/page.tsx']) {
    assert.match(lire(f), /lienOuvrir=\{`\/boutique\/\$\{/, `${f} : CarteLien sans « Ouvrir »`);
  }
  // Démarrage : « Ouvrir » quittait le parcours sans l'enregistrer (relecture du lot 1).
  assert.doesNotMatch(sansCommentaires(demarrer), /lienOuvrir/);
  const reglages = lire('src/app/reseller/boutique/page.tsx');
  assert.match(reglages, /titre="Personnaliser ma boutique"/);
  assert.match(reglages, /action=\{<Button href=\{PORTE_MA_BOUTIQUE\}[^}]*>[\s\S]{0,60}Voir ma boutique/);
  assert.match(reglages, /statut: string;/);
  assert.match(reglages, /Masquée par Suguba/);
});

test('Barre du bas : « Boutique » remplace « Outils » ; vitrine chargée une fois, masquée = introuvable pour un visiteur', () => {
  const nav = lire('src/components/common/BottomNav.tsx');
  const revendeur = nav.slice(nav.indexOf("case 'reseller':"), nav.indexOf("case 'supplier':"));
  const libelles = [...revendeur.matchAll(/label: '([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(libelles, ['Accueil', 'Produits', 'Boutique', 'Ventes', 'Gains']);
  assert.match(revendeur, /label: 'Boutique',\s*href: PORTE_MA_BOUTIQUE,\s*icon: Store,\s*prefixesActifs: \[PORTE_MA_BOUTIQUE, '\/reseller\/boutique'\]/);
  assert.match(nav, /export default function BottomNav\(\{ actif \}/);
  assert.match(nav, /prefetch=\{sansPrechargement\(item\.href\) \? false : undefined\}/);
  const page = lire('src/app/boutique/[slug]/page.tsx');
  assert.match(page, /const charger = cache\(async/);
  assert.match(page, /if \(charge\.statut !== 'active' && !proprietaire\) notFound\(\);/);
  assert.match(page, /robots: \{ index: false, follow: false \}/);
  assert.match(page, /estProprietaire && charge\.typeProprietaire === 'reseller' && charge\.principale/);
  assert.match(page, /gestion: session\?\.role === 'reseller'/);
  assert.match(page, /proprietaire=\{proprietaire\}/);
  // /r/ et /s/ ne passent pas la prop : leur rendu reste celui du visiteur.
  for (const f of ['src/app/r/[code]/page.tsx', 'src/app/s/[slug]/page.tsx']) assert.doesNotMatch(lire(f), /proprietaire=/, f);
});

test('Relecture du lot 1 : ni lien, ni QR, ni partage d’une boutique masquée ; bandeau du catalogue sans code revendeur', () => {
  const reglages = sansCommentaires(lire('src/app/reseller/boutique/page.tsx'));
  assert.match(reglages, /\{\(!boutique\.statut \|\| boutique\.statut === 'active'\) && \(\s*<CarteLien/);
  assert.match(reglages, /L’adresse de votre boutique affiche « page introuvable » à vos clients/);
  assert.doesNotMatch(reglages, /Vos clients ne voient pas votre boutique/);
  const fournisseur = sansCommentaires(lire('src/app/supplier/boutique/page.tsx'));
  assert.match(fournisseur, /statut\?: string;/);
  assert.match(fournisseur, /\{boutique\.statut && boutique\.statut !== 'active' \? \([\s\S]*?Masquée par Suguba[\s\S]*?\) : \(\s*<CarteLien/);
  const catalogue = sansCommentaires(lire('src/app/reseller/catalog/page.tsx'));
  assert.doesNotMatch(catalogue, /codeRevendeur !== null &&/, 'le bandeau « Ma boutique » ne dépend plus du code');
  assert.doesNotMatch(catalogue, /\{codeRevendeur \? \(\s*<Button href=\{PORTE_MA_BOUTIQUE\}/);
  assert.match(catalogue, /\.finally\(\(\) => setSelectionLue\(true\)\)/);
});
