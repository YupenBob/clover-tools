import { concatManifest, remuxArgs } from '../lib/hls/playlist';
import { HLS_CONFIG } from '../../config/hls.mjs';

let core: any;
let logs: string[] = [];
let stdout: string[] = [];
const scope = self as unknown as DedicatedWorkerGlobalScope;

async function loadCore(base: string): Promise<void> {
  const response = await fetch(`${base}/manifest.json`);
  if (!response.ok) throw new Error('coreLoadError');
  const manifest = await response.json();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  for (const part of manifest.parts) {
    const response = await fetch(`${base}/${part.name}`);
    if (!response.ok) throw new Error('coreLoadError');
    const bytes = new Uint8Array(await response.arrayBuffer());
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (value) => value.toString(16).padStart(2, '0')).join('');
    if (bytes.length !== part.size || hash !== part.sha256) throw new Error('coreLoadError');
    chunks.push(bytes); loaded += bytes.length;
    scope.postMessage({ event: 'loading', progress: loaded / manifest.bytes });
  }
  const wasmBinary = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) { wasmBinary.set(chunk, offset); offset += chunk.length; }
  const { default: createCore } = await import(/* @vite-ignore */ `${base}/ffmpeg-core.js`);
  core = await createCore({ wasmBinary });
  core.setLogger(({ message, type }: { message: string; type: string }) => { logs.push(message); if (logs.length > HLS_CONFIG.worker.diagnosticLines) logs.shift(); if (type === 'stdout') stdout.push(message); });
  core.setProgress(({ progress }: { progress: number }) => scope.postMessage({ event: 'progress', progress }));
}

scope.onmessage = async ({ data }) => {
  const { id, action } = data;
  try {
    let result: any;
    if (action === 'load') await loadCore(data.base);
    else if (action === 'write') core.FS.writeFile(data.name, new Uint8Array(data.bytes));
    else if (action === 'probe') {
      stdout = [];
      core.reset(); core.setTimeout(HLS_CONFIG.worker.probeTimeoutMs);
      const code = core.ffprobe('-v', 'error', '-show_entries', 'stream=codec_name,codec_type', '-of', 'json', data.name);
      try {
        const info = JSON.parse(stdout.join('\n'));
        // core 0.12.x leaves ret at -1 after a successful ffprobe; valid JSON streams are required too.
        result = (code === 0 || code === -1) && info.streams?.some((stream: any) => ['video', 'audio'].includes(stream.codec_type) && stream.codec_name);
      } catch { result = false; }
      if (!result) core.FS.unlink(data.name);
    }
    else if (action === 'remux') {
      logs = [];
      core.FS.writeFile('input.ffconcat', new TextEncoder().encode(concatManifest(data.files)));
      core.reset();
      core.setTimeout(HLS_CONFIG.worker.remuxTimeoutMs);
      const code = core.exec(...remuxArgs(data.format));
      if (code !== 0) throw new Error('remuxError: ' + logs.slice(-6).join('\n'));
      result = core.FS.readFile(`output.${data.format}`).slice().buffer;
      if (!result.byteLength) throw new Error('remuxError');
    } else throw new Error('remuxError');
    scope.postMessage({ id, result }, result instanceof ArrayBuffer ? [result] : []);
  } catch (error) { scope.postMessage({ id, error: (error as Error).message }); }
};
