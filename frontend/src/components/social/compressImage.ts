import i18n from '@/i18n.ts';

export const MAX_SOURCE_IMAGE_BYTES = 20 * 1024 * 1024;
export const MAX_SOCIAL_IMAGE_BYTES = 1024 * 1024;
export const SOCIAL_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const DIMENSIONS = [1600, 1280, 1024, 800, 640, 512, 384, 256];
const QUALITIES = [0.85, 0.7, 0.55];

function jpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error(i18n.t('social.compression_failed'))),
      'image/jpeg',
      quality,
    );
  });
}

export async function compressSocialImage(file: File): Promise<Blob> {
  if (file.size > MAX_SOURCE_IMAGE_BYTES || !SOCIAL_IMAGE_TYPES.includes(file.type)) {
    throw new Error(i18n.t('social.invalid_photo'));
  }

  const url = URL.createObjectURL(file);
  const image = new Image();
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error(i18n.t('social.compression_failed')));
      image.src = url;
    });
    if (image.naturalWidth * image.naturalHeight > 25_000_000) {
      throw new Error(i18n.t('social.compression_failed'));
    }
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error(i18n.t('social.compression_failed'));

    for (const maxDimension of DIMENSIONS) {
      const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      for (const quality of QUALITIES) {
        const blob = await jpeg(canvas, quality);
        if (blob.size <= MAX_SOCIAL_IMAGE_BYTES) return blob;
      }
    }
    throw new Error(i18n.t('social.compression_failed'));
  } finally {
    URL.revokeObjectURL(url);
  }
}
