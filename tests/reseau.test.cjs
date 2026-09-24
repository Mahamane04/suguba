require('../scripts/test-typescript.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');

const codes = require('../src/lib/reseau/codes.ts');
const { deciderAttribution, cleClient } = require('../src/lib/reseau/attribution.ts');
const missions = require('../src/lib/reseau/missions.ts');
const badges = require('../src/lib/reseau/badges.ts');
const permissions = require('../src/lib/reseau/permissions.ts');
const sponsoring = require('../src/lib/reseau/sponsoring.ts');

// ── Codes de liens ─────────────────────────────────────────────────────────

test('un code de lien ne contient aucun caractère confondable', () => {
  // Un code se recopie à la main depuis un flyer : O/0 et I/1/L sont exclus.
  for (let i = 0; i < 200; i++) {
    const code = codes.genererCodeLien((n) => Buffer.from(Array.from({ length: n }, () => Math.floor(Math.random() * 256))));
    assert.equal(code.length, codes.LONGUEUR_CODE);
    assert.doesNotMatch(code, /[O0I1L]/);
  }
});

test('un code de lien couvre tout son alphabet (pas de biais figé)', () => {
  const vus = new Set();
  for (let i = 0; i < 2000; i++) {
    const code = codes.genererCodeLien((n) => Buffer.from(Array.from({ length: n }, () => Math.floor(Math.random() * 256))));
    for (const c of code) vus.add(c);
  }
  assert.ok(vus.size >= 30, `alphabet trop étroit : ${vus.size} caractères`);
});

test('la normalisation d’un code refuse tout ce qui n’est pas un code', () => {
  assert.equal(codes.normaliserCodeLien('ab78x2'), 'AB78X2');
  assert.equal(codes.normaliserCodeLien('  ab78x2 '), 'AB78X2');
  assert.equal(codes.normaliserCodeLien('ab-78'), null);
  assert.equal(codes.normaliserCodeLien('abc'), null);
  assert.equal(codes.normaliserCodeLien('a'.repeat(40)), null);
  assert.equal(codes.normaliserCodeLien(null), null);
  assert.equal(codes.normaliserCodeLien({ toString: () => 'AB78X2' }), null);
});

