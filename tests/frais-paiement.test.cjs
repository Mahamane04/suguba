// Frais de paiement à la charge du client (2026-09-27) : espèces sans frais ;
// Mobile Money = commande + transaction Suguba + retrait opérateur + fonds de
// soutien de l'État, SasPay ajoutant lui-même ses frais (mode ADD_ON).
require('../scripts/test-typescript.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');

process.env.SESSION_SECRET = 'local-test-only-no-real-secret';
global.fetch = async () => { throw Error('External network forbidden'); };

const F = require('../src/lib/frais-paiement.ts');
const P = require('../src/lib/pricing.ts');
const defaut = F.completerFraisPaiement(null);

test('espèces à la livraison : aucun frais, jamais', () => {
  const d = F.calculerFraisPaiement(250000, 'especes', defaut);
  assert.deepEqual(d.lignes, []);
  assert.equal(d.fraisTotal, 0);
  assert.equal(d.totalClient, 250000);
});

test('Orange Money, 10 000 F : Suguba 1 %, retrait 1 %, État 1 %, puis SasPay 4 % ajoutés par SasPay', () => {
  const d = F.calculerFraisPaiement(10000, 'orange_ml', defaut);
  const par = Object.fromEntries(d.lignes.map((l) => [l.code, l.montant]));
  assert.deepEqual(par, { plateforme: 100, retrait: 100, etat: 100, saspay: 412 });
  // Suguba demande la commande + ses trois lignes ; SasPay ajoute les siennes au débit.
  assert.equal(d.montantDemande, 10300);
  assert.equal(d.totalClient, 10712);
  assert.equal(d.fraisTotal, 712);
});

test('au-delà de 1 000 000 F, le retrait Orange Money est un forfait de 10 000 F', () => {
  const d = F.calculerFraisPaiement(1200000, 'orange_ml', defaut);
  assert.equal(d.lignes.find((l) => l.code === 'retrait').montant, 10000);
  assert.equal(d.lignes.find((l) => l.code === 'etat').montant, 12000);
});

// Grilles officielles relevées le 2026-09-27 sur orangemali.com et moov-africa.ml.
test('grille Orange Money : 50 F jusqu’à 5 000 F, 1 % jusqu’à 1 000 000 F', () => {
  const g = defaut.retraitOperateur.orange_ml;
  assert.equal(F.fraisRetraitOperateur(3000, g).frais, 50);
  assert.equal(F.fraisRetraitOperateur(5000, g).frais, 50);
  assert.equal(F.fraisRetraitOperateur(5001, g).frais, 51);
  assert.equal(F.fraisRetraitOperateur(1000000, g).frais, 10000);
});

test('au-delà du plafond d’un retrait Orange (1 500 000 F), l’argent sort en plusieurs retraits', () => {
  const r = F.fraisRetraitOperateur(2000000, defaut.retraitOperateur.orange_ml);
  assert.equal(r.retraits, 2);
  assert.equal(r.frais, 10000 + 5000);
  const d = F.calculerFraisPaiement(2000000, 'orange_ml', defaut);
  assert.equal(d.lignes.find((l) => l.code === 'retrait').detail, '2 retraits');
});

test('grille Moov Money : 0,9 % jusqu’à 1 000 000 F, 9 000 F jusqu’à 2 000 000 F', () => {
  const g = defaut.retraitOperateur.moov_ml;
  assert.equal(F.fraisRetraitOperateur(10000, g).frais, 90);
  assert.equal(F.fraisRetraitOperateur(1500000, g).frais, 9000);
});

test('Wave : pas de frais de retrait opérateur, le 1 % de l’État s’applique, SasPay 5 %', () => {
  const d = F.calculerFraisPaiement(10000, 'wave_ml', defaut);
  const par = Object.fromEntries(d.lignes.map((l) => [l.code, l.montant]));
  assert.deepEqual(par, { plateforme: 100, etat: 100, saspay: 510 });
  assert.equal(d.totalClient, 10710);
});

test('carte : retirée par l’opérateur choisi par l’équipe', () => {
  const parMoov = F.calculerFraisPaiement(10000, 'card', { ...defaut, retraitCarteVia: 'moov_ml' });
  assert.equal(parMoov.lignes.find((l) => l.code === 'retrait').montant, 90);
});

