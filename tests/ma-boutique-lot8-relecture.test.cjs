// TEST-BOUTIQUE-LOT8-030..044 (chantier boutique du revendeur, 2026-10-03,
// relecture du lot 8 « Adresse à l'enseigne et contact ») :
//  - « une ancienne adresse n'est jamais redonnée » est garanti par la BASE
//    (déclencheur stores_ancienne_adresse_reservee), plus seulement par le code :
//    un changement d'adresse validé entre la lecture des anciennes adresses et la
//    création d'une boutique ne lui donne plus l'ancienne adresse d'une autre ;
//  - réponse du changement perdue (réseau coupé au mauvais moment) : l'écran relit
//    l'état au serveur et suit, au lieu d'annoncer un échec puis « déjà changé » ;
//  - une adresse refusée par le serveur n'est plus montrée comme celle que « vos
//    clients ouvriront » ;
//  - démarrage : l'aide ne dit plus que l'adresse « ne changera plus » ;
//  - bulle du support : boutons du design system, cibles de 44 px, fermeture nommée ;
//  - guide : la bulle est décrite aussi sur /s/<boutique> et /rejoindre.
// Supabase, la session et les cookies sont SIMULÉS (require.cache). Deux bases :
// une base en mémoire (routes, écran), et un PostgreSQL LOCAL en mémoire (PGlite)
// où s'exécute le VRAI fichier SQL. Aucune base réelle, aucun réseau.
require('../scripts/test-typescript.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const RESEAU_INTERDIT = async () => { throw Error('Réseau externe interdit dans les tests'); };
global.fetch = RESEAU_INTERDIT;
const RACINE = path.join(__dirname, '..');
const lire = (f) => fs.readFileSync(path.join(RACINE, f), 'utf8');
const sansCommentaires = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const SQL = 'A-EXECUTER-2026-10-03-vitrine-boutique.sql';
const DECLENCHEUR = 'stores_ancienne_adresse_reservee';

// ── Base simulée en mémoire (routes et écran) ───────────────────────────────
let etat; let fautes; let operations; let serie;
function reinitialiser() {
  etat = { stores: [], store_slug_aliases: [], profiles: [], profile_roles: [] };
  fautes = {}; operations = []; serie = 1;
}
/** Miroir de la fonction SQL changer_adresse_boutique (la vraie est exercée sous PGlite, plus bas). */
function changerAdresseSimulee({ p_store_id: id, p_owner_id: proprietaire, p_nouveau: brut }) {
  const nouveau = brut == null ? null : String(brut).trim().toLowerCase();
  if (nouveau === null || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(nouveau) || nouveau.length < 3 || nouveau.length > 50) return 'invalide';
  const boutique = etat.stores.find((s) => s.id === id && s.owner_id === proprietaire);
  if (!boutique) return 'introuvable';
  if (boutique.slug.toLowerCase() === nouveau) return 'identique';
  if (etat.store_slug_aliases.some((a) => a.store_id === id)) return 'deja_change';
  if (etat.stores.some((s) => s.slug.toLowerCase() === nouveau) || etat.store_slug_aliases.some((a) => a.slug === nouveau)) return 'pris';
  etat.store_slug_aliases.push({ slug: boutique.slug.toLowerCase(), store_id: id, created_at: new Date().toISOString() });
  boutique.slug = nouveau;
  return 'ok';
}
const comparer = (a, b) => (String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0);
const db = {
  from(table) {
    let op = 'select'; let patch; const filtres = []; let un = false; let limite = null; let tri = null;
    const q = {
      select() { return q; },
      eq(k, v) { filtres.push((r) => r[k] === v); return q; },
      in(k, v) { filtres.push((r) => v.includes(r[k])); return q; },
      ilike(k, v) { filtres.push((r) => String(r[k]).toLowerCase() === String(v).toLowerCase()); return q; },
      is(k, v) { filtres.push((r) => (v === null ? r[k] == null : r[k] === v)); return q; },
      order(k, o) { tri = { k, asc: !o || o.ascending !== false }; return q; },
      limit(n) { limite = n; return q; },
      insert(p) { op = 'insert'; patch = p; return q; },
      update(p) { op = 'update'; patch = p; return q; },
      maybeSingle() { un = true; return q; },
      then(resolve, reject) {
        operations.push({ table, op, patch });
        const repondre = (r) => Promise.resolve(r).then(resolve, reject);
        const faute = fautes[`${table}:${op}`];
        if (faute) return repondre({ data: null, error: { code: faute, message: `faute simulée ${faute}` } });
        let lignes = (etat[table] || []).filter((r) => filtres.every((f) => f(r)));
        if (tri) lignes = [...lignes].sort((a, b) => comparer(a[tri.k], b[tri.k]) * (tri.asc ? 1 : -1));
        if (op === 'insert') {
          lignes = (Array.isArray(patch) ? patch : [patch]).map((p) => ({ id: `n${serie++}`, status: 'active', ...p }));
          (etat[table] ||= []).push(...lignes);
        }
        if (op === 'update') lignes.forEach((r) => Object.assign(r, JSON.parse(JSON.stringify(patch))));
        if (limite !== null && op === 'select') lignes = lignes.slice(0, limite);
        return repondre({ data: un ? (lignes[0] ? { ...lignes[0] } : null) : lignes.map((r) => ({ ...r })), error: null });
      },
    };
    return q;
  },
  async rpc(nom, args) {
    operations.push({ table: `rpc:${nom}`, op: 'rpc', patch: args });
    const faute = fautes[`rpc:${nom}`];
    if (faute) return { data: null, error: { code: faute, message: `faute simulée ${faute}` } };
    return { data: nom === 'changer_adresse_boutique' ? changerAdresseSimulee(args) : null, error: null };
  },
};
let baseCourante = db;
require.cache[require.resolve('../src/lib/supabase-admin.ts')] = { exports: { getSupabaseAdmin: () => baseCourante } };

/**
 * Le client Supabase, branché sur un PostgreSQL local (PGlite) : les lectures, les
 * insertions et l'appel de fonction que font boutiques.ts et boutiques-multiples.ts,
 * traduits en SQL. Les erreurs gardent le code de Postgres (23505…).
 *
 * `apresLectureDesAnciennes` rejoue l'enchaînement du constat : il s'exécute UNE
 * fois, juste après la lecture des anciennes adresses (adressesDejaPortees, la
 * seule à filtrer par liste) et donc AVANT l'insertion qui suit — c'est l'instant
 * où le changement d'adresse d'une autre boutique est validé.
 */
function clientSql(pg, { apresLectureDesAnciennes } = {}) {
  let entreLesDeux = apresLectureDesAnciennes || null;
  const executer = async (texte, valeurs) => {
    try { return { rows: (await pg.query(texte, valeurs)).rows, error: null }; }
    catch (e) { return { rows: null, error: { code: e.code || 'XX000', message: e.message } }; }
  };
  return {
    from(table) {
      let op = 'select'; let patch; const ou = []; const valeurs = []; let un = false; let limite = null; let tri = null; let parListe = false;
      const p = (v) => { valeurs.push(v); return `$${valeurs.length}`; };
      const q = {
        select() { return q; },
        eq(k, v) { ou.push(`${k} = ${p(v)}`); return q; },
        ilike(k, v) { ou.push(`${k} ILIKE ${p(v)}`); return q; },
        in(k, v) { parListe = true; ou.push(v.length ? `${k} IN (${v.map(p).join(', ')})` : 'false'); return q; },
        order(k, o) { tri = `${k} ${o && o.ascending === false ? 'DESC' : 'ASC'}`; return q; },
        limit(n) { limite = n; return q; },
        insert(l) { op = 'insert'; patch = l; return q; },
        maybeSingle() { un = true; return q; },
        then(resolve, reject) {
          const requete = op === 'insert'
            ? `INSERT INTO public.${table} (${Object.keys(patch).join(', ')}) VALUES (${Object.values(patch).map(p).join(', ')}) RETURNING *`
            : `SELECT * FROM public.${table}${ou.length ? ` WHERE ${ou.join(' AND ')}` : ''}${tri ? ` ORDER BY ${tri}` : ''}${limite !== null ? ` LIMIT ${limite}` : ''}`;
          return executer(requete, valeurs).then(async ({ rows, error }) => {
            if (entreLesDeux && table === 'store_slug_aliases' && op === 'select' && parListe) {
              const validerAilleurs = entreLesDeux; entreLesDeux = null;
              await validerAilleurs();
            }
            if (error) return { data: null, error };
            if (!un) return { data: rows, error: null };
            return rows.length > 1 ? { data: null, error: { code: 'PGRST116', message: 'plusieurs lignes' } } : { data: rows[0] || null, error: null };
          }).then(resolve, reject);
        },
      };
      return q;
    },
    async rpc(nom, args) {
      const cles = Object.keys(args);
      const { rows, error } = await executer(`SELECT public.${nom}(${cles.map((k, i) => `${k} => $${i + 1}`).join(', ')}) AS r`, cles.map((k) => args[k]));
      return error ? { data: null, error } : { data: rows[0].r, error: null };
    },
  };
}

let sessionCourante = null;
require.cache[require.resolve('../src/lib/active-session.ts')] = { exports: { verifyActiveSession: async () => sessionCourante } };
let chemin = '/';
require.cache[require.resolve('next/navigation')] = {
  exports: { usePathname: () => chemin, useRouter: () => ({ push() {}, replace() {}, refresh() {} }), useSearchParams: () => new URLSearchParams('') },
};
require.cache[require.resolve('next/link')] = {
  exports: { __esModule: true, default: ({ href, prefetch, children, ...reste }) => React.createElement('a', { href, ...reste }, children) },
};
// Messages et confirmations : enregistrés ; la confirmation répond `reponseConfirmation`.
let messages = []; let confirmations = []; let reponseConfirmation = true;
require.cache[require.resolve('../src/components/ui/Toast.tsx')] = {
  exports: { __esModule: true, useToast: () => ({ toast(texte, options) { messages.push([texte, options]); }, demander: async () => null, confirmer: async (d) => { confirmations.push(d); return reponseConfirmation; } }) },
};

const { NextRequest } = require('next/server');
const ROUTE_ADRESSE = '../src/app/api/reseller/boutique/adresse/route.ts';
const requete = (url, init = {}) => new NextRequest(`http://localhost${url}`, {
  ...init, headers: { cookie: 'suguba_session=simule', 'content-type': 'application/json', ...(init.headers || {}) },
});

/**
 * Awa (rev-1) : boutique « Awa Mode » à l'adresse awa-traore-diallo (son nom complet,
 * attribuée au premier accès). Moussa (rev-2) : « Chez Moussa ». Le SQL du chantier
 * est exécuté (table des anciennes adresses, fonction du changement).
 */
function baseAwa() {
  reinitialiser();
  etat.stores = [
    { id: 's1', owner_type: 'reseller', owner_id: 'rev-1', slug: 'awa-traore-diallo', name: 'Awa Mode', status: 'active', principale: true, created_at: '2026-09-01T00:00:00Z', reglages: {} },
    { id: 's2', owner_type: 'reseller', owner_id: 'rev-2', slug: 'chez-moussa', name: 'Chez Moussa', status: 'active', principale: true, created_at: '2026-09-02T00:00:00Z', reglages: {} },
  ];
  baseCourante = db;
  sessionCourante = { uid: 'rev-1', phone: '+22300000000', role: 'reseller', status: 'active', roles: { reseller: 'active' }, iat: 1, exp: 9e9 };
  messages = []; confirmations = []; reponseConfirmation = true;
}

// ── Écran : crochets React simulés pour la section, état d'ouverture pour la bulle ──
// Pas de DOM dans node:test : la section est appelée comme une fonction, avec des
// crochets React SIMULÉS pour elle seule (état gardé entre deux appels). Ses appels
// réseau arrivent à la VRAIE route. La bulle, elle, est rendue par React ; seul son
// état « menu ouvert » est imposé.
const SECTION_ADRESSE = path.join(RACINE, 'src/components/reseau/AdresseBoutique.tsx');
const BULLE = path.join(RACINE, 'src/components/common/WhatsAppFloatingButton.tsx');
let crochets = null;
const reactSection = { ...React, __esModule: true, default: React, useState: (init) => crochets.useState(init) };
let bulleOuverte = null;
const reactBulle = { ...React, __esModule: true, default: React, useState: (init) => (bulleOuverte === null ? React.useState(init) : [bulleOuverte, () => {}]) };
const chargerOriginal = Module._load;
Module._load = function (demande, parent, ...reste) {
  if (demande === 'react' && parent && parent.filename === SECTION_ADRESSE) return reactSection;
  if (demande === 'react' && parent && parent.filename === BULLE) return reactBulle;
  return chargerOriginal.call(this, demande, parent, ...reste);
};
function trouver(noeud, critere, resultats = []) {
  if (Array.isArray(noeud)) { noeud.forEach((n) => trouver(n, critere, resultats)); return resultats; }
  if (!noeud || typeof noeud !== 'object' || !noeud.props) return resultats;
  if (critere(noeud)) resultats.push(noeud);
  trouver(noeud.props.children, critere, resultats);
  return resultats;
}
const texteDe = (element) => renderToStaticMarkup(element).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
/** La section d'Awa, sur une page qui croit encore à l'adresse awa-traore-diallo. */
function monterSection(changements, proprietes = {}) {
  const valeurs = []; const setters = []; let curseur = 0;
  const mesCrochets = {
    useState(init) {
      const k = curseur++;
      if (!(k in valeurs)) valeurs[k] = typeof init === 'function' ? init() : init;
      setters[k] ||= (v) => { valeurs[k] = typeof v === 'function' ? v(valeurs[k]) : v; };
      return [valeurs[k], setters[k]];
    },
  };
  const Composant = require(SECTION_ADRESSE).default;
  const props = { origine: 'https://app.sugubaml.com', actuelle: 'awa-traore-diallo', ancienne: null, nomPublic: 'Awa Mode', onChange: (...a) => changements.push(a), ...proprietes };
  const rendre = () => { crochets = mesCrochets; curseur = 0; return Composant(props); };
  const bouton = () => trouver(rendre(), (e) => typeof e.type === 'function' && e.type.name === 'Button' && texteDe(e) === 'Changer mon adresse')[0];
  return {
    rendre,
    html: () => renderToStaticMarkup(rendre()),
    ecrire: (texte) => trouver(rendre(), (e) => e.props.id === 'adresse-boutique')[0].props.onChange({ target: { value: texte } }),
    changer: () => bouton().props.onClick(),
    enCours: () => bouton().props.loading,
    erreur: () => trouver(rendre(), (e) => typeof e.type === 'function' && e.type.name === 'Field' && e.props.htmlFor === 'adresse-boutique')[0].props.erreur,
  };
}
/**
 * fetch du navigateur → la vraie route, avec la session simulée. `regle` décide du
 * sort de chaque appel : par défaut il aboutit ; elle peut l'exécuter PUIS perdre
 * la réponse (le serveur a travaillé, le téléphone n'en sait rien), ou le couper.
 */
function brancher(appels, regle = (_methode, _url, executer) => executer()) {
  global.fetch = async (url, init = {}) => {
    const methode = init.method || 'GET';
    appels.push([methode, String(url), init.body ?? null]);
    const executer = async () => {
      assert.equal(String(url).split('?')[0], '/api/reseller/boutique/adresse', `appel inattendu : ${url}`);
      const r = await require(ROUTE_ADRESSE)[methode](requete(String(url), { method: methode, ...(init.body ? { body: init.body } : {}) }));
      return { ok: r.status >= 200 && r.status < 300, status: r.status, json: () => r.json() };
    };
    return regle(methode, String(url), executer);
  };
}
const ADRESSE_CHANGEE = ['Adresse changée. L’ancienne mène toujours à votre boutique.', { ton: 'succes' }];
const VERIFIER = '/api/reseller/boutique/adresse?adresse=awa-mode';
const ETAT = '/api/reseller/boutique/adresse';

// ── 1. La base garantit qu'une ancienne adresse n'est jamais redonnée ───────

async function baseSql() {
  const { database, sql } = require('./helpers/audit-db.cjs');
  const pg = await database();
  await pg.exec(`INSERT INTO public.profiles (id, phone, full_name, role) VALUES
    ('rev-1', '+22370000001', '[TEST] Awa', 'reseller'), ('rev-2', '+22370000002', '[TEST] Moussa', 'reseller'), ('rev-3', '+22370000003', '[TEST] Awa bis', 'reseller'),
    ('rev-4', '+22370000004', '[TEST] Awa ter', 'reseller')`);
  await pg.exec(`INSERT INTO public.stores (id, owner_type, owner_id, slug, name) VALUES
    ('s1', 'reseller', 'rev-1', 'awa-traore-diallo', '[TEST] Awa Mode'), ('s2', 'reseller', 'rev-2', 'chez-moussa', '[TEST] Chez Moussa')`);
  await pg.exec(sql(SQL));
  return pg;
}
const un = async (pg, q) => (await pg.query(q)).rows[0];
const adresseDe = async (pg, id) => (await un(pg, `SELECT slug FROM public.stores WHERE id = '${id}'`)).slug;
const changerSql = async (pg, id, proprietaire, nouveau) => (await un(pg, `SELECT public.changer_adresse_boutique('${id}', '${proprietaire}', '${nouveau}') AS r`)).r;
/** Vérification 4 du fichier : aucune ancienne adresse n'est aussi une adresse en service. */
const anciennesEnService = async (pg) => Number((await un(pg, 'SELECT count(*) AS n FROM public.store_slug_aliases a JOIN public.stores s ON lower(s.slug) = a.slug')).n);
/** Refus de la base, avec le code d'une adresse déjà prise : le code essaie l'adresse suivante. */
const refuse = (pg, q, libelle) => assert.rejects(pg.exec(q), (e) => {
  assert.equal(e.code, '23505', libelle);
  assert.match(e.message, /ancienne adresse d'une boutique, jamais redonnée/, libelle);
  return true;
}, libelle);

test('SQL réel (PGlite) : la base refuse elle-même qu’une boutique porte une ancienne adresse — création, changement de slug, majuscules, rôle du serveur ; le reste passe', async () => {
  const { sql } = require('./helpers/audit-db.cjs');
  const pg = await baseSql();
  await pg.exec(sql(SQL));
  // Vérification 5 du fichier : un seul déclencheur, même après deux exécutions.
  assert.deepEqual((await pg.query(`SELECT tgname FROM pg_trigger WHERE tgrelid = 'public.stores'::regclass AND tgname = '${DECLENCHEUR}'`)).rows, [{ tgname: DECLENCHEUR }]);
  const creer = (id, proprietaire, slug) => `INSERT INTO public.stores (id, owner_type, owner_id, slug, name) VALUES ('${id}', 'reseller', '${proprietaire}', '${slug}', '[TEST] ${id}')`;

  assert.equal(await changerSql(pg, 's1', 'rev-1', 'awa-mode'), 'ok');
  // Création directe sur l'ancienne adresse d'Awa : l'index unique ne dit plus rien (elle n'est
  // plus « en service »), c'est le déclencheur qui refuse.
  await refuse(pg, creer('s3', 'rev-3', 'awa-traore-diallo'), 'création');
  await refuse(pg, creer('s3', 'rev-3', 'Awa-Traore-Diallo'), 'création, majuscules');
  await pg.exec(creer('s3', 'rev-3', 'awa-bis'));
  // Changement de slug, pour une autre boutique comme pour la boutique elle-même (pas de retour).
  await refuse(pg, `UPDATE public.stores SET slug = 'awa-traore-diallo' WHERE id = 's3'`, 'autre boutique');
  await refuse(pg, `UPDATE public.stores SET slug = 'awa-traore-diallo', name = '[TEST] x' WHERE id = 's2'`, 'autre boutique, avec un autre champ');
  await refuse(pg, `UPDATE public.stores SET slug = 'awa-traore-diallo' WHERE id = 's1'`, 'sa propre ancienne adresse');
  assert.deepEqual([await adresseDe(pg, 's1'), await adresseDe(pg, 's2'), await adresseDe(pg, 's3')], ['awa-mode', 'chez-moussa', 'awa-bis'], 'rien n’a bougé');
  // Ce qui ne change pas l'adresse n'est jamais contrôlé ni ralenti.
  await pg.exec(`UPDATE public.stores SET name = '[TEST] Awa Chic', updated_at = NOW() WHERE id = 's1'`);
  await pg.exec(`UPDATE public.stores SET slug = slug, followers_count = 3 WHERE id = 's1'`);
  await pg.exec(`UPDATE public.stores SET slug = 'chez-moussa-2' WHERE id = 's2'`);

  // Le rôle du serveur (service_role), celui de toutes les écritures de l'application.
  await pg.exec('SET ROLE service_role');
  try {
    await refuse(pg, creer('s4', 'rev-4', 'awa-traore-diallo'), 'service_role');
    await pg.exec(creer('s4', 'rev-4', 'awa-ter'));
    assert.equal(await changerSql(pg, 's3', 'rev-3', 'awa-traore-diallo'), 'pris', 'la fonction du changement répond toujours « pris »');
    assert.equal(await changerSql(pg, 's3', 'rev-3', 'awa-quater'), 'ok');
  } finally { await pg.exec('RESET ROLE'); }
  assert.equal(await anciennesEnService(pg), 0, 'vérification 4');
  assert.deepEqual((await pg.query('SELECT slug, store_id FROM public.store_slug_aliases ORDER BY slug')).rows, [{ slug: 'awa-bis', store_id: 's3' }, { slug: 'awa-traore-diallo', store_id: 's1' }]);
  // Ni anon ni authenticated ne peuvent appeler la fonction du déclencheur.
  assert.deepEqual(await un(pg, `SELECT has_function_privilege('anon', 'public.stores_refuser_ancienne_adresse()', 'EXECUTE') AS a,
    has_function_privilege('authenticated', 'public.stores_refuser_ancienne_adresse()', 'EXECUTE') AS b`), { a: false, b: false });
  // Boutique supprimée : son ancienne adresse part avec elle (ON DELETE CASCADE) et redevient libre.
  await pg.exec(`DELETE FROM public.stores WHERE id = 's1'`);
  await pg.exec(creer('s5', 'rev-1', 'awa-traore-diallo'));
});

test('Course (PGlite) : un changement d’adresse validé ENTRE la lecture des anciennes adresses et la création — la nouvelle boutique reçoit « -2 », jamais l’ancienne adresse d’une autre', async () => {
  const B = require('../src/lib/reseau/boutiques.ts');
  const { creerBoutiqueSupplementaire } = require('../src/lib/reseau/boutiques-multiples.ts');
  const pg = await baseSql();
  try {
    // Un autre compte s'appelle « Awa Traoré Diallo ». Pendant que sa boutique se crée, Awa change d'adresse.
    let valide = 0;
    baseCourante = clientSql(pg, { apresLectureDesAnciennes: async () => { valide += 1; assert.equal(await changerSql(pg, 's1', 'rev-1', 'awa-mode'), 'ok'); } });
    const nouvelle = await B.obtenirOuCreerBoutique({ typeProprietaire: 'reseller', proprietaireId: 'rev-3', nom: 'Awa Traoré Diallo' });
    assert.equal(valide, 1, 'le changement a bien été validé entre la lecture et la création');
    assert.equal(nouvelle.slug, 'awa-traore-diallo-2', 'la base a refusé l’ancienne adresse : adresse suivante');
    // Les anciens liens et QR codes d'Awa mènent toujours à SA boutique.
    const parAncienne = await B.boutiqueParSlug('awa-traore-diallo');
    assert.deepEqual([parAncienne.id, parAncienne.slug, parAncienne.ancienneAdresse], ['s1', 'awa-mode', 'awa-traore-diallo']);
    // Et la nouvelle boutique garde son changement d'adresse (il répondait « pris » pour toujours).
    assert.equal(await B.changerAdresse(nouvelle.id, 'rev-3', 'awa-bis'), 'ok');
    assert.equal(await anciennesEnService(pg), 0);

    // Boutique supplémentaire (formule Pro) : même enchaînement, même protection.
    baseCourante = clientSql(pg, { apresLectureDesAnciennes: async () => { valide += 1; assert.equal(await changerSql(pg, 's2', 'rev-2', 'moussa-mode'), 'ok'); } });
    const pro = await creerBoutiqueSupplementaire({ type: 'reseller', proprietaireId: 'rev-1', nom: 'Chez Moussa', forcer: true });
    assert.equal(valide, 2);
    assert.deepEqual([pro.ok, pro.boutique && pro.boutique.slug], [true, 'chez-moussa-2']);
    assert.equal((await B.boutiqueParSlug('chez-moussa')).id, 's2', 'l’ancienne adresse de Moussa mène toujours à sa boutique');
    assert.equal(await anciennesEnService(pg), 0);
  } finally { baseCourante = db; }
});

test('Témoin (PGlite) : sans le déclencheur (fichier exécuté avant cette relecture), le même enchaînement donnait l’ancienne adresse à la nouvelle boutique', async () => {
  const B = require('../src/lib/reseau/boutiques.ts');
  const pg = await baseSql();
  await pg.exec(`DROP TRIGGER ${DECLENCHEUR} ON public.stores`);
  try {
    baseCourante = clientSql(pg, { apresLectureDesAnciennes: async () => { assert.equal(await changerSql(pg, 's1', 'rev-1', 'awa-mode'), 'ok'); } });
    const nouvelle = await B.obtenirOuCreerBoutique({ typeProprietaire: 'reseller', proprietaireId: 'rev-3', nom: 'Awa Traoré Diallo' });
    // Le défaut relevé : la règle ne tenait que par le code, en deux temps.
    assert.equal(nouvelle.slug, 'awa-traore-diallo');
    assert.equal((await B.boutiqueParSlug('awa-traore-diallo')).id, nouvelle.id, 'elle captait les anciens liens d’Awa');
    assert.equal(await B.changerAdresse(nouvelle.id, 'rev-3', 'awa-bis'), 'pris', 'et ne pouvait plus changer d’adresse');
    assert.equal(await anciennesEnService(pg), 1, 'la vérification 4 du fichier le signale');
    // Relancer le fichier remet le déclencheur ; il ne corrige pas l'existant (à faire à la main).
    await pg.exec(require('./helpers/audit-db.cjs').sql(SQL));
    assert.equal(Number((await un(pg, `SELECT count(*) AS n FROM pg_trigger WHERE tgrelid = 'public.stores'::regclass AND tgname = '${DECLENCHEUR}'`)).n), 1);
    assert.equal(await anciennesEnService(pg), 1);
    // Une boutique déjà dans ce cas reste modifiable tant que son adresse ne change pas.
    await pg.exec(`UPDATE public.stores SET slug = slug, name = '[TEST] renommée' WHERE id = '${nouvelle.id}'`);
  } finally { baseCourante = db; }
});

test('SQL (texte) : déclencheur APRÈS l’écriture, code 23505, droits retirés, rejouable sans DROP ; vérification 5 et retour arrière ; le code dit où est la garantie', () => {
  const texte = lire(`supabase/${SQL}`);
  const sql = texte.replace(/--[^\n]*/g, '');
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.stores_refuser_ancienne_adresse\(\)\s+RETURNS TRIGGER\s+LANGUAGE plpgsql\s+SECURITY INVOKER\s+SET search_path = ''/);
  assert.match(sql, /IF EXISTS \(SELECT 1 FROM public\.store_slug_aliases WHERE slug = lower\(NEW\.slug\)\) THEN\s+RAISE EXCEPTION [^;]*USING ERRCODE = 'unique_violation'/);
  // Une modification qui ne change pas l'adresse n'est pas contrôlée.
  assert.match(sql, /IF TG_OP = 'UPDATE' THEN\s+IF lower\(NEW\.slug\) = lower\(OLD\.slug\) THEN RETURN NULL; END IF;\s+END IF;/);
  // AFTER, pas BEFORE : la création attend d'abord la fin du changement en cours (index unique).
  assert.match(sql, /CREATE TRIGGER stores_ancienne_adresse_reservee\s+AFTER INSERT OR UPDATE OF slug ON public\.stores\s+FOR EACH ROW EXECUTE FUNCTION public\.stores_refuser_ancienne_adresse\(\);/);
  assert.doesNotMatch(sql, /BEFORE INSERT/);
  assert.match(sql, /IF NOT EXISTS \(\s+SELECT 1 FROM pg_trigger\s+WHERE tgname = 'stores_ancienne_adresse_reservee' AND tgrelid = 'public\.stores'::regclass/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.stores_refuser_ancienne_adresse\(\) FROM PUBLIC, anon, authenticated;/);
  assert.doesNotMatch(sql, /SECURITY DEFINER|\bDROP\b|\bDELETE FROM\b|\bTRUNCATE\b|reseller_shop_items|store_products/i);
  assert.doesNotMatch(sql, /GRANT[^;]*\b(?:anon|authenticated)\b/i);
  // Le message d'erreur ne doit pas passer pour l'ancienne contrainte « une boutique par compte ».
  assert.doesNotMatch(sql, /RAISE EXCEPTION[^;]*stores_owner_key/);
  assert.match(texte, /-- Vérification 5 \(attendu : 1 ligne\)/);
  assert.match(texte, /suivi des 5 vérifications en bas de fichier/);
  assert.match(texte, /Fichier déjà exécuté avant cet ajout : le relancer une fois/);
  assert.match(texte, /-- Retour arrière[\s\S]*DROP TRIGGER IF EXISTS stores_ancienne_adresse_reservee ON public\.stores;[\s\S]*DROP FUNCTION IF EXISTS public\.stores_refuser_ancienne_adresse\(\);[\s\S]*DROP TABLE IF EXISTS public\.store_slug_aliases;/);
  assert.deepEqual(fs.readdirSync(path.join(RACINE, 'supabase')).filter((f) => f.startsWith('A-EXECUTER-2026-10-03')), [SQL], 'toujours un seul fichier SQL pour le chantier');

  // Les deux créations traitent 23505 en passant à l'adresse suivante, et le disent.
  for (const f of ['src/lib/reseau/boutiques.ts', 'src/lib/reseau/boutiques-multiples.ts']) {
    assert.match(lire(f), /stores_ancienne_adresse_reservee/, f);
  }
  assert.match(sansCommentaires(lire('src/lib/reseau/boutiques.ts')), /if \(error\?\.code !== '23505'\) \{/);
  assert.match(sansCommentaires(lire('src/lib/reseau/boutiques-multiples.ts')), /if \(error\?\.code !== '23505'\) return/);
});

// ── 2. Écran : la réponse du changement se perd ─────────────────────────────

test('Réponse du changement perdue : l’écran relit l’état au serveur et suit — nouvelle adresse, succès, jamais « Changement impossible »', async () => {
  try {
    baseAwa();
    const appels = []; const changements = [];
    // Le serveur traite le POST ; la réponse n'arrive jamais au téléphone.
    brancher(appels, async (methode, _url, executer) => { const r = await executer(); if (methode === 'POST') throw new Error('réponse perdue'); return r; });
    const section = monterSection(changements);
    await section.changer();
    assert.equal(etat.stores[0].slug, 'awa-mode', 'le serveur a changé l’adresse, définitivement');
    assert.deepEqual(appels.map((a) => [a[0], a[1]]), [['GET', VERIFIER], ['POST', ETAT], ['GET', ETAT]], 'état relu, sans ?adresse=');
    assert.deepEqual(changements, [['awa-mode', 'awa-traore-diallo']], 'la page reçoit la nouvelle adresse : lien, QR et section suivent');
    assert.deepEqual(messages, [ADRESSE_CHANGEE]);
    assert.equal(section.erreur(), undefined);
    assert.equal(section.enCours(), false);
    assert.equal(confirmations.length, 1);
  } finally { global.fetch = RESEAU_INTERDIT; }
});

test('Réponse perdue ET connexion toujours coupée : l’écran dit qu’il ne sait pas ; au nouvel essai il suit, sans « déjà changé », sans seconde confirmation ni second envoi', async () => {
  try {
    baseAwa();
    const appels = []; const changements = [];
    let coupee = false;
    brancher(appels, async (methode, _url, executer) => {
      if (coupee) throw new Error('hors ligne');
      const r = await executer();
      if (methode === 'POST') { coupee = true; throw new Error('réponse perdue'); }
      return r;
    });
    const section = monterSection(changements);
    await section.changer();
    assert.equal(etat.stores[0].slug, 'awa-mode');
    assert.deepEqual(appels.map((a) => [a[0], a[1]]), [['GET', VERIFIER], ['POST', ETAT], ['GET', ETAT]]);
    assert.equal(section.erreur(), 'Connexion coupée pendant le changement : votre adresse a peut-être changé. Vérifiez votre connexion, puis réessayez.');
    assert.deepEqual(changements, []);
    assert.deepEqual(messages, []);
    assert.equal(section.enCours(), false, 'le bouton redevient utilisable');

    // La connexion revient. Avant : « Vous avez déjà changé l'adresse… » sous le champ, ancienne
    // adresse toujours affichée, lien et QR inchangés jusqu'au rechargement.
    coupee = false; appels.length = 0; confirmations.length = 0;
    await section.changer();
    assert.deepEqual(appels.map((a) => [a[0], a[1]]), [['GET', VERIFIER]], 'la vérification suffit : rien n’est renvoyé');
    assert.deepEqual(confirmations, []);
    assert.deepEqual(changements, [['awa-mode', 'awa-traore-diallo']]);
    assert.deepEqual(messages, [ADRESSE_CHANGEE]);
    assert.equal(section.erreur(), undefined);
    assert.equal(etat.store_slug_aliases.length, 1);
  } finally { global.fetch = RESEAU_INTERDIT; }
});

test('Coupure AVANT que le serveur ait rien fait : « Vérifiez votre connexion », rien ne change ; une coupure à la vérification ne relit rien', async () => {
  try {
    // 1. Le POST n'atteint jamais le serveur : l'état relu dit que rien n'a changé.
    baseAwa();
    let appels = []; const changements = [];
    brancher(appels, async (methode, _url, executer) => { if (methode === 'POST') throw new Error('hors ligne'); return executer(); });
    let section = monterSection(changements);
    await section.changer();
    assert.deepEqual(appels.map((a) => [a[0], a[1]]), [['GET', VERIFIER], ['POST', ETAT], ['GET', ETAT]]);
    assert.equal(section.erreur(), 'Changement impossible. Vérifiez votre connexion.');
    assert.equal(etat.stores[0].slug, 'awa-traore-diallo');
    assert.deepEqual([changements, messages, etat.store_slug_aliases], [[], [], []]);

    // 2. Coupure dès la vérification : un seul appel, aucun envoi, même message.
    baseAwa();
    appels = [];
    brancher(appels, async () => { throw new Error('hors ligne'); });
    section = monterSection(changements);
    await section.changer();
    assert.deepEqual(appels.map((a) => [a[0], a[1]]), [['GET', VERIFIER]]);
    assert.equal(section.erreur(), 'Changement impossible. Vérifiez votre connexion.');
    assert.deepEqual([changements, confirmations], [[], []]);
    assert.equal(section.enCours(), false);
  } finally { global.fetch = RESEAU_INTERDIT; }
});

test('Demande arrivée deux fois ou serveur en difficulté après l’écriture : l’écran relit l’état avant d’afficher un refus ; un vrai refus s’affiche', async () => {
  try {
    // 1. La même demande arrive deux fois : la seconde réponse dit « C'est déjà l'adresse de
    //    votre boutique » (400) — alors que le changement vient d'être fait.
    baseAwa();
    let appels = []; let changements = [];
    brancher(appels, async (methode, _url, executer) => { if (methode !== 'POST') return executer(); await executer(); return executer(); });
    let section = monterSection(changements);
    await section.changer();
    assert.deepEqual(appels.map((a) => [a[0], a[1]]), [['GET', VERIFIER], ['POST', ETAT], ['GET', ETAT]]);
    assert.deepEqual(changements, [['awa-mode', 'awa-traore-diallo']]);
    assert.deepEqual(messages, [ADRESSE_CHANGEE]);
    assert.equal(section.erreur(), undefined);

    // 2. Délai dépassé après l'écriture : une réponse 504 sans contenu lisible.
    baseAwa();
    appels = []; changements = [];
    brancher(appels, async (methode, _url, executer) => {
      if (methode !== 'POST') return executer();
      await executer();
      return { ok: false, status: 504, json: async () => { throw new Error('pas du JSON'); } };
    });
    section = monterSection(changements);
    await section.changer();
    assert.deepEqual(changements, [['awa-mode', 'awa-traore-diallo']]);
    assert.deepEqual(messages, [ADRESSE_CHANGEE]);

    // 3. Vraie panne (rien n'a été écrit) : l'état relu le confirme, le message de la panne s'affiche.
    baseAwa();
    appels = []; changements = [];
    fautes['rpc:changer_adresse_boutique'] = '57014';
    brancher(appels);
    section = monterSection(changements);
    await section.changer();
    assert.deepEqual(appels.map((a) => [a[0], a[1]]), [['GET', VERIFIER], ['POST', ETAT], ['GET', ETAT]]);
    assert.equal(section.erreur(), 'Changement d’adresse impossible pour le moment. Réessayez.');
    assert.deepEqual([changements, messages], [[], []]);
    assert.equal(etat.stores[0].slug, 'awa-traore-diallo');

    // 4. Vrai refus (adresse prise au dernier moment) : l'état relu dit que rien n'a changé, le refus s'affiche.
    baseAwa();
    appels = []; changements = [];
    brancher(appels, async (methode, _url, executer) => { if (methode === 'POST') etat.stores[1].slug = 'awa-mode'; return executer(); });
    section = monterSection(changements);
    await section.changer();
    assert.deepEqual(appels.map((a) => [a[0], a[1]]), [['GET', VERIFIER], ['POST', ETAT], ['GET', ETAT]]);
    assert.equal(section.erreur(), 'Cette adresse est déjà prise. Essayez-en une autre.');
    assert.deepEqual([changements, messages], [[], []]);
    assert.equal(etat.stores[0].slug, 'awa-traore-diallo');

    // 5. Second changement refusé par la base (« déjà changée ») : même relecture, la page suit.
    baseAwa();
    appels = []; changements = [];
    brancher(appels, async (methode, _url, executer) => {
      if (methode === 'POST') assert.equal(changerAdresseSimulee({ p_store_id: 's1', p_owner_id: 'rev-1', p_nouveau: 'awa-chic' }), 'ok');
      return executer();
    });
    section = monterSection(changements);
    await section.changer();
    assert.deepEqual(appels.map((a) => [a[0], a[1]]), [['GET', VERIFIER], ['POST', ETAT], ['GET', ETAT]]);
    assert.deepEqual(changements, [['awa-chic', 'awa-traore-diallo']]);
    assert.deepEqual(messages, [['L’adresse de votre boutique a déjà été changée : app.sugubaml.com/boutique/awa-chic', { ton: 'info' }]]);
    assert.equal(section.erreur(), undefined);
  } finally { global.fetch = RESEAU_INTERDIT; }
});

test('Adresse déjà changée ailleurs (autre onglet, autre téléphone) : la page prend l’adresse réelle et le dit, sans annoncer comme réussie l’adresse tapée ici', async () => {
  try {
    baseAwa();
    etat.stores[0].slug = 'awa-chic';
    etat.store_slug_aliases = [{ slug: 'awa-traore-diallo', store_id: 's1' }];
    const appels = []; const changements = [];
    brancher(appels);
    const section = monterSection(changements);
    await section.changer();
    assert.deepEqual(appels.map((a) => [a[0], a[1]]), [['GET', VERIFIER]]);
    assert.deepEqual(confirmations, [], 'rien à confirmer : aucun changement n’est demandé');
    assert.deepEqual(changements, [['awa-chic', 'awa-traore-diallo']]);
    assert.deepEqual(messages, [['L’adresse de votre boutique a déjà été changée : app.sugubaml.com/boutique/awa-chic', { ton: 'info' }]]);
    assert.equal(section.erreur(), undefined);
    assert.equal(etat.stores[0].slug, 'awa-chic');
  } finally { global.fetch = RESEAU_INTERDIT; }
});

test('Adresse refusée par le serveur (« déjà prise ») : plus d’aperçu « Vos clients ouvriront » sous le message ; il revient dès que le revendeur écrit', async () => {
  try {
    baseAwa();
    const appels = [];
    brancher(appels);
    const section = monterSection([]);
    section.ecrire('Chez Moussa');
    assert.match(section.html(), /Vos clients ouvriront : <strong[^>]*>app\.sugubaml\.com\/boutique\/chez-moussa<\/strong>/, 'avant la vérification : l’aperçu');
    await section.changer();
    assert.equal(section.erreur(), 'Cette adresse est déjà prise. Essayez-en une autre.');
    const html = section.html();
    assert.match(html, /Cette adresse est déjà prise/);
    assert.doesNotMatch(html, /Vos clients ouvriront/);
    assert.doesNotMatch(html, /boutique\/chez-moussa/, 'l’adresse refusée n’est plus écrite comme une adresse à venir');
    assert.deepEqual(appels.map((a) => a[0]), ['GET']);
    // Écrire de nouveau efface le message du serveur : l'aperçu revient.
    section.ecrire('Awa Mode');
    assert.equal(section.erreur(), undefined);
    assert.match(section.html(), /Vos clients ouvriront : <strong[^>]*>app\.sugubaml\.com\/boutique\/awa-mode<\/strong>/);
  } finally { global.fetch = RESEAU_INTERDIT; }
  const source = sansCommentaires(lire('src/components/reseau/AdresseBoutique.tsx'));
  assert.match(source, /\{apercu && !erreur && \(/);
  assert.doesNotMatch(source, /\{apercu && !refus && \(/);
  // L'état relu vient de la route, sans paramètre : l'identité reste celle de la session.
  assert.match(source, /fetch\('\/api\/reseller\/boutique\/adresse', \{ cache: 'no-store' \}\)/);
  assert.equal((source.match(/method: 'POST'/g) || []).length, 1, 'un seul envoi : jamais de second changement tenté tout seul');
});

// ── 3. Démarrage : l'aide sur l'adresse ─────────────────────────────────────

test('Démarrage, « Nom de votre boutique » : l’aide ne dit plus que l’adresse « ne changera plus » (elle se change une fois après le SQL)', () => {
  const source = sansCommentaires(lire('src/app/reseller/demarrer/page.tsx'));
  assert.doesNotMatch(source, /ne changera plus/);
  assert.match(source, /: 'Il donne l’adresse de votre boutique : choisissez-le bien\. Le nom, lui, reste modifiable\.'\}>/);
  // Renommer ne change pas l'adresse : cette phrase reste juste.
  assert.match(source, /\? 'Modifiable plus tard\. L’adresse de votre boutique ne change pas\.'/);
  // Aucun écran du revendeur n'annonce une adresse définitive tant qu'elle peut encore changer.
  for (const f of ['src/app/reseller/demarrer/page.tsx', 'src/app/reseller/boutique/page.tsx', 'src/components/shop/proprietaire/PanneauNomAccueil.tsx', 'src/components/reseau/AdresseBoutique.tsx']) {
    assert.doesNotMatch(sansCommentaires(lire(f)), /ne changera (plus|jamais)|Ne change jamais|adresse ne change jamais/, f);
  }
});

// ── 4. Bulle du support : charte et cibles ──────────────────────────────────

test('Bulle du support : boutons du design system, choix et fermeture de 44 px, fermeture nommée, texte vert lisible ; icône seule sur téléphone', () => {
  const Bulle = require(BULLE).default;
  const rendre = (ouverte) => { chemin = '/boutique/awa-mode'; bulleOuverte = ouverte; try { return renderToStaticMarkup(React.createElement(Bulle)); } finally { bulleOuverte = null; chemin = '/'; } };
  const boutons = (html) => html.match(/<button[^>]*>/g) || [];

  // Fermée : la bulle seule, par <Button> (variante réservée à ce qui ouvre WhatsApp).
  const fermee = rendre(null);
  assert.equal(boutons(fermee).length, 1);
  const bulle = boutons(fermee)[0];
  for (const classe of ['bg-suguba-wa', 'text-suguba-profond', 'rounded-full', 'min-h-[44px]', 'shadow-suguba-wa/40', 'focus-visible:ring-2']) assert.ok(bulle.includes(classe), classe);
  assert.match(bulle, /type="button"/);
  assert.match(bulle, /aria-label="Contacter le support sur WhatsApp"/);
  assert.match(bulle, /aria-expanded="false"/);
  assert.doesNotMatch(bulle, /aria-controls/);
  assert.doesNotMatch(fermee, /id="aide-suguba"/);
  // Sur téléphone : l'icône seule (le libellé recouvrirait les cartes d'articles) ; libellé dès 640 px.
  assert.match(fermee, /<span class="text-xs hidden sm:inline">Besoin d(?:&#x27;|')aide \?<\/span>/);
  assert.equal((fermee.match(/<span/g) || []).length, 1);

  // Ouverte : fermeture de 44 px avec un nom, trois choix de 44 px.
  const ouverte = rendre(true);
  assert.equal(boutons(ouverte).length, 5, 'fermer, trois choix, la bulle');
  for (const b of boutons(ouverte)) assert.match(b, /type="button"/, b);
  const fermer = boutons(ouverte).find((b) => /aria-label="Fermer"/.test(b));
  assert.ok(fermer, 'la fermeture a un nom pour les lecteurs d’écran');
  assert.match(fermer, /class="w-11 h-11 /);
  assert.equal(boutons(ouverte).filter((b) => b.includes('min-h-[44px]')).length, 4, 'trois choix et la bulle : 44 px');
  assert.equal(boutons(ouverte).filter((b) => b.includes('border-slate-200') && b.includes('w-full')).length, 3, 'trois choix par <Button variant="ghost" fullWidth>');
  for (const libelle of ['Aide pour commander', 'Devenir Revendeur rémunéré', 'Suivre mon colis / SAV', 'Assistance Suguba', '+223 89 46 00 00']) assert.ok(ouverte.includes(libelle), libelle);
  assert.match(ouverte, /<p class="text-xs text-suguba-brand-dark font-bold">Réponse sur WhatsApp<\/p>/);
  assert.match(ouverte, /aria-expanded="true" aria-controls="aide-suguba"|aria-controls="aide-suguba"[^>]*aria-expanded="true"/);
  assert.match(ouverte, /<div id="aide-suguba" class="[^"]*\bw-80 max-w-\[calc\(100vw-2rem\)\]/, 'jamais plus large que l’écran');
  assert.doesNotMatch(ouverte, /emerald|w-6 h-6|p-2\.5|#20bd5a|#25D366/);
  // Les icônes sont décoratives : le nom vient du texte ou de aria-label.
  assert.equal((ouverte.match(/<svg/g) || []).length, (ouverte.match(/<svg[^>]*aria-hidden="true"/g) || []).length);

  const source = sansCommentaires(lire('src/components/common/WhatsAppFloatingButton.tsx'));
  assert.match(source, /import Button from '@\/components\/ui\/Button';/);
  assert.equal((source.match(/<Button\b/g) || []).length, 4);
  assert.equal((source.match(/<button\b/g) || []).length, 1, 'seule la fermeture (icône) reste un bouton nu, comme dans Sheet');
  assert.doesNotMatch(source, /emerald|#[0-9a-fA-F]{3,6}\b|\bPhone\b/);
  // Position inchangée (lot 8) : au-dessus de la barre du bas.
  assert.match(fermee, /class="fixed bottom-\[calc\(6rem\+env\(safe-area-inset-bottom,0px\)\)\] md:bottom-6 right-4 z-50"/);
});

// ── 5. Guide et fiche de reprise ────────────────────────────────────────────

test('Guide : relecture du lot 8 en tête, juste avant le lot 8 ; la bulle est décrite sur /s/<boutique> et /rejoindre ; le SQL à relancer est dit ; REPRISE', () => {
  const guide = JSON.parse(lire('docs/guide/guide.json'));
  assert.ok(guide.majLe >= '2026-10-03');
  const rang = guide.journal.findIndex((j) => j.titre === 'Boutique revendeur, lot 8 : corrections de relecture');
  assert.ok(rang >= 0, 'entrée de relecture');
  const relecture = guide.journal[rang];
  const lot8 = guide.journal[rang + 1];
  assert.equal(lot8.titre, 'Boutique revendeur, lot 8 : adresse à l’enseigne et contact');
  assert.equal(relecture.date, '2026-10-03');
  assert.ok(['en local', 'en ligne'].includes(relecture.statut));
  assert.match(relecture.demande, /^« “Ma boutique” doit montrer la boutique elle-même.*sentiment d’appropriation\. »$/);
  assert.ok(relecture.realise.length >= 6);
  assert.ok(relecture.ecarts.length >= 4);
  for (const id of ['rev-boutique', 'vitrine-boutique', 'vitrine-fournisseur', 'rejoindre', 'rev-demarrer']) assert.ok(relecture.pages.includes(id), id);
  for (const id of relecture.pages) assert.ok(guide.pages.some((p) => p.id === id), id);
  assert.doesNotMatch(JSON.stringify(relecture), /À la une/);

  // Le SQL : même fichier, complété — à relancer s'il a déjà été exécuté.
  const ecarts = relecture.ecarts.join('\n');
  assert.ok(ecarts.includes(`supabase/${SQL}`));
  assert.match(ecarts, /relancer/i);
  assert.match(ecarts, /SQL Editor/);
  assert.match(ecarts, /6 constats/);
  assert.match(ecarts, /icône seule/);
  const realise = relecture.realise.join('\n');
  assert.match(realise, /Connexion coupée|connexion coupe/);
  assert.match(realise, /Vos clients ouvriront/);
  assert.match(realise, /choisissez-le bien/);
  assert.match(realise, /44 px/);
  assert.match(realise, /la base elle-même/);

  // L'entrée du lot 8 cite les deux fiches oubliées, et ne dit plus « rien à relancer ».
  for (const id of ['vitrine-fournisseur', 'rejoindre']) assert.ok(lot8.pages.includes(id), id);
  assert.doesNotMatch(lot8.ecarts.join('\n'), /rien à relancer/);
  assert.match(lot8.ecarts.join('\n'), /Aucun nouveau fichier SQL/);

  // Fiches : la bulle sur les trois pages où elle s'affiche.
  const fiche = (id) => guide.pages.find((p) => p.id === id);
  for (const id of ['vitrine-boutique', 'vitrine-fournisseur', 'rejoindre']) {
    const bulle = fiche(id).elements.find((e) => /Besoin d’aide/.test(e.nom));
    assert.ok(bulle, `${id} : élément « Besoin d’aide ? »`);
    assert.match(bulle.nom, /support Suguba/, id);
    assert.match(bulle.role, /WhatsApp/, id);
    assert.match(bulle.role, /icône seule/, id);
    assert.match(bulle.role, /au-dessus de (sa|la) barre du bas/, id);
  }
  assert.match(fiche('vitrine-boutique').elements.find((e) => /Besoin d’aide/.test(e.nom)).role, /Jamais le numéro du revendeur/);
  assert.match(fiche('vitrine-fournisseur').elements.find((e) => /Besoin d’aide/.test(e.nom)).role, /Jamais le numéro du fournisseur/);
  const adresse = fiche('rev-boutique').elements.find((e) => e.nom === 'Adresse de ma boutique');
  assert.match(adresse.role, /connexion coupe/);
  assert.match(fiche('rev-demarrer').elements.find((e) => e.nom === 'Nom de votre boutique').role, /choisissez-le bien/);
  assert.doesNotMatch(JSON.stringify(fiche('rev-demarrer')), /ne changera plus/);

  const lignes = lire('REPRISE.md').split('\n').filter((l) => l.startsWith('> **'));
  const rangLigne = lignes.findIndex((l) => /boutique revendeur, lot 8 : corrections de relecture/.test(l));
  assert.ok(rangLigne >= 0, 'ligne de la relecture du lot 8 dans REPRISE.md');
  assert.match(lignes[rangLigne + 1], /boutique revendeur, lot 8 « Adresse à l’enseigne et contact »/, 'juste avant la ligne du lot 8');
  for (const repere of [DECLENCHEUR, 'À RELANCER', 'relireEtat', '23505']) assert.ok(lignes[rangLigne].includes(repere), repere);
  assert.doesNotMatch(lignes[rangLigne + 1], /rien à relancer s'il est déjà exécuté\)/);
});
