import sharp from 'sharp';

/** REQ-005 / TEST-AUD-UPLOAD : décodage borné et réencodage sans métadonnées. */
export async function normaliserImage(file: File): Promise<Buffer> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size === 0 || file.size > 5 * 1024 * 1024) throw new Error('IMAGE_INVALID');
  const bytes = Buffer.from(await file.arrayBuffer());
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const webp = bytes.toString('ascii',0,4) === 'RIFF' && bytes.toString('ascii',8,12) === 'WEBP';
  if (!(jpeg || png || webp)) throw new Error('IMAGE_INVALID');
  const image = sharp(bytes, { limitInputPixels: 16_000_000, failOn: 'warning' });
  const metadata = await image.metadata();
  if (!metadata.width || !metadata.height || metadata.width > 6000 || metadata.height > 6000 || (metadata.pages || 1) > 1) throw new Error('IMAGE_INVALID');
  // webp() retire EXIF/GPS et tout contenu annexe ; l’image complète doit se décoder.
  return image.rotate().webp({ quality: 85 }).toBuffer();
}
