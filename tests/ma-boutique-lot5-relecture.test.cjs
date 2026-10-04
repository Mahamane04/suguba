// TEST-BOUTIQUE-LOT5-030..040 (chantier boutique du revendeur, 2026-10-03,
// relecture du lot 5 « Prévenir mes abonnés ») : un emoji coupé en deux dans un nom
// d'article ne fait plus tomber « Mes articles » ni les Statistiques, et n'empêche
// plus l'annonce de partir ; un nom de boutique qui annonce un prix, une remise ou
// un numéro n'entre pas dans le titre de l'annonce ; le sous-titre de la feuille dit
// ce que l'écran propose vraiment ; après l'envoi, le résultat et « Publier sur mon
// statut WhatsApp » restent accessibles ; « Baisse de prix » écrit ses montants
// comme partout ; le guide ne dit plus que les promotions « n'existent pas ».
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

// ── Base simulée ────────────────────────────────────────────────────────────
// Comme Postgres : une demi-paire isolée (emoji coupé en deux) est REFUSÉE à
// l'écriture d'un texte (22P05, « unsupported Unicode escape sequence »).
let etat; let fautes; let operations; let serie;
function reinitialiser() {
  etat = {
    stores: [], profiles: [], profile_roles: [], reseller_shop_items: [], products: [], analytics_events: [],
    store_follows: [], notifications: [], tracking_links: [],
  };
  fautes = {}; operations = []; serie = 1;
}
const valeur = (r, k) => {
  if (k.includes('->>')) { const [col, cle] = k.split('->>'); return r[col] ? r[col][cle] : undefined; }
  return r[k];
};
const comparer = (a, b) => (typeof a === 'number' && typeof b === 'number' ? a - b : String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0);
const malForme = (p) => Object.values(p || {}).some((v) => typeof v === 'string' && !v.isWellFormed());
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
        operations.push({ table, op, patch });
        const repondre = (r) => Promise.resolve(r).then(resolve, reject);
        if (fautes[`${table}:${op}`]) return repondre({ data: null, count: null, error: { code: fautes[`${table}:${op}`] } });
        if (op === 'insert' && (Array.isArray(patch) ? patch : [patch]).some(malForme)) {
          return repondre({ data: null, count: null, error: { code: '22P05' } });
        }
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
        if (un && lignes.length > 1) return repondre({ data: null, count: null, error: { code: 'PGRST116' } });
        const data = tete ? null : un ? (lignes[0] ? { ...lignes[0] } : null) : lignes.map((r) => ({ ...r }));
        return repondre({ data, count: lignes.length, error: null });
      },
    };
    return q;
  },
  async rpc() { return { data: null, error: null }; },
};
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
    ? React.createElement('section', { 'data-feuille': titre }, React.createElement('p', { 'data-sous-titre': '' }, sousTitre), children, React.createElement('footer', null, pied))
    : null) },
};

const { NextRequest } = require('next/server');
const requete = (url, init = {}) => new NextRequest(`http://localhost${url}`, {
  ...init, headers: { cookie: 'suguba_session=simule', 'content-type': 'application/json', ...(init.headers || {}) },
});
const ROUTE = '../src/app/api/reseller/boutique/annonce/route.ts';
const lireAnnonce = () => require(ROUTE).GET(requete('/api/reseller/boutique/annonce'));
const annoncer = () => require(ROUTE).POST(requete('/api/reseller/boutique/annonce', { method: 'POST' }));

