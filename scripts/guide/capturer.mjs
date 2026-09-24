// Captures du guide des parcours (docs/guide/captures/<id>.jpg).
//
//   npm run guide:captures                     → toutes les pages du guide
//   npm run guide:captures -- accueil,panier   → seulement ces pages
//
// Prérequis : serveur local lancé (npm run dev, port 3000) avec
// SUGUBA_DEMO_MODE=true (connexion aux comptes de démonstration).
//
// LECTURE SEULE : aucun formulaire envoyé, aucune commande. Les seuls gestes
// sont ouvrir le menu, ouvrir « + Vente » et ajouter au panier (stockage local
// du navigateur, vidé à la fin). Ne JAMAIS y ajouter /admin/boutique-suguba :
// l'ouvrir crée la boutique officielle en base.
//
// MASQUAGE : e-mails, numéros de téléphone (sauf le support Suguba) et noms des
// personnes enregistrées en base sont remplacés AVANT la capture. Les noms
// sont lus en base pour être masqués, jamais affichés ni enregistrés.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const GUIDE = path.join(RACINE, 'docs', 'guide');
const BASE = process.env.BASE || 'http://localhost:3000';
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const HAUTEUR_MAX = 2600; // px CSS : au-delà, la capture s'arrête (listes longues)
const INTERDITES = ['/admin/boutique-suguba'];

const guide = JSON.parse(fs.readFileSync(path.join(GUIDE, 'guide.json'), 'utf8'));
const filtre = process.argv[2] ? new Set(process.argv[2].split(',')) : null;
const sessionDe = Object.fromEntries(guide.roles.map((r) => [r.cle, r.sessionDemo]));
const aCapturer = guide.pages.filter((p) => p.capture && (!filtre || filtre.has(p.id)));
for (const p of aCapturer) {
  if (INTERDITES.some((c) => p.capture.chemin.startsWith(c))) throw new Error(`Capture interdite : ${p.capture.chemin}`);
}

// Noms à masquer (lus en base, jamais affichés).
for (const l of fs.readFileSync(path.join(RACINE, '.env.local'), 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
}
const noms = new Set();
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
for (const [table, colonne] of [['profiles', 'full_name'], ['orders', 'customer_name'], ['suppliers', 'manager_name']]) {
  const { data } = await sb.from(table).select(colonne).limit(5000);
  for (const r of data || []) if (typeof r[colonne] === 'string' && r[colonne].trim().length >= 3) noms.add(r[colonne].trim());
}
const listeNoms = [...noms].sort((a, b) => b.length - a.length);

function masquer(listeNoms) {
  const echapper = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const reNoms = listeNoms.length ? new RegExp(listeNoms.map(echapper).join('|'), 'gi') : null;
  const reMail = /[\w.+-]+@[\w-]+\.[\w.]+/g;
  const reTel = /\+?\d(?:[\s.]?\d){7,}/g; // toute suite d'au moins 8 chiffres
  const support = (m) => m.replace(/\D/g, '').endsWith('89460000');
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const noeuds = []; while (w.nextNode()) noeuds.push(w.currentNode);
  for (const t of noeuds) {
    let v = t.nodeValue.replace(reMail, '•••@•••').replace(reTel, (m) => (support(m) ? m : '•• •• •• ••'));
    if (reNoms) v = v.replace(reNoms, 'Nom masqué');
    if (v !== t.nodeValue) t.nodeValue = v;
  }
  for (const i of document.querySelectorAll('input')) {
    if (/@/.test(i.value) || /\d{8}/.test(i.value.replace(/\D/g, ''))) i.value = '••••';
  }
  const texte = document.body.innerText;
  return (texte.match(reMail) || []).length
    + (texte.match(reTel) || []).filter((m) => !support(m)).length
    + (reNoms ? (texte.match(reNoms) || []).length : 0);
}

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage();
await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1');
await page.evaluateOnNewDocument(() => {
  try { Object.defineProperty(Notification, 'permission', { get: () => 'denied' }); } catch {}
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); e.stopImmediatePropagation(); }, true);
});
const VUE = { width: 390, height: 844, deviceScaleFactor: 1.5, isMobile: true, hasTouch: true };
await page.setViewport(VUE);
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

let erreurs = 0;
for (const role of guide.roles) {
  const pages = aCapturer.filter((p) => p.role === role.cle);
  if (!pages.length) continue;
  await page.goto(`${BASE}/legal/terms`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  const connecte = await page.evaluate(async (r) => {
    await fetch('/api/auth/logout', { method: 'POST' });
    if (!r) return true;
    const rep = await fetch('/api/auth/demo-login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: r }) });
    return rep.ok;
  }, sessionDe[role.cle]);
  if (!connecte) throw new Error(`Connexion démo « ${sessionDe[role.cle]} » refusée : lancer le serveur avec SUGUBA_DEMO_MODE=true.`);

  for (const p of pages) {
    const { chemin, geste } = p.capture;
    try {
      if (geste === 'panier') {
        await page.goto(`${BASE}/p/encre-205a-hp`, { waitUntil: 'networkidle2', timeout: 180000 });
        await attendre(2500);
        await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => /Ajouter au panier/.test(b.textContent))?.click());
        await attendre(800);
      }
      await page.goto(`${BASE}${chemin}`, { waitUntil: 'networkidle2', timeout: 180000 });
      await attendre(4500);
      await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' });
      if (geste === 'menu') { await page.evaluate(() => document.querySelector('button[aria-label="Ouvrir le menu"]')?.click()); await attendre(900); }
      if (geste === 'vente') { await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => /^\s*Vente\s*$/.test(b.textContent))?.click()); await attendre(2500); }
      await page.evaluate(masquer, listeNoms);
      const hauteur = geste === 'menu' || geste === 'vente' ? 844
        : await page.evaluate(() => Math.max(document.documentElement.scrollHeight, document.body.scrollHeight));
      const h = Math.max(844, Math.min(hauteur, HAUTEUR_MAX));
      if (h > 844) { await page.setViewport({ ...VUE, height: h }); await attendre(600); }
      const restes = await page.evaluate(masquer, listeNoms); // re-rendu possible après redimensionnement
      if (restes > 0) throw new Error(`${restes} donnée(s) personnelle(s) non masquée(s) : capture annulée`);
      await page.screenshot({ path: path.join(GUIDE, 'captures', `${p.id}.jpg`), type: 'jpeg', quality: 70 });
      if (h > 844) await page.setViewport(VUE);
      console.log(`ok  ${p.id}  ${chemin}`);
    } catch (e) {
      erreurs++;
      console.log(`ERR ${p.id}  ${chemin} : ${String(e.message).slice(0, 140)}`);
    }
  }
}
await page.evaluate(() => { try { localStorage.setItem('suguba_panier', '[]'); } catch {} return fetch('/api/auth/logout', { method: 'POST' }); });
await browser.close();
if (erreurs) { console.log(`${erreurs} capture(s) en erreur.`); process.exit(1); }
