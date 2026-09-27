// Admin U2 à U4 (2026-09-27) : agir là où on voit (commandes, retraits,
// livreurs, paramètres hors de la vue d'ensemble), poste ordinateur (menu,
// compteurs, déconnexion, une seule barre), tableaux.
require('../scripts/test-typescript.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { existsSync, readFileSync, readdirSync, statSync } = require('node:fs');
const path = require('node:path');

process.env.SESSION_SECRET = 'local-test-only-no-real-secret';
global.fetch = async () => { throw Error('External network forbidden'); };

// ── Faux Supabase (même principe que audit-security) ─────────────────────────
let state = {};
const adapter = {
  from(table) {
    let op = 'select', patch, one = false; const filtres = [];
    const q = {
      select() { return q; }, eq(k, v) { filtres.push((r) => r[k] === v); return q; }, in(k, v) { filtres.push((r) => v.includes(r[k])); return q; },
      order() { return q; }, limit() { return q; }, update(p) { op = 'update'; patch = p; return q; }, insert(p) { op = 'insert'; patch = p; return q; },
      maybeSingle() { one = true; return q; },
      then(ok, ko) {
        let rows = (state[table] || []).filter((r) => filtres.every((f) => f(r)));
        if (op === 'update') rows.forEach((r) => Object.assign(r, patch));
        if (op === 'insert') { rows = [patch]; (state[table] ||= []).push(patch); }
        return Promise.resolve({ data: one ? (rows[0] ? { ...rows[0] } : null) : rows.map((r) => ({ ...r })), error: null }).then(ok, ko);
      },
    };
    return q;
  },
};
require.cache[require.resolve('../src/lib/supabase-admin.ts')] = { exports: { getSupabaseAdmin: () => adapter } };
const { NextRequest } = require('next/server');
const { createSessionToken } = require('../src/lib/session.ts');

function reset(roleEquipe = 'super_admin') {
  state = {
    profiles: [
      { id: 'test-admin', role: 'admin', status: 'active', phone: '+22300000000', full_name: 'Admin' },
      { id: 'test-driver', role: 'driver', status: 'active', phone: '+22300000001', full_name: 'Moussa Livreur' },
    ],
    profile_roles: [{ profile_id: 'test-admin', role: 'admin', status: 'active' }, { profile_id: 'test-driver', role: 'driver', status: 'active' }],
    admin_team_members: [{ profile_id: 'test-admin', team_role: roleEquipe, permissions: [] }],
    drivers: [{ profile_id: 'test-driver', active_status: true }],
    orders: [
      { id: 'o1', order_number: 'SG-AAAA1111', status: 'pending_call', assigned_driver_id: null, payment_method: 'orange_money', pricing_snapshot: null },
      { id: 'o2', order_number: 'SG-BBBB2222', status: 'confirmed', assigned_driver_id: null, payment_method: 'orange_money', pricing_snapshot: null },
      { id: 'o3', order_number: 'SG-CCCC3333', status: 'confirmed', assigned_driver_id: null, payment_method: 'orange_money', pricing_snapshot: { remise: { mode: 'retrait' } } },
    ],
    journal_admin: [],
  };
}
async function poster(corps) {
  const token = await createSessionToken({ uid: 'test-admin', phone: '+22300000000', role: 'admin', status: 'active' });
  const req = new NextRequest('http://localhost/api/admin/commandes', {
    method: 'POST', headers: { 'Content-Type': 'application/json', cookie: `suguba_session=${token}` }, body: JSON.stringify(corps),
  });
  const r = await require('../src/app/api/admin/commandes/route.ts').POST(req);
  return { status: r.status, corps: await r.json() };
}
const commande = (id) => state.orders.find((o) => o.id === id);

test('règle pure : confirmer seulement une commande à confirmer, attribuer avec un livreur', () => {
  const { majPourAction } = require('../src/lib/commande-admin.ts');
  assert.deepEqual(majPourAction('confirmer', 'pending_call'), { maj: { status: 'confirmed' } });
  assert.match(majPourAction('confirmer', 'confirmed').erreur, /n’attend plus/);
  assert.match(majPourAction('attribuer', 'pending_call', { id: 'd', nom: 'x' }).erreur, /Impossible d’attribuer/);
  assert.equal(majPourAction('attribuer', 'confirmed', null).status, 400);
  assert.deepEqual(majPourAction('attribuer', 'dispatched', { id: 'd', nom: 'Awa' }).maj, { status: 'dispatched', assigned_driver_id: 'd', assigned_driver_name: 'Awa' });
});

test('Commandes : confirmer après l’appel, une seule fois', async () => {
  reset();
  const ok = await poster({ action: 'confirmer', orderId: 'o1' });
  assert.equal(ok.status, 200, JSON.stringify(ok.corps));
  assert.equal(commande('o1').status, 'confirmed');
  assert.ok(state.journal_admin.some((j) => j.action === 'POST /api/admin/commandes'), 'action journalisée');
  const encore = await poster({ action: 'confirmer', orderId: 'o1' });
  assert.equal(encore.status, 409);
});

test('Commandes : attribuer un livreur actif ; nom lu en base, jamais dans la requête', async () => {
  reset();
  const r = await poster({ action: 'attribuer', orderIds: ['o2'], driverId: 'test-driver', driverName: 'Faux nom' });
  assert.equal(r.status, 200, JSON.stringify(r.corps));
  assert.equal(commande('o2').status, 'dispatched');
  assert.equal(commande('o2').assigned_driver_id, 'test-driver');
  assert.equal(commande('o2').assigned_driver_name, 'Moussa Livreur');
  reset();
  state.drivers[0].active_status = false;
  const refus = await poster({ action: 'attribuer', orderIds: ['o2'], driverId: 'test-driver' });
  assert.equal(refus.status, 409);
  assert.match(refus.corps.error, /Livreur non autorisé/);
  assert.equal(commande('o2').status, 'confirmed');
});

test('Commandes : attribution groupée, chaque commande contrôlée à part', async () => {
  reset();
  const r = await poster({ action: 'attribuer', orderIds: ['o2', 'o1', 'o3'], driverId: 'test-driver' });
  assert.equal(r.status, 200);
  assert.deepEqual(r.corps.resultats.map((x) => [x.id, x.ok]), [['o2', true], ['o1', false], ['o3', false]]);
  assert.match(r.corps.resultats[2].error, /fournisseur/, 'remise par le fournisseur : pas de livreur Suguba');
  assert.equal(commande('o1').status, 'pending_call', 'une commande à confirmer n’est pas attribuée');
  const trop = await poster({ action: 'attribuer', orderIds: Array.from({ length: 21 }, (_, i) => `x${i}`), driverId: 'test-driver' });
  assert.equal(trop.status, 400);
});

test('Commandes : droits par rôle (Support confirme, Livraison attribue, Marketing rien)', async () => {
  reset('support');
  assert.equal((await poster({ action: 'confirmer', orderId: 'o1' })).status, 200);
  reset('responsable_livraison');
  assert.equal((await poster({ action: 'confirmer', orderId: 'o1' })).status, 403);
  assert.equal((await poster({ action: 'attribuer', orderIds: ['o2'], driverId: 'test-driver' })).status, 200);
  reset('marketing');
  assert.equal((await poster({ action: 'attribuer', orderIds: ['o2'], driverId: 'test-driver' })).status, 403);
});

const lire = (f) => readFileSync(path.join(__dirname, '..', f), 'utf8');
const pageExiste = (href) => existsSync(path.join(__dirname, '../src/app', href.split('?')[0], 'page.tsx'));

test('une seule version des contrôles de commande (synchro et actions de l’équipe)', () => {
  assert.match(lire('src/app/api/orders/sync/route.ts'), /appliquerMajCommande\(admin, existing, maj, session\.role\)/);
  assert.doesNotMatch(lire('src/app/api/orders/sync/route.ts'), /etatEspecesCollecteur/, 'plus de copie des règles');
  assert.match(lire('src/app/api/admin/commandes/route.ts'), /avecJournal\(req, 'POST \/api\/admin\/commandes'/);
});

test('menu : chaque entrée mène à une vraie page, plus aucune ancre', () => {
  const { RUBRIQUES, TYPES_PAR_ENTREE, compteurEntree } = require('../src/lib/admin/poste.ts');
  const hrefs = RUBRIQUES.flatMap((r) => r.entrees.map((e) => e.href));
  for (const h of hrefs) { assert.ok(!h.includes('#'), h); assert.ok(pageExiste(h), h); }
  for (const h of ['/admin/retraits', '/admin/livreurs', '/admin/parametres']) assert.ok(hrefs.includes(h), h);
  for (const h of Object.keys(TYPES_PAR_ENTREE)) assert.ok(hrefs.includes(h), `compteur sans entrée : ${h}`);
  const c = { commande_a_confirmer: 3, livraison_a_attribuer: 2, retrait_a_payer: 1 };
  assert.equal(compteurEntree('/admin/commandes', c), 5);
  assert.equal(compteurEntree('/admin/a-traiter', c), 6);
  assert.equal(compteurEntree('/admin/journal', c), 0);
  assert.equal(compteurEntree('/admin/commandes', null), 0);
});

test('liens : plus d’ancre vers l’ancienne vue d’ensemble, dossiers ciblés par ?id=', () => {
  const fichiers = [];
  const parcourir = (d) => { for (const n of readdirSync(d)) { const p = path.join(d, n); if (statSync(p).isDirectory()) parcourir(p); else if (/\.tsx?$/.test(n)) fichiers.push(p); } };
  parcourir(path.join(__dirname, '../src'));
  const fautifs = fichiers.filter((f) => /\/admin#|admin\/backoffice['"`]/.test(readFileSync(f, 'utf8')));
  assert.deepEqual(fautifs.map((f) => path.relative(path.join(__dirname, '..'), f)), []);
  const atraiter = lire('src/lib/admin/a-traiter.ts');
  for (const p of ['retraits', 'prestations', 'messages', 'verifications', 'sav', 'devis', 'validations', 'sponsorisations', 'caisse-livreurs']) {
    assert.match(atraiter, new RegExp(`/admin/${p}\\?id=`), p);
  }
  assert.match(lire('src/app/api/admin/a-traiter/route.ts'), /searchParams\.get\('compteurs'\) === '1'/);
  assert.match(lire('next.config.js'), /source: '\/admin\/backoffice', destination: '\/admin\/a-traiter'/);
  assert.equal(existsSync(path.join(__dirname, '../src/app/admin/backoffice/page.tsx')), false);
});

test('vue d’ensemble : des chiffres et des files, plus aucune action ni réglage', () => {
  const vue = lire('src/app/admin/page.tsx');
  assert.doesNotMatch(vue, /fetch\(|EconomicSettingsPanel|confirmOrderCall|assignDriver|prompt\(/);
  assert.match(lire('src/app/admin/parametres/page.tsx'), /EconomicSettingsPanel/);
  assert.match(lire('src/app/admin/retraits/page.tsx'), /\/api\/payouts\/initiate/);
  assert.match(lire('src/app/admin/livreurs/page.tsx'), /DriverVerificationPanel/);
});

test('poste ordinateur : déconnexion au menu, une seule barre, plus de fenêtres du navigateur', () => {
  const poste = lire('src/components/admin/PosteAdmin.tsx');
  assert.match(poste, /deconnecter\(\)/);
  assert.match(poste, /Se déconnecter/);
  assert.match(poste, /a-traiter\?compteurs=1/);
  assert.match(lire('src/components/common/Header.tsx'), /if \(dansPoste\) return null;/);
  assert.match(lire('src/components/common/BottomNav.tsx'), /if \(dansPoste\) return null;/);
  const fichiers = [];
  const parcourir = (d) => { for (const n of readdirSync(d)) { const p = path.join(d, n); if (statSync(p).isDirectory()) parcourir(p); else if (n.endsWith('.tsx')) fichiers.push(p); } };
  parcourir(path.join(__dirname, '../src/app/admin'));
  parcourir(path.join(__dirname, '../src/components/admin'));
  const fautifs = fichiers.filter((f) => /window\.(prompt|confirm|alert)\(/.test(readFileSync(f, 'utf8')));
  assert.deepEqual(fautifs.map((f) => path.basename(path.dirname(f)) + '/' + path.basename(f)), []);
  // Jargon anglais retiré des titres.
  for (const f of fichiers) assert.doesNotMatch(readFileSync(f, 'utf8'), />[^<{]*\b(Desk|Dispatch|GMV|Onboarding|Ops)\b[^<{]*</, f);
});

test('tableaux : les listes de travail passent en tableau, ligne → panneau', () => {
  for (const p of ['commandes', 'utilisateurs', 'boutiques', 'devis', 'sav', 'verifications', 'retraits']) {
    assert.match(lire(`src/app/admin/${p}/page.tsx`), /<TableauAdmin/, p);
  }
  const tableau = lire('src/components/admin/TableauAdmin.tsx');
  assert.match(tableau, /suguba_colonnes_/);
  assert.match(tableau, /aria-sort=/);
  assert.match(tableau, /md:hidden/, 'cartes sur téléphone');
  assert.match(lire('src/components/admin/Panneau.tsx'), /useModalFocus/);
});
