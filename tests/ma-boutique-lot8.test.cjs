// TEST-BOUTIQUE-LOT8-001..027 (chantier boutique du revendeur, 2026-10-03, lot 8
// « Adresse à l'enseigne et contact ») :
//  - un revendeur change l'adresse de sa boutique UNE seule fois ; l'ancienne
//    redirige pour toujours vers la nouvelle, en gardant ?rayon, ?ref et ?via ;
//  - une adresse déjà portée (aujourd'hui ou avant) n'est jamais donnée à une
//    autre boutique, ni au changement ni à la création ;
//  - l'identité vient de la session : la requête ne porte que l'adresse voulue ;
//  - AVANT le SQL (ni table store_slug_aliases ni fonction) : section absente,
//    /boutique/<adresse> inchangé, créations inchangées ;
//  - contact : la bulle du support Suguba s'affiche sur /boutique/ ; jamais le
//    WhatsApp du revendeur ni celui d'un fournisseur.
// Supabase, la session et les cookies sont SIMULÉS (require.cache). Deux bases :
// une base en mémoire (routes, pages, écrans), et un PostgreSQL LOCAL en mémoire
// (PGlite) où s'exécute le VRAI fichier SQL, pour la fonction du changement.
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
const SQL = 'A-EXECUTER-2026-10-03-vitrine-boutique.sql';

