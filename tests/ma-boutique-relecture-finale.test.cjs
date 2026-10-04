// TEST-BOUTIQUE-FINALE-001..0xx (chantier boutique du revendeur, 2026-10-04,
// relecture finale avant la mise en ligne). Six constats, tous vérifiés dans le code :
//  A. carte produit : container-type sur l'<article> enfermait la fenêtre « Affiche
//     pour mon statut » (fixed, sans portail) sur les navigateurs d'avant fin 2024 ;
//  B. nom du compte changé : l'ancien nom complet d'une boutique passait pour une
//     enseigne et s'affichait en clair ;
//  C. nom de compte réservé à Suguba : « La sélection de Suguba » ;
//  D. boutique revendeur créée par l'équipe ou par « Mes boutiques » : nom complet
//     dans stores.name et dans l'adresse ;
//  E. visite-boutique : aucun plafond, navigateur déclaré choisi par l'appelant,
//     appel possible depuis un autre site ;
//  F. sélection illisible prise pour une sélection vide : l'enregistrement du
//     fournisseur retirait tous les articles de sa boutique supplémentaire.
// Contre-relecture du correctif (même jour) :
//  G. aperçu administrateur (« Se connecter en tant que revendeur ») : le 403 ajouté
//     à PATCH /api/reseller/me bloquait le démarrage dès la première étape.
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
process.env.SESSION_SECRET = 'secret-de-test-relecture-finale';

// ── Base simulée : chaque opération est enregistrée avec ses filtres ─────────
// `fautes['table:op']` : un code d'erreur, ou une fonction (opération) → code | null
// pour ne faire échouer qu'UNE lecture ou qu'UNE écriture parmi plusieurs.
let etat; let fautes; let operations; let serie;
function reinitialiser() {
  etat = {
    stores: [], store_slug_aliases: [], profiles: [], profile_roles: [], reseller_shop_items: [], store_products: [], products: [],
    reseller_prices: [], store_plans: [], platform_settings: [], suppliers: [], analytics_events: [], tracking_links: [], admin_team_members: [],
  };
  fautes = {}; operations = []; serie = 1;
}
const valeur = (r, k) => {
  if (k.includes('->>')) { const [colonne, cle] = k.split('->>'); return r[colonne] ? r[colonne][cle] : undefined; }
  return r[k];
};
const comparer = (a, b) => (typeof a === 'number' && typeof b === 'number' ? a - b : String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0);
const db = {
  from(table) {
    let op = 'select'; let patch; const filtres = []; const egalites = {}; const dans = {}; let un = false; let exige = false; let tete = false; let limite = null; let tri = null;
    const q = {
      select(_colonnes, options) { if (options && options.head) tete = true; return q; },
      eq(k, v) { egalites[k] = v; filtres.push((r) => valeur(r, k) === v); return q; },
      neq(k, v) { filtres.push((r) => valeur(r, k) !== v); return q; },
      gt(k, v) { filtres.push((r) => Number(valeur(r, k)) > Number(v)); return q; },
      gte(k, v) { filtres.push((r) => String(valeur(r, k)) >= String(v)); return q; },
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
      single() { un = true; exige = true; return q; },
      then(resolve, reject) {
        const operation = { table, op, patch, egalites, dans };
        operations.push(operation);
        const repondre = (r) => Promise.resolve(r).then(resolve, reject);
        const regle = fautes[`${table}:${op}`];
        const code = typeof regle === 'function' ? regle(operation) : regle;
        if (code) return repondre({ data: null, count: null, error: { code, message: `faute simulée ${code}` } });
        let lignes = (etat[table] || []).filter((r) => filtres.every((f) => f(r)));
        if (tri) lignes = [...lignes].sort((a, b) => comparer(a[tri.k], b[tri.k]) * (tri.asc ? 1 : -1));
        if (op === 'insert' || op === 'upsert') {
          const maintenant = new Date().toISOString();
          lignes = (Array.isArray(patch) ? patch : [patch]).map((p) => ({ id: `n${serie++}`, created_at: maintenant, added_at: maintenant, occurred_at: maintenant, ...p }));
          (etat[table] ||= []).push(...lignes);
        }
        if (op === 'update') lignes.forEach((r) => Object.assign(r, JSON.parse(JSON.stringify(patch))));
        if (op === 'delete') etat[table] = (etat[table] || []).filter((r) => !lignes.includes(r));
        if (limite !== null && op === 'select') lignes = lignes.slice(0, limite);
        if (exige && !lignes[0]) return repondre({ data: null, count: 0, error: { code: 'PGRST116', message: 'aucune ligne' } });
        const data = tete ? null : un ? (lignes[0] ? { ...lignes[0] } : null) : lignes.map((r) => ({ ...r }));
        return repondre({ data, count: lignes.length, error: null });
      },
    };
    return q;
  },
  async rpc() { return { data: null, error: null }; },
};
const ecritures = () => operations.filter((o) => o.op !== 'select');
const sur = (table, op) => operations.filter((o) => o.table === table && (!op || o.op === op));
require.cache[require.resolve('../src/lib/supabase-admin.ts')] = { exports: { getSupabaseAdmin: () => db } };