test('grille modifiable : des tranches qui se chevauchent sont refusées', () => {
  const g = { ...defaut.retraitOperateur.orange_ml, tranches: [{ min: 0, max: 10000, pct: 1, fixe: 0 }, { min: 5000, max: 20000, pct: 1, fixe: 0 }] };
  const f = { ...defaut, retraitOperateur: { ...defaut.retraitOperateur, orange_ml: g } };
  assert.ok(F.validerFraisPaiement(f).some((e) => /chevauchent/.test(e)));
  // Une grille enregistrée par l'équipe remplace celle par défaut.
  const relue = F.completerFraisPaiement({ retraitOperateur: { orange_ml: { tranches: [{ min: 0, max: 1e6, pct: 2, fixe: 0 }], source: 'Test', verifieLe: '2026-10-01' } } });
  assert.equal(F.fraisRetraitOperateur(10000, relue.retraitOperateur.orange_ml).frais, 200);
  assert.deepEqual(relue.retraitOperateur.moov_ml, defaut.retraitOperateur.moov_ml);
});

test('tarif SasPay en mode DEDUCTED : le montant demandé est relevé pour que Suguba reçoive tout', () => {
  const f = { ...defaut, saspay: { releveLe: null, reseaux: { orange_ml: { encaissement: [{ min: 0, max: 1e8, pct: 4, fixe: 0, plancher: null, plafond: null, mode: 'DEDUCTED' }], versement: [] } } } };
  const d = F.calculerFraisPaiement(10000, 'orange_ml', f);
  const frais = F.fraisPalier(d.montantDemande, f.saspay.reseaux.orange_ml.encaissement).frais;
  assert.equal(d.montantDemande, d.totalClient);
  assert.ok(d.montantDemande - frais >= 10300, 'après retenue SasPay, Suguba garde commande + frais');
});

test('tarif SasPay inconnu (carte) : les frais Suguba s’appliquent, SasPay est signalé inconnu', () => {
  const d = F.calculerFraisPaiement(10000, 'card', defaut);
  assert.equal(d.tarifSasPayConnu, false);
  assert.equal(d.totalClient, 10300);
});

test('lecture de la réponse SasPay /pricing/my-rates : Mali et international seulement, indisponible = vide', () => {
  const t = F.lireTarifsSasPay({ data: [
    { country_code: 'ML', network_code: 'orange_ml', payin: { available: true, tiers: [{ min_amount: 200, max_amount: 100000000, percent: 4, fixed: 0, floor_amount: null, cap_amount: null, fee_charge_mode: 'ADD_ON' }] }, payout: { available: true, tiers: [{ min_amount: 0, max_amount: 100000000, percent: 2, fixed: 100, floor_amount: null, cap_amount: null, fee_charge_mode: 'ADD_ON' }] } },
    { country_code: 'ML', network_code: 'mobi_cash_ml', payin: { available: false, tiers: [] }, payout: { available: true, tiers: [] } },
    { country_code: 'CI', network_code: 'orange_ci', payin: { available: true, tiers: [{ percent: 2.5 }] }, payout: { available: false } },
  ] }, '2026-09-27T10:00:00.000Z');
  assert.equal(t.releveLe, '2026-09-27T10:00:00.000Z');
  assert.deepEqual(Object.keys(t.reseaux).sort(), ['mobi_cash_ml', 'orange_ml']);
  assert.deepEqual(t.reseaux.orange_ml.encaissement[0], { min: 200, max: 100000000, pct: 4, fixe: 0, plancher: null, plafond: null, mode: 'ADD_ON' });
  assert.deepEqual(t.reseaux.mobi_cash_ml.encaissement, []);
});

test('réglages : complétés par défaut, relus sans perte, taux absurdes refusés', () => {
  assert.equal(defaut.plateformePct, 1);
  assert.equal(defaut.fondsSoutienPct, 1);
  assert.equal(defaut.saspay.reseaux.orange_ml.encaissement[0].pct, 4);
  const relu = F.completerFraisPaiement(JSON.parse(JSON.stringify(defaut)));
  assert.deepEqual(relu, defaut);
  assert.ok(F.validerFraisPaiement({ ...defaut, plateformePct: 50 }).length > 0);
  assert.ok(P.validerReglages({ ...P.completerReglages({}), fraisPaiement: { ...defaut, fondsSoutienPct: -1 } }).some((e) => /État/.test(e)));
});

