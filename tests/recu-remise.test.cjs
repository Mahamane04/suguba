// Reçu client avec QR de remise (2026-09-25) : format du QR, reçu réservé à
// la clé du reçu, scan livreur qui prépare sans livrer, demande SAV.
require('../scripts/test-typescript.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');

const { contenuQrRemise, lireQrRemise } = require('../src/lib/qr-remise.ts');

// ── Base simulée ───────────────────────────────────────────────────────────
let tables, rpcs, cleValide, session;
function requete(nom) {
  let lignes = [...(tables[nom] || [])];
  const q = {
    select() { return q; },
    eq(c, v) { lignes = lignes.filter((l) => l[c] === v); return q; },
    in(c, vs) { lignes = lignes.filter((l) => vs.includes(l[c])); return q; },
    limit(n) { lignes = lignes.slice(0, n); return q; },
    maybeSingle: async () => ({ data: lignes[0] ? { ...lignes[0] } : null, error: null }),
    then(ok, ko) { return Promise.resolve({ data: lignes.map((l) => ({ ...l })), error: null }).then(ok, ko); },
    insert: async (ligne) => { (tables[nom] ||= []).push(ligne); return { error: null }; },
  };
  return q;
}
let depots, bucketCree;
const admin = {
  storage: {
    getBucket: async () => ({ data: bucketCree ? { public: false } : null }),
    createBucket: async (nom, o) => { bucketCree = { nom, ...o }; return { error: null }; },
    from: (bucket) => ({
      upload: async (chemin, contenu, o) => { depots.push({ bucket, chemin, taille: contenu.length, type: o.contentType }); return { error: null }; },
      remove: async (chemins) => { depots = depots.filter((d) => !chemins.includes(d.chemin)); return { error: null }; },
      list: async (dossier) => ({ data: depots.filter((d) => d.chemin.startsWith(`${dossier}/`)).map((d) => ({ name: d.chemin.split('/')[1] })), error: null }),
      createSignedUrls: async (chemins, duree) => ({ data: chemins.map((c) => ({ signedUrl: `https://signe.test/${c}?e=${duree}` })) }),
    }),
  },
  from: (nom) => requete(nom),
  async rpc(nom, args) {
    rpcs.push({ nom, args });
    if (nom === 'verify_delivery_atomic') return { data: { error: 'Code incorrect.', http: 400 }, error: null };
    return { data: true, error: null };
  },
};
require.cache[require.resolve('../src/lib/supabase-admin.ts')] = { exports: { getSupabaseAdmin: () => admin } };
require.cache[require.resolve('../src/lib/order-access.ts')] = { exports: { hasOrderReceiptAccess: async (_a, _n, cle) => cle === cleValide } };
require.cache[require.resolve('../src/lib/active-session.ts')] = { exports: { verifyActiveSession: async () => session } };