let sessionCourante = null;
require.cache[require.resolve('../src/lib/active-session.ts')] = { exports: { verifyActiveSession: async () => sessionCourante } };
const vraieSession = require('../src/lib/session.ts');
require.cache[require.resolve('../src/lib/session.ts')] = { exports: { ...vraieSession, verifySessionToken: async () => sessionCourante } };
require.cache[require.resolve('next/headers')] = {
  exports: { cookies: async () => ({ get: (nom) => (nom === vraieSession.SESSION_COOKIE_NAME ? { value: 'jeton-simule' } : undefined) }) },
};
let navigations = [];
require.cache[require.resolve('next/navigation')] = {
  exports: { notFound: () => { throw new Error('page introuvable'); }, usePathname: () => '/', useRouter: () => ({ push(url) { navigations.push(url); }, replace() {}, refresh() {} }), useSearchParams: () => new URLSearchParams('') },
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
const session = (uid, role, roles) => ({ uid, phone: '+22300000000', role, status: 'active', roles: roles || { [role]: 'active' }, iat: 1, exp: 9e9 });
const revendeur = (uid) => session(uid, 'reseller');
const fournisseur = (uid) => session(uid, 'supplier');

const { NextRequest } = require('next/server');
const requete = (url, init = {}) => new NextRequest(`http://localhost${url}`, {
  ...init, headers: { cookie: 'suguba_session=simule', 'content-type': 'application/json', ...(init.headers || {}) },
});
const ROUTES = {
  '/api/reseller/me': '../src/app/api/reseller/me/route.ts',
  '/api/reseller/boutique': '../src/app/api/reseller/boutique/route.ts',
  '/api/auth/complete-profile': '../src/app/api/auth/complete-profile/route.ts',
  '/api/admin/boutiques': '../src/app/api/admin/boutiques/route.ts',
  '/api/compte/boutiques': '../src/app/api/compte/boutiques/route.ts',
  '/api/reseau/visite-boutique': '../src/app/api/reseau/visite-boutique/route.ts',
};
const appeler = (methode, url, corps, entetes) => require(ROUTES[url.split('?')[0]])[methode](
  requete(url, { method: methode, ...(corps === undefined ? {} : { body: JSON.stringify(corps) }), ...(entetes ? { headers: entetes } : {}) }),
);

const E = require('../src/lib/enseigne.ts');
const NOM_COMPLET = /Traor|Dial+o/i;
/** Ce que voit un visiteur : le titre de la vitrine, calculé comme le fait le serveur. */
const titrePublic = (boutique, profil) => E.titreVitrine({
  type: 'revendeur', nom: E.nomPublicBoutique(boutique.name, profil.full_name), enseigne: E.estEnseigne(boutique.name, profil.full_name),
});

// ══ A. Carte produit : la fenêtre « Affiche » n'est plus enfermée dans la carte ══

test('A — Carte produit : seule la RANGÉE des deux boutons se mesure ; l’<article>, qui contient la fenêtre « Affiche », ne porte plus container-type', () => {
  const ProductCard = require('../src/components/product/ProductCard.tsx').default;
  const produit = { id: 'p1', slug: 'pagne-wax', nom: 'Pagne wax', prix: 12500, images: ['/photos/p1.webp'], enStock: true, ajoutDirect: true, quantiteAjout: 1, commission: 1000 };
  const rendre = (props) => renderToStaticMarkup(React.createElement(ProductCard, { produit, ...props }));

  // Vue client : « Ajouter » + rond de partage.
  let html = rendre({});
  const article = html.match(/^<article class="([^"]*)"/);
  assert.ok(article, 'la carte est un <article>');
  assert.doesNotMatch(article[1], /carte-produit/, 'la carte ne se mesure plus : elle contient une fenêtre en position fixe');
  const rangees = html.match(/<div class="carte-produit [^"]*">/g) || [];
  assert.deepEqual(rangees, ['<div class="carte-produit flex items-center gap-2">'], 'un seul élément mesuré : la rangée');
  // La rangée : exactement le bouton principal et le rond de partage, rien de fixé.
  const rangee = html.slice(html.indexOf(rangees[0])).match(/^<div class="carte-produit [^"]*">([\s\S]*?)<\/div>/)[1];
  assert.equal((rangee.match(/<button /g) || []).length, 2, '« Ajouter » et le rond de partage');
  assert.match(rangee, /class="[^"]*\bbouton-ajout\b[^"]*"[^>]*aria-label="Ajouter Pagne wax au panier"/);
  assert.match(rangee, /aria-label="Partager Pagne wax sur WhatsApp"/);
  assert.doesNotMatch(rangee, /\bfixed\b/);
  // Article à ouvrir (« Acheter ») : même rangée, un lien et le rond.
  html = rendre({ produit: { ...produit, ajoutDirect: false } });
  assert.equal((html.match(/carte-produit/g) || []).length, 1);
  assert.match(html, /<div class="carte-produit flex items-center gap-2"><a [^>]*class="[^"]*\bbouton-ajout\b/);

  // Catalogue revendeur (celui qui ouvre « Affiche pour mon statut ») et présentation : rien n'est mesuré.
  html = rendre({ partageEnAvant: true, afficherCommission: true });
  assert.match(html, /aria-label="Créer une affiche de Pagne wax pour mon statut WhatsApp"/);
  assert.doesNotMatch(html, /carte-produit/, 'aucun ancêtre de la fenêtre « Affiche » ne porte container-type');
  assert.doesNotMatch(rendre({ presentation: true }), /carte-produit/);

  // Source : la fenêtre est rendue dans l'<article>, HORS de la rangée ; ce que la rangée rend n'est jamais fixé.
  const src = sansCommentaires(lire('src/components/product/ProductCard.tsx'));
  const debut = src.indexOf('<div className="carte-produit flex items-center gap-2">');
  const fin = src.indexOf('{children}', debut);
  assert.ok(debut > 0 && fin > debut);
  assert.doesNotMatch(src.slice(debut, fin), /AfficheModal|Sheet|Modal|fixed/);
  assert.match(src.slice(fin), /\{afficheOuverte && \(\s*<AfficheModal/);
  assert.match(lire('src/components/product/AfficheModal.tsx'), /<div className="fixed inset-0 z-50 /, 'la fenêtre est bien en position fixe, sans portail');
  for (const f of ['src/components/ui/Button.tsx', 'src/components/ui/SugubaLoader.tsx', 'src/components/ui/WhatsAppIcon.tsx']) {
    assert.doesNotMatch(sansCommentaires(lire(f)), /\bfixed\b/, `${f} : rendu dans la rangée mesurée`);
  }
  // Feuille de style : même seuil qu'avant, mesuré sur la rangée (26 px de moins que la carte).
  const css = lire('src/app/globals.css');
  assert.match(css, /\.carte-produit \{ container-type: inline-size; \}\s*@container \(max-width: 151px\) \{\s*\.carte-produit \.icone-ajout \{ display: none; \}\s*\.carte-produit \.bouton-ajout \{ padding-left: 0\.625rem; padding-right: 0\.625rem; \}\s*\}/);
  assert.equal((css.match(/container-type\s*:/g) || []).length, 1);
});

// ══ B. Nom du compte changé : les boutiques d'abord ══════════════════════════

/**
 * Awa : compte « Awa Traore Dialo » (faute de frappe), boutique principale créée
 * avant le lot 2 au nom complet, une boutique Pro à enseigne (« Awa Mode ») et une
 * autre créée par défaut (« Awa D. »). Moussa : boutique au nom complet, témoin.
 */
function baseNoms() {
  reinitialiser();
  etat.profiles = [
    { id: 'rev-1', full_name: 'Awa Traore Dialo', phone: '+22370000001', role: 'reseller', reseller_code: 'AWA1', city: 'Bamako', metadata: { momoNumber: '+22370000001', momoProvider: 'orange' } },
    { id: 'rev-2', full_name: 'Moussa Keita', phone: '+22370000002', role: 'reseller', reseller_code: 'MOU2', metadata: {} },
  ];
  etat.profile_roles = [{ profile_id: 'rev-1', role: 'reseller', status: 'active' }, { profile_id: 'rev-2', role: 'reseller', status: 'active' }];
  etat.stores = [
    { id: 's1', owner_type: 'reseller', owner_id: 'rev-1', slug: 'awa-traore-dialo', name: 'Awa Traore Dialo', status: 'active', principale: true, created_at: '2026-06-01T00:00:00Z' },
    { id: 's2', owner_type: 'reseller', owner_id: 'rev-1', slug: 'awa-mode', name: 'Awa Mode', status: 'active', principale: false, created_at: '2026-09-25T00:00:00Z' },
    { id: 's3', owner_type: 'reseller', owner_id: 'rev-1', slug: 'awa-d', name: 'Awa D.', status: 'active', principale: false, created_at: '2026-09-26T00:00:00Z' },
    { id: 'm1', owner_type: 'reseller', owner_id: 'rev-2', slug: 'moussa-keita', name: 'Moussa Keita', status: 'active', principale: true, created_at: '2026-06-02T00:00:00Z' },
    { id: 'f1', owner_type: 'supplier', owner_id: 'rev-1', slug: 'kadi-shop', name: 'Awa Traore Dialo', status: 'active', principale: true, created_at: '2026-06-03T00:00:00Z' },
  ];
  sessionCourante = revendeur('rev-1');
}
const nomDe = (id) => etat.stores.find((b) => b.id === id).name;
const profil = (id) => etat.profiles.find((p) => p.id === id);
const renommer = (corps) => appeler('PATCH', '/api/reseller/me', corps);

test('B — PATCH /api/reseller/me : le nom corrigé réaligne d’abord les boutiques qui portaient l’ancien nom ; l’ancien nom complet ne devient jamais public', async () => {
  baseNoms();
  // Avant : la vitrine cache le nom complet, parce qu'il est reconnu comme celui du compte.
  assert.equal(titrePublic(etat.stores[0], profil('rev-1')), 'La sélection de Awa D.');

  const r = await renommer({ fullName: '  Awa   Traoré Diallo ' });
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { success: true });
  assert.equal(profil('rev-1').full_name, 'Awa Traoré Diallo');
  assert.deepEqual(profil('rev-1').metadata, { momoNumber: '+22370000001', momoProvider: 'orange' }, 'metadata fusionné, numéro de versement intact');

  // Les boutiques sont écrites AVANT le profil.
  assert.deepEqual(ecritures().map((o) => [o.table, o.op, o.egalites.id]), [['stores', 'update', 's1'], ['profiles', 'update', 'rev-1']]);
  const ecriture = sur('stores', 'update')[0];
  assert.equal(ecriture.patch.name, 'Awa D.');
  assert.deepEqual([ecriture.egalites.owner_type, ecriture.egalites.owner_id], ['reseller', 'rev-1'], 'toujours le compte de la session');
  assert.deepEqual([nomDe('s1'), nomDe('s2'), nomDe('s3')], ['Awa D.', 'Awa Mode', 'Awa D.'], 'l’enseigne choisie n’est pas touchée');
  assert.equal(etat.stores.find((b) => b.id === 's1').slug, 'awa-traore-dialo', 'l’adresse ne change pas');
  assert.equal(nomDe('m1'), 'Moussa Keita', 'la boutique d’un autre compte n’est pas touchée');
  assert.equal(nomDe('f1'), 'Awa Traore Dialo', 'ni sa boutique fournisseur');

  // Ce que voit un visiteur après la correction : jamais l'ancien nom complet.
  for (const b of etat.stores.filter((s) => s.owner_type === 'reseller' && s.owner_id === 'rev-1')) {
    assert.doesNotMatch(titrePublic(b, profil('rev-1')), NOM_COMPLET, b.id);
  }
  assert.equal(titrePublic(etat.stores[0], profil('rev-1')), 'La sélection de Awa D.');
  assert.equal(titrePublic(etat.stores[1], profil('rev-1')), 'Awa Mode');
  // Le défaut relevé : sans réalignement, l'ancien nom passait pour une enseigne.
  assert.equal(E.estEnseigne('Awa Traore Dialo', 'Awa Traoré Diallo'), true);
  assert.equal(E.titreVitrine({ type: 'revendeur', nom: E.nomPublicBoutique('Awa Traore Dialo', 'Awa Traoré Diallo'), enseigne: true }), 'Awa Traore Dialo');

  // Un tout autre nom : les boutiques sans enseigne suivent (« Awa D. » ne reste pas le titre de Fatou).
  operations = [];
  assert.equal((await renommer({ fullName: 'Fatou Keita' })).status, 200);
  assert.deepEqual([nomDe('s1'), nomDe('s2'), nomDe('s3')], ['Fatou K.', 'Awa Mode', 'Fatou K.']);
  assert.deepEqual(ecritures().map((o) => o.table), ['stores', 'stores', 'profiles']);

  // Nom inchangé, ou autre champ seul : aucune lecture ni écriture de boutique.
  operations = [];
  assert.equal((await renommer({ fullName: 'Fatou Keita', city: 'Ségou' })).status, 200);
  assert.equal((await renommer({ neighborhood: 'Hamdallaye' })).status, 200);
  assert.equal(sur('stores').length, 0);
  assert.equal(profil('rev-1').city, 'Ségou');
  assert.equal(profil('rev-1').metadata.neighborhood, 'Hamdallaye');
  assert.equal(profil('rev-1').metadata.momoNumber, '+22370000001');
});

test('B — réalignement impossible : le nom n’est pas changé (503), rien d’autre n’est écrit, les boutiques déjà réalignées reprennent leur nom', async () => {
  // Lecture des boutiques en panne : on ne sait pas ce qui deviendrait public.
  baseNoms();
  fautes['stores:select'] = '57014';
  let r = await renommer({ fullName: 'Awa Traoré Diallo', city: 'Ségou' });
  assert.equal(r.status, 503);
  assert.match((await r.json()).error, /nom n’a pas pu être changé/);
  assert.deepEqual(ecritures(), []);
  assert.deepEqual([profil('rev-1').full_name, profil('rev-1').city], ['Awa Traore Dialo', 'Bamako']);

  // Écriture d'une boutique en échec.
  baseNoms();
  fautes['stores:update'] = '57014';
  r = await renommer({ fullName: 'Awa Traoré Diallo' });
  assert.equal(r.status, 503);
  assert.equal(sur('profiles', 'update').length, 0, 'le profil n’est pas écrit');
  assert.deepEqual([profil('rev-1').full_name, nomDe('s1')], ['Awa Traore Dialo', 'Awa Traore Dialo']);
  assert.equal(titrePublic(etat.stores[0], profil('rev-1')), 'La sélection de Awa D.');

  // La 2e boutique échoue : la 1re, déjà réalignée, reprend son nom.
  baseNoms();
  etat.stores[2].name = 'Dialo Awa';
  fautes['stores:update'] = (o) => (o.egalites.id === 's3' && o.patch.name === 'Awa D.' ? '57014' : null);
  r = await renommer({ fullName: 'Awa Traoré Diallo' });
  assert.equal(r.status, 503);
  assert.deepEqual([nomDe('s1'), nomDe('s3'), profil('rev-1').full_name], ['Awa Traore Dialo', 'Dialo Awa', 'Awa Traore Dialo']);
  assert.equal(sur('profiles', 'update').length, 0);

  // Le profil échoue APRÈS les boutiques : elles reprennent leur nom, et rien n'est public entre-temps.
  baseNoms();
  fautes['profiles:update'] = '57014';
  r = await renommer({ fullName: 'Awa Traoré Diallo' });
  assert.equal(r.status, 400);
  assert.deepEqual(ecritures().map((o) => [o.table, o.egalites.id, o.patch.name]), [['stores', 's1', 'Awa D.'], ['profiles', 'rev-1', undefined], ['stores', 's1', 'Awa Traore Dialo']]);
  assert.deepEqual([nomDe('s1'), profil('rev-1').full_name], ['Awa Traore Dialo', 'Awa Traore Dialo']);
  assert.equal(titrePublic(etat.stores[0], profil('rev-1')), 'La sélection de Awa D.');

  // Table des boutiques pas encore créée : le compte n'en a aucune, le nom change.
  for (const code of ['42P01', 'PGRST205']) {
    baseNoms();
    fautes['stores:select'] = code;
    assert.equal((await renommer({ fullName: 'Awa Traoré Diallo' })).status, 200, code);
    assert.equal(profil('rev-1').full_name, 'Awa Traoré Diallo');
  }

  // Profil illisible : rien n'est écrit (avant, metadata repartait de zéro : numéro de versement perdu).
  baseNoms();
  fautes['profiles:select'] = '57014';
  r = await renommer({ neighborhood: 'Hamdallaye' });
  assert.equal(r.status, 503);
  assert.deepEqual(ecritures(), []);
  assert.deepEqual(profil('rev-1').metadata, { momoNumber: '+22370000001', momoProvider: 'orange' });
});

const completer = (corps) => appeler('POST', '/api/auth/complete-profile', corps);

test('B — /api/auth/complete-profile écrit aussi le nom du compte : même réalignement avant le profil, même refus s’il échoue', async () => {
  baseNoms();
  let r = await completer({ fullName: 'Awa Traoré Diallo', phone: '+22370000001', city: 'Bamako' });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).success, true);
  assert.equal(profil('rev-1').full_name, 'Awa Traoré Diallo');
  const ordre = ecritures().map((o) => [o.table, o.op]);
  assert.deepEqual(ordre.slice(0, 2), [['stores', 'update'], ['profiles', 'update']], 'les boutiques avant le profil');
  assert.deepEqual([nomDe('s1'), nomDe('s2'), nomDe('m1')], ['Awa D.', 'Awa Mode', 'Moussa Keita']);
  assert.doesNotMatch(titrePublic(etat.stores[0], profil('rev-1')), NOM_COMPLET);

  // Sous un autre profil actif (client), le compte garde ses boutiques revendeur : réalignées de même.
  baseNoms();
  sessionCourante = session('rev-1', 'customer', { customer: 'active', reseller: 'active' });
  assert.equal((await completer({ fullName: 'Awa Traoré Diallo', phone: '+22370000001' })).status, 200);
  assert.equal(nomDe('s1'), 'Awa D.');

  // Réalignement impossible : 503, profil inchangé.
  baseNoms();
  fautes['stores:update'] = '57014';
  r = await completer({ fullName: 'Awa Traoré Diallo', phone: '+22370000009' });
  assert.equal(r.status, 503);
  assert.deepEqual([profil('rev-1').full_name, profil('rev-1').phone, nomDe('s1')], ['Awa Traore Dialo', '+22370000001', 'Awa Traore Dialo']);
  assert.equal(sur('profiles', 'update').length, 0);

  // Numéro déjà pris (le profil échoue après les boutiques) : elles reprennent leur nom.
  baseNoms();
  fautes['profiles:update'] = (o) => ('full_name' in o.patch ? '23505' : null);
  r = await completer({ fullName: 'Awa Traoré Diallo', phone: '+22370000002' });
  assert.equal(r.status, 500, 'erreur de la base rendue telle quelle (message simulé sans « unique »)');
  assert.deepEqual([nomDe('s1'), profil('rev-1').full_name], ['Awa Traore Dialo', 'Awa Traore Dialo']);

  // Nouveau compte, sans boutique : une lecture, aucune écriture de boutique.
  baseNoms();
  etat.profiles.push({ id: 'cli-1', full_name: 'awa', phone: null, role: 'customer', reseller_code: null, metadata: {} });
  sessionCourante = session('cli-1', 'customer');
  assert.equal((await completer({ fullName: 'Awa Coulibaly', phone: '+22370000033' })).status, 200);
  assert.equal(sur('stores', 'select').length, 1);
  assert.equal(sur('stores', 'update').length, 0);
  assert.equal(profil('cli-1').full_name, 'Awa Coulibaly');

  // Toutes les écritures de profiles.full_name passent par le réalignement (ou créent un compte neuf).
  const quiEcrit = [];
  const parcourir = (dossier) => {
    for (const nom of fs.readdirSync(dossier)) {
      const plein = path.join(dossier, nom);
      if (fs.statSync(plein).isDirectory()) parcourir(plein);
      else if (/\.tsx?$/.test(nom) && /full_name\s*[:=](?!=)/.test(sansCommentaires(fs.readFileSync(plein, 'utf8')).replace(/full_name\??: string[^;,)}]*/g, ''))) quiEcrit.push(path.relative(RACINE, plein));
    }
  };
  parcourir(path.join(RACINE, 'src'));
  assert.deepEqual(quiEcrit.sort(), [
    'src/app/api/admin/boutiques/route.ts',        // insertion d'un compte neuf (aucune boutique avant)
    'src/app/api/auth/complete-profile/route.ts',
    'src/app/api/auth/supabase-exchange/route.ts', // insertion d'un compte neuf
    'src/app/api/reseller/me/route.ts',
  ], 'une nouvelle route qui écrit le nom du compte doit réaligner les boutiques');
  for (const f of ['src/app/api/auth/complete-profile/route.ts', 'src/app/api/reseller/me/route.ts']) {
    const src = sansCommentaires(lire(f));
    assert.ok(src.indexOf('realignerBoutiquesAvantNouveauNom(admin, session.uid') > 0, f);
    assert.ok(src.indexOf('realignerBoutiquesAvantNouveauNom(admin, session.uid') < src.lastIndexOf(".from('profiles').update("), `${f} : avant le profil`);
  }
});

