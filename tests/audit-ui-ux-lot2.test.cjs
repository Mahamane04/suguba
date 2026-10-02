// TEST-UX-ARGENT-001..009 (audit UI/UX du 2026-10-02, lot 2 « le langage de l'argent ») :
// un seul format de montant et de date, les mêmes mots pour la même somme, et l'état
// réel de chaque commission, vente par vente.
require('../scripts/test-typescript.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const RACINE = path.join(__dirname, '..');
const lire = (f) => fs.readFileSync(path.join(RACINE, f), 'utf8');
const { formatF, formatNombre, formatDevise, formatDate, FORMAT_DATE } = require('../src/lib/montant.ts');
const { STATUT_VENTE, etatCommissionVente } = require('../src/lib/libelles-vente.ts');

const NB = ' ';
function fichiers(dossier, ext = /\.tsx?$/) {
  const sortie = [];
  for (const nom of fs.readdirSync(dossier)) {
    const plein = path.join(dossier, nom);
    if (fs.statSync(plein).isDirectory()) sortie.push(...fichiers(plein, ext));
    else if (ext.test(nom)) sortie.push(plein);
  }
  return sortie;
}

test('formatF : « 24 000 F », espaces insécables, vrai signe moins, jamais NaN', () => {
  assert.equal(formatF(24000), `24${NB}000${NB}F`);
  assert.equal(formatF(1250000), `1${NB}250${NB}000${NB}F`);
  assert.equal(formatF(24950.6), `24${NB}951${NB}F`);
  assert.equal(formatF(-4920), `−4${NB}920${NB}F`);
  assert.equal(formatF(0), `0${NB}F`);
  assert.equal(formatF(null), '—');
  assert.equal(formatF(Number.NaN), '—');
  assert.equal(formatNombre(172000), `172${NB}000`);
});

test('formatDevise : virgule française pour la diaspora', () => {
  assert.equal(formatDevise(36.594, 'EUR'), `36,59${NB}€`);
  assert.match(formatDevise(40.03, 'USD'), /^40,03/);
});

test('formatDate : deux familles de formats, « — » si la date est illisible', () => {
  assert.deepEqual(Object.keys(FORMAT_DATE), ['jour', 'jourHeure', 'complet', 'completHeure']);
  assert.match(formatDate('2026-10-15T10:00:00Z', 'jour'), /^15 oct\.$/);
  assert.match(formatDate('2026-10-15T10:00:00Z', 'complet'), /^15 oct\. 2026$/);
  assert.equal(formatDate('pas une date'), '—');
  assert.equal(formatDate(null), '—');
});

test('plus aucun formateur local de montant : tous passent par formatF', () => {
  const DEF = /const \w+\s*=\s*\(\w+(?:\s*:\s*number)?\)\s*=>\s*`\$\{Math\.round\(\w+[^)]*\)\.toLocaleString\('fr-FR'\)\}/;
  const restants = fichiers(path.join(RACINE, 'src')).filter((f) => DEF.test(fs.readFileSync(f, 'utf8')));
  assert.deepEqual(restants.map((f) => path.relative(RACINE, f)), []);
});

test('« FCFA » n’est plus affiché comme unité, sauf textes légaux et choix de devise', () => {
  const autorises = [/src\/app\/legal\//, /src\/app\/diaspora\/page\.tsx$/, /src\/app\/admin\/products\/new\/page\.tsx$/];
  const fautifs = [];
  for (const f of fichiers(path.join(RACINE, 'src'), /\.tsx$/)) {
    const rel = path.relative(RACINE, f);
    if (autorises.some((r) => r.test(rel))) continue;
    fs.readFileSync(f, 'utf8').split('\n').forEach((l, i) => {
      if (/FCFA/.test(l) && !/^\s*(\/\/|\*|\{\/\*)/.test(l)) fautifs.push(`${rel}:${i + 1}`);
    });
  }
  assert.deepEqual(fautifs, []);
  // Dans la création de produit, « FCFA » ne survit que dans les identifiants techniques des champs.
  const produit = lire('src/app/admin/products/new/page.tsx').split('\n').filter((l) => /FCFA/.test(l));
  assert.ok(produit.every((l) => /(htmlFor|id)="champ-Prix-/.test(l)), produit.join('\n'));
});

test('REV-01 : chaque statut de commande a un libellé ; la commission dit quand elle devient retirable', () => {
  for (const s of ['new', 'pending_call', 'confirmed', 'dispatched', 'in_transit', 'delivered', 'cancelled', 'returned']) {
    assert.ok(STATUT_VENTE[s] && STATUT_VENTE[s].libelle, s);
  }
  const maintenant = Date.parse('2026-10-02T12:00:00Z');
  const ligne = (statut, debloquagePrevu = null, montant = 4000) => ({ commande: 'v1', montant, statut, debloquagePrevu });
  assert.equal(etatCommissionVente([ligne('pending')], 'confirmed', 4000, maintenant).libelle, 'Arrive après la livraison');
  assert.equal(etatCommissionVente([ligne('locked', '2026-10-15T10:00:00Z')], 'delivered', 4000, maintenant).libelle, 'Retirable le 15 oct.');
  assert.match(etatCommissionVente([ligne('locked', '2026-09-30T10:00:00Z')], 'delivered', 4000, maintenant).libelle, /argent du client/);
  assert.equal(etatCommissionVente([ligne('available')], 'delivered', 4000, maintenant).libelle, 'Retirable maintenant');
  assert.equal(etatCommissionVente([ligne('reserved')], 'delivered', 4000, maintenant).libelle, 'Retrait en cours');
  assert.equal(etatCommissionVente([ligne('paid')], 'delivered', 4000, maintenant).libelle, 'Versée');
  // Une partie encore en attente : la vente n'est pas « versée ».
  assert.equal(etatCommissionVente([ligne('paid', null, 2500), ligne('locked', '2026-10-15T10:00:00Z', 1500)], 'delivered', 4000, maintenant).montant, 4000);
  assert.match(etatCommissionVente([ligne('paid', null, 2500), ligne('locked', '2026-10-15T10:00:00Z', 1500)], 'delivered', 4000, maintenant).libelle, /^Retirable le/);
  assert.equal(etatCommissionVente([ligne('reversed')], 'delivered', 4000, maintenant).libelle, 'Commission annulée');
  assert.deepEqual(etatCommissionVente([], 'cancelled', 4000, maintenant), { montant: 0, libelle: 'Vente annulée : pas de commission', ton: 'danger' });
});

test('REV-01 : « Mes ventes » lit les commissions du serveur, plus la liste locale vide', () => {
  const ventes = lire('src/app/reseller/orders/page.tsx');
  assert.doesNotMatch(ventes, /state\.commissions/);
  assert.match(ventes, /commissionsParVente/);
  assert.match(ventes, /etatCommissionVente\(/);
  assert.doesNotMatch(ventes, /Livré & Encaissé|Livrées & Payées|Ta Commission/);
  assert.match(lire('src/app/api/reseller/me/route.ts'), /commissionsParVente:/);
});

test('REV-02 / REV-05 : mêmes mots pour la même somme, sommes rattachées à leur vente, bouton chiffré', () => {
  assert.doesNotMatch(lire('src/app/reseller/page.tsx'), /Total gagné/);
  // Lot 4 : « Déjà versé » est une ligne de la carte d'argent (plus une tuile).
  assert.match(lire('src/app/reseller/page.tsx'), /Déjà versé<\/dt>/);
  const gains = lire('src/app/reseller/payouts/page.tsx');
  assert.doesNotMatch(gains, /Les dates viennent du grand-livre/);
  assert.match(gains, /etatCommissionVente\(\[c\]/);
  assert.match(lire('src/components/retraits/FormulaireRetrait.tsx'), /Demander le virement de \$\{enF\(montant\)\}/);
});

test('ADM-06 : les champs d’argent montrent « F » et un écho du montant', () => {
  const field = lire('src/components/ui/Field.tsx');
  assert.match(field, /export const MontantInput/);
  assert.match(field, /= \{formatF\(nombre\)\}/);
  const attendus = {
    'src/app/admin/sponsorisations/page.tsx': 1, 'src/app/admin/recompenses/page.tsx': 2, 'src/app/admin/missions/page.tsx': 1,
    'src/app/supplier/devis/page.tsx': 2, 'src/app/supplier/products/new/page.tsx': 3, 'src/app/admin/products/new/page.tsx': 2,
    'src/components/admin/ProductPricingModal.tsx': 1,
  };
  for (const [f, n] of Object.entries(attendus)) assert.equal((lire(f).match(/<MontantInput\b/g) || []).length, n, f);
});
