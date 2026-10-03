// TEST-BOUTIQUE-LOT6-001..031 (chantier boutique du revendeur, 2026-10-03, lot 6
// « La migration unique : rayons personnalisés et annonce datée ») :
//  - AVANT le SQL (colonne stores.reglages absente) : rien ne change — options à
//    faux, 409 « Option pas encore activée » (jamais 500), vitrine identique,
//    aucune tuile « Rayons », aucun champ « Annonce » ;
//  - le fichier SQL, exécuté dans un PostgreSQL LOCAL en mémoire (PGlite) : rejouable,
//    contrainte, fonction du changement d'adresse, droits retirés ;
//  - APRÈS : rayons maison (8 au plus, 24 caractères, un article dans un seul rayon,
//    articles de SA boutique seulement) affichés avant les rayons automatiques ;
//    annonce datée (14 jours au plus, sans prix ni pourcentage) jusqu'à sa date de fin ;
//  - ranger en rayons n'écrit JAMAIS dans reseller_shop_items (effet commercial).
// Supabase, la session et les cookies sont SIMULÉS (require.cache) : aucune base réelle.
require('../scripts/test-typescript.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

global.fetch = async () => { throw Error('Réseau externe interdit dans les tests'); };
const RACINE = path.join(__dirname, '..');
const lire = (f) => fs.readFileSync(path.join(RACINE, f), 'utf8');
const sansCommentaires = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const SQL = 'A-EXECUTER-2026-10-03-vitrine-boutique.sql';

// ── Base simulée : chaque opération est enregistrée ─────────────────────────
// Une ligne de `stores` SANS clé `reglages` = base pas encore migrée (select('*')
// ne renvoie que les colonnes qui existent).
let etat; let fautes; let operations; let serie;
function reinitialiser() {
  etat = {
    stores: [], profiles: [], profile_roles: [], reseller_shop_items: [], products: [], reseller_prices: [],
    tracking_links: [], analytics_events: [], orders: [], store_follows: [], suppliers: [],
  };
  fautes = {}; operations = []; serie = 1;
}
const valeur = (r, k) => {
  if (k.includes('->>')) { const [col, cle] = k.split('->>'); return r[col] ? r[col][cle] : undefined; }
  return r[k];
};
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
        if (fautes[`${table}:${op}`]) return repondre({ data: null, count: null, error: { code: fautes[`${table}:${op}`], message: `faute simulée ${fautes[`${table}:${op}`]}` } });
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
class Introuvable extends Error {}
require.cache[require.resolve('next/navigation')] = {
  exports: { notFound: () => { throw new Introuvable('page introuvable'); }, usePathname: () => '/', useRouter: () => ({ push() {}, replace() {}, refresh() {} }) },
};
const revendeur = (uid, extra = {}) => ({ uid, phone: '+22300000000', role: 'reseller', status: 'active', roles: { reseller: 'active' }, iat: 1, exp: 9e9, ...extra });

// ── Composants simulés ──────────────────────────────────────────────────────
const marqueur = (nom) => ({ __esModule: true, default: (p) => React.createElement('i', { 'data-marqueur': nom, 'data-props': JSON.stringify(p || {}) }) });
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
// Messages et confirmations : enregistrés, la confirmation répond `reponseConfirmation`.
let confirmations = []; let reponseConfirmation = true;
require.cache[require.resolve('../src/components/ui/Toast.tsx')] = {
  exports: { __esModule: true, useToast: () => ({ toast() {}, demander: async () => null, confirmer: async (d) => { confirmations.push(d); return reponseConfirmation; } }) },
};
require.cache[require.resolve('../src/lib/reseau/recompenses.ts')] = { exports: { lireReglagesReseau: async () => ({}) } };
require.cache[require.resolve('../src/lib/presentation-fournisseur.ts')] = { exports: { appliquerPrioriteReseau: async (_a, v) => v } };

const { NextRequest } = require('next/server');
const requete = (url, init = {}) => new NextRequest(`http://localhost${url}`, {
  ...init, headers: { cookie: 'suguba_session=simule', 'content-type': 'application/json', ...(init.headers || {}) },
});
const ROUTE = '../src/app/api/reseller/boutique/route.ts';
const lireBoutique = (suite = '') => require(ROUTE).GET(requete(`/api/reseller/boutique${suite}`));
const patcher = (corps) => require(ROUTE).PATCH(requete('/api/reseller/boutique', { method: 'PATCH', body: JSON.stringify(corps) }));

const produit = (id, enPlus = {}) => ({
  id, slug: `slug-${id}`, name: `Article ${id}`, category: 'Mode', images: [], public_price: 10000, stock: 5,
  reseller_commission: 1000, pricing_status: 'ok', status: 'approved', ...enPlus,
});
const JOUR = 24 * 3600 * 1000;
const jour = (decalage = 0) => new Date(Date.now() + decalage * JOUR).toISOString().slice(0, 10);
const NOM_COMPLET = /Traoré|Diallo/;

/**
 * Awa (rev-1) : boutique « Awa Mode », 5 articles (3 pagnes, 2 de cuisine). Moussa
 * (rev-2) : une autre boutique, un article. `migree` : la colonne stores.reglages existe.
 */
function baseAwa({ migree = false, reglages = {} } = {}) {
  reinitialiser();
  etat.profiles = [
    { id: 'rev-1', full_name: 'Awa Traoré Diallo', reseller_code: 'AWA1', metadata: {} },
    { id: 'rev-2', full_name: 'Moussa Keita', reseller_code: 'MOU2', metadata: {} },
  ];
  etat.profile_roles = [{ profile_id: 'rev-1', role: 'reseller', status: 'active' }, { profile_id: 'rev-2', role: 'reseller', status: 'active' }];
  const colonne = migree ? { reglages: JSON.parse(JSON.stringify(reglages)) } : {};
  etat.stores = [
    { id: 's1', owner_type: 'reseller', owner_id: 'rev-1', slug: 'awa-mode', name: 'Awa Mode', tagline: 'Pagnes et bazins', status: 'active', followers_count: 0, created_at: '2026-09-01T00:00:00Z', ...colonne },
    { id: 's2', owner_type: 'reseller', owner_id: 'rev-2', slug: 'chez-moussa', name: 'Chez Moussa', status: 'active', followers_count: 0, created_at: '2026-09-02T00:00:00Z', ...(migree ? { reglages: {} } : {}) },
  ];
  etat.products = [
    produit('p1', { name: 'Pagne wax', category: 'Tissus' }), produit('p2', { name: 'Bazin riche', category: 'Tissus' }),
    produit('p3', { name: 'Pagne tissé', category: 'Mode' }), produit('c1', { name: 'Théière', category: 'Cuisine' }),
    produit('c2', { name: 'Bol', category: 'Cuisine' }), produit('x1', { name: 'Article de Moussa', category: 'Mode' }),
  ];
  etat.reseller_shop_items = [
    { reseller_id: 'rev-1', product_id: 'c1', position: 0, added_at: '2026-09-10T00:00:00Z' },
    { reseller_id: 'rev-1', product_id: 'p1', position: 1, added_at: '2026-09-10T00:00:00Z' },
    { reseller_id: 'rev-1', product_id: 'p2', position: 2, added_at: '2026-09-10T00:00:00Z' },
    { reseller_id: 'rev-1', product_id: 'c2', position: 3, added_at: '2026-09-10T00:00:00Z' },
    { reseller_id: 'rev-1', product_id: 'p3', position: 4, added_at: '2026-09-10T00:00:00Z' },
    { reseller_id: 'rev-2', product_id: 'x1', position: 0, added_at: '2026-09-10T00:00:00Z' },
  ];
  sessionCourante = revendeur('rev-1');
}
const PAGNES = { nom: 'Pagnes', ids: ['p1', 'p2', 'p3'] };
const reglagesDe = (id = 's1') => etat.stores.find((b) => b.id === id).reglages;

// ── 1. Règles pures : rayons ────────────────────────────────────────────────

test('normaliserReglages, rayons : 8 au plus (un 9e est refusé), nom de 2 à 24 caractères, balises retirées, clé tirée du nom', () => {
  const R = require('../src/lib/boutique-reglages.ts');
  assert.deepEqual([R.RAYONS_MAX, R.RAYON_NOM_MIN, R.RAYON_NOM_MAX], [8, 2, 24]);
  const selection = ['p1', 'p2', 'p3', 'c1', 'c2'];
  const ecrire = (rayons) => R.normaliserReglages({ rayons }, { selection });

  const huit = Array.from({ length: 8 }, (_, i) => ({ nom: `Rayon ${String.fromCharCode(65 + i)}`, ids: [] }));
  assert.equal(ecrire(huit).ok, true);
  assert.equal(ecrire(huit).reglages.rayons.length, 8);
  const neuf = ecrire([...huit, { nom: 'De trop', ids: [] }]);
  assert.deepEqual(neuf, { ok: false, erreur: '8 rayons au plus.' });

  assert.deepEqual(ecrire([{ nom: '  <b>Pagnes</b>  du   marché ', ids: ['p1'] }]).reglages.rayons, [{ cle: 'pagnes-du-marche', nom: 'Pagnes du marché', ids: ['p1'] }]);
  assert.deepEqual(ecrire([{ nom: 'Cœur de Bamako', ids: [] }]).reglages.rayons[0].cle, 'coeur-de-bamako');
  assert.equal(ecrire([{ nom: 'x'.repeat(24), ids: [] }]).ok, true, '24 caractères : permis');
  assert.deepEqual(ecrire([{ nom: 'x'.repeat(25), ids: [] }]), { ok: false, erreur: 'Le nom d’un rayon fait 24 caractères au plus.' });
  assert.deepEqual(ecrire([{ nom: 'A', ids: [] }]), { ok: false, erreur: 'Le nom d’un rayon fait au moins 2 caractères.' });
  assert.equal(ecrire([{ nom: '<i></i>', ids: [] }]).ok, false, 'une balise seule ne fait pas un nom');
  assert.equal(ecrire([{ nom: '!!!', ids: [] }]).erreur, 'Le nom d’un rayon doit contenir des lettres.');
  assert.match(ecrire([{ nom: 'Pagnes', ids: [] }, { nom: 'PAGNES', ids: [] }]).erreur, /Deux rayons portent le même nom/);
  for (const reserve of ['Coups de cœur', 'coups de coeur', 'Coup de cœur', 'À la une']) {
    assert.equal(ecrire([{ nom: reserve, ids: [] }]).erreur, 'Ce nom est réservé. Choisissez-en un autre.', reserve);
  }
  for (const promesse of ['Promo -20 %', 'Tout à 5 000 F', 'Soldes 50']) {
    assert.equal(ecrire([{ nom: promesse, ids: [] }]).erreur, 'Pas de prix ni de remise dans le nom d’un rayon.', promesse);
  }
  assert.equal(ecrire([{ nom: 'Appel 76 12 34 56', ids: [] }]).erreur, 'Pas de numéro de téléphone ni de lien dans le nom d’un rayon.');
  assert.equal(ecrire([{ nom: 'Pagnes 2026', ids: [] }]).ok, true, 'une année n’est pas un prix');
  assert.equal(ecrire('Pagnes').ok, false);
  assert.equal(ecrire([null]).ok, false);
  assert.equal(R.normaliserReglages(null).ok, false);
  assert.equal(R.normaliserReglages([]).ok, false, 'un tableau n’est pas des réglages');
});

test('normaliserReglages, rayons : un identifiant hors sélection est retiré ; un article n’est rangé que dans UN rayon maison', () => {
  const R = require('../src/lib/boutique-reglages.ts');
  const r = R.normaliserReglages({
    rayons: [
      { nom: 'Pagnes', ids: ['p1', 'x1', 'p1', 42, '', 'p2', null] },
      { nom: 'Fête', ids: ['p2', 'c1', 'inconnu'] },
    ],
  }, { selection: ['p1', 'p2', 'c1'] });
  assert.deepEqual(r, { ok: true, reglages: { rayons: [{ cle: 'pagnes', nom: 'Pagnes', ids: ['p1', 'p2'] }, { cle: 'fete', nom: 'Fête', ids: ['c1'] }], annonce: null } });
  // Sans la sélection réelle, aucun rayon n'est écrit : on ne sait pas ce qui est à lui.
  assert.deepEqual(R.normaliserReglages({ rayons: [PAGNES] }, {}), { ok: false, erreur: 'Vos articles sont indisponibles. Réessayez.' });
  assert.deepEqual(R.normaliserReglages({ rayons: [PAGNES] }, { selection: null }).ok, false);
  // Sélection vide : le rayon est gardé, sans article.
  assert.deepEqual(R.normaliserReglages({ rayons: [PAGNES] }, { selection: [] }).reglages.rayons, [{ cle: 'pagnes', nom: 'Pagnes', ids: [] }]);
});

// ── 2. Règles pures : annonce datée ─────────────────────────────────────────

test('normaliserReglages, annonce : « -20 % » et « 5 000 F » refusées ; fin au-delà de 14 jours refusée ; 90 caractères au plus', () => {
  const R = require('../src/lib/boutique-reglages.ts');
  assert.deepEqual([R.ANNONCE_TEXTE_MAX, R.ANNONCE_JOURS_MAX], [90, 14]);
  const T = Date.parse('2026-10-03T12:00:00Z');
  const ecrire = (annonce) => R.normaliserReglages({ annonce }, { maintenant: T });
  assert.deepEqual(ecrire({ texte: ' Nouveaux  <b>pagnes</b> cette semaine ', fin: '2026-10-10' }),
    { ok: true, reglages: { rayons: [], annonce: { texte: 'Nouveaux pagnes cette semaine', fin: '2026-10-10' } } });
  for (const [texte, raison] of [
    ['-20 % sur tout', /pourcentage/], ['Tout à 5 000 F', /prix ni de montant/], ['Pagnes à 5000', /prix ni de montant/],
    ['Remise 20 ce week-end', /remise chiffrée/], ['2 pour 1 samedi', /remise chiffrée/], ['Tout à 10k', /prix ni de montant/],
    ['Appelez le 76 12 34 56', /numéro de téléphone/], ['Écrivez sur wa.me/abc', /numéro de téléphone ni de lien/],
    ['x'.repeat(91), /90 caractères au plus/],
  ]) {
    const r = ecrire({ texte, fin: '2026-10-10' });
    assert.equal(r.ok, false, texte);
    assert.match(r.erreur, raison, texte);
  }
  for (const permis of ['Nouveaux pagnes arrivés', 'Fermé le 12 octobre', 'Collection Tabaski 2027', 'Livré en 24 h à Bamako', 'x'.repeat(90)]) {
    assert.equal(ecrire({ texte: permis, fin: '2026-10-10' }).ok, true, permis);
  }
  // Date de fin : aujourd'hui à J+14, un vrai jour du calendrier.
  assert.equal(ecrire({ texte: 'Bonjour', fin: '2026-10-03' }).ok, true, 'aujourd’hui');
  assert.equal(ecrire({ texte: 'Bonjour', fin: '2026-10-17' }).ok, true, 'J+14');
  assert.deepEqual(ecrire({ texte: 'Bonjour', fin: '2026-10-18' }), { ok: false, erreur: 'Une annonce dure 14 jours au plus.' });
  assert.deepEqual(ecrire({ texte: 'Bonjour', fin: '2026-10-02' }), { ok: false, erreur: 'La date de fin est déjà passée.' });
  for (const fin of [undefined, '', '10/10/2026', '2026-02-31', 20261010]) {
    assert.deepEqual(ecrire({ texte: 'Bonjour', fin }), { ok: false, erreur: 'Choisissez la date de fin de l’annonce.' }, String(fin));
  }
  // Retrait : null, ou un texte vide (la date ne compte plus).
  assert.deepEqual(ecrire(null).reglages.annonce, null);
  assert.deepEqual(ecrire({ texte: '   ', fin: 'peu importe' }).reglages.annonce, null);
  assert.equal(ecrire('Bonjour').ok, false);
  assert.equal(R.finMaximale(T), '2026-10-17');
  assert.equal(R.jourDe(T), '2026-10-03');
});

test('normaliserReglages : fusion — ce que la requête ne mentionne pas est gardé (rayons ET annonce)', () => {
  const R = require('../src/lib/boutique-reglages.ts');
  const T = Date.parse('2026-10-03T12:00:00Z');
  const actuels = { rayons: [{ cle: 'pagnes', nom: 'Pagnes', ids: ['p1'] }], annonce: { texte: 'Bonjour', fin: '2026-09-20' } };
  // Rayons seuls : l'annonce (même terminée) reste, sans être revalidée.
  let r = R.normaliserReglages({ rayons: [{ nom: 'Fête', ids: ['p1'] }] }, { selection: ['p1'], maintenant: T, actuels });
  assert.deepEqual(r.reglages, { rayons: [{ cle: 'fete', nom: 'Fête', ids: ['p1'] }], annonce: { texte: 'Bonjour', fin: '2026-09-20' } });
  // Annonce seule : les rayons restent (aucune sélection à lire).
  r = R.normaliserReglages({ annonce: { texte: 'Arrivage', fin: '2026-10-05' } }, { maintenant: T, actuels });
  assert.deepEqual(r.reglages, { rayons: actuels.rayons, annonce: { texte: 'Arrivage', fin: '2026-10-05' } });
  // Objet vide : rien ne change. Clé inconnue : jamais enregistrée.
  assert.deepEqual(R.normaliserReglages({}, { actuels }).reglages, actuels);
  assert.deepEqual(Object.keys(R.normaliserReglages({ couleur: 'rouge', admin: true }, { actuels }).reglages), ['rayons', 'annonce']);
});

test('lireReglages (lecture tolérante) et annonceEnCours : jamais d’erreur ; l’annonce disparaît le lendemain de sa date de fin', () => {
  const R = require('../src/lib/boutique-reglages.ts');
  const vides = { rayons: [], annonce: null };
  for (const brut of [undefined, null, {}, [], 'x', 3, { rayons: 'x', annonce: 3 }]) assert.deepEqual(R.lireReglages(brut), vides);
  const lus = R.lireReglages({
    rayons: [
      { cle: 'cle-forgee', nom: 'Pagnes', ids: ['p1', 'p1', 7] },
      { nom: 'x'.repeat(40), ids: ['p1', 'p2'] },
      { nom: 'Promo -50 %', ids: ['p3'] },
      'illisible',
      ...Array.from({ length: 10 }, (_, i) => ({ nom: `Rayon ${i}`, ids: [] })),
    ],
    annonce: { texte: 'Bonjour à tous', fin: '2026-10-10' },
    autre: 'ignoré',
  });
  assert.equal(lus.rayons[0].cle, 'pagnes', 'la clé est toujours recalculée à partir du nom');
  assert.deepEqual(lus.rayons[0].ids, ['p1']);
  assert.equal(lus.rayons[1].nom.length, 24, 'nom trop long : coupé à la lecture');
  assert.deepEqual(lus.rayons[1].ids, ['p2'], 'un article dans un seul rayon');
  assert.ok(!lus.rayons.some((r) => /Promo/.test(r.nom)), 'un nom qui annonce une remise n’est pas affiché');
  assert.ok(lus.rayons.length <= 8);
  assert.deepEqual(lus.annonce, { texte: 'Bonjour à tous', fin: '2026-10-10' });
  assert.equal(R.lireReglages({ annonce: { texte: '-20 % ce soir', fin: '2026-10-10' } }).annonce, null);
  assert.equal(R.lireReglages({ annonce: { texte: 'Bonjour', fin: 'demain' } }).annonce, null);

  const annonce = { texte: 'Bonjour', fin: '2026-10-10' };
  assert.deepEqual(R.annonceEnCours(annonce, Date.parse('2026-10-03T08:00:00Z')), annonce);
  assert.deepEqual(R.annonceEnCours(annonce, Date.parse('2026-10-10T23:59:00Z')), annonce, 'encore le dernier jour');
  assert.equal(R.annonceEnCours(annonce, Date.parse('2026-10-11T00:00:01Z')), null, 'le lendemain : plus rien');
  assert.equal(R.annonceEnCours(annonce, Date.parse('2026-09-20T00:00:00Z')), null, 'date à plus de 14 jours : jamais affichée');
  assert.equal(R.annonceEnCours(null), null);
  assert.equal(R.jourLisible('2026-10-10'), '10 oct.');
  assert.equal(R.jourLisible('n’importe quoi'), '—');
});

test('Rayons à l’écran : poser un rayon déplace ses articles, ▲▼ aux bords sans effet, nom déjà pris refusé', () => {
  const R = require('../src/lib/boutique-reglages.ts');
  const rayons = [{ cle: 'pagnes', nom: 'Pagnes', ids: ['p1', 'p2'] }, { cle: 'fete', nom: 'Fête', ids: ['c1'] }];
  // Nouveau rayon : ajouté à la fin, ses articles quittent les autres.
  assert.deepEqual(R.poserRayon(rayons, null, { nom: ' Petits  prix ', ids: ['p2', 'c2', 'p2'] }), [
    { cle: 'pagnes', nom: 'Pagnes', ids: ['p1'] }, { cle: 'fete', nom: 'Fête', ids: ['c1'] }, { cle: 'petits-prix', nom: 'Petits prix', ids: ['p2', 'c2'] },
  ]);
  // Rayon modifié : garde sa place.
  assert.deepEqual(R.poserRayon(rayons, 1, { nom: 'Tabaski', ids: ['c1', 'p1'] }), [
    { cle: 'pagnes', nom: 'Pagnes', ids: ['p2'] }, { cle: 'tabaski', nom: 'Tabaski', ids: ['c1', 'p1'] },
  ]);
  assert.deepEqual(R.deplacerRayon(rayons, 1, -1).map((r) => r.nom), ['Fête', 'Pagnes']);
  assert.deepEqual(R.deplacerRayon(rayons, 0, 1).map((r) => r.nom), ['Fête', 'Pagnes']);
  assert.deepEqual(R.deplacerRayon(rayons, 0, -1).map((r) => r.nom), ['Pagnes', 'Fête'], 'déjà en haut');
  assert.deepEqual(R.deplacerRayon(rayons, 1, 1).map((r) => r.nom), ['Pagnes', 'Fête'], 'déjà en bas');
  assert.equal(R.refusRayon(rayons, null, 'pagnes'), 'Vous avez déjà un rayon de ce nom.');
  assert.equal(R.refusRayon(rayons, 0, 'Pagnes'), null, 'son propre nom');
  assert.equal(R.refusRayon(rayons, null, 'Cuisine'), null);
  assert.equal(R.refusRayon(rayons, null, 'A'), 'Le nom d’un rayon fait au moins 2 caractères.');
  const huit = Array.from({ length: 8 }, (_, i) => ({ cle: `r${i}`, nom: `R${i}`, ids: [] }));
  assert.equal(R.refusRayon(huit, null, 'Neuvième'), '8 rayons au plus.');
  assert.equal(R.refusRayon(huit, 3, 'Renommé'), null);
  assert.equal(R.memesRayons(rayons, JSON.parse(JSON.stringify(rayons))), true);
  assert.equal(R.memesRayons(rayons, R.deplacerRayon(rayons, 0, 1)), false);
  assert.equal(R.memesRayons(rayons, R.poserRayon(rayons, 0, { nom: 'Pagnes', ids: ['p2', 'p1'] })), false, 'l’ordre des articles compte');
});

// ── 3. AVANT le SQL : rien ne change ────────────────────────────────────────

test('AVANT le SQL : versBoutique renvoie options.reglages à false et des réglages vides ; après, true et les réglages lus', async () => {
  const { boutiqueDuProprietaire, boutiqueParSlug } = require('../src/lib/reseau/boutiques.ts');
  baseAwa();
  let b = await boutiqueDuProprietaire('reseller', 'rev-1');
  assert.deepEqual(b.options, { reglages: false });
  assert.deepEqual(b.reglages, { rayons: [], annonce: null });
  assert.deepEqual((await boutiqueParSlug('awa-mode')).options, { reglages: false });

  baseAwa({ migree: true });
  b = await boutiqueDuProprietaire('reseller', 'rev-1');
  assert.deepEqual(b.options, { reglages: true }, 'la colonne existe, même vide');
  assert.deepEqual(b.reglages, { rayons: [], annonce: null });
  baseAwa({ migree: true, reglages: { rayons: [{ cle: 'x', nom: 'Pagnes', ids: ['p1'] }], annonce: { texte: 'Bonjour', fin: '2026-10-10' } } });
  b = await boutiqueParSlug('awa-mode');
  assert.deepEqual(b.reglages, { rayons: [{ cle: 'pagnes', nom: 'Pagnes', ids: ['p1'] }], annonce: { texte: 'Bonjour', fin: '2026-10-10' } });
});

test('AVANT le SQL : majBoutique({reglages}) donne 409 « Option pas encore activée », jamais 500, et n’écrit rien', async () => {
  const { majBoutique } = require('../src/lib/reseau/boutiques.ts');
  const { OPTION_ABSENTE } = require('../src/lib/boutique-reglages.ts');
  assert.equal(OPTION_ABSENTE, 'Option pas encore activée (mise à jour de la base à appliquer).');
  baseAwa();
  let r = await majBoutique('s1', 'rev-1', {}, { reglages: { rayons: [PAGNES] }, selection: ['p1', 'p2', 'p3'] });
  assert.deepEqual(r, { ok: false, erreur: OPTION_ABSENTE, statut: 409 });
  r = await majBoutique('s1', 'rev-1', { accroche: 'Bonjour' }, { reglages: { annonce: { texte: 'Arrivage', fin: jour(3) } } });
  assert.equal(r.statut, 409);
  assert.deepEqual(ecritures(), [], 'rien n’est écrit, pas même le mot d’accueil envoyé avec');
  assert.equal(etat.stores[0].tagline, 'Pagnes et bazins');

  // La colonne disparaît entre la lecture et l'écriture, ou le cache de l'API n'est
  // pas rechargé : même réponse, quel que soit le code renvoyé.
  for (const code of ['42703', 'PGRST204']) {
    baseAwa({ migree: true });
    fautes['stores:update'] = code;
    r = await majBoutique('s1', 'rev-1', {}, { reglages: { rayons: [PAGNES] }, selection: ['p1'] });
    assert.deepEqual(r, { ok: false, erreur: OPTION_ABSENTE, statut: 409 }, code);
  }
  // Boutique d'un autre : introuvable, rien n'est écrit.
  baseAwa({ migree: true });
  r = await majBoutique('s2', 'rev-1', {}, { reglages: { rayons: [] }, selection: [] });
  assert.equal(r.ok, false);
  assert.equal(r.statut, 404);
  assert.deepEqual(ecritures(), []);
  // Sans réglages, majBoutique répond exactement comme avant.
  baseAwa();
  assert.deepEqual(await majBoutique('s1', 'rev-1', { accroche: 'Bonjour' }), { ok: true });
});

test('AVANT le SQL : GET /api/reseller/boutique renvoie options {reglages: false, adresse: false} ; PATCH {reglages} → 409 sans rien lire ni écrire ; le reste s’enregistre', async () => {
  baseAwa();
  let reponse = await lireBoutique();
  assert.equal(reponse.status, 200);
  let json = await reponse.json();
  assert.deepEqual(json.options, { reglages: false, adresse: false });
  assert.deepEqual(json.boutique.reglages, { rayons: [], annonce: null });
  assert.doesNotMatch(JSON.stringify(json), NOM_COMPLET);
  json = await (await lireBoutique('?creer=non')).json();
  assert.deepEqual(json.options, { reglages: false, adresse: false });

  operations = [];
  reponse = await patcher({ reglages: { rayons: [PAGNES] } });
  assert.equal(reponse.status, 409);
  assert.deepEqual(await reponse.json(), { error: 'Option pas encore activée (mise à jour de la base à appliquer).' });
  assert.deepEqual(ecritures(), []);
  assert.ok(!operations.some((o) => o.table === 'reseller_shop_items'), 'la sélection n’est même pas lue');
  // Un enregistrement ordinaire fonctionne comme au lot 5.
  reponse = await patcher({ accroche: 'Livré à Bamako' });
  assert.equal(reponse.status, 200);
  json = await reponse.json();
  assert.equal(json.boutique.accroche, 'Livré à Bamako');
  assert.deepEqual(json.options, { reglages: false, adresse: false });
  assert.ok(!('reglages' in etat.stores[0]), 'aucune colonne inventée');

  // Sans boutique ni session.
  reinitialiser();
  etat.profiles = [{ id: 'rev-9', full_name: 'Sans Boutique', reseller_code: 'SB9' }];
  sessionCourante = revendeur('rev-9');
  assert.deepEqual((await (await lireBoutique('?creer=non')).json()).options, { reglages: false, adresse: false });
  sessionCourante = null;
  assert.equal((await patcher({ reglages: { rayons: [] } })).status, 401);
});

test('AVANT le SQL : le rendu de BoutiqueProduits est identique, rayons automatiques compris', () => {
  const BoutiqueProduits = require('../src/components/shop/BoutiqueProduits.tsx').default;
  const { organiserVitrine } = require('../src/components/shop/BoutiqueProduits.tsx');
  const p = (id, nom, categorie, enPlus = {}) => ({ id, slug: id, nom, categorie, image: null, images: [], prix: 1000, enStock: true, garantieMois: 0, ...enPlus });
  const produits = [
    p('c1', 'Théière', 'Cuisine'), p('p1', 'Pagne wax', 'Tissus'), p('p2', 'Bazin', 'Tissus', { coupDeCoeur: true }),
    p('c2', 'Bol', 'Cuisine', { enStock: false }), p('c3', 'Marmite', 'Cuisine'), p('s1', 'Sans rayon', ''),
  ];
  const rendre = (props = {}) => renderToStaticMarkup(React.createElement(BoutiqueProduits, { produits, refCode: 'AWA1', ...props }));
  const sans = rendre();
  assert.equal(rendre({ rayonsMaison: [] }), sans, 'aucun rayon maison : même HTML');
  assert.equal(rendre({ rayonsMaison: undefined }), sans);
  // Le rendu du lot 5 : coups de cœur, puis les catégories dans l'ordre de leur premier article, épuisés en fin de rayon.
  assert.deepEqual([...sans.matchAll(/data-carte="([^"]+)"/g)].map((m) => m[1]), ['Bazin', 'Théière', 'Marmite', 'Bol', 'Pagne wax', 'Sans rayon']);
  assert.deepEqual([...sans.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]), ['coups-de-coeur', 'rayon-1', 'rayon-2', 'rayon-3']);
  assert.match(sans, /Cuisine <span[^>]*>\(3\)<\/span>[\s\S]*Tissus <span[^>]*>\(1\)<\/span>[\s\S]*Autres articles <span[^>]*>\(1\)<\/span>/);
  assert.deepEqual(organiserVitrine(produits, '').groupes.map(([nom, items]) => [nom, items.length]), [['Cuisine', 3], ['Tissus', 1], ['Autres articles', 1]]);
  assert.deepEqual(organiserVitrine(produits, 'autres').groupes, [], 'la recherche ne trouve pas un rayon de secours');
});

// ── 4. Le fichier SQL, dans un PostgreSQL local en mémoire ──────────────────

async function baseSql() {
  const { database, sql } = require('./helpers/audit-db.cjs');
  const pg = await database();
  await pg.exec(`INSERT INTO public.profiles (id, phone, full_name, role) VALUES
    ('rev-1', '+22370000001', '[TEST] Awa', 'reseller'), ('rev-2', '+22370000002', '[TEST] Moussa', 'reseller')`);
  await pg.exec(`INSERT INTO public.stores (id, owner_type, owner_id, slug, name) VALUES
    ('s1', 'reseller', 'rev-1', 'awa-traore', '[TEST] Awa Mode'), ('s2', 'reseller', 'rev-2', 'chez-moussa', '[TEST] Chez Moussa')`);
  return { pg, texte: sql(SQL) };
}
const un = async (pg, q) => (await pg.query(q)).rows[0];

test('SQL (PGlite) : le fichier s’exécute deux fois de suite ; la colonne vaut {} sans toucher aux boutiques ; la contrainte refuse [] et plus de 16 Ko', async () => {
  const { pg, texte } = await baseSql();
  await pg.exec(texte);
  await pg.exec(texte);
  const colonnes = (await pg.query(`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'stores' AND column_name = 'reglages'`)).rows;
  assert.equal(colonnes.length, 1, 'vérification 1 du fichier');
  assert.equal((await un(pg, `SELECT to_regclass('public.store_slug_aliases')::text AS t`)).t, 'store_slug_aliases', 'vérification 2');
  assert.equal(Number((await un(pg, `SELECT count(*) AS n FROM public.store_slug_aliases a JOIN public.stores s ON lower(s.slug) = a.slug`)).n), 0, 'vérification 4');
  const s1 = await un(pg, `SELECT slug, name, reglages FROM public.stores WHERE id = 's1'`);
  assert.deepEqual(s1, { slug: 'awa-traore', name: '[TEST] Awa Mode', reglages: {} }, 'boutique existante intacte, réglages vides');
  assert.equal(Number((await un(pg, `SELECT count(*) AS n FROM pg_constraint WHERE conname = 'stores_reglages_objet'`)).n), 1, 'une seule contrainte après deux exécutions');

  await pg.exec(`UPDATE public.stores SET reglages = '{"rayons":[{"cle":"pagnes","nom":"Pagnes","ids":["p1"]}],"annonce":{"texte":"Bonjour","fin":"2026-10-10"}}'::jsonb WHERE id = 's1'`);
  await assert.rejects(pg.exec(`UPDATE public.stores SET reglages = '[]'::jsonb WHERE id = 's1'`), /stores_reglages_objet/);
  await assert.rejects(pg.exec(`UPDATE public.stores SET reglages = '"texte"'::jsonb WHERE id = 's1'`), /stores_reglages_objet/);
  await assert.rejects(pg.exec(`UPDATE public.stores SET reglages = jsonb_build_object('x', repeat('a', 20000)) WHERE id = 's1'`), /stores_reglages_objet/);
  await assert.rejects(pg.exec(`UPDATE public.stores SET reglages = NULL WHERE id = 's1'`));
  // Rejouer le fichier ne remet pas les réglages à zéro.
  await pg.exec(texte);
  assert.equal((await un(pg, `SELECT reglages->'rayons'->0->>'nom' AS nom FROM public.stores WHERE id = 's1'`)).nom, 'Pagnes');
});

test('SQL (PGlite) : changer_adresse_boutique renvoie ok, puis deja_change ; pris (adresse active ou ancienne adresse) ; invalide ; introuvable', async () => {
  const { pg, texte } = await baseSql();
  await pg.exec(texte);
  await pg.exec(texte);
  const changer = async (store, proprietaire, nouveau) => (await un(pg, `SELECT public.changer_adresse_boutique('${store}', '${proprietaire}', ${nouveau === null ? 'NULL' : `'${nouveau}'`}) AS r`)).r;

  for (const invalide of ['Awa Mode!', 'ab', '-awa', 'awa--mode', 'x'.repeat(51), '', null]) assert.equal(await changer('s1', 'rev-1', invalide), 'invalide', String(invalide));
  assert.equal(await changer('s1', 'rev-2', 'awa-mode'), 'introuvable', 'mauvais propriétaire');
  assert.equal(await changer('inconnue', 'rev-1', 'awa-mode'), 'introuvable');
  assert.equal(await changer('s1', 'rev-1', 'awa-traore'), 'identique');
  assert.equal(await changer('s1', 'rev-1', 'chez-moussa'), 'pris', 'adresse active d’une autre boutique');
  assert.equal(await changer('s1', 'rev-1', 'Chez-Moussa'), 'pris', 'sans tenir compte des majuscules');
  assert.equal((await un(pg, `SELECT slug FROM public.stores WHERE id = 's1'`)).slug, 'awa-traore', 'rien n’a changé');

  assert.equal(await changer('s1', 'rev-1', ' Awa-Mode '), 'ok');
  assert.equal((await un(pg, `SELECT slug FROM public.stores WHERE id = 's1'`)).slug, 'awa-mode');
  assert.deepEqual((await pg.query(`SELECT slug, store_id FROM public.store_slug_aliases`)).rows, [{ slug: 'awa-traore', store_id: 's1' }], 'l’ancienne adresse est gardée');
  assert.equal(await changer('s1', 'rev-1', 'awa-chic'), 'deja_change', 'un seul changement');
  assert.equal(await changer('s2', 'rev-2', 'awa-mode'), 'pris', 'adresse active');
  assert.equal(await changer('s2', 'rev-2', 'awa-traore'), 'pris', 'ancienne adresse : jamais reprise');
  assert.equal((await un(pg, `SELECT slug FROM public.stores WHERE id = 's2'`)).slug, 'chez-moussa');
  assert.equal(Number((await un(pg, `SELECT count(*) AS n FROM public.store_slug_aliases a JOIN public.stores s ON lower(s.slug) = a.slug`)).n), 0, 'vérification 4 après un changement');
  // La boutique supprimée emporte son ancienne adresse.
  await pg.exec(`DELETE FROM public.stores WHERE id = 's1'`);
  assert.equal(Number((await un(pg, `SELECT count(*) AS n FROM public.store_slug_aliases`)).n), 0);
});

test('SQL (texte) : droits retirés à PUBLIC, anon et authenticated pour la table et la fonction ; rejouable ; aucune table d’articles touchée', () => {
  const texte = lire(`supabase/${SQL}`);
  const sql = texte.replace(/--[^\n]*/g, '');
  assert.match(sql, /REVOKE ALL ON public\.store_slug_aliases FROM PUBLIC, anon, authenticated;/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.changer_adresse_boutique\(TEXT, TEXT, TEXT\) FROM PUBLIC, anon, authenticated;/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.changer_adresse_boutique\(TEXT, TEXT, TEXT\) TO service_role;/);
  assert.match(sql, /GRANT SELECT, INSERT, DELETE ON public\.store_slug_aliases TO service_role;/);
  assert.doesNotMatch(sql, /GRANT[^;]*\b(?:anon|authenticated)\b/i, 'rien n’est accordé aux rôles publics');
  assert.match(sql, /ALTER TABLE public\.store_slug_aliases ENABLE ROW LEVEL SECURITY;/);
  assert.match(sql, /SECURITY INVOKER\s+SET search_path = public/);
  assert.doesNotMatch(sql, /SECURITY DEFINER/);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS reglages JSONB NOT NULL DEFAULT '\{\}'::jsonb;/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.store_slug_aliases/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.changer_adresse_boutique/);
  assert.match(sql, /^BEGIN;[\s\S]*COMMIT;\s*NOTIFY pgrst, 'reload schema';/m);
  assert.doesNotMatch(sql, /reseller_shop_items|store_products|\bDROP\b|\bDELETE FROM\b|\bTRUNCATE\b/i);
  // Vérifications et retour arrière, en commentaire en fin de fichier.
  for (const n of [1, 2, 3, 4]) assert.match(texte, new RegExp(`-- Vérification ${n} \\(attendu`));
  assert.match(texte, /-- Retour arrière[\s\S]*DROP FUNCTION IF EXISTS public\.changer_adresse_boutique[\s\S]*DROP COLUMN IF EXISTS reglages;/);
  assert.match(texte, /Le code fonctionne AVANT ce fichier/);
  // Un seul fichier SQL pour tout le chantier boutique.
  assert.deepEqual(fs.readdirSync(path.join(RACINE, 'supabase')).filter((f) => f.startsWith('A-EXECUTER-2026-10-03')), [SQL]);
});

