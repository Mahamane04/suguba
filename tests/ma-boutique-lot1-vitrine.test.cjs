// TEST-BOUTIQUE-LOT1-012..015 (relecture du lot 1 du chantier boutique, 2026-10-03) :
// la règle « boutique masquée = page introuvable, sauf pour son propriétaire revendeur
// principal » n'était vérifiée que par des expressions régulières sur le source. Ici,
// BoutiqueReseauPage et generateMetadata sont EXÉCUTÉES : charger() réel, base, session,
// cookies et notFound simulés (require.cache). Aucune base réelle.
// Fichier séparé de ma-boutique-lot1.test.cjs : il simule lib/session (verifySessionToken).
require('../scripts/test-typescript.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');

global.fetch = async () => { throw Error('Réseau externe interdit dans les tests'); };

// ── Base simulée (lecture seule ici) ─────────────────────────────────────────
let etat;
function reinitialiser() {
  etat = {
    stores: [
      { id: 's-rev', owner_type: 'reseller', owner_id: 'rev-1', slug: 'awa-mode', name: 'Awa Mode', status: 'hidden', followers_count: 7, logo_url: 'https://x/logo.webp', cover_url: 'https://x/couv.webp' },
      { id: 's-pro', owner_type: 'reseller', owner_id: 'rev-1', slug: 'awa-pro', name: 'Awa Pro', status: 'hidden', principale: false, followers_count: 1 },
      { id: 's-fou', owner_type: 'supplier', owner_id: 'fou-1', slug: 'kadi-shop', name: 'Kadi Shop', status: 'hidden', followers_count: 2 },
    ],
    profiles: [{ id: 'rev-1', full_name: 'Awa Traoré Diallo', reseller_code: 'AWA1' }],
    profile_roles: [{ profile_id: 'rev-1', role: 'reseller', status: 'active' }],
    suppliers: [{ profile_id: 'fou-1', slug: 'kadi', warehouse_neighborhood: null }],
    reseller_shop_items: [{ reseller_id: 'rev-1', product_id: 'p1', position: 0 }],
    products: [{ id: 'p1', slug: 'robe', name: 'Robe', category: 'Mode', images: [], public_price: 15000, stock: 3, reseller_commission: 1000, pricing_status: 'ok', status: 'approved' }],
  };
}
const ecritures = [];
const db = {
  from(table) {
    let op = 'select'; const filtres = []; let un = false;
    const q = {
      select() { return q; },
      eq(k, v) { filtres.push((r) => r[k] === v); return q; },
      ilike(k, v) { filtres.push((r) => String(r[k]).toLowerCase() === String(v).toLowerCase()); return q; },
      in(k, v) { filtres.push((r) => v.includes(r[k])); return q; },
      is() { return q; }, order() { return q; }, limit() { return q; }, gt() { return q; }, or() { return q; },
      insert() { op = 'insert'; return q; }, update() { op = 'update'; return q; },
      upsert() { op = 'upsert'; return q; }, delete() { op = 'delete'; return q; },
      maybeSingle() { un = true; return q; },
      then(resolve, reject) {
        if (op !== 'select') ecritures.push({ table, op });
        const lignes = (etat[table] || []).filter((r) => filtres.every((f) => f(r)));
        const data = un ? (lignes[0] ? { ...lignes[0] } : null) : lignes.map((r) => ({ ...r }));
        return Promise.resolve({ data, count: lignes.length, error: null }).then(resolve, reject);
      },
    };
    return q;
  },
  async rpc() { return { data: null, error: null }; },
};
require.cache[require.resolve('../src/lib/supabase-admin.ts')] = { exports: { getSupabaseAdmin: () => db } };

// ── Session et cookies simulés ───────────────────────────────────────────────
let sessionCourante = null;
const vraieSession = require('../src/lib/session.ts');
require.cache[require.resolve('../src/lib/session.ts')] = {
  exports: { ...vraieSession, verifySessionToken: async (jeton) => (jeton === 'jeton-simule' ? sessionCourante : null) },
};
require.cache[require.resolve('next/headers')] = {
  exports: { cookies: async () => ({ get: (nom) => (nom === vraieSession.SESSION_COOKIE_NAME ? { value: 'jeton-simule' } : undefined) }) },
};
class Introuvable extends Error {}
require.cache[require.resolve('next/navigation')] = { exports: { notFound: () => { throw new Introuvable('page introuvable'); } } };

// Composants : simples marqueurs, la page renvoie un élément React dont on lit les props.
const marqueur = { __esModule: true, default: () => null };
for (const f of ['shop/ShopView', 'shop/BoutonSuivre', 'shop/GalerieBoutique']) {
  require.cache[require.resolve(`../src/components/${f}.tsx`)] = { exports: { ...marqueur, default: () => null } };
}
require.cache[require.resolve('../src/lib/reseau/recompenses.ts')] = { exports: { lireReglagesReseau: async () => ({}) } };
require.cache[require.resolve('../src/lib/presentation-fournisseur.ts')] = { exports: { appliquerPrioriteReseau: async (_a, v) => v } };

const page = require('../src/app/boutique/[slug]/page.tsx');
const ouvrir = (slug) => page.default({ params: Promise.resolve({ slug }) });
const session = (uid, extra = {}) => ({ uid, phone: '+22300000000', role: 'reseller', status: 'active', roles: { reseller: 'active' }, iat: 1, exp: 9e9, ...extra });

