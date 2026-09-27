// Admin A3 (2026-09-27) : double authentification de l'équipe, déconnexion
// à distance, double validation (une personne prépare, une autre approuve).
require('../scripts/test-typescript.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const r = require('../src/lib/admin/securite-regles.ts');

test('double authentification : qui doit saisir un code, qui doit l’activer', () => {
  assert.equal(r.decisionMfa({ estMembre: false, facteursVerifies: 0, aal: 'aal1', obligatoire: true }), 'ok', 'hors équipe : jamais');
  assert.equal(r.decisionMfa({ estMembre: true, facteursVerifies: 1, aal: 'aal1', obligatoire: false }), 'verifier', 'activée : code à chaque connexion');
  assert.equal(r.decisionMfa({ estMembre: true, facteursVerifies: 1, aal: 'aal2', obligatoire: false }), 'ok');
  assert.equal(r.decisionMfa({ estMembre: true, facteursVerifies: 0, aal: 'aal1', obligatoire: true }), 'inscrire', 'obligatoire : activation imposée');
  assert.equal(r.decisionMfa({ estMembre: true, facteursVerifies: 0, aal: 'aal1', obligatoire: false }), 'ok');
});

test('jeton : niveau d’assurance lu, jeton illisible = aucun', () => {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  assert.equal(r.aalDuJeton(`${b64({ alg: 'HS256' })}.${b64({ sub: 'u1', aal: 'aal2' })}.sig`), 'aal2');
  assert.equal(r.aalDuJeton('pas-un-jeton'), null);
  assert.equal(r.aalDuJeton('a.%%%.b'), null);
});

test('déconnexion à distance : les sessions émises avant sont refusées', () => {
  const iat = Math.floor(Date.parse('2026-09-27T10:00:00Z') / 1000);
  assert.equal(r.sessionRevoquee(iat, '2026-09-27T11:00:00Z'), true);
  assert.equal(r.sessionRevoquee(iat, '2026-09-27T09:00:00Z'), false, 'reconnexion après la révocation : acceptée');
  assert.equal(r.sessionRevoquee(iat, null), false);
});

test('double validation : seuil, part Suguba, empreinte stable', () => {
  assert.equal(r.validationRequise('retrait', 150000, 0), false, 'seuil 0 = désactivée');
  assert.equal(r.validationRequise('retrait', 99999, 100000), false);
  assert.equal(r.validationRequise('retrait', 100000, 100000), true);
  assert.equal(r.validationRequise('part_suguba', null, 1), true, 'baisse de part : dès que la double validation est active');
  assert.equal(r.jsonStable({ b: 1, a: [2, { d: 1, c: 2 }] }), '{"a":[2,{"c":2,"d":1}],"b":1}');
  const { empreinteOperation } = require('../src/lib/admin/securite.ts');
  const base = { type: 'retrait', dossier: 'retrait:R1', montant: 150000, resume: { telephone: '+22370000000' } };
  assert.equal(empreinteOperation(base), empreinteOperation({ ...base, resume: { telephone: '+22370000000' } }));
  assert.notEqual(empreinteOperation(base), empreinteOperation({ ...base, montant: 150001 }), 'montant changé : autre opération');
  assert.notEqual(empreinteOperation(base), empreinteOperation({ ...base, resume: { telephone: '+22379999999' } }), 'bénéficiaire changé');
});

/** Petit faux client Supabase : juste ce qu'utilise exigerValidation. */
function fauxClient(etat) {
  return {
    from(table) {
      if (table === 'securite_equipe') {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { mfa_obligatoire: false, seuil_validation: etat.seuil }, error: null }) }) }) };
      }
      const t = etat.validations;
      return {
        select() {
          const f = {};
          const q = {
            eq(c, v) { f[c] = v; return q; },
            in(c, vs) { f[c] = vs; return q; },
            maybeSingle: async () => ({ data: t.find((x) => x.type === f.type && x.dossier === f.dossier && f.statut.includes(x.statut)) || null, error: null }),
          };
          return q;
        },
        update(v) { return { eq: async (c, id) => { t.filter((x) => x.id === id).forEach((x) => Object.assign(x, v)); return { error: null }; } }; },
        insert(ligne) {
          const cree = { ...ligne, id: `v${t.length + 1}`, statut: 'en_attente' };
          t.push(cree);
          return { select: () => ({ maybeSingle: async () => ({ data: { id: cree.id }, error: null }) }) };
        },
      };
    },
  };
}

