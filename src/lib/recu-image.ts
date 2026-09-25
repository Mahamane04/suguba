import QRCode from 'qrcode';
import type { RecuCommande } from './recu-commande';
import { contenuQrRemise } from './qr-remise';

/**
 * Image du reçu client (2026-09-25), dessinée dans le téléphone (canvas),
 * pour être enregistrée dans la galerie et présentée au livreur même sans
 * connexion. Aucune photo produit (image d'un autre domaine = toile
 * « contaminée », export impossible) ; tout le reste y est : numéro, articles,
 * montants, QR de remise et code écrit dessous, date d'édition.
 */

const L = 1080;
const MARGE = 72;
const PROFOND = '#0B3B2C';
const TEXTE = '#0f172a';
const GRIS = '#475569';
const POLICE = 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
const fcfa = (n: number) => `${Math.round(n).toLocaleString('fr-FR').replace(/ | /g, ' ')} F`;
const date = (iso: string) => new Date(iso).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' });

function couper(ctx: CanvasRenderingContext2D, texte: string, largeur: number): string[] {
  const lignes: string[] = [];
  let ligne = '';
  for (const m of texte.split(' ')) {
    const essai = ligne ? `${ligne} ${m}` : m;
    if (ctx.measureText(essai).width > largeur && ligne) { lignes.push(ligne); ligne = m; } else ligne = essai;
  }
  if (ligne) lignes.push(ligne);
  return lignes;
}

function dessiner(ctx: CanvasRenderingContext2D, r: RecuCommande, qr: HTMLCanvasElement | null): number {
  let y = 0;
  const texte = (t: string, taille: number, o: { gras?: boolean; couleur?: string; centre?: boolean; droite?: boolean; x?: number; mono?: boolean } = {}) => {
    ctx.font = `${o.gras ? '700' : '400'} ${taille}px ${o.mono ? 'ui-monospace, Menlo, monospace' : POLICE}`;
    ctx.fillStyle = o.couleur || TEXTE;
    ctx.textAlign = o.centre ? 'center' : o.droite ? 'right' : 'left';
    ctx.fillText(t, o.centre ? L / 2 : o.droite ? L - MARGE : (o.x ?? MARGE), y);
  };
  const trait = () => { ctx.fillStyle = '#e2e8f0'; ctx.fillRect(MARGE, y, L - 2 * MARGE, 2); };

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  // Bandeau
  ctx.fillStyle = PROFOND; ctx.fillRect(0, 0, L, 190);
  y = 92; texte('SUGUBA', 56, { gras: true, couleur: '#ffffff' });
  texte(`N° ${r.orderNumber}`, 34, { gras: true, couleur: '#ffffff', droite: true });
  y = 146; texte('Reçu de commande', 32, { couleur: '#C7F464' });
  texte(new Date(r.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }), 28, { couleur: '#ffffff', droite: true });
  y = 190;

  // QR + code écrit dessous (secours si le scan échoue)
  if (qr) {
    y += 50;
    ctx.drawImage(qr, (L - qr.width) / 2, y);
    y += qr.height + 60;
    texte('CODE DE REMISE', 26, { gras: true, couleur: GRIS, centre: true });
    y += 72; texte(r.code!.split('').join(' '), 64, { gras: true, centre: true, mono: true });
    y += 62;
    for (const l of ['Présentez ce QR au livreur uniquement après avoir', 'vérifié votre colis. Ne l’envoyez pas au livreur à l’avance.']) {
      texte(l, 28, { couleur: '#92400e', centre: true }); y += 40;
    }
  } else {
    y += 90;
    texte(r.livre ? `Livrée le ${r.deliveredAt ? date(r.deliveredAt) : ''}` : 'Cette commande n’attend plus de remise.', 36, { gras: true, centre: true, couleur: r.livre ? '#047857' : GRIS });
    y += 30;
  }

  // Articles
  y += 30; trait(); y += 60;
  texte('Articles', 30, { gras: true }); y += 50;
  for (const a of r.articles) {
    const annule = ['cancelled', 'returned'].includes(a.status);
    const couleur = annule ? GRIS : TEXTE;
    ctx.font = `400 30px ${POLICE}`;
    const lignes = couper(ctx, `${a.quantity > 1 ? `${a.quantity} × ` : ''}${a.productName}${annule ? ' (annulé)' : ''}`, L - 2 * MARGE - 220);
    lignes.forEach((l, i) => { texte(l, 30, { couleur }); if (i === 0) texte(fcfa(a.articles), 30, { droite: true, couleur }); y += 42; });
    y += 8;
  }
  y += 10; trait(); y += 56;
  texte('Livraison', 30, { couleur: GRIS }); texte(fcfa(r.totalLivraison), 30, { droite: true, couleur: GRIS }); y += 52;
  texte('Total', 36, { gras: true }); texte(fcfa(r.total), 36, { gras: true, droite: true }); y += 62;

  const regle = r.payeEnLigne || r.resteAPayer === 0;
  ctx.fillStyle = regle ? '#ecfdf5' : '#fffbeb';
  ctx.fillRect(MARGE, y - 46, L - 2 * MARGE, 70);
  const couleurPaiement = regle ? '#047857' : '#92400e';
  texte(r.payeEnLigne ? 'Payé en ligne (Mobile Money)' : r.resteAPayer > 0 ? 'À payer au livreur' : 'Réglé', 30, { gras: true, x: MARGE + 24, couleur: couleurPaiement });
  if (!regle) {
    ctx.font = `700 30px ${POLICE}`; ctx.textAlign = 'right'; ctx.fillStyle = couleurPaiement;
    ctx.fillText(fcfa(r.resteAPayer), L - MARGE - 24, y);
  }
  y += 80;

  // Destinataire et assistance
  trait(); y += 60;
  texte('Destinataire', 26, { couleur: GRIS }); y += 42;
  texte(r.destinataire || '—', 30, { gras: true }); y += 42;
  if (r.lieu) { texte(r.lieu, 28, { couleur: GRIS }); y += 42; }
  y += 20;
  texte('Service client : WhatsApp +223 89 46 00 00', 28); y += 42;
  texte(`Donnez le numéro ${r.orderNumber} pour toute question.`, 26, { couleur: GRIS }); y += 60;
  texte(`Édité le ${date(r.editeLe)} — l’état à jour est dans votre suivi.`, 22, { couleur: '#94a3b8', centre: true });
  return y + 50;
}

export async function dessinerRecu(r: RecuCommande): Promise<Blob> {
  let qr: HTMLCanvasElement | null = null;
  if (r.code) {
    qr = document.createElement('canvas');
    await QRCode.toCanvas(qr, contenuQrRemise(r.orderNumber, r.code), {
      width: 560, margin: 2, errorCorrectionLevel: 'M', color: { dark: TEXTE, light: '#ffffff' },
    });
  }

  // Première passe sur une toile haute pour connaître la hauteur réelle.
  const brouillon = document.createElement('canvas');
  brouillon.width = L; brouillon.height = 4000;
  const hauteur = dessiner(brouillon.getContext('2d')!, r, qr);

  const toile = document.createElement('canvas');
  toile.width = L; toile.height = hauteur;
  dessiner(toile.getContext('2d')!, r, qr);
  return new Promise((ok, ko) => toile.toBlob((b) => (b ? ok(b) : ko(new Error('Image impossible'))), 'image/png'));
}