// ── Base simulée en mémoire : chaque opération est enregistrée ──────────────
let etat; let fautes; let operations; let serie;
function reinitialiser() {
  etat = {
    stores: [], store_slug_aliases: [], profiles: [], profile_roles: [], reseller_shop_items: [], store_products: [], products: [],
    reseller_prices: [], store_plans: [], platform_settings: [], suppliers: [], orders: [], tracking_links: [], analytics_events: [],
  };
  fautes = {}; operations = []; serie = 1;
}
/** Miroir de la fonction SQL changer_adresse_boutique (comparé à la vraie, sous PGlite, plus bas). */
function changerAdresseSimulee({ p_store_id: id, p_owner_id: proprietaire, p_nouveau: brut }) {
  const nouveau = brut == null ? null : String(brut).trim().toLowerCase();
  if (nouveau === null || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(nouveau) || nouveau.length < 3 || nouveau.length > 50) return 'invalide';
  const boutique = etat.stores.find((s) => s.id === id && s.owner_id === proprietaire);
  if (!boutique) return 'introuvable';
  if (boutique.slug.toLowerCase() === nouveau) return 'identique';
  if (etat.store_slug_aliases.some((a) => a.store_id === id)) return 'deja_change';
  if (etat.stores.some((s) => s.slug.toLowerCase() === nouveau) || etat.store_slug_aliases.some((a) => a.slug === nouveau)) return 'pris';
  etat.store_slug_aliases.push({ slug: boutique.slug.toLowerCase(), store_id: id, created_at: new Date().toISOString() });
  boutique.slug = nouveau;
  return 'ok';
}
const comparer = (a, b) => (String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0);
const db = {
  from(table) {
    let op = 'select'; let patch; const filtres = []; const egalites = {}; const dans = {}; let un = false; let tete = false; let limite = null; let tri = null;
    const q = {
      select(_colonnes, options) { if (options && options.head) tete = true; return q; },
      eq(k, v) { egalites[k] = v; filtres.push((r) => r[k] === v); return q; },
      neq(k, v) { filtres.push((r) => r[k] !== v); return q; },
      gt(k, v) { filtres.push((r) => String(r[k]) > String(v)); return q; },
      gte(k, v) { filtres.push((r) => String(r[k]) >= String(v)); return q; },
      in(k, v) { dans[k] = v; filtres.push((r) => v.includes(r[k])); return q; },
      ilike(k, v) { egalites[k] = v; filtres.push((r) => String(r[k]).toLowerCase() === String(v).toLowerCase()); return q; },
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
        // Une faute peut viser certaines lectures seulement : fonction (opération) → code ou null.
        const prevue = fautes[`${table}:${op}`];
        const faute = typeof prevue === 'function' ? prevue({ table, op, egalites, dans }) : prevue;
        if (faute) return repondre({ data: null, count: null, error: { code: faute, message: `faute simulée ${faute}` } });
        let lignes = (etat[table] || []).filter((r) => filtres.every((f) => f(r)));
        if (tri) lignes = [...lignes].sort((a, b) => comparer(a[tri.k], b[tri.k]) * (tri.asc ? 1 : -1));
        if (op === 'insert') {
          const nouvelles = (Array.isArray(patch) ? patch : [patch]);
          // Index unique stores_slug_key : une adresse active ne se donne pas deux fois.
          if (table === 'stores' && nouvelles.some((p) => etat.stores.some((s) => s.slug.toLowerCase() === String(p.slug).toLowerCase()))) {
            return repondre({ data: null, count: null, error: { code: '23505', message: 'duplicate key value violates unique constraint "stores_slug_key"' } });
          }
          const maintenant = new Date().toISOString();
          lignes = nouvelles.map((p) => ({ id: `n${serie++}`, created_at: maintenant, added_at: maintenant, status: 'active', followers_count: 0, ...p }));
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
  async rpc(nom, args) {
    operations.push({ table: `rpc:${nom}`, op: 'rpc', patch: args });
    const faute = fautes[`rpc:${nom}`];
    if (faute) return { data: null, error: { code: faute, message: `faute simulée ${faute}` } };
    if (nom !== 'changer_adresse_boutique') return { data: null, error: null };
    return { data: changerAdresseSimulee(args), error: null };
  },
};
const ecritures = () => operations.filter((o) => o.op !== 'select');
const sur = (table) => operations.filter((o) => o.table === table);
let baseCourante = db;
require.cache[require.resolve('../src/lib/supabase-admin.ts')] = { exports: { getSupabaseAdmin: () => baseCourante } };

/**
 * Le client Supabase, branché sur un PostgreSQL local (PGlite) : les lectures, les
 * insertions et l'appel de fonction que fait src/lib/reseau/boutiques.ts, traduits
 * en SQL. Les erreurs gardent le code de Postgres (42P01, 42883, 23505…).
 */
function clientSql(pg) {
  const executer = async (texte, valeurs) => {
    try { return { rows: (await pg.query(texte, valeurs)).rows, error: null }; }
    catch (e) { return { rows: null, error: { code: e.code || 'XX000', message: e.message } }; }
  };
  return {
    from(table) {
      let op = 'select'; let patch; const ou = []; const valeurs = []; let un = false; let limite = null; let tri = null;
      const p = (v) => { valeurs.push(v); return `$${valeurs.length}`; };
      const q = {
        select() { return q; },
        eq(k, v) { ou.push(`${k} = ${p(v)}`); return q; },
        ilike(k, v) { ou.push(`${k} ILIKE ${p(v)}`); return q; },
        in(k, v) { ou.push(v.length ? `${k} IN (${v.map(p).join(', ')})` : 'false'); return q; },
        order(k, o) { tri = `${k} ${o && o.ascending === false ? 'DESC' : 'ASC'}`; return q; },
        limit(n) { limite = n; return q; },
        insert(l) { op = 'insert'; patch = l; return q; },
        maybeSingle() { un = true; return q; },
        then(resolve, reject) {
          const requete = op === 'insert'
            ? `INSERT INTO public.${table} (${Object.keys(patch).join(', ')}) VALUES (${Object.values(patch).map(p).join(', ')}) RETURNING *`
            : `SELECT * FROM public.${table}${ou.length ? ` WHERE ${ou.join(' AND ')}` : ''}${tri ? ` ORDER BY ${tri}` : ''}${limite !== null ? ` LIMIT ${limite}` : ''}`;
          return executer(requete, valeurs).then(({ rows, error }) => {
            if (error) return { data: null, error };
            if (!un) return { data: rows, error: null };
            return rows.length > 1 ? { data: null, error: { code: 'PGRST116', message: 'plusieurs lignes' } } : { data: rows[0] || null, error: null };
          }).then(resolve, reject);
        },
      };
      return q;
    },
    async rpc(nom, args) {
      const cles = Object.keys(args);
      const { rows, error } = await executer(`SELECT public.${nom}(${cles.map((k, i) => `${k} => $${i + 1}`).join(', ')}) AS r`, cles.map((k) => args[k]));
      return error ? { data: null, error } : { data: rows[0].r, error: null };
    },
  };
}

let sessionCourante = null;
require.cache[require.resolve('../src/lib/active-session.ts')] = { exports: { verifyActiveSession: async () => sessionCourante } };
const vraieSession = require('../src/lib/session.ts');
require.cache[require.resolve('../src/lib/session.ts')] = { exports: { ...vraieSession, verifySessionToken: async () => sessionCourante } };
require.cache[require.resolve('next/headers')] = {
  exports: { cookies: async () => ({ get: (nom) => (nom === vraieSession.SESSION_COOKIE_NAME ? { value: 'jeton-simule' } : undefined) }) },
};
class Introuvable extends Error {}
class Redirection extends Error { constructor(url) { super(`redirection permanente vers ${url}`); this.url = url; } }
let chemin = '/';
require.cache[require.resolve('next/navigation')] = {
  exports: {
    notFound: () => { throw new Introuvable('page introuvable'); },
    permanentRedirect: (url) => { throw new Redirection(url); },
    redirect: (url) => { throw new Error(`redirection temporaire inattendue vers ${url}`); },
    usePathname: () => chemin, useRouter: () => ({ push() {}, replace() {}, refresh() {} }), useSearchParams: () => new URLSearchParams(''),
  },
};
const revendeur = (uid, extra = {}) => ({ uid, phone: '+22300000000', role: 'reseller', status: 'active', roles: { reseller: 'active' }, iat: 1, exp: 9e9, ...extra });
// Profil connu du navigateur (magasin de l'application) : null = visiteur, comme au rendu serveur.
let profilNavigateur = null;
const vraiMagasin = require('../src/lib/store.ts');
require.cache[require.resolve('../src/lib/store.ts')] = {
  exports: {
    ...vraiMagasin,
    useSugubaStore: () => (profilNavigateur
      ? { ...vraiMagasin.sugubaStore.getState(), currentUser: { ...vraiMagasin.sugubaStore.getState().currentUser, id: 'u-1', role: profilNavigateur } }
      : vraiMagasin.useSugubaStore()),
  },
};

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
    const fichier = String(charger).match(/require\(['"]([^'"]+)['"]\)/)[1].replace(/^@\//, `${path.join(RACINE, 'src')}/`);
    return (p) => React.createElement(require(fichier).default, p);
  } },
};
require.cache[require.resolve('../src/components/ui/Sheet.tsx')] = {
  exports: { __esModule: true, default: ({ ouvert, titre, sousTitre, children, pied }) => (ouvert
    ? React.createElement('section', { 'data-feuille': titre }, React.createElement('p', null, sousTitre), children, React.createElement('footer', null, pied))
    : null) },
};
// Messages et confirmations : enregistrés ; la confirmation répond `reponseConfirmation`.
let messages = []; let confirmations = []; let reponseConfirmation = true;
require.cache[require.resolve('../src/components/ui/Toast.tsx')] = {
  exports: { __esModule: true, useToast: () => ({ toast(texte, options) { messages.push([texte, options]); }, demander: async () => null, confirmer: async (d) => { confirmations.push(d); return reponseConfirmation; } }) },
};
require.cache[require.resolve('../src/lib/reseau/recompenses.ts')] = { exports: { lireReglagesReseau: async () => ({}) } };
require.cache[require.resolve('../src/lib/presentation-fournisseur.ts')] = { exports: { appliquerPrioriteReseau: async (_a, v) => v } };

const { NextRequest } = require('next/server');
const requete = (url, init = {}) => new NextRequest(`http://localhost${url}`, {
  ...init, headers: { cookie: 'suguba_session=simule', 'content-type': 'application/json', ...(init.headers || {}) },
});
const ROUTES = {
  '/api/reseller/boutique': '../src/app/api/reseller/boutique/route.ts',
  '/api/reseller/boutique/adresse': '../src/app/api/reseller/boutique/adresse/route.ts',
};
const appeler = (methode, url, corps, entetes) => require(ROUTES[url.split('?')[0]])[methode](
  requete(url, { method: methode, ...(entetes ? { headers: entetes } : {}), ...(corps === undefined ? {} : { body: typeof corps === 'string' ? corps : JSON.stringify(corps) }) }),
);
const lireAdresse = (suite = '') => appeler('GET', `/api/reseller/boutique/adresse${suite}`);
const changer = (corps, entetes) => appeler('POST', '/api/reseller/boutique/adresse', corps, entetes);

// ── Données : Awa a une boutique à son nom complet, Moussa une autre ────────
const NOM_COMPLET = /Traoré|Diallo/;
const produit = (id, enPlus = {}) => ({
  id, slug: `slug-${id}`, name: `Article ${id}`, category: 'Mode', images: [`https://x/${id}.webp`], public_price: 10000, stock: 5,
  reseller_commission: 1000, pricing_status: 'ok', status: 'approved', supplier_id: 'fou-1', created_at: '2026-08-01T00:00:00Z', ...enPlus,
});
/**
 * Awa (rev-1) : boutique « Awa Mode » à l'adresse awa-traore-diallo (son nom complet,
 * attribuée au premier accès). Moussa (rev-2) : « Chez Moussa ». `migree` : le SQL du
 * chantier est exécuté (colonne reglages, table des anciennes adresses, fonction).
 */
function baseAwa({ migree = true } = {}) {
  reinitialiser();
  etat.profiles = [
    { id: 'rev-1', full_name: 'Awa Traoré Diallo', reseller_code: 'AWA1', metadata: {} },
    { id: 'rev-2', full_name: 'Moussa Keita', reseller_code: 'MOU2', metadata: {} },
  ];
  etat.profile_roles = [{ profile_id: 'rev-1', role: 'reseller', status: 'active' }, { profile_id: 'rev-2', role: 'reseller', status: 'active' }];
  const colonne = migree ? { reglages: {} } : {};
  etat.stores = [
    { id: 's1', owner_type: 'reseller', owner_id: 'rev-1', slug: 'awa-traore-diallo', name: 'Awa Mode', tagline: 'Pagnes et bazins', status: 'active', followers_count: 3, principale: true, created_at: '2026-09-01T00:00:00Z', ...colonne },
    { id: 's2', owner_type: 'reseller', owner_id: 'rev-2', slug: 'chez-moussa', name: 'Chez Moussa', status: 'active', followers_count: 0, principale: true, created_at: '2026-09-02T00:00:00Z', ...colonne },
  ];
  etat.products = [produit('p1', { name: 'Pagne wax', category: 'Tissus' }), produit('p2', { name: 'Bazin riche', category: 'Tissus' }), produit('c1', { name: 'Théière', category: 'Cuisine' })];
  etat.reseller_shop_items = [
    { reseller_id: 'rev-1', product_id: 'p1', position: -1, added_at: '2026-09-10T00:00:00Z' },
    { reseller_id: 'rev-1', product_id: 'p2', position: 0, added_at: '2026-09-10T00:00:00Z' },
    { reseller_id: 'rev-1', product_id: 'c1', position: 1, added_at: '2026-09-10T00:00:00Z' },
  ];
  if (!migree) {
    // Ni table ni fonction : ce que répond la base tant que le fichier SQL n'est pas exécuté.
    delete etat.store_slug_aliases;
    fautes['store_slug_aliases:select'] = '42P01';
    fautes['rpc:changer_adresse_boutique'] = 'PGRST202';
  }
  baseCourante = db;
  sessionCourante = revendeur('rev-1');
  messages = []; confirmations = []; reponseConfirmation = true;
}
const SELECTION_INTACTE = () => JSON.stringify(etat.reseller_shop_items);
const page = () => require('../src/app/boutique/[slug]/page.tsx');
const ouvrir = (slug, recherche = {}) => page().default({ params: Promise.resolve({ slug }), searchParams: Promise.resolve(recherche) });
const apercu = (slug, recherche = {}) => page().generateMetadata({ params: Promise.resolve({ slug }), searchParams: Promise.resolve(recherche) });

// ── 1. Règles pures ─────────────────────────────────────────────────────────

test('adresseDepuis : minuscules, sans accent, tirets ; 50 caractères au plus, jamais de tiret au bout ; même résultat que slugifier', () => {
  const A = require('../src/lib/adresse-boutique.ts');
  const { slugifier } = require('../src/lib/shop.ts');
  assert.deepEqual([A.ADRESSE_MIN, A.ADRESSE_MAX], [3, 50]);
  for (const [texte, attendu] of [
    ['Awa Mode', 'awa-mode'], ['  Chez Awa — Mode & Beauté ', 'chez-awa-mode-beaute'], ['ÉLÉGANCE Bamako', 'elegance-bamako'],
    ['awa-mode', 'awa-mode'], ['Awa   Mode !!', 'awa-mode'], ['--awa--mode--', 'awa-mode'], ['Boutique N°1', 'boutique-n-1'],
  ]) {
    assert.equal(A.adresseDepuis(texte), attendu, texte);
    assert.equal(slugifier(texte), attendu, `slugifier : ${texte}`);
    assert.equal(A.adresseDepuis(attendu), attendu, 'idempotente : ce que montre l’aperçu est ce qui est envoyé');
    assert.equal(A.adresseBienFormee(attendu), true);
  }
  // Sans le repli « boutique » de slugifier : rien à proposer.
  for (const vide of ['', '   ', '!!!', '—', 'ߓߊ߲ߓߊߙߊ', null, undefined, 42, {}]) assert.equal(A.adresseDepuis(vide), '', String(vide));
  // 50 caractères, sans tiret final (slugifier, lui, peut en laisser un : la base le refuserait).
  const longue = A.adresseDepuis(`${'a'.repeat(49)} mode de bamako`);
  assert.equal(longue, 'a'.repeat(49));
  assert.equal(A.adresseDepuis('x'.repeat(200)).length, 50);
  assert.equal(A.adresseBienFormee(A.adresseDepuis(`${'ab '.repeat(40)}`)), true);
  // Le format est exactement celui de la fonction SQL.
  assert.match(lire(`supabase/${SQL}`), /v_nouveau !~ '\^\[a-z0-9\]\+\(-\[a-z0-9\]\+\)\*\$' OR length\(v_nouveau\) NOT BETWEEN 3 AND 50/);
  for (const mal of ['ab', '-awa', 'awa-', 'awa--mode', 'Awa', 'awa mode', 'awa_mode', 'x'.repeat(51)]) assert.equal(A.adresseBienFormee(mal), false, mal);
  // Un texte énorme n'est jamais transformé en entier.
  assert.equal(A.adresseDepuis(`${'é'.repeat(100000)}`).length, 50);
});

test('refusAdresse : trop courte, réservée à Suguba, sans lettre, numéro de téléphone, déjà la sienne ; adresseProposee part du nom public', () => {
  const A = require('../src/lib/adresse-boutique.ts');
  for (const permise of ['awa-mode', 'chez-awa', 'mode223', 'awa', 'boutique-n-1', 'sugu-bamako', 'awa-2026']) assert.equal(A.refusAdresse(permise, 'awa-traore-diallo'), null, permise);
  assert.match(A.refusAdresse(''), /Écrivez l’adresse voulue/);
  assert.equal(A.refusAdresse('ab'), 'Au moins 3 caractères.');
  assert.match(A.refusAdresse('awa--mode'), /lettres sans accent, des chiffres et des tirets/);
  assert.equal(A.refusAdresse('2026'), 'L’adresse doit contenir des lettres.');
  for (const reservee of ['suguba', 'suguba-officiel', 'admin', 'support', 'service-client', 'boutique-suguba', 'sugubaml', 'sugu-ba']) {
    assert.equal(A.refusAdresse(reservee), 'Cette adresse est réservée à Suguba. Choisissez-en une autre.', reservee);
  }
  // Pas de contact du revendeur dans l'adresse (décision : pas de WhatsApp du revendeur pour l'instant).
  for (const numero of ['awa-76123456', 'awa-76-12-34-56', 'wa-22376123456', '76-12-34-56-awa']) {
    assert.match(A.refusAdresse(numero), /Pas de numéro de téléphone dans l’adresse/, numero);
  }
  assert.equal(A.refusAdresse('awa-mode', 'awa-mode'), 'C’est déjà l’adresse de votre boutique.');
  assert.equal(A.refusAdresse('awa-mode', 'Awa-Mode'), 'C’est déjà l’adresse de votre boutique.');

  assert.equal(A.adresseProposee('Awa Mode', 'awa-traore-diallo'), 'awa-mode');
  assert.equal(A.adresseProposee('Awa Mode', 'awa-mode'), '', 'déjà la sienne : rien à proposer');
  assert.equal(A.adresseProposee('Suguba Officiel', 'awa'), '', 'jamais une adresse réservée');
  for (const rien of [null, undefined, '', 'Al', '!!!']) assert.equal(A.adresseProposee(rien, 'awa-traore-diallo'), '', String(rien));

  // Chaque refus de la base a son message et son statut ; l'option absente n'est jamais une erreur 500.
  const refus = (r) => A.refusChangement(r, 'Option pas encore activée.');
  assert.deepEqual(refus('pris'), { erreur: 'Cette adresse est déjà prise. Essayez-en une autre.', statut: 409 });
  assert.equal(refus('deja_change').statut, 409);
  assert.match(refus('deja_change').erreur, /n’est possible qu’une fois/);
  assert.deepEqual(refus('indisponible'), { erreur: 'Option pas encore activée.', statut: 409 });
  assert.deepEqual([refus('identique').statut, refus('invalide').statut, refus('reservee').statut, refus('introuvable').statut, refus('erreur').statut], [400, 400, 400, 404, 503]);
});

test('adresseDeRedirection : ?rayon, ?ref et ?via gardés et validés ; tout autre paramètre abandonné ; toujours une adresse interne', () => {
  const { adresseDeRedirection } = require('../src/lib/adresse-boutique.ts');
  const { destinationDuLien } = require('../src/lib/reseau/codes.ts');
  assert.equal(adresseDeRedirection('awa-mode'), '/boutique/awa-mode');
  assert.equal(adresseDeRedirection('awa-mode', {}), '/boutique/awa-mode');
  assert.equal(adresseDeRedirection('awa-mode', { ref: 'AWA1', via: 'AB78X2', rayon: 'pagnes' }), '/boutique/awa-mode?rayon=pagnes&ref=AWA1&via=AB78X2');
  // Ce qu'un ancien lien suivi /go/<code> ouvre arrive tel quel à la nouvelle adresse.
  assert.equal(destinationDuLien('store', 'awa-traore-diallo~pagnes', 'AWA1', 'AB78X2').replace('awa-traore-diallo', 'awa-mode'),
    adresseDeRedirection('awa-mode', { ref: 'AWA1', via: 'AB78X2', rayon: 'pagnes' }));
  assert.equal(adresseDeRedirection('awa-mode', { ref: 'awa1', via: 'ab78x2' }), '/boutique/awa-mode?ref=AWA1&via=AB78X2');
  // Abandonnés : outils du propriétaire, paramètres inconnus, valeurs répétées ou invalides.
  assert.equal(adresseDeRedirection('awa-mode', {
    editer: 'logo', partager: '1', next: '//ailleurs.example', rayon: 'Pagnes !', ref: ['AWA1', 'MOU2'], via: '<script>',
  }), '/boutique/awa-mode');
  assert.equal(adresseDeRedirection('awa-mode', { rayon: 'x'.repeat(41), ref: 'a', via: 'abc' }), '/boutique/awa-mode');
  for (const url of [adresseDeRedirection('//ailleurs.example'), adresseDeRedirection('a/../b', { ref: 'AWA1' })]) {
    assert.match(url, /^\/boutique\/[^/]+$|^\/boutique\/[^/]+\?/, url);
    assert.doesNotMatch(url, /^\/\//);
  }
});

// ── 2. Retrouver une boutique par son ancienne adresse ──────────────────────

test('boutiqueParSlug : l’adresse actuelle ne coûte aucune lecture de plus ; l’ancienne rend la boutique avec sa NOUVELLE adresse ; inconnue : null', async () => {
  const { boutiqueParSlug } = require('../src/lib/reseau/boutiques.ts');
  baseAwa();
  let b = await boutiqueParSlug('awa-traore-diallo');
  assert.equal(b.slug, 'awa-traore-diallo');
  assert.equal('ancienneAdresse' in b, false);
  assert.equal(sur('store_slug_aliases').length, 0, 'adresse trouvée : la table des anciennes adresses n’est pas lue');

  etat.stores[0].slug = 'awa-mode';
  etat.store_slug_aliases = [{ slug: 'awa-traore-diallo', store_id: 's1' }];
  operations = [];
  b = await boutiqueParSlug(' Awa-Traore-Diallo ');
  assert.deepEqual([b.id, b.slug, b.ancienneAdresse, b.nom], ['s1', 'awa-mode', 'awa-traore-diallo', 'Awa Mode']);
  assert.deepEqual(operations.map((o) => [o.table, o.op]), [['stores', 'select'], ['store_slug_aliases', 'select'], ['stores', 'select']]);
  assert.deepEqual(sur('store_slug_aliases')[0].egalites, { slug: 'awa-traore-diallo' });
  b = await boutiqueParSlug('awa-mode');
  assert.equal('ancienneAdresse' in b, false, 'la nouvelle adresse est une adresse ordinaire');

  // Inconnue : null. Ce qui ne peut pas être une adresse n'interroge même pas les anciennes.
  operations = [];
  assert.equal(await boutiqueParSlug('inconnue'), null);
  assert.equal(sur('store_slug_aliases').length, 1);
  for (const illisible of ['awa_traore_diallo', 'awa traore', 'é', 'x'.repeat(81), '<script>']) {
    operations = [];
    assert.equal(await boutiqueParSlug(illisible), null, illisible);
    assert.equal(sur('store_slug_aliases').length, 0, illisible);
  }
  // Ancienne adresse d'une boutique supprimée, ou lecture en échec : null, jamais une autre boutique.
  etat.store_slug_aliases.push({ slug: 'fantome', store_id: 'supprimee' });
  assert.equal(await boutiqueParSlug('fantome'), null);
  fautes['stores:select'] = '57014';
  operations = [];
  assert.equal(await boutiqueParSlug('awa-traore-diallo'), null);
  assert.equal(sur('store_slug_aliases').length, 0, 'lecture des boutiques en échec : on ne conclut rien');
  assert.deepEqual(ecritures(), []);
});

test('boutiqueParSlug AVANT le SQL (table absente, 42P01 ou PGRST205) : une adresse inconnue reste introuvable, sans erreur', async () => {
  const { boutiqueParSlug } = require('../src/lib/reseau/boutiques.ts');
  for (const code of ['42P01', 'PGRST205']) {
    baseAwa({ migree: false });
    fautes['store_slug_aliases:select'] = code;
    assert.equal(await boutiqueParSlug('ancienne-adresse'), null, code);
    assert.equal((await boutiqueParSlug('awa-traore-diallo')).slug, 'awa-traore-diallo');
    assert.equal((await boutiqueParSlug('awa-traore-diallo')).options.reglages, false);
  }
});

test('WhatsApp : celui d’un fournisseur n’est jamais exposé, même retrouvé par son ancienne adresse', async () => {
  const { boutiqueParSlug } = require('../src/lib/reseau/boutiques.ts');
  baseAwa();
  etat.stores.push({ id: 'f1', owner_type: 'supplier', owner_id: 'fou-1', slug: 'grossiste-bamako', name: 'Grossiste', status: 'active', whatsapp: '+22376000000', reglages: {} });
  etat.store_slug_aliases = [{ slug: 'ancien-grossiste', store_id: 'f1' }];
  for (const adresse of ['grossiste-bamako', 'ancien-grossiste']) {
    const b = await boutiqueParSlug(adresse);
    assert.equal(b.id, 'f1');
    assert.equal(b.whatsapp, null, adresse);
  }
});

// ── 3. La vitrine : redirection permanente de l'ancienne adresse ────────────

test('/boutique/<ancienne adresse> : redirection PERMANENTE vers la nouvelle, avec ?rayon, ?ref et ?via ; rien d’autre n’est lu', async () => {
  baseAwa();
  etat.stores[0].slug = 'awa-mode';
  etat.store_slug_aliases = [{ slug: 'awa-traore-diallo', store_id: 's1' }];
  sessionCourante = null;

  operations = [];
  await assert.rejects(ouvrir('awa-traore-diallo', { ref: 'AWA1', via: 'AB78X2', rayon: 'pagnes' }), (e) => {
    assert.ok(e instanceof Redirection, e.message);
    assert.equal(e.url, '/boutique/awa-mode?rayon=pagnes&ref=AWA1&via=AB78X2');
    return true;
  });
  assert.deepEqual([...new Set(operations.map((o) => o.table))], ['stores', 'store_slug_aliases'], 'ni profil, ni articles, ni session : la page redirige aussitôt');
  // L'aperçu de lien (WhatsApp, Facebook) suit la même redirection.
  await assert.rejects(apercu('awa-traore-diallo', { via: 'AB78X2' }), (e) => e instanceof Redirection && e.url === '/boutique/awa-mode?via=AB78X2');
  await assert.rejects(ouvrir('awa-traore-diallo'), (e) => e instanceof Redirection && e.url === '/boutique/awa-mode');
  // Sans majuscules ni paramètres parasites : seuls rayon, ref et via passent.
  await assert.rejects(ouvrir('Awa-Traore-Diallo', { editer: 'logo', partager: '1', next: '//ailleurs.example', ref: 'awa1' }),
    (e) => e instanceof Redirection && e.url === '/boutique/awa-mode?ref=AWA1');
  // Le propriétaire aussi : son ancien favori le mène à sa boutique.
  sessionCourante = revendeur('rev-1');
  await assert.rejects(ouvrir('awa-traore-diallo', { editer: 'logo' }), (e) => e instanceof Redirection && e.url === '/boutique/awa-mode');
  assert.deepEqual(ecritures(), [], 'rediriger n’écrit rien');
});

test('/boutique/<nouvelle adresse> : la vitrine, sans redirection ; adresse de référence, partage et visite portent la nouvelle adresse', async () => {
  baseAwa();
  etat.stores[0].slug = 'awa-mode';
  etat.store_slug_aliases = [{ slug: 'awa-traore-diallo', store_id: 's1' }];
  sessionCourante = null;
  operations = [];
  const el = await ouvrir('awa-mode', { via: 'AB78X2' });
  assert.equal(el.props.urlPartage, 'https://app.sugubaml.com/boutique/awa-mode');
  assert.deepEqual(el.props.visite, { slug: 'awa-mode', via: 'AB78X2' });
  assert.equal(el.props.proprietaire, null);
  assert.equal(sur('store_slug_aliases').length, 0, 'aucune lecture de plus pour une adresse en service');
  const html = renderToStaticMarkup(el);
  assert.match(html, /Awa Mode/);
  assert.deepEqual([...html.matchAll(/data-carte="([^"]+)"/g)].map((m) => m[1]), ['Pagne wax', 'Bazin riche', 'Théière']);
  assert.doesNotMatch(html, /awa-traore-diallo/, 'l’ancienne adresse (le nom complet) n’est plus dans la page');
  assert.doesNotMatch(html, NOM_COMPLET);
  const meta = await apercu('awa-mode');
  assert.equal(meta.alternates.canonical, 'https://app.sugubaml.com/boutique/awa-mode');
  assert.equal(meta.openGraph.url, 'https://app.sugubaml.com/boutique/awa-mode');
  // Le propriétaire garde son mode propriétaire à la nouvelle adresse.
  sessionCourante = revendeur('rev-1');
  assert.deepEqual((await ouvrir('awa-mode')).props.proprietaire, { statut: 'active', abonnes: 3, gestion: true });
});

test('Ancienne adresse d’une boutique masquée par Suguba : page introuvable, pas de redirection permanente vers une page introuvable', async () => {
  baseAwa();
  etat.stores[0].slug = 'awa-mode';
  etat.stores[0].status = 'hidden';
  etat.store_slug_aliases = [{ slug: 'awa-traore-diallo', store_id: 's1' }];
  for (const s of [null, revendeur('rev-2'), revendeur('rev-1')]) {
    sessionCourante = s;
    await assert.rejects(ouvrir('awa-traore-diallo', { ref: 'AWA1' }), Introuvable);
  }
  assert.equal((await apercu('awa-traore-diallo')).title, 'Boutique introuvable — Suguba');
  // À sa nouvelle adresse : son propriétaire la voit (pastille « Masquée »), pas un visiteur.
  assert.equal((await ouvrir('awa-mode')).props.proprietaire.statut, 'hidden');
  sessionCourante = null;
  await assert.rejects(ouvrir('awa-mode'), Introuvable);
});

test('AVANT le SQL : /boutique/<adresse> est inchangé (même page, aucune lecture des anciennes adresses) ; une adresse inconnue reste introuvable', async () => {
  // La même boutique, base migrée puis non migrée : un visiteur reçoit exactement la même page.
  const rendre = async (migree) => {
    baseAwa({ migree });
    sessionCourante = null;
    operations = [];
    const el = await ouvrir('awa-traore-diallo', { ref: 'AWA1' });
    assert.equal(sur('store_slug_aliases').length, 0, 'adresse en service : rien de plus n’est lu');
    assert.equal(operations.some((o) => o.op === 'rpc'), false);
    return renderToStaticMarkup(el);
  };
  const apres = await rendre(true);
  const avant = await rendre(false);
  assert.equal(avant, apres);
  assert.match(avant, /Awa Mode/);

  baseAwa({ migree: false });
  sessionCourante = null;
  await assert.rejects(ouvrir('ancienne-adresse', { ref: 'AWA1' }), Introuvable);
  assert.equal((await apercu('ancienne-adresse')).title, 'Boutique introuvable — Suguba');
  assert.deepEqual(ecritures(), []);
  // Le propriétaire garde son mode propriétaire, sans tuile ni section nouvelle.
  sessionCourante = revendeur('rev-1');
  const el = await ouvrir('awa-traore-diallo');
  assert.deepEqual(el.props.proprietaire, { statut: 'active', abonnes: 3, gestion: true });
});

// ── 4. Changer d'adresse : une seule fois ───────────────────────────────────

test('changerAdresse : ok, puis « deja_change » ; « pris » pour une adresse active comme pour une ancienne ; rien d’autre que la fonction n’est appelé', async () => {
  const { changerAdresse, boutiqueParSlug, etatAdresse, adresseLibre } = require('../src/lib/reseau/boutiques.ts');
  baseAwa();
  const selection = SELECTION_INTACTE();
  assert.deepEqual(await etatAdresse('s1'), { option: true, ancienne: null });
  assert.equal(await adresseLibre('awa-mode'), true);
  assert.equal(await adresseLibre('chez-moussa'), false);

  // Refusé avant la base : format, adresse réservée, numéro. La fonction n'est pas appelée.
  operations = [];
  for (const [nouveau, attendu] of [['ab', 'invalide'], ['', 'invalide'], ['!!!', 'invalide'], ['suguba-officiel', 'reservee'], ['admin', 'reservee'], ['awa-76123456', 'reservee'], ['2026', 'reservee']]) {
    assert.equal(await changerAdresse('s1', 'rev-1', nouveau), attendu, nouveau);
  }
  assert.deepEqual(operations, []);
  assert.equal(await changerAdresse('s1', 'rev-1', 'chez-moussa'), 'pris', 'adresse d’une autre boutique');
  assert.equal(await changerAdresse('s1', 'rev-2', 'awa-mode'), 'introuvable', 'ce n’est pas sa boutique');
  assert.equal(await changerAdresse('s1', 'rev-1', 'awa-traore-diallo'), 'identique');
  assert.equal(etat.stores[0].slug, 'awa-traore-diallo', 'rien n’a changé');

  operations = [];
  assert.equal(await changerAdresse('s1', 'rev-1', 'awa-mode'), 'ok');
  assert.deepEqual(operations, [{ table: 'rpc:changer_adresse_boutique', op: 'rpc', patch: { p_store_id: 's1', p_owner_id: 'rev-1', p_nouveau: 'awa-mode' } }],
    'un seul appel : la fonction SQL, transactionnelle');
  assert.equal(etat.stores[0].slug, 'awa-mode');
  assert.deepEqual(etat.store_slug_aliases.map((a) => [a.slug, a.store_id]), [['awa-traore-diallo', 's1']], 'l’ancienne adresse est gardée');
  assert.deepEqual(await etatAdresse('s1'), { option: true, ancienne: 'awa-traore-diallo' });
  assert.equal((await boutiqueParSlug('awa-traore-diallo')).slug, 'awa-mode');

  // Un second changement est refusé.
  assert.equal(await changerAdresse('s1', 'rev-1', 'awa-chic'), 'deja_change');
  assert.equal(etat.stores[0].slug, 'awa-mode');
  // L'adresse prise, comme adresse ou comme ancienne adresse, est refusée à une autre boutique.
  assert.equal(await changerAdresse('s2', 'rev-2', 'awa-mode'), 'pris', 'adresse en service');
  assert.equal(await changerAdresse('s2', 'rev-2', 'awa-traore-diallo'), 'pris', 'ancienne adresse : jamais reprise');
  assert.equal(await adresseLibre('awa-traore-diallo'), false);
  assert.equal(await adresseLibre('awa-mode'), false);
  assert.equal(etat.stores[1].slug, 'chez-moussa');
  assert.equal(etat.store_slug_aliases.length, 1);
  // Effet commercial : la sélection d'articles n'est ni lue ni écrite.
  assert.equal(SELECTION_INTACTE(), selection);
  assert.equal(sur('reseller_shop_items').length + sur('store_products').length, 0);
});

test('changerAdresse AVANT le SQL : fonction ou table absente (PGRST202, 42883, 42P01, PGRST205) → « indisponible » ; panne → « erreur » ; jamais « libre » sur une panne', async () => {
  const { changerAdresse, etatAdresse, adresseLibre } = require('../src/lib/reseau/boutiques.ts');
  for (const code of ['PGRST202', '42883', '42P01', 'PGRST205']) {
    baseAwa({ migree: false });
    fautes['rpc:changer_adresse_boutique'] = code;
    assert.equal(await changerAdresse('s1', 'rev-1', 'awa-mode'), 'indisponible', code);
    assert.equal(etat.stores[0].slug, 'awa-traore-diallo');
  }
  assert.deepEqual(await etatAdresse('s1'), { option: false, ancienne: null });
  assert.equal(await adresseLibre('awa-mode'), null, 'on ne sait pas : jamais « libre »');
  baseAwa();
  fautes['rpc:changer_adresse_boutique'] = '57014';
  assert.equal(await changerAdresse('s1', 'rev-1', 'awa-mode'), 'erreur');
  fautes['store_slug_aliases:select'] = '57014';
  assert.deepEqual(await etatAdresse('s1'), { option: false, ancienne: null }, 'lecture en échec : la section n’est pas proposée');
  assert.equal(await adresseLibre('awa-mode'), null);
  delete fautes['store_slug_aliases:select'];
  fautes['stores:select'] = '57014';
  assert.equal(await adresseLibre('awa-mode'), null);
  // Une réponse inattendue de la base n'est jamais prise pour un succès.
  baseAwa();
  baseCourante = { ...db, rpc: async () => ({ data: 'peut-etre', error: null }) };
  assert.equal(await changerAdresse('s1', 'rev-1', 'awa-mode'), 'erreur');
  baseCourante = null;
  assert.equal(await changerAdresse('s1', 'rev-1', 'awa-mode'), 'erreur');
  baseCourante = db;
});

// ── 5. Le VRAI fichier SQL, dans un PostgreSQL local (PGlite) ───────────────

async function baseSql({ avecLeFichier = true } = {}) {
  const { database, sql } = require('./helpers/audit-db.cjs');
  const pg = await database();
  await pg.exec(`INSERT INTO public.profiles (id, phone, full_name, role) VALUES
    ('rev-1', '+22370000001', '[TEST] Awa', 'reseller'), ('rev-2', '+22370000002', '[TEST] Moussa', 'reseller'), ('rev-3', '+22370000003', '[TEST] Awa bis', 'reseller')`);
  await pg.exec(`INSERT INTO public.stores (id, owner_type, owner_id, slug, name) VALUES
    ('s1', 'reseller', 'rev-1', 'awa-traore-diallo', '[TEST] Awa Mode'), ('s2', 'reseller', 'rev-2', 'chez-moussa', '[TEST] Chez Moussa')`);
  if (avecLeFichier) await pg.exec(sql(SQL));
  return pg;
}

test('SQL réel (PGlite) : changerAdresse appelle la vraie fonction avec ses vrais paramètres ; second changement refusé ; adresse prise refusée ; l’ancienne adresse retrouve la boutique', async () => {
  const B = require('../src/lib/reseau/boutiques.ts');
  const pg = await baseSql();
  baseAwa();
  baseCourante = clientSql(pg);
  try {
    const adresseDe = async (id) => (await pg.query(`SELECT slug FROM public.stores WHERE id = '${id}'`)).rows[0].slug;
    // Les mêmes appels sur la base simulée de ce fichier : son miroir de la fonction dit la même chose.
    const comme = async (id, proprietaire, nouveau, attendu) => {
      assert.equal(await B.changerAdresse(id, proprietaire, nouveau), attendu, `SQL réel : ${id} → ${nouveau}`);
      assert.equal(changerAdresseSimulee({ p_store_id: id, p_owner_id: proprietaire, p_nouveau: nouveau }), attendu, `miroir : ${id} → ${nouveau}`);
    };
    assert.deepEqual(await B.etatAdresse('s1'), { option: true, ancienne: null });
    assert.equal(await B.adresseLibre('awa-mode'), true);
    assert.equal(await B.adresseLibre('chez-moussa'), false);
    await comme('s1', 'rev-2', 'awa-mode', 'introuvable');
    await comme('s1', 'rev-1', 'chez-moussa', 'pris');
    await comme('s1', 'rev-1', 'awa-traore-diallo', 'identique');
    assert.equal(await adresseDe('s1'), 'awa-traore-diallo');

    await comme('s1', 'rev-1', 'awa-mode', 'ok');
    assert.equal(await adresseDe('s1'), 'awa-mode');
    assert.deepEqual((await pg.query('SELECT slug, store_id FROM public.store_slug_aliases')).rows, [{ slug: 'awa-traore-diallo', store_id: 's1' }]);
    assert.deepEqual(await B.etatAdresse('s1'), { option: true, ancienne: 'awa-traore-diallo' });
    await comme('s1', 'rev-1', 'awa-chic', 'deja_change');
    await comme('s2', 'rev-2', 'awa-mode', 'pris');
    await comme('s2', 'rev-2', 'awa-traore-diallo', 'pris');
    assert.equal(await B.adresseLibre('awa-traore-diallo'), false, 'ancienne adresse : plus jamais libre');
    assert.equal(await adresseDe('s2'), 'chez-moussa');

    // L'ancienne adresse retrouve la boutique, avec sa nouvelle adresse.
    const parAncienne = await B.boutiqueParSlug('awa-traore-diallo');
    assert.deepEqual([parAncienne.id, parAncienne.slug, parAncienne.ancienneAdresse, parAncienne.options.reglages], ['s1', 'awa-mode', 'awa-traore-diallo', true]);
    assert.equal('ancienneAdresse' in (await B.boutiqueParSlug('awa-mode')), false);
    assert.equal(await B.boutiqueParSlug('inconnue'), null);
    // Vérification 4 du fichier : aucune ancienne adresse n'est aussi une adresse en service.
    assert.equal(Number((await pg.query('SELECT count(*) AS n FROM public.store_slug_aliases a JOIN public.stores s ON lower(s.slug) = a.slug')).rows[0].n), 0);
  } finally { baseCourante = db; }
});

test('SQL réel (PGlite) : une nouvelle boutique dont le nom donne une ancienne adresse reçoit « -2 », à la création comme pour une boutique supplémentaire', async () => {
  const B = require('../src/lib/reseau/boutiques.ts');
  const { creerBoutiqueSupplementaire } = require('../src/lib/reseau/boutiques-multiples.ts');
  const pg = await baseSql();
  baseAwa();
  baseCourante = clientSql(pg);
  try {
    assert.equal(await B.changerAdresse('s1', 'rev-1', 'awa-mode'), 'ok');
    // Un autre compte s'appelle « Awa Traoré Diallo » : sa boutique ne capte pas les anciens QR d'Awa.
    const nouvelle = await B.obtenirOuCreerBoutique({ typeProprietaire: 'reseller', proprietaireId: 'rev-3', nom: 'Awa Traoré Diallo' });
    assert.equal(nouvelle.slug, 'awa-traore-diallo-2');
    assert.equal((await B.boutiqueParSlug('awa-traore-diallo')).id, 's1', 'l’ancienne adresse mène toujours à la boutique d’Awa');
    // Boutique supplémentaire (formule Pro) : même règle.
    const pro = await creerBoutiqueSupplementaire({ type: 'reseller', proprietaireId: 'rev-2', nom: 'Awa Traoré Diallo', forcer: true });
    assert.equal(pro.ok, true);
    assert.equal(pro.boutique.slug, 'awa-traore-diallo-3', '« -2 » est déjà porté par une boutique');
    const libre = await creerBoutiqueSupplementaire({ type: 'reseller', proprietaireId: 'rev-2', nom: 'Moussa Déco', forcer: true });
    assert.equal(libre.boutique.slug, 'moussa-deco', 'une adresse jamais portée est donnée telle quelle');
    assert.equal(Number((await pg.query('SELECT count(*) AS n FROM public.store_slug_aliases a JOIN public.stores s ON lower(s.slug) = a.slug')).rows[0].n), 0);
  } finally { baseCourante = db; }
});

test('SQL réel (PGlite) SANS le fichier : ni table ni fonction → option absente, « indisponible », créations et lectures comme avant', async () => {
  const B = require('../src/lib/reseau/boutiques.ts');
  const { creerBoutiqueSupplementaire } = require('../src/lib/reseau/boutiques-multiples.ts');
  const pg = await baseSql({ avecLeFichier: false });
  baseAwa();
  baseCourante = clientSql(pg);
  try {
    assert.deepEqual(await B.etatAdresse('s1'), { option: false, ancienne: null });
    assert.equal(await B.changerAdresse('s1', 'rev-1', 'awa-mode'), 'indisponible', 'vraie erreur 42883 de Postgres');
    assert.equal(await B.adresseLibre('awa-mode'), null);
    assert.equal(await B.boutiqueParSlug('ancienne-adresse'), null, 'vraie erreur 42P01 : page introuvable, comme avant');
    const actuelle = await B.boutiqueParSlug('awa-traore-diallo');
    assert.deepEqual([actuelle.id, actuelle.slug, actuelle.options.reglages], ['s1', 'awa-traore-diallo', false]);
    assert.deepEqual([...(await B.adressesDejaPortees(baseCourante, ['awa-mode', 'chez-moussa']))], []);
    const nouvelle = await B.obtenirOuCreerBoutique({ typeProprietaire: 'reseller', proprietaireId: 'rev-3', nom: 'Awa Traoré Diallo' });
    assert.equal(nouvelle.slug, 'awa-traore-diallo-2', 'l’adresse en service reste protégée par son index unique');
    const pro = await creerBoutiqueSupplementaire({ type: 'reseller', proprietaireId: 'rev-2', nom: 'Moussa Déco', forcer: true });
    assert.equal(pro.boutique.slug, 'moussa-deco');
    assert.equal((await pg.query(`SELECT slug FROM public.stores WHERE id = 's1'`)).rows[0].slug, 'awa-traore-diallo');
  } finally { baseCourante = db; }
});

// ── 6. Créations : jamais l'ancienne adresse d'une autre boutique ───────────

test('Création (base simulée) : un nom égal à une ancienne adresse reçoit « -2 » ; table absente : comme avant ; anciennes adresses illisibles : rien n’est créé', async () => {
  const B = require('../src/lib/reseau/boutiques.ts');
  const { creerBoutiqueSupplementaire } = require('../src/lib/reseau/boutiques-multiples.ts');
  const creer = () => B.obtenirOuCreerBoutique({ typeProprietaire: 'reseller', proprietaireId: 'rev-3', nom: 'Awa Traoré Diallo' });
  const creerPro = () => creerBoutiqueSupplementaire({ type: 'reseller', proprietaireId: 'rev-2', nom: 'Awa Traoré Diallo', forcer: true });
  const apresChangement = () => {
    baseAwa();
    etat.profiles.push({ id: 'rev-3', full_name: 'Awa Traoré Diallo', reseller_code: 'AWA3' });
    etat.stores[0].slug = 'awa-mode';
    etat.store_slug_aliases = [{ slug: 'awa-traore-diallo', store_id: 's1' }];
    operations = [];
  };

  apresChangement();
  assert.equal((await creer()).slug, 'awa-traore-diallo-2');
  assert.equal(sur('store_slug_aliases').length, 1, 'une seule lecture pour tous les candidats');
  assert.ok(sur('store_slug_aliases')[0].dans.slug.includes('awa-traore-diallo'));
  assert.deepEqual(sur('stores').filter((o) => o.op === 'insert').map((o) => o.patch.slug), ['awa-traore-diallo-2'], 'l’ancienne adresse n’est même pas essayée');
  apresChangement();
  const pro = await creerPro();
  assert.deepEqual([pro.ok, pro.boutique.slug, pro.boutique.principale], [true, 'awa-traore-diallo-2', false]);
  assert.deepEqual(sur('stores').filter((o) => o.op === 'insert').map((o) => o.patch.slug), ['awa-traore-diallo-2']);

  // AVANT le SQL (table absente) : les créations fonctionnent comme avant.
  for (const code of ['42P01', 'PGRST205']) {
    baseAwa({ migree: false });
    fautes['store_slug_aliases:select'] = code;
    etat.stores[0].slug = 'awa-mode';
    assert.equal((await creer()).slug, 'awa-traore-diallo', code);
    assert.equal((await creerPro()).boutique.slug, 'awa-traore-diallo-2', code);
  }
  // Panne à la lecture des anciennes adresses : rien n'est créé (jamais « aucune ancienne adresse » inventé).
  apresChangement();
  fautes['store_slug_aliases:select'] = '57014';
  assert.equal(await creer(), null);
  assert.deepEqual(await creerPro(), { ok: false, erreur: 'Création impossible pour le moment.', statut: 503 });
  assert.deepEqual(ecritures(), []);
  // Une boutique qui existe déjà est rendue sans rien lire des anciennes adresses.
  operations = [];
  assert.equal((await B.obtenirOuCreerBoutique({ typeProprietaire: 'reseller', proprietaireId: 'rev-1', nom: 'Awa D.' })).slug, 'awa-mode');
  assert.equal(sur('store_slug_aliases').length, 0);
});

// ── 7. Routes : l'identité vient de la session ──────────────────────────────

test('GET /api/reseller/boutique : options.adresse et ancienneAdresse après le SQL ; avant, faux sans rien lire de plus ; table seule absente : faux', async () => {
  const lireBoutique = (suite = '') => appeler('GET', `/api/reseller/boutique${suite}`);
  baseAwa();
  let json = await (await lireBoutique()).json();
  assert.deepEqual(json.options, { reglages: true, adresse: true });
  assert.equal(json.ancienneAdresse, null);
  assert.equal(json.boutique.slug, 'awa-traore-diallo');
  assert.deepEqual(sur('store_slug_aliases').map((o) => o.egalites), [{ store_id: 's1' }], 'une lecture, pour SA boutique');
  assert.doesNotMatch(JSON.stringify(json), NOM_COMPLET);

  etat.stores[0].slug = 'awa-mode';
  etat.store_slug_aliases = [{ slug: 'awa-traore-diallo', store_id: 's1' }, { slug: 'ancien-moussa', store_id: 's2' }];
  json = await (await lireBoutique('?creer=non')).json();
  assert.deepEqual([json.options.adresse, json.ancienneAdresse, json.boutique.slug], [true, 'awa-traore-diallo', 'awa-mode']);

  // AVANT le SQL : rien n'est lu de plus, la section n'existe pas.
  baseAwa({ migree: false });
  operations = [];
  json = await (await lireBoutique()).json();
  assert.deepEqual(json.options, { reglages: false, adresse: false });
  assert.equal(json.ancienneAdresse, null);
  assert.equal(sur('store_slug_aliases').length, 0);
  // Bloc 2 du fichier retiré (le fondateur aurait refusé le changement d'adresse) : rayons et annonce, sans la section adresse.
  baseAwa();
  fautes['store_slug_aliases:select'] = '42P01';
  assert.deepEqual((await (await lireBoutique()).json()).options, { reglages: true, adresse: false });

  // L'adresse ne se change jamais par PATCH : `slug` y est ignoré.
  baseAwa();
  const reponse = await appeler('PATCH', '/api/reseller/boutique', { slug: 'pirate', adresse: 'pirate', accroche: 'Bonjour' });
  assert.equal(reponse.status, 200);
  json = await reponse.json();
  assert.deepEqual([json.boutique.slug, json.boutique.accroche, json.options.adresse, json.ancienneAdresse], ['awa-traore-diallo', 'Bonjour', true, null]);
  assert.equal(etat.store_slug_aliases.length, 0);
});

test('GET /api/reseller/boutique/adresse : état de SA boutique ; ?adresse= dit libre, prise (adresse ou ancienne adresse) ou refusée, sans rien écrire', async () => {
  baseAwa();
  etat.store_slug_aliases = [{ slug: 'ancien-moussa', store_id: 's2' }];
  let r = await lireAdresse();
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await r.json(), { option: true, actuelle: 'awa-traore-diallo', ancienne: null });

  const demande = async (texte) => (await (await lireAdresse(`?adresse=${encodeURIComponent(texte)}`)).json()).demande;
  assert.deepEqual(await demande('Awa Mode'), { adresse: 'awa-mode', etat: 'libre', message: null }, 'l’adresse renvoyée est celle qui serait enregistrée');
  assert.deepEqual(await demande('Chez Moussa'), { adresse: 'chez-moussa', etat: 'prise', message: 'Cette adresse est déjà prise. Essayez-en une autre.' });
  assert.deepEqual((await demande('ancien-moussa')).etat, 'prise', 'ancienne adresse d’une autre boutique');
  for (const [texte, raison] of [
    ['ab', /Au moins 3 caractères/], ['Suguba Officiel', /réservée à Suguba/], ['awa 76 12 34 56', /numéro de téléphone/],
    ['Awa Traoré Diallo', /déjà l’adresse de votre boutique/], ['!!!', /Écrivez l’adresse voulue/], ['2026', /contenir des lettres/],
  ]) {
    const d = await demande(texte);
    assert.equal(d.etat, 'refusee', texte);
    assert.match(d.message, raison, texte);
  }
  // Une adresse refusée par la règle n'interroge pas la base.
  operations = [];
  await demande('admin');
  assert.equal(sur('stores').filter((o) => 'slug' in o.egalites).length, 0);
  assert.deepEqual(ecritures(), [], 'lecture seule : vérifier ne réserve rien');
  // On ne sait pas (la recherche de l'adresse échoue, pas la lecture de SA boutique) : 503, jamais « libre ».
  fautes['stores:select'] = (o) => ('slug' in o.egalites ? '57014' : null);
  r = await lireAdresse('?adresse=awa-mode');
  assert.equal(r.status, 503);
  assert.equal('demande' in (await r.json()), false);
  delete fautes['stores:select'];

  // Changement déjà fait : toute demande est refusée, l'ancienne adresse est rappelée.
  etat.stores[0].slug = 'awa-mode';
  etat.store_slug_aliases.push({ slug: 'awa-traore-diallo', store_id: 's1' });
  r = await lireAdresse('?adresse=awa-chic');
  const json = await r.json();
  assert.deepEqual([json.actuelle, json.ancienne, json.demande.etat], ['awa-mode', 'awa-traore-diallo', 'refusee']);
  assert.match(json.demande.message, /n’est possible qu’une fois/);

  // Session : revendeur seulement ; chacun ne voit que SA boutique.
  sessionCourante = revendeur('rev-2');
  assert.deepEqual(await (await lireAdresse()).json(), { option: true, actuelle: 'chez-moussa', ancienne: 'ancien-moussa' });
  sessionCourante = revendeur('rev-9');
  assert.equal((await lireAdresse()).status, 404);
  for (const s of [null, revendeur('rev-1', { role: 'customer' }), revendeur('rev-1', { role: 'supplier' })]) {
    sessionCourante = s;
    assert.equal((await lireAdresse('?adresse=awa-mode')).status, 401);
  }
  // AVANT le SQL : l'option est absente, la réponse ne dit rien d'une adresse.
  baseAwa({ migree: false });
  assert.deepEqual(await (await lireAdresse('?adresse=awa-mode')).json(), { option: false, actuelle: 'awa-traore-diallo', ancienne: null });
});

test('POST /api/reseller/boutique/adresse : change SA boutique (session), une seule fois ; le corps ne porte que l’adresse ; rien d’autre n’est écrit', async () => {
  baseAwa();
  const selection = SELECTION_INTACTE();
  // Identité forgée dans le corps : ignorée. Moussa ne change que SA boutique.
  sessionCourante = revendeur('rev-2');
  operations = [];
  let r = await changer({ adresse: 'awa-mode', boutique: 's1', store_id: 's1', p_store_id: 's1', uid: 'rev-1', owner_id: 'rev-1', proprietaireId: 'rev-1' });
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { adresse: 'awa-mode', ancienne: 'chez-moussa' });
  assert.deepEqual(operations.filter((o) => o.op === 'rpc').map((o) => o.patch), [{ p_store_id: 's2', p_owner_id: 'rev-2', p_nouveau: 'awa-mode' }]);
  assert.deepEqual(etat.stores.map((s) => s.slug), ['awa-traore-diallo', 'awa-mode'], 'la boutique d’Awa n’a pas bougé');
  assert.deepEqual(ecritures().map((o) => o.table), ['rpc:changer_adresse_boutique'], 'aucune autre écriture');
  assert.equal(SELECTION_INTACTE(), selection, 'la sélection (et ses offres) est intacte');

  // Awa : l'adresse que Moussa vient de prendre, puis son ancienne, sont refusées.
  sessionCourante = revendeur('rev-1');
  for (const prise of ['awa-mode', 'chez-moussa']) {
    r = await changer({ adresse: prise });
    assert.equal(r.status, 409, prise);
    assert.deepEqual(await r.json(), { error: 'Cette adresse est déjà prise. Essayez-en une autre.', resultat: 'pris' });
  }
  // Refus sans appeler la base : texte non confirmé à l'écran, format, adresse réservée, la sienne.
  operations = [];
  for (const [corps, statut, raison] of [
    [{ adresse: 'Awa Chic' }, 400, /Adresse illisible/], [{ adresse: ' awa-chic' }, 400, /Adresse illisible/], [{ adresse: 'awa--chic' }, 400, /Adresse illisible/],
    [{ adresse: 42 }, 400, /Adresse illisible/], [{}, 400, /Adresse illisible/], [['awa-chic'], 400, /Adresse illisible/], ['pas du json', 400, /Adresse illisible/],
    [{ adresse: 'x'.repeat(121) }, 400, /Adresse illisible/], [{ adresse: 'ab' }, 400, /Au moins 3 caractères/],
    [{ adresse: 'suguba-officiel' }, 400, /réservée à Suguba/], [{ adresse: 'awa-76123456' }, 400, /numéro de téléphone/],
    [{ adresse: 'awa-traore-diallo' }, 400, /déjà l’adresse de votre boutique/],
  ]) {
    r = await changer(corps);
    assert.equal(r.status, statut, JSON.stringify(corps));
    assert.match((await r.json()).error, raison, JSON.stringify(corps));
  }
  assert.equal(operations.some((o) => o.op === 'rpc'), false, 'la fonction n’est pas appelée pour une adresse refusée');
  assert.equal(etat.stores[0].slug, 'awa-traore-diallo');

  // Le changement d'Awa, puis un second : refusé.
  r = await changer({ adresse: 'awa-chic' });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await r.json(), { adresse: 'awa-chic', ancienne: 'awa-traore-diallo' });
  r = await changer({ adresse: 'awa-elegance' });
  assert.equal(r.status, 409);
  const json = await r.json();
  assert.equal(json.resultat, 'deja_change');
  assert.match(json.error, /n’est possible qu’une fois/);
  assert.equal(etat.stores[0].slug, 'awa-chic');
  assert.deepEqual(etat.store_slug_aliases.map((a) => [a.slug, a.store_id]), [['chez-moussa', 's2'], ['awa-traore-diallo', 's1']]);
});

