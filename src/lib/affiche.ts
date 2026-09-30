'use client';

import QRCode from 'qrcode';
import { lienProduit, type ProduitAPartager } from '@/lib/partage';

/**
 * Affiche de vente d'un produit, dessinée dans le navigateur (2026-09-11) —
 * format statut WhatsApp (1080×1920) ou carré (1080×1080). Aucune
 * bibliothèque : le canvas du navigateur suffit, et rien ne part sur un
 * serveur.
 *
 * Remplace le générateur précédent, qui écrivait sur l'affiche le code et le
 * téléphone d'un revendeur FICTIF (données de démonstration), et annonçait
 * « flyer généré » alors qu'aucune image n'avait été produite quand la photo
 * ne se chargeait pas.
 *
 * Sur l'affiche : photo, nom, prix, « payez à la livraison », l'adresse de
 * commande et le code du revendeur. Jamais son numéro de téléphone : c'est
 * Suguba qui prend la commande et qui livre.
 */

export type ThemeAffiche = 'vert' | 'clair' | 'nuit';
export type FormatAffiche = 'story' | 'carre';

export interface IdentiteBoutique {
  nom: string;
  accroche?: string | null;
  logo?: string | null;
  couverture?: string | null;
  slug: string;
}

export interface ProduitCarteBoutique {
  nom: string;
  prix: number;
  image?: string | null;
}

const THEMES: Record<ThemeAffiche, { fond: [string, string]; texte: string; secondaire: string; prix: string; pastille: string; pastilleTexte: string }> = {
  vert: { fond: ['#0a8f00', '#054d00'], texte: '#ffffff', secondaire: '#d9fbd6', prix: '#ffffff', pastille: 'rgba(255,255,255,0.16)', pastilleTexte: '#ffffff' },
  clair: { fond: ['#ffffff', '#eef7ee'], texte: '#0f172a', secondaire: '#475569', prix: '#09b500', pastille: '#e6fee6', pastilleTexte: '#065f00' },
  nuit: { fond: ['#0f172a', '#020617'], texte: '#ffffff', secondaire: '#cbd5e1', prix: '#4ade80', pastille: 'rgba(255,255,255,0.10)', pastilleTexte: '#ffffff' },
};

const POLICE = '-apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

function chargerImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function rectangleArrondi(ctx: CanvasRenderingContext2D, x: number, y: number, l: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + l, y, x + l, y + h, r);
  ctx.arcTo(x + l, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + l, y, r);
  ctx.closePath();
}

function dessinerImageCouverte(ctx: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, l: number, h: number) {
  const echelle = Math.max(l / image.width, h / image.height);
  const lp = image.width * echelle;
  const hp = image.height * echelle;
  ctx.drawImage(image, x + (l - lp) / 2, y + (h - hp) / 2, lp, hp);
}

/** Découpe un texte en au plus `maxLignes` lignes, avec « … » si ça déborde. */
function lignes(ctx: CanvasRenderingContext2D, texte: string, largeur: number, maxLignes: number): string[] {
  const mots = texte.split(/\s+/);
  const resultat: string[] = [];
  let courante = '';
  for (const mot of mots) {
    const essai = courante ? `${courante} ${mot}` : mot;
    if (ctx.measureText(essai).width <= largeur) { courante = essai; continue; }
    if (courante) resultat.push(courante);
    courante = mot;
    if (resultat.length === maxLignes) break;
  }
  if (resultat.length < maxLignes && courante) resultat.push(courante);
  if (resultat.length > maxLignes) resultat.length = maxLignes;
  const reste = mots.join(' ') !== resultat.join(' ');
  if (reste && resultat.length) {
    let derniere = resultat[resultat.length - 1];
    while (derniere.length > 1 && ctx.measureText(`${derniere}…`).width > largeur) derniere = derniere.slice(0, -1);
    resultat[resultat.length - 1] = `${derniere.trimEnd()}…`;
  }
  return resultat;
}