test('la destination d’un lien reste toujours interne au site', () => {
  // Une destination lue telle quelle en base ouvrirait une redirection
  // ouverte : un lien Suguba menant sur un site tiers.
  const cas = [
    ['product', 'tcl-smart-tv'],
    ['store', 'boutique-awa'],
    ['referral', null],
    ['home', null],
    ['product', 'https://evil.example.com'],
    ['store', '../../admin'],
  ];
  for (const [cible, ref] of cas) {
    const url = codes.destinationDuLien(cible, ref, 'SG-1', 'AB78X2');
    assert.ok(url.startsWith('/'), `${url} doit être un chemin interne`);
    assert.doesNotMatch(url, /^\/\//, 'une URL protocol-relative sortirait du site');
    assert.ok(url.includes('via=AB78X2'));
  }
});

test('la destination porte le code revendeur, et rien quand il n’y en a pas', () => {
  assert.match(codes.destinationDuLien('product', 'tv', 'SG-107092', 'AB78X2'), /ref=SG-107092/);
  assert.doesNotMatch(codes.destinationDuLien('product', 'tv', null, 'AB78X2'), /ref=/);
});

test('le taux de conversion ne divise jamais par zéro', () => {
  assert.equal(codes.tauxConversion(0, 0), 0);
  assert.equal(codes.tauxConversion(0, 5), 0);
  assert.equal(codes.tauxConversion(100, 12), 12);
  assert.equal(codes.tauxConversion(3, 1), 33.3);
});

// ── Attribution ────────────────────────────────────────────────────────────

test('le premier revendeur qui amène un client le garde', () => {
  const existante = { resellerId: 'awa', source: 'lien', linkCode: 'AAA111', firstSeenAt: '2026-01-01T00:00:00Z' };
  const decision = deciderAttribution(existante, { resellerId: 'moussa', source: 'lien', linkCode: 'BBB222' });
  assert.equal(decision.resellerId, 'awa', 'le second revendeur ne doit pas voler le client du premier');
  assert.equal(decision.changeLeReferent, false);
  assert.equal(decision.metAJourDernierPassage, true, 'le passage reste compté pour les statistiques');
  assert.equal(decision.raison, 'referent-conserve');
});

test('un client sans historique est attribué au revendeur qui l’amène', () => {
  const decision = deciderAttribution(null, { resellerId: 'awa', source: 'lien', linkCode: 'AAA111' });
  assert.equal(decision.resellerId, 'awa');
  assert.equal(decision.changeLeReferent, true);
  assert.equal(decision.raison, 'premier-contact');
});

test('un client sans historique et sans revendeur ne crée aucune attribution', () => {
  const decision = deciderAttribution(null, { resellerId: null, source: 'direct', linkCode: null });
  assert.equal(decision.resellerId, null);
  assert.equal(decision.changeLeReferent, false);
  assert.equal(decision.raison, 'aucun-revendeur');
});

test('un administrateur peut ré-attribuer explicitement', () => {
  const existante = { resellerId: 'awa', source: 'lien', linkCode: null, firstSeenAt: '2026-01-01T00:00:00Z' };
  const decision = deciderAttribution(existante, { resellerId: 'moussa', source: 'admin', linkCode: null, motif: 'admin' });
  assert.equal(decision.resellerId, 'moussa');
  assert.equal(decision.raison, 'reattribution-admin');
});

test('un référent détaché est remplacé par le revendeur suivant', () => {
  const existante = { resellerId: null, source: 'direct', linkCode: null, firstSeenAt: '2026-01-01T00:00:00Z' };
  const decision = deciderAttribution(existante, { resellerId: 'awa', source: 'lien', linkCode: 'AAA111' });
  assert.equal(decision.resellerId, 'awa');
  assert.equal(decision.changeLeReferent, true);
});

test('un même numéro écrit de quatre façons donne une seule clé client', () => {
  const attendu = '+22376123456';
  assert.equal(cleClient('+223 76 12 34 56'), attendu);
  assert.equal(cleClient('0022376123456'), attendu);
  assert.equal(cleClient('22376123456'), attendu);
  assert.equal(cleClient('76 12 34 56'), attendu, 'un numéro local doit recevoir l’indicatif malien');
});

test('un numéro inutilisable ne produit pas de clé', () => {
  assert.equal(cleClient('12'), null);
  assert.equal(cleClient(''), null);
  assert.equal(cleClient(null), null);
  assert.equal(cleClient('1'.repeat(20)), null);
});

// ── Missions ───────────────────────────────────────────────────────────────

test('la progression est bornée et gère l’objectif nul', () => {
  assert.equal(missions.progression(0, 10), 0);
  assert.equal(missions.progression(5, 10), 50);
  assert.equal(missions.progression(15, 10), 100);
  assert.equal(missions.progression(-3, 10), 0);
  assert.equal(missions.progression(0, 0), 100);
});

test('une mission fermée, pleine ou finie n’accepte plus personne', () => {
  const maintenant = new Date('2026-06-01T12:00:00Z');
  const base = { id: 'm1', type: 'share', objectif: 5, finitLe: null, statut: 'active', maxParticipants: null };

  assert.equal(missions.ouverteALaParticipation(base, 0, maintenant).ouverte, true);
  assert.equal(missions.ouverteALaParticipation({ ...base, statut: 'draft' }, 0, maintenant).ouverte, false);
  assert.equal(missions.ouverteALaParticipation({ ...base, finitLe: '2026-05-01T00:00:00Z' }, 0, maintenant).ouverte, false);
  assert.equal(missions.ouverteALaParticipation({ ...base, maxParticipants: 3 }, 3, maintenant).ouverte, false);
  assert.equal(missions.ouverteALaParticipation({ ...base, maxParticipants: 3 }, 2, maintenant).ouverte, true);
});

test('une participation atteinte passe à valider, une déjà validée ne régresse pas', () => {
  assert.equal(missions.etatApresProgression('joined', 4, 5), 'joined');
  assert.equal(missions.etatApresProgression('joined', 5, 5), 'completed');
  assert.equal(missions.etatApresProgression('validated', 1, 5), 'validated');
  assert.equal(missions.etatApresProgression('rejected', 9, 5), 'rejected');
});

test('les jours restants sont arrondis au supérieur et jamais négatifs', () => {
  const maintenant = new Date('2026-06-01T00:00:00Z');
  assert.equal(missions.joursRestants('2026-06-04T00:00:00Z', maintenant), 3);
  assert.equal(missions.joursRestants('2026-06-01T06:00:00Z', maintenant), 1);
  assert.equal(missions.joursRestants('2026-05-01T00:00:00Z', maintenant), 0);
  assert.equal(missions.joursRestants(null, maintenant), null);
});

// ── Vérification et badges ─────────────────────────────────────────────────

test('seules les vérifications APPROUVÉES comptent dans le pourcentage', () => {
  assert.equal(badges.pourcentageVerifie({}), 0);
  assert.equal(badges.pourcentageVerifie({ identity: 'pending', selfie: 'pending' }), 0);
  assert.equal(badges.pourcentageVerifie({ phone: 'approved' }), 25);
  const tout = Object.fromEntries(badges.VERIFICATIONS.map((v) => [v.valeur, 'approved']));
  assert.equal(badges.pourcentageVerifie(tout), 100);
});

test('les badges automatiques suivent des règles, pas une liste figée', () => {
  const acquis = badges.badgesAutomatiques({
    verifications: { identity: 'approved', selfie: 'approved', location: 'approved' },
    ventesCeMois: 3,
    livraisonsReussies: 20,
    livraisonsTotales: 20,
    rangVendeur: 4,
  });
  assert.ok(acquis.includes('profil_verifie'));
  assert.ok(acquis.includes('localisation_verifiee'));
  assert.ok(acquis.includes('revendeur_actif'));
  assert.ok(acquis.includes('top_vendeur'));
  assert.ok(acquis.includes('livraison_excellente'));
});

test('un profil sans rien ne gagne aucun badge', () => {
  const acquis = badges.badgesAutomatiques({
    verifications: { identity: 'pending' },
    ventesCeMois: 0,
    livraisonsReussies: 0,
    livraisonsTotales: 0,
  });
  assert.deepEqual(acquis, []);
});

test('un badge inconnu s’affiche proprement au lieu de casser l’écran', () => {
  const inconnu = badges.badge('badge_du_futur');
  assert.equal(inconnu.cle, 'badge_du_futur');
  assert.equal(inconnu.libelle, 'badge du futur');
});

// ── Permissions ────────────────────────────────────────────────────────────

test('un admin sans ligne d’équipe garde tous les droits', () => {
  // Sinon, la mise en production de ce module enfermerait dehors les
  // administrateurs actuels, qui n'ont aucune ligne dans admin_team_members.
  assert.deepEqual(permissions.permissionsEffectives(null), [...permissions.PERMISSIONS]);
  assert.equal(permissions.aLaPermission(null, 'plateforme.equipe'), true);
});

test('un rôle d’équipe ne donne que ses propres permissions', () => {
  const support = { teamRole: 'support', permissions: [] };
  assert.equal(permissions.aLaPermission(support, 'commande.lire'), true);
  assert.equal(permissions.aLaPermission(support, 'finance.payer'), false);
  assert.equal(permissions.aLaPermission(support, 'plateforme.equipe'), false);
});

test('le super admin a toutes les permissions du catalogue', () => {
  const droits = permissions.permissionsDuRole('super_admin');
  for (const p of permissions.PERMISSIONS) assert.ok(droits.includes(p), `manque ${p}`);
});

test('une permission inventée est ignorée, jamais accordée', () => {
  const membre = { teamRole: 'support', permissions: ['finance.tout_vider', 'finance.payer'] };
  const droits = permissions.permissionsEffectives(membre);
  assert.ok(!droits.includes('finance.tout_vider'));
  assert.ok(droits.includes('finance.payer'));
});

// ── Sponsorisation ─────────────────────────────────────────────────────────

test('une sponsorisation n’est active que dans sa fenêtre et à l’état actif', () => {
  const maintenant = new Date('2026-06-15T00:00:00Z');
  const base = { id: 's1', sujetRef: 'p1', emplacement: 'home_products', statut: 'active', commenceLe: '2026-06-01T00:00:00Z', finitLe: '2026-06-30T00:00:00Z' };
  assert.equal(sponsoring.sponsorisationActive(base, maintenant), true);
  assert.equal(sponsoring.sponsorisationActive({ ...base, statut: 'pending' }, maintenant), false);
  assert.equal(sponsoring.sponsorisationActive({ ...base, finitLe: '2026-06-10T00:00:00Z' }, maintenant), false);
  assert.equal(sponsoring.sponsorisationActive({ ...base, commenceLe: '2026-07-01T00:00:00Z' }, maintenant), false);
  assert.equal(sponsoring.sponsorisationActive({ ...base, finitLe: null }, maintenant), true);
});

test('le classement sponsorisé est plafonné, marqué, et ne perd aucun élément', () => {
  const elements = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }, { id: 'e' }];
  const classe = sponsoring.classerAvecSponsorises(elements, ['c', 'd', 'e'], 2);

  assert.equal(classe.length, 5, 'aucun produit ne doit disparaître du catalogue');
  assert.deepEqual(classe.slice(0, 2).map((x) => x.element.id), ['c', 'd']);
  assert.equal(classe.filter((x) => x.sponsorise).length, 2, 'le plafond de sponsorisés doit tenir');
  assert.deepEqual(classe.slice(2).map((x) => x.element.id), ['a', 'b', 'e'], 'le reste garde son ordre d’origine');
});

