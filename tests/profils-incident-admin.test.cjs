require('../scripts/test-typescript.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { NextRequest } = require('next/server');
let writes = [];
const ticket = { id: 'incident-fictif', status: 'open', issue_description: '[Incident de course — décision équipe requise]' };
require.cache[require.resolve('../src/lib/active-session.ts')] = { exports: { verifyActiveSession: async () => ({ uid: 'admin-fictif', role: 'admin' }) } };
require.cache[require.resolve('../src/lib/reseau/permission-admin.ts')] = { exports: { refusSansPermissionAdmin: async () => null } };
require.cache[require.resolve('../src/lib/admin/journal-route.ts')] = { exports: { avecJournal: async (_req, _action, run) => run() } };
const db = { from(table) { const q = { select(fields) { assert.ok(fields.includes('issue_description')); return q; }, eq() { return q; }, maybeSingle: async () => ({ data: ticket, error: null }), update(row) { writes.push([table,row]); return { eq: async () => ({ error: null }) }; } }; return q; } };
require.cache[require.resolve('../src/lib/supabase-admin.ts')] = { exports: { getSupabaseAdmin: () => db } };
const { PATCH } = require('../src/app/api/admin/sav/route.ts');
const request = action => new NextRequest('http://localhost/api/admin/sav', { method: 'PATCH', body: JSON.stringify({ ticketId: ticket.id, action, driverId: 'livreur-fictif', notes: 'Décision équipe fictive.' }) });
test('TEST-UX-PROFILS-INCIDENT-ADMIN : incident interdit au dispatch échange, clôture sans mouvement de commande', async () => {
  writes = []; assert.equal((await PATCH(request('dispatch'))).status, 409); assert.equal(writes.length, 0);
  assert.equal((await PATCH(request('resolve'))).status, 200); assert.equal(writes.length, 1); assert.equal(writes[0][0], 'sav_tickets'); assert.equal(writes[0][1].status, 'resolved');
});
