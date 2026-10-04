export type RGB = [number, number, number];
export type HSL = [number, number, number];

export function parseHex(value: string): RGB | null {
  let hex = value.trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(hex)) hex = [...hex].map((ch) => ch + ch).join('');
  if (!/^[0-9a-f]{6}$/i.test(hex)) return null;
  return [0, 2, 4].map((index) => parseInt(hex.slice(index, index + 2), 16)) as RGB;
}

function unwrap(value: string, name: string): string {
  const text = value.trim();
  const match = text.match(new RegExp(`^${name}\\(\\s*(.*?)\\s*\\)$`, 'i'));
  return match ? match[1] : text;
}

export function parseRgb(value: string): RGB | null {
  const match = unwrap(value, 'rgb').match(/^(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})$/);
  if (!match) return null;
  const rgb = match.slice(1).map(Number) as RGB;
  return rgb.every((channel) => channel <= 255) ? rgb : null;
}

export function parseHsl(value: string): HSL | null {
  const match = unwrap(value, 'hsl').match(
    /^(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)%\s*,\s*(\d+(?:\.\d+)?)%$/,
  );
  if (!match) return null;
  const hsl = match.slice(1).map(Number) as HSL;
  return hsl.every(Number.isFinite) && hsl[0] <= 360 && hsl[1] <= 100 && hsl[2] <= 100 ? hsl : null;
}

export function rgbToHex([r, g, b]: RGB): string {
  return (
    '#' + [r, g, b].map((channel) => Math.round(channel).toString(16).padStart(2, '0')).join('')
  );
}

export function rgbToHsl([r, g, b]: RGB): HSL {
  const [red, green, blue] = [r, g, b].map((channel) => channel / 255);
  const max = Math.max(red, green, blue),
    min = Math.min(red, green, blue),
    delta = max - min;
  const lightness = (max + min) / 2;
  if (delta === 0) return [0, 0, lightness * 100];
  const hue =
    max === red
      ? (green - blue) / delta + (green < blue ? 6 : 0)
      : max === green
        ? (blue - red) / delta + 2
        : (red - green) / delta + 4;
  return [hue * 60, (delta / (1 - Math.abs(2 * lightness - 1))) * 100, lightness * 100];
}

export function hslToRgb([h, s, l]: HSL): RGB {
  const hue = ((h % 360) + 360) % 360,
    saturation = s / 100,
    lightness = l / 100;
  const channel = (n: number) => {
    const k = (n + hue / 30) % 12;
    const a = saturation * Math.min(lightness, 1 - lightness);
    return Math.round(255 * (lightness - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return [channel(0), channel(8), channel(4)];
}

/** Pick readable sample text using linear-light relative luminance. */
export function previewInk(rgb: RGB): string {
  const linear = rgb.map((value) => {
    const v = value / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  const luminance = linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
  return (luminance + 0.05) / 0.05 >= 1.05 / (luminance + 0.05) ? '#000000' : '#ffffff';
}