test('sans sponsorisation, l’ordre du catalogue est inchangé', () => {
  const elements = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const classe = sponsoring.classerAvecSponsorises(elements, [], 3);
  assert.deepEqual(classe.map((x) => x.element.id), ['a', 'b', 'c']);
  assert.equal(classe.every((x) => !x.sponsorise), true);
});

test('la fin d’un pack se calcule à partir de sa durée', () => {
  const fin = sponsoring.finDuPack(new Date('2026-06-01T00:00:00Z'), 7);
  assert.equal(fin, '2026-06-08T00:00:00.000Z');
  // Une durée absurde ne doit pas produire une sponsorisation déjà terminée.
  assert.ok(new Date(sponsoring.finDuPack(new Date('2026-06-01T00:00:00Z'), 0)).getTime() > new Date('2026-06-01T00:00:00Z').getTime());
});

// ── V2 : réglages, statistiques, livraison par zones ───────────────────────

const reglages = require('../src/lib/reseau/reglages.ts');
const stats = require('../src/lib/reseau/stats.ts');
const pricing = require('../src/lib/pricing.ts');

test('une prime de parrainage absurde ne peut pas atteindre le grand-livre', () => {
  const r = reglages.normaliserReglagesReseau({ primeParrainageClient: -500, primeParrainageRevendeur: '9999999' });
  assert.equal(r.primeParrainageClient, reglages.REGLAGES_RESEAU_DEFAUT.primeParrainageClient, 'négatif → valeur par défaut');
  assert.equal(r.primeParrainageRevendeur, reglages.PRIME_MAX, 'erreur de frappe → plafonnée');
  assert.deepEqual(reglages.normaliserReglagesReseau(null), reglages.REGLAGES_RESEAU_DEFAUT);
  assert.equal(reglages.normaliserReglagesReseau({ primeParrainageClient: '1 520' }).primeParrainageClient, 1500, 'arrondi à 50 F');
});