test('POST /api/reseller/boutique/adresse : appel d’un autre site, aperçu administrateur, autre profil et option absente → rien ne change, jamais 500', async () => {
  baseAwa();
  let r = await changer({ adresse: 'awa-mode' }, { 'sec-fetch-site': 'cross-site' });
  assert.equal(r.status, 403);
  r = await changer({ adresse: 'awa-mode' }, { 'sec-fetch-site': 'same-site' });
  assert.equal(r.status, 403);
  sessionCourante = revendeur('rev-1', { apercu: { depuis: { uid: 'admin-1', phone: '+22300000001' } } });
  r = await changer({ adresse: 'awa-mode' });
  assert.equal(r.status, 403);
  assert.match((await r.json()).error, /Aperçu : rien n’est enregistré/);
  for (const s of [null, revendeur('rev-1', { role: 'customer' }), revendeur('rev-1', { role: 'supplier' })]) {
    sessionCourante = s;
    assert.equal((await changer({ adresse: 'awa-mode' })).status, 401);
  }
  sessionCourante = revendeur('rev-9');
  assert.equal((await changer({ adresse: 'awa-mode' })).status, 404, 'compte sans boutique');
  assert.deepEqual(ecritures(), []);
  assert.equal(etat.stores[0].slug, 'awa-traore-diallo');

  // Même origine (en-tête présent) : accepté.
  sessionCourante = revendeur('rev-1');
  assert.equal((await changer({ adresse: 'awa-mode' }, { 'sec-fetch-site': 'same-origin' })).status, 200);

  // AVANT le SQL : 409 « Option pas encore activée », pour chaque code d'absence.
  for (const code of ['PGRST202', '42883', '42P01', 'PGRST205']) {
    baseAwa({ migree: false });
    fautes['rpc:changer_adresse_boutique'] = code;
    r = await changer({ adresse: 'awa-mode' });
    assert.equal(r.status, 409, code);
    assert.deepEqual(await r.json(), { error: 'Option pas encore activée (mise à jour de la base à appliquer).', resultat: 'indisponible' });
    assert.equal(etat.stores[0].slug, 'awa-traore-diallo');
  }
  // Panne : 503, rien n'a changé.
  baseAwa();
  fautes['rpc:changer_adresse_boutique'] = '57014';
  r = await changer({ adresse: 'awa-mode' });
  assert.equal(r.status, 503);
  assert.match((await r.json()).error, /Changement d’adresse impossible pour le moment/);

  // La route : identité de la session seulement, POST protégé, aucune table d'articles.
  const route = sansCommentaires(lire('src/app/api/reseller/boutique/adresse/route.ts'));
  assert.match(route, /changerAdresse\(boutique\.id, session\.uid, brute\)/);
  assert.match(route, /boutiqueDuProprietaire\('reseller', session\.uid\)/);
  assert.equal((route.match(/sessionAvecRole\(req, 'reseller'\)/g) || []).length, 2);
  assert.match(route, /site && site !== 'same-origin'/);
  assert.match(route, /adresseDepuis\(brute\) !== brute/);
  assert.doesNotMatch(route, /reseller_shop_items|store_products|\.from\(|getSupabaseAdmin/);
  assert.doesNotMatch(route, /export async function (PUT|PATCH|DELETE)/);
});

// ── 8. Écran « Personnaliser » : section « Adresse de ma boutique » ─────────

// Pas de DOM dans node:test : l'écran est appelé comme une fonction, avec des
// crochets React SIMULÉS pour lui seul (état gardé entre deux appels, effets de
// montage rejoués à la main). Ses appels réseau arrivent aux VRAIES routes.
const PAGE_PERSONNALISER = path.join(RACINE, 'src/app/reseller/boutique/page.tsx');
const SECTION_ADRESSE = path.join(RACINE, 'src/components/reseau/AdresseBoutique.tsx');
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
  if (demande === 'react' && parent && (parent.filename === PAGE_PERSONNALISER || parent.filename === SECTION_ADRESSE)) return fauxReact;
  return chargerOriginal.call(this, demande, parent, ...reste);
};
/** Éléments de l'arbre rendu (enfants et emplacements `action`), sans exécuter les composants. */
function trouver(noeud, critere, resultats = []) {
  if (Array.isArray(noeud)) { noeud.forEach((n) => trouver(n, critere, resultats)); return resultats; }
  if (!noeud || typeof noeud !== 'object' || !noeud.props) return resultats;
  if (critere(noeud)) resultats.push(noeud);
  trouver(noeud.props.children, critere, resultats);
  if (noeud.props.action) trouver(noeud.props.action, critere, resultats);
  return resultats;
}
const texteDe = (element) => renderToStaticMarkup(element).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
function monter(fichier, proprietes) {
  const valeurs = []; const setters = []; const refs = []; let curseur = 0; let curseurRef = 0; let effets = [];
  const mesCrochets = {
    useState(init) {
      const k = curseur++;
      if (!(k in valeurs)) valeurs[k] = typeof init === 'function' ? init() : init;
      setters[k] ||= (v) => { valeurs[k] = typeof v === 'function' ? v(valeurs[k]) : v; };
      return [valeurs[k], setters[k]];
    },
    useRef(init) { const k = curseurRef++; refs[k] ||= { current: init }; return refs[k]; },
    useEffect(f) { effets.push(f); },
  };
  const Composant = require(fichier).default;
  const attendre = async () => { for (let i = 0; i < 30; i++) await new Promise((r) => setImmediate(r)); };
  const rendre = () => { crochets = mesCrochets; curseur = 0; curseurRef = 0; effets = []; return Composant(proprietes); };
  const du = (arbre, nom) => trouver(arbre, (e) => typeof e.type === 'function' && e.type.name === nom);
  return {
    rendre, attendre, du,
    async monter() { rendre(); effets.forEach((f) => f()); await attendre(); return rendre(); },
    champ: (arbre, id) => trouver(arbre, (e) => e.props.id === id)[0],
    cadre: (arbre, id) => trouver(arbre, (e) => typeof e.type === 'function' && e.type.name === 'Field' && e.props.htmlFor === id)[0],
    bouton: (arbre, libelle) => trouver(arbre, (e) => typeof e.type === 'function' && e.type.name === 'Button' && texteDe(e) === libelle)[0],
  };
}
/** fetch du navigateur → les vraies routes, avec la session simulée. */
function brancherRoutes(appels) {
  global.fetch = async (url, init = {}) => {
    const methode = init.method || 'GET';
    appels.push([methode, String(url), init.body ?? null]);
    const route = ROUTES[String(url).split('?')[0]];
    assert.ok(route, `appel inattendu : ${url}`);
    const r = await require(route)[methode](requete(String(url), { method: methode, ...(init.body ? { body: init.body } : {}) }));
    return { ok: r.status >= 200 && r.status < 300, status: r.status, json: () => r.json() };
  };
}

