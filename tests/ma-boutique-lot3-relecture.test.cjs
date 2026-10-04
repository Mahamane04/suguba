// TEST-BOUTIQUE-LOT3-020..029 (chantier boutique du revendeur, 2026-10-03,
// relecture du lot 3) : « Tous mes prix » et « Produits » qui relisent l'adresse,
// rangement interrompu sans 7e coup de cœur, retrait qui ne ment plus, carte du
// créateur fidèle à la vitrine, « Message » sans remise chiffrée (mais « Télé 4K »
// permis), « Lire la suite » sur la présentation, accords et prix jamais coupé
// dans Mes articles, guide fidèle à ce qui est livré.
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

// ── Base simulée : opérations enregistrées, pannes ciblées sur une ligne ─────
let etat; let operations; let pannes; let apresEcriture;
function reinitialiser() {
  etat = { reseller_shop_items: [], products: [] };
  operations = []; pannes = []; apresEcriture = () => {};
}
const db = {
  from(table) {
    let op = 'select'; let patch; const filtres = []; const egalites = {}; let un = false;
    const q = {
      select() { return q; },
      eq(k, v) { egalites[k] = v; filtres.push((r) => r[k] === v); return q; },
      in(k, v) { filtres.push((r) => v.includes(r[k])); return q; },
      order() { return q; }, limit() { return q; },
      insert(p) { op = 'insert'; patch = p; return q; },
      update(p) { op = 'update'; patch = p; return q; },
      upsert(p) { op = 'upsert'; patch = p; return q; },
      delete() { op = 'delete'; return q; },
      maybeSingle() { un = true; return q; },
      then(resolve, reject) {
        const operation = { table, op, patch, egalites };
        operations.push(operation);
        if (pannes.some((panne) => panne(operation))) return Promise.resolve({ data: null, error: { code: 'PANNE' } }).then(resolve, reject);
        let lignes = (etat[table] || []).filter((r) => filtres.every((f) => f(r)));
        if (op === 'insert') { const ligne = { ...patch }; (etat[table] ||= []).push(ligne); lignes = [ligne]; }
        if (op === 'update') lignes.forEach((r) => Object.assign(r, patch));
        if (op === 'delete') etat[table] = (etat[table] || []).filter((r) => !lignes.includes(r));
        if (op !== 'select') apresEcriture(operation);
        const data = un ? (lignes[0] ? { ...lignes[0] } : null) : lignes.map((r) => ({ ...r }));
        return Promise.resolve({ data, error: null }).then(resolve, reject);
      },
    };
    return q;
  },
};
const ecritures = () => operations.filter((o) => o.op !== 'select');
require.cache[require.resolve('../src/lib/supabase-admin.ts')] = { exports: { getSupabaseAdmin: () => db } };

let sessionCourante = null;
require.cache[require.resolve('../src/lib/active-session.ts')] = { exports: { verifyActiveSession: async () => sessionCourante } };
const revendeur = (uid) => ({ uid, phone: '+22300000000', role: 'reseller', status: 'active', roles: { reseller: 'active' }, iat: 1, exp: 9e9 });

// Adresse courante : useSearchParams la relit à chaque rendu, comme Next.js.
let adresse = new URLSearchParams();
require.cache[require.resolve('next/navigation')] = {
  exports: {
    notFound: () => { throw new Error('page introuvable'); },
    usePathname: () => '/reseller',
    useRouter: () => ({ push() {}, replace() {}, refresh() {}, prefetch() {} }),
    useSearchParams: () => adresse,
  },
};
require.cache[require.resolve('next/link')] = {
  exports: { __esModule: true, default: ({ href, prefetch, children, ...reste }) => React.createElement('a', { href, 'data-prefetch': String(prefetch), ...reste }, children) },
};
const marqueur = (nom) => ({ __esModule: true, default: () => React.createElement('i', { 'data-marqueur': nom }) });
for (const [fichier, nom] of [['common/Header', 'entete'], ['common/BottomNav', 'barre'], ['common/Footer', 'pied'],
  ['reseller/CreateOrderModal', 'vente'], ['product/ProductCard', 'carte']]) {
  require.cache[require.resolve(`../src/components/${fichier}.tsx`)] = { exports: marqueur(nom) };
}
require.cache[require.resolve('../src/lib/store.ts')] = { exports: { useSugubaStore: () => ({ products: [] }), useCatalogueCharge: () => true } };
require.cache[require.resolve('../src/lib/sponsorises.ts')] = { exports: { useSponsorises: () => new Map(), compterVues() {}, compterClic() {} } };