// ── 5. APRÈS le SQL : écriture des réglages ─────────────────────────────────

test('APRÈS : PATCH {reglages: {rayons}} n’écrit que stores.reglages ; articles filtrés par la sélection de la SESSION ; reseller_shop_items jamais touché', async () => {
  baseAwa({ migree: true, reglages: { annonce: { texte: 'Bonjour', fin: jour(5) } } });
  assert.deepEqual((await (await lireBoutique()).json()).options, { reglages: true, adresse: false });

  operations = [];
  const selectionAvant = JSON.stringify(etat.reseller_shop_items);
  const reponse = await patcher({
    reglages: { rayons: [{ nom: 'Pagnes', ids: ['p1', 'p2', 'p3', 'x1', 'inconnu'], cle: 'forgee' }, { nom: 'Pour la fête', ids: ['p1', 'c2'] }] },
    recrute: true, whatsapp: '+22376123456', slug: 'pirate', followers_count: 9999,
  });
  assert.equal(reponse.status, 200);
  const json = await reponse.json();
  const attendus = [{ cle: 'pagnes', nom: 'Pagnes', ids: ['p1', 'p2', 'p3'] }, { cle: 'pour-la-fete', nom: 'Pour la fête', ids: ['c2'] }];
  assert.deepEqual(json.boutique.reglages.rayons, attendus, 'l’article de Moussa et l’inconnu sont retirés ; p1 reste dans son premier rayon');
  assert.deepEqual(json.options, { reglages: true, adresse: false });
  assert.deepEqual(reglagesDe().rayons, attendus);
  assert.deepEqual(reglagesDe().annonce, { texte: 'Bonjour', fin: jour(5) }, 'l’annonce n’est pas effacée par les rayons');
  // Une seule écriture : un UPDATE de stores, avec seulement la date et les réglages.
  assert.deepEqual(ecritures().map((o) => [o.table, o.op]), [['stores', 'update']]);
  assert.deepEqual(Object.keys(ecritures()[0].patch).sort(), ['reglages', 'updated_at']);
  assert.equal(JSON.stringify(etat.reseller_shop_items), selectionAvant, 'la sélection (et ses offres) est intacte');
  assert.equal(etat.stores[0].slug, 'awa-mode');
  assert.deepEqual(reglagesDe('s2'), {}, 'la boutique de Moussa n’a pas bougé');

  // Refus : rien n'est écrit, le message dit pourquoi.
  for (const [rayons, message] of [
    [Array.from({ length: 9 }, (_, i) => ({ nom: `Rayon ${String.fromCharCode(65 + i)}`, ids: [] })), '8 rayons au plus.'],
    [[{ nom: 'x'.repeat(25), ids: [] }], 'Le nom d’un rayon fait 24 caractères au plus.'],
    [[{ nom: 'Promo -20 %', ids: [] }], 'Pas de prix ni de remise dans le nom d’un rayon.'],
  ]) {
    operations = [];
    const refus = await patcher({ reglages: { rayons } });
    assert.equal(refus.status, 400);
    assert.deepEqual(await refus.json(), { error: message });
    assert.deepEqual(ecritures(), []);
  }
  assert.deepEqual(reglagesDe().rayons, attendus);

  // Sélection illisible : on n'écrit pas des rayons qu'on ne sait pas vérifier.
  fautes['reseller_shop_items:select'] = 'XX000';
  operations = [];
  const indisponible = await patcher({ reglages: { rayons: [PAGNES] } });
  assert.equal(indisponible.status, 503);
  assert.deepEqual(ecritures(), []);
  delete fautes['reseller_shop_items:select'];

  // Tous les rayons supprimés : les articles restent dans la boutique.
  assert.equal((await patcher({ reglages: { rayons: [] } })).status, 200);
  assert.deepEqual(reglagesDe().rayons, []);
  assert.equal(etat.reseller_shop_items.filter((l) => l.reseller_id === 'rev-1').length, 5);
});