const { NextRequest } = require('next/server');
const poster = (mod, url, corps) => mod.POST(new NextRequest(`http://localhost${url}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps),
}));
const recuRoute = require('../src/app/api/orders/recu/route.ts');
const savRoute = require('../src/app/api/orders/sav/route.ts');
const remiseRoute = require('../src/app/api/driver/remise/route.ts');

const commande = (x) => ({
  id: 'o1', order_number: 'SG-TEST01', cart_id: 'c1', pricing_snapshot: { panier: { groupeLivraison: 0, position: 0 } },
  created_at: '2026-09-25T10:00:00Z', status: 'in_transit', picked_up_at: '2026-09-25T11:00:00Z',
  product_name: '[TEST] Article', product_image: null, quantity: 1, unit_price: 5000, total_product_amount: 5000,
  delivery_fee: 1000, total_amount: 6000, customer_name: '[TEST] Client', customer_phone: '+22370000000',
  neighborhood: 'ACI', city: 'Bamako', payment_method: 'cash_on_delivery', payment_collected: false,
  delivered_at: null, assigned_driver_id: 'livreur-1', delivery_otp: '4821', delivery_code_version: 1,
  delivery_code_sent_at: '2026-09-25T10:01:00Z', failed_otp_attempts: 0, ...x,
});
const reset = (lignes) => {
  depots = [];
  tables = { orders: lignes, sav_tickets: [] };
  rpcs = [];
  cleValide = 'cle-du-recu';
  session = { uid: 'livreur-1', role: 'driver', status: 'active' };
};

// ── Format du QR ───────────────────────────────────────────────────────────
test('QR : aller-retour, et tout autre contenu est refusé', () => {
  const t = contenuQrRemise('SG-K7M3P9RX', '0427');
  assert.equal(t, 'SUGUBA-REMISE:1:SG-K7M3P9RX:0427');
  assert.deepEqual(lireQrRemise(t), { orderNumber: 'SG-K7M3P9RX', code: '0427' });
  for (const faux of ['https://app.sugubaml.com/p/x', 'SUGUBA-REMISE:2:SG-X:1234', 'SUGUBA-REMISE:1:SG-X:12a4', '', null, 'x'.repeat(300)]) {
    assert.equal(lireQrRemise(faux), null);
  }
});

// ── Reçu client ────────────────────────────────────────────────────────────
test('reçu : sans la clé, ni reçu ni code', async () => {
  reset([commande()]);
  const r = await poster(recuRoute, '/api/orders/recu', { orderNumber: 'SG-TEST01', accessKey: 'autre' });
  assert.equal(r.status, 403);
  assert.ok(!JSON.stringify(await r.json()).includes('4821'));
});

test('reçu : avec la clé, toute la livraison, le code et « à payer »', async () => {
  reset([commande(), commande({ id: 'o2', order_number: 'SG-TEST02', total_amount: 3000, total_product_amount: 3000, delivery_fee: 0, pricing_snapshot: { panier: { groupeLivraison: 0, position: 1 } } }),
    commande({ id: 'o3', order_number: 'SG-TEST03', pricing_snapshot: { panier: { groupeLivraison: 1 } }, delivery_otp: '9999' })]);
  const r = await poster(recuRoute, '/api/orders/recu', { orderNumber: 'SG-TEST01', accessKey: 'cle-du-recu' });
  const { recu } = await r.json();
  assert.equal(r.status, 200);
  assert.equal(recu.code, '4821');
  assert.deepEqual(recu.articles.map((a) => a.orderNumber), ['SG-TEST01', 'SG-TEST02']);
  assert.equal(recu.total, 9000);
  assert.equal(recu.resteAPayer, 9000);
  assert.equal(recu.payeEnLigne, false);
});

test('reçu : payé en ligne → rien à payer ; livré → plus de code', async () => {
  reset([commande({ payment_method: 'mobile_money', payment_collected: true, cart_id: null })]);
  let { recu } = await (await poster(recuRoute, '/api/orders/recu', { orderNumber: 'SG-TEST01', accessKey: 'cle-du-recu' })).json();
  assert.equal(recu.payeEnLigne, true);
  assert.equal(recu.resteAPayer, 0);
  reset([commande({ status: 'delivered', delivered_at: '2026-09-25T12:00:00Z', cart_id: null })]);
  ({ recu } = await (await poster(recuRoute, '/api/orders/recu', { orderNumber: 'SG-TEST01', accessKey: 'cle-du-recu' })).json());
  assert.equal(recu.code, null);
  assert.equal(recu.livre, true);
});

// ── Scan livreur ───────────────────────────────────────────────────────────
const scanner = (qr, orderId = 'o1') => poster(remiseRoute, '/api/driver/remise', { orderId, qr });

test('scan : le bon QR prépare la remise sans livrer ni renvoyer le code', async () => {
  reset([commande(), commande({ id: 'o2', order_number: 'SG-TEST02', pricing_snapshot: { panier: { groupeLivraison: 0 } } })]);
  const r = await scanner(contenuQrRemise('SG-TEST02', '4821'));
  const j = await r.json();
  assert.equal(r.status, 200);
  assert.deepEqual(j.commandes.map((c) => c.id).sort(), ['o1', 'o2']);
  assert.ok(j.commandes.every((c) => c.pretARemettre));
  assert.ok(!JSON.stringify(j).includes('4821'));
  assert.deepEqual(rpcs, [], 'aucune livraison enregistrée au scan');
  assert.ok(tables.orders.every((o) => o.status === 'in_transit'));
});

test('scan : code faux compté comme un essai (même voie que la saisie)', async () => {
  reset([commande()]);
  const r = await scanner(contenuQrRemise('SG-TEST01', '1111'));
  assert.equal(r.status, 400);
  assert.equal(rpcs[0].nom, 'verify_delivery_atomic');
  assert.equal(rpcs[0].args.p_code, '1111');
});

test('scan : QR d’une autre commande, course d’un autre livreur, livrée ou bloquée', async () => {
  reset([commande(), commande({ id: 'o9', order_number: 'SG-AUTRE', cart_id: 'c9' })]);
  assert.equal((await scanner(contenuQrRemise('SG-AUTRE', '4821'))).status, 409);
  assert.deepEqual(rpcs, []);
  reset([commande({ assigned_driver_id: 'livreur-2' })]);
  assert.equal((await scanner(contenuQrRemise('SG-TEST01', '4821'))).status, 403);
  reset([commande({ status: 'delivered' })]);
  assert.equal((await scanner(contenuQrRemise('SG-TEST01', '4821'))).status, 409);
  reset([commande({ failed_otp_attempts: 3 })]);
  assert.equal((await scanner(contenuQrRemise('SG-TEST01', '4821'))).status, 423);
  reset([commande()]);
  session = { uid: 'x', role: 'reseller', status: 'active' };
  assert.equal((await scanner(contenuQrRemise('SG-TEST01', '4821'))).status, 401);
  reset([commande()]);
  assert.equal((await scanner('https://exemple.com')).status, 400);
});

// ── SAV depuis le reçu ─────────────────────────────────────────────────────
const signaler = (x) => poster(savRoute, '/api/orders/sav', { orderNumber: 'SG-TEST01', accessKey: 'cle-du-recu', motif: 'defectueux', quantite: 5, souhait: 'echange', ...x });

test('SAV : clé requise, après livraison seulement, une demande à la fois', async () => {
  reset([commande()]);
  assert.equal((await signaler({ accessKey: 'autre' })).status, 403);
  assert.equal((await signaler({})).status, 409, 'pas avant la livraison');
  reset([commande({ status: 'delivered' })]);
  assert.equal((await signaler({ motif: 'inconnu' })).status, 400);
  const r = await signaler({});
  assert.equal(r.status, 200);
  const t = tables.sav_tickets[0];
  assert.equal(t.order_id, 'o1');
  assert.equal(t.customer_name, '[TEST] Client', 'relu sur la commande');
  assert.equal(t.resolution_type, 'swap_new');
  assert.match(t.issue_description, /Quantité concernée : 1/, 'plafonnée à la quantité commandée');
  t.status = 'open';
  assert.equal((await signaler({})).status, 409);
});

// ── Photos jointes à la demande SAV ────────────────────────────────────────
const sharp = require('sharp');
const photoPng = () => sharp({ create: { width: 40, height: 30, channels: 3, background: '#c33' } }).png().toBuffer();
async function signalerAvecPhotos(fichiers, x = {}) {
  const f = new FormData();
  for (const [k, v] of Object.entries({ orderNumber: 'SG-TEST01', accessKey: 'cle-du-recu', motif: 'endommage', quantite: '1', souhait: 'echange', ...x })) f.set(k, v);
  for (const fichier of fichiers) f.append('photos', fichier);
  return savRoute.POST(new NextRequest('http://localhost/api/orders/sav', { method: 'POST', body: f }));
}

test('SAV + photos : réencodées, rangées en privé sous le dossier du ticket', async () => {
  reset([commande({ status: 'delivered' })]);
  bucketCree = null;
  const png = await photoPng();
  const r = await signalerAvecPhotos([new File([png], 'a.png', { type: 'image/png' }), new File([png], 'b.png', { type: 'image/png' })]);
  assert.equal(r.status, 200);
  assert.equal((await r.json()).photos, 2);
  assert.equal(bucketCree.public, false, 'stockage privé');
  const t = tables.sav_tickets[0];
  assert.deepEqual(depots.map((d) => d.chemin), [`${t.id}/1.webp`, `${t.id}/2.webp`]);
  assert.ok(depots.every((d) => d.bucket === 'sav-photos' && d.type === 'image/webp'));
  assert.match(t.issue_description, /Photos jointes : 2/);
});

test('SAV + photos : plus de 3, ou fichier qui n’est pas une image → refusé, rien de créé', async () => {
  reset([commande({ status: 'delivered' })]);
  const png = await photoPng();
  const quatre = Array.from({ length: 4 }, (_, i) => new File([png], `${i}.png`, { type: 'image/png' }));
  assert.equal((await signalerAvecPhotos(quatre)).status, 400);
  const faux = new File([Buffer.from('<script>alert(1)</script>')], 'x.png', { type: 'image/png' });
  assert.equal((await signalerAvecPhotos([faux])).status, 400);
  assert.equal(tables.sav_tickets.length, 0);
  assert.equal(depots.length, 0);
});

test('admin : photos d’un ticket en liens signés temporaires, jamais publics', async () => {
  require.cache[require.resolve('../src/lib/reseau/permission-admin.ts')] = { exports: { refusSansPermissionAdmin: async () => null } };
  const photosRoute = require('../src/app/api/admin/sav/photos/route.ts');
  reset([]);
  const id = '11111111-1111-4111-8111-111111111111';
  depots = [{ bucket: 'sav-photos', chemin: `${id}/1.webp` }, { bucket: 'sav-photos', chemin: `${id}/2.webp` }];
  session = { uid: 'admin-1', role: 'admin', status: 'active' };
  const r = await photosRoute.GET(new NextRequest(`http://localhost/api/admin/sav/photos?ticketId=${id}`));
  const { photos } = await r.json();
  assert.equal(photos.length, 2);
  assert.ok(photos.every((u) => u.includes('e=600')));
  session = { uid: 'x', role: 'driver', status: 'active' };
  assert.equal((await photosRoute.GET(new NextRequest(`http://localhost/api/admin/sav/photos?ticketId=${id}`))).status, 401);
});
