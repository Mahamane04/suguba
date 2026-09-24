// Livraison à Bamako calculée au GPS (2026-09-24) : position exacte du dépôt
// fournisseur et du client quand elles sont connues, centre du quartier sinon.
require('../scripts/test-typescript.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const P = require('../src/lib/pricing.ts');
const Q = require('../src/lib/bamako-quartiers.ts');
const { normaliserCommande } = require('../src/lib/order-input.ts');

const r = P.completerReglages({ ...P.REGLAGES_PAR_DEFAUT, modeLivraisonBamako: 'distance' });
const produit = { prixFournisseur: 20000, prixVente: 30000 };
const base = { quantite: 1, ville: 'Bamako', revendeurAttribue: false, quartierFournisseur: 'Hamdallaye ACI 2000', quartierClient: 'Badalabougou' };

test('une position hors de Bamako est ignorée', () => {
  assert.equal(Q.positionValide({ lat: 48.85, lng: 2.35 }), null); // Paris
  assert.equal(Q.positionValide({ lat: 'abc', lng: 1 }), null);
  assert.equal(Q.positionValide(null), null);
  assert.ok(Q.positionValide({ lat: 12.64, lng: -8.0 }));
});

test('sans GPS : centre des quartiers, comme avant', () => {
  const d = P.calculerCommande(produit, base, r);
  assert.ok(d.distanceLivraisonKm > 0);
  assert.equal(d.positionClientUtilisee, false);
});

test('avec GPS : la position exacte remplace le centre du quartier', () => {
  const depot = Q.positionValide({ lat: 12.6310, lng: -8.0290 });
  // Client juste à côté du dépôt, alors qu'il a choisi un quartier lointain.
  const client = { lat: 12.6315, lng: -8.0295 };
  const d = P.calculerCommande(produit, { ...base, positionFournisseur: depot, positionClient: client }, r);
  assert.equal(d.positionClientUtilisee, true);
  assert.ok(d.distanceLivraisonKm < 0.5, `distance ${d.distanceLivraisonKm}`);
  assert.equal(d.fraisLivraison, r.livraisonDistanceBamako.fraisMinimum);
});

test('les frais restent bornés entre le minimum et le maximum', () => {
  const loin = P.calculerCommande(produit, { ...base, positionFournisseur: { lat: 12.52, lng: -8.10 }, positionClient: { lat: 12.75, lng: -7.90 } }, r);
  assert.ok(loin.fraisLivraison <= r.livraisonDistanceBamako.fraisMaximum);
});

test('la commande garde la position valide du client, pas une position farfelue', () => {
  const commun = { productId: 'p1', quantity: 1, customerName: 'A', customerPhone: '+22370000000', city: 'Bamako', neighborhood: 'Badalabougou', landmark: 'Pharmacie' };
  assert.deepEqual(normaliserCommande({ ...commun, positionClient: { lat: 12.63, lng: -8.0 } }).positionClient, { lat: 12.63, lng: -8 });
  assert.equal(normaliserCommande({ ...commun, positionClient: { lat: 5, lng: 5 } }).positionClient, undefined);
});