const IL_Y_A = (heures) => new Date(Date.now() - heures * 3600 * 1000).toISOString();
const produit = (id, enPlus = {}) => ({
  id, slug: `slug-${id}`, name: `Article ${id}`, category: 'Mode', images: [], public_price: 10000, stock: 5,
  reseller_commission: 1000, pricing_status: 'ok', status: 'approved', ...enPlus,
});
/** 75 caractères, l'emoji à cheval sur la coupe des 60 (unités 59 et 60). */
const NOM_EMOJI = 'Robe en bazin riche brodée main, modèle grand boubou de fêt😀 taille unique';
/** Awa (rev-1) : 2 articles récents, 2 abonnés avec compte et 1 par téléphone. */
function baseAwa() {
  reinitialiser();
  etat.profiles = [{ id: 'rev-1', full_name: 'Awa Traoré Diallo', reseller_code: 'AWA1', metadata: {} }];
  etat.stores = [{ id: 's1', owner_type: 'reseller', owner_id: 'rev-1', slug: 'awa-mode', name: 'Awa Mode', status: 'active', created_at: '2026-09-01T00:00:00Z' }];
  etat.products = [produit('a', { name: 'Pagne wax' }), produit('b', { name: 'Théière' })];
  etat.reseller_shop_items = [
    { reseller_id: 'rev-1', product_id: 'a', position: 0, added_at: IL_Y_A(2) },
    { reseller_id: 'rev-1', product_id: 'b', position: 1, added_at: IL_Y_A(5) },
  ];
  etat.store_follows = [
    { store_id: 's1', follower_key: 'p:c1', follower_id: 'c1' },
    { store_id: 's1', follower_key: 'p:c2', follower_id: 'c2' },
    { store_id: 's1', follower_key: 't:22370000001', follower_id: null },
  ];
  sessionCourante = revendeur('rev-1');
}
const texteDe = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, '\'').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ');

// ── 1. Un emoji coupé en deux ───────────────────────────────────────────────

test('texte-entier : une coupe ne laisse jamais une demi-paire ; un emoji entier est gardé', () => {
  const { texteBienForme, couperTexte } = require('../src/lib/texte-entier.ts');
  assert.equal(texteBienForme('Robe 😀 wax'), 'Robe 😀 wax', 'un emoji entier ne bouge pas');
  assert.equal(texteBienForme('fêt\ud83d taille'), 'fêt taille', 'demi-paire haute isolée retirée');
  assert.equal(texteBienForme('\ude00Bol'), 'Bol', 'demi-paire basse isolée retirée');
  assert.equal(texteBienForme(null), '');
  assert.equal(couperTexte('ab😀cd', 3), 'ab', 'coupe au milieu de l’emoji : il part en entier');
  assert.equal(couperTexte('ab😀cd', 4), 'ab😀');
  assert.equal(couperTexte('abc', 10), 'abc');
  assert.ok(couperTexte(`${'x'.repeat(139)}😀`, 140).isWellFormed());
  assert.equal(couperTexte(`${'x'.repeat(139)}😀`, 140).length, 139);
});

test('annonce-boutique : un nom d’article avec un emoji à cheval sur la coupe des 60 reste bien formé', () => {
  const A = require('../src/lib/annonce-boutique.ts');
  assert.equal(NOM_EMOJI.length, 75);
  assert.equal(NOM_EMOJI.indexOf('😀'), 59);
  const ok = { id: 'p', status: 'approved', stock: 3, reseller_commission: 500, pricing_status: 'ok' };
  const nomCite = (name) => A.nouveautesAAnnoncer([{ product_id: 'p', added_at: new Date().toISOString() }], [{ ...ok, name }], Date.now() - 3600 * 1000)[0].nom;
  const cite = nomCite(NOM_EMOJI);
  assert.ok(cite.isWellFormed(), 'avant : « …de fêt\\ud83d », une demi-paire isolée');
  assert.equal(cite, 'Robe en bazin riche brodée main, modèle grand boubou de fêt');
  // L'emoji tient en entier dans les 60 : gardé. Au-delà : absent. Jamais plus de 60.
  const decale = (n) => `${'x'.repeat(n)}😀 suite du nom`;
  assert.equal(nomCite(decale(58)), `${'x'.repeat(58)}😀`);
  assert.equal(nomCite(decale(59)), 'x'.repeat(59));
  assert.equal(nomCite(decale(60)), 'x'.repeat(60));
  for (let n = 55; n <= 62; n++) assert.ok(nomCite(decale(n)).isWellFormed() && nomCite(decale(n)).length <= 60, `emoji à l’indice ${n}`);

  const contenu = A.contenuAnnonce({ nomBoutique: `Chez ${'A'.repeat(54)}😀 Mode`, slug: 'x', nouveautes: [{ nom: NOM_EMOJI }, { nom: decale(59) }] });
  assert.ok(contenu.titre.isWellFormed() && contenu.texte.isWellFormed() && contenu.noms.every((n) => n.isWellFormed()));
  assert.ok(contenu.titre.length <= 140 && contenu.texte.length <= 400, 'tient toujours dans une notification');
  // Le texte du statut WhatsApp s'encode toujours, même avec un état mal formé reçu d'ailleurs.
  const statut = A.texteStatutAnnonce({ titre: 'Nouveautés chez fêt\ud83d', noms: ['Bol \ud83d'], url: 'https://app.sugubaml.com/go/AB78X2' });
  assert.ok(statut.isWellFormed());
  assert.doesNotThrow(() => encodeURIComponent(statut));
});

