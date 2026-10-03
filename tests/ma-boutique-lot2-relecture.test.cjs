// TEST-BOUTIQUE-LOT2-017..026 (chantier boutique du revendeur, 2026-10-03,
// relecture du lot 2) : liste blanche partagée avec POST /api/compte/boutiques
// « modifier », noms et adresses réservés à Suguba, nom par défaut jamais pris
// pour une enseigne, noms publics dans l'annuaire, la recherche et les boutiques
// suivies, pilule « Vue client · Revenir » au-dessus de la barre du bas, retraits
// d'images confirmés et cibles de 40 px, aucun repli sur le nom enregistré.
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

const BASE = 'https://projet.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_URL = BASE;
const dossier = (uid) => `${BASE}/storage/v1/object/public/product-images/boutiques/${uid}/`;

// ── Base simulée (motifs ilike « %…% », neq, in ; les mises à jour s'appliquent) ──
let etat; let fautes; let ecritures;
function reinitialiser() {
  etat = { stores: [], profiles: [], profile_roles: [], suppliers: [], store_follows: [], products: [], store_plans: [], platform_settings: [] };
  fautes = {}; ecritures = [];
}
// Motif ilike : « % » et « _ » sont des jokers, sauf échappés par « \ ».
function motif(v) {
  let re = ''; const s = String(v);
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '\\' && i + 1 < s.length) { re += s[++i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); continue; }
    re += c === '%' ? '.*' : c === '_' ? '.' : c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`, 'i');
}
const db = {
  from(table) {
    let op = 'select'; let patch; const filtres = []; let un = false;
    const q = {
      select() { return q; },
      eq(k, v) { filtres.push((r) => r[k] === v); return q; },
      neq(k, v) { filtres.push((r) => r[k] !== v); return q; },
      ilike(k, v) { const m = motif(v); filtres.push((r) => m.test(String(r[k] ?? ''))); return q; },
      in(k, v) { filtres.push((r) => v.includes(r[k])); return q; },
      is() { return q; }, order() { return q; }, limit() { return q; }, gt() { return q; }, or() { return q; },
      insert(p) { op = 'insert'; patch = p; return q; },
      update(p) { op = 'update'; patch = p; return q; },
      delete() { op = 'delete'; return q; },
      maybeSingle() { un = true; return q; },
      then(resolve, reject) {
        if (op !== 'select') ecritures.push({ table, op, patch });
        if (fautes[`${table}:${op}`]) return Promise.resolve({ data: null, error: { code: fautes[`${table}:${op}`] } }).then(resolve, reject);
        if (op === 'insert' && table === 'stores' && etat.stores.some((r) => String(r.slug).toLowerCase() === String(patch.slug).toLowerCase())) {
          return Promise.resolve({ data: null, error: { code: '23505' } }).then(resolve, reject);
        }
        let lignes = (etat[table] || []).filter((r) => filtres.every((f) => f(r)));
        if (op === 'insert') {
          const ligne = { id: `cree-${ecritures.length}`, status: 'active', followers_count: 0, ...patch };
          (etat[table] ||= []).push(ligne); lignes = [ligne];
        }
        if (op === 'update') lignes.forEach((r) => Object.assign(r, patch));
        const data = un ? (lignes[0] ? { ...lignes[0] } : null) : lignes.map((r) => ({ ...r }));
        return Promise.resolve({ data, error: null }).then(resolve, reject);
      },
    };
    return q;
  },
  async rpc() { return { data: null, error: null }; },
};
require.cache[require.resolve('../src/lib/supabase-admin.ts')] = { exports: { getSupabaseAdmin: () => db } };

let sessionCourante = null;
require.cache[require.resolve('../src/lib/active-session.ts')] = { exports: { verifyActiveSession: async () => sessionCourante } };
require.cache[require.resolve('../src/lib/reseau/recompenses.ts')] = { exports: { lireReglagesReseau: async () => ({ annuaireFournisseurs: true }) } };
require.cache[require.resolve('../src/lib/recherche-produits.ts')] = { exports: { idsRecherche: async () => [], produitsRecherche: async () => [] } };
require.cache[require.resolve('../src/lib/reseau/contexte-fournisseur.ts')] = {
  exports: { exigerDroitFournisseur: async () => ({ ok: true, contexte: { fournisseurId: 'fou-1' } }) },
};
const revendeur = (uid, extra = {}) => ({ uid, phone: '+22300000000', role: 'reseller', status: 'active', roles: { reseller: 'active' }, iat: 1, exp: 9e9, ...extra });

const { NextRequest } = require('next/server');
const requete = (url, init = {}) => new NextRequest(`http://localhost${url}`, {
  ...init, headers: { cookie: 'suguba_session=simule', 'content-type': 'application/json', ...(init.headers || {}) },
});
const corps = (methode, donnees) => ({ method: methode, body: JSON.stringify(donnees) });

