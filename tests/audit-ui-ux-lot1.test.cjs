// TEST-UX-LOT1-001..010 (audit UI/UX du 2026-10-02, lot 1 « urgences ») :
// chiffres d'argent du livreur, confirmation d'une commande par l'appel,
// décisions sensibles confirmées, pages 404 et erreur, liens et mises en page.
require('../scripts/test-typescript.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { existsSync, readFileSync } = require('node:fs');
const path = require('node:path');

const lire = (f) => readFileSync(path.join(__dirname, '..', f), 'utf8');
const { statutEncaissement, LIBELLE_ENCAISSEMENT, caisseDepuisLivraisons, duParCollecteur } = require('../src/lib/caisse-livreur.ts');
const { metierAffiche } = require('../src/lib/admin/poste.ts');

test('LIV-01 : le statut d’une livraison suit le moyen de paiement et la caisse, pas paymentCollected', () => {
  const caisse = { commandes: [{ id: 'c-non-versee' }] };
  assert.equal(statutEncaissement({ id: 'mm', paymentMethod: 'mobile_money' }, caisse), 'en_ligne');
  assert.equal(statutEncaissement({ id: 'c-non-versee', paymentMethod: 'cash_on_delivery' }, caisse), 'a_remettre');
  assert.equal(statutEncaissement({ id: 'c-versee', paymentMethod: 'cash_on_delivery' }, caisse), 'verse');
  // Caisse illisible : on n'affirme ni « versé » ni « à remettre ».
  assert.equal(statutEncaissement({ id: 'c-versee', paymentMethod: null }, null), 'especes');
  assert.equal(LIBELLE_ENCAISSEMENT.a_remettre, 'Espèces · à remettre');
});

test('LIV-01 : le repli local ne compte que les espèces, moins la part gardée', () => {
  const c = caisseDepuisLivraisons([
    { totalAmount: 24950, paymentMethod: 'cash_on_delivery' },
    { totalAmount: 72950, paymentMethod: 'mobile_money' },
    { totalAmount: 48950, paymentMethod: null },
  ], 1000);
  assert.equal(c.especes, 73900);
  assert.equal(c.garde, 2000);
  assert.equal(duParCollecteur(c), 71900);
});

test('LIV-01 : l’accueil et le portefeuille lisent la même caisse', () => {
  const accueil = lire('src/app/driver/page.tsx');
  const portefeuille = lire('src/app/driver/earnings/page.tsx');
  for (const page of [accueil, portefeuille]) {
    assert.match(page, /useCaisseLivreur\(/);
    assert.match(page, /statutEncaissement\(/);
  }
  // Avant la remise, paymentCollected dit bien « payé en ligne » (carte de course).
  // Après la livraison, il vaut vrai pour TOUTES les commandes : la liste des
  // livraisons effectuées ne doit plus le lire.
  const livraisons = accueil.slice(accueil.indexOf('Dernières livraisons'));
  assert.ok(livraisons.length > 0 && accueil.includes('Dernières livraisons'));
  assert.doesNotMatch(livraisons, /paymentCollected/, 'le libellé des livraisons ne doit plus lire paymentCollected');
  assert.doesNotMatch(accueil, /totalCollectedCash/, 'plus de somme locale des espèces');
  // LIV-02 : le blocage d'espèces est annoncé sur l'accueil.
  assert.match(accueil, /caisse\?\.bloque/);
});

test('ADM-02 : la ligne du tableau ouvre le dossier d’appel au lieu de confirmer', () => {
  const page = lire('src/app/admin/commandes/page.tsx');
  assert.doesNotMatch(page, /action: 'confirmer'/);
  assert.match(page, /c\.statut === 'pending_call' && peutModifier \? <Button[^>]*onClick=\{\(\) => setOuverte\(c\.id\)\}/);
  // Le dossier garde la seule confirmation, après l'appel.
  assert.match(lire('src/components/admin/DossierCommande.tsx'), /Client joint : confirmer la commande/);
});

test('ADM-05 : approbation récapitulée et protégée du double clic ; retrait d’autorisation motivé', () => {
  const validations = lire('src/app/admin/validations/page.tsx');
  assert.match(validations, /Confirmer l’approbation/);
  assert.match(validations, /if \(envoi\) return;/);
  const route = lire('src/app/api/admin/drivers/verify/route.ts');
  assert.match(route, /!verifie && constat\.length < 5/);
  assert.match(lire('src/components/admin/DriverVerificationPanel.tsx'), /Pourquoi retirez-vous l&apos;autorisation/);
});

test('ADM-03 : la Direction voit « Tous les métiers », pas « Choisir… »', () => {
  assert.equal(metierAffiche('direction'), 'toutes');
  assert.equal(metierAffiche(null), 'toutes');
  assert.equal(metierAffiche('finance'), 'finance');
  assert.match(lire('src/app/admin/a-traiter/page.tsx'), /valeur=\{metierAffiche\(metier\)\}/);
});

test('PUB-05 : pages 404 et erreur en français, avec une issue', () => {
  assert.ok(existsSync(path.join(__dirname, '..', 'src/app/not-found.tsx')));
  const introuvable = lire('src/app/not-found.tsx');
  assert.match(introuvable, /Cette page n’existe plus/);
  assert.match(introuvable, /action="\/recherche"/);
  const erreur = lire('src/app/error.tsx');
  assert.match(erreur, /^'use client';/);
  assert.match(erreur, /onClick=\{\(\) => reset\(\)\}/);
  assert.doesNotMatch(erreur, /error\.message/, 'le détail technique n’est jamais affiché');
});

test('REV-04 / REV-06 : « Ma boutique » vers la vraie boutique, raccourcis empilés sur mobile', () => {
  const page = lire('src/app/reseller/page.tsx');
  assert.doesNotMatch(page, /<Raccourci[^>]*href="\/reseller\/channels"/);
  // Chantier boutique, lot 1 (2026-10-03) : le 3e raccourci, qui ouvrait les
  // réglages, devient la carte « Ma boutique » ; son bouton vise la porte unique
  // /reseller/ma-boutique, qui ouvre la vitrine. Restent 2 raccourcis empilés.
  assert.equal(require('../src/lib/reseau/porte-boutique.ts').PORTE_MA_BOUTIQUE, '/reseller/ma-boutique');
  assert.match(page, /<CarteMaBoutique boutique=\{boutique\}/);
  assert.match(page, /<Button href=\{PORTE_MA_BOUTIQUE\}[^>]*>[\s\S]{0,80}Voir ma boutique/);
  assert.doesNotMatch(page, /<Raccourci[^>]*href="\/reseller\/boutique"/);
  assert.equal((page.match(/<Raccourci empile/g) || []).length, 2);
  assert.match(page, /<div className="grid grid-cols-2 gap-3">\s*<Raccourci empile href="\/reseller\/catalog"/);
  assert.match(page, /Retirable maintenant/);
});

test('PUB-07 : la page Garantie ne promet plus une durée absente des fiches', () => {
  assert.doesNotMatch(lire('src/app/legal/warranty/page.tsx'), /Chaque fiche produit précise la durée/);
});

test('Système : ombre shadow-xs définie, barre du bas à 13 px, champ de caisse non écrasé', () => {
  const config = require('../tailwind.config.js');
  assert.ok(config.theme.extend.boxShadow.xs, 'shadow-xs est utilisée dans src mais doit exister dans la configuration');
  const nav = lire('src/components/common/BottomNav.tsx');
  assert.doesNotMatch(nav, /text-\[11px\]/);
  assert.doesNotMatch(nav, /border-gray-/);
  assert.match(lire('src/app/admin/retraits/page.tsx'), /id="code-retrait"[\s\S]{0,200}w-full sm:flex-1 h-12/);
  assert.match(lire('src/app/admin/products/page.tsx'), /grid grid-cols-2 sm:flex gap-2/);
});
