export const FORMATS = {
  jpg: { label: 'JPG', mime: 'image/jpeg', extension: '.jpg' },
  png: { label: 'PNG', mime: 'image/png', extension: '.png' },
  webp: { label: 'WebP', mime: 'image/webp', extension: '.webp' },
  avif: { label: 'AVIF', mime: 'image/avif', extension: '.avif' },
} as const;

export type ImageFormat = keyof typeof FORMATS;
export const FORMAT_ORDER = Object.keys(FORMATS) as ImageFormat[];
export const INPUT_LIMIT = 16 * 1024 ** 2;
export const OUTPUT_LIMIT = 64 * 1024 ** 2;
export const SIDE_LIMIT = 8192;
export const PIXEL_LIMIT = 16_000_000;
const CHUNK_LIMIT = 4096;
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10];

export interface Dimensions { width: number; height: number }
export type ContainerError = 'empty' | 'unsupported' | 'animated' | 'damaged' | 'complex' | 'headerLimit';
type Failure<Code extends string> = { ok: false; code: Code };
type Success<Value> = { ok: true; value: Value };
const fail = <Code extends string>(code: Code): Failure<Code> => ({ ok: false, code });
const success = <Value>(value: Value): Success<Value> => ({ ok: true, value });

type Header = Dimensions & { format: ImageFormat };
type ContainerResult = Success<Header> | Failure<ContainerError>;

export function withinImageLimits({ width, height }: Dimensions): boolean {
  return Number.isInteger(width) && Number.isInteger(height) && width > 0 && height > 0
    && width <= SIDE_LIMIT && height <= SIDE_LIMIT && width * height <= PIXEL_LIMIT;
}

export function inputSizeError(size: number): 'inputLimit' | 'empty' | null {
  if (size === 0) return 'empty';
  return size > INPUT_LIMIT ? 'inputLimit' : null;
}

function header(format: ImageFormat, width: number, height: number): ContainerResult {
  if (!width || !height) return fail('damaged');
  const value = { format, width, height };
  return withinImageLimits(value) ? success(value) : fail('headerLimit');
}

function matches(bytes: Uint8Array, start: number, name: string): boolean {
  if (start + name.length > bytes.length) return false;
  for (let index = 0; index < name.length; index++) {
    if (bytes[start + index] !== name.charCodeAt(index)) return false;
  }
  return true;
}

function jpeg(bytes: Uint8Array, view: DataView): ContainerResult {
  let offset = 2;
  let dimensions: ContainerResult | undefined;
  for (let count = 0; offset < bytes.length; count++) {
    if (count >= CHUNK_LIMIT) return fail('complex');
    if (bytes[offset++] !== 0xff) return fail('damaged');
    while (offset < bytes.length && bytes[offset] === 0xff) offset++;
    if (offset + 3 > bytes.length) return fail('damaged');
    const marker = bytes[offset++];
    if (marker === 0x00 || marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) return fail('damaged');
    if (marker === 0x01) continue;
    const size = view.getUint16(offset);
    if (size < 2 || size > bytes.length - offset) return fail('damaged');
    if (marker === 0xda) {
      if (!dimensions || size < 8 || size !== 6 + 2 * bytes[offset + 2]) return fail('damaged');
      // Entropy data is decoded by the browser. Locate the end marker to catch incomplete transfers.
      for (let end = bytes.length - 1; end > offset + size; end--) {
        if (bytes[end] === 0xd9 && bytes[end - 1] === 0xff) return dimensions;
      }
      return fail('damaged');
    }
    const isFrame = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
    if (isFrame) {
      if (dimensions || size < 11 || size !== 8 + 3 * bytes[offset + 7]) return fail('damaged');
      dimensions = header('jpg', view.getUint16(offset + 5), view.getUint16(offset + 3));
      if (!dimensions.ok) return dimensions;
    }
    offset += size;
  }
  return fail('damaged');
}

function png(bytes: Uint8Array, view: DataView): ContainerResult {
  if (bytes.length < 33 || !matches(bytes, 12, 'IHDR') || view.getUint32(8) !== 13) return fail('damaged');
  const dimensions = header('png', view.getUint32(16), view.getUint32(20));
  if (!dimensions.ok) return dimensions;

  let offset = 33;
  let hasData = false;
  for (let count = 1; offset < bytes.length; count++) {
    if (count >= CHUNK_LIMIT) return fail('complex');
    if (bytes.length - offset < 12) return fail('damaged');
    const size = view.getUint32(offset);
    if (size > bytes.length - offset - 12) return fail('damaged');
    const name = offset + 4;
    offset += 12 + size;
    if (matches(bytes, name, 'acTL') || matches(bytes, name, 'fcTL') || matches(bytes, name, 'fdAT')) return fail('animated');
    if (matches(bytes, name, 'IHDR')) return fail('damaged');
    if (matches(bytes, name, 'IDAT')) hasData = true;
    if (matches(bytes, name, 'IEND')) return size === 0 && offset === bytes.length && hasData ? dimensions : fail('damaged');
  }
  return fail('damaged');
}