// ══ C. Nom de compte réservé à Suguba ════════════════════════════════════════

test('C — affichage : un compte nommé « Suguba », « Admin »… s’affiche « Revendeur partenaire », partout où passe nomPublic', async () => {
  for (const nom of ['Suguba', 'suguba officiel', 'SugubaML Mali', 'Sugu Ba', 'Admin', 'Support', 'Service Client', 'Équipe', 'Awa Suguba']) {
    assert.equal(E.nomPublic(nom), 'Revendeur partenaire', nom);
    assert.equal(E.nomPublicBoutique(nom, nom), 'Revendeur partenaire', `boutique créée au nom du compte : ${nom}`);
    assert.equal(E.nomPublicBoutique(E.nomPublic(nom), nom), 'Revendeur partenaire');
    assert.equal(E.titreVitrine({ type: 'revendeur', nom: E.nomPublicBoutique(nom, nom), enseigne: E.estEnseigne(nom, nom) }), 'La sélection de Revendeur partenaire');
  }
  assert.equal(E.NOM_NEUTRE, 'Revendeur partenaire');
  // Les vrais noms ne changent pas ; le nom par défaut non plus.
  assert.equal(E.nomPublic('Awa Traoré Diallo'), 'Awa D.');
  assert.equal(E.nomPublic('Awa'), 'Awa');
  assert.equal(E.nomPublic('Sugu Bamako'), 'Sugu B.', '« sugu » (le marché) reste un mot courant');
  assert.equal(E.nomPublic(null), E.NOM_PAR_DEFAUT);
  // Le nom neutre n'est jamais une enseigne choisie, ni une adresse.
  assert.equal(E.estEnseigne('Revendeur partenaire', 'Awa Traoré Diallo'), false);
  assert.equal(E.nomPublicBoutique('Revendeur partenaire', 'Awa Traoré Diallo'), 'Awa D.');
  assert.equal(E.nomReserve('Revendeur Partenaire'), true);
  assert.equal(E.adresseReservee('revendeur-partenaire'), true);
  // Une vraie enseigne reste affichée, même si le nom du compte est réservé.
  assert.equal(E.nomPublicBoutique('Chez Awa', 'Suguba'), 'Chez Awa');

  // Annonce aux abonnés : « Nouveautés chez Revendeur partenaire », jamais « chez Suguba ».
  const { nomBoutiqueAnnonce, contenuAnnonce } = require('../src/lib/annonce-boutique.ts');
  const annonce = contenuAnnonce({ nomBoutique: nomBoutiqueAnnonce('Suguba', 'Suguba'), slug: 'ma-boutique', nouveautes: [{ nom: 'Pagne' }] });
  assert.equal(annonce.titre, 'Nouveautés chez Revendeur partenaire');
  // Annuaire, recherche, boutiques suivies : même fonction.
  const { nomsPublicsRevendeurs } = require('../src/lib/reseau/boutiques.ts');
  reinitialiser();
  etat.profiles = [{ id: 'rev-9', full_name: 'Suguba Officiel' }];
  const liste = await nomsPublicsRevendeurs(db, [{ typeProprietaire: 'reseller', proprietaireId: 'rev-9', nom: 'Suguba O.' }], (b) => b);
  assert.deepEqual(liste.map((b) => b.nom), ['Revendeur partenaire']);
  // Bandeau « Recommandé par » de la fiche produit et vitrine /r/<code>.
  const shop = require('../src/lib/shop.ts');
  etat.profiles = [{ id: 'rev-9', full_name: 'Suguba', reseller_code: 'SUG9' }];
  etat.profile_roles = [{ profile_id: 'rev-9', role: 'reseller', status: 'active' }];
  etat.stores = [{ id: 's9', owner_type: 'reseller', owner_id: 'rev-9', slug: 'ma-boutique', name: 'Suguba', status: 'active', principale: true, created_at: '2026-06-01T00:00:00Z' }];
  assert.equal(await shop.nomRevendeurPublic('SUG9'), 'Revendeur partenaire');
  assert.deepEqual(await shop.boutiqueRevendeurPublique('SUG9'), { nom: 'Revendeur partenaire', enseigne: null, slug: 'ma-boutique' });
  const vitrine = await shop.chargerBoutiqueRevendeur('SUG9');
  assert.deepEqual([vitrine.nom, vitrine.enseigne], ['Revendeur partenaire', false]);
  assert.doesNotMatch(JSON.stringify([vitrine.nom, annonce, liste]), /suguba/i);
});

