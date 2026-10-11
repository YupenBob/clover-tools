import { SegmentCache, type SavedTask } from '../lib/hls/cache';
import { DownloadTask, loadPlaylist, type DownloadOptions } from '../lib/hls/downloader';
import { HlsError, httpUrl, originalExtension, playlistId, type Playlist } from '../lib/hls/playlist';
import { Remuxer } from '../lib/hls/remux';
import type { HlsCopy } from '../lib/hls/copy';
import { HLS_CONFIG } from '../../config/hls.mjs';
import { StreamingTask } from '../lib/hls/stream';
import { chooseFile, DiskSink, supportsFileSaving, type MediaFormat, type SaveFileHandle, type StreamFormat } from '../lib/hls/file';

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
  let warmTimer: ReturnType<typeof setTimeout> | undefined;
  let speedTimer: ReturnType<typeof setInterval> | undefined, lastBytes = 0, lastTime = performance.now();
  let originalIndices: number[] = [];
  let streaming: StreamingTask | undefined, handle: SaveFileHandle | undefined, savedTask: SavedTask | undefined;
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

  /** One primary action finishes the download and then exports, so the label stays predictable. */
  function startAllowed() {
    if (!task || exporting || parsing) return false;
    // A paused stream keeps its file open and must stay resumable; a finished one has nothing left.
    if (input('hlsStream').checked && !!streaming?.finished && !streaming.writable) return false;
    return task.results.some((result) => result.state === 'pending') || totals().done > 0;
  }

  function controls() {
    const streamMode = input('hlsStream').checked, openFile = !!streaming?.writable;
    button('hlsParse').disabled = busy || exporting || parsing || openFile;
    button('hlsLoadVariant').disabled = busy || exporting || parsing || openFile;
    button('hlsStart').hidden = busy;
    button('hlsStart').disabled = !startAllowed();
    element('hlsStart').querySelector('span')!.textContent = streamMode
      ? started ? copy.resume : copy.streamStartAndSave
      : started ? copy.resumeAndExport : copy.downloadAndExport;
    button('hlsPause').hidden = !busy;
    button('hlsRetry').disabled = !task || busy || exporting || parsing || !task.playlist.segments.some((segment) => !segment.gap && task!.results[segment.index].state === 'skipped');
    button('hlsClear').disabled = !task || busy || exporting || parsing;
    const canExport = !!task && totals().done > 0 && !busy && !exporting && !parsing;
    button('hlsExport').hidden = streamMode;
    button('hlsExport').disabled = !canExport;
    button('hlsSavePartial').hidden = !streamMode || !openFile;
    button('hlsSavePartial').disabled = busy || exporting || parsing || !streaming?.segments;
    button('hlsChangeFile').hidden = !streamMode || !streaming?.info || !handle || openFile || busy || exporting || parsing;
    button('hlsChangeFile').disabled = busy || exporting || parsing;
    input('hlsStream').disabled = busy || exporting || parsing || openFile || !supportsFileSaving();
    element<HTMLSelectElement>('hlsFormat').disabled = busy || exporting || parsing || openFile;
    element('hlsWrittenArea').hidden = !streamMode;
    button('hlsRestore').disabled = busy || exporting || parsing || openFile;
    button('hlsReport').disabled = !task;
    button('hlsCancelExport').hidden = !exporting;
    for (const id of ['hlsConcurrency', 'hlsRetries', 'hlsTimeout', 'hlsCredentials', 'hlsRangeStart', 'hlsRangeEnd', 'hlsUrl', 'hlsVariant'])
      (element(id) as HTMLInputElement).disabled = busy || exporting || parsing || openFile;
    input('hlsFilename').disabled = busy || exporting || parsing || openFile;
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
    await streaming?.dispose(); streaming = undefined; handle = undefined;
    element('hlsWritten').textContent = '0 B';
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
    scheduleWarm();
    draw();
  }

  /** Compile the remux core while the user is still reading the playlist, not when they click export. */
  function scheduleWarm() {
    if (disposed || remuxer?.usable) return;
    warmTimer = setTimeout(() => {
      warmTimer = undefined;
      if (disposed) return;
      void ensureRemuxer().warm();
    }, HLS_CONFIG.ui.coreWarmDelayMs);
  }
  /** One worker serves every export until it is cancelled or terminated, so the core compiles once. */
  function ensureRemuxer(): Remuxer {
    if (!remuxer?.usable) {
      remuxer = new Remuxer((event, progress) => {
        if (!exporting) return;
        status(event === 'loading' ? 'loadCore' : 'merging',
          { percent: Math.min(100, Math.max(0, Math.round(progress * 100))) }, 'info', 'hlsExportStatus');
      });
    }
    return remuxer;
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

  async function download(autoExport = true) {
    if (!task || busy || exporting || parsing) return;
    if (input('hlsStream').checked) { await streamDownload(); return; }
    const current = task;
    Object.assign(current.options, options());
    delete current.options.maxBytes;
    clearPreview(); busy = true; started = true; controls(); status('downloading');
    lastBytes = totals().bytes; lastTime = performance.now();
    speedTimer = setInterval(() => {
      const count = totals(), now = performance.now();
      element('hlsSpeed').textContent = translate('speed', { speed: size(Math.max(0, count.bytes - lastBytes) / ((now - lastTime) / 1000)) });
      lastBytes = count.bytes; lastTime = now;
    }, HLS_CONFIG.ui.speedRefreshMs);
    try {
      await current.run();
      if (current.fatal) failure(current.fatal);
      else if (current.results.some((result) => result.state === 'pending')) status('paused');
      else status('complete', totals());
    } catch (error) { failure(error); }
    finally { busy = false; clearInterval(speedTimer); element('hlsSpeed').textContent = ''; draw(); }
    // A finished download continues straight into export: one click, one file. Pausing, a fatal
    // error, or an empty result leaves the export to the explicit button in the result panel.
    if (autoExport && !disposed && current === task && !current.fatal &&
      !current.results.some((result) => result.state === 'pending') && totals().done > 0) {
      await exportVideo(element<HTMLSelectElement>('hlsFormat').value as 'mp4' | 'ts');
    }
  }

  function filename(format: string): string {
    return (input('hlsFilename').value.trim().replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').replace(/\.(mp4|ts|aac)$/i, '') || HLS_CONFIG.defaults.filename) + '.' + format;
  }

  function remember(): Promise<unknown> {
    if (!task) return Promise.resolve();
    savedTask = { id: task.id, playlist: task.playlist, indices: originalIndices, source: input('hlsUrl').value,
      filename: input('hlsFilename').value, format: element<HTMLSelectElement>('hlsFormat').value as StreamFormat,
      rangeStart: input('hlsRangeStart').value, rangeEnd: input('hlsRangeEnd').value, handle, options: options() };
    return cache.remember(savedTask);
  }
  function makeStream(): StreamingTask {
    return new StreamingTask(task!, element<HTMLSelectElement>('hlsFormat').value as StreamFormat,
      () => new Remuxer((event, progress) => {
        if (event === 'loading') status('loadCore', { percent: Math.round(progress * 100) }, 'info', 'hlsExportStatus');
      }), ({ bytes, segments, heapBytes }) => {
        root!.dataset.workerHeap = String(heapBytes);
        element('hlsWritten').textContent = size(bytes);
        status('streamWritten', { count: segments, size: size(bytes) }, 'info', 'hlsExportStatus'); scheduleDraw();
      });
  }
  async function streamDownload(freshFile = false) {
    if (busy || exporting || parsing) return;
    if (!task || !supportsFileSaving()) { failure(new HlsError('streamUnsupported')); return; }
    const current = task;
    // The save picker needs this click's user activation, so it must precede every await.
    // The first probe has not run yet, so the container comes from the playlist itself.
    let target = streaming?.writable ? handle : undefined;
    if (!target || freshFile) {
      const requested = element<HTMLSelectElement>('hlsFormat').value as StreamFormat;
      const guess: MediaFormat = requested === 'original' ? originalExtension(current.playlist) : 'mp4';
      try {
        target = await chooseFile(filename(guess), guess, freshFile ? undefined : handle);
      } catch (error) { failure(error); return; }
      handle = target;
    }
    busy = true; started = true; clearPreview(); controls();
    // Clear any earlier error here and now: the picker above may have been dismissed, and a stale
    // message would otherwise keep describing the previous attempt while this one is running.
    status('preparing', { done: 0, total: current.results.length });
    status('preparing', { done: 0, total: current.results.length }, 'info', 'hlsExportStatus');
    try {
      Object.assign(current.options, options());
      if (!streaming || !streaming.writable && streaming.finished) { await streaming?.dispose(); streaming = makeStream(); }
      await remember();
      if (!streaming.info) await streaming.prepare();
      if (!streaming.writable) streaming.attach(await DiskSink.open(target));
      status('streamReady', { format: streaming.output!.toUpperCase() });
      await streaming.run();
      if (streaming.finished) status('streamComplete', { format: streaming.output!.toUpperCase(), size: size(streaming.bytes) });
      else status('streamPaused');
    } catch (error) {
      failure(error);
      // A failed native stream cannot be reused; its disk chunks remain recoverable.
      if (error instanceof HlsError && !['fileCancelled', 'filePermissionError'].includes(error.code)) {
        await streaming?.dispose(); streaming = undefined;
      }
    } finally { busy = false; draw(); }
  }
  function formats(streamMode: boolean) {
    const select = element<HTMLSelectElement>('hlsFormat'); select.replaceChildren();
    for (const [value, label] of streamMode ? [['original', copy.originalFormat], ['mp4', 'MP4']] : [['mp4', 'MP4'], ['ts', 'TS']]) {
      const option = document.createElement('option'); option.value = value; option.textContent = label; select.append(option);
    }
    select.value = streamMode ? HLS_CONFIG.stream.defaultFormat : 'mp4';
    element('hlsStreamNote').textContent = supportsFileSaving() ? copy.streamNote : copy.streamUnsupported;
  }
  function save(blob: Blob, name: string): string {
    const url = URL.createObjectURL(blob); const link = document.createElement('a');
    link.href = url; link.download = name; link.hidden = true; document.body.append(link); link.click(); link.remove(); return url;
  }

  async function exportVideo(format: 'mp4' | 'ts') {
    if (!task || busy || exporting || parsing) return;
    const skippedBefore = totals().skipped;
    clearPreview(); exporting = true; controls(); draw(); status('loadCore', { percent: 0 }, 'info', 'hlsExportStatus');
    const engine = ensureRemuxer();
    try {
      const blob = await engine.export(task, format, (done, total) => status('preparing', { done, total }, 'info', 'hlsExportStatus'));
      if (disposed) return;
      outputUrl = save(blob, filename(format));
      const link = element<HTMLAnchorElement>('hlsSaveAgain'); link.href = outputUrl; link.download = filename(format);
      const video = element<HTMLVideoElement>('hlsPreview'); video.hidden = format !== 'mp4';
      if (format === 'mp4') video.src = outputUrl;
      element('hlsPreviewArea').hidden = false;
      status('exported', { format: format.toUpperCase(), size: size(blob.size) }, 'info', 'hlsExportStatus');
    } catch (error) { failure(error, 'hlsExportStatus'); }
    finally {
      // The worker stays warm for the next export; only cancellation or unload terminates it.
      exporting = false;
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
  async function retry(index?: number) {
    if (!task || busy || exporting || parsing) return;
    parsing = true; controls();
    try { await streaming?.dispose(); streaming = undefined; await task.retrySkipped(index); }
    catch (error) { failure(error); }
    finally { parsing = false; draw(); }
    if (input('hlsStream').checked) {
      // Rebuilding needs a fresh save permission, which only a real click can grant.
      status('rebuildNote'); draw(); return;
    }
    await download(false);
  }
  button('hlsRetry').addEventListener('click', () => void retry());
  button('hlsClear').addEventListener('click', async () => {
    if (!task || busy || exporting || parsing) return;
    parsing = true; controls();
    try {
      await streaming?.dispose(); streaming = undefined; handle = undefined;
      await cache.clear(task.id);
      savedTask = undefined; element('hlsRestoreArea').hidden = true; element('hlsWritten').textContent = '0 B';
      task = new DownloadTask(task.playlist, task.id, cache, options(), scheduleDraw);
      clearPreview(); started = false; status('clearDone');
    } catch (error) { failure(error); }
    finally { parsing = false; draw(); }
  });
  element('hlsSegmentGrid').addEventListener('click', (event) => {
    const cell = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-index]');
    if (cell?.dataset.retry === 'true') void retry(Number(cell.dataset.index));
  });
  button('hlsPrevious').addEventListener('click', () => { page--; draw(); });
  button('hlsNext').addEventListener('click', () => { page++; draw(); });
  button('hlsExport').addEventListener('click', () => void exportVideo(element<HTMLSelectElement>('hlsFormat').value as 'mp4' | 'ts'));
  input('hlsStream').addEventListener('change', () => {
    void streaming?.dispose(); streaming = undefined; handle = undefined; formats(input('hlsStream').checked); draw();
  });
  element('hlsFormat').addEventListener('change', () => { void streaming?.dispose(); streaming = undefined; handle = undefined; draw(); });
  button('hlsSavePartial').addEventListener('click', async () => {
    if (busy || exporting || parsing || !streaming?.writable) return;
    exporting = true; controls();
    try { await streaming.finish(); status('partialSaved', { size: size(streaming.bytes) }); await streaming.dispose(); streaming = undefined; }
    catch (error) { failure(error); await streaming?.dispose(); streaming = undefined; }
    finally { exporting = false; draw(); }
  });
  button('hlsChangeFile').addEventListener('click', () => void streamDownload(true));
  input('hlsFilename').addEventListener('change', () => {
    if (!busy && !exporting && !parsing && !streaming?.writable) {
      if (streaming?.finished) { void streaming.dispose(); streaming = undefined; }
      handle = undefined; draw();
    }
  });
  button('hlsRestore').addEventListener('click', async () => {
    if (!savedTask || busy || exporting || parsing) return;
    parsing = true; controls();
    try {
      await streaming?.dispose(); streaming = undefined;
      const snapshot = savedTask;
      if (await playlistId(snapshot.playlist) !== snapshot.id) throw new HlsError('invalidPlaylist');
      if (!supportsFileSaving()) throw new HlsError('streamUnsupported');
      input('hlsStream').checked = true; formats(true); element<HTMLSelectElement>('hlsFormat').value = snapshot.format;
      input('hlsUrl').value = snapshot.source; input('hlsFilename').value = snapshot.filename;
      input('hlsRangeStart').value = snapshot.rangeStart; input('hlsRangeEnd').value = snapshot.rangeEnd;
      if (snapshot.options) {
        input('hlsConcurrency').value = String(snapshot.options.concurrency); input('hlsRetries').value = String(snapshot.options.retries);
        input('hlsTimeout').value = String(snapshot.options.timeout / 1000); input('hlsCredentials').checked = snapshot.options.credentials === 'include';
      }
      task = new DownloadTask(snapshot.playlist, snapshot.id, cache, options(), scheduleDraw);
      const count = await task.restore(); originalIndices = snapshot.indices; handle = snapshot.handle;
      master = undefined; element('hlsQuality').hidden = true; page = 0; started = true; clearPreview();
      element('hlsEmpty').hidden = true; element('hlsTask').hidden = false; element('hlsRestoreArea').hidden = true;
      element('hlsTaskMeta').textContent = translate('ready', { count: task.results.length, duration: seconds(task.playlist.duration) });
      element('hlsWritten').textContent = '0 B'; status('streamRestored', { count });
    } catch (error) { failure(error); }
    finally { parsing = false; draw(); }
  });
  button('hlsCancelExport').addEventListener('click', () => remuxer?.stop());
  button('hlsReport').addEventListener('click', () => {
    if (!task) return;
    const report = { source: task.playlist.url, created: new Date().toISOString(), snapshot: task.playlist.live,
      streaming: input('hlsStream').checked ? { format: element<HTMLSelectElement>('hlsFormat').value, writtenBytes: streaming?.bytes || 0 } : undefined,
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
    disposed = true; task?.pause(); parseController?.abort(); remuxer?.stop(); remuxer = undefined; void streaming?.dispose(); streaming = undefined;
    clearInterval(speedTimer); clearTimeout(timer); clearTimeout(warmTimer); if (outputUrl) URL.revokeObjectURL(outputUrl);
  });
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      disposed = false; busy = false; exporting = false; parsing = false;
      if (task?.results.some((result) => result.state === 'pending')) scheduleWarm();
      draw();
    }
  });
  const source = new URLSearchParams(location.search).get('source');
  if (source) { input('hlsUrl').value = source; void parse(source); }
  void cache.active().then((saved) => { if (!disposed && saved) { savedTask = saved; element('hlsRestoreArea').hidden = false; } }).catch((error) => failure(error));
  formats(false);
  controls();
}