test('parrainer un fournisseur ne déclenche aucune prime automatique', () => {
  const r = reglages.REGLAGES_RESEAU_DEFAUT;
  assert.equal(reglages.primeDuParrainage(r, 'supplier'), 0);
  assert.equal(reglages.primeDuParrainage(r, 'reseller'), r.primeParrainageRevendeur);
  assert.equal(reglages.primeDuParrainage(r, 'customer'), r.primeParrainageClient);
});

test('une série par jour contient tous les jours, zéros compris', () => {
  const maintenant = new Date('2026-06-10T15:00:00Z');
  const serie = stats.serieParJour([
    { date: '2026-06-10T08:00:00Z' },
    { date: '2026-06-10T09:00:00Z', valeur: 2 },
    { date: '2026-06-05T10:00:00Z' },
    { date: '2026-05-01T10:00:00Z' }, // hors période
    { date: 'pas une date' },
  ], 7, maintenant);
  assert.equal(serie.length, 7);
  assert.equal(serie[0].jour, '2026-06-04');
  assert.equal(serie[6].jour, '2026-06-10');
  assert.equal(serie[6].valeur, 3);
  assert.equal(serie[1].valeur, 1);
  assert.equal(serie.reduce((s, p) => s + p.valeur, 0), 4, 'rien hors période');
});

