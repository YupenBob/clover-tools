/** Download, storage, UI and WASM limits share one configurable policy. */
export const HLS_CONFIG = {
  core: { version: '0.12.10', publicRoot: '/vendor/ffmpeg', shardBytes: 8 * 1048576, estimatedBytes: 31 * 1048576 },
  defaults: { concurrency: 6, retries: 2, timeoutSeconds: 20, filename: 'clover-video', credentials: 'omit' },
  limits: { concurrency: [1, 12], retries: [0, 5], timeoutSeconds: [5, 120], exportBytes: 384 * 1048576 },
  retry: { baseDelayMs: 500, maxDelayMs: 8000, maxRetryAfterMs: 10000, missingStatuses: [404, 410] },
  worker: { requestTimeoutMs: 240000, remuxTimeoutMs: 180000, probeTimeoutMs: 15000, diagnosticLines: 30 },
  cache: { database: 'clover-hls-v1', version: 2, store: 'chunks', tasks: 'tasks', activeTask: 'active' },
  stream: { segmentBytes: 64 * 1048576, bufferBytes: 128 * 1048576, prefetch: 6, recycleSegments: 128, heapBytes: 384 * 1048576, probePackets: 128,
    defaultFormat: 'original', clockToleranceSeconds: 0.25 },
  ui: { segmentsPerPage: 160, refreshMs: 100, speedRefreshMs: 1000, reportUrlLifetimeMs: 30000 },
  formats: { mp4: { mime: 'video/mp4', extension: 'mp4' }, ts: { mime: 'video/mp2t', extension: 'ts' }, aac: { mime: 'audio/aac', extension: 'aac' } },
};

export function hlsCorePath() { return `${HLS_CONFIG.core.publicRoot}/${HLS_CONFIG.core.version}`; }
