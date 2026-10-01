import { concatManifest, remuxArgs } from '../lib/hls/playlist';
import { HLS_CONFIG } from '../../config/hls.mjs';
import { codecSignature, type MediaInfo, type MediaStream } from '../lib/hls/timeline';
import { HlsError } from '../lib/hls/playlist';

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

function inspect(name: string): MediaInfo {
  stdout = []; core.reset(); core.setTimeout(HLS_CONFIG.worker.probeTimeoutMs);
  const code = core.ffprobe('-v', 'error', '-read_intervals', `%+#${HLS_CONFIG.stream.probePackets}`, '-show_data',
    '-show_entries', 'format=format_name:stream=index,codec_name,codec_type,profile,width,height,pix_fmt,sample_rate,channels,channel_layout,extradata,time_base:packet=stream_index,dts', '-of', 'json', name);
  let info: any;
  try { info = JSON.parse(stdout.join('\n')); } catch { throw new HlsError('invalidMedia'); }
  if (![0, -1].includes(code)) throw new HlsError('invalidMedia');
  const streams: MediaStream[] = (info.streams || []).filter((stream: any) => ['video', 'audio'].includes(stream.codec_type))
    .map((stream: any) => ({ ...stream, firstDts: Number(info.packets?.find((packet: any) => packet.stream_index === stream.index && packet.dts !== undefined)?.dts) }))
    .sort((a: MediaStream, b: MediaStream) => (a.codec_type === 'video' ? 0 : 1) - (b.codec_type === 'video' ? 0 : 1) || a.index - b.index);
  if (!streams.length || streams.some((stream) => !stream.codec_name || !Number.isFinite(stream.firstDts))) throw new HlsError('invalidMedia');
  const names = (info.format?.format_name || '').split(',');
  const format = names.includes('mpegts') ? 'ts' : names.includes('aac') ? 'aac' : names.includes('mp4') ? 'mp4' : undefined;
  if (!format) throw new HlsError('invalidMedia');
  const signature = codecSignature(streams);
  return { streams, format, signature };
}

scope.onmessage = async ({ data }) => {
  const { id, action } = data;
  try {
    let result: any;
    if (action === 'load') await loadCore(data.base);
    else if (action === 'inspect' || action === 'fragment') {
      const input = 'stream-input', output = 'stream-output.mp4';
      try {
        if (data.bytes.byteLength > HLS_CONFIG.stream.segmentBytes * 2) throw new HlsError('segmentTooLarge');
        core.FS.writeFile(input, new Uint8Array(data.bytes));
        const info = inspect(input);
        if (action === 'inspect') result = info;
        else {
          let bytes = data.bytes;
          const format = data.format === 'original' ? info.format : data.format;
          if (format === 'mp4') {
            logs = []; core.reset(); core.setTimeout(HLS_CONFIG.worker.remuxTimeoutMs);
            const filters: string[] = []; let audio = 0;
            for (const stream of info.streams) if (stream.codec_type === 'audio') {
              if (stream.codec_name === 'aac') filters.push(`-bsf:a:${audio}`, 'aac_adtstoasc'); audio++;
            }
            const args = ['-v', 'warning', '-fflags', '+genpts+discardcorrupt', '-i', input, '-map', '0:v?', '-map', '0:a?', '-c', 'copy', ...filters,
              '-avoid_negative_ts', 'make_zero', '-movflags', '+frag_keyframe+empty_moov+default_base_moof+delay_moov', '-f', 'mp4', output];
            if (core.exec(...args) !== 0) throw new HlsError('remuxError', logs.slice(-6).join('\n'));
            bytes = core.FS.readFile(output).slice().buffer;
          }
          result = { bytes, info, format, heapBytes: core.HEAPU8?.byteLength || 0 };
        }
      } finally {
        for (const name of [input, output]) try { core.FS.unlink(name); } catch { /* The output may not have been created. */ }
        stdout = [];
      }
    }
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
    scope.postMessage({ id, result }, result instanceof ArrayBuffer ? [result] : result?.bytes instanceof ArrayBuffer ? [result.bytes] : []);
  } catch (error) { scope.postMessage({ id, error: (error as Error).message, code: error instanceof HlsError ? error.code : undefined }); }
};
