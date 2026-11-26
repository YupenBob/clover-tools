import presentation from '../../data/tool-presentation/image-convert.json';
import {
  compareBytes, DEFAULT_OPTIONS, downloadName, formatBytes, FORMATS, FORMAT_ORDER,
  inputSizeError, inspectImage, validateOptions, withinImageLimits,
  type Dimensions, type ImageFormat, type RawOptions,
} from '../lib/image-convert';
import type { ImageConvertCopy } from '../lib/image-convert-i18n';
import { decodeSample, sampleFile } from '../lib/image-convert-samples';
import { decodeImage, encodeImage, hasCanvas, probeFormat, type Capability, type DecodedImage } from './image-convert-codecs';

type CopyKey = keyof ImageConvertCopy;
type View = 'primary' | 'reveal' | 'settingsOpen' | 'degraded' | 'fullscreen';
type Source = { file: File; format: ImageFormat; image: DecodedImage; url: string };
type Result = Dimensions & { format: ImageFormat; url: string; size: number; name: string; summary: string };
type Candidate = { file: File; revision: number };
const locales: Record<string, string> = { zh: 'zh-CN', tw: 'zh-Hant', en: 'en', ko: 'ko', ja: 'ja' };
const sizeText = ({ width, height }: Dimensions) => `${width} × ${height} px`;
const formatText = (format: ImageFormat, size: Dimensions) => `${FORMATS[format].label} · ${sizeText(size)}`;
const DOWNLOAD_GRACE_MS = 2000;
const REVEAL_CORNER_PX = 48;