test('Boutique revendeur masquée : page introuvable pour un visiteur, un autre compte ou un aperçu admin', async () => {
  reinitialiser();
  sessionCourante = null;
  await assert.rejects(ouvrir('awa-mode'), Introuvable, 'visiteur sans session');
  sessionCourante = session('rev-2');
  await assert.rejects(ouvrir('awa-mode'), Introuvable, 'autre revendeur');
  sessionCourante = session('cli-1', { role: 'customer', roles: { customer: 'active' } });
  await assert.rejects(ouvrir('awa-mode'), Introuvable, 'client connecté');
  // Aperçu d'un administrateur sous l'identité du propriétaire : jamais le mode propriétaire.
  sessionCourante = session('rev-1', { apercu: { depuis: { uid: 'admin-1', phone: '+22300000001' } } });
  await assert.rejects(ouvrir('awa-mode'), Introuvable, 'aperçu admin');
  assert.deepEqual(ecritures, [], 'afficher une vitrine n’écrit rien');
});

test('Boutique revendeur masquée : son propriétaire la voit, avec son état ; gestion selon le profil actif', async () => {
  reinitialiser();
  sessionCourante = session('rev-1');
  let el = await ouvrir('awa-mode');
  assert.deepEqual(el.props.proprietaire, { statut: 'hidden', abonnes: 7, gestion: true });
  assert.equal(el.props.boutique.nom, 'Awa Mode');
  assert.equal(el.props.lienModifier, '/reseller/boutique');
  // ShopView retire lui-même le ?ref= des liens d'achat du propriétaire (voir ma-boutique-lot1).
  assert.equal(el.props.refCode, 'AWA1');
  // Compte aussi revendeur mais profil actif « client » : bandeau « Gérer » (gestion: false).
  sessionCourante = session('rev-1', { role: 'customer', roles: { customer: 'active', reseller: 'active' } });
  el = await ouvrir('awa-mode');
  assert.deepEqual(el.props.proprietaire, { statut: 'hidden', abonnes: 7, gestion: false });
});

test('Boutiques masquées : la boutique fournisseur reste introuvable ; la boutique Pro suit la règle de la principale (lot 7)', async () => {
  reinitialiser();
  sessionCourante = session('fou-1', { role: 'supplier', roles: { supplier: 'active' } });
  await assert.rejects(ouvrir('kadi-shop'), Introuvable, 'boutique fournisseur');
  sessionCourante = null;
  await assert.rejects(ouvrir('inconnue'), Introuvable);
  // Lot 7 (2026-10-03) : une boutique supplémentaire (formule Pro) masquée est, comme
  // la principale, introuvable pour tous sauf pour son propriétaire, qui la voit avec
  // son état. `boutiquePro` porte son identifiant : ses outils la visent, elle.
  await assert.rejects(ouvrir('awa-pro'), Introuvable, 'visiteur');
  sessionCourante = session('rev-2');
  await assert.rejects(ouvrir('awa-pro'), Introuvable, 'autre revendeur');
  sessionCourante = session('rev-1', { apercu: { depuis: { uid: 'admin-1', phone: '+22300000001' } } });
  await assert.rejects(ouvrir('awa-pro'), Introuvable, 'aperçu admin');
  sessionCourante = session('rev-1');
  let el = await ouvrir('awa-pro');
  assert.deepEqual(el.props.proprietaire, { statut: 'hidden', abonnes: 1, gestion: true, boutiquePro: 's-pro' });
  // Boutique Pro ACTIVE ouverte par son propriétaire : mode propriétaire (avant le
  // lot 7 : aucun, seulement « Modifier la boutique » vers Mes boutiques).
  etat.stores[1].status = 'active';
  el = await ouvrir('awa-pro');
  assert.deepEqual(el.props.proprietaire, { statut: 'active', abonnes: 1, gestion: true, boutiquePro: 's-pro' });
  assert.equal(el.props.lienModifier, null, 'les crayons et le bandeau remplacent le lien posé sur la couverture');
  assert.equal(el.props.boutique.nom, 'Awa Pro');
  assert.deepEqual(ecritures, [], 'afficher une vitrine n’écrit rien');
});

test('Boutique active : le visiteur voit la vitrine sans mode propriétaire ; métadonnées neutres et noindex si masquée', async () => {
  reinitialiser();
  etat.stores[0].status = 'active';
  sessionCourante = null;
  const el = await ouvrir('awa-mode');
  assert.equal(el.props.proprietaire, null);
  assert.equal(el.props.lienModifier, null);
  assert.equal(el.props.urlPartage.endsWith('/boutique/awa-mode'), true);
  const meta = await page.generateMetadata({ params: Promise.resolve({ slug: 'awa-mode' }) });
  assert.equal(meta.title, 'Awa Mode — Suguba');
  assert.equal(meta.robots, undefined);

  reinitialiser();
  const masquee = await page.generateMetadata({ params: Promise.resolve({ slug: 'awa-mode' }) });
  assert.equal(masquee.title, 'Boutique — Suguba', 'rien de la boutique dans un aperçu de lien');
  assert.deepEqual(masquee.robots, { index: false, follow: false });
  assert.doesNotMatch(JSON.stringify(masquee), /Awa|logo|couv/);
  assert.equal((await page.generateMetadata({ params: Promise.resolve({ slug: 'kadi-shop' }) })).title, 'Boutique introuvable — Suguba');
});

void React;