test('APRÈS : PATCH {reglages: {annonce}} garde les rayons, sans lire la sélection ; « -20 % », « 5 000 F » et une fin trop lointaine sont refusés ; null la retire', async () => {
  baseAwa({ migree: true, reglages: { rayons: [{ cle: 'pagnes', nom: 'Pagnes', ids: ['p1'] }] } });
  operations = [];
  let reponse = await patcher({ accroche: 'Bienvenue', reglages: { annonce: { texte: 'Nouveaux pagnes arrivés', fin: jour(7) } } });
  assert.equal(reponse.status, 200);
  assert.deepEqual(reglagesDe(), { rayons: [{ cle: 'pagnes', nom: 'Pagnes', ids: ['p1'] }], annonce: { texte: 'Nouveaux pagnes arrivés', fin: jour(7) } });
  assert.equal(etat.stores[0].tagline, 'Bienvenue', 'enregistrée avec les autres textes');
  assert.ok(!operations.some((o) => o.table === 'reseller_shop_items'), 'pas de rayons dans la requête : la sélection n’est pas lue');

  for (const [annonce, raison] of [
    [{ texte: '-20 % sur tout', fin: jour(3) }, /pourcentage/],
    [{ texte: 'Tout à 5 000 F', fin: jour(3) }, /prix ni de montant/],
    [{ texte: 'Bonjour', fin: jour(15) }, /14 jours au plus/],
    [{ texte: 'Bonjour', fin: jour(-1) }, /déjà passée/],
    [{ texte: 'Bonjour' }, /date de fin/],
  ]) {
    operations = [];
    reponse = await patcher({ accroche: 'Refusé avec', reglages: { annonce } });
    assert.equal(reponse.status, 400, JSON.stringify(annonce));
    assert.match((await reponse.json()).error, raison);
    assert.deepEqual(ecritures(), [], 'une seule valeur refusée : rien n’est écrit');
  }
  assert.equal(etat.stores[0].tagline, 'Bienvenue');
  assert.equal(reglagesDe().annonce.texte, 'Nouveaux pagnes arrivés');

  assert.equal((await patcher({ reglages: { annonce: null } })).status, 200);
  assert.deepEqual(reglagesDe(), { rayons: [{ cle: 'pagnes', nom: 'Pagnes', ids: ['p1'] }], annonce: null });
  assert.equal((await patcher({ reglages: 'illisible' })).status, 400);
});

