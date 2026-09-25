// Devis enregistrés (2026-09-26, lot 1b) : validation de la demande, prix
// calculé et figé, vue client sans coûts, acceptation → commande normale.
require('../scripts/test-typescript.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');

const { completerReglages } = require('../src/lib/pricing.ts');
const r = completerReglages({});

// ── Base simulée : les filtres gardent les objets d'origine, update() les modifie ──
let tables, rpcs;
function requete(nom) {
  tables[nom] ||= [];
  let lignes = tables[nom];
  let maj = null;
  const appliquer = () => { if (maj) lignes.forEach((l) => Object.assign(l, maj)); };
  const q = {
    select() { return q; },
    eq(c, v) { lignes = lignes.filter((l) => l[c] === v); return q; },
    in(c, vs) { lignes = lignes.filter((l) => vs.includes(l[c])); return q; },
    order() { return q; },
    limit(n) { lignes = lignes.slice(0, n); return q; },
    update(v) { maj = v; return q; },
    maybeSingle: async () => { appliquer(); return { data: lignes[0] ? { ...lignes[0] } : null, error: null }; },
    then(ok, ko) { appliquer(); return Promise.resolve({ data: lignes.map((l) => ({ ...l })), error: null }).then(ok, ko); },
    insert: async (ligne) => { tables[nom].push({ id: `q${tables[nom].length + 1}`, ...ligne }); return { error: null }; },
  };
  return q;
}
const admin = {
  from: (nom) => requete(nom),
  async rpc(nom, args) {
    rpcs.push({ nom, args });
    if (nom === 'create_order_with_commission') return { data: { created: true, order: { ...args.p_order, status: 'pending_call' } }, error: null };
    return { data: null, error: null };
  },
};
require.cache[require.resolve('../src/lib/depot-fournisseur.ts')] = { exports: { depotsFournisseurs: async () => new Map() } };
// Avis capturés en mémoire : jamais de table notifications réelle.
const avis = [];
require.cache[require.resolve('../src/lib/reseau/notifications.ts')] = { exports: { notifier: async (ids, contenu) => { avis.push({ ids, ...contenu }); } } };
const devis = require('../src/lib/devis.ts');

const CLE = '11111111-2222-4333-8444-555555555555';
const AUTRE = '99999999-2222-4333-8444-555555555555';
const hash = (k) => createHash('sha256').update(k).digest('hex');
const produit = (x = {}) => ({ id: 'p1', name: '[TEST] Kit solaire', status: 'approved', mode_commande: 'devis', supplier_id: 'f1', supplier_price: 100000, public_price: 130000, commission_proposee: 5000, images: [], mode_remise: 'fournisseur', frais_remise: 5000, ...x });
const demande = (x = {}) => ({ productId: 'p1', customerName: '[TEST] Client', customerPhone: '70 00 00 01', city: 'Bamako', neighborhood: 'ACI 2000', besoin: 'Maison 3 pièces, 2 ventilateurs, télé', quantite: 1, ...x });
const reset = (p = produit()) => {
  tables = { products: [p], quote_requests: [], platform_settings: [{ id: 1, valeurs: {}, updated_at: null }], profiles: [] };
  rpcs = [];
  avis.length = 0;
};

test('demande : validation (besoin décrit, téléphone, quantité)', () => {
  assert.throws(() => devis.normaliserDemandeDevis(demande({ besoin: 'court' })), /au moins 10/);
  assert.throws(() => devis.normaliserDemandeDevis(demande({ customerPhone: 'abc' })), /téléphone/);
  assert.throws(() => devis.normaliserDemandeDevis(demande({ quantite: 99 })), /quantité/);
  assert.equal(devis.normaliserDemandeDevis(demande()).customerPhone, '70000001');
});