test('Annonce : avec un tel article, la lecture reste bien formée et l’annonce PART (avant : 503 à chaque essai)', async () => {
  baseAwa();
  etat.products[0].name = NOM_EMOJI;
  const lu = await (await lireAnnonce()).json();
  assert.equal(lu.nouveautes, 2);
  assert.ok(lu.apercu.noms.every((n) => n.isWellFormed()) && lu.apercu.texte.isWellFormed());
  assert.equal(lu.apercu.texte, 'À découvrir : Robe en bazin riche brodée main, modèle grand boubou de fêt et Théière.');

  const r = await annoncer();
  assert.equal(r.status, 200, 'la base refuse une demi-paire isolée : l’annonce ne partait jamais');
  assert.equal((await r.json()).prevenus, 2);
  assert.equal(etat.notifications.length, 2);
  assert.ok(etat.notifications.every((n) => n.title.isWellFormed() && n.body.isWellFormed()));

  // notifier coupe le titre (140) et le texte (400) : jamais au milieu d'un emoji.
  const { notifier } = require('../src/lib/reseau/notifications.ts');
  reinitialiser();
  assert.equal(await notifier(['c1'], { titre: `${'t'.repeat(139)}😀 suite`, texte: `${'x'.repeat(399)}😀 suite` }), 1, 'avant : écriture refusée, personne n’était prévenu');
  assert.equal(etat.notifications[0].title, 't'.repeat(139));
  assert.equal(etat.notifications[0].body, 'x'.repeat(399));
  const notifications = sansCommentaires(lire('src/lib/reseau/notifications.ts'));
  assert.match(notifications, /title: couperTexte\(contenu\.titre, 140\)/);
  assert.match(notifications, /body: contenu\.texte \? couperTexte\(contenu\.texte, 400\) : null/);
});

const APERCU = { titre: 'Nouveautés chez Awa Mode', texte: 'À découvrir : Pagne wax et Théière.', lien: '/boutique/awa-mode', noms: ['Pagne wax', 'Théière'] };
const etatAnnonce = (enPlus = {}) => ({ nouveautes: 2, apercu: APERCU, abonnesAvecCompte: 12, abonnesSansCompte: 3, derniereAnnonce: null, possibleLe: null, ...enPlus });
function rendreFeuille(props = {}) {
  const Feuille = require('../src/components/shop/proprietaire/FeuilleAnnonce.tsx').default;
  return renderToStaticMarkup(React.createElement(Feuille, {
    ouvert: true, onFermer() {}, etat: etatAnnonce(), resultat: null, envoi: false, erreur: null, onEnvoyer() {},
    urlStatut: 'https://app.sugubaml.com/go/AB78X2', ...props,
  }));
}
const DEMAIN = new Date(Date.now() + 6 * 3600 * 1000).toISOString();
const MODES = {
  prete: {},
  envoyee: { resultat: { prevenus: 11, sansCompte: 3, possibleLe: DEMAIN } },
  limite: { etat: etatAnnonce({ possibleLe: DEMAIN }) },
  sans_compte: { etat: etatAnnonce({ abonnesAvecCompte: 0, abonnesSansCompte: 4 }) },
};