test('C — écriture : un nom de compte réservé est refusé pour un revendeur (démarrage, inscription, création par l’équipe), avant toute écriture', async () => {
  // PATCH /api/reseller/me (étape « Votre nom » du démarrage).
  for (const nom of ['Suguba', 'Suguba Officiel', 'Admin', 'Service Client']) {
    baseNoms();
    const r = await renommer({ fullName: nom, city: 'Ségou' });
    assert.equal(r.status, 400, nom);
    assert.match((await r.json()).error, /réservé à Suguba/);
    assert.deepEqual(ecritures(), [], nom);
    assert.equal(profil('rev-1').full_name, 'Awa Traore Dialo');
  }

  // Inscription : rôle revendeur demandé, actif, ou déjà détenu sous un autre profil.
  for (const [courante, role] of [[revendeur('rev-1'), undefined], [session('rev-1', 'customer'), 'reseller'], [session('rev-1', 'customer', { customer: 'active', reseller: 'active' }), undefined]]) {
    baseNoms();
    sessionCourante = courante;
    const r = await completer({ fullName: 'Suguba Officiel', phone: '+22370000001', ...(role ? { role } : {}) });
    assert.equal(r.status, 400);
    assert.match((await r.json()).error, /réservé à Suguba/);
    assert.deepEqual(ecritures(), [], 'ni rôle, ni profil, ni boutique');
  }
  // Un compte client sans rôle revendeur n'a pas de vitrine : son nom n'est pas contrôlé ici.
  baseNoms();
  etat.profiles.push({ id: 'cli-1', full_name: null, phone: null, role: 'customer', reseller_code: null, metadata: {} });
  sessionCourante = session('cli-1', 'customer');
  assert.equal((await completer({ fullName: 'Admin', phone: '+22370000044' })).status, 200);

  // Admin › créer un compte.
  reinitialiser();
  etat.admin_team_members = [{ profile_id: 'adm-1', team_role: 'super_admin', permissions: [] }];
  sessionCourante = session('adm-1', 'admin');
  const creer = (corps) => appeler('POST', '/api/admin/boutiques', { action: 'creer_compte', email: 'personne@example.org', telephone: '+22376000000', ...corps });
  let r = await creer({ type: 'reseller', nom: 'Suguba Officiel' });
  assert.equal(r.status, 400);
  assert.match((await r.json()).error, /réservé à Suguba/);
  assert.equal(sur('profiles', 'insert').length + sur('stores', 'insert').length, 0);
  // Un fournisseur garde le nom de son entreprise (sa vitrine n'est pas celle d'un revendeur).
  r = await creer({ type: 'supplier', nom: 'Support Technique SARL' });
  assert.equal(r.status, 200);
});

// ══ D. Boutique revendeur créée par l'équipe ou par « Mes boutiques » ════════