test('Section « Adresse de ma boutique » : adresse proposée, aperçu de la nouvelle adresse, avertissement « une seule fois », bouton ; après le changement, plus rien à faire', () => {
  const proprietes = { origine: 'https://app.sugubaml.com', actuelle: 'awa-traore-diallo', ancienne: null, nomPublic: 'Awa Mode', onChange() {} };
  const section = monter(SECTION_ADRESSE, proprietes);
  let arbre = section.rendre();
  const html = renderToStaticMarkup(arbre);
  assert.match(html, /Adresse de ma boutique/);
  assert.match(html, /Aujourd’hui : <span[^>]*>app\.sugubaml\.com\/boutique\/awa-traore-diallo<\/span>/);
  assert.equal(section.champ(arbre, 'adresse-boutique').props.value, 'awa-mode', 'proposée à partir de l’enseigne');
  assert.match(html, /Vos clients ouvriront : <strong[^>]*>app\.sugubaml\.com\/boutique\/awa-mode<\/strong>/);
  assert.match(html, /<strong>Une seule fois\.<\/strong> Vous ne pourrez plus changer d’adresse ensuite, ni revenir à l’ancienne\./);
  assert.match(html, /Votre ancienne adresse et vos QR codes déjà partagés continuent d’ouvrir votre boutique\./);
  assert.match(html, /<button[^>]*>Changer mon adresse<\/button>/);
  assert.equal((html.match(/<button/g) || []).length, 1, 'une seule action');
  assert.match(html, /id="adresse"/);
  assert.equal(section.bouton(arbre, 'Changer mon adresse').props.disabled, false);
  assert.equal(section.bouton(arbre, 'Changer mon adresse').props.variant, 'ghost', 'pas l’action principale de l’écran (la barre d’enregistrement)');

  // Ce que le revendeur tape est montré tel qu'il sera enregistré ; un refus est dit sous le champ.
  section.champ(arbre, 'adresse-boutique').props.onChange({ target: { value: 'Chez Awa — Mode & Beauté' } });
  arbre = section.rendre();
  assert.match(renderToStaticMarkup(arbre), /app\.sugubaml\.com\/boutique\/chez-awa-mode-beaute/);
  assert.equal(section.cadre(arbre, 'adresse-boutique').props.erreur, undefined);
  for (const [saisie, raison] of [['Suguba Officiel', /réservée à Suguba/], ['ab', /Au moins 3 caractères/], ['awa 76 12 34 56', /numéro de téléphone/], ['Awa Traoré Diallo', /déjà l’adresse de votre boutique/]]) {
    section.champ(arbre, 'adresse-boutique').props.onChange({ target: { value: saisie } });
    arbre = section.rendre();
    assert.match(section.cadre(arbre, 'adresse-boutique').props.erreur, raison, saisie);
    assert.equal(section.bouton(arbre, 'Changer mon adresse').props.disabled, true, saisie);
    assert.doesNotMatch(renderToStaticMarkup(arbre), /Vos clients ouvriront/, 'pas d’aperçu d’une adresse refusée');
  }
  // Champ vide : pas d'erreur affichée, bouton inactif.
  section.champ(arbre, 'adresse-boutique').props.onChange({ target: { value: '' } });
  arbre = section.rendre();
  assert.equal(section.cadre(arbre, 'adresse-boutique').props.erreur, undefined);
  assert.equal(section.bouton(arbre, 'Changer mon adresse').props.disabled, true);

  // Sans enseigne : rien n'est proposé, le revendeur écrit son adresse.
  arbre = monter(SECTION_ADRESSE, { ...proprietes, nomPublic: null }).rendre();
  assert.equal(trouver(arbre, (e) => e.props.id === 'adresse-boutique')[0].props.value, '');

  // Changement déjà fait : l'état, l'ancienne adresse qui fonctionne toujours, ni champ ni bouton.
  const faite = renderToStaticMarkup(monter(SECTION_ADRESSE, { ...proprietes, actuelle: 'awa-mode', ancienne: 'awa-traore-diallo' }).rendre());
  assert.match(faite, /app\.sugubaml\.com\/boutique\/awa-mode/);
  assert.match(faite, /Adresse changée/);
  assert.match(faite, /Votre ancienne adresse \(<span[^>]*>app\.sugubaml\.com\/boutique\/awa-traore-diallo<\/span>\) et vos QR codes déjà partagés ouvrent toujours votre boutique\./);
  assert.doesNotMatch(faite, /<input|<button/);
});