test('FeuilleAnnonce : un nom mal formé ne fait jamais tomber la page — 4 modes, feuille ouverte et fermée', () => {
  // L'état tel que l'ancienne lecture le renvoyait : une demi-paire dans le nom cité.
  const casse = { titre: 'Nouveautés chez Awa Mode', texte: 'À découvrir : Robe de fêt\ud83d.', lien: '/boutique/awa-mode', noms: ['Robe de fêt\ud83d'] };
  for (const [mode, props] of Object.entries(MODES)) {
    const etatCasse = { ...(props.etat || etatAnnonce()), apercu: casse };
    for (const ouvert of [false, true]) {
      let html;
      assert.doesNotThrow(() => { html = rendreFeuille({ ...props, etat: etatCasse, ouvert }); }, `${mode}, ${ouvert ? 'ouverte' : 'fermée'} : avant, URIError au rendu`);
      if (!ouvert) assert.equal(html, '', `${mode} : feuille fermée, rien`);
      else if (mode !== 'prete') {
        const lien = (html.match(/href="(https:\/\/api\.whatsapp\.com\/send\?text=[^"]+)"/) || [])[1];
        assert.ok(lien, `${mode} : lien du statut`);
        const envoye = decodeURIComponent(lien.replace(/&amp;/g, '&').split('text=')[1]);
        assert.ok(envoye.isWellFormed());
        assert.match(envoye, /• Robe de fêt\n/, 'le nom, sans la demi-paire');
        assert.match(texteDe(html), /• Robe de fêt ✅/, 'le message montré est celui qui part');
      }
    }
  }
  // Feuille fermée : ni message ni lien ne sont composés.
  const feuille = sansCommentaires(lire('src/components/shop/proprietaire/FeuilleAnnonce.tsx'));
  assert.ok(feuille.indexOf('if (!ouvert) return') > 0 && feuille.indexOf('if (!ouvert) return') < feuille.indexOf('texteStatutAnnonce('), 'fermée : retour avant de composer le message');
});

// ── 2. Le nom de la boutique dans le titre ──────────────────────────────────

