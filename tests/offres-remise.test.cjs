// Offres & remise par le fournisseur (2026-09-26, lot 1a) : frais du
// fournisseur à la place de la livraison Suguba, groupes de remise séparés,
// caisse sans rémunération de livreur, routes fournisseur.
require('../scripts/test-typescript.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');

const { calculerCommande, completerReglages } = require('../src/lib/pricing.ts');
const { calculerLignesPanier } = require('../src/lib/cart-input.ts');
const { remiseDuProduit, modeRemiseCommande, normaliserTypeOffre } = require('../src/lib/offre.ts');
const { calculerAVerser } = require('../src/lib/caisse-livreur.ts');

const r = completerReglages({});
const article = { prixFournisseur: 100000, prixVente: 120000, commissionProposee: 5000 };
const demande = { quantite: 1, ville: 'Bamako', quartierClient: 'ACI 2000', revendeurAttribue: false, pointRelaisId: 'hub-aci' };

test('offre : valeurs inconnues ramenées aux défauts sûrs', () => {
  assert.deepEqual(remiseDuProduit({}), { mode: 'livreur', frais: 0 });
  assert.deepEqual(remiseDuProduit({ mode_remise: 'fournisseur', frais_remise: '2500' }), { mode: 'fournisseur', frais: 2500 });
  assert.deepEqual(remiseDuProduit({ mode_remise: 'retrait', frais_remise: 9000 }), { mode: 'retrait', frais: 0 });
  assert.deepEqual(remiseDuProduit({ mode_remise: 'drone' }), { mode: 'livreur', frais: 0 });
  assert.equal(modeRemiseCommande({ remise: { mode: 'fournisseur' } }), 'fournisseur');
  assert.equal(modeRemiseCommande(null), 'livreur', 'anciennes commandes : livreur');
  assert.equal(normaliserTypeOffre('produit_service'), 'produit_service');
  assert.equal(normaliserTypeOffre('x'), 'produit');
});

test('devis : remise par le fournisseur = ses frais, jamais de point relais', () => {
  const d = calculerCommande({ ...article, remise: { mode: 'fournisseur', frais: 5000 } }, demande, r);
  assert.equal(d.modeLivraison, 'fournisseur');
  assert.equal(d.fraisLivraison, 5000);
  assert.equal(d.pointRelais, null);
  assert.equal(d.total, d.montantArticles + 5000);
});

test('devis : retrait chez le vendeur = aucun frais ; livreur = inchangé', () => {
  const retrait = calculerCommande({ ...article, remise: { mode: 'retrait', frais: 7000 } }, demande, r);
  assert.equal(retrait.modeLivraison, 'retrait');
  assert.equal(retrait.fraisLivraison, 0);
  const sansRemise = calculerCommande(article, demande, r);
  const livreur = calculerCommande({ ...article, remise: { mode: 'livreur', frais: 0 } }, demande, r);
  assert.equal(livreur.modeLivraison, sansRemise.modeLivraison);
  assert.equal(livreur.total, sansRemise.total);
});

test('panier : une remise fournisseur forme son propre groupe (un scan ≠ deux modes)', () => {
  const p = (id, x = {}) => ({ id, name: id, supplier_price: 10000, public_price: 13000, commission_proposee: null, supplier_id: 'f1', ...x });
  const lignes = calculerLignesPanier(
    [{ productId: 'a', quantity: 1 }, { productId: 'b', quantity: 1 }, { productId: 'c', quantity: 1 }],
    [p('a'), p('b', { mode_remise: 'fournisseur', frais_remise: 3000 }), p('c', { mode_remise: 'fournisseur', frais_remise: 3000 })],
    new Map(),
    { ville: 'Bamako', quartierClient: 'ACI 2000', revendeurAttribue: false },
    r,
  );
  assert.equal(lignes[0].groupe, 'f:f1');
  assert.equal(lignes[1].groupe, 'fournisseur:f1');
  assert.equal(lignes[2].groupe, 'fournisseur:f1');
  assert.equal(lignes[1].fraisLivraison, 3000, 'frais une fois par groupe');
  assert.equal(lignes[2].fraisLivraison, 0);
});

test('caisse : le fournisseur ne garde aucune rémunération de livreur', () => {
  assert.deepEqual(calculerAVerser([50000, 20000], 1000), { especes: 70000, garde: 2000, aVerser: 68000 });
  assert.deepEqual(calculerAVerser([50000, 20000], 1000, 1), { especes: 70000, garde: 1000, aVerser: 69000 });
  assert.deepEqual(calculerAVerser([50000], 1000, 0), { especes: 50000, garde: 0, aVerser: 50000 });
});

// ── Route fournisseur ──────────────────────────────────────────────────────
let rpcs, contexte;
const admin = {
  from() {
    const q = { select() { return q; }, eq() { return q; }, maybeSingle: async () => ({ data: { company_name: '[TEST] Solaire SARL' }, error: null }) };
    return q;
  },
  async rpc(nom, args) {
    rpcs.push({ nom, args });
    if (nom === 'prendre_en_charge_remise') return { data: { success: true, orderNumber: 'SG-TEST01', commandes: 1 }, error: null };
    if (nom === 'verify_delivery_atomic') return { data: { success: true, orderNumber: 'SG-TEST01' }, error: null };
    return { data: null, error: { message: 'inconnu' } };
  },
};
require.cache[require.resolve('../src/lib/supabase-admin.ts')] = { exports: { getSupabaseAdmin: () => admin } };
require.cache[require.resolve('../src/lib/reseau/contexte-fournisseur.ts')] = {
  exports: { exigerDroitFournisseur: async () => (contexte ? { ok: true, contexte } : { ok: false, statut: 403, erreur: 'Votre rôle dans l’équipe ne permet pas cette action.' }) },
};
const { POST } = require('../src/app/api/supplier/remise/route.ts');
const { NextRequest } = require('next/server');
const poster = (corps) => POST(new NextRequest('http://localhost/api/supplier/remise', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps),
}));

test('fournisseur : « Organiser la remise » au nom du PROPRIÉTAIRE, même pour un membre d’équipe', async () => {
  rpcs = [];
  contexte = { fournisseurId: 'proprio-1', personneId: 'membre-7', role: 'stock', droits: ['catalogue', 'commandes'] };
  const r = await poster({ action: 'prendre', orderId: 'o1' });
  assert.equal(r.status, 200);
  assert.equal(rpcs[0].nom, 'prendre_en_charge_remise');
  assert.equal(rpcs[0].args.p_supplier_id, 'proprio-1');
  assert.equal(rpcs[0].args.p_supplier_name, '[TEST] Solaire SARL');
});

test('fournisseur : confirmer = verify_delivery_atomic avec le fournisseur comme intervenant', async () => {
  rpcs = [];
  contexte = { fournisseurId: 'proprio-1', personneId: 'proprio-1', role: 'proprietaire', droits: ['commandes'] };
  assert.equal((await poster({ action: 'confirmer', orderId: 'o1', code: '12a4' })).status, 400);
  const r = await poster({ action: 'confirmer', orderId: 'o1', code: '4821' });
  assert.equal(r.status, 200);
  assert.deepEqual(rpcs[0], { nom: 'verify_delivery_atomic', args: { p_order_id: 'o1', p_driver_id: 'proprio-1', p_code: '4821' } });
});

test('fournisseur : sans le droit « commandes », rien n’est appelé', async () => {
  rpcs = [];
  contexte = null;
  assert.equal((await poster({ action: 'prendre', orderId: 'o1' })).status, 403);
  assert.deepEqual(rpcs, []);
});