/** Réduit la police jusqu'à ce que le texte tienne sur une ligne. */
function ajuster(ctx: CanvasRenderingContext2D, texte: string, largeur: number, taille: number, graisse: string, min = 22) {
  let t = taille;
  ctx.font = `${graisse} ${t}px ${POLICE}`;
  while (t > min && ctx.measureText(texte).width > largeur) {
    t -= 2;
    ctx.font = `${graisse} ${t}px ${POLICE}`;
  }
}

export interface OptionsAffiche {
  theme?: ThemeAffiche;
  format?: FormatAffiche;
  /**
   * Adresse de commande imprimée sur l'affiche. Par défaut l'URL produit ;
   * le créateur de contenus y passe le lien tracké (/go/<code>) pour que
   * chaque affiche compte ses propres visites (§ 15 du cahier des charges).
   */
  lien?: string | null;
  /** Ajoute le QR code de ce même lien dans le pied de l'affiche. */
  qr?: boolean;
  /** Bandeau promotionnel (« -10 % ce week-end »), 40 caractères max. */
  promo?: string | null;
  /** Identité visuelle du revendeur, sans téléphone ni adresse. */
  boutique?: IdentiteBoutique | null;
}

export async function genererAffiche(
  p: ProduitAPartager,
  code: string | null,
  { theme = 'vert', format = 'story', lien = null, qr = false, promo = null, boutique = null }: OptionsAffiche = {},
): Promise<File> {
  if (!(p.prix > 0)) {
    throw new Error("Ce produit n'est pas encore en vente (prix non fixé) : pas d'affiche possible.");
  }
  const L = 1080;
  const H = format === 'story' ? 1920 : 1080;
  const marge = 60;
  const t = THEMES[theme];

  const canvas = document.createElement('canvas');
  canvas.width = L;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas indisponible sur cet appareil.');

  // Fond
  const degrade = ctx.createLinearGradient(0, 0, 0, H);
  degrade.addColorStop(0, t.fond[0]);
  degrade.addColorStop(1, t.fond[1]);
  ctx.fillStyle = degrade;
  ctx.fillRect(0, 0, L, H);

  // En-tête : identité de la boutique quand elle existe, signature Suguba
  // toujours visible pour préserver la confiance et le parcours de commande.
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = t.texte;
  if (boutique) {
    const logo = boutique.logo ? await chargerImage(boutique.logo) : null;
    const tailleLogo = 78;
    ctx.save();
    rectangleArrondi(ctx, marge, 42, tailleLogo, tailleLogo, 22);
    ctx.clip();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(marge, 42, tailleLogo, tailleLogo);
    if (logo) dessinerImageCouverte(ctx, logo, marge, 42, tailleLogo, tailleLogo);
    else {
      ctx.fillStyle = '#d9fbd6';
      ctx.fillRect(marge, 42, tailleLogo, tailleLogo);
      ctx.fillStyle = '#054d00';
      ctx.font = `900 40px ${POLICE}`;
      ctx.textAlign = 'center';
      ctx.fillText(boutique.nom.charAt(0).toUpperCase(), marge + tailleLogo / 2, 95);
      ctx.textAlign = 'left';
    }
    ctx.restore();
    ctx.fillStyle = t.texte;
    ajuster(ctx, boutique.nom, 510, 38, '900', 24);
    ctx.fillText(boutique.nom, marge + tailleLogo + 22, 78);
    ctx.font = `700 24px ${POLICE}`;
    ctx.fillStyle = t.secondaire;
    ctx.fillText('Boutique partenaire Suguba', marge + tailleLogo + 22, 111);
  } else {
    ctx.font = `900 52px ${POLICE}`;
    ctx.fillText('SUGUBA', marge, 110);
  }
  ctx.font = `700 28px ${POLICE}`;
  const etiquette = boutique ? 'Commandez sur Suguba' : 'Livré à Bamako';
  const lEtiquette = ctx.measureText(etiquette).width + 48;
  ctx.fillStyle = t.pastille;
  rectangleArrondi(ctx, L - marge - lEtiquette, 62, lEtiquette, 64, 32);
  ctx.fill();
  ctx.fillStyle = t.pastilleTexte;
  ctx.fillText(etiquette, L - marge - lEtiquette + 24, 106);

  // Photo (recadrée pour remplir le cadre, sans déformation)
  const cadre = format === 'story'
    ? { x: marge, y: 170, l: L - 2 * marge, h: L - 2 * marge }
    : { x: marge, y: 160, l: L - 2 * marge, h: 480 };
  ctx.save();
  rectangleArrondi(ctx, cadre.x, cadre.y, cadre.l, cadre.h, 48);
  ctx.clip();
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(cadre.x, cadre.y, cadre.l, cadre.h);
  const photo = p.images[0] ? await chargerImage(p.images[0]) : null;
  if (photo) {
    dessinerImageCouverte(ctx, photo, cadre.x, cadre.y, cadre.l, cadre.h);
  } else {
    // Pas de photo : le logo au centre plutôt qu'un cadre vide.
    const logo = await chargerImage('/icon-512.png');
    if (logo) {
      const taille = Math.min(cadre.l, cadre.h) * 0.45;
      ctx.drawImage(logo, cadre.x + (cadre.l - taille) / 2, cadre.y + (cadre.h - taille) / 2, taille, taille);
    }
  }
  ctx.restore();

  const textePromo = (promo || '').trim().slice(0, 40);
  if (textePromo) {
    ctx.font = `900 ${format === 'story' ? 40 : 34}px ${POLICE}`;
    const lPromo = ctx.measureText(textePromo).width + 56;
    const hPromo = format === 'story' ? 76 : 66;
    ctx.fillStyle = '#e11d48';
    rectangleArrondi(ctx, cadre.x + 28, cadre.y + 28, lPromo, hPromo, hPromo / 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillText(textePromo, cadre.x + 56, cadre.y + 28 + hPromo * 0.66);
  }

  // Nom (2 lignes max)
  let y = cadre.y + cadre.h + (format === 'story' ? 110 : 90);
  ctx.fillStyle = t.texte;
  ctx.font = `800 ${format === 'story' ? 64 : 54}px ${POLICE}`;
  for (const ligne of lignes(ctx, p.nom, L - 2 * marge, 2)) {
    ctx.fillText(ligne, marge, y);
    y += format === 'story' ? 78 : 64;
  }

  // Prix
  y += format === 'story' ? 50 : 30;
  ctx.fillStyle = t.prix;
  ctx.font = `900 ${format === 'story' ? 130 : 96}px ${POLICE}`;
  ctx.fillText(`${p.prix.toLocaleString('fr-FR')} F`, marge, y);

  // Pastilles de réassurance
  y += format === 'story' ? 70 : 50;
  ctx.font = `700 ${format === 'story' ? 34 : 30}px ${POLICE}`;
  let x = marge;
  for (const texte of ['✓ Payez à la livraison', '✓ Livraison rapide']) {
    const l = ctx.measureText(texte).width + 44;
    ctx.fillStyle = t.pastille;
    rectangleArrondi(ctx, x, y, l, format === 'story' ? 68 : 58, 34);
    ctx.fill();
    ctx.fillStyle = t.pastilleTexte;
    ctx.fillText(texte, x + 22, y + (format === 'story' ? 46 : 40));
    x += l + 16;
  }

  // Pied : où commander, et le code du revendeur
  const hauteurPied = format === 'story' ? 210 : 150;
  const yPied = H - marge - hauteurPied;
  ctx.fillStyle = theme === 'clair' ? '#0f172a' : 'rgba(255,255,255,0.12)';
  rectangleArrondi(ctx, marge, yPied, L - 2 * marge, hauteurPied, 40);
  ctx.fill();
  const texteClair = '#ffffff';
  ctx.fillStyle = theme === 'clair' ? '#94a3b8' : t.secondaire;
  ctx.font = `600 ${format === 'story' ? 32 : 28}px ${POLICE}`;
  ctx.fillText(qr ? 'Scannez ou tapez :' : 'Commandez ici :', marge + 40, yPied + (format === 'story' ? 64 : 50));
  const urlComplete = lien || lienProduit(p.slug, code);
  const adresse = urlComplete.replace(/^https?:\/\//, '');

  // QR code du même lien, à droite du pied : un client au marché scanne
  // l'affiche imprimée au lieu de recopier une adresse.
  let largeurQr = 0;
  if (qr) {
    const tailleQr = hauteurPied - 36;
    try {
      const donnees = await QRCode.toDataURL(urlComplete, { width: tailleQr * 2, margin: 1, color: { dark: '#0f172a', light: '#ffffff' } });
      const imageQr = await chargerImage(donnees);
      if (imageQr) {
        const xQr = L - marge - 18 - tailleQr;
        ctx.fillStyle = '#ffffff';
        rectangleArrondi(ctx, xQr - 6, yPied + 12, tailleQr + 12, tailleQr + 12, 20);
        ctx.fill();
        ctx.drawImage(imageQr, xQr, yPied + 18, tailleQr, tailleQr);
        largeurQr = tailleQr + 40;
      }
    } catch {
      // QR impossible : l'affiche reste valable avec l'adresse seule.
    }
  }

  ctx.fillStyle = texteClair;
  ajuster(ctx, adresse, L - 2 * marge - 80 - largeurQr, format === 'story' ? 42 : 36, '800');
  ctx.fillText(adresse, marge + 40, yPied + (format === 'story' ? 120 : 96));
  if (code) {
    ctx.fillStyle = theme === 'clair' ? '#4ade80' : t.secondaire;
    ctx.font = `700 ${format === 'story' ? 32 : 28}px ${POLICE}`;
    ctx.fillText(`Code revendeur : ${code}`, marge + 40, yPied + (format === 'story' ? 172 : 134));
  }

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
  if (!blob) throw new Error("L'affiche n'a pas pu être créée.");
  return new File([blob], `suguba-${p.slug}-${format}.jpg`, { type: 'image/jpeg' });
}

/** Carte de boutique prête à partager : couverture, identité, trois offres et QR. */
export async function genererCarteBoutique(
  boutique: IdentiteBoutique,
  produits: ProduitCarteBoutique[],
  { format = 'story', lien, qr = true }: Pick<OptionsAffiche, 'format' | 'lien' | 'qr'> = {},
): Promise<File> {
  const L = 1080;
  const H = format === 'story' ? 1920 : 1080;
  const marge = 60;
  const canvas = document.createElement('canvas');
  canvas.width = L;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas indisponible sur cet appareil.');

  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, L, H);

  const couvertureH = format === 'story' ? 540 : 340;
  const couverture = boutique.couverture ? await chargerImage(boutique.couverture) : null;
  if (couverture) dessinerImageCouverte(ctx, couverture, 0, 0, L, couvertureH);
  else {
    const degrade = ctx.createLinearGradient(0, 0, L, couvertureH);
    degrade.addColorStop(0, '#143e30');
    degrade.addColorStop(1, '#09b500');
    ctx.fillStyle = degrade;
    ctx.fillRect(0, 0, L, couvertureH);
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    for (let x = 40; x < L; x += 80) for (let y = 40; y < couvertureH; y += 80) {
      ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
    }
  }
  const voile = ctx.createLinearGradient(0, 0, 0, couvertureH);
  voile.addColorStop(0, 'rgba(15,23,42,0.05)');
  voile.addColorStop(1, 'rgba(15,23,42,0.72)');
  ctx.fillStyle = voile;
  ctx.fillRect(0, 0, L, couvertureH);

  ctx.fillStyle = '#ffffff';
  ctx.font = `900 38px ${POLICE}`;
  ctx.fillText('SUGUBA', marge, 72);
  ctx.font = `700 24px ${POLICE}`;
  ctx.fillText('Boutique partenaire', marge, 108);

  const logoTaille = format === 'story' ? 190 : 150;
  const logoY = couvertureH - logoTaille / 2;
  ctx.save();
  rectangleArrondi(ctx, marge, logoY, logoTaille, logoTaille, 42);
  ctx.clip();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(marge, logoY, logoTaille, logoTaille);
  const logo = boutique.logo ? await chargerImage(boutique.logo) : null;
  if (logo) dessinerImageCouverte(ctx, logo, marge, logoY, logoTaille, logoTaille);
  else {
    ctx.fillStyle = '#d9fbd6';
    ctx.fillRect(marge, logoY, logoTaille, logoTaille);
    ctx.fillStyle = '#143e30';
    ctx.font = `900 ${format === 'story' ? 88 : 70}px ${POLICE}`;
    ctx.textAlign = 'center';
    ctx.fillText(boutique.nom.charAt(0).toUpperCase(), marge + logoTaille / 2, logoY + logoTaille * 0.68);
    ctx.textAlign = 'left';
  }
  ctx.restore();

  const identiteX = marge + logoTaille + 34;
  ctx.fillStyle = '#0f172a';
  ajuster(ctx, boutique.nom, L - identiteX - marge, format === 'story' ? 58 : 48, '900', 30);
  ctx.fillText(boutique.nom, identiteX, couvertureH + 42);
  ctx.fillStyle = '#475569';
  ctx.font = `600 ${format === 'story' ? 30 : 26}px ${POLICE}`;
  const accroche = (boutique.accroche || 'Découvrez notre sélection et commandez sur Suguba.').slice(0, 100);
  for (const [index, ligne] of lignes(ctx, accroche, L - identiteX - marge, 2).entries()) {
    ctx.fillText(ligne, identiteX, couvertureH + 87 + index * 38);
  }

  const selection = produits.filter((p) => p.prix > 0).slice(0, 3);
  const yProduits = couvertureH + (format === 'story' ? 230 : 180);
  ctx.fillStyle = '#143e30';
  ctx.font = `900 ${format === 'story' ? 38 : 32}px ${POLICE}`;
  ctx.fillText(selection.length ? 'Nos offres du moment' : 'Notre boutique vous attend', marge, yProduits - 34);

  if (format === 'story') {
    for (const [index, produit] of selection.entries()) {
      const y = yProduits + index * 250;
      ctx.fillStyle = '#ffffff';
      rectangleArrondi(ctx, marge, y, L - 2 * marge, 220, 36);
      ctx.fill();
      const image = produit.image ? await chargerImage(produit.image) : null;
      ctx.save(); rectangleArrondi(ctx, marge + 18, y + 18, 184, 184, 28); ctx.clip();
      ctx.fillStyle = '#eef2f7'; ctx.fillRect(marge + 18, y + 18, 184, 184);
      if (image) dessinerImageCouverte(ctx, image, marge + 18, y + 18, 184, 184);
      ctx.restore();
      ctx.fillStyle = '#0f172a';
      ctx.font = `800 34px ${POLICE}`;
      lignes(ctx, produit.nom, 650, 2).forEach((ligne, i) => ctx.fillText(ligne, marge + 235, y + 72 + i * 42));
      ctx.fillStyle = '#087700';
      ctx.font = `900 44px ${POLICE}`;
      ctx.fillText(`${Math.round(produit.prix).toLocaleString('fr-FR')} F`, marge + 235, y + 174);
    }
  } else {
    const largeur = (L - 2 * marge - 32) / 3;
    for (const [index, produit] of selection.entries()) {
      const x = marge + index * (largeur + 16);
      ctx.fillStyle = '#ffffff'; rectangleArrondi(ctx, x, yProduits, largeur, 300, 28); ctx.fill();
      const image = produit.image ? await chargerImage(produit.image) : null;
      ctx.save(); rectangleArrondi(ctx, x + 14, yProduits + 14, largeur - 28, 165, 20); ctx.clip();
      ctx.fillStyle = '#eef2f7'; ctx.fillRect(x + 14, yProduits + 14, largeur - 28, 165);
      if (image) dessinerImageCouverte(ctx, image, x + 14, yProduits + 14, largeur - 28, 165);
      ctx.restore();
      ctx.fillStyle = '#0f172a'; ctx.font = `800 24px ${POLICE}`;
      lignes(ctx, produit.nom, largeur - 28, 2).forEach((ligne, i) => ctx.fillText(ligne, x + 14, yProduits + 215 + i * 29));
      ctx.fillStyle = '#087700'; ctx.font = `900 27px ${POLICE}`;
      ctx.fillText(`${Math.round(produit.prix).toLocaleString('fr-FR')} F`, x + 14, yProduits + 282);
    }
  }

  const urlComplete = lien || `${window.location.origin}/boutique/${boutique.slug}`;
  const hauteurPied = format === 'story' ? 220 : 150;
  const yPied = H - marge - hauteurPied;
  ctx.fillStyle = '#143e30'; rectangleArrondi(ctx, marge, yPied, L - 2 * marge, hauteurPied, 38); ctx.fill();
  ctx.fillStyle = '#d9fbd6'; ctx.font = `700 ${format === 'story' ? 30 : 25}px ${POLICE}`;
  ctx.fillText(qr ? 'Scannez pour visiter la boutique' : 'Visitez la boutique', marge + 36, yPied + 58);
  const adresse = urlComplete.replace(/^https?:\/\//, '');
  ctx.fillStyle = '#ffffff';
  ajuster(ctx, adresse, L - 2 * marge - (qr ? 260 : 72), format === 'story' ? 36 : 30, '800');
  ctx.fillText(adresse, marge + 36, yPied + (format === 'story' ? 120 : 104));
  if (qr) {
    const tailleQr = hauteurPied - 34;
    const donnees = await QRCode.toDataURL(urlComplete, { width: tailleQr * 2, margin: 1, color: { dark: '#0f172a', light: '#ffffff' } });
    const imageQr = await chargerImage(donnees);
    if (imageQr) {
      const xQr = L - marge - tailleQr - 17;
      ctx.fillStyle = '#ffffff'; rectangleArrondi(ctx, xQr - 6, yPied + 11, tailleQr + 12, tailleQr + 12, 20); ctx.fill();
      ctx.drawImage(imageQr, xQr, yPied + 17, tailleQr, tailleQr);
    }
  }

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
  if (!blob) throw new Error("La carte de boutique n'a pas pu être créée.");
  return new File([blob], `suguba-boutique-${boutique.slug}-${format}.jpg`, { type: 'image/jpeg' });
}

export type ResultatAffiche = 'partage' | 'annule' | 'telecharge';

/**
 * Partage l'affiche déjà prête (appeler depuis un clic : le partage natif exige
 * un geste récent, d'où la génération faite AVANT, à l'ouverture de l'aperçu).
 * Sans partage de fichiers (ordinateur), l'image est téléchargée.
 */
export async function partagerAffiche(fichier: File, texte: string): Promise<ResultatAffiche> {
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  const donnees: ShareData = { files: [fichier], text: texte };
  if (typeof nav.share === 'function' && nav.canShare?.(donnees)) {
    try {
      await nav.share(donnees);
      return 'partage';
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') return 'annule';
    }
  }
  telechargerAffiche(fichier);
  return 'telecharge';
}

export function telechargerAffiche(fichier: File) {
  const url = URL.createObjectURL(fichier);
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = fichier.name;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