test('Section (comportement) : vérifie que l’adresse est libre, demande confirmation en annonçant la conséquence, puis change ; adresse prise ou refus : rien n’est envoyé', async () => {
  const appels = [];
  brancherRoutes(appels);
  try {
    baseAwa();
    const changements = [];
    const section = monter(SECTION_ADRESSE, {
      origine: 'https://app.sugubaml.com', actuelle: 'awa-traore-diallo', ancienne: null, nomPublic: 'Awa Mode', onChange: (...a) => changements.push(a),
    });
    let arbre = section.rendre();

    // Adresse prise : dit sous le champ, sans confirmation ni changement.
    section.champ(arbre, 'adresse-boutique').props.onChange({ target: { value: 'Chez Moussa' } });
    arbre = section.rendre();
    await section.bouton(arbre, 'Changer mon adresse').props.onClick();
    arbre = section.rendre();
    assert.equal(section.cadre(arbre, 'adresse-boutique').props.erreur, 'Cette adresse est déjà prise. Essayez-en une autre.');
    assert.deepEqual(appels.map((a) => a[0]), ['GET']);
    assert.deepEqual(confirmations, []);
    // Écrire de nouveau efface le message du serveur.
    section.champ(arbre, 'adresse-boutique').props.onChange({ target: { value: 'Awa Mode' } });
    arbre = section.rendre();
    assert.equal(section.cadre(arbre, 'adresse-boutique').props.erreur, undefined);

    // Confirmation refusée : rien n'est envoyé.
    appels.length = 0;
    reponseConfirmation = false;
    await section.bouton(arbre, 'Changer mon adresse').props.onClick();
    assert.deepEqual(appels.map((a) => [a[0], a[1]]), [['GET', '/api/reseller/boutique/adresse?adresse=awa-mode']]);
    assert.equal(confirmations.length, 1);
    assert.equal(confirmations[0].titre, 'Changer l’adresse de votre boutique ?');
    assert.match(confirmations[0].message, /Nouvelle adresse : app\.sugubaml\.com\/boutique\/awa-mode/);
    assert.match(confirmations[0].message, /Vous ne pourrez plus la changer ensuite, ni revenir à l’ancienne/);
    assert.match(confirmations[0].message, /QR codes déjà partagés continueront d’ouvrir votre boutique/);
    assert.equal(confirmations[0].danger, true, 'action sans retour');
    assert.equal(etat.stores[0].slug, 'awa-traore-diallo');
    assert.deepEqual(changements, []);
    assert.equal(section.bouton(section.rendre(), 'Changer mon adresse').props.loading, false);

    // Confirmation acceptée : seule l'adresse confirmée est envoyée.
    appels.length = 0;
    reponseConfirmation = true;
    await section.bouton(section.rendre(), 'Changer mon adresse').props.onClick();
    assert.deepEqual(appels.map((a) => [a[0], a[1], a[2]]), [
      ['GET', '/api/reseller/boutique/adresse?adresse=awa-mode', null],
      ['POST', '/api/reseller/boutique/adresse', '{"adresse":"awa-mode"}'],
    ]);
    assert.equal(etat.stores[0].slug, 'awa-mode');
    assert.deepEqual(changements, [['awa-mode', 'awa-traore-diallo']]);
    assert.deepEqual(messages.at(-1), ['Adresse changée. L’ancienne mène toujours à votre boutique.', { ton: 'succes' }]);

    // Le serveur refuse au dernier moment (adresse prise entre la vérification et le changement) : le message reste sous le champ.
    baseAwa();
    const tardive = monter(SECTION_ADRESSE, { origine: 'http://localhost', actuelle: 'awa-traore-diallo', ancienne: null, nomPublic: 'Awa Mode', onChange: (...a) => changements.push(a) });
    const lecture = global.fetch;
    global.fetch = async (url, init = {}) => {
      if ((init.method || 'GET') === 'POST') etat.stores[1].slug = 'awa-mode';
      return lecture(url, init);
    };
    await tardive.bouton(tardive.rendre(), 'Changer mon adresse').props.onClick();
    assert.equal(tardive.cadre(tardive.rendre(), 'adresse-boutique').props.erreur, 'Cette adresse est déjà prise. Essayez-en une autre.');
    assert.equal(etat.stores[0].slug, 'awa-traore-diallo');
    assert.equal(changements.length, 1, 'aucun changement annoncé');
    // Réseau coupé : un message, le bouton redevient utilisable.
    global.fetch = async () => { throw new Error('hors ligne'); };
    await tardive.bouton(tardive.rendre(), 'Changer mon adresse').props.onClick();
    assert.match(tardive.cadre(tardive.rendre(), 'adresse-boutique').props.erreur, /Vérifiez votre connexion/);
    assert.equal(tardive.bouton(tardive.rendre(), 'Changer mon adresse').props.loading, false);
  } finally { global.fetch = RESEAU_INTERDIT; }
});