test('Annonce : un nom de boutique qui annonce un prix, une remise ou un numéro n’entre pas dans le titre (« Awa D. » à la place)', async () => {
  const A = require('../src/lib/annonce-boutique.ts');
  for (const nom of ['Awa Mode', 'Bamako 2000', 'Mode 223', 'Chez Awa & Filles', 'Écran 4K Bamako', 'Boutique N°1', 'Awa D.']) {
    assert.equal(A.nomAnnoncable(nom), true, nom);
  }
  for (const nom of ['Soldes -50 % tout à 5 000 F', 'Tout à 5 000 F', 'Pagnes 2500fr', 'Mode -20%', 'Promo 30 ce week-end', '2 pour 1 chez Awa',
    'Awa 10k', 'Appelez 76 12 34 56', 'Awa +223 76123456', 'WhatsApp 76.12.34.56', 'Dix pour cent chez Awa']) {
    assert.equal(A.nomAnnoncable(nom), false, nom);
  }
  assert.equal(A.nomBoutiqueAnnonce('Awa Mode', 'Awa Traoré Diallo'), 'Awa Mode');
  assert.equal(A.nomBoutiqueAnnonce('Awa Traoré Diallo', 'Awa Traoré Diallo'), 'Awa D.', 'jamais le nom complet');
  assert.equal(A.nomBoutiqueAnnonce('Soldes -50 % tout à 5 000 F', 'Awa Traoré Diallo'), 'Awa D.');
  assert.equal(A.nomBoutiqueAnnonce('Appelez 76 12 34 56', null), 'Revendeur Suguba');

  // De bout en bout : lecture, puis notification écrite.
  baseAwa();
  etat.stores[0].name = 'Soldes -50 % tout à 5 000 F';
  const lu = await (await lireAnnonce()).json();
  assert.equal(lu.apercu.titre, 'Nouveautés chez Awa D.', 'avant : « Nouveautés chez Soldes -50 % tout à 5 000 F »');
  assert.equal((await annoncer()).status, 200);
  const ecrit = JSON.stringify(etat.notifications);
  assert.doesNotMatch(ecrit, /%|\d\s?F\b|Soldes|Traoré|Diallo/, 'ni prix, ni remise, ni nom complet chez les abonnés');
  assert.ok(etat.notifications.every((n) => n.title === 'Nouveautés chez Awa D.'));
  const route = sansCommentaires(lire('src/app/api/reseller/boutique/annonce/route.ts'));
  assert.match(route, /lu\.nomBoutique = nomBoutiqueAnnonce\(boutique\.nom, /);

  // Le message d'une affiche garde sa règle (lot 3) : un nombre seul y reste refusé.
  const { refusMessageAffiche, promesseChiffree } = require('../src/lib/message-affiche.ts');
  assert.match(refusMessageAffiche('Bamako 2000') || '', /Pas de prix ni de montant/);
  assert.equal(refusMessageAffiche('Nouveau'), null);
  assert.equal(promesseChiffree('Bamako 2000'), 'montant');
  assert.equal(promesseChiffree('Bamako 2000', { nombreSeul: false }), null);
  assert.equal(promesseChiffree('Tout à 5 000', { nombreSeul: false }), 'montant', 'milliers séparés : un prix');
  assert.equal(promesseChiffree('-10 %'), 'pourcentage');
  assert.equal(promesseChiffree('Promo 30'), 'remise');
});

// ── 3. Sous-titre de la feuille ─────────────────────────────────────────────

test('FeuilleAnnonce : le sous-titre dit ce que l’écran propose — notifications quand elles partent, statut WhatsApp sinon', () => {
  const A = require('../src/lib/annonce-boutique.ts');
  const NOTIFICATIONS = 'Vos nouveautés, dans leurs notifications Suguba.';
  const STATUT = 'Vos nouveautés, sur votre statut WhatsApp.';
  assert.equal(A.sousTitreAnnonce('prete'), NOTIFICATIONS);
  assert.equal(A.sousTitreAnnonce('envoyee'), NOTIFICATIONS);
  assert.equal(A.sousTitreAnnonce('limite'), STATUT);
  assert.equal(A.sousTitreAnnonce('sans_compte'), STATUT);
  const sousTitre = (html) => (html.match(/<p data-sous-titre="">([^<]*)<\/p>/) || [])[1];
  assert.equal(sousTitre(rendreFeuille(MODES.prete)), NOTIFICATIONS);
  assert.equal(sousTitre(rendreFeuille(MODES.envoyee)), NOTIFICATIONS);
  assert.equal(sousTitre(rendreFeuille(MODES.limite)), STATUT);
  const sansCompte = rendreFeuille(MODES.sans_compte);
  assert.equal(sousTitre(sansCompte), STATUT, 'avant : « dans leurs notifications Suguba », alors que personne ne peut être prévenu');
  assert.match(sansCompte, /Aucun de vos abonnés n’a de compte Suguba\./);
  assert.doesNotMatch(sansCompte, /notifications Suguba/);
});

// ── 4. Après l'envoi : le résultat reste accessible ─────────────────────────
//
// Pas de DOM dans node:test : le composant est appelé comme une fonction, avec des
// crochets React SIMULÉS pour lui seul (même montage que ma-boutique-lot5).

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
  return {
    rendre() {
      curseur = 0; curseurRef = 0; effets = [];
      const arbre = Bouton(props);
      if (!arbre) return { bouton: null, feuille: null };
      const enfants = React.Children.toArray(arbre.props.children);
      return { bouton: enfants.find((e) => e.props && e.props['aria-haspopup'] === 'dialog') || null, feuille: enfants.find((e) => e.props && 'etat' in e.props) || null };
    },
    async effets() { effets.forEach((f, i) => { if (i > 0 || premier) f(); }); premier = false; await attendre(); },
  };
}
const libelle = (bouton) => texteDe(renderToStaticMarkup(bouton)).trim();
function brancherRoutes() {
  global.fetch = async (url, init = {}) => {
    const module = String(url) === '/api/reseller/boutique/partage'
      ? require('../src/app/api/reseller/boutique/partage/route.ts') : require(ROUTE);
    const r = await module[init.method || 'GET'](requete(String(url), { method: init.method || 'GET', ...(init.body ? { body: init.body } : {}) }));
    return { ok: r.status >= 200 && r.status < 300, status: r.status, json: () => r.json() };
  };
}

