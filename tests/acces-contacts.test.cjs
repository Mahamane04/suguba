// Protection Suguba — lot 2 (2026-09-26) : coordonnées par dossier et par
// étape ; aucune donnée interne (marge, prix, codes) chez les intervenants.
require('../scripts/test-typescript.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const c = require('../src/lib/acces-contacts.ts');

const commande = (status) => ({
  id: 'o1', status, customer_name: 'Awa Diarra Traoré', customer_phone: '+22370000001', landmark: 'Près de la mosquée',
  delivery_notes: 'Appeler avant', platform_margin: 1500, pricing_snapshot: { tarif: { prixFournisseur: 9000 } },
  delivery_otp: '1234', pickup_code: '5678', reseller_commission: 800, total_amount: 12000,
});
const extras = { pickup_location: { telephone: '+22370000009', adresse: 'Entrepôt' }, client_position: { lat: 12.6, lng: -8 } };

test('livreur : coordonnées pendant la course seulement, jamais de chiffres internes', () => {
  for (const statut of ['confirmed', 'dispatched', 'in_transit']) {
    const o = c.commandePourLivreur(commande(statut), extras);
    assert.equal(o.customer_phone, '+22370000001', statut);
    assert.deepEqual(o.pickup_location, extras.pickup_location);
    assert.equal(o.contactsVisibles, true);
  }
  for (const statut of ['delivered', 'cancelled', 'returned', 'pending_call']) {
    const o = c.commandePourLivreur(commande(statut), extras);
    assert.equal(o.customer_phone, '', statut);
    assert.equal(o.customer_name, 'Awa T.');
    assert.equal(o.landmark, null);
    assert.equal(o.delivery_notes, null);
    assert.equal(o.pickup_location, null, 'plus d’adresse ni de téléphone du fournisseur');
    assert.equal(o.client_position, null);
  }
  const o = c.commandePourLivreur(commande('in_transit'), extras);
  for (const interne of ['platform_margin', 'pricing_snapshot', 'delivery_otp', 'pickup_code', 'reseller_commission']) {
    assert.equal(interne in o, false, interne);
  }
  assert.equal(o.total_amount, 12000, 'le montant à encaisser reste visible');
});

test('revendeur : son client, sans la marge Suguba ni le prix fournisseur', () => {
  const o = c.commandePourRevendeur(commande('delivered'));
  assert.equal(o.customer_phone, '+22370000001');
  assert.equal(o.reseller_commission, 800, 'son gain reste visible');
  for (const interne of ['platform_margin', 'pricing_snapshot', 'delivery_otp', 'pickup_code']) assert.equal(interne in o, false, interne);
});

test('fournisseur : client après la prise en charge de la remise ; devis tant qu’il n’a pas répondu', () => {
  assert.equal(c.clientVisiblePourRemise({ status: 'confirmed', assigned_driver_id: null }, 'f1'), false, 'pas encore pris en charge');
  assert.equal(c.clientVisiblePourRemise({ status: 'confirmed', assigned_driver_id: 'f2' }, 'f1'), false, 'pris par un autre');
  assert.equal(c.clientVisiblePourRemise({ status: 'in_transit', assigned_driver_id: 'f1' }, 'f1'), true);
  assert.equal(c.clientVisiblePourRemise({ status: 'delivered', assigned_driver_id: 'f1' }, 'f1'), false, 'remise faite');
  assert.equal(c.telephoneDevisVisible('demande'), true);
  for (const s of ['proposee', 'acceptee', 'refusee_client', 'refusee_fournisseur']) assert.equal(c.telephoneDevisVisible(s), false, s);
  assert.equal(c.nomMasque('Moussa'), 'Moussa');
  assert.equal(c.nomMasque(''), 'Client');
});

test('SQL : journal des accès, une ligne par personne, dossier et jour', async () => {
  const { database, sql } = require('./helpers/audit-db.cjs');
  const db = await database();
  await db.exec(sql('A-EXECUTER-2026-09-26-acces-coordonnees.sql'));
  await db.exec(sql('A-EXECUTER-2026-09-26-acces-coordonnees.sql'));
  await db.exec(`INSERT INTO public.acces_coordonnees (personne_id, role, raison, dossier) VALUES ('d1', 'driver', 'course', 'o1')
    ON CONFLICT (personne_id, dossier, jour) DO NOTHING`);
  await db.exec(`INSERT INTO public.acces_coordonnees (personne_id, role, raison, dossier) VALUES ('d1', 'driver', 'course', 'o1')
    ON CONFLICT (personne_id, dossier, jour) DO NOTHING`);
  assert.equal(Number((await db.query(`SELECT count(*) n FROM public.acces_coordonnees`)).rows[0].n), 1);
  await assert.rejects(db.exec(`INSERT INTO public.acces_coordonnees (personne_id, role, raison, dossier) VALUES ('r1', 'reseller', 'course', 'o2')`));
});
