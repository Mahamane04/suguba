// TEST-UX-ACCUEILS-001..007 (audit UI/UX du 2026-10-02, lot 4 « les accueils ») :
// chaque profil voit d'abord ce qu'il doit faire maintenant.
require('../scripts/test-typescript.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const lire = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
// Le code affiché, sans les commentaires (qui citent volontairement l'ancien état).
const sansCommentaires = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const { prioriteCommande, trierParUrgence, resumeAFaire, demandeAction } = require('../src/lib/a-faire-fournisseur.ts');

const cmd = (id, statut, extra = {}) => ({ id, numero: `SG-${id}`, produit: 'Ventilateur', quantite: 1, statut, ...extra });

test('FOU-02 : priorité — livreur en route, puis à préparer, puis en livraison, puis client à confirmer', () => {
  assert.equal(prioriteCommande(cmd('a', 'dispatched', { codeRamassage: '1579' })), 0);
  assert.equal(prioriteCommande(cmd('b', 'confirmed')), 1);
  assert.equal(prioriteCommande(cmd('c', 'in_transit')), 2);
  assert.equal(prioriteCommande(cmd('d', 'pending_call')), 3);
  assert.equal(prioriteCommande(cmd('e', 'delivered')), 4);
  // Remise par le fournisseur : c'est à lui d'agir, même en livraison.
  assert.equal(prioriteCommande(cmd('f', 'in_transit', { modeRemise: 'fournisseur' })), 1);
  assert.equal(demandeAction(cmd('g', 'pending_call')), false, 'un client pas encore confirmé ne demande rien au fournisseur');
});

test('FOU-02 : le colis urgent passe en tête, sans changer l’ordre du reste', () => {
  const liste = [cmd('1', 'pending_call'), cmd('2', 'confirmed'), cmd('3', 'pending_call'), cmd('4', 'dispatched', { codeRamassage: '1579' }), cmd('5', 'confirmed')];
  assert.deepEqual(trierParUrgence(liste).map((c) => c.id), ['4', '2', '5', '1', '3']);
  const r = resumeAFaire(liste);
  assert.equal(r.livreursEnRoute.length, 1);
  assert.equal(r.aPreparer.length, 2);
  assert.equal(r.enAttenteClient, 2);
});

test('FOU-02 : « À préparer » ne compte que ce qui demande une action ; les attentes client sont repliées', () => {
  const src = lire('src/app/supplier/commandes/page.tsx');
  assert.match(src, /`À préparer \(\$\{aFaire\.length\}\)`/);
  assert.match(src, /trierParUrgence\(/);
  assert.match(src, /<details[\s\S]{0,300}En attente du client \(\{enAttenteClient\.length\}\)/);
});

test('FOU-01 : l’accueil fournisseur commence par « À faire maintenant », bouton principal contextuel', () => {
  const src = lire('src/app/supplier/page.tsx');
  assert.match(src, /À faire maintenant/);
  for (const url of ['/api/supplier/commandes', '/api/supplier/devis', '/api/supplier/gains']) assert.ok(src.includes(url), url);
  assert.match(src, /Préparer mes colis \(\{colisAPreparer\}\)/);
  assert.match(src, /Code de ramassage à lui donner/);
  assert.match(src, /products\.slice\(0, 3\)/);
});

test('LIV-03 : verser les espèces en trois étapes, sans lieu inventé', () => {
  const src = sansCommentaires(lire('src/app/driver/earnings/page.tsx'));
  assert.match(src, /Comptez <strong/);
  assert.match(src, /Demander où verser/);
  assert.doesNotMatch(src, /Hub ACI 2000|Clinique Pasteur/);
});

test('REV-04 / REV-13 : accueil revendeur — démarrage vers la première vente, argent en un bloc, 3 raccourcis', () => {
  const src = sansCommentaires(lire('src/app/reseller/page.tsx'));
  assert.match(src, /function ListeDemarrage/);
  assert.match(src, /Première vente livrée/);
  assert.doesNotMatch(src, /Quel produit allez-vous partager/);
  assert.doesNotMatch(src, /Retirer mes gains/);
  assert.match(src, /Retirable maintenant/);
  assert.match(src, /Prochain déblocage/);
  assert.doesNotMatch(src, /titre="Créer une commande"/);
});

test('ADM-10 : la vue d’ensemble commence par ce qu’il faut faire ; tuiles cliquables, sans jargon', () => {
  const src = lire('src/app/admin/page.tsx');
  assert.ok(src.indexOf('À faire maintenant') < src.indexOf('Les chiffres'), 'les files avant les chiffres');
  assert.doesNotMatch(src, /Grand-livre serveur|label="Appels à passer"/);
  assert.match(src, /StatCard href=/);
  const { StatCard } = require('../src/components/ui/Surface.tsx');
  const html = renderToStaticMarkup(React.createElement(StatCard, { label: 'Retraits à payer', valeur: 3, href: '/admin/retraits' }));
  assert.match(html, /^<a [^>]*href="\/admin\/retraits"/);
});
