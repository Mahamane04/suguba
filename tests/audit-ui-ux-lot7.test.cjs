// TEST-UX-FINITIONS-001..010 (audit UI/UX du 2026-10-02, lot 7 « les finitions ») :
// les constats restés hors des six lots (FOU-08/09/10, LIV-05, REV-08/11/12,
// ADM-15, PUB-10 partiel, PUB-15) et les avatars.
require('../scripts/test-typescript.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const lire = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const sansCommentaires = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('initiale : première lettre ou chiffre, jamais un crochet ni un guillemet', () => {
  const { initiale } = require('../src/lib/initiale.ts');
  assert.equal(initiale('[QA] Boutique Kadi'), 'Q');
  assert.equal(initiale('« chez Awa »'), 'C');
  assert.equal(initiale('élégance'), 'É');
  assert.equal(initiale('2 Frères'), '2');
  assert.equal(initiale('  '), '·');
  assert.equal(initiale(null), '·');
  for (const f of ['src/components/shop/ShopView.tsx', 'src/components/admin/PosteAdmin.tsx', 'src/components/reseau/BoutiquesDuQuartier.tsx']) {
    assert.doesNotMatch(lire(f), /charAt\(0\)/, f);
  }
});

test('LIV-05 : une action principale sur la carte de course, les autres identiques', () => {
  const src = sansCommentaires(lire('src/app/driver/page.tsx'));
  assert.match(src, /Saisir le code du client/);
  assert.doesNotMatch(src, /bg-slate-900 hover:bg-black|bg-amber-500 hover:bg-amber-600/);
  for (const libelle of ['Appeler', 'Itinéraire', 'Reçu', 'Problème']) assert.match(src, new RegExp(`<Button[^\n]*variant="ghost"[^\n]*${libelle}</Button>`), libelle);
  assert.doesNotMatch(src, /emerald-/);
});

test('FOU-09 : pas de formulaire de retrait à 0 F, chez le fournisseur comme chez le revendeur', () => {
  const four = sansCommentaires(lire('src/app/supplier/paiements/page.tsx'));
  assert.match(four, /disponible < retraitMinimum && !checkout\.restore\(\) \?/);
  const rev = sansCommentaires(lire('src/app/reseller/payouts/page.tsx'));
  assert.match(rev, /disponible >= retraitMinimum \|\| Boolean\(checkout\.restore\(\)\)/);
  assert.match(lire('src/components/retraits/FormulaireRetrait.tsx'), /loading=\{envoi\}/);
});

test('FOU-08 / PUB-15 : « Mes achats » pour un pro ; le corps de page n’est plus figé à la hauteur de l’écran', () => {
  const header = lire('src/components/common/Header.tsx');
  assert.match(header, /\['customer', 'diaspora'\]\.includes\(state\.currentUser\.role\) \? 'Mes commandes' : 'Mes achats'/);
  assert.equal((header.match(/\{libelleAchats\}/g) || []).length, 2);
  assert.match(lire('src/app/layout.tsx'), /<body className="min-h-full flex flex-col/);
});

test('FOU-10 : Ma boutique — le recrutement n’est plus un bouton plein, un seul indicateur à l’enregistrement', () => {
  const src = lire('src/app/supplier/boutique/page.tsx');
  assert.match(src, /variant=\{recrute \? 'ghost' : 'secondary'\}/);
  assert.match(src, /loading=\{enregistrement\}/);
  assert.doesNotMatch(src, /SugubaLoader/);
});

test('REV-08 : les petites vignettes demandent une petite image et un repli compact', () => {
  for (const [f, taille] of [['src/app/reseller/orders/page.tsx', '64px'], ['src/app/track/[orderNumber]/page.tsx', '56px'], ['src/app/order-success/[orderNumber]/page.tsx', '48px']]) {
    assert.match(lire(f), new RegExp(`<ProductImage src=\\{order\\.productImage\\}[^>]*sizes="${taille}"[^>]*compact`), f);
  }
  assert.equal((lire('src/app/reseller/page.tsx').match(/<ProductImage [^>]*compact/g) || []).length, 2);
});

test('REV-11 / REV-12 : catalogue resserré ; outils aux titres des pages, dans la coquille commune', () => {
  const cat = sansCommentaires(lire('src/app/reseller/catalog/page.tsx'));
  assert.match(cat, /Ma boutique · \{maSelection\.size\}/);
  assert.doesNotMatch(cat, /'bg-slate-900 text-white'/);
  const outils = lire('src/app/reseller/outils/page.tsx');
  assert.match(outils, /<PageReseau/);
  for (const t of ['Mes partages', 'Votre carte professionnelle', 'Combien pouvez-vous gagner ?', 'Mon calendrier', 'Mes prix', 'Missions', 'Mes parrainages']) assert.ok(outils.includes(`titre: '${t}'`), t);
  assert.doesNotMatch(lire('src/app/supplier/outils/page.tsx'), /Mon espace fournisseur/);
});

test('Finitions revendeur : plus de tuiles à 0 avant la première activité, un seul bouton plein', () => {
  assert.match(lire('src/app/reseller/partages/page.tsx'), /\{totaux\.liens > 0 && <div className="grid/);
  assert.match(lire('src/app/reseller/parrainages/page.tsx'), /\{\(totaux\.invitations > 0 \|\| totaux\.gains > 0\) && <div/);
  assert.match(lire('src/app/reseller/calendrier/page.tsx'), /action=\{<Button size="sm" variant="ghost"/);
  const badge = lire('src/app/reseller/badge/page.tsx');
  assert.doesNotMatch(badge, /bg-slate-900 hover:bg-black|Imprimer mon Badge|Retour à l&apos;Espace Revendeur/);
  assert.doesNotMatch(lire('src/app/register/page.tsx'), /5 choix possibles/);
});

test('ADM-15 : plus de « Fermé : Fermé : », plus de texte à 11 px dans les paiements reçus', () => {
  const { MODULES } = require('../src/lib/admin/pilotage.ts');
  for (const m of MODULES) assert.doesNotMatch(m.continue, /^(Fermé|Désactivée)\b/, m.cle);
  const recus = lire('src/components/admin/PaiementsRecus.tsx');
  assert.doesNotMatch(recus, /text-\[11px\]/);
  assert.match(recus, /variant="danger" loading=\{envoi\}/);
});

test('PUB-10 (partiel) : après un panier, Mobile Money replié par commande et une action principale', () => {
  const src = sansCommentaires(lire('src/app/panier/confirmation/page.tsx'));
  assert.match(src, /<details[\s\S]{0,600}par Mobile Money/);
  assert.match(src, /<SasPayPaymentDesk amount=\{c\.totalAmount\} orderNumber=\{c\.orderNumber\}/);
  assert.match(src, /size="lg" fullWidth>\s*<Truck/);
});