test('APRÈS : les réglages ne passent jamais par les champs — routes fournisseur, Suguba et « modifier » ne peuvent pas les écrire', async () => {
  const { majBoutique } = require('../src/lib/reseau/boutiques.ts');
  const { champsBoutiqueRevendeur } = require('../src/lib/reseau/champs-boutique-revendeur.ts');
  baseAwa({ migree: true });
  // Corps de requête transmis tel quel (route fournisseur, boutique Suguba) : `reglages` est ignoré.
  const r = await majBoutique('s1', 'rev-1', { accroche: 'Bonjour', reglages: { rayons: [PAGNES], annonce: { texte: 'Pirate', fin: jour(1) } } });
  assert.deepEqual(r, { ok: true });
  assert.deepEqual(reglagesDe(), {});
  assert.ok(!('reglages' in ecritures()[0].patch));
  // La liste blanche du revendeur (partagée avec POST /api/compte/boutiques « modifier ») ne les laisse pas passer.
  const filtre = champsBoutiqueRevendeur({ nom: 'Awa Mode', reglages: { rayons: [PAGNES] } }, { uid: 'rev-1', baseSupabase: 'https://x.supabase.co', boutique: { nom: 'Awa Mode', logo: null, couverture: null, galerie: [] } });
  assert.deepEqual(filtre, { ok: true, champs: { nom: 'Awa Mode' } });
  for (const f of ['src/app/api/supplier/boutique/route.ts', 'src/app/api/admin/boutique-suguba/route.ts', 'src/app/api/compte/boutiques/route.ts', 'src/app/api/supplier/me/route.ts']) {
    assert.doesNotMatch(sansCommentaires(lire(f)), /majBoutique\([^)]*,[^)]*,[^)]*,/, `${f} : pas de 4e argument`);
  }
  // La route du revendeur : sélection lue par la session, jamais dans la requête ; aucune écriture d'articles.
  const route = sansCommentaires(lire('src/app/api/reseller/boutique/route.ts'));
  assert.match(route, /from\('reseller_shop_items'\)\.select\('product_id'\)\.eq\('reseller_id', session\.uid\)/);
  assert.doesNotMatch(route, /reseller_shop_items'\)\.(?:insert|update|upsert|delete)/);
  assert.match(route, /status: resultat\.statut \|\| 400/);
});

// ── 6. Vitrine ──────────────────────────────────────────────────────────────

test('Vitrine : rayons maison d’abord, dans l’ordre choisi, puis automatiques ; ?rayon=<cle> les vise ; même nom qu’une catégorie = un seul rayon', () => {
  const { organiserVitrine, ancreDuRayon } = require('../src/components/shop/BoutiqueProduits.tsx');
  const BoutiqueProduits = require('../src/components/shop/BoutiqueProduits.tsx').default;
  const p = (id, nom, categorie, enPlus = {}) => ({ id, slug: id, nom, categorie, image: null, images: [], prix: 1000, enStock: true, garantieMois: 0, ...enPlus });
  const produits = [
    p('c1', 'Théière', 'Cuisine'), p('p1', 'Pagne wax', 'Tissus'), p('p2', 'Bazin', 'Tissus'),
    p('c2', 'Bol', 'Cuisine'), p('p3', 'Pagne tissé', 'Mode'), p('m1', 'Robe', 'Mode'), p('h1', 'Châle', 'Mode', { coupDeCoeur: true }),
  ];
  const maison = [
    { cle: 'pour-la-fete', nom: 'Pour la fête', ids: ['c2', 'h1'] },
    { cle: 'pagnes', nom: 'Pagnes', ids: ['p3', 'p1', 'p2', 'disparu'] },
    { cle: 'vide', nom: 'Vide', ids: [] },
  ];
  const v = organiserVitrine(produits, '', maison);
  assert.deepEqual(v.groupes.map(([nom, items]) => [nom, items.map((x) => x.nom)]), [
    ['Pour la fête', ['Bol']],
    ['Pagnes', ['Pagne wax', 'Bazin', 'Pagne tissé']],
    ['Cuisine', ['Théière']],
    ['Mode', ['Robe']],
  ], 'ordre choisi par le revendeur, articles dans l’ordre de la vitrine, rayon vide absent, coup de cœur non répété');
  assert.deepEqual(v.coups.map((x) => x.nom), ['Châle']);
  assert.equal(ancreDuRayon('pagnes', v.coups, v.groupes), 'rayon-2');
  assert.equal(ancreDuRayon('pour-la-fete', v.coups, v.groupes), 'rayon-1');
  assert.equal(ancreDuRayon('vide', v.coups, v.groupes), null);
  assert.equal(ancreDuRayon('tissus', v.coups, v.groupes), null, 'la catégorie « Tissus » n’a plus d’article hors rayon');
  // Recherche : le nom d'un rayon maison se cherche comme une catégorie.
  assert.deepEqual(organiserVitrine(produits, 'pagnes', maison).groupes.map(([nom, items]) => [nom, items.length]), [['Pagnes', 3]]);
  assert.deepEqual(organiserVitrine(produits, 'fete', maison).groupes.map(([nom]) => nom), ['Pour la fête']);
  // Un rayon maison du nom d'une catégorie : les autres articles de la catégorie le rejoignent.
  const mode = organiserVitrine(produits, '', [{ cle: 'mode', nom: 'Mode', ids: ['c1'] }]);
  assert.deepEqual(mode.groupes.map(([nom, items]) => [nom, items.map((x) => x.nom)]), [['Mode', ['Théière', 'Pagne tissé', 'Robe']], ['Tissus', ['Pagne wax', 'Bazin']], ['Cuisine', ['Bol']]]);

  const html = renderToStaticMarkup(React.createElement(BoutiqueProduits, { produits, refCode: 'AWA1', rayonsMaison: maison }));
  assert.deepEqual([...html.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]), ['coups-de-coeur', 'rayon-1', 'rayon-2', 'rayon-3', 'rayon-4']);
  assert.match(html, /Pour la fête <span[^>]*>\(1\)<\/span>[\s\S]*Pagnes <span[^>]*>\(3\)<\/span>[\s\S]*Cuisine <span[^>]*>\(1\)<\/span>[\s\S]*Mode <span[^>]*>\(1\)<\/span>/);
  assert.deepEqual([...html.matchAll(/data-carte="([^"]+)"/g)].map((m) => m[1]), ['Châle', 'Bol', 'Pagne wax', 'Bazin', 'Pagne tissé', 'Théière', 'Robe']);
});

