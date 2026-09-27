// Admin A5 (2026-09-27) : pilotage — centre des modules, accueil client,
// « Pourquoi c'est bloqué ? », simulateur de réglages.
require('../scripts/test-typescript.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { existsSync, readFileSync } = require('node:fs');
const path = require('node:path');
const p = require('../src/lib/admin/pilotage.ts');

test('centre des modules : chaque module dit ce qu’il ouvre, ce qui continue, et où il se règle', () => {
  for (const m of p.MODULES) {
    assert.ok(m.ouvre.length > 20 && m.continue.length > 20, m.cle);
    const page = m.lien.split('#')[0];
    assert.ok(existsSync(path.join(__dirname, '../src/app', page, 'page.tsx')), `${m.cle} → ${page}`);
  }
  const reglages = require('../src/lib/reseau/reglages.ts');
  for (const m of p.MODULES.filter((x) => x.interrupteur === 'priorite-reseau')) {
    assert.ok(m.cle in reglages.REGLAGES_RESEAU_DEFAUT, `${m.cle} existe dans les réglages réseau`);
  }
});

test('accueil : blocs connus seulement, visibles par défaut', () => {
  const { normaliserBlocsAccueil, BLOCS_ACCUEIL_DEFAUT, normaliserReglagesReseau } = require('../src/lib/reseau/reglages.ts');
  assert.deepEqual(normaliserBlocsAccueil(null), BLOCS_ACCUEIL_DEFAUT);
  assert.deepEqual(normaliserBlocsAccueil({ gagner: false, pirate: true, garanties: 'non' }), { ...BLOCS_ACCUEIL_DEFAUT, gagner: false });
  assert.equal(normaliserReglagesReseau({}).accueilBlocs.a_la_une, true);
  const home = readFileSync(require.resolve('../src/app/page.tsx'), 'utf8');
  for (const cle of ['a_la_une', 'boutiques_quartier', 'gagner', 'garanties']) assert.match(home, new RegExp(`blocs\\.${cle} &&`), cle);
  assert.match(readFileSync(require.resolve('../src/app/api/settings/public/route.ts'), 'utf8'), /accueil: reseau\.accueilBlocs/);
});

test('diagnostic : retrait (méthode, double validation)', () => {
  const ctx = { seuil: 100000, validation: null, reseauxMobile: ['orange_money', 'moov'] };
  const wave = p.diagnostiquerRetrait({ id: 'R1', status: 'pending', payment_method: 'wave', amount: 5000 }, ctx);
  assert.ok(wave.raisons.some((r) => r.bloquant && /Orange Money/.test(r.texte)));
  const gros = p.diagnostiquerRetrait({ id: 'R2', status: 'pending', payment_method: 'orange_money', amount: 150000 }, ctx);
  assert.ok(gros.raisons.some((r) => r.bloquant && /seuil/.test(r.texte)));
  const attente = p.diagnostiquerRetrait({ id: 'R2', status: 'pending', payment_method: 'orange_money', amount: 150000 }, { ...ctx, validation: 'en_attente' });
  assert.ok(attente.raisons.some((r) => r.lien === '/admin/validations'));
  const libre = p.diagnostiquerRetrait({ id: 'R3', status: 'pending', payment_method: 'orange_money', amount: 5000 }, ctx);
  assert.ok(libre.raisons.every((r) => !r.bloquant) && /Rien ne bloque/.test(libre.raisons.at(-1).texte));
  assert.equal(p.diagnostiquerRetrait({ id: 'R4', status: 'completed', payment_method: 'cash', amount: 1 }, ctx).etat, 'Payé');
});

test('diagnostic : commission (délai de sécurité, espèces non reversées)', () => {
  const m = Date.parse('2026-09-27T12:00:00Z');
  const d = p.diagnostiquerCommission({ id: 'c1-xxxxxxx', status: 'pending', amount: 3000, unlock_at: '2026-09-30T12:00:00Z' }, { fondsRecus: false, maintenant: m });
  assert.equal(d.raisons.filter((r) => r.bloquant).length, 2);
  assert.ok(d.raisons.some((r) => r.lien === '/admin/caisse-livreurs'));
  assert.equal(p.diagnostiquerCommission({ id: 'c2', status: 'available', amount: 1, unlock_at: null }, { fondsRecus: true }).etat, 'Disponible');
});

test('diagnostic : commande et sponsorisation', () => {
  const c = p.diagnostiquerCommande({ order_number: 'SG-1', status: 'confirmed', assigned_driver_id: null, payment_method: 'cash', delivered_at: null });
  assert.ok(c.raisons.some((r) => r.bloquant && /aucun livreur/.test(r.texte)));
  const livree = p.diagnostiquerCommande({ order_number: 'SG-2', status: 'delivered', assigned_driver_id: 'd1', payment_method: 'cash', delivered_at: '2026-09-26', cash_remittance_id: null });
  assert.ok(livree.raisons.some((r) => r.bloquant && /reversées/.test(r.texte)));
  const s = p.diagnostiquerSponsorisation({ id: 's1-xxxxxxx', label: 'Promo', status: 'pending', budget: 50000, paid_amount: 20000 });
  assert.ok(s.raisons.some((r) => r.bloquant && /30 000/.test(r.texte.replace(/ | /g, ' '))));
});

test('diagnostic : lecture seule, droits par type', () => {
  const src = readFileSync(require.resolve('../src/app/api/admin/diagnostic/route.ts'), 'utf8');
  assert.doesNotMatch(src, /\.update\(|\.insert\(|\.upsert\(|\.delete\(/);
  assert.match(src, /permissions\.includes\(def\.permission\)/);
});

test('simulateur : champs connus seulement, rien n’est écrit', () => {
  assert.deepEqual(p.lireModifs({ partRevendeurPct: '12', inconnu: 5, commissionMinimale: -1, fraisPaiementPct: true }), { partRevendeurPct: 12 });
  const src = readFileSync(require.resolve('../src/app/api/admin/simulateur/route.ts'), 'utf8');
  assert.doesNotMatch(src, /\.update\(|\.insert\(|\.upsert\(|\.delete\(|export async function POST/);
  const { completerReglages, REGLAGES_PAR_DEFAUT } = require('../src/lib/pricing.ts');
  const r = completerReglages(REGLAGES_PAR_DEFAUT);
  for (const c of p.CHAMPS_SIMULATION) assert.equal(typeof r[c.cle], 'number', `${c.cle} est un réglage numérique`);
});

test('permissions A5', () => {
  const { PERMISSION_PAR_ROUTE, ROUTES_CONTROLE_INTERNE } = require('../src/lib/reseau/permissions-routes.ts');
  assert.equal(PERMISSION_PAR_ROUTE['POST /api/admin/accueil'], 'plateforme.parametres');
  assert.equal(PERMISSION_PAR_ROUTE['GET /api/admin/simulateur'], 'finance.lire');
  assert.ok(ROUTES_CONTROLE_INTERNE.includes('/api/admin/modules'));
  assert.ok(ROUTES_CONTROLE_INTERNE.includes('/api/admin/diagnostic'));
});
