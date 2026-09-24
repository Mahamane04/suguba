// Guide des parcours (docs/guide/guide.json) : cohérence et exhaustivité.
// Ces tests échouent quand une page est ajoutée à l'application sans être
// décrite dans le guide — c'est ce qui garantit qu'il reste à jour.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const RACINE = path.join(__dirname, '..');
const guide = JSON.parse(fs.readFileSync(path.join(RACINE, 'docs', 'guide', 'guide.json'), 'utf8'));
const CAPTURES = path.join(RACINE, 'docs', 'guide', 'captures');
const ids = new Set(guide.pages.map((p) => p.id));

// Pages de l'application volontairement absentes du guide (voir « À savoir »).
const HORS_GUIDE = new Set([
  '/auth/callback',            // retour technique de la connexion Google
  '/boutique/*',               // aucune boutique réseau en base pour l'instant
  '/order-success/*',          // exige une vraie commande
  '/track/*',                  // exige une vraie commande
  '/r/*',                      // lien court qui redirige
  '/reseller/story-generator', // redirige vers /reseller/marketing
]);

function pagesDeLApplication(dossier = path.join(RACINE, 'src', 'app')) {
  const trouvees = [];
  for (const nom of fs.readdirSync(dossier)) {
    const plein = path.join(dossier, nom);
    if (fs.statSync(plein).isDirectory()) { if (nom !== 'api') trouvees.push(...pagesDeLApplication(plein)); }
    else if (nom === 'page.tsx') {
      const route = '/' + path.relative(path.join(RACINE, 'src', 'app'), dossier).split(path.sep).join('/');
      trouvees.push(route === '/' ? '/' : route.replace(/\/$/, '').replace(/\[[^\]]+\]/g, '*'));
    }
  }
  return trouvees;
}
const cheminNormalise = (c) => c.split(/[\s?]/)[0].replace(/<[^>]+>/g, '*');

test('chaque page de l’application est décrite dans le guide', () => {
  const decrites = new Set(guide.pages.map((p) => cheminNormalise(p.chemin)));
  const oubliees = pagesDeLApplication().filter((r) => !decrites.has(r) && !HORS_GUIDE.has(r));
  assert.deepEqual(oubliees, [], `Pages absentes du guide : ${oubliees.join(', ')} — ajoutez-les à docs/guide/guide.json`);
});

test('identifiants uniques et liens internes valides', () => {
  assert.equal(ids.size, guide.pages.length, 'identifiant de page en double');
  const cibles = [
    ...guide.pages.flatMap((p) => p.suite.map((s) => s.id)),
    ...guide.journal.flatMap((j) => j.pages),
    ...guide.parcours.flatMap((p) => p.etapes.map((e) => e.page).filter(Boolean)),
  ];
  const cassees = cibles.filter((c) => !ids.has(c));
  assert.deepEqual([...new Set(cassees)], [], 'liens vers des pages inexistantes');
  const roles = new Set(guide.roles.map((r) => r.cle));
  assert.ok(guide.pages.every((p) => roles.has(p.role)), 'profil inconnu');
});

test('chaque capture annoncée existe, et aucune capture n’est orpheline', () => {
  const attendues = guide.pages.filter((p) => p.capture).map((p) => p.id);
  const manquantes = attendues.filter((id) => !fs.existsSync(path.join(CAPTURES, `${id}.jpg`)));
  assert.deepEqual(manquantes, [], 'captures manquantes');
  const orphelines = fs.readdirSync(CAPTURES).filter((f) => f.endsWith('.jpg')).map((f) => f.slice(0, -4))
    .filter((id) => !attendues.includes(id));
  assert.deepEqual(orphelines, [], 'captures sans page');
  assert.ok(guide.pages.filter((p) => !p.capture).every((p) => p.note), 'une page sans capture doit expliquer pourquoi (note)');
});

test('le journal confronte chaque demande à ce qui a été livré', () => {
  assert.ok(guide.journal.length > 0);
  for (const j of guide.journal) {
    assert.match(j.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(j.titre && j.demande && j.demande.length > 20, `demande manquante : ${j.titre}`);
    assert.ok(Array.isArray(j.realise) && j.realise.length > 0, `réalisé manquant : ${j.titre}`);
    assert.ok(Array.isArray(j.ecarts), `écarts manquants : ${j.titre}`);
    assert.ok(['en ligne', 'en local'].includes(j.statut));
  }
  const dates = guide.journal.map((j) => j.date);
  assert.deepEqual(dates, [...dates].sort().reverse(), 'journal : la plus récente en premier');
  assert.ok(guide.majLe >= dates[0], 'majLe doit suivre la dernière entrée du journal');
});