const { NextRequest } = require('next/server');
const poster = (donnees) => new NextRequest('http://localhost/api/reseller/shop', {
  method: 'POST', body: JSON.stringify(donnees), headers: { cookie: 'suguba_session=simule', 'content-type': 'application/json' },
});
const selection = (uid, liste) => liste.map(([id, position]) => ({ reseller_id: uid, product_id: id, position, added_at: '2026-09-01T00:00:00Z' }));
const negatives = (uid) => etat.reseller_shop_items.filter((l) => l.reseller_id === uid && l.position < 0).length;

// ── Rangement interrompu : jamais plus de 6 coups de cœur ───────────────────

test('positionsAEcrire : seulement les places qui changent, les positions ≥ 0 d’abord', () => {
  const O = require('../src/lib/boutique-ordre.ts');
  const actuelles = new Map([['A', -6], ['B', -5], ['C', -4], ['D', -3], ['E', -2], ['F', -1], ['G', 0]]);
  const { positions } = O.positionsPourOrdre(['B', 'C', 'D', 'E', 'F', 'G', 'A'], ['B', 'C', 'D', 'E', 'F', 'G']);
  const aEcrire = O.positionsAEcrire(positions, actuelles);
  assert.deepEqual(aEcrire[0], { id: 'A', position: 0 }, 'l’article qui sort des coups de cœur est écrit en premier');
  assert.ok(aEcrire.slice(1).every((p) => p.position < 0));
  assert.equal(aEcrire.length, 7);
  assert.deepEqual(O.positionsAEcrire(positions, new Map(positions.map((p) => [p.id, p.position]))), [], 'rien ne change : rien à écrire');
});

test('Route « ordonner » : une écriture en panne ne laisse jamais 7 coups de cœur (503, on peut réessayer)', async () => {
  const { POST } = require('../src/app/api/reseller/shop/route.ts');
  reinitialiser();
  sessionCourante = revendeur('rev-1');
  etat.reseller_shop_items = selection('rev-1', [['A', -6], ['B', -5], ['C', -4], ['D', -3], ['E', -2], ['F', -1], ['G', 0]]);
  let maximum = negatives('rev-1');
  apresEcriture = () => { maximum = Math.max(maximum, negatives('rev-1')); };
  const corps = { action: 'ordonner', ordre: ['B', 'C', 'D', 'E', 'F', 'G', 'A'], coupsDeCoeur: ['B', 'C', 'D', 'E', 'F', 'G'] };
  // L'écriture de A (qui sort des coups de cœur) tombe en panne.
  pannes = [(o) => o.op === 'update' && o.egalites.product_id === 'A'];
  const r = await POST(poster(corps));
  assert.equal(r.status, 503);
  assert.match((await r.json()).error, /Rangement interrompu/);
  assert.ok(maximum <= 6, `jamais plus de 6 coups de cœur (vu : ${maximum})`);
  assert.ok(negatives('rev-1') <= 6);
  // Panne sur un nouveau coup de cœur en cours de route : toujours 6 au plus.
  reinitialiser();
  etat.reseller_shop_items = selection('rev-1', [['A', -6], ['B', -5], ['C', -4], ['D', -3], ['E', -2], ['F', -1], ['G', 0]]);
  maximum = negatives('rev-1');
  apresEcriture = () => { maximum = Math.max(maximum, negatives('rev-1')); };
  pannes = [(o) => o.op === 'update' && o.egalites.product_id === 'D'];
  assert.equal((await POST(poster(corps))).status, 503);
  assert.ok(maximum <= 6, `jamais plus de 6 coups de cœur (vu : ${maximum})`);
  // Sans panne, la réessai termine le rangement voulu ; seulement des UPDATE de position.
  pannes = [];
  operations = [];
  assert.equal((await POST(poster(corps))).status, 200);
  assert.ok(ecritures().every((o) => o.op === 'update' && Object.keys(o.patch).join() === 'position'));
  const positions = Object.fromEntries(etat.reseller_shop_items.map((l) => [l.product_id, l.position]));
  assert.deepEqual(positions, { A: 0, B: -6, C: -5, D: -4, E: -3, F: -2, G: -1 });
  assert.ok(maximum <= 6);
});

