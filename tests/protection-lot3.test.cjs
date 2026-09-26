// Protection Suguba — lot 3 (2026-09-26) : part Suguba sous droit dédié et
// motif, comptes liés, suspension motivée, messagerie vérifiée.
require('../scripts/test-typescript.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { baissesPartSuguba, analyserMessage } = require('../src/lib/protection.ts');
const { completerReglages } = require('../src/lib/pricing.ts');
const { PERMISSIONS, permissionsDuRole } = require('../src/lib/reseau/permissions.ts');

test('part Suguba : seules les baisses demandent un motif', () => {
  const r = completerReglages({});
  assert.deepEqual(baissesPartSuguba(r, { ...r }), [], 'rien ne change');
  assert.deepEqual(baissesPartSuguba(r, { ...r, fraisLivraisonClient: 0, arrondiPrix: 500 }), [], 'livraison, arrondi : sans effet sur la part');
  assert.deepEqual(baissesPartSuguba(r, { ...r, margeNetteMinPct: r.margeNetteMinPct + 1 }), [], 'une hausse passe');
  const cles = (apres) => baissesPartSuguba(r, apres).map((b) => b.cle);
  assert.deepEqual(cles({ ...r, margeNetteMinPct: 0 }), r.margeNetteMinPct > 0 ? ['margeNetteMinPct'] : []);
  assert.deepEqual(cles({ ...r, partRevendeurPct: r.partRevendeurPct + 10 }), ['partRevendeurPct']);
  assert.deepEqual(cles({ ...r, tauxPartSuguba: 0 }), r.tauxPartSuguba > 0 ? ['tauxPartSuguba'] : []);
  assert.deepEqual(cles({ ...r, codesPromo: [...r.codesPromo, { code: 'LANCEMENT', remise: 1000, actif: true }] }), ['codePromo.LANCEMENT']);
  assert.deepEqual(cles({ ...r, codesPromo: [...r.codesPromo, { code: 'OFF', remise: 1000, actif: false }] }), [], 'code inactif');
  assert.deepEqual(cles({ ...r, prixDeGros: { ...r.prixDeGros, modeGain: 'aucun' } }), r.prixDeGros.modeGain !== 'aucun' ? ['prixDeGros.modeGain'] : []);
  assert.ok(PERMISSIONS.includes('marge.reduire'));
  assert.ok(permissionsDuRole('super_admin').includes('marge.reduire'));
  assert.equal(permissionsDuRole('finance').includes('marge.reduire'), false, 'pas donné par défaut à la finance');
});

test('messagerie : numéros, liens, e-mails et contournement vérifiés ; références techniques libres', () => {
  for (const t of ['Appelez le 76 12 34 56', 'mon numéro +223 70123456', '00223 66-55-44-33', 'Contact : 91.23.45.67',
    'écrivez sur WhatsApp', 'Payez directement sur mon Orange Money direct', 'voir wa.me/22370000000', 'infos@exemple.com', 'https://monsite.ml']) {
    assert.ok(analyserMessage(t).length > 0, t);
  }
  for (const t of ['Disponible en 12V 200Ah ?', 'Référence SN-AB12345678', 'Le modèle 7000W est livré sous 48 h', 'Code article 12345678', 'Oui, garanti 2 ans']) {
    assert.deepEqual(analyserMessage(t), [], t);
  }
  assert.deepEqual(analyserMessage('Mon numéro : 76123456').sort(), ['contournement', 'telephone']);
});

test('SQL : sans la table de l’équipe fournisseur (base de production), le SQL passe et le même numéro reste refusé', async () => {
  const { database, sql } = require('./helpers/audit-db.cjs');
  const db = await database();
  await db.exec(sql('A-EXECUTER-2026-09-26-protection-lot3.sql'));
  await db.exec(`INSERT INTO public.profiles (id, phone, full_name, role) VALUES
    ('f1', '+22370000002', '[TEST] Fournisseur', 'supplier'), ('r2', '70 00 00 02', '[TEST] Même numéro', 'reseller'), ('r1', '+22370000003', '[TEST] Revendeur', 'reseller');
    INSERT INTO public.missions (id, title, mission_type, objective, reward_amount, supplier_id) VALUES ('c1', '[TEST] Campagne', 'share', 1, 1000, 'f1');`);
  await assert.rejects(db.exec(`INSERT INTO public.mission_participants (mission_id, reseller_id) VALUES ('c1', 'r2')`), /COMPTE_LIE/);
  await db.exec(`INSERT INTO public.mission_participants (mission_id, reseller_id) VALUES ('c1', 'r1')`);
});

test('SQL : comptes liés exclus des campagnes, journal immuable, une suspension en cours par rôle', async () => {
  const { database, sql } = require('./helpers/audit-db.cjs');
  const db = await database();
  for (const f of ['migration-equipe-fournisseur.sql', 'A-EXECUTER-2026-09-26-protection-lot3.sql', 'A-EXECUTER-2026-09-26-protection-lot3.sql']) {
    try { await db.exec(sql(f)); } catch (e) { throw new Error(`${f}: ${e.message}`); }
  }
  await db.exec(`INSERT INTO public.profiles (id, phone, full_name, role) VALUES
    ('f1', '+22370000002', '[TEST] Fournisseur', 'supplier'),
    ('r1', '+22370000003', '[TEST] Revendeur', 'reseller'),
    ('r2', '70 00 00 02', '[TEST] Même numéro', 'reseller'),
    ('r3', '+22370000009', '[TEST] Équipier', 'reseller');
    INSERT INTO public.supplier_members (supplier_id, member_id, invited_phone, member_role, status) VALUES ('f1', 'r3', '+22370000009', 'commercial', 'active');
    INSERT INTO public.missions (id, title, mission_type, objective, reward_amount, supplier_id) VALUES ('c1', '[TEST] Campagne', 'share', 1, 1000, 'f1');
    INSERT INTO public.missions (id, title, mission_type, objective, reward_amount) VALUES ('m1', '[TEST] Mission Suguba', 'share', 1, 1000);`);
  await db.exec(`INSERT INTO public.mission_participants (mission_id, reseller_id) VALUES ('c1', 'r1')`);
  await assert.rejects(db.exec(`INSERT INTO public.mission_participants (mission_id, reseller_id) VALUES ('c1', 'r2')`), /COMPTE_LIE/, 'même numéro');
  await assert.rejects(db.exec(`INSERT INTO public.mission_participants (mission_id, reseller_id) VALUES ('c1', 'r3')`), /COMPTE_LIE/, 'équipe');
  await assert.rejects(db.exec(`INSERT INTO public.mission_participants (mission_id, reseller_id) VALUES ('c1', 'f1')`), /COMPTE_LIE/, 'même compte');
  await db.exec(`INSERT INTO public.mission_participants (mission_id, reseller_id) VALUES ('m1', 'r2')`); // mission Suguba : pas de fournisseur

  await db.exec(`INSERT INTO public.journal_part_suguba (admin_id, motif, changements) VALUES ('a1', 'Lancement Tabaski', '[]')`);
  await assert.rejects(db.exec(`UPDATE public.journal_part_suguba SET motif = 'autre chose'`), /JOURNAL_IMMUABLE/);
  await assert.rejects(db.exec(`DELETE FROM public.journal_part_suguba`), /JOURNAL_IMMUABLE/);
  await assert.rejects(db.exec(`INSERT INTO public.journal_part_suguba (admin_id, motif, changements) VALUES ('a1', 'ok', '[]')`), 'motif trop court');

  await db.exec(`INSERT INTO public.suspensions (profile_id, role, motif, suspendu_par) VALUES ('r1', 'reseller', 'Fraude aux clics', 'a1')`);
  await assert.rejects(db.exec(`INSERT INTO public.suspensions (profile_id, role, motif, suspendu_par) VALUES ('r1', 'reseller', 'Deuxième fois', 'a1')`), /duplicate|unique/);
  await db.exec(`UPDATE public.suspensions SET levee_le = now() WHERE profile_id = 'r1'`);
  await db.exec(`INSERT INTO public.suspensions (profile_id, role, motif, suspendu_par) VALUES ('r1', 'reseller', 'Récidive constatée', 'a1')`);

  await db.exec(`INSERT INTO public.conversations (id, sujet_type, sujet_id, fournisseur_id, revendeur_id) VALUES ('00000000-0000-0000-0000-000000000001', 'offre', 'p1', 'f1', 'r1')`);
  await assert.rejects(db.exec(`INSERT INTO public.conversations (sujet_type, sujet_id, fournisseur_id, revendeur_id) VALUES ('offre', 'p1', 'f1', 'r1')`), /duplicate|unique/, 'un fil par dossier');
  await assert.rejects(db.exec(`INSERT INTO public.messages (conversation_id, auteur_type, texte) VALUES ('00000000-0000-0000-0000-000000000001', 'revendeur', '   ')`), 'message vide');
});