function init(workspace: HTMLElement) {
  const get = <Element extends HTMLElement = HTMLElement>(id: string) =>
    workspace.querySelector<Element>(`#ic${id}`)!;
  const copy = JSON.parse(get('CopyData').textContent ?? '{}') as ImageConvertCopy;
  const locale = locales[workspace.dataset.lang ?? 'zh'];
  const exit = get<HTMLAnchorElement>('Exit');
  const fileInput = get<HTMLInputElement>('File');
  const formatInput = get<HTMLSelectElement>('Format');
  const convert = get<HTMLButtonElement>('Convert');
  const settingsToggle = get<HTMLButtonElement>('SettingsToggle');
  const quality = get<HTMLInputElement>('Quality');
  const maxWidth = get<HTMLInputElement>('MaxWidth');
  const maxHeight = get<HTMLInputElement>('MaxHeight');
  const background = get<HTMLSelectElement>('Background');
  const color = get<HTMLInputElement>('Color');
  const sourceSlot = get('Source');
  const resultSlot = get('Result');
  const sourcePreview = get<HTMLAnchorElement>('SourcePreview');
  const resultPreview = get<HTMLAnchorElement>('ResultPreview');
  const download = get<HTMLAnchorElement>('Download');
  const copyButton = get<HTMLButtonElement>('Copy');
  const manualField = get('ManualField');
  const manual = get<HTMLTextAreaElement>('Manual');
  const live = get('Live');
  const errorFields = { quality, maxWidth, maxHeight, color };

  let view: View = presentation.interaction.settingsInitiallyOpen ? 'settingsOpen' : 'primary';
  let mode: 'inline' | 'fullscreen' | 'fallback' = 'inline';
  let fullscreenRequest = 0;
  let hideTimer: ReturnType<typeof setTimeout> | undefined;
  let sourceRevision = 0;
  let optionRevision = 0;
  let source: Source | null = null;
  let result: Result | null = null;
  let pending: Candidate | null = null;
  let active = false;
  let waiting: 'decoding' | 'converting' | null = null;
  let error: CopyKey | null = null;
  let status: CopyKey | null = null;
  let canvasIssue: 'errorCanvas' | 'unavailableAll' | null = null;
  let caps: Map<ImageFormat, Capability> | null = null;

  const decodingSupport = new Map<ImageFormat, boolean>();
  const downloads = new Map<string, ReturnType<typeof setTimeout>>();

  function show(next: View) {
    view = next === 'primary' && canvasIssue ? 'degraded' : next;
    workspace.dataset.presentationState = view;
    workspace.dataset.presentationMode = mode;
    exit.setAttribute('aria-label', copy[view === 'fullscreen' ? 'exitFullscreen'
      : view === 'settingsOpen' ? 'closeSettings' : view === 'reveal' ? 'collapseWorkspace' : 'exitWorkspace']);
    exit.setAttribute('aria-controls', view === 'settingsOpen' ? 'icSettings' : 'icReveal');
    exit.setAttribute('aria-expanded', String(view === 'reveal' || view === 'settingsOpen'));
    settingsToggle.setAttribute('aria-expanded', String(view === 'settingsOpen'));
    get('Settings').hidden = view !== 'settingsOpen';
    clearTimeout(hideTimer);
    const delay = presentation.interaction.autoHideMs;
    if (view === 'reveal' && delay > 0) hideTimer = setTimeout(() => show('primary'), delay);
  }

  function rawOptions(): RawOptions {
    return {
      format: formatInput.value as ImageFormat,
      quality: quality.value,
      maxWidth: maxWidth.value,
      maxHeight: maxHeight.value,
      background: background.value === 'custom' ? 'custom' : 'white',
      color: color.value,
    };
  }

  function updateControls() {
    const raw = rawOptions();
    const checked = validateOptions(raw, source?.image ?? { width: 1, height: 1 });
    for (const [field, input] of Object.entries(errorFields)) {
      const invalid = !checked.ok && checked.fields.some(value => value === field);
      if (invalid) input.setAttribute('aria-invalid', 'true');
      else input.removeAttribute('aria-invalid');
      get(input.id.slice(2) + 'Error').hidden = !invalid;
    }
    get('QualityField').hidden = raw.format === 'png';
    get('BackgroundField').hidden = raw.format !== 'jpg';
    get('ColorField').hidden = raw.format !== 'jpg' || raw.background !== 'custom';
    get('Transparency').hidden = raw.format === 'jpg';
    get('Estimate').textContent = !checked.ok ? copy.invalidOptions : source
      ? `${copy.estimate} · ${sizeText(checked.value)}` : copy.estimateEmpty;
    convert.disabled = !source || active || !checked.ok || caps?.get(raw.format) !== 'available' || Boolean(canvasIssue);
    return checked.ok ? null : 'invalidOptions';
  }

  function update() {
    const optionsError = updateControls();
    const issue = error ?? canvasIssue ?? optionsError;
    workspace.dataset.process = waiting ?? (issue ? 'error' : result ? 'success' : source ? 'ready' : 'empty');
    workspace.dataset.errorCode = issue ?? '';
    sourceSlot.setAttribute('aria-busy', String(waiting === 'decoding'));
    resultSlot.setAttribute('aria-busy', String(waiting === 'converting'));
    const message = waiting ?? issue ?? status;
    const text = message ? copy[message] : '';
    for (const id of ['Status', 'SettingsStatus']) {
      const element = get(id);
      element.textContent = text;
      element.hidden = !text;
    }
    if (live.textContent !== text) live.textContent = text;
  }

  function updateLinks() {
    sourceSlot.textContent = `${copy.sourceLabel} · ${source ? formatText(source.format, source.image) : copy.sourceEmpty}`;
    resultSlot.textContent = `${copy.resultLabel} · ${result ? formatText(result.format, result) : copy.resultEmpty}`;
    get('SourceDetail').hidden = !source;
    get('SourceName').textContent = source?.file.name ?? '';
    get('SourceSize').textContent = source ? formatBytes(source.file.size, locale) : '';
    get('ResultDetail').hidden = !result;
    get('ResultSize').textContent = result ? formatBytes(result.size, locale) : '';
    const comparison = source && result ? compareBytes(source.file.size, result.size, locale) : null;
    const difference = comparison?.ok ? comparison.value : null;
    get('Difference').textContent = difference ? `${copy[difference.direction]} · ${difference.exactBytes} (${difference.percent})` : '';
    for (const [link, url] of [[sourcePreview, source?.url], [resultPreview, result?.url], [download, result?.url]] as const) {
      if (url) link.href = url;
      else link.removeAttribute('href');
    }
    download.hidden = !result;
    download.setAttribute('aria-disabled', String(!result));
    if (result) download.download = result.name;
    else download.removeAttribute('download');
    copyButton.disabled = !result;
    manualField.hidden = true;
    manual.value = '';
  }

  function clearResult() {
    if (result && !downloads.has(result.url)) URL.revokeObjectURL(result.url);
    result = null;
    updateLinks();
  }

  function clearSource() {
    if (source) {
      source.image.release();
      URL.revokeObjectURL(source.url);
    }
    source = null;
    clearResult();
  }

  function report(next: CopyKey, failed = false) {
    if (failed) error = next;
    else status = next;
    update();
  }

  async function decode(candidate: Candidate) {
    active = true;
    let decoded: DecodedImage | null = null;
    const isCurrent = () => candidate.revision === sourceRevision;
    const fail = (code: CopyKey) => { if (isCurrent()) error = code; };
    try {
      const { file } = candidate;
      const sizeError = inputSizeError(file.size);
      if (sizeError) return fail(sizeError);
      const inspected = inspectImage(new Uint8Array(await file.arrayBuffer()));
      if (!isCurrent()) return;
      if (!inspected.ok) return fail(inspected.code);
      const { format } = inspected.value;
      const blob = file.slice(0, file.size, FORMATS[format].mime);
      try {
        decoded = await decodeImage(blob);
      } catch {
        if (!isCurrent()) return;
        if (!decodingSupport.has(format)) {
          try {
            const known = await decodeImage(decodeSample(format));
            known.release();
            decodingSupport.set(format, true);
          } catch {
            decodingSupport.set(format, false);
          }
        }
        return fail(decodingSupport.get(format) ? 'damaged' : 'decoderUnavailable');
      }
      if (!isCurrent()) return;
      decodingSupport.set(format, true);
      if (!withinImageLimits(decoded)) return fail('decodedLimit');
      const url = URL.createObjectURL(blob);
      source = { file, format, image: decoded, url };
      decoded = null;
      status = 'ready';
      updateLinks();
    } catch {
      fail('errorInput');
    } finally {
      decoded?.release();
      finish(isCurrent());
    }
  }

  function finish(current: boolean) {
    active = false;
    if (current) waiting = null;
    const latest = pending;
    pending = null;
    if (latest) void decode(latest);
    update();
  }

  function select(files: ArrayLike<File>) {
    if (files.length === 0) {
      report('cancelled');
      return;
    }
    const revision = ++sourceRevision;
    pending = null;
    status = null;
    error = null;
    waiting = null;
    if (files.length !== 1) {
      clearResult();
      report('manyFiles', true);
      return;
    }
    clearSource();
    const candidate = { file: files[0], revision };
    waiting = 'decoding';
    if (active) pending = candidate;
    else void decode(candidate);
    update();
  }

  function changeOptions() {
    ++optionRevision;
    if (source) {
      error = null;
      status = 'ready';
    }
    if (waiting === 'converting') waiting = null;
    clearResult();
    update();
  }

  function defaultTarget(): ImageFormat {
    return FORMAT_ORDER.find(format => caps?.get(format) === 'available') ?? FORMAT_ORDER[0];
  }

  function reset(announce = true) {
    ++sourceRevision;
    ++optionRevision;
    pending = null;
    waiting = null;
    error = null;
    status = announce ? 'cleared' : null;
    fileInput.value = '';
    formatInput.value = defaultTarget();
    quality.value = String(DEFAULT_OPTIONS.quality);
    maxWidth.value = DEFAULT_OPTIONS.maxWidth;
    maxHeight.value = DEFAULT_OPTIONS.maxHeight;
    background.value = DEFAULT_OPTIONS.background;
    color.value = DEFAULT_OPTIONS.color;
    clearSource();
    update();
  }

  function setCanvasIssue(issue: NonNullable<typeof canvasIssue>) {
    canvasIssue = issue;
    workspace.dataset.presentationDegraded = 'true';
    if (view === 'primary' || view === 'degraded') show('primary');
  }

  async function detectCapabilities() {
    caps = new Map<ImageFormat, Capability>();
    if (hasCanvas()) {
      for (const format of FORMAT_ORDER) caps.set(format, await probeFormat(format));
    } else {
      for (const format of FORMAT_ORDER) caps.set(format, 'unavailable');
      setCanvasIssue('errorCanvas');
    }
    let available = false;
    for (const option of formatInput.options) {
      const format = option.value as ImageFormat;
      const capability = caps.get(format)!;
      option.disabled = capability !== 'available';
      option.dataset.capability = capability;
      option.textContent = FORMATS[format].label + (capability === 'available' ? '' : ` · ${copy[capability]}`);
      available ||= !option.disabled;
    }
    if (!available && !canvasIssue) setCanvasIssue('unavailableAll');
    formatInput.value = defaultTarget();
    formatInput.disabled = !available;
    const reasons = FORMAT_ORDER.flatMap(format => {
      const capability = caps?.get(format);
      return capability && capability !== 'available' ? [`${FORMATS[format].label} · ${copy[capability]}`] : [];
    });
    const capabilityNote = get('Capability');
    capabilityNote.textContent = reasons.join(' / ');
    capabilityNote.hidden = !reasons.length;
    update();
  }

  async function convertImage() {
    if (convert.disabled || !source) return;
    const snapshot = source;
    const options = validateOptions(rawOptions(), snapshot.image);
    if (!options.ok) return;
    const fileVersion = sourceRevision;
    const configVersion = optionRevision;
    const isCurrent = () => fileVersion === sourceRevision && configVersion === optionRevision;
    active = true;
    waiting = 'converting';
    error = null;
    status = null;
    clearResult();
    update();
    try {
      const output = await encodeImage(snapshot.image, options.value);
      if (!isCurrent()) return;
      if (!output.ok) {
        error = output.code;
        if (output.code === 'errorCanvas') setCanvasIssue(output.code);
        return;
      }
      const { blob } = output;
      const { format, width, height } = options.value;
      const name = downloadName(snapshot.file.name, format);
      const comparison = compareBytes(snapshot.file.size, blob.size, locale);
      const delta = comparison.ok ? comparison.value : null;
      const summary = [
        `${copy.sourceLabel} · ${formatText(snapshot.format, snapshot.image)} · ${formatBytes(snapshot.file.size, locale)}`,
        `${copy.resultLabel} · ${formatText(format, { width, height })} · ${formatBytes(blob.size, locale)}`,
        delta ? `${copy[delta.direction]} · ${delta.exactBytes} (${delta.percent})` : '',
      ].filter(Boolean).join('\n');
      result = { format, width, height, size: blob.size, url: URL.createObjectURL(blob), name, summary };
      updateLinks();
      status = 'success';
    } catch {
      if (isCurrent()) error = 'errorEncode';
    } finally {
      finish(isCurrent());
    }
  }

  function toggleSettings() {
    if (view === 'fullscreen') return;
    if (view === 'settingsOpen') {
      collapse();
      return;
    }
    show('settingsOpen');
    (get('QualityField').hidden ? maxWidth : quality).focus();
  }

  function collapse() {
    show('primary');
    exit.focus({ preventScroll: true });
  }

  async function toggleFullscreen() {
    if (view === 'fullscreen') {
      fullscreenRequest++;
      mode = 'inline';
      if (document.fullscreenElement === workspace) {
        try { await document.exitFullscreen(); } catch { /* The inline workspace remains available. */ }
      }
      collapse();
      update();
      return;
    }

    const request = ++fullscreenRequest;
    mode = 'fallback';
    show('fullscreen');
    exit.focus({ preventScroll: true });
    try {
      await workspace.requestFullscreen();
      if (request !== fullscreenRequest) {
        if (document.fullscreenElement === workspace) await document.exitFullscreen();
        return;
      }
      mode = 'fullscreen';
      show('fullscreen');
    } catch {
      if (request === fullscreenRequest) report('fullscreenFallback');
    }
  }

  function toggleWorkspace() {
    if (view === 'fullscreen') void toggleFullscreen();
    else if (view === 'reveal' || view === 'settingsOpen') collapse();
    else show('reveal');
  }

  exit.addEventListener('click', event => {
    event.preventDefault();
    toggleWorkspace();
  });
  get('Pick').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    select(fileInput.files ?? []);
    fileInput.value = '';
  });
  fileInput.addEventListener('cancel', () => report('cancelled'));
  get('Sample').addEventListener('click', () => select([sampleFile()]));
  convert.addEventListener('click', () => void convertImage());
  get('Clear').addEventListener('click', () => reset());
  settingsToggle.addEventListener('click', toggleSettings);
  get('SettingsClose').addEventListener('click', collapse);
  get('Fullscreen').addEventListener('click', () => void toggleFullscreen());
  for (const input of [quality, maxWidth, maxHeight, color]) input.addEventListener('input', changeOptions);
  for (const selectElement of [formatInput, background]) selectElement.addEventListener('change', changeOptions);

  copyButton.addEventListener('click', async () => {
    const snapshot = result;
    if (!snapshot) return;
    try {
      await navigator.clipboard.writeText(snapshot.summary);
      if (snapshot === result) report('copied');
    } catch {
      if (snapshot !== result) return;
      manualField.hidden = false;
      manual.value = snapshot.summary;
      report('manualCopy');
      if (view === 'reveal') {
        manual.focus();
        manual.select();
      }
    }
  });

  download.addEventListener('click', event => {
    const snapshot = result;
    if (!snapshot) {
      event.preventDefault();
      report('errorDownload', true);
      return;
    }
    const { url } = snapshot;
    clearTimeout(downloads.get(url));
    downloads.set(url, setTimeout(() => {
      downloads.delete(url);
      if (result?.url !== url) URL.revokeObjectURL(url);
    }, DOWNLOAD_GRACE_MS));
    // Wait for event dispatch and the browser's default download action.
    setTimeout(() => {
      if (result !== snapshot) return;
      if (event.defaultPrevented) report('errorDownload', true);
      else {
        if (error === 'errorDownload') error = null;
        report('downloadStarted');
      }
    }, 0);
  });

  const shortcuts: Record<string, string> = presentation.interaction.shortcuts;
  document.addEventListener('keydown', event => {
    if (event.isComposing || event.keyCode === 229 || event.defaultPrevented) return;
    const key = [event.ctrlKey && 'Control', event.metaKey && 'Meta', event.altKey && 'Alt', event.shiftKey && 'Shift', event.key]
      .filter(Boolean).join('+');
    const action = shortcuts[key];
    if (!action) return;
    if (action === 'exit' && (view === 'primary' || view === 'degraded')) return;
    event.preventDefault();
    if (event.repeat) return;
    if (action === 'convert') void convertImage();
    if (action === 'settings') toggleSettings();
    if (action === 'fullscreen') void toggleFullscreen();
    if (action === 'exit') toggleWorkspace();
  });

  if (presentation.interaction.revealTriggers.includes('pointer')) {
    document.addEventListener('pointermove', event => {
      if ((view === 'primary' || view === 'degraded') && event.isTrusted && event.pointerType === 'mouse'
        && event.clientX >= 0 && event.clientX < REVEAL_CORNER_PX && event.clientY >= 0 && event.clientY < REVEAL_CORNER_PX) {
        show('reveal');
      }
    });
  }

  workspace.addEventListener('dragover', event => {
    if (event.dataTransfer?.types.includes('Files')) {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
    }
  });
  workspace.addEventListener('drop', event => {
    if (event.dataTransfer?.types.includes('Files')) {
      event.preventDefault();
      select(event.dataTransfer.files);
    }
  });

  document.addEventListener('fullscreenchange', () => {
    if (document.fullscreenElement === workspace && view === 'fullscreen') {
      mode = 'fullscreen';
      show('fullscreen');
    } else if (mode === 'fullscreen') {
      mode = 'inline';
      fullscreenRequest++;
      collapse();
    }
  });
  window.addEventListener('pagehide', () => {
    reset(false);
    for (const [url, timer] of downloads) {
      clearTimeout(timer);
      URL.revokeObjectURL(url);
    }
    downloads.clear();
  });

  show(view);
  reset(false);
  void detectCapabilities();
}

const root = document.querySelector<HTMLElement>(presentation.primary.root);
if (root) init(root);
