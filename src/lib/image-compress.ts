import { downloadName, fitImage, formatBytes, OUTPUT_LIMIT, SIDE_LIMIT, type Dimensions, type ImageFormat } from './image-convert.ts';

export type CompressionFormat = Exclude<ImageFormat, 'avif'>;
export type CompressionMode = 'quality' | 'target';
export type TargetUnit = 'B' | 'KiB';

export interface RawSettings {
  mode: CompressionMode;
  quality: string;
  maxWidth: string;
  maxHeight: string;
  target: string;
  unit: TargetUnit;
  allowResize: boolean;
}

export const MAX_FIELD_LENGTH = 32;
export const DEFAULT_SETTINGS: RawSettings = {
  mode: 'quality', quality: '85', maxWidth: '', maxHeight: '', target: '', unit: 'KiB', allowResize: true,
};

export type NumericField = 'quality' | 'maxWidth' | 'maxHeight' | 'target';
export type EncodingTier = Dimensions & { format: CompressionFormat; quality?: number };
type Settings = { first: Dimensions; quality?: number; targetBytes?: number; allowResize: boolean };
export type Candidate = { tier: EncodingTier; bytes: number };

function wholeNumber(raw: string, min: number, max: number, empty = NaN): number {
  if (raw.length > MAX_FIELD_LENGTH) return NaN;
  const text = raw.trim();
  if (!text) return empty;
  const number = /^[0-9]+$/.test(text) ? Number(text) : NaN;
  return number >= min && number <= max ? number : NaN;
}

export function validateSettings(raw: RawSettings, source: Dimensions, format: CompressionFormat):
  { ok: true; value: Settings } | { ok: false; fields: NumericField[] } {
  const targeting = raw.mode === 'target';
  const divisor = raw.unit === 'KiB' ? 1024 : 1;
  const width = wholeNumber(raw.maxWidth, 1, SIDE_LIMIT, Infinity);
  const height = wholeNumber(raw.maxHeight, 1, SIDE_LIMIT, Infinity);
  const quality = format === 'png' ? undefined : wholeNumber(raw.quality, 0, 100);
  const target = targeting ? wholeNumber(raw.target, 1, OUTPUT_LIMIT / divisor) * divisor : undefined;
  const fields: NumericField[] = [];
  if (Number.isNaN(width)) fields.push('maxWidth');
  if (Number.isNaN(height)) fields.push('maxHeight');
  if (Number.isNaN(quality)) fields.push('quality');
  if (Number.isNaN(target)) fields.push('target');
  if (fields.length) return { ok: false, fields };

  return {
    ok: true,
    value: { first: fitImage(source, width, height), quality, targetBytes: target, allowResize: targeting && raw.allowResize },
  };
}

export function encodingTiers(settings: Settings, format: CompressionFormat): EncodingTier[] {
  const { first, quality, targetBytes, allowResize } = settings;
  const scales = allowResize ? [100, 75, 50, 25] : [100];
  const qualityScales = targetBytes === undefined ? [100] : [100, 80, 60, 40, 20, 0];
  const qualities = quality === undefined ? [undefined] : [...new Set(qualityScales.map(scale => Math.round(quality * scale / 100) / 100))];
  const sizes = new Set<string>();
  return scales.flatMap(scale => {
    const width = Math.max(1, Math.floor(first.width * scale / 100));
    const height = Math.max(1, Math.floor(first.height * scale / 100));
    const key = `${width}x${height}`;
    if (sizes.has(key)) return [];
    sizes.add(key);
    return qualities.map(value => value === undefined ? { width, height, format } : { width, height, format, quality: value });
  });
}

export function retainCandidate<T extends Candidate>(best: T | null, next: T, targetBytes?: number) {
  const valid = Number.isSafeInteger(next.bytes) && next.bytes > 0 && next.bytes <= OUTPUT_LIMIT;
  // Tiers arrive in preference order, so an equal-size candidate keeps the earlier tier.
  return {
    best: valid && (!best || next.bytes < best.bytes) ? next : best,
    stop: valid && (targetBytes === undefined || next.bytes <= targetBytes),
  };
}

export function targetOutcome(sourceBytes: number, resultBytes: number, targetBytes?: number) {
  if (targetBytes === undefined) return { state: 'off' } as const;
  return {
    state: resultBytes <= targetBytes ? 'met' : 'missed',
    targetBytes,
    excess: Math.max(0, resultBytes - targetBytes),
    originalFits: sourceBytes <= targetBytes,
  } as const;
}

export function sizeChange(source: number, result: number, locale: string) {
  if (!Number.isSafeInteger(source) || source <= 0 || !Number.isSafeInteger(result) || result <= 0) return null;
  const saved = source - result;
  const percent = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 2 });
  return {
    saved,
    rate: saved / source,
    direction: saved > 0 ? 'smaller' : saved < 0 ? 'larger' : 'same',
    percent: percent.format(Math.abs(saved / source)),
    bytes: exactBytes(Math.abs(saved), locale),
  } as const;
}

export function exactBytes(bytes: number, locale: string): string {
  return new Intl.NumberFormat(locale).format(bytes) + ' B';
}

export function detailedBytes(bytes: number, locale: string): string {
  const exact = exactBytes(bytes, locale);
  const readable = formatBytes(bytes, locale);
  return exact === readable ? exact : `${readable} (${exact})`;
}

export function compressedName(input: string, format: CompressionFormat): string {
  return downloadName(input, format).replace(/-converted(\.[^.]+)$/, '-compressed$1');
}