function boutiqueAwa(enPlus = {}) {
  return { id: 's1', owner_type: 'reseller', owner_id: 'rev-1', slug: 'awa-traore-diallo', name: 'Awa Traoré Diallo', status: 'active', followers_count: 3,
    logo_url: null, cover_url: null, gallery: [], categories: [], principale: true, created_at: '2026-01-01', ...enPlus };
}
const AWA = { id: 'rev-1', full_name: 'Awa Traoré Diallo', reseller_code: 'AWA1' };

// ── 1. POST /api/compte/boutiques « modifier » : même liste blanche ─────────

test('compte/boutiques « modifier » : session revendeur + boutique principale, logo externe et recrute refusés, sans écriture', async () => {
  const { POST } = require('../src/app/api/compte/boutiques/route.ts');
  reinitialiser();
  etat.profiles = [AWA];
  etat.stores = [boutiqueAwa()];
  sessionCourante = revendeur('rev-1');
  const modifier = (champs, boutiqueId = 's1') => POST(requete('/api/compte/boutiques', corps('POST', { action: 'modifier', boutiqueId, champs })));

  for (const champs of [
    { logo: 'https://ailleurs.example/marque.png', recrute: true },
    { couverture: `${dossier('rev-2')}x.webp` },
    { galerie: ['https://ailleurs.example/x.webp'] },
    { nom: 'x'.repeat(61) },
    { accroche: 'x'.repeat(91) },
    { nom: 'Suguba Officiel' },
  ]) {
    const r = await modifier(champs);
    assert.equal(r.status, 400, JSON.stringify(champs));
  }
  assert.deepEqual(ecritures, [], 'rien n’est écrit');

  // Champs admis : recrute, whatsapp et familles inventées ignorés.
  const r = await modifier({ accroche: 'Bonjour', recrute: true, whatsapp: '+22370000000', categories: ['Mode & Beauté', 'Inventée'], logo: `${dossier('rev-1')}logo-1.webp` });
  assert.equal(r.status, 200);
  const ecrite = ecritures.find((e) => e.op === 'update').patch;
  assert.equal('is_recruiting' in ecrite, false);
  assert.equal('whatsapp' in ecrite, false);
  assert.deepEqual(ecrite.categories, ['Mode & Beauté']);
  assert.equal(ecrite.tagline, 'Bonjour');
  assert.equal(ecrite.logo_url, `${dossier('rev-1')}logo-1.webp`);
  assert.equal(etat.stores[0].is_recruiting, undefined);

  // Création d'une boutique supplémentaire au nom de Suguba : refusée avant toute écriture.
  ecritures = [];
  const creation = await POST(requete('/api/compte/boutiques', corps('POST', { action: 'creer', nom: 'Suguba' })));
  assert.equal(creation.status, 400);
  assert.deepEqual(ecritures, []);

  // Un fournisseur garde son réglage de recrutement (notion fournisseur).
  reinitialiser();
  etat.stores = [{ id: 'f1', owner_type: 'supplier', owner_id: 'fou-1', slug: 'kadi-shop', name: 'Kadi Shop', status: 'active', principale: true }];
  sessionCourante = { ...revendeur('fou-1'), role: 'supplier', roles: { supplier: 'active' } };
  assert.equal((await modifier({ recrute: true }, 'f1')).status, 200);
  assert.equal(ecritures.find((e) => e.op === 'update').patch.is_recruiting, true);
});

// ── 2. Noms et adresses réservés à Suguba ───────────────────────────────────

