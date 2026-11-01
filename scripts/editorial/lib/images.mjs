/** 图片尺寸与哈希读取（PNG/JPEG/GIF/WebP/SVG），供 CI 校验登记一致性。 */
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { basename } from 'node:path';

function pngDimensions(buffer) {
  if (buffer.length < 24) return null;
  if (buffer.readUInt32BE(0) !== 0x89504e47) return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function jpegDimensions(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    const length = buffer.readUInt16BE(offset + 2);
    const isSof = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
    if (isSof) {
      return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
    }
    offset += 2 + length;
  }
  return null;
}

function gifDimensions(buffer) {
  if (buffer.length < 10) return null;
  if (buffer.subarray(0, 3).toString('ascii') !== 'GIF') return null;
  return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
}

function webpDimensions(buffer) {
  if (buffer.length < 30) return null;
  if (buffer.subarray(0, 4).toString('ascii') !== 'RIFF' || buffer.subarray(8, 12).toString('ascii') !== 'WEBP') return null;
  const chunk = buffer.subarray(12, 16).toString('ascii');
  if (chunk === 'VP8X') {
    return { width: 1 + buffer.readUIntLE(24, 3), height: 1 + buffer.readUIntLE(27, 3) };
  }
  if (chunk === 'VP8 ') {
    const width = buffer.readUInt16LE(26) & 0x3fff;
    const height = buffer.readUInt16LE(28) & 0x3fff;
    return { width, height };
  }
  return null;
}

function svgDimensions(buffer) {
  const text = buffer.subarray(0, 2048).toString('utf8');
  if (!/<svg\b/i.test(text)) return null;
  const width = Number((text.match(/\bwidth=["']([\d.]+)/i) ?? [])[1]);
  const height = Number((text.match(/\bheight=["']([\d.]+)/i) ?? [])[1]);
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
  return { width, height };
}

export function detectDimensions(buffer, file = '') {
  const ext = String(file).toLowerCase();
  if (ext.endsWith('.png')) return pngDimensions(buffer);
  if (ext.endsWith('.jpg') || ext.endsWith('.jpeg')) return jpegDimensions(buffer);
  if (ext.endsWith('.gif')) return gifDimensions(buffer);
  if (ext.endsWith('.webp')) return webpDimensions(buffer);
  if (ext.endsWith('.svg')) return svgDimensions(buffer);
  return pngDimensions(buffer) ?? jpegDimensions(buffer) ?? gifDimensions(buffer) ?? webpDimensions(buffer) ?? svgDimensions(buffer);
}

export function readImageInfo(file) {
  if (!existsSync(file)) return null;
  const buffer = readFileSync(file);
  const dimensions = detectDimensions(buffer, file);
  return {
    file: basename(file),
    width: dimensions?.width ?? null,
    height: dimensions?.height ?? null,
    bytes: buffer.length,
    sha256: createHash('sha256').update(buffer).digest('hex'),
  };
}