test('les frais de paiement ne sont plus un coût de Suguba sur la vente', () => {
  const base = P.completerReglages({ provisionRefusPct: 0, coutMessageParCommande: 0, coutsFixesMensuels: [], remunerationLivreur: 0 });
  const avec = P.calculerTarif(20000, 22000, { ...base, fraisPaiementPct: 1.5 });
  const sans = P.calculerTarif(20000, 22000, { ...base, fraisPaiementPct: 0 });
  assert.equal(avec.coutParCommande, 0);
  assert.equal(avec.margeNetteSuguba, sans.margeNetteSuguba);
  assert.equal('coutPaiement' in avec, false);
});

test('baisser les frais de transaction Suguba demande le droit dédié et un motif', () => {
  const { baissesPartSuguba } = require('../src/lib/protection.ts');
  const avant = P.completerReglages({});
  const apres = { ...avant, fraisPaiement: { ...avant.fraisPaiement, plateformePct: 0.5 } };
  assert.ok(baissesPartSuguba(avant, apres).some((b) => b.cle === 'fraisPaiement.plateformePct'));
  const hausse = { ...avant, fraisPaiement: { ...avant.fraisPaiement, plateformePct: 2 } };
  assert.equal(baissesPartSuguba(avant, hausse).some((b) => b.cle === 'fraisPaiement.plateformePct'), false);
});

// ── La route qui démarre le paiement, sur un faux Supabase et un faux SasPay ──
let state = {}; let calls = [];
const adapter = {
  from(table) {
    let op = 'select', patch, one = false; const filtres = [];
    const q = {
      select() { return q; }, eq(k, v) { filtres.push((r) => r[k] === v); return q; },
      update(p) { op = 'update'; patch = p; return q; }, maybeSingle() { one = true; return q; },
      then(ok, ko) {
        calls.push({ table, op, patch });
        const rows = (state[table] || []).filter((r) => filtres.every((f) => f(r)));
        if (op === 'update') rows.forEach((r) => Object.assign(r, patch));
        return Promise.resolve({ data: one ? (rows[0] ? { ...rows[0] } : null) : rows, error: null }).then(ok, ko);
      },
    };
    return q;
  },
  async rpc(name, args) {
    calls.push({ rpc: name, args });
    if (name === 'begin_order_payment') { (state.payment_attempts ||= []).push({ id: 'tentative-test', phone: args.p_phone }); return { data: { id: 'tentative-test', phone: args.p_phone }, error: null }; }
    return { data: { id: 'tentative-test' }, error: null };
  },
};
require.cache[require.resolve('../src/lib/supabase-admin.ts')] = { exports: { getSupabaseAdmin: () => adapter } };
// Réponse de GET /pricing/my-rates simulée : SasPay injoignable au départ.
let reponseTarifs = { ok: false, erreur: 'SasPay injoignable.' };
require.cache[require.resolve('../src/lib/saspay.ts')] = { exports: {
  estReseau: (n) => ['orange_ml', 'moov_ml', 'wave_ml'].includes(n), estReseauGlobal: () => false,
  RESEAUX_MALI: { orange_ml: 'Orange Money', moov_ml: 'Moov Money', wave_ml: 'Wave' }, RESEAUX_GLOBAUX: {},
  initierPayin: async (p) => { calls.push({ payin: p }); return { ok: true, id: 'fake-tx', statut: 'PENDING', urlCheckout: 'https://saspay.test/checkout' }; },
  lireMesTarifs: async () => { calls.push({ lectureTarifs: true }); return reponseTarifs; },
} };
const { NextRequest } = require('next/server');
const T = require('../src/lib/tarifs-saspay.ts');

const { chargerReglages } = require('../src/lib/platform-settings.ts');

test('sans relevé enregistré, les tarifs de départ servent', async () => {
  state = { platform_settings: [{ id: 1, valeurs: {}, confirme: true }] };
  const { reglages } = await chargerReglages();
  assert.equal(reglages.fraisPaiement.saspay.reseaux.orange_ml.encaissement[0].pct, 4);
});

