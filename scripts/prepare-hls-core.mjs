/** Self-host the single-thread WASM core. Every file stays below Pages' 25 MiB limit. */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HLS_CONFIG, hlsCorePath } from '../config/hls.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const packageDir = join(root, 'node_modules/@ffmpeg/core');
const version = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8')).version;
if (version !== HLS_CONFIG.core.version) throw new Error('FFmpeg package version does not match config/hls.mjs');
const directory = join(root, 'public', hlsCorePath());
mkdirSync(directory, { recursive: true });
function write(name, bytes) {
  const file = join(directory, name);
  if (!existsSync(file) || !readFileSync(file).equals(Buffer.from(bytes))) writeFileSync(file, bytes);
}
write('ffmpeg-core.js', readFileSync(join(packageDir, 'dist/esm/ffmpeg-core.js')));
const wasm = readFileSync(join(packageDir, 'dist/esm/ffmpeg-core.wasm'));
const size = HLS_CONFIG.core.shardBytes;
const parts = [];
for (let offset = 0; offset < wasm.length; offset += size) {
  const bytes = wasm.subarray(offset, offset + size);
  const name = `core-${parts.length}.bin`;
  write(name, bytes);
  parts.push({ name, size: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
}
write('manifest.json', JSON.stringify({ version, bytes: wasm.length, parts }, null, 2) + '\n');
console.log(`HLS core ${version}: ${(wasm.length / 1048576).toFixed(1)} MiB, ${parts.length} local shards`);
