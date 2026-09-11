/*
 * Suguba — service worker, version 3 (2026-09-11).
 *
 * Ce qu'il fait : garder l'application utilisable avec une connexion
 * instable. Les pages déjà visitées et les photos déjà vues restent
 * disponibles hors ligne ; le catalogue lui-même est gardé par l'application
 * (localStorage, voir src/lib/store.ts).
 *
 * Corrigé par rapport à la v2 :
 *  - elle mettait en cache TOUTES les réponses d'API (commandes, soldes,
 *    données admin, « qui est connecté »). Sur un téléphone partagé, ces
 *    données restaient lisibles après la déconnexion, et une réponse périmée
 *    pouvait être servie hors ligne comme si elle était à jour. Les API ne
 *    passent plus jamais par le cache ;
 *  - elle téléchargeait 27 pages dès la première visite (dont des pages
 *    réservées à des comptes connectés, ou redirigées) : de la data payée
 *    pour rien. Seul l'accueil est préchargé ;
 *  - aucun plafond : le cache grossissait sans fin. Pages et photos sont
 *    désormais limitées.
 *
 * Changer VERSION supprime tous les anciens caches à l'activation — y compris
 * ceux de la v2 qui contenaient des réponses d'API.
 */
const VERSION = 'v3';
const CACHE_PAGES = `suguba-pages-${VERSION}`;
const CACHE_STATIQUE = `suguba-statique-${VERSION}`;
const CACHE_IMAGES = `suguba-images-${VERSION}`;
const CACHES_ACTUELS = [CACHE_PAGES, CACHE_STATIQUE, CACHE_IMAGES];

const MAX_PAGES = 40;
const MAX_IMAGES = 200;
const MAX_STATIQUE = 300;

const A_PRECHARGER = ['/', '/manifest.json', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_PAGES).then((cache) => cache.addAll(A_PRECHARGER)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cles) =>
      Promise.all(cles.filter((cle) => !CACHES_ACTUELS.includes(cle)).map((cle) => caches.delete(cle))),
    ),
  );
  self.clients.claim();
});

// Supprime les entrées les plus anciennes au-delà du plafond.
async function limiter(nom, max) {
  const cache = await caches.open(nom);
  const cles = await cache.keys();
  for (let i = 0; i < cles.length - max; i++) await cache.delete(cles[i]);
}

function mettreEnCache(nom, max, requete, reponse) {
  if (!reponse || reponse.status !== 200) return;
  const copie = reponse.clone();
  caches.open(nom).then((cache) => cache.put(requete, copie).then(() => limiter(nom, max)));
}

// Cache d'abord : fichiers qui ne changent jamais à adresse égale.
function cacheDabord(event, nom, max) {
  event.respondWith(
    caches.match(event.request).then((enCache) => {
      if (enCache) return enCache;
      return fetch(event.request).then((reponse) => {
        mettreEnCache(nom, max, event.request, reponse);
        return reponse;
      });
    }),
  );
}

self.addEventListener('fetch', (event) => {
  const requete = event.request;
  if (requete.method !== 'GET') return;
  const url = new URL(requete.url);
  const memeOrigine = url.origin === self.location.origin;

  // Jamais d'API en cache : données personnelles, et une réponse périmée
  // servie hors ligne serait trompeuse (stock, prix, statut de commande...).
  if (memeOrigine && url.pathname.startsWith('/api/')) return;

  // Photos produits : stockage public Supabase, ou images optimisées par Next.
  const estPhoto =
    (url.hostname.endsWith('.supabase.co') && url.pathname.includes('/storage/v1/object/public/')) ||
    (memeOrigine && url.pathname === '/_next/image');
  if (estPhoto) return cacheDabord(event, CACHE_IMAGES, MAX_IMAGES);

  // Tout le reste venant d'ailleurs (API Supabase, etc.) : réseau normal.
  if (!memeOrigine) return;

  // Fichiers de l'application : leur nom change à chaque version.
  if (url.pathname.startsWith('/_next/static/') || /\.(png|jpe?g|webp|svg|ico|woff2?)$/.test(url.pathname)) {
    return cacheDabord(event, CACHE_STATIQUE, MAX_STATIQUE);
  }

  // Pages : réseau d'abord (toujours à jour), la dernière version connue sinon.
  if (requete.mode === 'navigate') {
    event.respondWith(
      fetch(requete)
        .then((reponse) => {
          mettreEnCache(CACHE_PAGES, MAX_PAGES, requete, reponse);
          return reponse;
        })
        .catch(() => caches.match(requete).then((enCache) => enCache || caches.match('/'))),
    );
  }
});
