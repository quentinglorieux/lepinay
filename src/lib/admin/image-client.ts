// Compression des images dans le navigateur avant envoi : 2400 px maximum,
// JPEG qualité 0.82, métadonnées (dont GPS) supprimées par le réencodage.
const MAX_SIDE = 2400;
const QUALITY = 0.82;
const MAX_BYTES = 5 * 1024 * 1024;

const isHeic = (f: File) => /hei[cf]/i.test(f.type) || /\.(heic|heif)$/i.test(f.name);

async function decode(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch (e) {
    if (!isHeic(file)) throw e;
    // Chrome et Firefox ne lisent pas le HEIC des iPhone : conversion à la demande.
    const { default: heic2any } = await import('heic2any');
    const jpeg = (await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 })) as Blob;
    return createImageBitmap(jpeg, { imageOrientation: 'from-image' });
  }
}

const toBlob = (canvas: HTMLCanvasElement, type: string, quality?: number) =>
  new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Conversion impossible'))), type, quality),
  );

export async function compressImage(file: File): Promise<{ blob: Blob; name: string; width: number; height: number }> {
  const bitmap = await decode(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  // Les PNG (logos, plans avec transparence) restent en PNG s'ils ne sont pas trop lourds.
  let type = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
  let blob = await toBlob(canvas, type, type === 'image/jpeg' ? QUALITY : undefined);
  if (type === 'image/png' && blob.size > MAX_BYTES) {
    type = 'image/jpeg';
    blob = await toBlob(canvas, type, QUALITY);
  }
  const ext = type === 'image/png' ? '.png' : '.jpg';
  const name = file.name.replace(/\.[^.]+$/, '') + ext;
  return { blob, name, width, height };
}

export const isImageFile = (f: File) => f.type.startsWith('image/') || isHeic(f);
