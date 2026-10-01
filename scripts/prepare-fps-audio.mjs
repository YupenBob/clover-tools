import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { FPS_AUDIO_ASSETS, FPS_AUDIO_SOURCES, FPS_AUDIO_ENCODING } from '../config/fps-audio.mjs';

// Explicit offline input; never called by build/CI and never fetches unpinned media.
const root = fileURLToPath(new URL('../', import.meta.url));
const input = process.env.FPS_AUDIO_INPUT_DIR;
if (!input)
  throw new Error(
    'Set FPS_AUDIO_INPUT_DIR to a directory with firearms/<original> and mechanical/<original>.',
  );
const encoder = process.env.FPS_AUDIO_FFMPEG || 'ffmpeg';
const hash = (buffer) => createHash('sha256').update(buffer).digest('hex');
const manifest = { encoding: FPS_AUDIO_ENCODING, sources: FPS_AUDIO_SOURCES, assets: {} };
for (const [id, asset] of Object.entries(FPS_AUDIO_ASSETS)) {
  const source = resolve(input, asset.source, asset.original);
  if (hash(readFileSync(source)) !== asset.originalSha256)
    throw new Error(`Unverified source recording: ${asset.original}`);
  const output = resolve(root, 'public', asset.file.slice(1));
  mkdirSync(dirname(output), { recursive: true });
  const c = FPS_AUDIO_ENCODING;
  execFileSync(encoder, [
    '-v',
    'error',
    '-y',
    '-ss',
    String(asset.start),
    '-i',
    source,
    '-t',
    String(asset.duration),
    '-af',
    c.filter.replace('{fadeStart}', String(asset.duration - c.fadeSeconds)),
    '-ar',
    String(c.sampleRate),
    '-ac',
    String(c.channels),
    '-c:a',
    c.codec,
    '-map_metadata',
    '-1',
    output,
  ]);
  manifest.assets[id] = {
    ...asset,
    originalSha256: hash(readFileSync(source)),
    sha256: hash(readFileSync(output)),
    bytes: readFileSync(output).length,
  };
}
writeFileSync(
  resolve(root, 'public/fps/audio/manifest.json'),
  JSON.stringify(manifest, null, 2) + '\n',
);
console.log(`Prepared ${Object.keys(manifest.assets).length} local CC0 derivatives.`);