test('prix : calculé par le moteur, jamais sous le prix du fournisseur + la part du revendeur', () => {
  const d = devis.calculerProposition(
    { prixTotal: 300000, partRevendeurTotale: 20000, quantite: 1, remise: { mode: 'fournisseur', frais: 5000 }, revendeurAttribue: true },
    { ville: 'Bamako' }, r,
  );
  assert.equal(d.modeLivraison, 'fournisseur');
  assert.equal(d.fraisLivraison, 5000);
  assert.ok(d.montantArticles >= 300000 + d.commissionTotale);
  assert.ok(d.commissionTotale > 0 && d.commissionTotale <= 20000);
  const sansRevendeur = devis.calculerProposition(
    { prixTotal: 300000, partRevendeurTotale: 20000, quantite: 1, remise: { mode: 'livreur', frais: 0 }, revendeurAttribue: false },
    { ville: 'Bamako' }, r,
  );
  assert.equal(sansRevendeur.commissionTotale, 0);
});

test('parcours : demande → proposition → vue client sans coûts → acceptation en commande', async () => {
  reset();
  const { quoteNumber } = await devis.creerDemandeDevis(admin, demande(), CLE);
  assert.match(quoteNumber, /^DV-/);
  assert.equal((await devis.creerDemandeDevis(admin, demande(), CLE)).created, false, 'même clé : même demande');
  await assert.rejects(devis.creerDemandeDevis(admin, demande(), AUTRE), /déjà une demande/);

  const q = tables.quote_requests[0];
  assert.equal(q.access_key_hash, hash(CLE), 'seul le hash est stocké');
  await assert.rejects(devis.proposerDevis(admin, 'autre', { quoteId: q.id, prixTotal: 300000 }), /introuvable/);
  const prop = await devis.proposerDevis(admin, 'f1', { quoteId: q.id, prixTotal: 300000, partRevendeur: 10000, conditions: 'Pose incluse' });
  assert.ok(prop.totalClient > 300000);

  await assert.rejects(devis.lireDevisClient(admin, quoteNumber, AUTRE), /téléphone/);
  const vue = await devis.lireDevisClient(admin, quoteNumber, CLE);
  assert.equal(vue.statut, 'proposee');
  assert.equal(vue.prix.total, prop.totalClient);
  const texte = JSON.stringify(vue);
  assert.ok(!texte.includes('300000') && !texte.includes('commission'), 'ni prix fournisseur ni commission');

  const acc = await devis.deciderDevisClient(admin, quoteNumber, CLE, 'accepter');
  assert.equal(acc.statut, 'acceptee');
  const appel = rpcs.find((x) => x.nom === 'create_order_with_commission');
  assert.equal(appel.args.p_key_hash, hash(CLE), 'clé du devis = clé du reçu');
  assert.equal(appel.args.p_order.total_amount, prop.totalClient, 'prix figé du devis');
  assert.deepEqual(appel.args.p_product, { supplier_price: 100000, public_price: 130000, commission_proposee: 5000 }, 'prix actuels du produit pour le contrôle SQL');
  assert.equal(appel.args.p_order.pricing_snapshot.remise.mode, 'fournisseur');
  assert.equal(tables.quote_requests[0].status, 'acceptee');

  // Avis : fournisseur à la demande puis à l'acceptation ; jamais le téléphone du client.
  assert.deepEqual(avis.map((a) => [a.ids, a.titre.split(' ')[0]]), [['f1', 'Nouvelle'], ['f1', 'Devis']]);
  assert.ok(!JSON.stringify(avis).includes('70000001'), 'pas de téléphone client dans les avis');
});