test('Noms réservés : « Suguba Officiel » n’est ni une enseigne ni une adresse possible ; « Sugu Bamako » reste libre', () => {
  const { nomReserve, adresseReservee, estEnseigne, titreVitrine, nomPublicBoutique } = require('../src/lib/enseigne.ts');
  for (const nom of ['Suguba', 'Suguba Officiel', 'Boutique Suguba', 'SUGUBA ML', 'SugubaShop', 'Sugu Ba', 'Admin', 'Support', 'Service client']) {
    assert.equal(nomReserve(nom), true, nom);
    assert.equal(estEnseigne(nom, 'Awa Traoré Diallo'), false, nom);
    assert.equal(nomPublicBoutique(nom, 'Awa Traoré Diallo'), 'Awa D.', nom);
  }
  for (const libre of ['Sugu Bamako', 'Awa Mode', 'Chez Awa', 'Électro Diarra & Fils']) assert.equal(nomReserve(libre), false, libre);
  for (const adresse of ['suguba', 'suguba-officiel', 'boutique-suguba', 'admin', 'support']) assert.equal(adresseReservee(adresse), true, adresse);
  assert.equal(adresseReservee('awa-mode'), false);
  assert.equal(titreVitrine({ type: 'revendeur', nom: nomPublicBoutique('Suguba Officiel', 'Awa Traoré Diallo'), enseigne: false }), 'La sélection de Awa D.');
});

test('POST et PATCH /api/reseller/boutique : un nom réservé est refusé (400) sans rien écrire', async () => {
  const { POST, PATCH } = require('../src/app/api/reseller/boutique/route.ts');
  reinitialiser();
  etat.profiles = [AWA];
  sessionCourante = revendeur('rev-1');
  for (const nom of ['Suguba Officiel', 'Boutique Suguba', 'Suguba', 'Admin']) {
    assert.equal((await POST(requete('/api/reseller/boutique', corps('POST', { nom })))).status, 400, nom);
  }
  assert.deepEqual(ecritures, []);

  etat.stores = [boutiqueAwa({ name: 'Awa Mode', slug: 'awa-mode' })];
  const r = await PATCH(requete('/api/reseller/boutique', corps('PATCH', { nom: 'Suguba Officiel' })));
  assert.equal(r.status, 400);
  assert.match((await r.json()).error, /réservé à Suguba/);
  assert.deepEqual(ecritures, []);
  assert.equal(etat.stores[0].name, 'Awa Mode');
});

test('Adresse : un compte nommé « Suguba » ne reçoit jamais /boutique/suguba', async () => {
  const { GET } = require('../src/app/api/reseller/boutique/route.ts');
  reinitialiser();
  etat.profiles = [{ id: 'rev-9', full_name: 'Suguba', reseller_code: 'SUG9' }];
  sessionCourante = revendeur('rev-9');
  const json = await (await GET(requete('/api/reseller/boutique'))).json();
  assert.equal(json.boutique.slug, 'ma-boutique');
  assert.ok(ecritures.filter((e) => e.op === 'insert').every((e) => !/suguba/.test(e.patch.slug)));
});

// ── 3. Nom par défaut « Revendeur Suguba » ──────────────────────────────────

test('« Revendeur Suguba » n’est jamais une enseigne, même une fois le nom du compte rempli ; il reste enregistrable tel quel', async () => {
  const { estEnseigne, NOM_PAR_DEFAUT, nomPublic } = require('../src/lib/enseigne.ts');
  assert.equal(NOM_PAR_DEFAUT, 'Revendeur Suguba');
  assert.equal(nomPublic(null), NOM_PAR_DEFAUT);
  assert.equal(estEnseigne('Revendeur Suguba', null), false);
  assert.equal(estEnseigne('Revendeur Suguba', 'Awa Traoré'), false);
  assert.equal(estEnseigne('revendeur  suguba', 'Awa Traoré Diallo'), false);

  const { GET, PATCH } = require('../src/app/api/reseller/boutique/route.ts');
  reinitialiser();
  etat.profiles = [AWA];
  etat.stores = [boutiqueAwa({ name: 'Revendeur Suguba', slug: 'revendeur-suguba-2' })];
  sessionCourante = revendeur('rev-1');
  const lu = await (await GET(requete('/api/reseller/boutique?creer=non'))).json();
  assert.deepEqual(lu.vitrine, { nom: 'Awa D.', enseigne: false }, 'étape « nom de la boutique » non cochée, champ non pré-rempli');
  // « Personnaliser » renvoie le nom enregistré avec le mot d'accueil : accepté,
  // et le nom par défaut devient « Prénom I. ».
  const r = await PATCH(requete('/api/reseller/boutique', corps('PATCH', { nom: 'Revendeur Suguba', accroche: 'Bienvenue' })));
  assert.equal(r.status, 200);
  assert.equal(etat.stores[0].name, 'Awa D.');
  assert.equal(etat.stores[0].tagline, 'Bienvenue');
});

