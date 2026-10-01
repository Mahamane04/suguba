// Audit intégral du 2026-10-01 — tests de non-régression des correctifs applicatifs.
// REQ-SEC-REDIR-001, REQ-FIN-INT-006 (double validation fermée), REQ-SEC-FLOOD-001
// (plafond de commandes en attente), REQ-FIN-INT-008 (récompense non versée).
require('../scripts/test-typescript.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');

test('REDIR : seuls les chemins internes passent, y compris piégés par tabulation ou barre inversée', () => {
  const { cheminInterne } = require('../src/lib/chemin-interne.ts');
  for (const piege of ['/\t/evil.com', '/\n/evil.com', '/\\evil.com', '//evil.com', 'https://evil.com', ' /x', '']) {
    assert.equal(cheminInterne(piege), null, JSON.stringify(piege));
  }
  assert.equal(cheminInterne('/reseller/payouts?onglet=retraits#haut'), '/reseller/payouts?onglet=retraits#haut');
  assert.equal(cheminInterne('/equipe/invitation'), '/equipe/invitation');
  // apres-connexion réexporte la même règle.
  assert.equal(require('../src/lib/apres-connexion.ts').cheminInterne('/\\evil.com'), null);
});

function fauxAdmin(reponses) {
  return {
    from(table) {
      const q = { select: () => q, eq: () => q, in: () => q, maybeSingle: () => q, insert: () => q, update: () => q,
        then: (ok) => Promise.resolve(reponses[table] || { data: null, error: null }).then(ok) };
      return q;
    },
  };
}

test('DOUBLE VALIDATION : réglage illisible → opération refusée (et non plus autorisée sans contrôle)', async () => {
  const { exigerValidation } = require('../src/lib/admin/securite.ts');
  const p = { type: 'retrait', dossier: 'retrait:W1', montant: 5_000_000, resume: {}, demandeurId: 'a1' };
  const lecturePerdue = fauxAdmin({ securite_equipe: { data: null, error: { code: '57014', message: 'canceling statement due to statement timeout' } } });
  const r = await exigerValidation(lecturePerdue, p);
  assert.equal(r.ok, false);
  assert.equal(r.status, 503);
  // Table absente (SQL A3 jamais exécuté) : comportement d'origine conservé.
  const sansTable = fauxAdmin({ securite_equipe: { data: null, error: { code: 'PGRST205', message: 'Could not find the table public.securite_equipe' } } });
  assert.equal((await exigerValidation(sansTable, p)).ok, true);
});

test('COMMANDES : au-delà de 5 commandes en attente d’appel pour un même téléphone, refus 429', async () => {
  const { plafondCommandesEnAttente, MAX_COMMANDES_EN_ATTENTE } = require('../src/lib/order-create.ts');
  const avec = (n) => ({ from: () => { const q = { select: () => q, eq: () => q, then: (ok) => Promise.resolve({ count: n, error: null }).then(ok) }; return q; } });
  await plafondCommandesEnAttente(avec(MAX_COMMANDES_EN_ATTENTE - 1), '+22370000000');
  await assert.rejects(plafondCommandesEnAttente(avec(MAX_COMMANDES_EN_ATTENTE), '+22370000000'), (e) => e.status === 429);
  // Lecture impossible : on ne bloque pas un vrai client à l'aveugle.
  const enPanne = { from: () => { const q = { select: () => q, eq: () => q, then: (ok) => Promise.resolve({ count: null, error: { code: 'x' } }).then(ok) }; return q; } };
  await plafondCommandesEnAttente(enPanne, '+22370000000');
});

test('RÉCOMPENSES : un versement en échec ne dit plus « ajouté à votre solde » et remet le dossier à valider', async () => {
  const appels = [];
  const admin = {
    from(table) {
      let op = 'select'; let patch;
      const q = { select: () => q, eq: () => q, maybeSingle: () => q, update: (p) => { op = 'update'; patch = p; return q; }, insert: () => q,
        then: (ok) => {
          appels.push({ table, op, patch });
          if (table === 'mission_participants' && op === 'update' && patch.status === 'validated') return Promise.resolve({ data: { id: 'mp1', mission_id: 'm1', reseller_id: 'r1' }, error: null }).then(ok);
          if (table === 'missions') return Promise.resolve({ data: { title: 'Vendre 2', reward_amount: 5000 }, error: null }).then(ok);
          return Promise.resolve({ data: null, error: null }).then(ok);
        } };
      return q;
    },
    rpc: async (nom) => (nom === 'verser_recompense' ? { data: null, error: { code: '42501' } } : { data: null, error: null }),
  };
  require.cache[require.resolve('../src/lib/supabase-admin.ts')] = { exports: { getSupabaseAdmin: () => admin } };
  const R = require('../src/lib/reseau/recompenses.ts');
  const r = await R.deciderParticipation('mp1', 'validated');
  assert.equal(r.ok, false);
  assert.match(r.erreur, /non versée/);
  assert.ok(appels.some((a) => a.table === 'mission_participants' && a.op === 'update' && a.patch.status === 'completed'), 'remise « à valider »');
  assert.ok(!appels.some((a) => a.table === 'notifications'), 'aucune notification « ajouté à votre solde »');
});