test('relevé de plus de 6 heures : jugé ancien, relu en arrière-plan', () => {
  const maintenant = Date.parse('2026-09-27T18:00:00.000Z');
  assert.equal(T.releveAncien({ saspay: { releveLe: '2026-09-27T11:00:00.000Z', reseaux: {} } }, maintenant), true);
  assert.equal(T.releveAncien({ saspay: { releveLe: '2026-09-27T17:00:00.000Z', reseaux: {} } }, maintenant), false);
  assert.equal(T.releveAncien({ saspay: { releveLe: null, reseaux: {} } }, maintenant), true);
});

test('la route de paiement demande à SasPay la commande + les frais, et garde leur détail', async () => {
  state = { orders: [{ order_number: 'SG-FRAIS001', product_name: 'Article fictif', quantity: 1, total_amount: 10000, status: 'pending_call', payment_collected: false, customer_name: 'Client fictif', customer_phone: '+22300000000' }] };
  calls = [];
  const { POST } = require('../src/app/api/payments/saspay/create/route.ts');
  const res = await POST(new NextRequest('http://localhost/api/payments/saspay/create', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderNumber: 'SG-FRAIS001', network: 'orange_ml', phone: '+22300000000' }),
  }));
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.montantTotal, 10712);
  assert.equal(calls.find((c) => c.payin).payin.montant, 10300, 'SasPay ajoute lui-même ses 4 %');
  const trace = calls.find((c) => c.table === 'payment_attempts' && c.op === 'update');
  assert.equal(trace.patch.amount_requested, 10300);
  assert.equal(trace.patch.fees.totalClient, 10712);
  // SasPay met 10 à 30 s à donner ses tarifs : jamais interrogé pendant un paiement.
  assert.equal(calls.some((c) => c.lectureTarifs), false);
});

test('tarifs SasPay relus automatiquement : un changement chez SasPay s’applique sans toucher au code', async () => {
  state = { platform_settings: [{ id: 1, valeurs: { plateformePct: 1 }, confirme: true }] };
  calls = [];
  reponseTarifs = { ok: true, tarifs: { releveLe: '2026-09-28T08:00:00.000Z', reseaux: {
    orange_ml: { encaissement: [{ min: 0, max: 1e8, pct: 3.5, fixe: 0, plancher: null, plafond: null, mode: 'ADD_ON' }], versement: [] },
  } } };
  const r = await T.actualiserTarifsSasPay();
  assert.equal(r.ok && r.enregistre, true);
  // Seule la colonne des tarifs est écrite : jamais les réglages de l'équipe.
  const ecriture = calls.find((c) => c.table === 'platform_settings' && c.op === 'update');
  assert.deepEqual(Object.keys(ecriture.patch), ['tarifs_saspay']);
  const { reglages } = await chargerReglages();
  assert.equal(reglages.fraisPaiement.saspay.reseaux.orange_ml.encaissement[0].pct, 3.5);
  assert.equal(reglages.fraisPaiement.saspay.releveLe, '2026-09-28T08:00:00.000Z');
  // Un réseau absent du relevé garde sa dernière valeur.
  assert.equal(reglages.fraisPaiement.saspay.reseaux.wave_ml.encaissement[0].pct, 5);
});

test('SasPay injoignable : la relecture échoue sans rien écrire', async () => {
  state = { platform_settings: [{ id: 1, valeurs: {}, confirme: true }] };
  calls = [];
  reponseTarifs = { ok: false, erreur: 'SasPay n’a pas répondu à temps. Réessayez.' };
  assert.equal((await T.actualiserTarifsSasPay()).ok, false);
  assert.equal(calls.some((c) => c.table === 'platform_settings' && c.op === 'update'), false);
});

test('Wave : la route de paiement l’accepte et demande commande + Suguba + État', async () => {
  state = { orders: [{ order_number: 'SG-WAVE0001', product_name: 'Article fictif', quantity: 1, total_amount: 10000, status: 'pending_call', payment_collected: false, customer_name: 'Client fictif', customer_phone: '+22300000000' }] };
  calls = [];
  const { POST } = require('../src/app/api/payments/saspay/create/route.ts');
  const res = await POST(new NextRequest('http://localhost/api/payments/saspay/create', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderNumber: 'SG-WAVE0001', network: 'wave_ml', phone: '+22300000000' }),
  }));
  assert.equal(res.status, 200);
  assert.equal(calls.find((c) => c.payin).payin.reseau, 'wave_ml');
  assert.equal(calls.find((c) => c.payin).payin.montant, 10200);
  assert.equal((await res.json()).montantTotal, 10710);
});