// ── 4. Le nom complet n'est plus écrit ni publié ────────────────────────────

test('POST et PATCH : son propre nom tapé comme nom de boutique est enregistré en « Awa D. »', async () => {
  const { POST, PATCH } = require('../src/app/api/reseller/boutique/route.ts');
  reinitialiser();
  etat.profiles = [AWA];
  sessionCourante = revendeur('rev-1');
  const r = await POST(requete('/api/reseller/boutique', corps('POST', { nom: 'Awa Traoré Diallo' })));
  assert.equal(r.status, 201);
  const insertion = ecritures.find((e) => e.op === 'insert').patch;
  assert.deepEqual([insertion.name, insertion.slug], ['Awa D.', 'awa-d']);
  assert.doesNotMatch(JSON.stringify(await r.json()), /Traoré|Diallo/);

  ecritures = [];
  await PATCH(requete('/api/reseller/boutique', corps('PATCH', { nom: 'Traoré Awa' })));
  assert.equal(ecritures.find((e) => e.op === 'update').patch.name, 'Awa D.');
  await PATCH(requete('/api/reseller/boutique', corps('PATCH', { nom: 'Awa Mode' })));
  assert.equal(etat.stores[0].name, 'Awa Mode', 'une enseigne est gardée telle quelle');
});

function annuaire() {
  reinitialiser();
  etat.profiles = [AWA, { id: 'rev-2', full_name: 'Moussa Keïta Coulibaly', reseller_code: 'MOU2' }];
  etat.stores = [
    boutiqueAwa({ neighborhood: 'Korofina Nord', is_recruiting: true, followers_count: 9 }),
    { id: 's2', owner_type: 'reseller', owner_id: 'rev-2', slug: 'chez-moussa', name: 'Chez Moussa', status: 'active', neighborhood: 'Korofina Nord', followers_count: 5, principale: true },
    // Profil introuvable : on ne sait pas vérifier son nom, la boutique n'est pas publiée.
    { id: 's3', owner_type: 'reseller', owner_id: 'rev-fantome', slug: 'kadiatou-sangare', name: 'Kadiatou Sangaré', status: 'active', neighborhood: 'Korofina Nord', principale: true },
    { id: 'f1', owner_type: 'supplier', owner_id: 'fou-1', slug: 'traore-electro', name: 'Traoré Électro', status: 'active', neighborhood: 'Korofina Nord', is_recruiting: true, principale: true },
  ];
  etat.store_follows = ['s1', 's2', 's3', 'f1'].map((id) => ({ store_id: id, follower_key: 'p:client-1' }));
}

test('Annuaire « Boutiques près de chez vous » et « qui recrutent » : noms publics, jamais le nom complet', async () => {
  const { GET } = require('../src/app/api/reseau/boutiques/route.ts');
  annuaire();
  sessionCourante = null;
  const quartier = await (await GET(requete('/api/reseau/boutiques?quartier=Korofina%20Nord'))).json();
  const noms = Object.fromEntries(quartier.boutiques.map((b) => [b.slug, b.nom]));
  assert.deepEqual(noms, { 'awa-traore-diallo': 'Awa D.', 'chez-moussa': 'Chez Moussa', 'traore-electro': 'Traoré Électro' });
  assert.doesNotMatch(JSON.stringify(quartier), /Traoré Diallo|Kadiatou|Sangaré|Keïta|Coulibaly/);

  // « Boutiques qui recrutent » : fournisseurs et Suguba seulement.
  const recrutent = await (await GET(requete('/api/reseau/boutiques'))).json();
  assert.deepEqual(recrutent.boutiques.map((b) => b.slug), ['traore-electro']);
  assert.deepEqual(ecritures, [], 'lecture seule');
});