const ouvrirVitrine = async (recherche = {}) => {
  const page = require('../src/app/boutique/[slug]/page.tsx');
  return page.default({ params: Promise.resolve({ slug: 'awa-mode' }), searchParams: Promise.resolve(recherche) });
};

test('Vitrine AVANT le SQL : aucune tuile « Rayons », aucune annonce, rayons automatiques ; la page ne transmet que des réglages vides', async () => {
  baseAwa();
  const el = await ouvrirVitrine();
  assert.deepEqual(el.props.reglages, { rayons: [], annonce: null, option: false });
  const html = renderToStaticMarkup(el);
  assert.doesNotMatch(html, /\/reseller\/boutique\/rayons/);
  assert.doesNotMatch(html, /Annonce de la boutique/);
  assert.match(html, /class="grid grid-cols-2 sm:grid-cols-4 gap-2"/, 'bandeau du lot 5 : 4 tuiles');
  assert.equal((html.match(/min-h-14/g) || []).length, 4);
  assert.match(html, /Cuisine <span[^>]*>\(2\)<\/span>[\s\S]*Tissus <span[^>]*>\(2\)<\/span>[\s\S]*Mode <span[^>]*>\(1\)<\/span>/);
});

test('Vitrine APRÈS : le rayon « Pagnes » de 3 articles est en tête ; ?rayon=pagnes l’annonce dans l’aperçu ; tuile « Rayons » pour le propriétaire seul', async () => {
  const page = require('../src/app/boutique/[slug]/page.tsx');
  baseAwa({ migree: true, reglages: { rayons: [{ cle: 'pagnes', nom: 'Pagnes', ids: ['p1', 'p2', 'p3'] }] } });
  // Propriétaire qui gère.
  let el = await ouvrirVitrine({ rayon: 'pagnes' });
  assert.deepEqual(el.props.reglages, { rayons: [{ cle: 'pagnes', nom: 'Pagnes', ids: ['p1', 'p2', 'p3'] }], annonce: null, option: true });
  assert.equal(el.props.rayon, 'pagnes');
  let html = renderToStaticMarkup(el);
  assert.match(html, /Pagnes <span[^>]*>\(3\)<\/span>[\s\S]*Cuisine <span[^>]*>\(2\)<\/span>/, 'le rayon maison passe devant');
  assert.doesNotMatch(html, /Tissus <span/, 'les catégories vidées par le rayon n’apparaissent plus');
  assert.match(html, /<a href="\/reseller\/boutique\/rayons"[^>]*>[\s\S]*?Rayons<\/span><\/a>/);
  assert.match(html, /class="grid grid-cols-6 sm:grid-cols-5 gap-2"/);
  assert.equal((html.match(/min-h-14/g) || []).length, 5);
  assert.doesNotMatch(html, /À la une|prix de gros/i);
  let meta = await page.generateMetadata({ params: Promise.resolve({ slug: 'awa-mode' }), searchParams: Promise.resolve({ rayon: 'pagnes' }) });
  assert.equal(meta.title, 'Pagnes · Awa Mode — Suguba');
  meta = await page.generateMetadata({ params: Promise.resolve({ slug: 'awa-mode' }), searchParams: Promise.resolve({ rayon: 'tissus' }) });
  assert.equal(meta.title, 'Awa Mode — Suguba', 'rayon vidé : titre de la boutique');

  // Visiteur : mêmes rayons, aucun outil, et rien qui dise l'état de la base.
  sessionCourante = null;
  el = await ouvrirVitrine();
  assert.equal(el.props.reglages.option, false);
  html = renderToStaticMarkup(el);
  assert.match(html, /Pagnes <span[^>]*>\(3\)<\/span>/);
  assert.doesNotMatch(html, /\/reseller\/boutique/);
  // Autre profil actif (client) sur sa propre boutique : pas d'outil non plus.
  sessionCourante = revendeur('rev-1', { role: 'customer' });
  assert.equal((await ouvrirVitrine()).props.reglages.option, false);

  // Sélection vide : la vitrine montre le catalogue Suguba, sans rayon maison.
  sessionCourante = null;
  etat.reseller_shop_items = [];
  html = renderToStaticMarkup(await ouvrirVitrine());
  assert.doesNotMatch(html, /Pagnes <span/);
  assert.deepEqual(ecritures(), [], 'ouvrir la vitrine n’écrit rien');
});

test('Vitrine APRÈS : l’annonce s’affiche jusqu’à sa date de fin, puis son texte quitte la page ; jamais de HTML interprété', async () => {
  baseAwa({ migree: true, reglages: { annonce: { texte: 'Nouveaux pagnes <b>arrivés</b> & bazins', fin: jour(0) } } });
  sessionCourante = null;
  let el = await ouvrirVitrine();
  assert.equal(el.props.reglages.annonce, 'Nouveaux pagnes arrivés & bazins', 'dernier jour : encore affichée');
  let html = renderToStaticMarkup(el);
  assert.match(html, /role="note" aria-label="Annonce de la boutique"[\s\S]*?Nouveaux pagnes arrivés &amp; bazins<\/p>/);
  assert.doesNotMatch(html, /<b>arrivés/);
  assert.doesNotMatch(html, />Modifier<\/a>/, 'un visiteur ne voit pas « Modifier »');

  // Le propriétaire qui gère a « Modifier », masqué en vue client.
  sessionCourante = revendeur('rev-1');
  html = renderToStaticMarkup(await ouvrirVitrine());
  assert.match(html, /<a href="\/reseller\/boutique#annonce" class="[^"]*group-data-\[vue=client\]:hidden[^"]*">Modifier<\/a>/);

  // Date de fin passée : le texte n'est plus dans la page, sans aucune écriture.
  sessionCourante = null;
  etat.stores[0].reglages.annonce.fin = jour(-1);
  el = await ouvrirVitrine();
  assert.equal(el.props.reglages.annonce, null);
  html = renderToStaticMarkup(el);
  assert.doesNotMatch(html, /Nouveaux pagnes|Annonce de la boutique/);
  assert.deepEqual(ecritures(), []);

  // /r/ et /s/ ne reçoivent pas de réglages : leur rendu ne change pas.
  const ShopView = require('../src/components/shop/ShopView.tsx').default;
  const { chargerBoutiqueRevendeur } = require('../src/lib/shop.ts');
  etat.stores[0].reglages = { rayons: [{ cle: 'pagnes', nom: 'Pagnes', ids: ['p1'] }], annonce: { texte: 'Bonjour à tous', fin: jour(3) } };
  const ancienne = renderToStaticMarkup(React.createElement(ShopView, { boutique: await chargerBoutiqueRevendeur('AWA1'), urlPartage: 'u', refCode: 'AWA1' }));
  assert.doesNotMatch(ancienne, /Bonjour à tous|Pagnes <span/);
  assert.doesNotMatch(sansCommentaires(lire('src/app/r/[code]/page.tsx')), /reglages/);
});

// ── 7. Partage d'un rayon ───────────────────────────────────────────────────

test('Partage : les rayons maison sont proposés en premier ; « Partager ce rayon » cite ses articles ; le lien porte le nom du rayon maison', async () => {
  const P = require('../src/lib/partage-boutique.ts');
  const articles = [
    { id: 'c1', nom: 'Théière', prix: 3500, categorie: 'Cuisine', enStock: true },
    { id: 'p1', nom: 'Pagne wax', prix: 12500, categorie: 'Tissus', enStock: true },
    { id: 'p2', nom: 'Bazin', prix: 30000, categorie: 'Tissus', coupDeCoeur: true, enStock: true },
    { id: 'p3', nom: 'Pagne tissé', prix: 9000, categorie: 'Mode', enStock: false },
    { id: 'c2', nom: 'Bol', prix: 1500, categorie: 'Cuisine', enStock: true },
  ];
  const maison = [{ cle: 'fete', nom: 'Fête', ids: [] }, { cle: 'pagnes', nom: 'Pagnes', ids: ['p1', 'p2', 'p3'] }];
  assert.deepEqual(P.choixDePartage(articles, maison), [
    { cle: null, libelle: 'Toute ma boutique', nombre: 5 },
    { cle: 'coups-de-coeur', libelle: 'Mes coups de cœur', nombre: 1 },
    { cle: 'pagnes', libelle: 'Pagnes', nombre: 2 },
    { cle: 'cuisine', libelle: 'Cuisine', nombre: 2 },
  ], 'rayon vide absent, coup de cœur compté à part');
  assert.deepEqual(P.articlesAAnnoncer(articles, 'pagnes', undefined, maison).map((a) => a.nom), ['Pagne wax'], 'ni l’épuisé ni le coup de cœur');
  assert.deepEqual(P.articlesDuChoix(articles, 'pagnes', maison).map((a) => a.nom), ['Pagne wax', 'Pagne tissé']);
  assert.deepEqual(P.articlesDuChoix(articles, 'tissus', maison), []);
  // Sans rayon maison : exactement les choix du lot 4.
  assert.deepEqual(P.choixDePartage(articles).map((c) => c.cle), [null, 'coups-de-coeur', 'cuisine', 'tissus', 'mode']);
  assert.deepEqual(P.choixDePartage(articles, []), P.choixDePartage(articles));
  assert.equal(P.rayonMaisonDe([])({ id: 'p1', categorie: 'Tissus' }), null);
  assert.equal(P.rayonMaisonDe(maison)({ id: 'p1', categorie: 'Tissus' }), 'Pagnes');
  assert.equal(P.rayonMaisonDe(maison)({ id: 'c1', categorie: 'Cuisine' }), null);
  // Les articles de « Mes articles » gardent leur identifiant, rien de privé n'en sort.
  assert.deepEqual(P.versArticlesPartage([{ id: 'p1', nom: 'Pagne', prixVitrine: 100, gain: 50, categorie: 'Tissus', coupDeCoeur: false, etat: 'affiche' }]),
    [{ id: 'p1', nom: 'Pagne', prix: 100, categorie: 'Tissus', coupDeCoeur: false, enStock: true }]);

  // Route du partage : le libellé du lien est le nom du rayon maison, lu avec la boutique de la session.
  baseAwa({ migree: true, reglages: { rayons: [{ cle: 'pagnes', nom: 'Pagnes', ids: ['p1', 'p2'] }] } });
  const { POST } = require('../src/app/api/reseller/boutique/partage/route.ts');
  const preparer = (corps) => POST(requete('/api/reseller/boutique/partage', { method: 'POST', body: JSON.stringify(corps) }));
  let json = await (await preparer({ canal: 'whatsapp', rayon: 'pagnes' })).json();
  assert.equal(json.suivi, true);
  assert.equal(etat.tracking_links.find((l) => l.target_ref === 'awa-mode~pagnes').label, 'Pagnes');
  // Un rayon automatique garde le nom de sa catégorie.
  json = await (await preparer({ canal: 'whatsapp', rayon: 'cuisine' })).json();
  assert.equal(etat.tracking_links.find((l) => l.target_ref === 'awa-mode~cuisine').label, 'Cuisine');

  const feuille = sansCommentaires(lire('src/components/shop/proprietaire/PartageBoutique.tsx'));
  assert.match(feuille, /choixDePartage\(articles \|\| \[\], rayons\)/);
  assert.match(feuille, /articlesAAnnoncer\(articles \|\| \[\], cle, undefined, rayons\)/);
  // Relecture du lot 6 : appliqué pendant le rendu, plus dans un effet (voir ma-boutique-lot6-relecture.test.cjs).
  assert.match(feuille, /const demande = ouvert \? choixInitial : null;/);
  assert.match(feuille, /if \(demande\) setChoix\(demande\);/);
  assert.match(feuille, /rayons: lireReglages\(b\.reglages\)\.rayons/, 'rayons lus par la règle commune, jamais bruts');
});