test('Personnaliser : la section n’existe qu’avec l’option ; après un changement, le lien, le QR et l’adresse affichés suivent sans recharger', async () => {
  const appels = [];
  brancherRoutes(appels);
  global.window = { location: { origin: 'https://app.sugubaml.com', hash: '' } };
  global.document = { getElementById: () => null };
  try {
    const sections = (arbre) => trouver(arbre, (e) => typeof e.type === 'function' && e.type.name === 'AdresseBoutique');
    const adresseAffichee = (ecran, arbre) => texteDe(React.createElement('div', null, ecran.du(arbre, 'StatCard').map((c, i) => React.createElement(c.type, { ...c.props, key: i }))));

    // AVANT le SQL : la page du lot 7, sans section ni mention d'un changement possible.
    baseAwa({ migree: false });
    let ecran = monter(PAGE_PERSONNALISER);
    let arbre = await ecran.monter();
    assert.ok(ecran.champ(arbre, 'nom-boutique'), 'la page est chargée');
    assert.equal(sections(arbre).length, 0);
    assert.match(adresseAffichee(ecran, arbre), /app\.sugubaml\.com\/boutique\/awa-traore-diallo Ne change pas avec le nom/);
    assert.deepEqual(appels.map((a) => a[1]), ['/api/reseller/boutique'], 'aucune requête de plus');

    // APRÈS le SQL : la section, avec l'adresse proposée par l'enseigne.
    baseAwa();
    appels.length = 0;
    ecran = monter(PAGE_PERSONNALISER);
    arbre = await ecran.monter();
    assert.equal(sections(arbre).length, 1);
    const { onChange, ...proprietes } = sections(arbre)[0].props;
    assert.deepEqual(proprietes, { origine: 'https://app.sugubaml.com', actuelle: 'awa-traore-diallo', ancienne: null, nomPublic: 'Awa Mode' });
    assert.match(adresseAffichee(ecran, arbre), /Modifiable une fois, plus bas/);
    assert.deepEqual(appels.map((a) => a[1]), ['/api/reseller/boutique'], 'l’état de l’adresse arrive avec la boutique : aucune requête de plus');
    assert.equal(ecran.du(arbre, 'CarteLien')[0].props.url, 'https://app.sugubaml.com/boutique/awa-traore-diallo');

    // Le changement est annoncé à la page : tout suit, la barre d'enregistrement ne s'allume pas.
    onChange('awa-mode', 'awa-traore-diallo');
    arbre = ecran.rendre();
    assert.deepEqual([sections(arbre)[0].props.actuelle, sections(arbre)[0].props.ancienne], ['awa-mode', 'awa-traore-diallo']);
    assert.equal(ecran.du(arbre, 'CarteLien')[0].props.url, 'https://app.sugubaml.com/boutique/awa-mode');
    assert.equal(ecran.du(arbre, 'CarteLien')[0].props.lienOuvrir, '/boutique/awa-mode');
    assert.match(ecran.du(arbre, 'CarteLien')[0].props.texteWhatsApp, /app\.sugubaml\.com\/boutique\/awa-mode$/);
    assert.match(adresseAffichee(ecran, arbre), /app\.sugubaml\.com\/boutique\/awa-mode Changée une fois : définitive/);
    assert.equal(ecran.du(arbre, 'BarreEnregistrement')[0].props.modifie, false);

    // Boutique encore au nom du compte : rien n'est proposé (le changement unique ne se gaspille pas sur « awa-d »).
    baseAwa();
    etat.stores[0].name = 'Awa Traoré Diallo';
    ecran = monter(PAGE_PERSONNALISER);
    arbre = await ecran.monter();
    assert.equal(sections(arbre)[0].props.nomPublic, null);
    // Changement déjà fait avant l'ouverture de la page.
    baseAwa();
    etat.stores[0].slug = 'awa-mode';
    etat.store_slug_aliases = [{ slug: 'awa-traore-diallo', store_id: 's1' }];
    ecran = monter(PAGE_PERSONNALISER);
    arbre = await ecran.monter();
    assert.deepEqual([sections(arbre)[0].props.actuelle, sections(arbre)[0].props.ancienne], ['awa-mode', 'awa-traore-diallo']);
  } finally { global.fetch = RESEAU_INTERDIT; delete global.window; delete global.document; }

  const source = sansCommentaires(lire('src/app/reseller/boutique/page.tsx'));
  assert.match(source, /setOptionAdresse\(Boolean\(data\.options\?\.adresse\)\);/);
  assert.equal((source.match(/\{optionAdresse && \(/g) || []).length, 1, 'une seule section, sous condition');
  assert.equal((source.match(/<AdresseBoutique/g) || []).length, 1);
  assert.equal(source.split('{optionReglages && (').length - 1, 2, 'les deux blocs du lot 6 sont intacts');
  assert.doesNotMatch(source, /Ne change jamais/);
});

// ── 9. Contact : la bulle du support Suguba, jamais le WhatsApp du revendeur ─

test('Bulle du support Suguba : affichée sur /boutique/<adresse> comme sur /r/ et /s/ ; pas sur l’annuaire ni les écrans de gestion ; au-dessus de la barre du bas d’un revendeur', () => {
  const Bulle = require('../src/components/common/WhatsAppFloatingButton.tsx').default;
  const rendre = (adresse) => { chemin = adresse; return renderToStaticMarkup(React.createElement(Bulle)); };
  try {
    for (const visible of ['/boutique/awa-mode', '/boutique/suguba', '/r/AWA1', '/s/grossiste', '/rejoindre']) {
      const html = rendre(visible);
      assert.match(html, /aria-label="Contacter le support sur WhatsApp"/, visible);
    }
    for (const masquee of ['/boutiques', '/boutique', '/', '/reseller/boutique', '/reseller/boutique/articles', '/reseller/ma-boutique', '/p/pagne-wax', '/panier', '/compte/boutiques']) {
      assert.equal(rendre(masquee), '', masquee);
    }
    // Client ou visiteur : sa barre du bas disparaît dès 768 px, la bulle redescend (comme avant).
    for (const profil of [null, 'customer', 'admin']) {
      profilNavigateur = profil;
      assert.match(rendre('/boutique/awa-mode'), /class="fixed bottom-\[calc\(6rem\+env\(safe-area-inset-bottom,0px\)\)\] md:bottom-6 right-4 z-50"/, String(profil));
    }
    // Revendeur (le propriétaire sur sa vitrine), fournisseur, livreur : leur barre du bas reste
    // affichée à toutes les largeurs — la bulle ne redescend jamais dessus.
    for (const profil of ['reseller', 'supplier', 'driver']) {
      profilNavigateur = profil;
      const html = rendre('/boutique/awa-mode');
      assert.match(html, /bottom-\[calc\(6rem\+env\(safe-area-inset-bottom,0px\)\)\]/, profil);
      assert.doesNotMatch(html, /md:bottom-6/, profil);
    }
  } finally { chemin = '/'; profilNavigateur = null; }
  // C'est le numéro du support Suguba, écrit dans le composant : rien n'est lu de la boutique.
  const source = sansCommentaires(lire('src/components/common/WhatsAppFloatingButton.tsx'));
  assert.match(source, /const VISIBLE_SUR_PREFIXE = \['\/s\/', '\/r\/', '\/boutique\/'\];/);
  assert.match(source, /const supportPhone = '22389460000';/);
  assert.doesNotMatch(source, /props|boutique\.whatsapp|fetch\(/);
  assert.match(lire('src/app/layout.tsx'), /<WhatsAppFloatingButton \/>/);
  // Même liste de profils que la barre du bas : sinon la bulle recouvrirait un onglet.
  const liste = (fichier, motif) => sansCommentaires(lire(fichier)).match(motif)[1];
  assert.equal(
    liste('src/components/common/WhatsAppFloatingButton.tsx', /const ROLES_BARRE_PERMANENTE = (\[[^\]]+\]);/),
    liste('src/components/common/BottomNav.tsx', /const navigationMetier = (\[[^\]]+\])\.includes\(role \|\| ''\);/),
  );
});

test('Vitrine : jamais le WhatsApp du revendeur ni de bouton « Écrire à … », même s’il est enregistré ; PATCH l’ignore toujours', async () => {
  baseAwa();
  etat.stores[0].whatsapp = '+22376123456';
  for (const s of [null, revendeur('rev-1')]) {
    sessionCourante = s;
    const html = renderToStaticMarkup(await ouvrir('awa-traore-diallo'));
    assert.doesNotMatch(html, /76123456|76 12 34 56|wa\.me\/223|api\.whatsapp\.com\/send\?phone=22376/, 'le numéro du revendeur n’est pas dans la page');
    assert.doesNotMatch(html, /Écrire à/);
  }
  // Décision du fondateur : pas de WhatsApp du revendeur pour l'instant.
  sessionCourante = revendeur('rev-1');
  const r = await appeler('PATCH', '/api/reseller/boutique', { whatsapp: '+22370000000', accroche: 'Bonjour' });
  assert.equal(r.status, 200);
  assert.equal(etat.stores[0].whatsapp, '+22376123456', 'ni écrit ni effacé');
  const vitrine = sansCommentaires(lire('src/components/shop/ShopView.tsx'));
  assert.doesNotMatch(vitrine, /boutique\.whatsapp|Écrire à/);
  assert.doesNotMatch(sansCommentaires(lire('src/app/boutique/[slug]/page.tsx')), /whatsapp/i);
  assert.doesNotMatch(sansCommentaires(lire('src/app/reseller/boutique/page.tsx')), /Mon numéro WhatsApp|whatsapp:/);
});

// ── 10. Garde-fous du chantier, fichier SQL, guide ──────────────────────────

test('Garde-fous : rien de privé ni « À la une » dans les nouveaux fichiers ; règles pures sans accès à la base ; un seul fichier SQL, commentaire d’adresse à jour', () => {
  const nouveaux = ['src/lib/adresse-boutique.ts', 'src/components/reseau/AdresseBoutique.tsx', 'src/app/api/reseller/boutique/adresse/route.ts'];
  for (const f of nouveaux) {
    const source = lire(f);
    assert.doesNotMatch(source, /À la une/i, f);
    assert.doesNotMatch(source, /reseller_commission|supplier_price|prix de gros|localStorage|sessionStorage/i, f);
    assert.match(source, /\(lot 8 du chantier boutique,\s+\*?\s*2026-10-03\)|lot 8 du chantier boutique, 2026-10-03/, `${f} : commentaire daté`);
  }
  const regles = sansCommentaires(lire('src/lib/adresse-boutique.ts'));
  assert.doesNotMatch(regles, /supabase|getSupabaseAdmin|fetch\(|process\.env/, 'règles pures');
  const section = lire('src/components/reseau/AdresseBoutique.tsx');
  assert.match(section, /^'use client';/);
  assert.doesNotMatch(sansCommentaires(section), /<button|className="[^"]*\bbg-emerald|font-black|text-\[1[0-2]px\]/, 'boutons par <Button>, palette et tailles du design system');
  assert.match(sansCommentaires(section), /body: JSON\.stringify\(\{ adresse: apercu \}\)/, 'le corps ne porte que l’adresse');

  // Les commentaires « l'adresse ne change jamais » sont à jour.
  const boutiques = lire('src/lib/reseau/boutiques.ts');
  assert.doesNotMatch(boutiques, /n'est attribuée qu'UNE fois : la renommer casserait/);
  assert.match(boutiques, /son propriétaire peut la changer UNE fois \(changerAdresse\)/);
  assert.doesNotMatch(lire('src/app/reseller/boutique/page.tsx'), /n'est\s+\*?\s*jamais renommée/);
  assert.match(lire('supabase/migration-reseau-v1.sql'), /son propriétaire peut la changer UNE fois ; l''ancienne adresse redirige vers la nouvelle\.';/);
  assert.doesNotMatch(lire('supabase/migration-reseau-v1.sql'), /Attribuée une fois, jamais modifiée/);

  // Toujours UN fichier SQL pour le chantier ; le commentaire de la colonne suit, sans rien modifier d'autre.
  assert.deepEqual(fs.readdirSync(path.join(RACINE, 'supabase')).filter((f) => f.startsWith('A-EXECUTER-2026-10-03')), [SQL]);
  const sql = lire(`supabase/${SQL}`);
  assert.match(sql, /COMMENT ON COLUMN public\.stores\.slug IS\s+'Adresse publique \/boutique\/<slug>\.[^;]*changer UNE fois[^;]*store_slug_aliases[^;]*';/);
  assert.match(sql, /section « Adresse de ma boutique » dans « Personnaliser » \(lot 8\)/);
  assert.doesNotMatch(sql, /L'écran viendra au lot 8/);
  const executable = sql.replace(/--[^\n]*/g, '');
  assert.doesNotMatch(executable, /reseller_shop_items|store_products|\bDROP\b|\bDELETE FROM\b|\bTRUNCATE\b/i);
  assert.doesNotMatch(executable, /GRANT[^;]*\b(?:anon|authenticated)\b/i);

  // La vitrine : redirection permanente, dans la page ET dans l'aperçu de lien.
  const vitrine = sansCommentaires(lire('src/app/boutique/[slug]/page.tsx'));
  assert.equal((vitrine.match(/if \('deplacee' in charge\) permanentRedirect\(adresseDeRedirection\(charge\.deplacee, \(await searchParams\) \|\| \{\}\)\);/g) || []).length, 2);
  assert.match(vitrine, /if \(boutique\.ancienneAdresse\) return boutique\.statut === 'active' \? \{ deplacee: boutique\.slug \} : null;/);
  // /r/<code> ne redirige toujours pas (balise canonical seulement, décision du fondateur).
  assert.doesNotMatch(sansCommentaires(lire('src/app/r/[code]/page.tsx')), /permanentRedirect|redirect\(/);
});

test('Guide et fiche de reprise : le lot 8 au journal, juste avant la relecture du lot 7, avec la demande du fondateur et ses écarts ; fiches « Personnaliser » et vitrine à jour', () => {
  const guide = JSON.parse(lire('docs/guide/guide.json'));
  assert.equal(guide.majLe, '2026-10-03');
  // Une relecture de ce lot passera devant cette entrée : elle est cherchée par son titre.
  const rang = guide.journal.findIndex((j) => j.titre === 'Boutique revendeur, lot 8 : adresse à l’enseigne et contact');
  assert.ok(rang >= 0, 'entrée du lot 8');
  const entree = guide.journal[rang];
  assert.equal(guide.journal[rang + 1].titre, 'Boutique revendeur, lot 7 : corrections de relecture', 'juste avant la relecture du lot 7');
  assert.equal(entree.date, '2026-10-03');
  assert.equal(entree.statut, 'en local');
  assert.match(entree.demande, /^« .*Ma boutique.*doit montrer la boutique elle-même.*sentiment d’appropriation\. »$/);
  assert.ok(entree.realise.length >= 5);
  assert.ok(entree.ecarts.length >= 4);
  for (const id of ['rev-boutique', 'vitrine-boutique']) assert.ok(entree.pages.includes(id), id);
  for (const id of entree.pages) assert.ok(guide.pages.some((p) => p.id === id), id);
  const ecarts = entree.ecarts.join('\n');
  assert.ok(ecarts.includes(`supabase/${SQL}`), 'le fichier SQL dont dépend la section');
  assert.match(ecarts, /Aucun nouveau fichier SQL/);
  assert.match(ecarts, /WhatsApp du revendeur : PAS fait, selon votre décision/);
  assert.match(ecarts, /à vérifier sur la copie locale \[QA\] avec un vrai téléphone/);
  const realise = entree.realise.join('\n');
  assert.match(realise, /UNE seule fois/);
  assert.match(realise, /support Suguba/);
  assert.match(realise, /L’ancienne adresse redirige pour toujours vers la nouvelle/);
  assert.doesNotMatch(JSON.stringify(entree), /À la une/);
  // L'entrée du lot 6 ne dit plus qu'aucun écran ne se sert du changement d'adresse.
  const lot6 = guide.journal.find((j) => j.titre === 'Boutique revendeur, lot 6 : rayons personnalisés et annonce datée');
  assert.doesNotMatch(lot6.ecarts.join('\n'), /aucun écran ne s’en sert encore/);
  assert.match(lot6.ecarts.join('\n'), /livré au lot 8/);

  const fiche = (id) => guide.pages.find((p) => p.id === id);
  const personnaliser = fiche('rev-boutique');
  const adresse = personnaliser.elements.find((e) => e.nom === 'Adresse de ma boutique');
  assert.ok(adresse, 'élément « Adresse de ma boutique »');
  assert.match(adresse.role, /une seule fois/i);
  assert.match(adresse.role, /ancienne adresse/);
  assert.match(adresse.role, /Après le SQL du lot 6 seulement/);
  assert.doesNotMatch(JSON.stringify(personnaliser), /qui ne change jamais/);
  const vitrine = fiche('vitrine-boutique');
  assert.ok(vitrine.elements.some((e) => /Ancienne adresse/.test(e.nom) && /redirig/.test(e.role)));
  assert.ok(vitrine.elements.some((e) => /Besoin d’aide|support Suguba/.test(e.nom) && /WhatsApp/.test(e.role) && /Jamais le numéro du revendeur/.test(e.role)));

  const ligne = lire('REPRISE.md').split('\n').find((l) => l.startsWith('> **') && /boutique revendeur, lot 8 « Adresse à l’enseigne et contact »/.test(l));
  assert.ok(ligne, 'ligne du lot 8 dans REPRISE.md');
  for (const repere of ['changerAdresse', 'store_slug_aliases', 'adressesDejaPortees', 'permanentRedirect', 'Aucun nouveau SQL']) assert.ok(ligne.includes(repere), repere);
});