test('Recherche publique : nom public, et « Traoré » ne retrouve pas la boutique de Awa D.', async () => {
  const { GET } = require('../src/app/api/reseau/recherche/route.ts');
  annuaire();
  sessionCourante = null;
  let json = await (await GET(requete('/api/reseau/recherche?q=Traor%C3%A9'))).json();
  assert.deepEqual(json.boutiques.map((b) => b.nom), ['Traoré Électro'], 'seule la boutique fournisseur, dont c’est l’enseigne');
  assert.doesNotMatch(JSON.stringify(json.boutiques), /Awa|Diallo/);
  json = await (await GET(requete('/api/reseau/recherche?q=awa'))).json();
  assert.deepEqual(json.boutiques.map((b) => [b.nom, b.lien]), [['Awa D.', '/boutique/awa-traore-diallo']]);
  json = await (await GET(requete('/api/reseau/recherche?q=Kadiatou'))).json();
  assert.deepEqual(json.boutiques, [], 'profil introuvable : non publiée');
});

test('Boutiques suivies : noms publics', async () => {
  const { GET } = require('../src/app/api/reseau/boutiques-suivies/route.ts');
  annuaire();
  sessionCourante = { ...revendeur('client-1'), role: 'customer', roles: { customer: 'active' } };
  const json = await (await GET(requete('/api/reseau/boutiques-suivies'))).json();
  assert.deepEqual(json.boutiques.map((b) => b.nom).sort(), ['Awa D.', 'Chez Moussa', 'Traoré Électro']);
  assert.doesNotMatch(JSON.stringify(json), /Traoré Diallo|Kadiatou/);
});

// ── 5. Pilule « Vue client · Revenir » et barre d'enregistrement ────────────

test('Vue client : la pilule reste au-dessus de la barre du bas à toutes les largeurs ; barre d’enregistrement aussi sur Personnaliser', () => {
  const mode = lire('src/components/shop/proprietaire/ModeProprietaire.tsx');
  const pilule = mode.match(/className="(hidden group-data-\[vue=client\]:inline-flex fixed[^"]*)"/)[1];
  assert.match(pilule, /bottom-\[calc\(5\.75rem\+env\(safe-area-inset-bottom,0px\)\)\]/);
  assert.doesNotMatch(pilule, /md:bottom-/, 'la barre du bas d’un revendeur reste affichée sur ordinateur');
  assert.match(pilule, /\bz-50\b/);

  const Barre = require('../src/components/ui/BarreEnregistrement.tsx').default;
  const rendre = (props) => renderToStaticMarkup(React.createElement(Barre, { modifie: true, onEnregistrer: () => {}, ...props }));
  assert.match(rendre({}), /md:bottom-3/, 'réglages de l’équipe : inchangé');
  const permanente = rendre({ barreDuBasPermanente: true });
  assert.match(permanente, /sticky bottom-\[calc\(5\.75rem\+env\(safe-area-inset-bottom,0px\)\)\] z-30/);
  assert.doesNotMatch(permanente, /md:bottom-/);
  assert.match(sansCommentaires(lire('src/app/reseller/boutique/page.tsx')), /<BarreEnregistrement[\s\S]*?barreDuBasPermanente[\s\S]*?\/>/);
});

// ── 6. Aucun repli sur le nom enregistré côté navigateur ────────────────────

test('Créateur et Personnaliser : sans nom public, jamais le nom enregistré (qui peut être le nom complet)', () => {
  const createur = sansCommentaires(lire('src/app/reseller/createur/page.tsx'));
  assert.doesNotMatch(createur, /vitrine\?\.nom \|\| r\.boutique\.nom/);
  assert.match(createur, /setBoutique\(r\?\.boutique && r\.vitrine\?\.nom \? \{ \.\.\.r\.boutique, nom: r\.vitrine\.nom \} : null\)/);
  assert.match(createur, /Boutique indisponible/);
  const reglages = sansCommentaires(lire('src/app/reseller/boutique/page.tsx'));
  assert.doesNotMatch(reglages, /vitrine\?\.nom \|\| boutique\.nom/);
  assert.match(reglages, /Ma boutique Suguba\$\{vitrine \? ` — \$\{vitrine\.nom\}` : ''\}/);
});

