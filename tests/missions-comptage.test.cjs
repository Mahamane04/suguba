// Missions : compteurs fiables (2026-09-26, lot 2a). Un visiteur, une preuve
// ou un parrainage ne comptent qu'une fois ; robots et missions terminées ne
// comptent pas ; une même capture ne sert qu'une fois.
require('../scripts/test-typescript.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { estRobotApercu } = require('../src/lib/reseau/missions.ts');

test('robots d’aperçu de lien : jamais comptés comme visiteurs', () => {
  for (const ua of ['WhatsApp/2.23.20.0 A', 'facebookexternalhit/1.1', 'TelegramBot (like TwitterBot)', 'Mozilla/5.0 (compatible; Googlebot/2.1)', '', null]) {
    assert.equal(estRobotApercu(ua), true, String(ua));
  }
  assert.equal(estRobotApercu('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1'), false);
  assert.equal(estRobotApercu('Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36'), false);
});

test('SQL : un événement ne compte qu’une fois, jamais hors mission active', async () => {
  const { database, sql } = require('./helpers/audit-db.cjs');
  const db = await database();
  await db.exec(sql('A-EXECUTER-2026-09-26-missions-comptage.sql'));
  await db.exec(sql('A-EXECUTER-2026-09-26-missions-comptage.sql')); // relançable
  await db.exec(`INSERT INTO public.profiles (id, phone, full_name, role) VALUES ('r1', '+22370000001', '[TEST] Revendeur', 'reseller')`);
  await db.exec(`INSERT INTO public.missions (id, title, mission_type, objective, reward_amount, status) VALUES ('m1', '[TEST] Visites', 'click', 2, 1000, 'active')`);
  await db.exec(`INSERT INTO public.mission_participants (id, mission_id, reseller_id) VALUES ('pa1', 'm1', 'r1')`);
  const compter = async (cle) => (await db.query(`SELECT public.compter_evenement_mission('pa1', $1) AS r`, [cle])).rows[0].r;

  assert.equal((await compter('visiteur:A')).compte, true);
  assert.equal((await compter('visiteur:A')).compte, false, 'même visiteur : une seule fois');
  const fin = await compter('visiteur:B');
  assert.equal(fin.progres, 2);
  const p = (await db.query(`SELECT progress, status FROM public.mission_participants WHERE id = 'pa1'`)).rows[0];
  assert.deepEqual([p.progress, p.status], [2, 'completed']);
  assert.equal((await compter('visiteur:C')).compte, false, 'objectif atteint : plus rien ne compte');

  await db.exec(`INSERT INTO public.missions (id, title, mission_type, objective, status, ends_at) VALUES ('m2', '[TEST] Finie', 'click', 5, 'active', now() - interval '1 day')`);
  await db.exec(`INSERT INTO public.mission_participants (id, mission_id, reseller_id) VALUES ('pa2', 'm2', 'r1')`);
  const r = (await db.query(`SELECT public.compter_evenement_mission('pa2', 'visiteur:A') AS r`)).rows[0].r;
  assert.deepEqual([r.compte, r.raison], [false, 'mission'], 'mission terminée');

  await db.exec(`INSERT INTO public.missions (id, title, mission_type, objective, status) VALUES ('m3', '[TEST] Partage', 'share', 3, 'active')`);
  await db.exec(`INSERT INTO public.mission_participants (id, mission_id, reseller_id) VALUES ('pa3', 'm3', 'r1')`);
  await db.exec(`INSERT INTO public.mission_proofs (mission_id, participant_id, reseller_id, canal, image_hash) VALUES ('m3', 'pa3', 'r1', 'whatsapp_statut', 'h1')`);
  await assert.rejects(db.exec(`INSERT INTO public.mission_proofs (mission_id, participant_id, reseller_id, canal, image_hash) VALUES ('m3', 'pa3', 'r1', 'facebook', 'h1')`), /unique|duplicate/i, 'même capture refusée');
  await assert.rejects(db.exec(`INSERT INTO public.mission_proofs (mission_id, participant_id, reseller_id, canal, image_hash, lien_publication) VALUES ('m3', 'pa3', 'r1', 'facebook', 'h2', 'javascript:x')`));
});
