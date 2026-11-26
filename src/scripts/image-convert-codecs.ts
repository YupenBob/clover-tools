import {
  DEFAULT_OPTIONS, FORMATS, OUTPUT_LIMIT, verifyOutput, withinImageLimits,
  type Dimensions, type ImageFormat, type validateOptions,
} from '../lib/image-convert';

export interface DecodedImage extends Dimensions {
  drawable: CanvasImageSource;
  release: () => void;
}

export type Capability = 'available' | 'unavailable' | 'alphaUnavailable';
type EncodeError = 'errorCanvas' | 'capacity' | 'errorEncode' | 'outputLimit' | 'outputFormat' | 'outputDimensions';
type ValidOptions = Extract<ReturnType<typeof validateOptions>, { ok: true }>['value'];

export async function decodeImage(blob: Blob): Promise<DecodedImage> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
      return { width: bitmap.width, height: bitmap.height, drawable: bitmap, release: () => bitmap.close() };
    } catch {
      // The browser's image element can support formats unavailable to ImageBitmap.
    }
  }

  const url = URL.createObjectURL(blob);
  const image = new Image();
  const release = () => {
    image.removeAttribute('src');
    URL.revokeObjectURL(url);
  };
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Image decoding failed'));
      image.src = url;
    });
    return { width: image.naturalWidth, height: image.naturalHeight, drawable: image, release };
  } catch (error) {
    release();
    throw error;
  } finally {
    image.onload = null;
    image.onerror = null;
  }
}

function toBlob(canvas: HTMLCanvasElement, format: ImageFormat, quality?: number): Promise<Blob | null> {
  const mime = FORMATS[format].mime;
  return new Promise(resolve => {
    if (quality === undefined) canvas.toBlob(resolve, mime);
    else canvas.toBlob(resolve, mime, quality);
  });
}

function releaseCanvas(canvas: HTMLCanvasElement): void {
  canvas.width = 0;
  canvas.height = 0;
}

export function hasCanvas(): boolean {
  const canvas = document.createElement('canvas');
  try {
    return typeof canvas.toBlob === 'function' && Boolean(canvas.getContext('2d'));
  } catch {
    return false;
  } finally {
    releaseCanvas(canvas);
  }
}

export async function probeFormat(format: ImageFormat): Promise<Capability> {
  const canvas = document.createElement('canvas');
  canvas.width = 2;
  canvas.height = 2;
  try {
    const context = canvas.getContext('2d');
    if (!context) return 'unavailable';
    context.fillStyle = '#296A9B';
    context.fillRect(1, 0, 1, 2);
    const blob = await toBlob(canvas, format, format === 'png' ? undefined : DEFAULT_OPTIONS.quality / 100);
    if (!blob || blob.size > OUTPUT_LIMIT) return 'unavailable';
    const check = verifyOutput(format, blob.type, new Uint8Array(await blob.arrayBuffer()));
    if (!check.ok) return 'unavailable';

    const decoded = await decodeImage(blob);
    try {
      if (decoded.width !== canvas.width || decoded.height !== canvas.height) return 'unavailable';
      if (format === 'jpg') return 'available';
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(decoded.drawable, 0, 0);
      const pixels = context.getImageData(0, 0, canvas.width, 1).data;
      return pixels[3] === 0 && pixels[7] === 255 ? 'available' : 'alphaUnavailable';
    } finally {
      decoded.release();
    }
  } catch {
    return 'unavailable';
  } finally {
    releaseCanvas(canvas);
  }
}

export async function encodeImage(source: DecodedImage, options: ValidOptions):
Promise<{ ok: true; blob: Blob } | { ok: false; code: EncodeError }> {
  if (!withinImageLimits(options)) return { ok: false, code: 'outputLimit' };
  const { width, height, format, quality, background } = options;
  const canvas = document.createElement('canvas');
  let blob: Blob | null;
  try {
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return { ok: false, code: hasCanvas() ? 'capacity' : 'errorCanvas' };
    if (background) {
      context.fillStyle = background;
      context.fillRect(0, 0, width, height);
    }
    context.imageSmoothingQuality = 'high';
    context.drawImage(source.drawable, 0, 0, width, height);
    blob = await toBlob(canvas, format, quality);
  } catch (error) {
    return { ok: false, code: error instanceof RangeError ? 'capacity' : 'errorEncode' };
  } finally {
    releaseCanvas(canvas);
  }

  if (!blob) return { ok: false, code: 'errorEncode' };
  if (blob.size > OUTPUT_LIMIT) return { ok: false, code: 'outputLimit' };
  if (blob.size === 0) return { ok: false, code: 'errorEncode' };
  try {
    const check = verifyOutput(format, blob.type, new Uint8Array(await blob.arrayBuffer()));
    if (!check.ok) return check;
    const decoded = await decodeImage(blob);
    try {
      if (decoded.width !== width || decoded.height !== height) return { ok: false, code: 'outputDimensions' };
      return { ok: true, blob };
    } finally {
      decoded.release();
    }
  } catch (error) {
    return { ok: false, code: error instanceof RangeError ? 'capacity' : 'outputDimensions' };
  }
}