test('admin : liste avec prix, retard au-delà de 24 h, via revendeur', async () => {
  reset();
  tables.profiles.push({ id: 'f1', full_name: '[TEST] Fournisseur', phone: '+22370000009' });
  await devis.creerDemandeDevis(admin, demande(), CLE);
  tables.quote_requests[0].created_at = new Date(Date.now() - 30 * 3_600_000).toISOString();
  let liste = await devis.listerDevisAdmin(admin);
  assert.equal(liste.devis[0].enRetard, true);
  assert.equal(liste.devis[0].fournisseur.telephone, '+22370000009');
  assert.equal(liste.devis[0].prix, null);
  await devis.proposerDevis(admin, 'f1', { quoteId: tables.quote_requests[0].id, prixTotal: 300000 });
  liste = await devis.listerDevisAdmin(admin);
  assert.equal(liste.devis[0].enRetard, false);
  assert.equal(liste.devis[0].prix.fournisseur, 300000);
  assert.equal(liste.devis[0].prix.client, liste.devis[0].prix.fournisseur + liste.devis[0].prix.gainRevendeur + liste.devis[0].prix.margeSuguba + liste.devis[0].prix.livraison);
});

test('refus, offre sans devis, devis expiré', async () => {
  reset(produit({ mode_commande: 'achat' }));
  await assert.rejects(devis.creerDemandeDevis(admin, demande(), CLE), /directement/);

  reset();
  const { quoteNumber } = await devis.creerDemandeDevis(admin, demande(), CLE);
  const q = tables.quote_requests[0];
  await assert.rejects(devis.refuserDemande(admin, 'f1', { quoteId: q.id }), /motif/);
  await devis.proposerDevis(admin, 'f1', { quoteId: q.id, prixTotal: 300000 });
  q.valable_jusqu = new Date(Date.now() - 1000).toISOString();
  assert.equal((await devis.lireDevisClient(admin, quoteNumber, CLE)).statut, 'expiree');
  await assert.rejects(devis.deciderDevisClient(admin, quoteNumber, CLE, 'accepter'), /expiré/);
  assert.equal(rpcs.filter((x) => x.nom === 'create_order_with_commission').length, 0);
});

// ── SQL réel (PostgreSQL local en mémoire, aucune base distante) ───────────
test('SQL : table des devis, et commande créée au prix du devis', async () => {
  const { database, sql } = require('./helpers/audit-db.cjs');
  const db = await database();
  await db.exec(sql('A-EXECUTER-2026-09-26-devis.sql'));
  await db.exec(`INSERT INTO public.products (id, name, slug, category, supplier_id, stock, status, supplier_price, public_price, mode_commande)
    VALUES ('p1', '[TEST] Kit', 'test-kit', 'Solaire', 'f1', 3, 'approved', 100000, 130000, 'devis')`);
  await assert.rejects(db.exec(`UPDATE public.products SET mode_commande = 'enchere'`));
  const res = await db.query(`SELECT public.create_order_with_commission('${hash('cle-test')}', '${hash('empreinte-test')}',
    '{"id":"o1","order_number":"SG-TESTDV","product_id":"p1","product_name":"[TEST] Kit","quantity":1,"unit_price":345000,"total_product_amount":345000,"delivery_fee":5000,"total_amount":350000,"reseller_commission":0,"customer_name":"[TEST]","customer_phone":"+22370000001","city":"Bamako","delivery_otp":"4821","pricing_snapshot":{}}'::jsonb,
    '{"supplier_price":100000,"public_price":130000,"commission_proposee":null}'::jsonb) AS r`);
  assert.equal(res.rows[0].r.created, true);
  const o = (await db.query(`SELECT total_amount FROM public.orders WHERE id = 'o1'`)).rows[0];
  assert.equal(Number(o.total_amount), 350000, 'prix du devis accepté par la fonction de commande');
  await db.exec(`INSERT INTO public.quote_requests (quote_number, access_key_hash, product_id, customer_name, customer_phone, besoin)
    VALUES ('DV-TEST', 'hash', 'p1', '[TEST]', '+22370000001', 'Maison 3 pièces')`);
  await assert.rejects(db.exec(`INSERT INTO public.quote_requests (quote_number, access_key_hash, product_id, customer_name, customer_phone, besoin, quantite)
    VALUES ('DV-TEST2', 'hash2', 'p1', '[TEST]', '+22370000001', 'x', 99)`));
});