test('D — admin › créer un compte revendeur : la boutique s’appelle « Awa D. » à l’adresse /boutique/awa-d, jamais le nom complet', async () => {
  reinitialiser();
  etat.admin_team_members = [{ profile_id: 'adm-1', team_role: 'super_admin', permissions: [] }];
  sessionCourante = session('adm-1', 'admin');
  const creer = (corps) => appeler('POST', '/api/admin/boutiques', { action: 'creer_compte', type: 'reseller', telephone: '+22376000001', ...corps });

  // Nom de boutique laissé vide : l'écran envoie le nom de la personne.
  let r = await creer({ nom: 'Awa Traoré Diallo', email: 'awa@example.org', nomBoutique: 'Awa Traoré Diallo' });
  assert.equal(r.status, 200);
  let json = await r.json();
  assert.deepEqual([json.boutique.nom, json.boutique.slug, json.boutique.principale], ['Awa D.', 'awa-d', true]);
  let insertion = sur('stores', 'insert')[0].patch;
  assert.deepEqual([insertion.name, insertion.slug, insertion.owner_type], ['Awa D.', 'awa-d', 'reseller']);
  assert.doesNotMatch(JSON.stringify(insertion), /Traor|Diallo|traore|diallo/, 'ni dans le nom, ni dans l’adresse');
  assert.equal(etat.profiles[0].full_name, 'Awa Traoré Diallo', 'le nom complet reste sur le compte');
  // Sans nomBoutique du tout, ou avec une partie de son nom : même règle.
  for (const [email, tel, nomBoutique] of [['b@example.org', '+22376000002', undefined], ['c@example.org', '+22376000003', 'Diallo Awa']]) {
    operations = [];
    r = await creer({ nom: 'Awa Traoré Diallo', email, telephone: tel, ...(nomBoutique ? { nomBoutique } : {}) });
    assert.equal(r.status, 200);
    insertion = sur('stores', 'insert')[0].patch;
    assert.equal(insertion.name, 'Awa D.');
    assert.match(insertion.slug, /^awa-d(-\d+)?$/);
  }
  // Une enseigne choisie par l'équipe est gardée.
  operations = [];
  r = await creer({ nom: 'Moussa Keita', email: 'moussa@example.org', telephone: '+22376000004', nomBoutique: 'Moussa Déco' });
  json = await r.json();
  assert.deepEqual([json.boutique.nom, json.boutique.slug], ['Moussa Déco', 'moussa-deco']);
  // Fournisseur : inchangé, sa boutique porte le nom donné.
  operations = [];
  r = await creer({ type: 'supplier', nom: 'Kadi Traoré', email: 'kadi@example.org', telephone: '+22376000005', nomBoutique: 'Kadi Traoré' });
  assert.equal((await r.json()).boutique.nom, 'Kadi Traoré');

  // Compte existant (« Créer une boutique pour… ») : même fonction, même règle.
  operations = [];
  const awa = etat.profiles[0].id;
  etat.stores = etat.stores.filter((b) => b.owner_id !== awa);
  r = await appeler('POST', '/api/admin/boutiques', { action: 'creer', type: 'reseller', proprietaireId: awa, nom: 'Awa Traoré Diallo' });
  assert.equal(r.status, 200);
  assert.deepEqual([sur('stores', 'insert')[0].patch.name, sur('stores', 'insert')[0].patch.slug], ['Awa D.', 'awa-d']);

  // L'écran n'annonce plus « le nom de la personne » pour un revendeur.
  const ecran = sansCommentaires(lire('src/app/admin/boutiques/page.tsx'));
  assert.match(ecran, /placeholder=\{type === 'reseller' \? \(mode === 'nouveau' \? 'Par défaut : prénom et initiale \(Awa D\.\)' : 'Ex\. : Awa Mode'\) : mode === 'nouveau' \? 'Par défaut : le nom de la personne' : ''\}/);
  assert.match(ecran, /aide=\{type === 'reseller' \? 'Le nom de la personne n’est jamais affiché en entier/);
});

test('D — Mes boutiques › Nouvelle boutique avant d’avoir ouvert « Ma boutique » : son propre nom devient « Awa D. », adresse comprise ; profil illisible → rien n’est créé', async () => {
  const depart = () => {
    reinitialiser();
    etat.profiles = [{ id: 'rev-1', full_name: 'Awa Traoré Diallo', reseller_code: 'AWA1' }];
    sessionCourante = revendeur('rev-1');
  };
  const creer = (nom) => appeler('POST', '/api/compte/boutiques', { action: 'creer', nom });

  depart();
  let r = await creer('Awa Traoré Diallo');
  assert.equal(r.status, 200);
  let json = await r.json();
  assert.deepEqual([json.boutique.nom, json.boutique.slug, json.boutique.principale], ['Awa D.', 'awa-d', true], 'c’est sa boutique PRINCIPALE');
  assert.doesNotMatch(JSON.stringify(etat.stores), /Traor|Diallo|traore|diallo/);
  // Variantes de son nom, espaces en trop.
  for (const nom of ['awa  diallo', 'Diallo Awa', 'AWA TRAORÉ']) {
    depart();
    r = await creer(nom);
    assert.deepEqual([etat.stores[0].name, etat.stores[0].slug], ['Awa D.', 'awa-d'], nom);
  }
  // Une enseigne est gardée telle quelle.
  depart();
  json = await (await creer('Awa Mode & Beauté')).json();
  assert.deepEqual([json.boutique.nom, json.boutique.slug], ['Awa Mode & Beauté', 'awa-mode-beaute']);
  // Profil illisible ou absent : rien n'est créé (jamais un nom non vérifié).
  depart();
  fautes['profiles:select'] = '57014';
  r = await creer('Awa Traoré Diallo');
  assert.equal(r.status, 503);
  assert.deepEqual(ecritures(), []);
  depart();
  etat.profiles = [];
  assert.equal((await creer('Awa Traoré Diallo')).status, 503);
  assert.deepEqual(ecritures(), []);
  // Un fournisseur garde le nom tapé : aucune lecture de profil.
  depart();
  sessionCourante = fournisseur('fou-1');
  json = await (await creer('Kadi Traoré')).json();
  assert.equal(json.boutique.nom, 'Kadi Traoré');
  assert.equal(sur('profiles').length, 0);
});

// ══ E. Visites de boutique : plafonds et origine de l'appel ══════════════════

const NAVIGATEUR = 'Mozilla/5.0 (Linux; Android 13; SM-A135F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36';
const visiter = (corps, entetes = {}) => appeler('POST', '/api/reseau/visite-boutique', corps, { 'user-agent': NAVIGATEUR, 'x-real-ip': '41.73.1.2', ...entetes });
const vues = (boutique) => etat.analytics_events.filter((e) => e.event === 'STORE_VIEW' && (!boutique || e.subject_ref === boutique));
function baseVisites() {
  reinitialiser();
  etat.stores = [
    { id: 's1', owner_type: 'reseller', owner_id: 'rev-1', slug: 'awa-mode', name: 'Awa Mode', status: 'active', created_at: '2026-06-01T00:00:00Z' },
    { id: 's2', owner_type: 'reseller', owner_id: 'rev-2', slug: 'chez-moussa', name: 'Chez Moussa', status: 'active', created_at: '2026-06-02T00:00:00Z' },
  ];
  sessionCourante = null;
}

test('E — visite-boutique : un appel venu d’un autre site n’est pas compté (Sec-Fetch-Site), sans rien lire ; même origine ou navigateur ancien : compté', async () => {
  baseVisites();
  for (const site of ['cross-site', 'same-site', 'none']) {
    const r = await visiter({ slug: 'awa-mode' }, { 'sec-fetch-site': site });
    assert.equal(r.status, 204, 'toujours 204 : l’appelant n’apprend rien');
    assert.deepEqual(operations, [], `${site} : ni lecture ni écriture`);
  }
  assert.equal((await visiter({ slug: 'awa-mode' }, { 'sec-fetch-site': 'same-origin' })).status, 204);
  assert.equal(vues().length, 1);
  // En-tête absent (navigateur ancien) : accepté, comme les routes du partage, de l'annonce et de l'adresse.
  await visiter({ slug: 'awa-mode' }, { 'x-real-ip': '41.73.5.5' });
  assert.equal(vues().length, 2);
  const src = sansCommentaires(lire('src/app/api/reseau/visite-boutique/route.ts'));
  assert.match(src, /const site = req\.headers\.get\('sec-fetch-site'\);\s*if \(site && site !== 'same-origin'\) return sansCorps\(\);/);
  for (const f of ['partage', 'annonce', 'adresse']) {
    assert.match(sansCommentaires(lire(`src/app/api/reseller/boutique/${f}/route.ts`)), /if \(site && site !== 'same-origin'\)/, `même règle : ${f}`);
  }
  // Le composant appelle bien la même origine (adresse relative).
  assert.match(sansCommentaires(lire('src/components/shop/VisiteBoutique.tsx')), /fetch\('\/api\/reseau\/visite-boutique', \{/);
});

test('E — visite-boutique : 30 visites au plus par adresse IP, par boutique et par jour, quel que soit le navigateur déclaré ; l’empreinte ne contient que l’IP et change chaque jour', async () => {
  const { empreinteAdresseDuJour } = require('../src/lib/reseau/db.ts');
  baseVisites();
  // Une seule machine, 40 navigateurs déclarés différents : avant, 40 « visiteurs ».
  for (let i = 0; i < 40; i++) assert.equal((await visiter({ slug: 'awa-mode' }, { 'user-agent': `${NAVIGATEUR} Appareil/${i}` })).status, 204);
  assert.equal(vues('s1').length, 30, 'plafond par boutique');
  // Une autre boutique reste comptée pour cette adresse ; une autre adresse aussi pour cette boutique.
  await visiter({ slug: 'chez-moussa' });
  assert.equal(vues('s2').length, 1);
  await visiter({ slug: 'awa-mode' }, { 'x-real-ip': '41.73.9.9' });
  assert.equal(vues('s1').length, 31);

  // Ce qui est gardé : deux empreintes salées, jamais l'IP ni le navigateur en clair.
  const jour = new Date().toISOString().slice(0, 10);
  const gardee = vues('s1')[0].meta;
  assert.deepEqual(Object.keys(gardee).sort(), ['canal', 'ipj', 'v']);
  assert.match(gardee.ipj, /^[0-9a-f]{32}$/);
  assert.equal(gardee.ipj, empreinteAdresseDuJour('41.73.1.2', jour));
  assert.equal(new Set(vues('s1').slice(0, 30).map((e) => e.meta.ipj)).size, 1, 'la même adresse, quel que soit le navigateur');
  assert.equal(new Set(vues('s1').slice(0, 30).map((e) => e.meta.v)).size, 30);
  assert.doesNotMatch(JSON.stringify(etat.analytics_events), /41\.73\.|Mozilla|Android|Appareil/);
  // Elle change chaque jour, et d'une adresse à l'autre ; elle ne dépend de rien d'autre.
  assert.notEqual(empreinteAdresseDuJour('41.73.1.2', jour), empreinteAdresseDuJour('41.73.1.2', '2026-10-03'));
  assert.notEqual(empreinteAdresseDuJour('41.73.1.2', jour), empreinteAdresseDuJour('41.73.1.3', jour));
  assert.equal(empreinteAdresseDuJour.length, 2, 'l’IP et le jour, rien sur l’appareil');
  assert.notEqual(empreinteAdresseDuJour('41.73.1.2', jour), require('../src/lib/reseau/db.ts').empreinteVisiteur('41.73.1.2', null));

  // Le lendemain, le compteur repart : les visites d'hier (autre empreinte) ne comptent pas.
  baseVisites();
  const hier = new Date(Date.now() - 24 * 3600 * 1000);
  etat.analytics_events = Array.from({ length: 30 }, (_, i) => ({
    event: 'STORE_VIEW', subject_ref: 's1', occurred_at: hier.toISOString(), meta: { v: `h${i}`, ipj: empreinteAdresseDuJour('41.73.1.2', hier.toISOString().slice(0, 10)), canal: 'direct' },
  }));
  await visiter({ slug: 'awa-mode' });
  assert.equal(vues('s1').length, 31);
});

test('E — visite-boutique : 200 visites au plus par adresse IP et par jour, toutes boutiques confondues ; plafond illisible → rien n’est compté', async () => {
  const { empreinteAdresseDuJour } = require('../src/lib/reseau/db.ts');
  const jour = new Date().toISOString().slice(0, 10);
  const dejaComptees = (n, ip) => Array.from({ length: n }, (_, i) => ({
    event: 'STORE_VIEW', subject_ref: `autre-${i % 20}`, occurred_at: new Date().toISOString(), meta: { v: `x${i}`, ipj: empreinteAdresseDuJour(ip, jour), canal: 'direct' },
  }));
  baseVisites();
  etat.analytics_events = dejaComptees(199, '41.73.1.2');
  await visiter({ slug: 'awa-mode' });
  assert.equal(vues('s1').length, 1, 'la 200e est comptée');
  await visiter({ slug: 'chez-moussa' });
  assert.equal(vues('s2').length, 0, 'la 201e ne l’est pas, même pour une boutique jamais visitée');
  assert.equal(vues().length, 200);
  // Une autre adresse n'est pas concernée.
  await visiter({ slug: 'chez-moussa' }, { 'x-real-ip': '41.73.9.9' });
  assert.equal(vues('s2').length, 1);

  // Une lecture pour les deux plafonds, sur les événements du jour de cette adresse ; en échec : rien n'est écrit.
  baseVisites();
  operations = [];
  await visiter({ slug: 'awa-mode' });
  const lectures = sur('analytics_events', 'select');
  assert.equal(lectures.length, 2, 'la visite déjà comptée, puis les plafonds');
  assert.deepEqual(Object.keys(lectures[1].egalites).sort(), ['event', 'meta->>ipj']);
  assert.equal(lectures[1].egalites['meta->>ipj'], empreinteAdresseDuJour('41.73.1.2', jour));
  baseVisites();
  fautes['analytics_events:select'] = (o) => ('meta->>ipj' in o.egalites ? '57014' : null);
  await visiter({ slug: 'awa-mode' });
  assert.equal(vues().length, 0);
  assert.deepEqual(ecritures(), []);
  // Ni index ni migration : le fichier SQL du chantier ne parle pas de ces événements.
  assert.doesNotMatch(lire('supabase/A-EXECUTER-2026-10-03-vitrine-boutique.sql'), /analytics_events/);
});

// ══ F. Sélection illisible ≠ sélection vide ══════════════════════════════════

const IL_Y_A_UN_MOIS = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
const produit = (id, enPlus = {}) => ({
  id, slug: `slug-${id}`, name: `Article ${id}`, category: 'Maison', images: [`https://x/${id}.webp`], public_price: 10000, stock: 5,
  reseller_commission: 1000, pricing_status: 'ok', status: 'approved', supplier_id: 'fou-1', created_at: IL_Y_A_UN_MOIS, ...enPlus,
});
function baseKadi() {
  reinitialiser();
  messages = [];
  etat.stores = [
    { id: 'f-main', owner_type: 'supplier', owner_id: 'fou-1', slug: 'kadi-shop', name: 'Kadi Shop', status: 'active', principale: true, created_at: '2026-01-01T00:00:00Z' },
    { id: 'f-pro', owner_type: 'supplier', owner_id: 'fou-1', slug: 'kadi-annexe', name: 'Kadi Annexe', status: 'active', principale: false, created_at: '2026-09-25T00:00:00Z' },
    { id: 'f-vide', owner_type: 'supplier', owner_id: 'fou-1', slug: 'kadi-neuve', name: 'Kadi Neuve', status: 'active', principale: false, created_at: '2026-09-26T00:00:00Z' },
  ];
  etat.products = [produit('a'), produit('b'), produit('c'), produit('n')];
  etat.store_products = [['a', 0], ['b', 1], ['c', 2]].map(([id, position]) => ({ store_id: 'f-pro', product_id: id, position, added_at: IL_Y_A_UN_MOIS }));
  sessionCourante = fournisseur('fou-1');
}
const dansLaBoutique = (id) => etat.store_products.filter((l) => l.store_id === id).map((l) => l.product_id).sort();

test('F — articlesDeLaBoutique : null quand la lecture échoue, [] seulement pour une boutique vraiment vide ; la route le transmet', async () => {
  const { articlesDeLaBoutique } = require('../src/lib/reseau/boutiques-multiples.ts');
  baseKadi();
  assert.deepEqual(await articlesDeLaBoutique('f-pro'), ['a', 'b', 'c']);
  assert.deepEqual(await articlesDeLaBoutique('f-vide'), [], 'boutique sans article : une liste vide, lue');
  fautes['store_products:select'] = '57014';
  assert.equal(await articlesDeLaBoutique('f-pro'), null, 'panne : jamais « aucun article »');

  // GET /api/compte/boutiques : la boutique est signalée illisible, le reste de la page répond.
  let r = await appeler('GET', '/api/compte/boutiques');
  assert.equal(r.status, 200);
  let json = await r.json();
  assert.deepEqual(json.articles, { 'f-pro': null, 'f-vide': null });
  assert.equal(json.boutiques.length, 3);
  assert.equal(json.catalogue.length, 4);
  // Une seule boutique en panne : les autres gardent leur liste.
  fautes['store_products:select'] = (o) => (o.egalites.store_id === 'f-pro' ? '57014' : null);
  json = await (await appeler('GET', '/api/compte/boutiques')).json();
  assert.deepEqual(json.articles, { 'f-pro': null, 'f-vide': [] });
  delete fautes['store_products:select'];
  json = await (await appeler('GET', '/api/compte/boutiques')).json();
  assert.deepEqual(json.articles, { 'f-pro': ['a', 'b', 'c'], 'f-vide': [] });
  assert.deepEqual(ecritures(), []);
});

// Pas de DOM dans node:test : l'écran est appelé comme une fonction, avec des
// crochets React SIMULÉS pour lui seul (même montage que tests/ma-boutique-lot7).
// Deux écrans sont montés ainsi : « Mes boutiques » (F) et le démarrage du revendeur (G).
const PAGE_BOUTIQUES = path.join(RACINE, 'src/app/compte/boutiques/page.tsx');
const PAGE_DEMARRER = path.join(RACINE, 'src/app/reseller/demarrer/page.tsx');
const PAGES_SIMULEES = new Set([PAGE_BOUTIQUES, PAGE_DEMARRER]);
let crochets = null;
const fauxReact = {
  ...React, __esModule: true, default: React,
  useState: (init) => (crochets ? crochets.useState(init) : React.useState(init)),
  useEffect: (f, d) => (crochets ? crochets.useEffect(f) : React.useEffect(f, d)),
  useCallback: (f, d) => (crochets ? f : React.useCallback(f, d)),
};
const chargerOriginal = Module._load;
Module._load = function (demande, parent, ...reste) {
  if (demande === 'react' && parent && PAGES_SIMULEES.has(parent.filename)) return fauxReact;
  return chargerOriginal.call(this, demande, parent, ...reste);
};
function trouver(noeud, critere, resultats = []) {
  if (Array.isArray(noeud)) { noeud.forEach((n) => trouver(n, critere, resultats)); return resultats; }
  if (!noeud || typeof noeud !== 'object' || !noeud.props) return resultats;
  if (critere(noeud)) resultats.push(noeud);
  if (noeud.props.children) trouver(noeud.props.children, critere, resultats);
  return resultats;
}
const texteDe = (noeud) => (Array.isArray(noeud) ? noeud.map(texteDe).join('') : noeud == null || noeud === false ? '' : typeof noeud === 'object' ? texteDe(noeud.props && noeud.props.children) : String(noeud));
const monterMesBoutiques = () => monterPage(PAGE_BOUTIQUES);
function monterPage(fichier) {
  const Page = require(fichier).default;
  const valeurs = []; const setters = []; let curseur = 0; let effets = [];
  const miens = {
    useState(init) {
      const k = curseur++;
      if (!(k in valeurs)) valeurs[k] = typeof init === 'function' ? init() : init;
      setters[k] ||= (v) => { valeurs[k] = typeof v === 'function' ? v(valeurs[k]) : v; };
      return [valeurs[k], setters[k]];
    },
    useEffect(f) { effets.push(f); },
  };
  const attendre = async () => { for (let i = 0; i < 60; i++) await new Promise((r) => setImmediate(r)); };
  const rendre = () => { curseur = 0; effets = []; crochets = miens; try { return Page(); } finally { crochets = null; } };
  return {
    rendre, attendre,
    boutons: (arbre, libelle) => trouver(arbre, (e) => typeof e.type === 'function' && e.type.name === 'Button' && texteDe(e.props.children) === libelle),
    selecteurs: (arbre) => trouver(arbre, (e) => typeof e.type === 'function' && e.type.name === 'SelecteurArticles'),
    champs: (arbre, id) => trouver(arbre, (e) => e.props.id === id),
    async monter() { rendre(); effets.forEach((f) => f()); await attendre(); return rendre(); },
  };
}

test('F — Mes boutiques (fournisseur) : sélection illisible → « Articles indisponibles », pas de liste à cocher, « Réessayer » ; aucun article n’est retiré', async () => {
  const appels = [];
  global.fetch = async (url, init = {}) => {
    const methode = init.method || 'GET';
    appels.push([methode, String(url), init.body ? JSON.parse(init.body) : undefined]);
    const r = await require(ROUTES[String(url).split('?')[0]])[methode](requete(String(url), { method: methode, ...(init.body ? { body: init.body } : {}) }));
    return { ok: r.status >= 200 && r.status < 300, status: r.status, json: () => r.json() };
  };
  try {
    baseKadi();
    fautes['store_products:select'] = (o) => (o.egalites.store_id === 'f-pro' ? '57014' : null);
    const ecran = monterMesBoutiques();
    let arbre = await ecran.monter();
    const texte = texteDe(arbre);
    assert.match(texte, /Articles indisponibles pour le moment/);
    assert.doesNotMatch(texte, /Kadi Annexe[\s\S]*?0 article\(s\) choisis[\s\S]*?Kadi Neuve/, 'la panne ne se lit plus « 0 article(s) choisis »');
    assert.match(texte, /Les articles de cette boutique n’ont pas pu être lus\. Rien n’a changé/);
    assert.match(texte, /0 article\(s\) choisis/, 'la boutique vraiment vide, elle, le dit');
    // « Kadi Annexe » : pas de liste à cocher, mais « Réessayer ». « Kadi Neuve » (lue, vide) garde la sienne.
    assert.equal(ecran.boutons(arbre, 'Réessayer').length, 1);
    assert.equal(ecran.boutons(arbre, 'Choisir les articles').length, 1);
    assert.equal(ecran.selecteurs(arbre).length, 0);
    assert.deepEqual(appels.map((a) => a.slice(0, 2)), [['GET', '/api/compte/boutiques']]);
    assert.deepEqual(ecritures(), []);
    assert.deepEqual(dansLaBoutique('f-pro'), ['a', 'b', 'c']);

    // La base répond de nouveau : « Réessayer » relit, la liste s'ouvre avec les VRAIES coches.
    delete fautes['store_products:select'];
    ecran.boutons(arbre, 'Réessayer')[0].props.onClick();
    await ecran.attendre();
    arbre = ecran.rendre();
    assert.equal(ecran.boutons(arbre, 'Réessayer').length, 0);
    assert.doesNotMatch(texteDe(arbre), /indisponibles|n’ont pas pu être lus/);
    const ouvrir = ecran.boutons(arbre, 'Choisir les articles');
    assert.equal(ouvrir.length, 2);
    ouvrir[0].props.onClick();
    arbre = ecran.rendre();
    const listes = ecran.selecteurs(arbre);
    assert.equal(listes.length, 1);
    assert.deepEqual(listes[0].props.choisis, ['a', 'b', 'c'], 'jamais une liste vide inventée');
    // Enregistrer avec un article de plus : rien n'est retiré.
    await listes[0].props.onEnregistrer(['a', 'b', 'c', 'n']);
    assert.deepEqual(dansLaBoutique('f-pro'), ['a', 'b', 'c', 'n']);
    assert.equal(sur('store_products', 'delete').length, 0);
  } finally { global.fetch = RESEAU_INTERDIT; }

  // Le défaut relevé, rejoué sur le serveur : la liste « vide » d'une lecture ratée, enregistrée avec
  // un seul article coché, retirait les trois autres. L'écran ne peut plus l'envoyer.
  baseKadi();
  const r = await appeler('POST', '/api/compte/boutiques', { action: 'articles', boutiqueId: 'f-pro', produits: ['n'] });
  assert.equal(r.status, 200);
  assert.deepEqual(dansLaBoutique('f-pro'), ['n'], 'c’est ce que faisait l’enregistrement parti d’une liste vide');
  const page = sansCommentaires(lire('src/app/compte/boutiques/page.tsx'));
  assert.doesNotMatch(page, /d\.articles\[b\.id\] \|\| \[\]/, 'plus de liste vide par défaut');
  assert.match(page, /const illisible = !b\.principale && !Array\.isArray\(choisis\);/);
  assert.match(page, /\{selection === b\.id && Array\.isArray\(choisis\) && \(\s*<SelecteurArticles\s+catalogue=\{d\.catalogue\}\s+choisis=\{choisis\}/);
});

// ══ G. Aperçu administrateur : le démarrage reste parcourable ════════════════

/**
 * « Se connecter en tant que revendeur » (/api/admin/preview-role) : identité
 * fictive `apercu-reseller`, absente de profiles. Le 403 ajouté par le correctif
 * à PATCH /api/reseller/me arrêtait le démarrage à sa première étape ; avant lui,
 * la route répondait « enregistré » sans rien toucher (0 ligne mise à jour).
 */
const apercuRevendeur = () => ({ ...session('apercu-reseller', 'reseller'), phone: '+22300000092', apercu: { depuis: { uid: 'adm-1', phone: '+22370000099' } } });
/** Le navigateur simulé appelle les VRAIES routes. */
const versLesRoutes = (appels) => async (url, init = {}) => {
  const methode = init.method || 'GET';
  appels.push([methode, String(url), init.body ? JSON.parse(init.body) : undefined]);
  const r = await require(ROUTES[String(url).split('?')[0]])[methode](requete(String(url), { method: methode, ...(init.body ? { body: init.body } : {}) }));
  return { ok: r.status >= 200 && r.status < 300, status: r.status, json: () => r.json() };
};

test('G — aperçu administrateur : PATCH /api/reseller/me répond « enregistré » sans rien lire ni écrire ; mêmes refus de nom qu’un vrai compte', async () => {
  baseNoms();
  sessionCourante = apercuRevendeur();
  // Tout ce qu'envoient le démarrage (Vous, Ville, Adresse, Catégories, fin) et « Mon profil vérifié » (quartier).
  for (const corps of [{ fullName: 'Awa Traoré Diallo' }, { city: 'Ségou' }, { neighborhood: 'Hamdallaye', address: 'Près de la mosquée' }, { categories: ['Mode'] }, { onboardingDone: true }, { neighborhood: 'Hamdallaye' }]) {
    const r = await renommer(corps);
    assert.equal(r.status, 200, JSON.stringify(corps));
    assert.deepEqual(await r.json(), { success: true, apercu: true });
  }
  assert.deepEqual(operations, [], 'identité fictive : ni lecture ni écriture');

  // Base en panne : l'aperçu n'en dépend pas (un profil illisible → 503 aurait bloqué le démarrage pareil).
  fautes['profiles:select'] = '57014';
  fautes['profiles:update'] = '57014';
  assert.equal((await renommer({ city: 'Ségou' })).status, 200);
  fautes = {};

  // L'administrateur voit les mêmes refus qu'un revendeur : la règle du nom réservé se vérifie en aperçu.
  let r = await renommer({ fullName: 'Suguba Officiel', city: 'Ségou' });
  assert.equal(r.status, 400);
  assert.match((await r.json()).error, /réservé à Suguba/);
  r = await renommer({ fullName: ' A ' });
  assert.equal(r.status, 400);
  assert.match((await r.json()).error, /Nom trop court/);
  assert.deepEqual(operations, []);
  assert.deepEqual([profil('rev-1').full_name, profil('rev-1').city, nomDe('s1')], ['Awa Traore Dialo', 'Bamako', 'Awa Traore Dialo']);

  // Un vrai revendeur : rien ne change (réponse sans `apercu`, écriture faite, refus identiques).
  sessionCourante = revendeur('rev-1');
  r = await renommer({ city: 'Ségou' });
  assert.deepEqual([r.status, await r.json()], [200, { success: true }]);
  assert.equal(profil('rev-1').city, 'Ségou');
  assert.equal((await renommer({ fullName: 'Admin' })).status, 400);
  // Profil illisible ET nom refusé : le refus du nom, sans rien lire (avant : 503).
  operations = [];
  fautes['profiles:select'] = '57014';
  assert.equal((await renommer({ fullName: 'Admin' })).status, 400);
  assert.deepEqual(operations, []);
  assert.equal((await renommer({ fullName: 'Awa Traoré Diallo' })).status, 503, 'nom valide, profil illisible : toujours 503');
  assert.deepEqual(ecritures(), []);
  fautes = {};

  // L'aperçu d'un autre rôle n'ouvre pas la route ; sans session non plus.
  sessionCourante = { ...apercuRevendeur(), uid: 'apercu-supplier', role: 'supplier', roles: { supplier: 'active' } };
  assert.equal((await renommer({ city: 'Ségou' })).status, 401);
  sessionCourante = null;
  assert.equal((await renommer({ city: 'Ségou' })).status, 401);
});

test('G — aperçu administrateur : le démarrage avance d’étape en étape (il restait bloqué à « Vous ») et se termine ; aucun profil n’est écrit', async () => {
  const appels = [];
  global.fetch = versLesRoutes(appels);
  global.window = { location: { origin: 'http://localhost' } };
  try {
    const demarrer = async () => {
      const ecran = monterPage(PAGE_DEMARRER);
      let arbre = await ecran.monter();
      return {
        etape: () => texteDe(trouver(arbre, (e) => e.type === 'h1')),
        saisir(id, valeur) { ecran.champs(arbre, id)[0].props.onChange(valeur); arbre = ecran.rendre(); },
        async toucher(libelle) {
          const [bouton] = ecran.boutons(arbre, libelle);
          assert.ok(bouton && !bouton.props.disabled, `« ${libelle} » actif à l’étape « ${texteDe(trouver(arbre, (e) => e.type === 'h1'))} »`);
          bouton.props.onClick();
          await ecran.attendre();
          arbre = ecran.rendre();
        },
        texte: () => texteDe(arbre),
      };
    };
    /** Les cinq premières étapes : Vous, Téléphone, Ville, Adresse, Localisation. */
    const jusquALaBoutique = async (ecran) => {
      assert.equal(ecran.etape(), 'Vous');
      ecran.saisir('nom', { target: { value: 'Awa Test' } });
      await ecran.toucher('Continuer');
      assert.equal(ecran.etape(), 'Téléphone', 'le défaut relevé : « Aperçu : rien n’est enregistré. », étape inchangée');
      await ecran.toucher('Continuer');
      assert.equal(ecran.etape(), 'Ville');
      await ecran.toucher('Continuer');
      assert.equal(ecran.etape(), 'Adresse');
      ecran.saisir('quartier', 'Hamdallaye');
      await ecran.toucher('Continuer');
      assert.equal(ecran.etape(), 'Localisation');
      await ecran.toucher('Continuer');
      assert.equal(ecran.etape(), 'Boutique');
      assert.deepEqual(messages, [], 'aucun message d’erreur');
    };
    const enregistrements = () => appels.filter((a) => a[0] !== 'GET');

    // 1. Le compte d'aperçu n'a pas de boutique : cinq étapes passent, puis la création est
    //    refusée avec sa raison (règle du lot 2, inchangée). Rien n'est écrit nulle part.
    baseNoms();
    sessionCourante = apercuRevendeur();
    messages = [];
    let ecran = await demarrer();
    await jusquALaBoutique(ecran);
    assert.deepEqual(enregistrements(), [
      ['PATCH', '/api/reseller/me', { fullName: 'Awa Test' }],
      ['PATCH', '/api/reseller/me', { city: 'Bamako' }],
      ['PATCH', '/api/reseller/me', { neighborhood: 'Hamdallaye', address: '' }],
    ]);
    ecran.saisir('boutique', { target: { value: 'Chez Test' } });
    await ecran.toucher('Continuer');
    assert.equal(ecran.etape(), 'Boutique');
    assert.deepEqual(messages, [['Aperçu : rien n’est enregistré.', { ton: 'erreur' }]]);
    assert.deepEqual(ecritures(), []);
    assert.equal(sur('profiles', 'update').length, 0);

    // 2. Le compte d'aperçu a déjà une boutique (ouverte par une version précédente) : les 8 étapes
    //    passent, « Ouvrir ma boutique » termine. Seule la boutique d'aperçu est écrite, comme avant.
    baseNoms();
    etat.stores.push({ id: 'ap1', owner_type: 'reseller', owner_id: 'apercu-reseller', slug: 'revendeur-suguba', name: 'Revendeur Suguba', status: 'active', principale: true, created_at: '2026-09-12T00:00:00Z' });
    sessionCourante = apercuRevendeur();
    messages = []; navigations = []; appels.length = 0;
    ecran = await demarrer();
    await jusquALaBoutique(ecran);
    ecran.saisir('boutique', { target: { value: 'Chez Test' } });
    await ecran.toucher('Continuer');
    assert.equal(ecran.etape(), 'Catégories');
    await ecran.toucher('Continuer');
    assert.equal(ecran.etape(), 'C’est parti');
    await ecran.toucher('Ouvrir ma boutique');
    assert.deepEqual(messages, []);
    assert.deepEqual(navigations, [require('../src/lib/reseau/porte-boutique.ts').PORTE_MA_BOUTIQUE]);
    assert.deepEqual(enregistrements().filter((a) => a[1] === '/api/reseller/me').map((a) => a[2]), [
      { fullName: 'Awa Test' }, { city: 'Bamako' }, { neighborhood: 'Hamdallaye', address: '' }, { categories: [] }, { onboardingDone: true },
    ]);
    assert.equal(sur('profiles', 'update').length, 0, 'aucun profil écrit');
    assert.equal(nomDe('ap1'), 'Chez Test');
    assert.ok(ecritures().length > 0 && ecritures().every((o) => o.table === 'stores' && o.egalites.id === 'ap1'), 'seule la boutique du compte d’aperçu');
    assert.deepEqual([profil('rev-1').full_name, nomDe('s1')], ['Awa Traore Dialo', 'Awa Traore Dialo']);
  } finally { global.fetch = RESEAU_INTERDIT; delete global.window; }

  // « Mon profil vérifié », étape du quartier : même appel, jugé sur la seule réussite de la réponse.
  const verification = sansCommentaires(lire('src/app/reseller/verification/page.tsx'));
  assert.match(verification, /fetch\('\/api\/reseller\/me', \{ method: 'PATCH',[^;]*body: JSON\.stringify\(\{ neighborhood: quartier \}\) \}\); if \(!r\.ok\) throw new Error\(\);/);
  // Le démarrage juge pareil : une réponse réussie fait avancer, sans autre condition.
  assert.match(sansCommentaires(lire('src/app/reseller/demarrer/page.tsx')), /if \(!reponse\.ok\) throw new Error\(\(await reponse\.json\(\)\)\.error \|\| 'Enregistrement impossible\.'\);/);
});

// ══ Guide et reprise ═════════════════════════════════════════════════════════

test('Guide : l’entrée de la relecture finale est en tête, en ligne, avec ses écarts ; fiches à jour ; REPRISE', () => {
  const guide = JSON.parse(lire('docs/guide/guide.json'));
  assert.ok(guide.majLe >= '2026-10-04');
  // Le journal continue après elle (SQL exécuté en production, etc.) : on la cherche par son
  // titre, et on vérifie seulement ce qui la suit.
  const rang = guide.journal.findIndex((j) => j.titre === 'Boutique revendeur : corrections de la relecture finale');
  assert.ok(rang >= 0, 'entrée de la relecture finale');
  const entree = guide.journal[rang];
  assert.equal(entree.date, '2026-10-04');
  assert.equal(entree.statut, 'en ligne');
  assert.equal(entree.demande, '« une fois finis tu lance le code sans t\'arrêter ensuite tu met en ligne sans t\'arrêter ni me poser de question »');
  assert.ok(entree.realise.length >= 6, 'les six constats');
  assert.ok(entree.ecarts.length >= 2);
  for (const id of ['mes-boutiques', 'adm-boutiques', 'vitrine-boutique', 'rev-boutique-stats', 'rev-demarrer', 'inscription-fin']) assert.ok(entree.pages.includes(id), id);
  for (const id of entree.pages) assert.ok(guide.pages.some((p) => p.id === id), id);
  assert.equal(guide.journal[rang + 1].titre, 'Boutique revendeur : vérification à l’écran, captures et mise en ligne');

  const fiche = (id) => JSON.stringify(guide.pages.find((p) => p.id === id));
  assert.match(fiche('mes-boutiques'), /Articles indisponibles pour le moment/);
  assert.match(fiche('mes-boutiques'), /Réessayer/);
  assert.match(fiche('adm-boutiques'), /Awa D\./);
  assert.match(fiche('vitrine-boutique'), /Revendeur partenaire/);
  assert.match(fiche('rev-boutique-stats'), /30 visites/);
  assert.match(fiche('rev-demarrer'), /réservé à Suguba/);
  assert.match(fiche('inscription-fin'), /réservé à Suguba/);
  // Ce qui reste à faire ou à savoir est dit.
  const ecarts = entree.ecarts.join('\n');
  assert.match(ecarts, /A-EXECUTER-2026-10-03-vitrine-boutique\.sql/);
  assert.match(ecarts, /même adresse/);
  assert.ok(lire('REPRISE.md').split('\n').some((l) => l.startsWith('> **4 octobre 2026') && /corrections de la relecture finale/.test(l)));

  // Contre-relecture (G) : l'aperçu administrateur est dit, là où le fondateur le cherche.
  assert.ok(entree.realise.some((l) => /Contre-relecture/.test(l) && /aperçu administrateur/.test(l) && /Continuer/.test(l)));
  assert.match(ecarts, /En aperçu administrateur, le démarrage revendeur n’enregistre rien/);
  assert.match(ecarts, /Nom de votre boutique » y reste refusée/);
  assert.ok(entree.pages.includes('adm-parametres'));
  assert.match(guide.pages.find((p) => p.id === 'rev-demarrer').elements.find((e) => e.nom === 'Continuer').role, /En aperçu administrateur[^.]*sans rien enregistrer/);
  assert.match(guide.pages.find((p) => p.id === 'adm-parametres').elements.find((e) => e.nom === 'Tester un profil').role, /le démarrage du revendeur n’y enregistre rien/);
  const reprise = lire('REPRISE.md').split('\n').find((l) => l.startsWith('> **4 octobre 2026') && /corrections de la relecture finale/.test(l));
  assert.match(reprise, /\{ success: true, apercu: true \}/);
  assert.doesNotMatch(reprise, /refuse l'aperçu admin \(403\)/, 'ce n’est plus vrai');
});