// ── Retrait : plus de « succès » quand la base refuse ───────────────────────

test('Route « retirer » : 503 « Retrait impossible » si la suppression échoue ; la ligne reste', async () => {
  const { POST } = require('../src/app/api/reseller/shop/route.ts');
  reinitialiser();
  sessionCourante = revendeur('rev-1');
  etat.reseller_shop_items = selection('rev-1', [['a', 0], ['b', 1]]).concat(selection('rev-2', [['a', 0]]));
  pannes = [(o) => o.op === 'delete'];
  let r = await POST(poster({ productId: 'a', action: 'retirer' }));
  assert.equal(r.status, 503);
  assert.equal((await r.json()).error, 'Retrait impossible. Réessayez.');
  assert.equal(etat.reseller_shop_items.filter((l) => l.reseller_id === 'rev-1').length, 2, 'la ligne est toujours là');
  pannes = [];
  r = await POST(poster({ productId: 'a', action: 'retirer', reseller_id: 'rev-2' }));
  assert.equal(r.status, 200);
  assert.deepEqual(etat.reseller_shop_items.map((l) => `${l.reseller_id}:${l.product_id}`), ['rev-1:b', 'rev-2:a'], 'identité de la session, pas du corps');
  // Les deux écrans traitent la réponse en échec (rien n'est annoncé « retiré »).
  const articles = sansCommentaires(lire('src/app/reseller/boutique/articles/page.tsx'));
  assert.match(articles, /if \(!r\.ok\) \{[\s\S]*?return false;/);
  assert.match(sansCommentaires(lire('src/app/reseller/catalog/page.tsx')), /if \(!res\.ok\) \{ setErreurBoutique/);
});

// ── « Tous mes prix » et « Produits » : le filtre suit l'adresse ────────────

test('Mes prix : deux adresses successives donnent deux filtres (« Tous mes prix » revient à la liste complète)', () => {
  const { default: MesPrix } = require('../src/app/reseller/prix/page.tsx');
  adresse = new URLSearchParams('boutique=1&produit=g1');
  const filtre = renderToStaticMarkup(React.createElement(MesPrix));
  assert.match(filtre, />Tous mes prix</);
  assert.match(filtre, /href="\/reseller\/boutique\/articles"/, 'retour vers Mes articles');
  assert.match(filtre, /Articles au prix de gros de votre boutique/);
  adresse = new URLSearchParams('');
  const tout = renderToStaticMarkup(React.createElement(MesPrix));
  assert.doesNotMatch(tout, /Tous mes prix/);
  assert.doesNotMatch(tout, /href="\/reseller\/boutique\/articles"/);
  assert.match(tout, /href="\/reseller"/, 'retour vers Mon espace');
  // Le filtre n'est plus lu une seule fois au montage, et chaque changement relance la lecture.
  const src = sansCommentaires(lire('src/app/reseller/prix/page.tsx'));
  assert.doesNotMatch(src, /window\.location\.search/);
  assert.match(src, /const q = useSearchParams\(\);/);
  assert.match(src, /<Suspense fallback=\{<ChargementPage/);
  assert.match(src, /\}, \[toast, boutique, produit\]\);/);
  assert.match(src, /if \(actif\) setArticles\(/, 'une réponse arrivée trop tard est ignorée');
});

test('Catalogue : après « Produits » (/reseller/catalog), le bandeau « Revenir à ma boutique » disparaît', () => {
  const { default: Catalogue } = require('../src/app/reseller/catalog/page.tsx');
  adresse = new URLSearchParams('depuis=boutique');
  const depuis = renderToStaticMarkup(React.createElement(Catalogue));
  assert.match(depuis, /Revenir à ma boutique/);
  assert.match(depuis, /sticky top-16/);
  adresse = new URLSearchParams('');
  const normal = renderToStaticMarkup(React.createElement(Catalogue));
  assert.doesNotMatch(normal, /Revenir à ma boutique/);
  assert.doesNotMatch(normal, /sticky top-16/);
  assert.match(normal, /Voir ma boutique/);
  const src = sansCommentaires(lire('src/app/reseller/catalog/page.tsx'));
  assert.doesNotMatch(src, /window\.location\.search/);
  assert.match(src, /const depuisBoutique = useSearchParams\(\)\.get\('depuis'\) === 'boutique';/);
  assert.match(src, /<Suspense fallback=\{<ChargementPage/);
});

// ── Carte « Ma boutique » du créateur : ce que montre la vitrine, rien d'autre ──

test('Carte du créateur : tous épuisés → les épuisés (pas le catalogue) ; lecture en échec ni gardée ni silencieuse', () => {
  const O = require('../src/lib/boutique-ordre.ts');
  const a = (nom, enPlus) => ({ nom, image: null, prixVitrine: 5000, coupDeCoeur: false, etat: 'affiche', ...enPlus });
  const epuises = [a('Pagne', { etat: 'epuise' }), a('Sac', { etat: 'epuise', coupDeCoeur: true }), a('Retiré', { etat: 'retire' })];
  assert.deepEqual(O.selectionPourCarte(epuises).map((o) => o.nom), ['Sac', 'Pagne'], 'repli sur les épuisés, coups de cœur d’abord');
  assert.equal(O.vitrineMontreSelection(epuises), true);
  // Des articles en stock : eux seuls, comme avant.
  assert.deepEqual(O.selectionPourCarte([...epuises, a('Thé')]).map((o) => o.nom), ['Thé']);
  // Aucun article servi par la vitrine (retirés, sans gain) : elle montre le catalogue, la carte aussi.
  const masques = [a('R', { etat: 'retire' }), a('S', { etat: 'sans_gain' })];
  assert.deepEqual(O.selectionPourCarte(masques), []);
  assert.equal(O.vitrineMontreSelection(masques), false);
  assert.equal(O.vitrineMontreSelection([]), false);
  const createur = sansCommentaires(lire('src/app/reseller/createur/page.tsx'));
  assert.doesNotMatch(createur, /\.catch\(\(\) => \[\]\)/, 'un échec n’est plus une sélection vide');
  assert.match(createur, /if \(articles === null && articlesBoutique\.current === lecture\) articlesBoutique\.current = null;/, 'échec jamais gardé');
  assert.match(createur, /if \(!articles\) \{\s*toast\('Vos articles n’ont pas pu être lus : la carte n’est pas créée\. Réessayez\.', \{ ton: 'erreur' \}\);\s*return;/);
  assert.match(createur, /selection\.length > 0 \|\| vitrineMontreSelection\(articles\)\s*\? selection\s*: produits\.slice\(0, 3\)/);
});

// ── « Message » : ni remise chiffrée, ni refus des écrans « 4K » ────────────

test('Message des affiches : « Télé 4K » permis ; « Remise 20 », « Soldes 50 », « Promo 30 ce week-end » refusés', () => {
  const { refusMessageAffiche } = require('../src/lib/message-affiche.ts');
  for (const ok of ['Télé 4K', 'Écran Ultra HD 4K', '8K HDR', 'Soldes', 'Promo du jour', 'Remise en main propre', 'Livraison 24h/24', 'Top 10', 'Pack de 3', 'Nouveau']) {
    assert.equal(refusMessageAffiche(ok), null, ok);
  }
  for (const non of ['Remise 20', 'Soldes 50', 'Promo 30 ce week-end', 'Réduc 15', 'Reduction de 10', 'Rabais de 20', '1 acheté 1 offert', '2 pour 1']) {
    assert.match(refusMessageAffiche(non) || '', /Pas de remise chiffrée/, non);
  }
  for (const non of ['10k', '25 k', '2,5k', '5k F', '5 kf', '10 000 francs', '5 000 F seulement']) {
    assert.match(refusMessageAffiche(non) || '', /Pas de prix ni de montant/, non);
  }
});

// ── Mes articles : accord, prix jamais coupé ────────────────────────────────

test('Mes articles : « Touchez un article pour le retirer » au pluriel ; le prix ne se coupe pas à côté de la pastille', () => {
  const page = sansCommentaires(lire('src/app/reseller/boutique/articles/page.tsx'));
  assert.match(page, /\{masques > 1 \? 'Touchez un article pour le retirer\.' : 'Touchez-le pour le retirer\.'\}/);
  assert.doesNotMatch(page, /\)\. Touchez-le pour le retirer\./, 'plus de singulier fixe');
  assert.match(page, /<span className="flex flex-wrap items-center gap-x-1\.5 gap-y-1 min-w-0">/);
  assert.match(page, /<span className="whitespace-nowrap tabular-nums">\{a\.prixVitrine != null \? formatF\(a\.prixVitrine\) : '—'\}<\/span>/);
  assert.doesNotMatch(page, /truncate tabular-nums/);
});

// ── Vitrine : « Lire la suite » sur la présentation ─────────────────────────

test('Vitrine : la présentation garde 2 lignes sur téléphone, avec « Lire la suite » quand elle est coupée', () => {
  const { default: EnteteBoutique } = require('../src/components/shop/EnteteBoutique.tsx');
  const texte = 'Bienvenue dans ma boutique de pagnes et de thé. '.repeat(10);
  const html = renderToStaticMarkup(React.createElement(EnteteBoutique, { logo: null, nom: 'Awa Mode', titre: 'Awa Mode', surtitre: 'Revendeur partenaire Suguba', description: texte }));
  assert.match(html, /class="text-sm text-slate-600 leading-relaxed line-clamp-2 sm:line-clamp-none"/);
  assert.doesNotMatch(html, /Lire la suite/, 'côté serveur, rien n’est encore mesuré : pas de bouton inutile');
  const src = sansCommentaires(lire('src/components/shop/DescriptionBoutique.tsx'));
  assert.match(src, /^'use client';/);
  assert.match(src, /p\.scrollHeight > p\.clientHeight \+ 1/, 'bouton seulement si le texte est vraiment coupé');
  assert.match(src, /aria-expanded=\{deplie\}/);
  assert.match(src, /aria-controls=\{id\}/);
  assert.match(src, /className="sm:hidden min-h-10/, 'téléphone seulement, cible de 40 px');
  assert.match(src, /\{deplie \? 'Réduire' : 'Lire la suite'\}/);
  // L'en-tête reste un composant serveur.
  assert.doesNotMatch(lire('src/components/shop/EnteteBoutique.tsx'), /^'use client'/);
});

// ── Guide : fidèle à ce qui est livré ───────────────────────────────────────

test('Guide : « Nouveau » pendant 14 jours, vitrine fournisseur à jour, journal de la relecture en tête', () => {
  const guide = JSON.parse(lire('docs/guide/guide.json'));
  const page = (id) => guide.pages.find((p) => p.id === id);
  const element = (id, nom) => page(id).elements.find((e) => e.nom === nom);
  assert.match(element('vitrine-boutique', 'Nouveau').role, /pendant les 14 jours qui suivent l’ajout/);
  assert.doesNotMatch(element('vitrine-boutique', 'Nouveau').role, /posée 14 jours après/);
  const fournisseur = page('vitrine-fournisseur');
  assert.match(element('vitrine-fournisseur', 'Recherche · rayons').role, /sans accents|ignore les accents/);
  assert.match(JSON.stringify(fournisseur), /Lire la suite/);
  assert.match(fournisseur.note, /Capture d’avant le lot 3/);
  assert.match(JSON.stringify(page('vitrine-boutique')), /Lire la suite/);
  // Lot 4 (2026-10-03) : une entrée plus récente passe en tête ; la relecture du lot 3
  // reste juste avant l'entrée du lot 3.
  const rang = guide.journal.findIndex((j) => j.titre === 'Boutique revendeur, lot 3 : corrections de relecture');
  assert.ok(rang >= 0);
  const [tete, lot3] = guide.journal.slice(rang);
  assert.equal(tete.titre, 'Boutique revendeur, lot 3 : corrections de relecture');
  assert.equal(tete.date, '2026-10-03');
  assert.ok(['en local', 'en ligne'].includes(tete.statut));
  assert.ok(tete.ecarts.length > 0);
  for (const id of ['rev-prix', 'rev-catalogue', 'rev-boutique-articles', 'rev-createur', 'vitrine-boutique', 'vitrine-fournisseur']) {
    assert.ok(tete.pages.includes(id), id);
  }
  assert.equal(lot3.titre, 'Boutique revendeur, lot 3 : Mes articles, coups de cœur, gain visible');
  assert.ok(lot3.pages.includes('vitrine-fournisseur'), 'la vitrine fournisseur change aussi au lot 3');
  assert.ok(guide.majLe >= '2026-10-03');
});