test('Accueil et Statistiques : les rayons maison ne sont joints à la boutique que s’il y en a (réponses du lot 5 inchangées avant le SQL)', async () => {
  const moi = () => require('../src/app/api/reseller/me/route.ts').GET(requete('/api/reseller/me?avec=boutique'));
  const stats = () => require('../src/app/api/reseller/boutique/stats/route.ts').GET(requete('/api/reseller/boutique/stats?jours=7'));
  baseAwa();
  let json = await (await moi()).json();
  assert.equal(json.boutique.slug, 'awa-mode');
  assert.ok(!('rayons' in json.boutique) && !('reglages' in json.boutique) && !('options' in json.boutique));
  json = await (await stats()).json();
  assert.deepEqual(json.boutique, { slug: 'awa-mode', nom: 'Awa Mode', enseigne: true, statut: 'active' });
  baseAwa({ migree: true });
  assert.ok(!('rayons' in (await (await moi()).json()).boutique), 'colonne présente mais aucun rayon : rien de plus');
  baseAwa({ migree: true, reglages: { rayons: [{ cle: 'pagnes', nom: 'Pagnes', ids: ['p1'] }], annonce: { texte: 'Bonjour', fin: jour(2) } } });
  json = await (await moi()).json();
  assert.deepEqual(json.boutique.rayons, [{ cle: 'pagnes', nom: 'Pagnes', ids: ['p1'] }]);
  json = await (await stats()).json();
  assert.deepEqual(json.boutique.rayons, [{ cle: 'pagnes', nom: 'Pagnes', ids: ['p1'] }]);
  assert.deepEqual(ecritures(), [], 'lectures seules');
  assert.match(sansCommentaires(lire('src/app/reseller/page.tsx')), /slug: boutique\.slug, statut: boutique\.statut, rayons: boutique\.rayons \}\}/);
  assert.match(sansCommentaires(lire('src/app/reseller/boutique/statistiques/page.tsx')), /slug: boutique\.slug, statut: boutique\.statut, rayons: boutique\.rayons \}\}/);
});

// ── 8. Composants ───────────────────────────────────────────────────────────

test('SelecteurArticles (extrait de Mes boutiques) : avec bouton « Enregistrer N article(s) », ou sans bouton quand l’écran a déjà son action', () => {
  const SelecteurArticles = require('../src/components/reseau/SelecteurArticles.tsx').default;
  const { formatF } = require('../src/lib/montant.ts');
  const catalogue = [
    { id: 'p1', nom: 'Pagne wax', image: 'https://img/p1.webp', prix: 12500, note: 'Dans « Fête »' },
    { id: 'p2', nom: 'Bazin', image: null, prix: null },
  ];
  let html = renderToStaticMarkup(React.createElement(SelecteurArticles, { catalogue, choisis: ['p1'], onEnregistrer: async () => {} }));
  assert.match(html, /Enregistrer 1 article\(s\)<\/button>/);
  assert.match(html, /max-h-80 overflow-y-auto/);
  assert.equal((html.match(/type="checkbox"/g) || []).length, 2);
  assert.equal((html.match(/checked=""/g) || []).length, 1);
  // Relecture du lot 6 : la note a sa propre ligne sous le prix (elle était coupée à 390 px).
  assert.ok(html.includes(`>${formatF(12500)}</span><span class="block text-slate-500 break-words">Dans « Fête »</span>`), 'prix en formatF, puis la note');
  assert.match(html, />—<\/span>/, 'prix inconnu : « — », jamais 0');
  assert.match(html, /aria-label="Rechercher un article"/);
  assert.match(html, /min-h-\[60px\]/, 'ligne de 60 px pour le pouce');

  html = renderToStaticMarkup(React.createElement(SelecteurArticles, { catalogue, choisis: [], onChange: () => {}, listeClassName: '' }));
  assert.doesNotMatch(html, /<button/, 'pas de bouton : l’écran a déjà son action principale');
  assert.doesNotMatch(html, /max-h-80/);

  // Mes boutiques utilise le composant extrait, sans copie locale.
  const mesBoutiques = lire('src/app/compte/boutiques/page.tsx');
  assert.match(mesBoutiques, /import SelecteurArticles from '@\/components\/reseau\/SelecteurArticles';/);
  assert.doesNotMatch(mesBoutiques, /function SelecteurArticles/);
  assert.match(mesBoutiques, /<SelecteurArticles\s+catalogue=\{d\.catalogue\}\s+choisis=\{d\.articles\[b\.id\] \|\| \[\]\}\s+onEnregistrer=/);
});

test('FeuilleRayon : création (nom, articles cochés, « Ajouter ce rayon ») ; modification (« Valider », « Supprimer ce rayon ») ; rien n’y est écrit', () => {
  const FeuilleRayon = require('../src/components/shop/proprietaire/FeuilleRayon.tsx').default;
  const articles = [{ id: 'p1', nom: 'Pagne wax', image: null, prix: 12500 }, { id: 'c1', nom: 'Théière', image: null, prix: 3500, note: 'Dans « Fête »' }];
  const rendre = (props) => renderToStaticMarkup(React.createElement(FeuilleRayon, {
    ouvert: true, onFermer() {}, articles, refus: (nom) => (nom.trim().length < 2 ? 'Le nom d’un rayon fait au moins 2 caractères.' : null), onValider() {}, ...props,
  }));
  let html = rendre({ creation: true, nomInitial: '', idsInitial: [] });
  assert.match(html, /data-feuille="Nouveau rayon"/);
  assert.match(html, /maxLength="24"/);
  assert.match(html, /<button[^>]*disabled=""[^>]*>Ajouter ce rayon<\/button>/, 'sans nom ni article : inactif');
  assert.doesNotMatch(html, /role="alert"/, 'pas de reproche avant d’avoir écrit');
  assert.doesNotMatch(html, /Supprimer ce rayon/);
  assert.match(html, /Un article n’est rangé que dans un seul rayon\./);
  assert.match(html, /Dans « Fête »/);

  html = rendre({ creation: false, nomInitial: 'Pagnes', idsInitial: ['p1'], onSupprimer() {} });
  assert.match(html, /data-feuille="Modifier le rayon"/);
  assert.match(html, /value="Pagnes"/);
  assert.match(html, /<button(?![^>]*\sdisabled="")[^>]*>Valider<\/button>/);
  assert.match(html, /Supprimer ce rayon<\/button>/);
  assert.match(html, /Ses articles restent dans votre boutique\./);
  assert.match(html, /Renommer un rayon change son lien de partage\./);
  assert.equal(renderToStaticMarkup(React.createElement(FeuilleRayon, { ouvert: false, onFermer() {}, creation: true, nomInitial: '', idsInitial: [], articles, refus: () => null, onValider() {} })), '');
  // La feuille n'appelle aucune route : elle pose le rayon à l'écran.
  assert.doesNotMatch(sansCommentaires(lire('src/components/shop/proprietaire/FeuilleRayon.tsx')), /fetch\(/);
});

test('BandeauProprietaire : tuile « Rayons » seulement quand la base le permet ; les rayons maison vont à la feuille de partage', () => {
  const Bandeau = require('../src/components/shop/proprietaire/BandeauProprietaire.tsx').default;
  const identite = { nom: 'Awa Mode', enseigne: true, accroche: null, logo: null, couverture: null };
  const rendre = (props = {}) => renderToStaticMarkup(React.createElement(Bandeau, { identite, statut: 'active', urlPartage: 'https://app.sugubaml.com/boutique/awa-mode', ...props }));
  const sans = rendre();
  assert.doesNotMatch(sans, /Rayons/);
  assert.match(sans, /grid grid-cols-2 sm:grid-cols-4 gap-2/);
  const avec = rendre({ optionRayons: true, rayons: [{ cle: 'pagnes', nom: 'Pagnes', ids: [] }] });
  assert.match(avec, /<a href="\/reseller\/boutique\/rayons"[^>]*min-h-14[^>]*>[\s\S]*?<span[^>]*>Rayons<\/span><\/a>/);
  // 5 tuiles : 3 puis 2 sur téléphone ; les deux du bas plus larges (« 7 j : 1 250 visites » entier).
  assert.match(avec, /grid grid-cols-6 sm:grid-cols-5 gap-2/);
  assert.equal((avec.match(/col-span-2 sm:col-span-1/g) || []).length, 3);
  assert.equal((avec.match(/col-span-3 sm:col-span-1/g) || []).length, 2);
  assert.doesNotMatch(sans, /col-span/, 'sans l’option : les tuiles du lot 5, à l’identique');
  assert.deepEqual([...avec.matchAll(/<span class="truncate max-w-full">([^<]+)<\/span>/g)].map((m) => m[1]), ['Personnaliser', 'Articles', 'Rayons', 'Stats', 'Outils']);
  const src = sansCommentaires(lire('src/components/shop/proprietaire/BandeauProprietaire.tsx'));
  assert.match(src, /\{optionRayons && <Outil href=\{PAGE_RAYONS\} icone=\{Rows3\} libelle="Rayons" largeur=\{TIERS\} \/>\}/);
  assert.match(src, /slug: adresse, statut, rayons \}/);
  assert.equal(require('../src/lib/reseau/porte-boutique.ts').PAGE_RAYONS, '/reseller/boutique/rayons');
});

// ── 9. Pages ────────────────────────────────────────────────────────────────

// Pas de DOM dans node:test : la page est appelée comme une fonction, avec des
// crochets React SIMULÉS pour elle seule (état gardé entre deux appels, effet de
// montage rejoué à la main). Ses appels réseau arrivent aux VRAIES routes, sur la
// base simulée.
const PAGE_RAYONS = path.join(RACINE, 'src/app/reseller/boutique/rayons/page.tsx');
const PAGE_PERSONNALISER = path.join(RACINE, 'src/app/reseller/boutique/page.tsx');
let crochets = null;
const fauxReact = {
  ...React, __esModule: true, default: React,
  useState: (init) => crochets.useState(init),
  useRef: (init) => crochets.useRef(init),
  useEffect: (f) => crochets.useEffect(f),
  useMemo: (f) => f(),
  useCallback: (f) => f,
};
const chargerOriginal = Module._load;
Module._load = function (demande, parent, ...reste) {
  if (demande === 'react' && parent && (parent.filename === PAGE_RAYONS || parent.filename === PAGE_PERSONNALISER)) return fauxReact;
  return chargerOriginal.call(this, demande, parent, ...reste);
};
/** Éléments de l'arbre rendu par la page (enfants et emplacements `action`), sans exécuter ses composants. */
function trouver(noeud, test, resultats = []) {
  if (Array.isArray(noeud)) { noeud.forEach((n) => trouver(n, test, resultats)); return resultats; }
  if (!noeud || typeof noeud !== 'object' || !noeud.props) return resultats;
  if (test(noeud)) resultats.push(noeud);
  trouver(noeud.props.children, test, resultats);
  if (noeud.props.action) trouver(noeud.props.action, test, resultats);
  return resultats;
}
const texteDe = (element) => renderToStaticMarkup(element).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const monterMesRayons = () => monterPage(PAGE_RAYONS);
function monterPage(fichier) {
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
  const Page = require(fichier).default;
  const attendre = async () => { for (let i = 0; i < 30; i++) await new Promise((r) => setImmediate(r)); };
  const rendre = () => { curseur = 0; curseurRef = 0; effets = []; return Page(); };
  const du = (arbre, nom) => trouver(arbre, (e) => typeof e.type === 'function' && e.type.name === nom);
  return {
    rendre,
    /** Montage : la lecture de la boutique et de ses articles. */
    async monter() { rendre(); effets.forEach((f) => f()); await attendre(); return rendre(); },
    attendre,
    du,
    boutons: (arbre, libelle) => trouver(arbre, (e) => (e.type === 'button' || (typeof e.type === 'function' && /^(Button|BoutonPartageWhatsApp)$/.test(e.type.name)))
      && (e.props['aria-label'] === libelle || texteDe(e) === libelle)),
  };
}
/** fetch du navigateur → les vraies routes, avec la session simulée. */
function brancherRoutes(appels) {
  const routes = {
    '/api/reseller/boutique': '../src/app/api/reseller/boutique/route.ts',
    '/api/reseller/boutique/articles': '../src/app/api/reseller/boutique/articles/route.ts',
  };
  global.fetch = async (url, init = {}) => {
    const methode = init.method || 'GET';
    appels.push([methode, String(url), init.body ?? null]);
    const chemin = String(url).split('?')[0];
    assert.ok(routes[chemin], `appel inattendu : ${url}`);
    const r = await require(routes[chemin])[methode](requete(String(url), { method: methode, ...(init.body ? { body: init.body } : {}) }));
    return { ok: r.status >= 200 && r.status < 300, status: r.status, json: () => r.json() };
  };
}
const RESEAU_INTERDIT = global.fetch;

