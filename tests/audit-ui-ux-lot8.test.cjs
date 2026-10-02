// TEST-UX-ARBITRAGES-001..008 (audit UI/UX du 2026-10-02, lot 8 « arbitrages ») :
// numéro du client (REV-10), parcours de commande unique (PUB-10), caisse des
// livreurs, chiffres du jour et bandeau de démarrage (points du lot 4).
require('../scripts/test-typescript.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const lire = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const sansCommentaires = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('REV-10 : numéro complet pendant la commande, masqué ensuite, même rendu que « Mes clients »', () => {
  const c = require('../src/lib/acces-contacts.ts');
  const commande = (status) => ({ status, customer_phone: '+22370123456', platform_margin: 1 });
  assert.equal(c.commandePourRevendeur(commande('dispatched')).customer_phone, '+22370123456');
  assert.equal(c.commandePourRevendeur(commande('returned')).customer_phone, '•• 34 56');
  assert.equal(c.telephoneMasque('+22370123456'), '•• 34 56');
  assert.equal('platform_margin' in c.commandePourRevendeur(commande('delivered')), false);
  assert.match(lire('src/app/api/reseller/clients/route.ts'), /telephoneMasque\(c\.customer_phone\)/);
  assert.match(lire('src/app/reseller/orders/page.tsx'), /startsWith\('••'\)/);
});

test('PUB-10 : règles communes du formulaire (erreurs, premier champ, code promo)', () => {
  const f = require('../src/lib/formulaire-commande.ts');
  const vide = f.erreursCommande({ nom: '', telephone: '12', mode: 'home_delivery', quartier: '', repere: '' });
  assert.equal(f.premierChampEnErreur(vide), 'champ-nom');
  const relais = f.erreursCommande({ nom: 'Awa', telephone: '70 12 34 56', mode: 'pickup_point', quartier: '', repere: '' });
  assert.deepEqual(Object.values(relais).filter(Boolean), [], 'en point relais, ni quartier ni repère');
  assert.equal(f.telephoneNormalise('70 12-34.56'), '70123456');
  const F = (n) => `${n} F`;
  assert.equal(f.avisCodePromo({ soumis: 'X', reconnu: false, remise: 0, formater: F }).ton, 'erreur');
  assert.equal(f.avisCodePromo({ soumis: 'X', reconnu: true, remise: 0, formater: F }).ton, 'attente', 'reconnu sans remise ≠ invalide');
  assert.match(f.avisCodePromo({ soumis: 'X', reconnu: true, remise: 500, formater: F }).texte, /appliqué : −500 F/);
  assert.equal(f.avisCodePromo({ soumis: '', reconnu: true, remise: 500, formater: F }), null);
});

test('PUB-10 : les deux tunnels utilisent le même formulaire', () => {
  for (const f of ['src/app/p/[slug]/commander/page.tsx', 'src/app/panier/page.tsx']) {
    const src = lire(f);
    for (const composant of ['EnteteCommande', 'SectionCommande', 'CoordonneesCommande', 'LivraisonCommande', 'CodePromoCommande', 'GarantiesCommande', 'BarreCommande']) {
      assert.match(src, new RegExp(`<${composant}\\b`), `${f} : ${composant}`);
    }
    assert.match(src, /premierChampEnErreur\(erreurs\)/, `${f} : erreur qui mène au champ`);
    assert.doesNotMatch(src, /function Section\(|PRECISION_VILLE/, f);
  }
  assert.ok(lire('src/app/p/[slug]/commander/page.tsx').split('\n').length < 400, 'le tunnel direct a perdu ses doublons');
});

test('PUB-10 : le panier corrige ses défauts (devis en erreur, minimum, relais, reprise, écran de fin)', () => {
  const src = sansCommentaires(lire('src/app/panier/page.tsx'));
  assert.match(src, /if \(!r\.ok \|\| !d \|\| !Array\.isArray\(d\.lignes\)\)/, 'devis refusé géré');
  assert.match(src, /disabled=\{a\.quantity <= mini\}/, 'minimum du vendeur');
  assert.match(src, /relaisImpossible=\{remiseVendeurDansPanier/, 'pas de relais pour un article remis par son vendeur');
  assert.match(src, /<ReprisePanier /, 'reprise après coupure');
  assert.match(src, /commandes\.length === 1 \? `\/order-success\/\$\{commandes\[0\]\.orderNumber\}` : '\/panier\/confirmation'/);
  assert.doesNotMatch(src, /Complétez les champs en rouge/);
  const fin = lire('src/app/panier/confirmation/page.tsx');
  assert.match(fin, /Commande reçue/);
  assert.match(fin, /Suguba appelle le/);
  assert.doesNotMatch(fin, /Commande enregistrée/);
});

test('Lot 4 : lieu et horaires de la caisse — réglage normalisé, remis aux seuls livreurs', () => {
  const { completerReglages } = require('../src/lib/pricing.ts');
  assert.deepEqual(completerReglages({}).caisseLivreurs, { lieu: '', horaires: '' });
  const r = completerReglages({ caisseLivreurs: { lieu: '  Bureau   Suguba ', horaires: 'x'.repeat(300) } });
  assert.equal(r.caisseLivreurs.lieu, 'Bureau Suguba');
  assert.equal(r.caisseLivreurs.horaires.length, 120);
  assert.match(lire('src/app/api/driver/caisse/route.ts'), /lieuCaisse: reglages\.caisseLivreurs\?\.lieu \|\| null/);
  assert.doesNotMatch(lire('src/app/api/settings/public/route.ts'), /caisseLivreurs/, 'jamais publié');
  const portefeuille = lire('src/app/driver/earnings/page.tsx');
  assert.match(portefeuille, /Versez à la caisse : <strong>\{lieuCaisse\}<\/strong>/);
  assert.match(lire('src/components/admin/EconomicSettingsPanel.tsx'), /Où les livreurs versent les espèces/);
});

test('Lot 4 : la vue d’ensemble montre aujourd’hui et les appels en retard', () => {
  const { syntheseFinance, RETARD_APPEL_MS } = require('../src/lib/admin/finance.ts');
  const maintenant = Date.parse('2026-10-02T12:00:00Z');
  const o = (status, heuresAvant) => ({ status, created_at: new Date(maintenant - heuresAvant * 3_600_000).toISOString(), total_amount: 1000 });
  const f = syntheseFinance([o('pending_call', 5), o('pending_call', 1), o('confirmed', 10), o('new', 6)], [], undefined, undefined, maintenant);
  assert.equal(f.appelsEnRetard, 2);
  assert.equal(RETARD_APPEL_MS, 4 * 3_600_000);
  const page = lire('src/app/admin/page.tsx');
  assert.match(page, /useFinance\(aujourdhui, aujourdhui\)/);
  assert.match(page, /label="Appels en retard"/);
  assert.ok(page.indexOf('titre-jour') < page.indexOf('titre-chiffres'));
});

test('Lot 4 : le bandeau de démarrage inutilisé est supprimé', () => {
  assert.equal(fs.existsSync(path.join(__dirname, '..', 'src/components/reseau/BandeauDemarrage.tsx')), false);
});
