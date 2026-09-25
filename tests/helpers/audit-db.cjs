// PostgreSQL local en mémoire. Aucun compte ou service distant.
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { PGlite } = require('@electric-sql/pglite');
const { uuid_ossp } = require('@electric-sql/pglite/contrib/uuid_ossp');
const sql = name => readFileSync(join(__dirname, '../../supabase', name), 'utf8');
async function database() {
  const db = new PGlite({ extensions: { uuid_ossp } });
  await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;');
  await db.exec(sql('schema.sql').split('-- 7. ACTIVATION WEBSOCKETS')[0]);
  for (const name of ['migration-suppliers.sql', 'migration-reseau-v1.sql', 'migration-tarification.sql', 'migration-part-revendeur.sql', 'migration-order-status.sql', 'migration-saspay.sql', 'migration-commission-safety-window.sql', 'migration-order-creation.sql', 'migration-panier.sql', 'A-EXECUTER-2026-09-24-ramassage-gps-gros-boutiques.sql', 'migration-audit-integrite.sql', 'migration-audit-paiements.sql', 'migration-audit-sms.sql', 'migration-audit-commandes.sql']) {
    try { await db.exec(sql(name)); } catch (e) { throw new Error(name + ': ' + e.message); }
  }
  await db.exec('GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;');
  return db;
}
module.exports = { database, sql };