test('le ROI et l’évolution ne divisent jamais par zéro', () => {
  assert.equal(stats.retourSurInvestissement(50000, 10000), 5);
  assert.equal(stats.retourSurInvestissement(50000, 0), null);
  assert.equal(stats.evolution(15, 10), 50);
  assert.equal(stats.evolution(5, 0), null);
});

test('livraison par zones : commune, rive, fleuve, périphérie', () => {
  const r = pricing.completerReglages({ modeLivraisonBamako: 'zones' });
  const z = r.livraisonZonesBamako;
  assert.equal(pricing.fraisLivraisonZonesBamako(r, 'Djélibougou', 'Banconi'), z.memeCommune, 'Commune I → Commune I');
  assert.equal(pricing.fraisLivraisonZonesBamako(r, 'Djelibougou', 'Hamdallaye'), z.memeRive, 'I → III, sans accent');
  assert.equal(pricing.fraisLivraisonZonesBamako(r, 'Djélibougou', 'Yirimadio'), z.autreRive, 'I → VI traverse le fleuve');
  assert.equal(pricing.fraisLivraisonZonesBamako(r, 'Kati', 'Lafiabougou'), z.memeRive + z.supplementPeripherie);
  assert.equal(pricing.fraisLivraisonZonesBamako(r, 'Quartier inconnu', 'Banconi'), null, 'inconnu → repli tarif plat');
});

test('le devis applique le mode zones et retombe sur le tarif plat sans quartier', () => {
  const r = pricing.completerReglages({ modeLivraisonBamako: 'zones' });
  const produit = { prixFournisseur: 20000, prixVente: 30000 };
  const avec = pricing.calculerCommande(produit, { quantite: 1, ville: 'Bamako', quartierFournisseur: 'Djélibougou', quartierClient: 'Yirimadio' }, r);
  assert.equal(avec.fraisLivraison, r.livraisonZonesBamako.autreRive);
  const sans = pricing.calculerCommande(produit, { quantite: 1, ville: 'Bamako', quartierClient: 'Yirimadio' }, r);
  assert.equal(sans.fraisLivraison, r.livraisonParVille.Bamako);
});

test('les anciens réglages restent en mode distance et restent valides', () => {
  const r = pricing.completerReglages({});
  assert.equal(r.modeLivraisonBamako, 'distance');
  assert.deepEqual(pricing.validerReglages(r), []);
  const invalide = pricing.completerReglages({ modeLivraisonBamako: 'zones', livraisonZonesBamako: { memeCommune: -1, memeRive: 0, autreRive: 0, supplementPeripherie: 0 } });
  assert.ok(pricing.validerReglages(invalide).some((e) => /zones/.test(e)));
});

// ── Équipe fournisseur ─────────────────────────────────────────────────────

const equipe = require('../src/lib/reseau/equipe-fournisseur.ts');
const { cheminInterne } = require('../src/lib/apres-connexion.ts');