// ── 7. Retraits d'images : 40 px, un seul indicateur, confirmation ──────────

test('Photos de la boutique : boutons de 40 px, un seul indicateur d’envoi, retrait confirmé sur Personnaliser', () => {
  const Galerie = require('../src/components/reseau/GalerieEditeur.tsx').default;
  const html = renderToStaticMarkup(React.createElement(Galerie, { images: ['https://x/1.webp', 'https://x/2.webp'], max: 10, onChange: () => {} }));
  const boutons = html.match(/<button[^>]*>/g) || [];
  assert.equal(boutons.length, 3, 'retirer ×2, mettre en premier ×1');
  for (const b of boutons) {
    assert.match(b, /\bw-10 h-10\b/, b);
    assert.doesNotMatch(b, /\bw-7\b|\bh-7\b/, b);
  }
  const source = sansCommentaires(lire('src/components/reseau/GalerieEditeur.tsx'));
  assert.equal((source.match(/<SugubaLoader/g) || []).length, 1, 'un seul indicateur pendant l’envoi');
  assert.match(source, /confirmerRetrait && !\(await confirmer\(\{/);
  assert.match(lire('src/app/reseller/boutique/page.tsx'), /<GalerieEditeur images=\{boutique\.galerie \|\| \[\]\} max=\{maxGalerie\} confirmerRetrait/);
});

test('Logo : « Retirer » est un bouton de 40 px, l’appareil photo n’est plus une cible de 28 px ; retrait confirmé sur la vitrine et Personnaliser', () => {
  const Logo = require('../src/components/common/LogoUploader.tsx').default;
  const html = renderToStaticMarkup(React.createElement(Logo, { value: 'https://x/logo.webp', onChange: () => {}, forme: 'carre' }));
  const retirer = html.match(/<button[^>]*aria-label="Retirer le logo"[^>]*>/);
  assert.ok(retirer, 'bouton « Retirer le logo »');
  assert.match(retirer[0], /min-h-\[40px\]/);
  assert.match(html, /Retirer<\/button>/);
  const boutons = html.match(/<button[^>]*>/g) || [];
  for (const b of boutons) assert.doesNotMatch(b, /\bw-6\b|\bw-7\b/, b);
  assert.match(html, /<span aria-hidden="true" class="pointer-events-none absolute[^"]*w-7 h-7/, 'repère appareil photo non cliquable');
  // Sans logo : rien à retirer.
  assert.doesNotMatch(renderToStaticMarkup(React.createElement(Logo, { value: null, onChange: () => {} })), /Retirer/);
  for (const f of ['src/components/common/LogoUploader.tsx', 'src/components/reseau/CouvertureEditeur.tsx']) {
    assert.match(sansCommentaires(lire(f)), /confirmerRetrait && !\(await confirmer\(\{/, f);
  }
  const panneau = lire('src/components/shop/proprietaire/PanneauImage.tsx');
  assert.match(panneau, /<LogoUploader [^>]*confirmerRetrait \/>/);
  assert.match(panneau, /<CouvertureEditeur [^>]*confirmerRetrait \/>/);
});

// ── 8. Guide : la fiche de la vitrine dit vrai ──────────────────────────────

test('Guide : sous un autre profil, le propriétaire garde Copier le lien et Partager', () => {
  const guide = JSON.parse(lire('docs/guide/guide.json'));
  const fiche = guide.pages.find((p) => p.id === 'vitrine-boutique');
  const element = fiche.elements.find((e) => /^Suivre · Copier le lien/.test(e.nom));
  assert.match(element.role, /En gestion, le propriétaire ne les voit qu’en vue client, sans effet\./);
  assert.match(element.role, /Sous un autre profil, il garde Copier le lien et Partager/);
  assert.doesNotMatch(element.role, /^Ce que voit un client\. Le propriétaire ne les voit qu’en vue client/);
});
