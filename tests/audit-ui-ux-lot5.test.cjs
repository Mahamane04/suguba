// TEST-UX-COMMANDE-001..009 (audit UI/UX du 2026-10-02, lot 5 « la commande ») :
// le client sait ce que coûte la livraison, ce qui se passe maintenant, et ce qu'on
// attend de lui ; la même offre se lit pareil partout.
require('../scripts/test-typescript.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const lire = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
// Le code affiché, sans les commentaires (qui citent volontairement l'ancien état).
const sansCommentaires = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const { etapesSuivi, maintenantSuivi, commandeArretee } = require('../src/lib/suivi-commande.ts');

test('PUB-03 : l’étape en cours est la première non faite, aucune si la commande est arrêtée', () => {
  const enCours = (statut) => etapesSuivi({ status: statut }).filter((e) => e.enCours).map((e) => e.id);
  assert.deepEqual(enCours('pending_call'), ['appel']);
  assert.deepEqual(enCours('confirmed'), ['livreur']);
  assert.deepEqual(enCours('dispatched'), ['ramassage']);
  assert.deepEqual(enCours('in_transit'), ['livree']);
  assert.deepEqual(enCours('delivered'), []);
  assert.deepEqual(enCours('cancelled'), []);
  assert.equal(etapesSuivi({ status: 'delivered' }).every((e) => e.faite), true);
  assert.equal(commandeArretee('returned'), true);
  const titres = etapesSuivi({ status: 'new' }).map((e) => e.titre).join(' ');
  assert.doesNotMatch(titres, /Encaissé|Acheminement|Téléphonique/);
});

test('PUB-03 : « maintenant » dit quoi faire ; en route, le code et le montant à préparer', () => {
  assert.equal(maintenantSuivi({ status: 'pending_call' }).titre, 'Suguba va vous appeler');
  const route = maintenantSuivi({ status: 'in_transit', totalAmount: 24000, paymentCollected: false });
  assert.match(route.texte, /code secret et 24 000 F/);
  assert.doesNotMatch(maintenantSuivi({ status: 'in_transit', totalAmount: 24000, paymentCollected: true }).texte, /F pour/);
  assert.equal(maintenantSuivi({ status: 'dispatched', driverName: 'Moussa' }).texte.startsWith('Moussa'), true);
});

test('PUB-03 : la page de suivi affiche « maintenant » et l’étape en cours ; un seul indicateur de chargement', () => {
  const src = sansCommentaires(lire('src/app/track/[orderNumber]/page.tsx'));
  assert.match(src, /maintenantSuivi\(order\)/);
  assert.match(src, /aria-current=\{etape\.enCours \? 'step' : undefined\}/);
  assert.match(src, />En cours</);
  assert.doesNotMatch(src, /<SugubaLoader className="mr-2 h-4 w-4" \/>Mise à jour/);
  assert.doesNotMatch(src, /Assistance Suguba \(\+223\)|<Phone /, 'plus d’icône de téléphone pour un lien WhatsApp');
  assert.match(src, /<details[\s\S]{0,600}Payer maintenant par Mobile Money/);
});

test('PUB-02 : « Commande reçue » — la prochaine étape d’abord, Mobile Money replié, un seul bouton plein', () => {
  const src = sansCommentaires(lire('src/app/order-success/[orderNumber]/page.tsx'));
  assert.ok(src.indexOf('Suguba appelle le') < src.indexOf('<DeliveryCodeNotice'), 'la prochaine étape passe avant le code');
  assert.match(src, /<details[\s\S]{0,600}Payer maintenant par Mobile Money/);
  assert.match(src, /<Button href=\{`\/track\/\$\{order\.orderNumber\}`\} size="lg" fullWidth>/);
  assert.equal((src.match(/<Button\b(?![^>]*variant=)/g) || []).length, 2, 'le bouton plein + le repli « Vérifier ma commande »');
  assert.doesNotMatch(src, /bg-slate-900|bg-emerald-600 hover/);
  assert.match(lire('src/app/p/[slug]/commander/page.tsx'), /rien à payer maintenant/);
});

test('PUB-01 / PUB-08 : la fiche produit annonce la livraison ; « Partager » en contour pour le client', () => {
  const src = sansCommentaires(lire('src/app/p/[slug]/page.tsx'));
  assert.match(src, /devis\.fraisLivraison/);
  assert.match(src, /payez à la livraison/);
  assert.doesNotMatch(src, />\s*Recommander\s*</);
});

test('PUB-04 : diaspora — « Offrez » seulement quand l’acheteur paie, e-mail facultatif sans carte, charte Suguba', () => {
  const src = sansCommentaires(lire('src/app/diaspora/page.tsx'));
  assert.match(src, /carteOuverte \? 'Offrez un article à votre famille à Bamako' : 'Faites livrer votre famille à Bamako/);
  assert.match(src, /required=\{carteOuverte\}/);
  assert.doesNotMatch(src, /emerald|toFixed\(/);
  assert.match(src, /<Button type="submit" size="lg" fullWidth loading=\{isProcessing\}/);
  assert.match(src, /Commander · \$\{formatF\(devis\.total\)\} à la réception/, 'le proche paie en F, pas en euros');
  assert.doesNotMatch(src, /Paiement Validé/, 'plus d’écran de succès mort annonçant un paiement');
  for (const id of ['diaspora-email', 'diaspora-nom', 'diaspora-tel', 'diaspora-quartier']) assert.match(src, new RegExp(`htmlFor="${id}"`));
});

test('PUB-06 : la carte en vitrine garde unité, minimum, « Sur devis » et le bon bouton', () => {
  const { offreVitrine } = require('../src/lib/shop.ts');
  const devis = offreVitrine({ mode_commande: 'devis' }, true);
  assert.equal(devis.etiquetteOffre, 'Sur devis');
  assert.equal(devis.ajoutDirect, false);
  const simple = offreVitrine({ unite_vente: 'kg', quantite_min: 3 }, true);
  assert.ok(simple.suffixeUnite, 'unité affichée');
  assert.ok(simple.minimum, 'minimum affiché');
  assert.equal(simple.quantiteAjout, 3);
  assert.equal(offreVitrine({ variant_group: 'g1' }, true).aChoisir, true);
  const shop = lire('src/lib/shop.ts');
  assert.match(shop, /if \(error \|\| !data\) return liste;/, 'une colonne manquante ne casse pas la vitrine');
  assert.match(lire('src/components/shop/BoutiqueProduits.tsx'), /etiquetteOffre: p\.etiquetteOffre/);
});

test('PUB-12 / PUB-13 : « Suivre » secondaire ; garanties sous la recherche ; une seule largeur', () => {
  assert.doesNotMatch(lire('src/components/shop/BoutonSuivre.tsx'), /'bg-suguba-profond hover:bg-suguba-profond-2 text-white'/);
  const accueil = sansCommentaires(lire('src/app/page.tsx'));
  assert.ok(accueil.indexOf('Payez à la livraison') < accueil.indexOf('<SelectionReferent'), 'garanties avant le catalogue');
  assert.doesNotMatch(accueil, /max-w-4xl/);
});

test('PUB-11 / PUB-14 : suivi accessible sur ordinateur ; commande en cours en tête du compte', () => {
  assert.match(lire('src/components/common/Header.tsx'), /href="\/track"[\s\S]{0,400}Suivre ma commande/);
  const compte = sansCommentaires(lire('src/app/compte/page.tsx'));
  assert.match(compte, /Commande en cours/);
  assert.match(compte, /variant="ghost" fullWidth onClick=\{seDeconnecter\} loading=\{sortie\}/);
  assert.doesNotMatch(lire('src/components/compte/OngletsCompte.tsx'), /bg-slate-900/);
  assert.match(lire('src/app/compte/commandes/page.tsx'), /Suivre ma commande/);
});
