import { SegmentCache } from '../lib/hls/cache';
import { DownloadTask, loadPlaylist, type DownloadOptions } from '../lib/hls/downloader';
import { HlsError, httpUrl, playlistId, type Playlist } from '../lib/hls/playlist';
import { Remuxer } from '../lib/hls/remux';
import type { HlsCopy } from '../lib/hls/copy';
import { HLS_CONFIG } from '../../config/hls.mjs';

const root = document.getElementById('hlsDownloader');
if (root) {
  const copy: HlsCopy = JSON.parse(root.dataset.copy!);
  const element = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
  const input = (id: string) => element<HTMLInputElement>(id);
  const button = (id: string) => element<HTMLButtonElement>(id);
  const translate = (key: keyof HlsCopy, values: Record<string, string | number> = {}) => copy[key].replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? ''));
  const seconds = (value: number) => {
    const n = Math.round(value); const hours = Math.floor(n / 3600);
    return (hours ? `${hours}:` : '') + [Math.floor(n / 60) % 60, n % 60].map((part) => String(part).padStart(2, '0')).join(':');
  };
  const size = (value: number) => {
    const unit = value >= 1048576 ? 'MiB' : value >= 1024 ? 'KiB' : 'B';
    return `${(value / (unit === 'MiB' ? 1048576 : unit === 'KiB' ? 1024 : 1)).toFixed(unit === 'B' ? 0 : 1)} ${unit}`;
  };
  const status = (key: keyof HlsCopy, values: Record<string, string | number> = {}, kind = 'info', target = 'hlsStatus') => {
    if (disposed) return;
    const node = element(target); node.textContent = translate(key, values); node.dataset.kind = kind; node.hidden = false;
  };
  const failure = (error: unknown, target = 'hlsStatus') => {
    const code = error instanceof HlsError ? error.code === 'timeout' ? 'timeoutError' : error.code : 'networkError';
    status(code in copy ? code as keyof HlsCopy : 'networkError', {}, 'error', target);
  };
  const cache = new SegmentCache();
  let task: DownloadTask | undefined, master: Playlist | undefined;
  let busy = false, exporting = false, parsing = false, disposed = false, started = false;
  let parseController: AbortController | undefined, remuxer: Remuxer | undefined;
  let outputUrl: string | undefined, page = 0, timer: ReturnType<typeof setTimeout> | undefined;
  let speedTimer: ReturnType<typeof setInterval> | undefined, lastBytes = 0, lastTime = performance.now();
  let originalIndices: number[] = [];
  const pageSize = HLS_CONFIG.ui.segmentsPerPage;

  function options(): DownloadOptions {
    const number = (id: string, min: number, max: number, fallback: number) => {
      const value = Number(input(id).value);
      return Number.isFinite(value) ? Math.max(min, Math.min(max, Math.floor(value))) : fallback;
    };
    return { concurrency: number('hlsConcurrency', ...HLS_CONFIG.limits.concurrency as [number, number], HLS_CONFIG.defaults.concurrency),
      retries: number('hlsRetries', ...HLS_CONFIG.limits.retries as [number, number], HLS_CONFIG.defaults.retries),
      timeout: number('hlsTimeout', ...HLS_CONFIG.limits.timeoutSeconds as [number, number], HLS_CONFIG.defaults.timeoutSeconds) * 1000,
      credentials: input('hlsCredentials').checked ? 'include' : HLS_CONFIG.defaults.credentials as RequestCredentials };
  }

  function totals() {
    let done = 0, skipped = 0, bytes = 0, duration = 0, gapDuration = 0;
    task?.results.forEach((result, index) => {
      if (result.state === 'done') { done++; bytes += result.bytes; duration += task!.playlist.segments[index].duration; }
      if (result.state === 'skipped') { skipped++; gapDuration += task!.playlist.segments[index].duration; }
    });
    return { done, skipped, bytes, duration, gapDuration, total: task?.results.length || 0 };
  }

  function controls() {
    button('hlsParse').disabled = busy || exporting || parsing;
    button('hlsLoadVariant').disabled = busy || exporting || parsing;
    button('hlsStart').hidden = busy;
    button('hlsStart').disabled = !task || exporting || parsing || !task.results.some((result) => result.state === 'pending');
    element('hlsStart').querySelector('span')!.textContent = started ? copy.resume : copy.start;
    button('hlsPause').hidden = !busy;
    button('hlsRetry').disabled = !task || busy || exporting || parsing || !task.playlist.segments.some((segment) => !segment.gap && task!.results[segment.index].state === 'skipped');
    button('hlsClear').disabled = !task || busy || exporting || parsing;
    const canExport = !!task && totals().done > 0 && !busy && !exporting && !parsing;
    button('hlsMp4').disabled = button('hlsTs').disabled = !canExport;
    button('hlsReport').disabled = !task;
    button('hlsCancelExport').hidden = !exporting;
    for (const id of ['hlsConcurrency', 'hlsRetries', 'hlsTimeout', 'hlsCredentials', 'hlsRangeStart', 'hlsRangeEnd', 'hlsUrl', 'hlsVariant'])
      (element(id) as HTMLInputElement).disabled = busy || exporting || parsing;
  }

  function draw() {
    if (!task || disposed) { controls(); return; }
    const count = totals();
    element('hlsDone').textContent = String(count.done); element('hlsSkipped').textContent = String(count.skipped);
    element('hlsBytes').textContent = size(count.bytes); element('hlsDuration').textContent = seconds(count.duration);
    const percent = Math.round((count.done + count.skipped) / count.total * 100);
    element('hlsProgressLabel').textContent = `${count.done + count.skipped} / ${count.total} · ${percent}%`;
    element('hlsProgress').setAttribute('aria-valuenow', String(percent));
    element('hlsProgressDone').style.width = `${count.done / count.total * 100}%`;
    element('hlsProgressSkipped').style.width = `${count.skipped / count.total * 100}%`;
    element('hlsGapNote').hidden = !count.skipped;
    element('hlsGapNote').textContent = translate('gapNote', { count: count.skipped, duration: seconds(count.gapDuration) });
    const pages = Math.ceil(count.total / pageSize);
    page = Math.max(0, Math.min(page, pages - 1));
    const grid = element('hlsSegmentGrid'), start = page * pageSize, end = Math.min(count.total, start + pageSize);
    // Reuse nodes as statuses change; large playlists render at most one page of cells.
    if (grid.dataset.page !== String(page) || grid.dataset.task !== task.id || grid.childElementCount !== end - start) {
      grid.replaceChildren();
      const fragment = document.createDocumentFragment();
      for (let index = start; index < end; index++) {
        const cell = document.createElement('button'); cell.type = 'button'; cell.dataset.index = String(index);
        cell.textContent = String(originalIndices[index]); fragment.append(cell);
      }
      grid.append(fragment); grid.dataset.page = String(page); grid.dataset.task = task.id;
    }
    for (const child of Array.from(grid.children) as HTMLButtonElement[]) {
      const index = Number(child.dataset.index), result = task.results[index];
      const retryable = result.state === 'skipped' && !task.playlist.segments[index].gap && !busy && !exporting && !parsing;
      child.dataset.state = result.state; child.dataset.retry = String(retryable);
      const error = result.error ? result.error in copy ? copy[result.error as keyof HlsCopy] : result.error : '';
      child.title = translate('segmentLabel', { index: originalIndices[index], state: copy[result.state], attempts: result.attempts }) + (error ? ` · ${error}` : '');
      child.setAttribute('aria-label', child.title);
      child.setAttribute('aria-disabled', String(!retryable));
    }
    element('hlsPagination').hidden = pages <= 1;
    element('hlsPageLabel').textContent = translate('page', { page: page + 1, pages });
    button('hlsPrevious').disabled = page === 0; button('hlsNext').disabled = page + 1 === pages;
    controls();
  }

  function scheduleDraw() { if (!timer && !disposed) timer = setTimeout(() => { timer = undefined; draw(); }, HLS_CONFIG.ui.refreshMs); }
  function clearPreview() {
    const video = element<HTMLVideoElement>('hlsPreview'); video.pause(); video.removeAttribute('src'); video.load();
    if (outputUrl) URL.revokeObjectURL(outputUrl);
    outputUrl = undefined; element('hlsPreviewArea').hidden = true;
    element<HTMLAnchorElement>('hlsSaveAgain').removeAttribute('href');
    element('hlsExportStatus').hidden = true;
  }

  async function acceptPlaylist(playlist: Playlist) {
    if (playlist.variants.length) {
      task = undefined; originalIndices = []; started = false; clearPreview();
      element('hlsEmpty').hidden = false; element('hlsTask').hidden = true;
      master = playlist;
      const select = element<HTMLSelectElement>('hlsVariant'); select.replaceChildren();
      for (const [index, variant] of [...playlist.variants].entries()) {
        const option = document.createElement('option'); option.value = String(index);
        option.textContent = [variant.resolution || `#${index + 1}`, `${Math.round(variant.bandwidth / 1000)} kbps`, variant.codecs].filter(Boolean).join(' · ');
        select.append(option);
      }
      select.value = String(playlist.variants.reduce((best, variant, index) =>
        !variant.externalAudio && (playlist.variants[best].externalAudio || variant.bandwidth > playlist.variants[best].bandwidth) ? index : best, 0));
      element('hlsQuality').hidden = false;
      status('quality');
      return;
    }
    const first = Number(input('hlsRangeStart').value || 1), last = Number(input('hlsRangeEnd').value || playlist.segments.length);
    if (!Number.isInteger(first) || !Number.isInteger(last) || first < 1 || last < first || last > playlist.segments.length) throw new HlsError('rangeError');
    const selected = playlist.segments.slice(first - 1, last);
    const ranged: Playlist = { ...playlist, segments: selected.map((segment, index) => ({ ...segment, index })),
      duration: selected.reduce((sum, segment) => sum + segment.duration, 0) };
    const id = await playlistId(ranged);
    const newTask = new DownloadTask(ranged, id, cache, options(), scheduleDraw);
    const restored = await newTask.restore();
    if (disposed) return;
    task = newTask; originalIndices = selected.map((segment) => segment.index + 1); page = 0; started = restored > 0;
    lastBytes = totals().bytes; lastTime = performance.now();
    clearPreview(); element('hlsEmpty').hidden = true; element('hlsTask').hidden = false;
    element('hlsTaskMeta').textContent = translate('ready', { count: selected.length, duration: seconds(ranged.duration) }) + (playlist.live ? ` · ${copy.liveNote}` : '');
    status(restored ? 'cached' : 'ready', { count: restored || selected.length, duration: seconds(ranged.duration) });
    draw();
  }

  async function parse(url: string, variant = false) {
    if (busy || exporting || parsing) return;
    parsing = true; parseController = new AbortController(); controls(); status('parseBusy');
    try {
      const playlist = await loadPlaylist(httpUrl(url), parseController.signal, options());
      // Parsing a new source replaces the previous task only after successful validation and cache restoration.
      if (!variant) { master = undefined; element('hlsQuality').hidden = true; }
      await acceptPlaylist(playlist);
    } catch (error) { failure(error); }
    finally { parsing = false; draw(); }
  }

  async function download() {
    if (!task || busy || exporting || parsing) return;
    Object.assign(task.options, options());
    clearPreview(); busy = true; started = true; controls(); status('downloading');
    lastBytes = totals().bytes; lastTime = performance.now();
    speedTimer = setInterval(() => {
      const count = totals(), now = performance.now();
      element('hlsSpeed').textContent = translate('speed', { speed: size(Math.max(0, count.bytes - lastBytes) / ((now - lastTime) / 1000)) });
      lastBytes = count.bytes; lastTime = now;
    }, HLS_CONFIG.ui.speedRefreshMs);
    try {
      await task.run();
      if (task.fatal) failure(task.fatal);
      else if (task.results.some((result) => result.state === 'pending')) status('paused');
      else status('complete', totals());
    } catch (error) { failure(error); }
    finally { busy = false; clearInterval(speedTimer); element('hlsSpeed').textContent = ''; draw(); }
  }

  function filename(format: string): string {
    return (input('hlsFilename').value.trim().replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').replace(/\.(mp4|ts)$/i, '') || HLS_CONFIG.defaults.filename) + '.' + format;
  }
  function save(blob: Blob, name: string): string {
    const url = URL.createObjectURL(blob); const link = document.createElement('a');
    link.href = url; link.download = name; link.hidden = true; document.body.append(link); link.click(); link.remove(); return url;
  }

  async function exportVideo(format: 'mp4' | 'ts') {
    if (!task || busy || exporting || parsing) return;
    const skippedBefore = totals().skipped;
    clearPreview(); exporting = true; controls(); draw(); status('loadCore', { percent: 0 }, 'info', 'hlsExportStatus');
    remuxer = new Remuxer((event, progress) => status(event === 'loading' ? 'loadCore' : 'merging',
      { percent: Math.min(100, Math.max(0, Math.round(progress * 100))) }, 'info', 'hlsExportStatus'));
    try {
      const blob = await remuxer.export(task, format, (done, total) => status('preparing', { done, total }, 'info', 'hlsExportStatus'));
      if (disposed) return;
      outputUrl = save(blob, filename(format));
      const link = element<HTMLAnchorElement>('hlsSaveAgain'); link.href = outputUrl; link.download = filename(format);
      const video = element<HTMLVideoElement>('hlsPreview'); video.hidden = format !== 'mp4';
      if (format === 'mp4') video.src = outputUrl;
      element('hlsPreviewArea').hidden = false;
      status('exported', { format: format.toUpperCase(), size: size(blob.size) }, 'info', 'hlsExportStatus');
    } catch (error) { failure(error, 'hlsExportStatus'); }
    finally {
      remuxer?.stop(); remuxer = undefined; exporting = false;
      if (totals().skipped > skippedBefore) status('probeSkipped', { count: totals().skipped - skippedBefore });
      draw();
    }
  }

  element<HTMLFormElement>('hlsForm').addEventListener('submit', (event) => { event.preventDefault(); void parse(input('hlsUrl').value.trim()); });
  button('hlsLoadVariant').addEventListener('click', () => {
    const variant = master?.variants[Number(element<HTMLSelectElement>('hlsVariant').value)];
    if (variant?.externalAudio) failure(new HlsError('externalAudio'));
    else if (variant) void parse(variant.url, true);
  });
  button('hlsStart').addEventListener('click', () => void download());
  button('hlsPause').addEventListener('click', () => task?.pause());
  button('hlsRetry').addEventListener('click', () => { if (!busy && !exporting && !parsing) { task?.retrySkipped(); void download(); } });
  button('hlsClear').addEventListener('click', async () => {
    if (!task || busy || exporting || parsing) return;
    parsing = true; controls();
    try {
      await cache.clear(task.id);
      task = new DownloadTask(task.playlist, task.id, cache, options(), scheduleDraw);
      clearPreview(); started = false; status('clearDone');
    } catch (error) { failure(error); }
    finally { parsing = false; draw(); }
  });
  element('hlsSegmentGrid').addEventListener('click', (event) => {
    const cell = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-index]');
    if (cell?.dataset.retry === 'true') { task?.retrySkipped(Number(cell.dataset.index)); void download(); }
  });
  button('hlsPrevious').addEventListener('click', () => { page--; draw(); });
  button('hlsNext').addEventListener('click', () => { page++; draw(); });
  button('hlsMp4').addEventListener('click', () => void exportVideo('mp4'));
  button('hlsTs').addEventListener('click', () => void exportVideo('ts'));
  button('hlsCancelExport').addEventListener('click', () => remuxer?.stop());
  button('hlsReport').addEventListener('click', () => {
    if (!task) return;
    const report = { source: task.playlist.url, created: new Date().toISOString(), snapshot: task.playlist.live,
      totals: totals(), segments: task.playlist.segments.map((segment, index) => ({ index: originalIndices[index],
        sequence: segment.sequence, url: segment.url, start: segment.start, duration: segment.duration,
        discontinuity: segment.discontinuity, ...task!.results[index] })) };
    const url = save(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }), filename('report.json'));
    setTimeout(() => URL.revokeObjectURL(url), HLS_CONFIG.ui.reportUrlLifetimeMs);
  });
  document.addEventListener('keydown', (event) => {
    if (event.ctrlKey && event.key === 'Enter' && !button('hlsParse').disabled) element<HTMLFormElement>('hlsForm').requestSubmit();
  });
  window.addEventListener('pagehide', () => {
    disposed = true; task?.pause(); parseController?.abort(); remuxer?.stop();
    clearInterval(speedTimer); clearTimeout(timer); if (outputUrl) URL.revokeObjectURL(outputUrl);
  });
  window.addEventListener('pageshow', (event) => { if (event.persisted) { disposed = false; busy = false; exporting = false; parsing = false; draw(); } });
  const source = new URLSearchParams(location.search).get('source');
  if (source) { input('hlsUrl').value = source; void parse(source); }
  controls();
}