test('Page « Mes rayons », AVANT le SQL : « Les rayons arrivent bientôt », ni liste ni barre d’enregistrement, aucune écriture', async () => {
  const appels = [];
  brancherRoutes(appels);
  try {
    baseAwa();
    const page = monterMesRayons();
    assert.equal(page.du(page.rendre(), 'Skeleton').length, 2, 'avant la lecture : chargement');
    const arbre = await page.monter();
    assert.deepEqual(appels.map(([m, u]) => `${m} ${u}`).sort(), ['GET /api/reseller/boutique/articles', 'GET /api/reseller/boutique?creer=non']);
    const vide = page.du(arbre, 'EmptyState');
    assert.equal(vide.length, 1);
    assert.equal(vide[0].props.titre, 'Les rayons arrivent bientôt');
    assert.ok(!vide[0].props.erreur, 'pas un écran d’erreur');
    assert.equal(vide[0].props.action.props.href, '/reseller/ma-boutique');
    assert.equal(page.du(arbre, 'BarreEnregistrement').length, 0);
    assert.equal(page.du(arbre, 'FeuilleRayon').length, 0);
    assert.equal(page.boutons(arbre, 'Créer un rayon').length, 0);
    assert.deepEqual(ecritures(), []);
    // Boutique introuvable : la porte « Ma boutique » l'ouvrira ; rien n'est créé ici.
    fautes['stores:select'] = 'XX000';
    const sansBoutique = page.du(await monterMesRayons().monter(), 'EmptyState')[0];
    assert.equal(sansBoutique.props.titre, 'Votre boutique n’est pas encore ouverte');
    assert.equal(sansBoutique.props.action.props.href, '/reseller/ma-boutique');
    delete fautes['stores:select'];
    // Articles illisibles : une erreur avec « Réessayer », jamais « aucun rayon ».
    baseAwa({ migree: true });
    fautes['reseller_shop_items:select'] = 'XX000';
    const enErreur = page.du(await monterMesRayons().monter(), 'EmptyState')[0];
    assert.equal(enErreur.props.erreur, true);
    assert.equal(typeof enErreur.props.onReessayer, 'function');
    assert.deepEqual(ecritures(), []);
  } finally { global.fetch = RESEAU_INTERDIT; }
});

test('Page « Mes rayons », APRÈS : créer, ranger, ordonner, supprimer — tout reste à l’écran jusqu’à « Enregistrer », une seule requête, les articles ne bougent pas', async () => {
  const appels = [];
  brancherRoutes(appels);
  try {
    baseAwa({ migree: true });
    const selectionAvant = JSON.stringify(etat.reseller_shop_items);
    const page = monterMesRayons();
    let arbre = await page.monter();
    assert.equal(page.du(arbre, 'EmptyState')[0].props.titre, 'Aucun rayon pour l’instant');
    assert.equal(page.du(arbre, 'BarreEnregistrement')[0].props.modifie, false);

    // 1. Créer « Pagnes » avec 3 articles.
    page.boutons(arbre, 'Créer un rayon')[0].props.onClick();
    arbre = page.rendre();
    let feuille = page.du(arbre, 'FeuilleRayon')[0];
    assert.equal(feuille.props.creation, true);
    assert.deepEqual(feuille.props.articles.map((a) => a.id), ['c1', 'p1', 'p2', 'c2', 'p3'], 'les articles de SA boutique, dans l’ordre de la vitrine');
    assert.ok(!feuille.props.articles.some((a) => a.id === 'x1'), 'jamais l’article d’un autre');
    assert.equal(feuille.props.refus('A'), 'Le nom d’un rayon fait au moins 2 caractères.');
    assert.equal(feuille.props.refus('Promo -20 %'), 'Pas de prix ni de remise dans le nom d’un rayon.');
    assert.equal(feuille.props.onSupprimer, undefined);
    feuille.props.onValider({ nom: 'Pagnes', ids: ['p1', 'p2', 'p3'] });
    arbre = page.rendre();
    assert.equal(page.du(arbre, 'FeuilleRayon').length, 0, 'la feuille se ferme');
    let barre = page.du(arbre, 'BarreEnregistrement')[0];
    assert.equal(barre.props.modifie, true);
    // Relecture du lot 6 : « Enregistrer mes rayons » ne laissait pas de place à « Non enregistré » à 390 px.
    assert.equal(barre.props.libelle, 'Enregistrer');
    assert.deepEqual(ecritures(), [], 'rien n’est écrit avant « Enregistrer »');
    assert.equal(page.boutons(arbre, 'Partager le rayon Pagnes').length, 0, 'un rayon pas encore enregistré ne se partage pas');
    assert.match(texteDe(React.createElement('ul', null, trouver(arbre, (e) => e.type === 'li'))), /Pagnes 3 articles dans ma boutique/);

    // 2. Enregistrer : une requête, un UPDATE de stores.
    appels.length = 0;
    await barre.props.onEnregistrer();
    assert.deepEqual(appels, [['PATCH', '/api/reseller/boutique', JSON.stringify({ reglages: { rayons: [{ nom: 'Pagnes', ids: ['p1', 'p2', 'p3'] }] } })]]);
    assert.deepEqual(reglagesDe().rayons, [{ cle: 'pagnes', nom: 'Pagnes', ids: ['p1', 'p2', 'p3'] }]);
    assert.deepEqual(ecritures().map((o) => [o.table, o.op]), [['stores', 'update']]);
    arbre = page.rendre();
    barre = page.du(arbre, 'BarreEnregistrement')[0];
    assert.equal(barre.props.modifie, false);
    assert.equal(barre.props.message, 'Rayons enregistrés : votre boutique est à jour.');
    // Deux rayons sur la vitrine (Pagnes, Cuisine) : chacun se partage.
    page.boutons(arbre, 'Partager le rayon Pagnes')[0].props.onClick();
    arbre = page.rendre();
    const partage = page.du(arbre, 'PartageBoutique')[0];
    assert.equal(partage.props.ouvert, true);
    assert.equal(partage.props.choixInitial, 'pagnes');
    assert.deepEqual(partage.props.boutique, { nom: 'Awa Mode', enseigne: true, slug: 'awa-mode', statut: 'active', rayons: [{ cle: 'pagnes', nom: 'Pagnes', ids: ['p1', 'p2', 'p3'] }] });
    assert.equal(page.boutons(arbre, 'Partager le rayon Cuisine').length, 1, 'rayon automatique');
    partage.props.onFermer();

    // 3. Second rayon : « Fête » prend p1 à « Pagnes » ; puis il monte en premier.
    arbre = page.rendre();
    page.boutons(arbre, 'Créer un rayon')[0].props.onClick();
    feuille = page.du(page.rendre(), 'FeuilleRayon')[0];
    assert.equal(feuille.props.articles.find((a) => a.id === 'p1').note, 'Dans « Pagnes »');
    assert.equal(feuille.props.refus('pagnes'), 'Vous avez déjà un rayon de ce nom.');
    feuille.props.onValider({ nom: 'Fête', ids: ['c1', 'p1'] });
    arbre = page.rendre();
    assert.equal(page.boutons(arbre, 'Monter le rayon Pagnes')[0].props.disabled, true, 'déjà en haut');
    page.boutons(arbre, 'Monter le rayon Fête')[0].props.onClick();
    arbre = page.rendre();
    assert.equal(page.boutons(arbre, 'Descendre le rayon Pagnes')[0].props.disabled, true, 'maintenant en bas');
    await page.du(arbre, 'BarreEnregistrement')[0].props.onEnregistrer();
    assert.deepEqual(reglagesDe().rayons, [{ cle: 'fete', nom: 'Fête', ids: ['c1', 'p1'] }, { cle: 'pagnes', nom: 'Pagnes', ids: ['p2', 'p3'] }]);

    // 4. « Annuler » revient à ce qui est enregistré.
    arbre = page.rendre();
    page.boutons(arbre, 'Descendre le rayon Fête')[0].props.onClick();
    arbre = page.rendre();
    assert.equal(page.du(arbre, 'BarreEnregistrement')[0].props.modifie, true);
    page.du(arbre, 'BarreEnregistrement')[0].props.onAnnuler();
    arbre = page.rendre();
    assert.equal(page.du(arbre, 'BarreEnregistrement')[0].props.modifie, false);

    // 5. Supprimer « Fête » : confirmé, sa conséquence annoncée ; refusé, rien ne change.
    page.boutons(arbre, 'Modifier le rayon Fête')[0].props.onClick();
    feuille = page.du(page.rendre(), 'FeuilleRayon')[0];
    assert.equal(feuille.props.creation, false);
    assert.equal(feuille.props.nomInitial, 'Fête');
    assert.deepEqual(feuille.props.idsInitial, ['c1', 'p1']);
    confirmations = []; reponseConfirmation = false;
    await feuille.props.onSupprimer();
    assert.equal(confirmations.length, 1);
    assert.equal(confirmations[0].titre, 'Supprimer le rayon « Fête » ?');
    assert.match(confirmations[0].message, /Ses articles restent dans votre boutique/);
    assert.equal(page.du(page.rendre(), 'BarreEnregistrement')[0].props.modifie, false, '« Garder » : rien ne change');
    reponseConfirmation = true;
    await page.du(page.rendre(), 'FeuilleRayon')[0].props.onSupprimer();
    arbre = page.rendre();
    assert.equal(page.du(arbre, 'FeuilleRayon').length, 0);
    await page.du(arbre, 'BarreEnregistrement')[0].props.onEnregistrer();
    assert.deepEqual(reglagesDe().rayons, [{ cle: 'pagnes', nom: 'Pagnes', ids: ['p2', 'p3'] }]);

    // 6. Refus du serveur : le message est affiché, l'écran garde le travail en cours.
    fautes['stores:update'] = '42703';
    arbre = page.rendre();
    page.boutons(arbre, 'Créer un rayon')[0].props.onClick();
    page.du(page.rendre(), 'FeuilleRayon')[0].props.onValider({ nom: 'Cadeaux', ids: ['c2'] });
    await page.du(page.rendre(), 'BarreEnregistrement')[0].props.onEnregistrer();
    barre = page.du(page.rendre(), 'BarreEnregistrement')[0];
    assert.deepEqual(barre.props.erreurs, ['Option pas encore activée (mise à jour de la base à appliquer).']);
    assert.equal(barre.props.modifie, true);
    delete fautes['stores:update'];

    // Du début à la fin : jamais la route des articles en écriture, la sélection intacte.
    assert.ok(appels.every(([m, u]) => u.startsWith('/api/reseller/boutique') && (m === 'GET' || m === 'PATCH')));
    assert.ok(!ecritures().some((o) => o.table !== 'stores'), 'seule la boutique est écrite');
    assert.equal(JSON.stringify(etat.reseller_shop_items), selectionAvant, 'ranger en rayons ne touche à aucune offre');
  } finally { global.fetch = RESEAU_INTERDIT; }
});

