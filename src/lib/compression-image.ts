'use client';

/**
 * Allège une photo AVANT son envoi (2026-09-11).
 *
 * Une photo de téléphone pèse souvent 4 à 12 Mo : au-delà de 5 Mo, le serveur
 * la refusait (voir /api/products/upload-image) — le fournisseur devait
 * retoucher sa photo lui-même, ou renoncait. Et chaque client la
 * téléchargeait ensuite en entier dans les partages WhatsApp, avec une data
 * mobile qui coûte cher.
 *
 * Réduite à 1600 px sur le grand côté, en JPEG qualité 0,82 : environ
 * 200 à 400 Ko, sans perte visible sur un écran de téléphone.
 *
 * En cas de problème (format que le navigateur ne sait pas lire, canvas
 * indisponible), on renvoie le fichier d'origine : la compression ne doit
 * jamais empêcher un envoi.
 */

const COTE_MAX = 1600;
const QUALITE = 0.82;
// En dessous de ce poids et de cette taille, la photo est déjà légère : on n'y touche pas.
const POIDS_DEJA_LEGER = 400 * 1024;

function chargerDansImg(fichier: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(fichier);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image illisible.')); };
    img.src = url;
  });
}

export async function compresserImage(fichier: File): Promise<File> {
  if (!fichier.type.startsWith('image/')) return fichier;
  try {
    // createImageBitmap applique l'orientation EXIF (photo prise en portrait).
    const source: ImageBitmap | HTMLImageElement = typeof createImageBitmap === 'function'
      ? await createImageBitmap(fichier).catch(() => chargerDansImg(fichier))
      : await chargerDansImg(fichier);

    const { width, height } = source;
    const echelle = Math.min(1, COTE_MAX / Math.max(width, height));
    if (echelle === 1 && fichier.size <= POIDS_DEJA_LEGER) return fichier;

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * echelle);
    canvas.height = Math.round(height * echelle);
    const ctx = canvas.getContext('2d');
    if (!ctx) return fichier;
    // Un PNG transparent deviendrait noir en JPEG : fond blanc d'abord.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    if ('close' in source) source.close();

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITE));
    if (!blob || blob.size >= fichier.size) return fichier;

    const nom = `${fichier.name.replace(/\.[^.]+$/, '') || 'photo'}.jpg`;
    return new File([blob], nom, { type: 'image/jpeg', lastModified: Date.now() });
  } catch {
    return fichier;
  }
}
