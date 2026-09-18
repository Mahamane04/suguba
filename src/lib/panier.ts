'use client';

import { useEffect, useState } from 'react';

/**
 * Panier du client, gardé sur l'appareil — même schéma que les autres
 * stores (valeur de module + écouteurs + hook), voir src/lib/store.ts.
 *
 * Le panier ne contient QUE des identifiants et des quantités : jamais de
 * prix. Les prix sont recalculés par le serveur à chaque affichage
 * (/api/orders/cart-quote) et à la validation — un prix gardé en local
 * mentirait dès que le fournisseur le change.
 */

export interface ArticlePanier {
  productId: string;
  quantity: number;
}

const CLE = 'suguba_panier';
const MAX_LIGNES = 20;
const MAX_QUANTITE = 50;

let articles: ArticlePanier[] = [];
let charge = false;
const ecouteurs = new Set<() => void>();

function charger() {
  if (charge || typeof window === 'undefined') return;
  charge = true;
  try {
    const brut = JSON.parse(localStorage.getItem(CLE) || '[]');
    if (Array.isArray(brut)) {
      articles = brut
        .filter((a) => typeof a?.productId === 'string' && Number.isInteger(a.quantity) && a.quantity > 0)
        .slice(0, MAX_LIGNES);
    }
  } catch { articles = []; }
}

function publier(suivant: ArticlePanier[]) {
  articles = suivant;
  try { localStorage.setItem(CLE, JSON.stringify(articles)); } catch { /* navigation privée : panier de session */ }
  ecouteurs.forEach((e) => e());
}

export function ajouterAuPanier(productId: string, quantite = 1): 'ajoute' | 'plein' {
  charger();
  const existant = articles.find((a) => a.productId === productId);
  if (existant) {
    publier(articles.map((a) => (a.productId === productId ? { ...a, quantity: Math.min(MAX_QUANTITE, a.quantity + quantite) } : a)));
    return 'ajoute';
  }
  if (articles.length >= MAX_LIGNES) return 'plein';
  publier([...articles, { productId, quantity: Math.min(MAX_QUANTITE, Math.max(1, quantite)) }]);
  return 'ajoute';
}

export function changerQuantite(productId: string, quantite: number) {
  charger();
  if (quantite <= 0) { retirerDuPanier(productId); return; }
  publier(articles.map((a) => (a.productId === productId ? { ...a, quantity: Math.min(MAX_QUANTITE, quantite) } : a)));
}

export function retirerDuPanier(productId: string) {
  charger();
  publier(articles.filter((a) => a.productId !== productId));
}

export function viderPanier() {
  charger();
  publier([]);
}

/** Articles du panier. Vide au premier rendu (serveur), rempli après montage. */
export function usePanier(): ArticlePanier[] {
  const [valeur, setValeur] = useState<ArticlePanier[]>([]);
  useEffect(() => {
    charger();
    setValeur(articles);
    const ecouter = () => setValeur(articles);
    ecouteurs.add(ecouter);
    // Un autre onglet a modifié le panier : on suit.
    const surStockage = (e: StorageEvent) => {
      if (e.key !== CLE) return;
      charge = false;
      charger();
      ecouteurs.forEach((f) => f());
    };
    window.addEventListener('storage', surStockage);
    return () => { ecouteurs.delete(ecouter); window.removeEventListener('storage', surStockage); };
  }, []);
  return valeur;
}