test('BoutonAnnonce : après l’envoi, « Annonce envoyée · Publier sur mon statut » rouvre le résultat (avant : perdu dès la feuille fermée)', async () => {
  const A = require('../src/lib/annonce-boutique.ts');
  assert.equal(A.LIBELLE_ANNONCE_ENVOYEE, 'Annonce envoyée · Publier sur mon statut');
  brancherRoutes();
  try {
    baseAwa();
    const page = monterBouton();
    page.rendre();
    await page.effets();
    let vue = page.rendre();
    assert.equal(libelle(vue.bouton), 'Prévenir mes abonnés (2 nouveautés)');
    vue.bouton.props.onClick();
    await page.rendre().feuille.props.onEnvoyer();
    assert.equal(etat.notifications.length, 2);

    // L'envoi est fait : le bouton d'annonce laisse la place à l'accès au résultat.
    vue = page.rendre();
    assert.equal(libelle(vue.bouton), 'Annonce envoyée · Publier sur mon statut');
    assert.equal(vue.bouton.props.variant, 'ghost', 'ni l’action principale, ni un second envoi');
    assert.equal(vue.bouton.props.type, 'button');
    assert.equal(vue.feuille.props.ouvert, true);

    // Feuille fermée (fond, croix, Échap) : le résultat n'est plus perdu.
    vue.feuille.props.onFermer();
    vue = page.rendre();
    assert.equal(vue.feuille.props.ouvert, false);
    assert.equal(libelle(vue.bouton), 'Annonce envoyée · Publier sur mon statut');
    vue.bouton.props.onClick();
    vue = page.rendre();
    assert.equal(vue.feuille.props.ouvert, true);
    assert.deepEqual([vue.feuille.props.resultat.prevenus, vue.feuille.props.resultat.sansCompte], [2, 1]);
    assert.equal(A.modeAnnonce(vue.feuille.props.etat, Boolean(vue.feuille.props.resultat)), 'envoyee');
    // Le rouvrir n'envoie rien.
    assert.equal(etat.notifications.length, 2);
    assert.equal(etat.analytics_events.filter((e) => e.event === 'STORE_ANNOUNCE').length, 1);
  } finally {
    global.fetch = RESEAU_INTERDIT;
  }
});

// ── 5. « Baisse de prix » : les montants comme partout ──────────────────────

