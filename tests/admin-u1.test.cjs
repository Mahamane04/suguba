// Admin U1 (2026-09-27) : ajouter un membre de l'équipe par e-mail, nom ou
// téléphone parmi les comptes EXISTANTS, changer son rôle, le retirer.
require('../scripts/test-typescript.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { existsSync, readFileSync } = require('node:fs');
const path = require('node:path');
const e = require('../src/lib/admin/equipe.ts');

const lire = (f) => readFileSync(path.join(__dirname, '..', f), 'utf8');

test('recherche d’un compte : e-mail, téléphone malien, nom ; saisie assainie', () => {
  assert.deepEqual(e.motifCandidat('  Awa@Exemple.COM '), { ok: true, texte: 'awa@exemple.com', type: 'email' });
  assert.deepEqual(e.motifCandidat('70 00 00 00'), { ok: true, texte: '+22370000000', type: 'telephone' });
  assert.deepEqual(e.motifCandidat('+223 70000000'), { ok: true, texte: '+22370000000', type: 'telephone' });
  assert.deepEqual(e.motifCandidat('Awa Traoré'), { ok: true, texte: 'Awa Traoré', type: 'nom' });
  const piege = e.motifCandidat('awa%,role.eq.admin)');
  assert.equal(piege.ok, true);
  assert.doesNotMatch(piege.texte, /[%,()]/, 'aucun caractère de filtre PostgREST');
  assert.equal(e.motifCandidat('aw').ok, false);
  assert.match(e.motifCandidat('7000').erreur, /8 chiffres/);
  assert.equal(e.motifCandidat('x'.repeat(81)).ok, false);
});

test('ajout : jamais soi-même, jamais deux fois, jamais un compte suspendu', () => {
  const base = { cibleId: 'p2', moiId: 'p1', statutCompte: 'active', dejaMembre: false };
  assert.equal(e.verifierAjout(base), null);
  assert.match(e.verifierAjout({ ...base, cibleId: 'p1' }), /déjà dans/);
  assert.match(e.verifierAjout({ ...base, dejaMembre: true }), /déjà partie/);
  assert.match(e.verifierAjout({ ...base, statutCompte: 'suspended' }), /suspendu/);
});

test('rôle et retrait : le dernier Super Admin est protégé, motif obligatoire', () => {
  assert.match(e.verifierChangementRole({ cibleId: 'p1', moiId: 'p1', ancienRole: 'support', nouveauRole: 'finance', superAdmins: 2 }), /propres droits/);
  assert.match(e.verifierChangementRole({ cibleId: 'p2', moiId: 'p1', ancienRole: 'super_admin', nouveauRole: 'finance', superAdmins: 1 }), /dernier Super Admin/);
  assert.equal(e.verifierChangementRole({ cibleId: 'p2', moiId: 'p1', ancienRole: 'super_admin', nouveauRole: 'finance', superAdmins: 2 }), null);
  const r = { cibleId: 'p2', moiId: 'p1', roleCible: 'support', superAdmins: 1, motif: 'Fin de contrat' };
  assert.equal(e.verifierRetrait(r), null);
  assert.match(e.verifierRetrait({ ...r, motif: 'non' }), /motif/);
  assert.match(e.verifierRetrait({ ...r, cibleId: 'p1' }), /vous-même/);
  assert.match(e.verifierRetrait({ ...r, roleCible: 'super_admin' }), /dernier Super Admin/);
});

test('après un retrait, le compte retrouve son autre profil actif, sinon client', () => {
  assert.equal(e.roleDeRepli([{ role: 'supplier', status: 'active' }, { role: 'reseller', status: 'active' }]), 'reseller');
  assert.equal(e.roleDeRepli([{ role: 'reseller', status: 'suspended' }]), 'customer');
  assert.equal(e.roleDeRepli([]), 'customer');
  assert.equal(e.libelleProfils('customer', [{ role: 'reseller', status: 'active' }, { role: 'driver', status: 'pending_approval' }]), 'Revendeur · Client');
});

test('route équipe : aucun profil créé, sessions fermées, motif journalisé', () => {
  assert.equal(existsSync(path.join(__dirname, '../src/app/api/admin/promote/route.ts')), false, 'l’ancien « Promouvoir » par téléphone est retiré');
  const src = lire('src/app/api/admin/equipe/route.ts');
  assert.doesNotMatch(src, /from\('profiles'\)\.insert|from\('profiles'\)\.upsert/, 'on ajoute un compte existant, on n’en crée jamais');
  assert.match(src, /avecJournal\(req, 'POST \/api\/admin\/equipe'/);
  assert.match(src, /adminPeut\(session\.uid, 'plateforme\.equipe'\)/);
  assert.match(src, /verifierRetrait\(/);
  assert.match(src, /verifierChangementRole\(/);
  assert.ok((src.match(/fermerSessions\(admin, profileId/g) || []).length >= 2, 'ajout et retrait ferment les sessions');
  // Retrait : les droits tombent AVANT tout le reste.
  assert.ok(src.indexOf("from('admin_team_members').delete()") < src.indexOf("update({ status: 'suspended' })"));
  const { PERMISSION_PAR_ROUTE } = require('../src/lib/reseau/permissions-routes.ts');
  assert.equal(PERMISSION_PAR_ROUTE['POST /api/admin/promote'], undefined);
});

test('page équipe : ajout en une étape, retrait avec motif dans une vraie fenêtre', () => {
  const page = lire('src/app/admin/equipe/page.tsx');
  assert.match(page, /Ajouter un membre/);
  assert.match(page, /candidats=/);
  assert.match(page, /action: 'ajouter'/);
  assert.match(page, /demander\(\{/);
  assert.doesNotMatch(page, /window\.(prompt|confirm)/);
  assert.match(lire('src/components/ui/Toast.tsx'), /demander: \(demande: DemandeTexte\) => Promise<string \| null>/);
});