function webp(bytes: Uint8Array, view: DataView): ContainerResult {
  if (view.getUint32(4, true) + 8 !== bytes.length) return fail('damaged');
  let offset = 12;
  let extended: Dimensions | undefined;
  let frame: Dimensions | undefined;
  for (let count = 0; offset < bytes.length; count++) {
    if (count >= CHUNK_LIMIT) return fail('complex');
    if (bytes.length - offset < 8) return fail('damaged');
    const size = view.getUint32(offset + 4, true);
    const start = offset + 8;
    const padding = size % 2;
    if (size + padding > bytes.length - start || (padding && bytes[start + size] !== 0)) return fail('damaged');
    if (matches(bytes, offset, 'ANIM') || matches(bytes, offset, 'ANMF')) return fail('animated');
    if (matches(bytes, offset, 'VP8X')) {
      if (size !== 10) return fail('damaged');
      if (bytes[start] & 0x02) return fail('animated');
      if (offset !== 12 || extended) return fail('damaged');
      // The overlapping reads end on the last byte of the 10-byte chunk.
      const width = (view.getUint32(start + 3, true) >>> 8) + 1;
      const height = (view.getUint32(start + 6, true) >>> 8) + 1;
      const result = header('webp', width, height);
      if (!result.ok) return result;
      extended = result.value;
    } else if (matches(bytes, offset, 'VP8 ')) {
      if (frame || size < 10 || (bytes[start] & 1) || !matches(bytes, start + 3, '\x9d\x01\x2a')) return fail('damaged');
      frame = { width: view.getUint16(start + 6, true) & 0x3fff, height: view.getUint16(start + 8, true) & 0x3fff };
    } else if (matches(bytes, offset, 'VP8L')) {
      if (frame || size < 5 || bytes[start] !== 0x2f) return fail('damaged');
      const bits = view.getUint32(start + 1, true);
      if (bits >>> 29) return fail('damaged');
      frame = { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
    }
    offset = start + size + padding;
  }
  if (!frame || (extended && (extended.width !== frame.width || extended.height !== frame.height))) return fail('damaged');
  return header('webp', frame.width, frame.height);
}

function avif(bytes: Uint8Array, view: DataView): ContainerResult {
  let count = 0;
  let branded = false;
  let dimensions: Header | undefined;
  const path = ['meta', 'iprp', 'ipco', 'ispe'];
  function walk(start: number, end: number, depth: number): ContainerError | undefined {
    for (let offset = start; offset < end;) {
      if (++count > CHUNK_LIMIT) return 'complex';
      if (end - offset < 8) return 'damaged';
      const name = offset + 4;
      let body = offset + 8;
      let size = view.getUint32(offset);
      if (size === 1) {
        if (end - offset < 16 || view.getUint32(offset + 8) !== 0) return 'damaged';
        size = view.getUint32(offset + 12);
        body += 8;
      } else if (size === 0) {
        size = end - offset;
      }
      if (size < body - offset || size > end - offset) return 'damaged';
      const next = offset + size;
      if (depth === 0 && matches(bytes, name, 'moov')) return 'animated';
      if (depth === 0 && matches(bytes, name, 'ftyp')) {
        if (branded || next - body < 8 || (next - body) % 4) return 'damaged';
        branded = matches(bytes, body, 'avif');
        if (matches(bytes, body, 'avis')) return 'animated';
        for (let brand = body + 8; brand < next; brand += 4) {
          if (matches(bytes, brand, 'avis')) return 'animated';
          branded ||= matches(bytes, brand, 'avif');
        }
        if (!branded) return 'unsupported';
      } else if (matches(bytes, name, path[depth])) {
        if (depth === path.length - 1) {
          if (next - body !== 12 || view.getUint32(body) !== 0) return 'damaged';
          const result = header('avif', view.getUint32(body + 4), view.getUint32(body + 8));
          if (!result.ok) return result.code;
          dimensions ??= result.value;
        } else {
          const child = body + (depth === 0 ? 4 : 0);
          if (child > next) return 'damaged';
          const error = walk(child, next, depth + 1);
          if (error) return error;
        }
      }
      offset = next;
    }
  }
  const error = walk(0, bytes.length, 0);
  if (error) return fail(error);
  if (!branded) return fail('unsupported');
  return dimensions ? success(dimensions) : fail('damaged');
}

export function inspectImage(bytes: Uint8Array): ContainerResult {
  if (!bytes.length) return fail('empty');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return jpeg(bytes, view);
  if (PNG_SIGNATURE.every((value, index) => bytes[index] === value)) return png(bytes, view);
  if (matches(bytes, 0, 'RIFF') && matches(bytes, 8, 'WEBP')) return webp(bytes, view);
  if (matches(bytes, 4, 'ftyp')) return avif(bytes, view);
  if (matches(bytes, 0, 'GIF87a') || matches(bytes, 0, 'GIF89a')) return fail('animated');
  return fail('unsupported');
}

export function verifyOutput(format: ImageFormat, mime: string, bytes: Uint8Array) {
  if (bytes.length > OUTPUT_LIMIT) return fail('outputLimit');
  if (mime !== FORMATS[format].mime) return fail('outputFormat');
  const detected = inspectImage(bytes);
  if (!detected.ok && detected.code === 'headerLimit') return fail('outputLimit');
  return detected.ok && detected.value.format === format ? detected : fail('outputFormat');
}

export interface RawOptions {
  format: ImageFormat;
  quality: string | number;
  maxWidth: string;
  maxHeight: string;
  background: 'white' | 'custom';
  color: string;
}

export const DEFAULT_OPTIONS = {
  quality: 85, maxWidth: '', maxHeight: '', background: 'white', color: '#E8EEF5',
} as const;

type Field = 'quality' | 'maxWidth' | 'maxHeight' | 'color';
type Options = Dimensions & { format: ImageFormat; quality?: number; background?: string };

function dimension(raw: string): number {
  const value = raw.trim();
  if (!value) return Infinity;
  return /^[0-9]{1,4}$/.test(value) && Number(value) >= 1 && Number(value) <= SIDE_LIMIT ? Number(value) : NaN;
}

export function fitImage(image: Dimensions, maxWidth: number, maxHeight: number): Dimensions {
  const { width, height } = image;
  if (maxWidth >= width && maxHeight >= height) return { width, height };
  if (maxWidth * height <= maxHeight * width) {
    return { width: maxWidth, height: Math.max(1, Math.floor(height * maxWidth / width)) };
  }
  return { width: Math.max(1, Math.floor(width * maxHeight / height)), height: maxHeight };
}

export function validateOptions(raw: RawOptions, source: Dimensions): Success<Options> | { ok: false; fields: Field[] } {
  const fields: Field[] = [];
  const width = dimension(raw.maxWidth);
  const height = dimension(raw.maxHeight);
  const quality = typeof raw.quality === 'string' && !/^[0-9]{1,3}$/.test(raw.quality.trim()) ? NaN : Number(raw.quality);
  const custom = raw.format === 'jpg' && raw.background === 'custom';
  const color = raw.color.trim();
  if (Number.isNaN(width)) fields.push('maxWidth');
  if (Number.isNaN(height)) fields.push('maxHeight');
  if (raw.format !== 'png' && (!Number.isInteger(quality) || quality < 0 || quality > 100)) fields.push('quality');
  if (custom && !/^#[0-9a-f]{6}$/i.test(color)) fields.push('color');
  if (fields.length) return { ok: false, fields };

  const value: Options = { format: raw.format, ...fitImage(source, width, height) };
  if (raw.format !== 'png') value.quality = quality / 100;
  if (raw.format === 'jpg') value.background = custom ? color.toUpperCase() : '#FFFFFF';
  return success(value);
}

export function downloadName(input: string, format: ImageFormat): string {
  const base = (input.split(/[\\/]/).at(-1) ?? '')
    .replace(/[\p{Cc}\u061c\u200e\u200f\u202a-\u202e\u2066-\u206f]/gu, '')
    .replace(/[\ud800-\udfff]/gu, '')
    .replace(/[\s.]+$/u, '').trimStart()
    .replace(/\.(?:jpe?g|png|webp|avif)$/i, '')
    .replace(/[<>:"|?*]/g, '_')
    .replace(/[\s.]+$/u, '').trimStart();
  const utf8 = new TextEncoder();
  let stored = '';
  let length = 0;
  for (const character of base) {
    length += utf8.encode(character).length;
    if (length > 120) break;
    stored += character;
  }
  stored = stored.replace(/[\s.]+$/u, '');
  const reserved = /^(?:CON|PRN|AUX|NUL|CONIN\$|CONOUT\$|COM[1-9¹²³]|LPT[1-9¹²³])\s*(?:\.|$)/i;
  const name = !stored || reserved.test(stored) ? 'image' : stored;
  return name + '-converted' + FORMATS[format].extension;
}

export function formatBytes(bytes: number, locale: string): string {
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  const magnitude = Math.abs(bytes);
  const [unit, divisor] = magnitude >= 1024 ** 2 ? ['MiB', 1024 ** 2] as const
    : magnitude >= 1024 ? ['KiB', 1024] as const : ['B', 1] as const;
  return (bytes < 0 ? '−' : '') + number.format(magnitude / divisor) + ' ' + unit;
}

export function compareBytes(source: number, result: number, locale: string) {
  if (!Number.isSafeInteger(source) || source <= 0 || !Number.isSafeInteger(result) || result < 0) return fail('invalidSize');
  const difference = result - source;
  const value = difference / source;
  const number = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 2 });
  return success({
    difference,
    direction: difference < 0 ? 'smaller' as const : difference > 0 ? 'larger' as const : 'same' as const,
    bytes: (difference > 0 ? '+' : '') + formatBytes(difference, locale),
    exactBytes: (difference < 0 ? '−' : difference > 0 ? '+' : '') + new Intl.NumberFormat(locale).format(Math.abs(difference)) + ' B',
    percent: (value < 0 ? '−' : value > 0 ? '+' : '') + number.format(Math.abs(value)),
  });
}