test('le propriétaire a tous les droits, y compris gérer l’équipe', () => {
  const d = equipe.droitsDuRole('proprietaire');
  for (const x of ['catalogue', 'boutique', 'revendeurs', 'sponsorisation', 'analyses', 'fiche', 'equipe']) assert.ok(d.includes(x), x);
});

test('aucun collaborateur ne peut gérer l’équipe ni la fiche officielle', () => {
  for (const r of equipe.ROLES_COLLABORATEUR) {
    const d = equipe.droitsDuRole(r.valeur);
    assert.ok(!d.includes('equipe'), `${r.valeur} ne doit pas gérer l’équipe`);
    assert.ok(!d.includes('fiche'), `${r.valeur} ne doit pas modifier la fiche`);
  }
});

test('chaque métier n’a que ses droits', () => {
  assert.deepEqual(equipe.droitsDuRole('stock'), ['catalogue'], 'le stock ne dépense pas en sponsorisation');
  assert.ok(!equipe.droitsDuRole('commercial').includes('catalogue'), 'le commercial ne touche pas aux prix');
  assert.ok(equipe.droitsDuRole('marketing').includes('sponsorisation'));
  assert.deepEqual(equipe.droitsDuRole('inconnu'), [], 'un rôle inventé n’a aucun droit');
  assert.equal(equipe.estRoleCollaborateur('proprietaire'), false, 'on n’invite pas un second propriétaire');
});

test('la page de retour après connexion reste interne au site', () => {
  assert.equal(cheminInterne('/equipe/invitation'), '/equipe/invitation');
  assert.equal(cheminInterne('//evil.example.com'), null);
  assert.equal(cheminInterne('https://evil.example.com'), null);
  assert.equal(cheminInterne('/\\evil.example.com'), null);
  assert.equal(cheminInterne(null), null);
});

// ── Permissions d'équipe : aucune route admin ne doit y échapper ───────────

const { readdirSync, readFileSync: lire, statSync } = require('node:fs');
const cheminNode = require('node:path');
const { PERMISSION_PAR_ROUTE, ROUTES_CONTROLE_INTERNE } = require('../src/lib/reseau/permissions-routes.ts');

function routesSous(dossier) {
  const trouvees = [];
  for (const nom of readdirSync(dossier)) {
    const plein = cheminNode.join(dossier, nom);
    if (statSync(plein).isDirectory()) trouvees.push(...routesSous(plein));
    else if (nom === 'route.ts') trouvees.push(plein);
  }
  return trouvees;
}

