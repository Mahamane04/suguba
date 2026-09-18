'use client';

import { useEffect, useState } from 'react';

/**
 * Partage d'un produit en UN clic, image + texte + lien ensemble.
 *
 * Avant (2026-09-11) : le partage ouvrait `api.whatsapp.com/send?text=…`, qui
 * ne transporte QUE du texte. Et comme la page produit n'avait aucune
 * métadonnée d'aperçu, WhatsApp n'affichait même pas de vignette : le contact
 * recevait un lien nu, que personne n'ouvre.
 *
 * Maintenant, par ordre de préférence :
 *  1. partage natif du téléphone AVEC la photo (Web Share, fichiers) : le
 *     revendeur choisit WhatsApp, et le contact reçoit la photo avec le texte
 *     et le lien en légende — comme une vraie publication ;
 *  2. partage natif texte seul, si l'appareil refuse les fichiers ;
 *  3. lien WhatsApp classique en dernier recours (ordinateur) — l'aperçu
 *     (photo, nom, prix) vient alors de la page produit (app/p/[slug]/layout.tsx).
 */

export interface ProduitAPartager {
  nom: string;
  prix: number;
  slug: string;
  images: string[];
}

export type ResultatPartage = 'partage' | 'annule' | 'whatsapp';

export function lienProduit(slug: string, refCode?: string | null): string {
  const base = typeof window !== 'undefined' ? window.location.origin : 'https://app.sugubaml.com';
  return `${base}/p/${slug}${refCode ? `?ref=${encodeURIComponent(refCode)}` : ''}`;
}

export function texteProduit(p: ProduitAPartager, url: string): string {
  return (
    `🛍️ *${p.nom}*\n` +
    `💰 ${p.prix.toLocaleString('fr-FR')} F — vous payez à la livraison\n` +
    `🛵 Livré chez vous à Bamako\n\n` +
    `👉 Commander : ${url}`
  );
}

// Photos déjà téléchargées, par URL. Le partage natif exige d'être déclenché
// par un geste de l'utilisateur ; si le téléchargement de la photo dure trop
// après le clic, Safari refuse le partage. D'où le préchargement dès que le
// doigt touche le bouton (voir prechargerImage), avant même le clic.
const cacheImages = new Map<string, Promise<File | null>>();

export function prechargerImage(url: string | undefined, nom: string): Promise<File | null> {
  if (!url) return Promise.resolve(null);
  let promesse = cacheImages.get(url);
  if (!promesse) {
    promesse = fetch(url, { mode: 'cors' })
      .then(async (res) => {
        if (!res.ok) return null;
        const blob = await res.blob();
        if (!blob.type.startsWith('image/')) return null;
        const extension = blob.type.split('/')[1] || 'jpg';
        return new File([blob], `${nom}.${extension}`, { type: blob.type });
      })
      .catch(() => null);
    cacheImages.set(url, promesse);
  }
  return promesse;
}

/**
 * Liens trackés, préparés À L'AVANCE (2026-09-18).
 *
 * Le partage doit rester dans le geste de l'utilisateur : sur iOS, si une
 * requête réseau s'intercale entre le clic et `navigator.share`, Safari refuse
 * le partage. On lance donc la création du lien dès que le doigt touche le
 * bouton (même moment que le préchargement de la photo), et au clic on ne fait
 * que RÉCUPÉRER un résultat déjà là — avec un délai de garde très court.
 *
 * Si le lien n'est pas prêt, on partage l'URL produit habituelle : la vente
 * reste attribuée par le code revendeur, seules les statistiques par lien
 * manquent. Jamais l'inverse : on ne retarde pas un partage pour un compteur.
 */
const cacheLiens = new Map<string, Promise<string | null>>();

export function prechargerLienPartage(slug: string, cible: 'product' | 'store' = 'product'): Promise<string | null> {
  const cle = `${cible}:${slug}`;
  let promesse = cacheLiens.get(cle);
  if (!promesse) {
    promesse = fetch('/api/reseau/lien', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cible, ref: slug, canal: 'whatsapp' }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j?.lien?.code || null)
      .catch(() => null);
    cacheLiens.set(cle, promesse);
  }
  return promesse;
}

/** Le lien tracké s'il est déjà prêt, sinon rien — on n'attend pas. */
async function lienTrackeSiPret(slug: string, delaiMs = 250): Promise<string | null> {
  const attente = new Promise<null>((resoudre) => setTimeout(() => resoudre(null), delaiMs));
  const code = await Promise.race([prechargerLienPartage(slug), attente]);
  if (!code) return null;
  const base = typeof window !== 'undefined' ? window.location.origin : 'https://app.sugubaml.com';
  return `${base}/go/${code}`;
}

export async function partagerProduit(p: ProduitAPartager, refCode?: string | null): Promise<ResultatPartage> {
  // Un produit sans prix n'est pas en vente : son lien mène à « Produit
  // introuvable » et le message annoncerait « 0 F » (bug du 2026-09-11).
  if (!(p.prix > 0)) {
    // Message de l'application (src/components/ui/Toast.tsx), pas alert().
    window.dispatchEvent(new CustomEvent('suguba:toast', {
      detail: { texte: "Ce produit n'est pas encore en vente : il ne peut pas être partagé.", ton: 'info' },
    }));
    return 'annule';
  }
  // Un lien tracké quand le revendeur est connecté ET que le lien est prêt ;
  // l'URL produit habituelle sinon (voir lienTrackeSiPret).
  const url = (refCode ? await lienTrackeSiPret(p.slug) : null) || lienProduit(p.slug, refCode);
  const texte = texteProduit(p, url);
  const nav = navigator as Navigator & { canShare?: (donnees: ShareData) => boolean };

  if (typeof nav.share === 'function') {
    const image = await prechargerImage(p.images[0], p.slug);
    const avecImage: ShareData | null = image ? { files: [image], text: texte } : null;
    try {
      if (avecImage && nav.canShare?.(avecImage)) {
        await nav.share(avecImage);
      } else {
        await nav.share({ text: texte });
      }
      return 'partage';
    } catch (e) {
      // Le revendeur a fermé la feuille de partage : ce n'est pas une erreur.
      if ((e as DOMException)?.name === 'AbortError') return 'annule';
      // Autre refus (geste expiré, fichier refusé) : on retombe sur WhatsApp.
    }
  }

  // Navigation plutôt que window.open : un onglet ouvert hors du geste de
  // l'utilisateur serait bloqué comme une fenêtre surgissante.
  window.location.href = `https://wa.me/?text=${encodeURIComponent(texte)}`;
  return 'whatsapp';
}

// Code revendeur du visiteur, demandé une seule fois par chargement de page
// même si vingt cartes produit l'utilisent.
//
// On demande d'abord QUI est connecté (/api/auth/me répond toujours) : appeler
// /api/reseller/me directement faisait une requête refusée (401 visiteur,
// 403 admin/fournisseur/livreur) à chaque page affichant des produits.
let promesseCode: Promise<string | null> | null = null;

export function useCodeRevendeur(): string | null {
  const [code, setCode] = useState<string | null>(null);
  useEffect(() => {
    let annule = false;
    promesseCode ??= fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((moi) => (moi?.authenticated && moi.role === 'reseller' ? fetch('/api/reseller/me') : null))
      .then((r) => (r && r.ok ? r.json() : null))
      .then((j) => j?.reseller?.referralCode || null)
      .catch(() => null);
    promesseCode.then((c) => { if (!annule) setCode(c); });
    return () => { annule = true; };
  }, []);
  return code;
}
