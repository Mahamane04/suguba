'use client';

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

export async function genererAffiche(
  p: ProduitAPartager,
  code: string | null,
  { theme = 'vert', format = 'story' }: { theme?: ThemeAffiche; format?: FormatAffiche } = {},
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

  // En-tête
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = t.texte;
  ctx.font = `900 52px ${POLICE}`;
  ctx.fillText('SUGUBA', marge, 110);
  ctx.font = `700 30px ${POLICE}`;
  const etiquette = 'Livré à Bamako';
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
    const echelle = Math.max(cadre.l / photo.width, cadre.h / photo.height);
    const lp = photo.width * echelle;
    const hp = photo.height * echelle;
    ctx.drawImage(photo, cadre.x + (cadre.l - lp) / 2, cadre.y + (cadre.h - hp) / 2, lp, hp);
  } else {
    // Pas de photo : le logo au centre plutôt qu'un cadre vide.
    const logo = await chargerImage('/icon-512.png');
    if (logo) {
      const taille = Math.min(cadre.l, cadre.h) * 0.45;
      ctx.drawImage(logo, cadre.x + (cadre.l - taille) / 2, cadre.y + (cadre.h - taille) / 2, taille, taille);
    }
  }
  ctx.restore();

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
  ctx.fillText('Commandez ici :', marge + 40, yPied + (format === 'story' ? 64 : 50));
  const adresse = lienProduit(p.slug, code).replace(/^https?:\/\//, '');
  ctx.fillStyle = texteClair;
  ajuster(ctx, adresse, L - 2 * marge - 80, format === 'story' ? 42 : 36, '800');
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