test('chaque gestionnaire de /api/admin applique une permission d’équipe', () => {
  const racine = cheminNode.join(__dirname, '..', 'src', 'app');
  const oublis = [];
  for (const fichier of routesSous(cheminNode.join(racine, 'api', 'admin'))) {
    const chemin = '/' + cheminNode.relative(racine, cheminNode.dirname(fichier)).split(cheminNode.sep).join('/');
    const source = lire(fichier, 'utf8');
    if (ROUTES_CONTROLE_INTERNE.includes(chemin)) {
      if (!source.includes('adminPeut(') && !source.includes('sessionAdministrateurGeneral(')) {
        oublis.push(`${chemin} (déclarée interne mais sans adminPeut ni contrôle administrateur général)`);
      }
      continue;
    }
    for (const [, methode] of source.matchAll(/export async function (GET|POST|PUT|PATCH|DELETE)\(/g)) {
      const cle = `${methode} ${chemin}`;
      if (!PERMISSION_PAR_ROUTE[cle]) oublis.push(`${cle} (absente de la table)`);
      else if (!source.includes(`refusSansPermissionAdmin(req, '${cle}')`)) oublis.push(`${cle} (contrôle non appelé)`);
    }
  }
  assert.deepEqual(oublis, [], 'Routes admin sans permission d’équipe :\n' + oublis.join('\n'));
});

test('les routes partagées qui touchent à l’argent appliquent aussi la permission', () => {
  const racine = cheminNode.join(__dirname, '..', 'src', 'app');
  for (const cle of ['POST /api/payouts/initiate', 'GET /api/orders/feed', 'POST /api/orders/sync']) {
    const chemin = cle.split(' ')[1];
    const source = lire(cheminNode.join(racine, chemin, 'route.ts'), 'utf8');
    assert.ok(source.includes(`refusSansPermissionAdmin(req, '${cle}')`), cle);
  }
});

test('un membre Support ne peut ni payer ni changer les réglages', () => {
  const support = { teamRole: 'support', permissions: [] };
  for (const cle of ['POST /api/admin/payouts', 'POST /api/payouts/initiate', 'PUT /api/admin/settings', 'POST /api/admin/products/price', 'POST /api/admin/promote']) {
    assert.equal(permissions.aLaPermission(support, PERMISSION_PAR_ROUTE[cle]), false, cle);
  }
  assert.equal(permissions.aLaPermission(support, PERMISSION_PAR_ROUTE['GET /api/admin/sav']), true);
  const finance = { teamRole: 'finance', permissions: [] };
  assert.equal(permissions.aLaPermission(finance, PERMISSION_PAR_ROUTE['POST /api/payouts/initiate']), true);
});

// ── Boutiques par quartier (2026-09-18) ────────────────────────────────────
const proximite = require('../src/lib/reseau/proximite.ts');

test('les boutiques du quartier passent avant celles des alentours, puis par distance', () => {
  const boutiques = [
    { nom: 'Loin', quartier: 'Faladié', abonnes: 900 },
    { nom: 'Voisine', quartier: 'Lafiabougou', abonnes: 1 },
    { nom: 'Ici', quartier: 'hamdallaye aci 2000', abonnes: 0 },
    { nom: 'Sans quartier', quartier: null, abonnes: 50 },
    { nom: 'Inconnu', quartier: 'Autre quartier', abonnes: 50 },
    { nom: 'Kati', quartier: 'Kati', abonnes: 50 },
  ];
  const r = proximite.classerParProximite('Hamdallaye ACI 2000', boutiques);
  assert.deepEqual(r.map((x) => x.boutique.nom), ['Ici', 'Voisine']);
  assert.equal(r[0].niveau, 'quartier');
  assert.equal(r[1].niveau, 'proche');
  assert.ok(r[1].distanceKm >= 0.5 && r[1].distanceKm <= proximite.RAYON_KM);
});

test('à distance égale, la boutique la plus suivie passe devant', () => {
  const r = proximite.classerParProximite('Missira', [
    { nom: 'A', quartier: 'Missira', abonnes: 2 },
    { nom: 'B', quartier: 'Missira', abonnes: 40 },
  ]);
  assert.deepEqual(r.map((x) => x.boutique.nom), ['B', 'A']);
});

test('un quartier non situé ne renvoie rien et n’est pas accepté', () => {
  assert.deepEqual(proximite.classerParProximite('Autre quartier', [{ quartier: 'Missira', abonnes: 1 }]), []);
  assert.equal(proximite.quartierReconnu('Autre quartier'), false);
  assert.equal(proximite.quartierReconnu(''), false);
  assert.equal(proximite.quartierReconnu('Djélibougou'), true);
});

test('le libellé de proximité reste lisible', () => {
  assert.equal(proximite.libelleProximite({ niveau: 'quartier', distanceKm: 0 }, 'Missira'), 'Dans votre quartier');
  assert.equal(proximite.libelleProximite({ niveau: 'proche', distanceKm: 1.5 }, 'Missira'), 'Missira · ~1,5 km');
});

test('les quartiers voisins excluent le quartier lui-même et sont triés par distance', () => {
  const v = proximite.quartiersVoisins('Hamdallaye ACI 2000', 3);
  assert.equal(v.length, 3);
  assert.ok(!v.includes('Hamdallaye ACI 2000'));
  assert.ok(v.includes('Lafiabougou'));
  assert.deepEqual(proximite.quartiersVoisins('Autre quartier'), []);
});
