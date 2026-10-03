// TEST-BOUTIQUE-LOT4-030..039 (chantier boutique du revendeur, 2026-10-03,
// relecture du lot 4) : Statistiques qui n'affichent jamais les chiffres d'une
// autre période (2e lecture en échec), conseil WhatsApp seulement si les chiffres
// le montrent, lien de partage préparé en POST (plus d'écriture sur un GET, nom de
// rayon tiré de la boutique), titre public sans enseigne et bandeau lisible sur la
// fiche produit, « 1 250 visites », noms accessibles des boutons « Partager »,
// « Votre message », étape « Partager » non proposée pour une boutique masquée,
// guide complété (carte & QR, créateur, visites /r/ non comptées).
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

// ── Base simulée : chaque opération est enregistrée avec ses filtres ─────────
let etat; let fautes; let operations;
function reinitialiser() {
  etat = { stores: [], profiles: [], profile_roles: [], reseller_shop_items: [], products: [], tracking_links: [], analytics_events: [] };
  fautes = {}; operations = [];
}
const db = {
  from(table) {
    let op = 'select'; let patch; const filtres = []; let un = false; let limite = null; let tri = null;
    const q = {
      select() { return q; },
      eq(k, v) { filtres.push((r) => r[k] === v); return q; },
      neq(k, v) { filtres.push((r) => r[k] !== v); return q; },
      in(k, v) { filtres.push((r) => v.includes(r[k])); return q; },
      ilike(k, v) { filtres.push((r) => String(r[k]).toLowerCase() === String(v).toLowerCase()); return q; },
      gte() { return q; }, gt() { return q; }, is() { return q; }, or() { return q; },
      order(k, o) { tri = { k, asc: !o || o.ascending !== false }; return q; },
      limit(n) { limite = n; return q; },
      insert(p) { op = 'insert'; patch = p; return q; },
      update(p) { op = 'update'; patch = p; return q; },
      upsert(p) { op = 'upsert'; patch = p; return q; },
      delete() { op = 'delete'; return q; },
      maybeSingle() { un = true; return q; },
      then(resolve, reject) {
        operations.push({ table, op, patch });
        if (fautes[`${table}:${op}`]) return Promise.resolve({ data: null, count: null, error: { code: fautes[`${table}:${op}`] } }).then(resolve, reject);
        let lignes = (etat[table] || []).filter((r) => filtres.every((f) => f(r)));
        if (tri) lignes = [...lignes].sort((a, b) => (String(a[tri.k]) < String(b[tri.k]) ? -1 : String(a[tri.k]) > String(b[tri.k]) ? 1 : 0) * (tri.asc ? 1 : -1));
        if (op === 'insert') { const ligne = { created_at: new Date().toISOString(), ...patch }; (etat[table] ||= []).push(ligne); lignes = [ligne]; }
        if (limite !== null && op === 'select') lignes = lignes.slice(0, limite);
        const data = un ? (lignes[0] ? { ...lignes[0] } : null) : lignes.map((r) => ({ ...r }));
        return Promise.resolve({ data, count: lignes.length, error: null }).then(resolve, reject);
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

const marqueur = (nom) => ({ __esModule: true, default: (p) => React.createElement('i', { 'data-marqueur': nom }, p && p.children) });
require.cache[require.resolve('next/link')] = {
  exports: { __esModule: true, default: ({ href, prefetch, children, ...reste }) => React.createElement('a', { href, ...reste }, children) },
};
require.cache[require.resolve('../src/components/shop/proprietaire/PartageBoutique.tsx')] = { exports: marqueur('feuille-partage') };
require.cache[require.resolve('../src/components/reseau/PageReseau.tsx')] = {
  exports: { __esModule: true, default: ({ titre, action, children }) => React.createElement('main', null, React.createElement('h1', null, titre), action, children) },
};

const { NextRequest } = require('next/server');
const requete = (url, init = {}) => new NextRequest(`http://localhost${url}`, {
  ...init, headers: { cookie: 'suguba_session=simule', 'content-type': 'application/json', ...(init.headers || {}) },
});
const produit = (id, enPlus = {}) => ({ id, slug: `slug-${id}`, name: `Article ${id}`, category: 'Mode', status: 'approved', ...enPlus });
function baseAwa() {
  reinitialiser();
  etat.profiles = [{ id: 'rev-1', full_name: 'Awa Traoré Diallo', reseller_code: 'AWA1', metadata: {} }];
  etat.profile_roles = [{ profile_id: 'rev-1', role: 'reseller', status: 'active' }];
  etat.stores = [{ id: 's1', owner_type: 'reseller', owner_id: 'rev-1', slug: 'awa-mode', name: 'Awa Mode', status: 'active' }];
}

// ── Statistiques : jamais les chiffres d'une autre période ───────────────────
//
// Pas de DOM dans node:test : la page est rendue côté serveur avec des crochets
// React SIMULÉS pour elle seule (useState gardé entre deux rendus, useEffect
// rejoué à la main, useCallback identité). Les composants qu'elle affiche
// gardent le vrai React.

const PAGE_STATS = path.join(RACINE, 'src/app/reseller/boutique/statistiques/page.tsx');
let crochets = null;
const fauxReact = {
  ...React, __esModule: true, default: React,
  useState: (init) => crochets.useState(init),
  useEffect: (f, deps) => crochets.useEffect(f, deps),
  useCallback: (f) => f,
};
const chargerOriginal = Module._load;
Module._load = function (demande, parent, ...reste) {
  if (demande === 'react' && parent && parent.filename === PAGE_STATS) return fauxReact;
  return chargerOriginal.call(this, demande, parent, ...reste);
};

function monterStatistiques() {
  const valeurs = []; const setters = []; let curseur = 0; let effets = [];
  crochets = {
    useState(init) {
      const k = curseur++;
      if (!(k in valeurs)) valeurs[k] = typeof init === 'function' ? init() : init;
      setters[k] ||= (v) => { valeurs[k] = typeof v === 'function' ? v(valeurs[k]) : v; };
      return [valeurs[k], setters[k]];
    },
    useEffect(f) { effets.push(f); },
  };
  const Page = require(PAGE_STATS).default;
  return {
    rendre() { curseur = 0; effets = []; return renderToStaticMarkup(React.createElement(Page)); },
    // Effet de la page : la lecture de la période cochée ; on attend sa fin.
    async lire() { for (const f of effets) f(); for (let i = 0; i < 10; i++) await new Promise((r) => setImmediate(r)); },
    setters,
  };
}
const statsDe = (jours, visites) => ({
  jours, boutique: { slug: 'awa-mode', nom: 'Awa Mode', enseigne: true, statut: 'active' },
  visites, visiteurs: 3, serie: Array.from({ length: jours }, (_, i) => ({ jour: `2026-09-${String(i + 1).padStart(2, '0')}`, valeur: 0 })),
  origine: { whatsapp: 0, qr: 0, autre: 0, direct: visites }, clics: 0, commandes: 4, livrees: 1, gains: 3000,
  abonnes: 5, nouveauxAbonnes: 1, articlesVus: [], mesureDepuis: '2026-09-01T10:00:00Z', conseil: null,
});

test('Statistiques : un 2e appel en échec n’affiche jamais les chiffres de 7 jours sous « 30 derniers jours »', async () => {
  const { formatNombre } = require('../src/lib/montant.ts');
  const appels = [];
  global.fetch = async (url) => {
    appels.push(String(url));
    if (String(url).endsWith('jours=7')) return { ok: true, json: async () => statsDe(7, 1250) };
    return { ok: false, status: 503, json: async () => ({ error: 'indisponible' }) };
  };
  try {
    const page = monterStatistiques();
    page.rendre();
    await page.lire();
    let html = page.rendre();
    assert.ok(html.includes(formatNombre(1250)), '7 jours : ses vrais chiffres');
    assert.match(html, /aria-checked="true"[^>]*>7 derniers jours/);

    // Le revendeur coche « 30 derniers jours » ; la lecture échoue (réseau mobile).
    page.setters[0](30);
    html = page.rendre();
    assert.ok(!html.includes(formatNombre(1250)), 'pendant la lecture : pas les chiffres de 7 jours');
    await page.lire();
    html = page.rendre();
    assert.deepEqual(appels, ['/api/reseller/boutique/stats?jours=7', '/api/reseller/boutique/stats?jours=30']);
    assert.match(html, /aria-checked="true"[^>]*>30 derniers jours/);
    assert.ok(!html.includes(formatNombre(1250)), 'aucun chiffre de 7 jours sous l’étiquette 30 jours');
    assert.doesNotMatch(html, /Commandes à votre nom|Gains des ventes livrées/);
    assert.match(html, /Vos statistiques n’ont pas pu être lues/, 'l’erreur, avec « Réessayer »');
    assert.match(html, /Réessayer/);
    assert.match(html, /Partager ma boutique/, 'la boutique ne dépend pas de la période : « Partager » reste');

    // Retour sur 7 jours : ses chiffres reviennent.
    page.setters[0](7);
    await page.lire();
    html = page.rendre();
    assert.ok(html.includes(formatNombre(1250)));
  } finally {
    global.fetch = async () => { throw Error('Réseau externe interdit dans les tests'); };
  }

  const { statsDeLaPeriode } = require('../src/lib/reseau/stats.ts');
  const sept = statsDe(7, 12);
  assert.equal(statsDeLaPeriode(sept, 7), sept);
  assert.equal(statsDeLaPeriode(sept, 30), null);
  assert.equal(statsDeLaPeriode(null, 7), null);
});

test('Statistiques : le pied dit que les visites par l’ancien lien /r/ ne sont pas comptées', () => {
  const page = lire('src/app/reseller/boutique/statistiques/page.tsx');
  assert.match(page, /ancien lien de boutique \(adresse en \/r\/…\) ne sont pas comptés/);
});

// ── Conseil : n'affirmer que ce que montrent les chiffres ───────────────────

test('conseilBoutique : « Vos liens WhatsApp marchent » seulement quand la plupart des visites viennent de WhatsApp', () => {
  const { conseilBoutique } = require('../src/lib/reseau/stats.ts');
  const conseil = (origine) => conseilBoutique({ visites: 12, commandes: 2, coupsDeCoeur: 3, origine });
  // Constat de relecture : 12 visites directes, « Liens WhatsApp : 0 » affiché à côté.
  const direct = conseil({ whatsapp: 0, qr: 0, autre: 0, direct: 12 });
  assert.doesNotMatch(direct, /WhatsApp/, 'rien d’affirmé sur WhatsApp');
  assert.match(direct, /QR/, 'le conseil de la carte avec QR reste');
  assert.doesNotMatch(conseil({ whatsapp: 2, qr: 0, autre: 0, direct: 10 }), /WhatsApp marchent/, '2 sur 12 : pas « marchent »');
  assert.match(conseil({ whatsapp: 6, qr: 0, autre: 0, direct: 6 }), /Vos liens WhatsApp marchent/);
  assert.match(conseil({ whatsapp: 12, qr: 0, autre: 0, direct: 0 }), /Vos liens WhatsApp marchent/);
  assert.match(conseil({ whatsapp: 6, qr: 2, autre: 0, direct: 4 }), /Continuez/, 'QR déjà utilisé : conseil général');
  assert.match(conseilBoutique({ visites: 5, commandes: 2, origine: { whatsapp: 0, qr: 0, autre: 0, direct: 5 } }), /Continuez/);
});

// ── Partage : plus d'écriture sur un GET ────────────────────────────────────

const preparer = (corps, entetes = {}) => require('../src/app/api/reseller/boutique/partage/route.ts')
  .POST(requete('/api/reseller/boutique/partage', { method: 'POST', body: JSON.stringify(corps), headers: entetes }));

test('Partage : la route n’a plus de GET (une navigation venue d’un autre site n’écrit rien) ; appel d’un autre site refusé', async () => {
  const route = require('../src/app/api/reseller/boutique/partage/route.ts');
  assert.equal(route.GET, undefined, 'préparer un lien l’écrit en base : jamais sur un GET');
  baseAwa();
  sessionCourante = revendeur('rev-1');
  for (const site of ['cross-site', 'same-site', 'none']) {
    const r = await preparer({ canal: 'whatsapp' }, { 'sec-fetch-site': site });
    assert.equal(r.status, 403, site);
  }
  assert.deepEqual(ecritures(), [], 'ni lien, ni SHARE');
  assert.equal((await preparer({ canal: 'whatsapp' }, { 'sec-fetch-site': 'same-origin' })).status, 200);
  assert.equal((await preparer({ canal: 'qr' })).status, 200, 'navigateur sans Sec-Fetch-Site : accepté');
  assert.equal(etat.tracking_links.length, 2);
  // Corps illisible ou rayon d'un autre type : refus propre, rien d'écrit.
  operations = [];
  assert.equal((await preparer({ canal: 'qr', rayon: ['pagnes'] })).status, 400);
  assert.deepEqual(ecritures(), []);
  // Les trois appelants envoient un POST.
  for (const f of ['src/components/shop/proprietaire/PartageBoutique.tsx', 'src/app/reseller/badge/page.tsx', 'src/app/reseller/createur/page.tsx']) {
    const src = sansCommentaires(lire(f));
    assert.match(src, /fetch\('\/api\/reseller\/boutique\/partage', \{\s*method: 'POST'/, f);
    assert.doesNotMatch(src, /boutique\/partage\?/, `${f} : plus de paramètres d’adresse`);
  }
});

test('Partage : le nom du rayon vient des articles de la boutique, jamais de la requête, et n’est lu qu’à la création', async () => {
  baseAwa();
  sessionCourante = revendeur('rev-1');
  etat.products = [produit('a', { category: 'Électroménager' }), produit('b', { category: 'Pa<gnes>' }), produit('c', { category: 'Mode' })];
  etat.reseller_shop_items = [{ reseller_id: 'rev-1', product_id: 'a' }, { reseller_id: 'rev-1', product_id: 'b' }];
  await preparer({ canal: 'whatsapp', rayon: 'electromenager', nom: 'Texte choisi par un autre site' });
  const lien = etat.tracking_links.find((l) => l.target_ref === 'awa-mode~electromenager');
  assert.equal(lien.label, 'Électroménager');
  await preparer({ canal: 'whatsapp', rayon: 'pa-gnes' });
  assert.equal(etat.tracking_links.find((l) => l.target_ref === 'awa-mode~pa-gnes').label, 'Pagnes', 'sans balise');
  // Catégorie d'un article qui n'est pas dans SA boutique : pas de libellé (« Mes partages » lit la clé).
  await preparer({ canal: 'whatsapp', rayon: 'mode' });
  assert.equal(etat.tracking_links.find((l) => l.target_ref === 'awa-mode~mode').label, null);
  // Lien déjà là : rien n'est relu, rien n'est écrit.
  operations = [];
  await preparer({ canal: 'whatsapp', rayon: 'electromenager' });
  assert.deepEqual(operations.filter((o) => o.table === 'products' || o.table === 'reseller_shop_items'), []);
  assert.deepEqual(ecritures(), []);
  // Coups de cœur : libellé fixe, aucun article lu.
  operations = [];
  await preparer({ canal: 'whatsapp', rayon: 'coups-de-coeur' });
  assert.deepEqual(operations.filter((o) => o.table === 'products'), []);
  assert.equal(etat.tracking_links.find((l) => l.target_ref === 'awa-mode~coups-de-coeur').label, null);
  // Articles illisibles : le lien est créé quand même, sans libellé.
  fautes['products:select'] = 'XX000';
  const json = await (await preparer({ canal: 'qr', rayon: 'electromenager' })).json();
  assert.equal(json.suivi, true);
  assert.equal(etat.tracking_links.find((l) => l.target_ref === 'awa-mode~electromenager' && l.channel === 'qr').label, null);
  const feuille = sansCommentaires(lire('src/components/shop/proprietaire/PartageBoutique.tsx'));
  assert.match(feuille, /body: JSON\.stringify\(cle \? \{ canal, rayon: cle \} : \{ canal \}\)/, 'la feuille n’envoie plus de nom');
  assert.doesNotMatch(feuille, /set\('nom'/);
});

// ── Fiche produit : nom public et bandeau à 390 px ──────────────────────────

test('Fiche produit : sans enseigne « La sélection de Awa D. » ; titre sur 2 lignes et lien compact sur téléphone', () => {
  const fiche = sansCommentaires(lire('src/app/p/[slug]/page.tsx'));
  assert.match(fiche, /import \{ titreVitrine \} from '@\/lib\/enseigne';/);
  assert.match(fiche, /recommandeur\.enseigne \? `Boutique de \$\{recommandeur\.enseigne\}`\s*: titreVitrine\(\{ type: 'revendeur', nom: recommandeur\.nom, enseigne: false \}\)/);
  assert.doesNotMatch(fiche, /Boutique de \$\{recommandeur\.enseigne \|\| recommandeur\.nom\}/, 'jamais « Boutique de Awa D. »');
  const { titreVitrine } = require('../src/lib/enseigne.ts');
  assert.equal(titreVitrine({ type: 'revendeur', nom: 'Awa D.', enseigne: false }), 'La sélection de Awa D.');
  const bandeau = fiche.slice(fiche.indexOf('{recommandeur && ('), fiche.indexOf('<div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">'));
  assert.match(bandeau, /<p className="text-xs font-bold text-suguba-profond line-clamp-2 break-words">\s*\{titreRecommandeur\}/);
  assert.doesNotMatch(bandeau, /\btruncate\b/, 'le nom de la boutique n’est plus coupé à 6 caractères');
  assert.match(bandeau, /Voir<span className="sr-only sm:not-sr-only"> sa boutique<\/span>/, '« Voir » sur téléphone, « Voir sa boutique » lu et affiché dès la tablette');
  assert.match(bandeau, /min-h-10 min-w-10/);
});

// ── Bandeau, boutons « Partager », feuille ──────────────────────────────────

test('Bandeau : « 7 j : 1 250 visites » avec formatNombre ; « Partager » nommé « Partager ma boutique » (il ouvre une feuille)', () => {
  const { formatNombre } = require('../src/lib/montant.ts');
  const Bandeau = require('../src/components/shop/proprietaire/BandeauProprietaire.tsx').default;
  const identite = { nom: 'Awa Mode', enseigne: true, accroche: null, logo: null, couverture: null };
  const html = renderToStaticMarkup(React.createElement(Bandeau, { identite, statut: 'active', urlPartage: 'https://x/boutique/awa-mode', visites7j: 1250 }));
  assert.ok(html.includes(`7 j : ${formatNombre(1250)} visites`), html.match(/7 j :[^<]*/)?.[0]);
  assert.doesNotMatch(html, /7 j : 1250/);
  assert.match(html, /aria-label="Partager ma boutique" aria-haspopup="dialog"/);
  for (const f of ['src/components/shop/proprietaire/BandeauProprietaire.tsx', 'src/app/reseller/page.tsx', 'src/app/reseller/boutique/articles/page.tsx']) {
    const src = lire(f);
    assert.doesNotMatch(src, /aria-label="Partager ma boutique sur WhatsApp"/, f);
    assert.match(src, /aria-label="Partager ma boutique"\s*\n?\s*aria-haspopup="dialog"|aria-label="Partager ma boutique" aria-haspopup="dialog"/, f);
  }
  const feuille = sansCommentaires(lire('src/components/shop/proprietaire/PartageBoutique.tsx'));
  assert.match(feuille, />Votre message</);
  assert.doesNotMatch(feuille, /Message envoyé/, 'rien n’est envoyé avant le toucher de WhatsApp');
});

// ── Accueil : pas de « Partager ma boutique » pour une boutique masquée ─────

test('Accueil : boutique masquée, la prochaine étape n’est jamais « Partager ma boutique »', () => {
  const { etapesBoutique, prochaineEtape } = require('../src/lib/reseau/etapes-boutique.ts');
  const complete = { enseigne: true, logo: 'l', couverture: 'c', accueil: 'a', articles: 5, coupsDeCoeur: 1, partage: false };
  assert.equal(prochaineEtape(etapesBoutique(complete), true).cle, 'partage');
  assert.equal(prochaineEtape(etapesBoutique(complete), false), null, 'rien plutôt qu’un lien sans effet');
  assert.equal(prochaineEtape(etapesBoutique({ ...complete, logo: null }), false).cle, 'logo', 'l’étape suivante');
  assert.equal(prochaineEtape(etapesBoutique({ ...complete, partage: true }), true), null);
  const accueil = sansCommentaires(lire('src/app/reseller/page.tsx'));
  assert.match(accueil, /const prochaine = prochaineEtape\(etapes, partageable\);/);
  assert.match(accueil, /const partageable = Boolean\(boutique && boutique\.statut === 'active'\);/);
});

// ── Guide ───────────────────────────────────────────────────────────────────

test('Guide : relecture du lot 4 en tête ; carte & QR et créateur cochent l’étape ; visites par /r/ non comptées ; titre sans enseigne', () => {
  const guide = JSON.parse(lire('docs/guide/guide.json'));
  const [tete] = guide.journal;
  assert.equal(tete.titre, 'Boutique revendeur, lot 4 : corrections de relecture');
  assert.equal(tete.statut, 'en local');
  assert.match(tete.demande, /^« “Ma boutique” doit montrer la boutique elle-même/);
  assert.ok(tete.ecarts.length > 0);
  const lot4 = guide.journal.find((j) => j.titre === 'Boutique revendeur, lot 4 : partager et mesurer');
  const ecarts = lot4.ecarts.join('\n');
  assert.match(ecarts, /Ma carte & QR/);
  assert.match(ecarts, /Créer un visuel/);
  assert.match(ecarts, /\/r\/<code>[^\n]*ne sont pas comptées/);
  const fiche = (id) => guide.pages.find((p) => p.id === id);
  const visites = fiche('rev-boutique-stats').elements.find((e) => e.nom === 'Visites');
  assert.match(visites.role, /\/r\/<code>/);
  assert.match(JSON.stringify(fiche('rev-badge')), /coche l’étape « Partager ma boutique »/);
  assert.match(JSON.stringify(fiche('fiche-produit')), /La sélection de Awa D\./);
  assert.match(JSON.stringify(fiche('rev-accueil')), /Boutique masquée par Suguba : « Partager ma boutique » n’est pas proposée/);
  assert.match(JSON.stringify(fiche('rev-createur')), /coche l’étape « Partager ma boutique »/);
  assert.match(JSON.stringify(fiche('rev-boutique-stats')), /jamais les chiffres d’une autre période/);
});