test('Page « Mes rayons » : une seule requête PATCH {reglages: {rayons}} par la barre d’enregistrement ; neutre avant le SQL ; ne touche jamais aux articles', () => {
  const page = sansCommentaires(lire('src/app/reseller/boutique/rayons/page.tsx'));
  assert.match(page, /^'use client';/);
  assert.match(page, /<PageReseau\s+titre="Mes rayons"/);
  assert.match(page, /retour=\{\{ href: PORTE_MA_BOUTIQUE, libelle: 'Ma boutique' \}\}/);
  // Lecture : la boutique (sans rien créer) et ses articles ; l'option décide de tout.
  assert.match(page, /fetch\('\/api\/reseller\/boutique\?creer=non', \{ cache: 'no-store' \}\)/);
  assert.match(page, /fetch\('\/api\/reseller\/boutique\/articles', \{ cache: 'no-store' \}\)/);
  assert.match(page, /if \(!lue\.options\?\.reglages\) \{ setLecture\('option_absente'\); return; \}/);
  assert.match(page, /lecture === 'option_absente' \? \(\s*<EmptyState icone=\{Rows3\} titre="Les rayons arrivent bientôt"/);
  assert.doesNotMatch(page, /option_absente[^\n]*erreur\b/, 'pas un écran en panne');
  // Écriture : uniquement PATCH /api/reseller/boutique, avec les noms et les articles (la clé est recalculée par le serveur).
  assert.equal((page.match(/fetch\(/g) || []).length, 3);
  assert.match(page, /fetch\('\/api\/reseller\/boutique', \{\s*method: 'PATCH',[\s\S]*?body: JSON\.stringify\(\{ reglages: \{ rayons: envoye\.map\(\(\{ nom, ids \}\) => \(\{ nom, ids \}\)\) \} \}\),/);
  assert.doesNotMatch(page, /\/api\/reseller\/shop|method: 'DELETE'|method: 'POST'/, 'jamais la route des articles');
  assert.match(page, /if \(verrou\.current\) return;/);
  assert.match(page, /<BarreEnregistrement[\s\S]*?libelle="Enregistrer"[\s\S]*?barreDuBasPermanente/);
  // ▲▼ de 40 px avec un nom lisible ; créer, modifier, supprimer (confirmé) ; partager un rayon enregistré.
  assert.match(page, /const BOUTON_ORDRE = 'w-10 h-10 /);
  assert.match(page, /aria-label=\{`Monter le rayon \$\{r\.nom\}`\}/);
  assert.match(page, /aria-label=\{`Descendre le rayon \$\{r\.nom\}`\}/);
  assert.match(page, /changer\(deplacerRayon\(rayons, i, -1\)\)/);
  assert.match(page, /Créer un rayon<\/Button>/);
  assert.match(page, /titre: `Supprimer le rayon « \$\{rayonOuvert\.nom\} » \?`,\s*message: 'Ses articles restent dans votre boutique, rangés par catégorie\. Rien n’est retiré de la vente\.'/);
  assert.match(page, /const partageable = enLigne && !modifie && vitrine\.length >= 2;/);
  assert.match(page, /<PartageBoutique[\s\S]*?rayons: enregistres[\s\S]*?choixInitial=\{partage\}/);
  assert.match(page, /<h2[^>]*>Rayons automatiques<\/h2>/);
  assert.match(page, /\{rayons\.length\}\/\{RAYONS_MAX\}<\/strong> rayons/);
  assert.doesNotMatch(page, /À la une|commission|\bgain/i);
  assert.doesNotMatch(page, /localStorage|sessionStorage/);
});

test('Personnaliser (comportement) : avant le SQL, ni annonce ni rayons ; après, l’annonce est proposée, refusée sous le champ, enregistrée avec les textes, puis retirée', async () => {
  const appels = [];
  brancherRoutes(appels);
  // La page lit l'origine et l'ancre de l'adresse au montage : un navigateur minimal, le temps du test.
  global.window = { location: { origin: 'http://localhost', hash: '' } };
  global.document = { getElementById: () => null };
  try {
    const champ = (arbre, id) => trouver(arbre, (e) => e.props.id === id)[0];
    const cadre = (arbre, id) => trouver(arbre, (e) => typeof e.type === 'function' && e.type.name === 'Field' && e.props.htmlFor === id)[0];
    const taper = (arbre, id, value) => champ(arbre, id).props.onChange({ target: { value } });

    // AVANT le SQL : la page du lot 5.
    baseAwa();
    let page = monterPage(PAGE_PERSONNALISER);
    let arbre = await page.monter();
    assert.ok(champ(arbre, 'nom-boutique'), 'la page est chargée');
    assert.equal(champ(arbre, 'annonce-texte'), undefined);
    assert.equal(trouver(arbre, (e) => e.props.href === '/reseller/boutique/rayons').length, 0);
    assert.doesNotMatch(texteDe(React.createElement('div', null, trouver(arbre, (e) => e.type === 'p'))), /Annonce|rayons/i);
    taper(arbre, 'accroche', 'Bienvenue chez Awa');
    appels.length = 0;
    await page.du(page.rendre(), 'BarreEnregistrement')[0].props.onEnregistrer();
    assert.ok(!('reglages' in JSON.parse(appels[0][2])), 'aucun réglage envoyé à une base qui n’a pas la colonne');
    assert.equal(etat.stores[0].tagline, 'Bienvenue chez Awa');

    // APRÈS le SQL.
    baseAwa({ migree: true });
    page = monterPage(PAGE_PERSONNALISER);
    arbre = await page.monter();
    assert.ok(champ(arbre, 'annonce-texte'));
    assert.equal(champ(arbre, 'annonce-texte').props.maxLength, 90);
    assert.equal(champ(arbre, 'annonce-fin'), undefined, 'pas de date tant qu’il n’y a pas de message');
    assert.equal(trouver(arbre, (e) => e.props.href === '/reseller/boutique/rayons').length, 1, '« Gérer mes rayons »');
    assert.equal(page.du(arbre, 'BarreEnregistrement')[0].props.modifie, false);

    // Un texte refusé : la raison sous le champ, la barre bloquée, rien n'est envoyé.
    taper(arbre, 'annonce-texte', '-20 % ce week-end');
    arbre = page.rendre();
    assert.match(cadre(arbre, 'annonce-texte').props.erreur, /Pas de pourcentage/);
    assert.equal(page.du(arbre, 'BarreEnregistrement')[0].props.bloque, true);
    // Un texte permis : une date à 7 jours est proposée, entre aujourd'hui et J+14.
    taper(arbre, 'annonce-texte', 'Nouveaux pagnes arrivés');
    arbre = page.rendre();
    assert.equal(cadre(arbre, 'annonce-texte').props.erreur, undefined);
    assert.deepEqual([champ(arbre, 'annonce-fin').props.value, champ(arbre, 'annonce-fin').props.min, champ(arbre, 'annonce-fin').props.max], [jour(7), jour(0), jour(14)]);
    assert.equal(champ(arbre, 'annonce-fin').props.type, 'date');
    taper(arbre, 'annonce-fin', jour(20));
    arbre = page.rendre();
    assert.equal(cadre(arbre, 'annonce-fin').props.erreur, 'Une annonce dure 14 jours au plus.');
    assert.equal(page.du(arbre, 'BarreEnregistrement')[0].props.bloque, true);
    taper(arbre, 'annonce-fin', jour(3));
    taper(arbre, 'accroche', 'Pagnes et bazins de qualité');
    arbre = page.rendre();
    let barre = page.du(arbre, 'BarreEnregistrement')[0];
    assert.deepEqual([barre.props.modifie, barre.props.bloque], [true, false]);
    appels.length = 0;
    await barre.props.onEnregistrer();
    assert.deepEqual(JSON.parse(appels[0][2]).reglages, { annonce: { texte: 'Nouveaux pagnes arrivés', fin: jour(3) } });
    assert.deepEqual(reglagesDe().annonce, { texte: 'Nouveaux pagnes arrivés', fin: jour(3) });
    assert.equal(etat.stores[0].tagline, 'Pagnes et bazins de qualité', 'une seule requête, avec les autres textes');
    arbre = page.rendre();
    assert.equal(page.du(arbre, 'BarreEnregistrement')[0].props.modifie, false);
    assert.match(texteDe(React.createElement('div', null, page.du(arbre, 'StatusPill'))), /Affichée jusqu’au \d+ \S+/);

    // Annonce inchangée : un autre texte s'enregistre sans la renvoyer (une annonce terminée ne bloque pas le reste).
    etat.stores[0].reglages.annonce.fin = jour(-2);
    page = monterPage(PAGE_PERSONNALISER);
    arbre = await page.monter();
    assert.match(texteDe(React.createElement('div', null, page.du(arbre, 'StatusPill'))), /Terminée le \d+ \S+ : plus affichée/);
    taper(arbre, 'accroche', 'Livré à Bamako');
    appels.length = 0;
    await page.du(page.rendre(), 'BarreEnregistrement')[0].props.onEnregistrer();
    assert.ok(!('reglages' in JSON.parse(appels[0][2])));
    assert.equal(etat.stores[0].tagline, 'Livré à Bamako');
    assert.equal(reglagesDe().annonce.texte, 'Nouveaux pagnes arrivés', 'l’annonce terminée reste enregistrée, sans être affichée');

    // « Retirer l'annonce » : le champ se vide, l'enregistrement la supprime.
    arbre = page.rendre();
    page.boutons(arbre, 'Retirer l’annonce')[0].props.onClick();
    arbre = page.rendre();
    assert.equal(champ(arbre, 'annonce-texte').props.value, '');
    appels.length = 0;
    await page.du(arbre, 'BarreEnregistrement')[0].props.onEnregistrer();
    assert.deepEqual(JSON.parse(appels[0][2]).reglages, { annonce: null });
    assert.equal(reglagesDe().annonce, null);
    assert.ok(!ecritures().some((o) => o.table !== 'stores'));
  } finally { global.fetch = RESEAU_INTERDIT; delete global.window; delete global.document; }
});

test('Personnaliser : « Annonce sur ma boutique » et « Mes rayons » seulement si l’option est active ; l’annonce part avec les textes, seulement si elle a changé', () => {
  const page = sansCommentaires(lire('src/app/reseller/boutique/page.tsx'));
  assert.match(page, /setOptionReglages\(Boolean\(data\.options\?\.reglages\)\);/);
  assert.match(page, /const \[optionReglages, setOptionReglages\] = useState\(false\);/);
  const blocs = page.split('{optionReglages && (').slice(1);
  assert.equal(blocs.length, 2, 'deux blocs, tous deux sous condition');
  assert.match(blocs[0], /Annonce sur ma boutique/);
  assert.match(blocs[0], /<Input id="annonce-texte"[^\n]*maxLength=\{ANNONCE_TEXTE_MAX\}/);
  assert.match(blocs[0], /<Input id="annonce-fin" type="date" value=\{textes\.annonceFin\} min=\{jourDe\(\)\} max=\{finMaximale\(\)\}/);
  assert.match(blocs[0], /Retirer l’annonce/);
  assert.match(blocs[0], /Affichée jusqu’au \{jourLisible\(annonceEnregistree\.fin\)\}/);
  assert.match(blocs[1], /<Button href=\{PAGE_RAYONS\} variant="ghost" fullWidth>Gérer mes rayons<\/Button>/);
  assert.equal((page.match(/Annonce sur ma boutique/g) || []).length, 1);
  assert.equal((page.match(/PAGE_RAYONS\}/g) || []).length, 1);
  assert.match(page, /\.\.\.\(optionReglages && annonceModifiee\s*\? \{ reglages: \{ annonce: textes\.annonce\.trim\(\) \? \{ texte: textes\.annonce, fin: textes\.annonceFin \} : null \} \}\s*: \{\}\),/);
  assert.match(page, /bloque=\{textes\.nom\.trim\(\)\.length < 2 \|\| \(optionReglages && annonceModifiee && Boolean\(refusTexteAnnonce \|\| refusDateAnnonce\)\)\}/);
  assert.match(page, /erreur=\{refusTexteAnnonce \|\| undefined\}/);
  // Ce que le serveur refuse est dit sous le champ par les MÊMES règles.
  const R = require('../src/lib/boutique-reglages.ts');
  assert.match(R.refusAnnonce('-20 % ce soir'), /pourcentage/);
  assert.equal(R.refusAnnonce(''), null);
  assert.equal(R.refusFinAnnonce(jour(15)), 'Une annonce dure 14 jours au plus.');
  assert.equal(R.refusFinAnnonce(jour(14)), null);
});

// ── 10. Guide et reprise ────────────────────────────────────────────────────

test('Guide : lot 6 en tête du journal, avec le SQL à lancer dans les écarts ; fiche « Mes rayons » ; REPRISE', () => {
  const guide = JSON.parse(lire('docs/guide/guide.json'));
  assert.equal(guide.majLe, '2026-10-03');
  const rang = guide.journal.findIndex((j) => j.titre === 'Boutique revendeur, lot 6 : rayons personnalisés et annonce datée');
  assert.ok(rang >= 0, 'entrée du lot 6');
  const lot6 = guide.journal[rang];
  assert.equal(lot6.date, '2026-10-03');
  assert.equal(lot6.statut, 'en local');
  assert.match(lot6.demande, /^« “Ma boutique” doit montrer la boutique elle-même/);
  assert.ok(lot6.realise.length >= 5);
  const ecarts = lot6.ecarts.join('\n');
  assert.ok(ecarts.includes(`supabase/${SQL}`), 'le fichier SQL à lancer');
  assert.match(ecarts, /SQL Editor/);
  assert.match(ecarts, /Tant qu’il n’est pas exécuté/);
  for (const id of ['rev-boutique-rayons', 'rev-boutique', 'vitrine-boutique', 'mes-boutiques']) assert.ok(lot6.pages.includes(id), id);
  assert.equal(guide.journal[rang + 1].titre, 'Boutique revendeur, lot 5 : corrections de relecture', 'juste avant la relecture du lot 5');

  const fiche = guide.pages.find((p) => p.id === 'rev-boutique-rayons');
  assert.ok(fiche, 'fiche de la nouvelle page');
  assert.equal(fiche.chemin, '/reseller/boutique/rayons');
  assert.equal(fiche.role, 'revendeur');
  assert.equal(fiche.capture, undefined);
  assert.match(fiche.note, /Capture à refaire sur la copie locale\./);
  assert.ok(fiche.elements.length >= 5);
  const texte = (id) => JSON.stringify(guide.pages.find((p) => p.id === id));
  assert.match(texte('rev-boutique-rayons'), /Créer un rayon/);
  assert.match(texte('rev-boutique-rayons'), /"nom":"Enregistrer"/);
  assert.match(texte('rev-boutique'), /Annonce sur ma boutique/);
  assert.match(texte('vitrine-boutique'), /Rayons/);
  assert.match(texte('vitrine-boutique'), /annonce/i);
  assert.doesNotMatch(JSON.stringify(lot6) + texte('rev-boutique-rayons'), /À la une/);
  assert.ok(lire('REPRISE.md').split('\n').some((l) => l.startsWith('> **') && /boutique revendeur, lot 6 « Rayons personnalisés et annonce datée »/.test(l)));
});