test('double validation : demande, attente, approbation, opération changée', async () => {
  const { exigerValidation } = require('../src/lib/admin/securite.ts');
  const etat = { seuil: 100000, validations: [] };
  const a = fauxClient(etat);
  const op = (montant) => ({ type: 'retrait', dossier: 'retrait:R1', montant, resume: { telephone: '+22370000000' }, demandeurId: 'm1' });

  assert.deepEqual(await exigerValidation(a, op(50000)), { ok: true, validationId: null }, 'sous le seuil');

  const r1 = await exigerValidation(a, op(150000));
  assert.equal(r1.ok, false);
  assert.equal(r1.status, 409, 'jamais 2xx : les écrans prendraient ça pour un succès');
  assert.equal(r1.corps.validationRequise, true);
  assert.equal(etat.validations.length, 1);

  const r2 = await exigerValidation(a, op(150000));
  assert.equal(r2.ok, false);
  assert.equal(etat.validations.length, 1, 'pas de doublon de demande');

  etat.validations[0].statut = 'approuvee';
  const r3 = await exigerValidation(a, op(150000));
  assert.deepEqual(r3, { ok: true, validationId: 'v1' }, 'approuvée par un collègue : l’opération passe');

  const r4 = await exigerValidation(a, op(160000));
  assert.equal(r4.ok, false, 'montant changé après approbation : nouvelle demande');
  assert.equal(etat.validations[0].statut, 'caduque');
  assert.equal(etat.validations[1].statut, 'en_attente');
});

test('SQL A3 : approuver sa propre demande est impossible, décisions définitives', async () => {
  const { database, sql } = require('./helpers/audit-db.cjs');
  const db = await database();
  await db.exec(sql('A-EXECUTER-2026-09-27-admin-a3.sql'));
  await db.exec(sql('A-EXECUTER-2026-09-27-admin-a3.sql'));
  const e = 'a'.repeat(64);
  await db.exec(`INSERT INTO public.validations_admin (id, type, dossier, montant, empreinte, demandeur_id) VALUES ('00000000-0000-0000-0000-000000000001', 'retrait', 'retrait:R1', 150000, '${e}', 'm1')`);
  await assert.rejects(db.exec(`UPDATE public.validations_admin SET statut = 'approuvee', decideur_id = 'm1'`), 'quatre yeux');
  await assert.rejects(db.exec(`INSERT INTO public.validations_admin (type, dossier, empreinte, demandeur_id) VALUES ('retrait', 'retrait:R1', '${e}', 'm2')`), 'une seule demande ouverte par dossier');
  await db.exec(`UPDATE public.validations_admin SET statut = 'refusee', decideur_id = 'm2', motif_decision = 'Bénéficiaire douteux'`);
  await assert.rejects(db.exec(`UPDATE public.validations_admin SET statut = 'approuvee'`), /VALIDATION_CLOSE/);
  await assert.rejects(db.exec(`UPDATE public.securite_equipe SET seuil_validation = -1`));
  const reg = (await db.query(`SELECT mfa_obligatoire, seuil_validation FROM public.securite_equipe`)).rows[0];
  assert.deepEqual(reg, { mfa_obligatoire: false, seuil_validation: 0 }, 'par défaut : rien d’obligatoire, double validation désactivée');
});

test('branchements : connexion, sessions, opérations sensibles', () => {
  const lire = (f) => readFileSync(require.resolve(f), 'utf8');
  const echange = lire('../src/app/api/auth/supabase-exchange/route.ts');
  assert.match(echange, /decisionMfa\(/);
  assert.match(echange, /needsMfa: decision/);
  assert.ok(echange.indexOf('needsMfa: decision') < echange.indexOf('createSessionToken({'), 'aucune session avant la double authentification');
  assert.match(lire('../src/lib/active-session.ts'), /sessionRevoquee\(session\.iat/);
  for (const f of ['../src/app/api/payouts/initiate/route.ts', '../src/app/api/admin/payouts/route.ts', '../src/app/api/admin/unlock-commission/route.ts', '../src/app/api/admin/settings/route.ts']) {
    const src = lire(f);
    assert.match(src, /exigerValidation\(/, f);
    assert.match(src, /marquerExecutee\(/, `${f} : validation consommée après succès`);
  }
  const val = lire('../src/app/api/admin/validations/route.ts');
  assert.match(val, /v\.demandeur_id === session\.uid/, 'jamais sa propre demande');
  assert.match(lire('../src/app/auth/callback/page.tsx'), /json\.needsMfa/);
});