test('annoncerBaissePrix : « 120 000 F au lieu de 150 000 F », avec formatF (espace insécable, comme partout)', async () => {
  const { annoncerBaissePrix } = require('../src/lib/reseau/notifications.ts');
  const { formatF } = require('../src/lib/montant.ts');
  assert.equal(formatF(120000), '120 000 F');
  reinitialiser();
  etat.products = [produit('tv', { name: 'Téléviseur', slug: 'televiseur', supplier_id: 'four-1' })];
  etat.stores = [{ id: 'b1', owner_type: 'supplier', owner_id: 'four-1', name: 'Électro Bamako', principale: true, created_at: '2026-01-01T00:00:00Z' }];
  etat.store_follows = [{ store_id: 'b1', follower_key: 'p:c1', follower_id: 'c1' }];
  await annoncerBaissePrix('tv', 150000, 120000);
  assert.equal(etat.notifications.length, 1);
  assert.equal(etat.notifications[0].kind, 'promotion');
  assert.equal(etat.notifications[0].title, 'Baisse de prix chez Électro Bamako');
  assert.equal(etat.notifications[0].body, 'Téléviseur : 120 000 F au lieu de 150 000 F.', 'avant : l’espace fine d’Intl (U+202F)');
  const src = sansCommentaires(lire('src/lib/reseau/notifications.ts'));
  assert.match(src, /import \{ formatF \} from '\.\.\/montant';/);
  assert.doesNotMatch(src, /toLocaleString/);
});

// ── 6. Guide et reprise ─────────────────────────────────────────────────────

test('Guide : relecture du lot 5 juste avant le lot 5 ; les promotions ne sont plus dites « inexistantes » ; fiches et REPRISE à jour', () => {
  const guide = JSON.parse(lire('docs/guide/guide.json'));
  assert.ok(guide.majLe >= '2026-10-03');
  const rang = guide.journal.findIndex((j) => j.titre === 'Boutique revendeur, lot 5 : corrections de relecture');
  assert.ok(rang >= 0, 'entrée de relecture');
  const relecture = guide.journal[rang];
  assert.equal(guide.journal[rang + 1].titre, 'Boutique revendeur, lot 5 : prévenir mes abonnés');
  assert.equal(relecture.date, '2026-10-03');
  assert.ok(['en local', 'en ligne'].includes(relecture.statut));
  assert.match(relecture.demande, /^« “Ma boutique” doit montrer la boutique elle-même/);
  assert.ok(relecture.realise.length >= 6);
  assert.ok(relecture.ecarts.length > 0);
  for (const id of ['rev-boutique-articles', 'rev-boutique-stats', 'notifications']) assert.ok(relecture.pages.includes(id), id);
  assert.match(relecture.ecarts.join('\n'), /à valider par le fondateur/i);

  // L'entrée du lot 5 ne se contredit plus : les baisses de prix des fournisseurs existent.
  const lot5 = guide.journal[rang + 1];
  const suivre = lot5.realise.find((r) => r.startsWith('« Suivre » une boutique'));
  assert.doesNotMatch(suivre, /qui n’existent pas/);
  assert.match(suivre, /Baisse de prix chez/);
  // Les commentaires du code disent la même chose (le texte affiché ne change pas).
  const bouton = lire('src/components/shop/BoutonSuivre.tsx');
  assert.doesNotMatch(bouton, /qu'aucune boutique ne propose/);
  assert.match(bouton, /Baisse de prix chez/);
  assert.match(bouton, /Vous serez prévenu des nouveautés de cette boutique\./);
  assert.doesNotMatch(lire('src/app/boutiques-suivies/page.tsx'), /Aucune boutique ne propose de promotion/);

  const fiche = (id) => JSON.stringify(guide.pages.find((p) => p.id === id));
  assert.match(fiche('rev-boutique-articles'), /Annonce envoyée · Publier sur mon statut/);
  assert.match(fiche('rev-boutique-stats'), /Annonce envoyée · Publier sur mon statut/);
  assert.match(fiche('rev-boutique-articles'), /Vos nouveautés, sur votre statut WhatsApp/);
  assert.match(fiche('notifications'), /Baisse de prix chez/);
  assert.ok(lire('REPRISE.md').split('\n').some((l) => l.startsWith('> **') && /boutique revendeur, lot 5 : corrections de relecture/.test(l)));
});
