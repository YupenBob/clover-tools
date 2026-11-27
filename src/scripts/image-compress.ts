import presentation from '../../data/tool-presentation/image-compress.json';
import { FORMATS, inputSizeError, inspectImage, withinImageLimits, type Dimensions } from '../lib/image-convert';
import { decodeSample, sampleFile } from '../lib/image-convert-samples';
import {
  compressedName, DEFAULT_SETTINGS, detailedBytes, encodingTiers, exactBytes,
  retainCandidate, sizeChange, targetOutcome, validateSettings,
  type Candidate, type CompressionFormat, type RawSettings,
} from '../lib/image-compress';
import type { ImageCompressCopy } from '../lib/image-compress-i18n';
import { decodeImage, encodeImage, hasCanvas, probeFormat, type DecodedImage } from './image-convert-codecs';

type View = 'primary' | 'reveal' | 'settingsOpen' | 'degraded' | 'fullscreen';
type Busy = 'decoding' | 'encoding';
type Message = keyof ImageCompressCopy;
type Source = { file: File; format: CompressionFormat; image: DecodedImage; url: string };
type Encoded = Candidate & { blob: Blob };
type Result = Encoded & { url: string; name: string; summary: string };
type Settings = Extract<ReturnType<typeof validateSettings>, { ok: true }>['value'];

const CORNER_PX = 48;
const DOWNLOAD_GRACE_MS = 2000;
const shortcuts: Record<string, string> = presentation.interaction.shortcuts;
const { autoHideMs, settingsInitiallyOpen, revealTriggers } = presentation.interaction;

function init(root: HTMLElement) {
  const get = <T extends HTMLElement = HTMLElement>(id: string) => root.querySelector<T>(`#imgComp${id}`)!;
  const copy = JSON.parse(get('CopyData').textContent ?? '{}') as ImageCompressCopy;
  const locale = root.lang;
  const number = new Intl.NumberFormat(locale);
  const exit = get<HTMLAnchorElement>('Exit');
  const fileInput = get<HTMLInputElement>('File');
  const compress = get<HTMLButtonElement>('Compress');
  const download = get<HTMLAnchorElement>('Download');
  const openResult = get<HTMLAnchorElement>('OpenResult');
  const copyButton = get<HTMLButtonElement>('Copy');
  const manual = get<HTMLTextAreaElement>('Manual');
  const settingsToggle = get<HTMLButtonElement>('SettingsToggle');
  const modeField = get<HTMLSelectElement>('Mode');
  const unitField = get<HTMLSelectElement>('Unit');
  const resizeField = get<HTMLInputElement>('AllowResize');
  const fields = {
    quality: get<HTMLInputElement>('Quality'),
    maxWidth: get<HTMLInputElement>('MaxWidth'),
    maxHeight: get<HTMLInputElement>('MaxHeight'),
    target: get<HTMLInputElement>('Target'),
  };
  const selectors = { quality: 'Quality', maxWidth: 'MaxWidth', maxHeight: 'MaxHeight', target: 'Target' } as const;
  const canDownload = 'download' in download;
  const capabilities = new Map<CompressionFormat, boolean>();
  const downloadTimers = new Map<string, ReturnType<typeof setTimeout>>();

  let view: View = settingsInitiallyOpen ? 'settingsOpen' : 'primary';
  let displayMode: 'inline' | 'fullscreen' | 'fallback' = 'inline';
  let settingsFrom: View = 'primary';
  let settingsFocus: HTMLElement | null = null;
  let fullscreenRequest = 0;
  let hideTimer: ReturnType<typeof setTimeout> | undefined;
  let tabNavigation = false;

  let fileVersion = 0;
  let parameterVersion = 0;
  let source: Source | null = null;
  let result: Result | null = null;
  let busy: Busy | null = null;
  let error: Message | null = null;
  let status: Message | null = null;
  let permissionIssue: Message | null = null;
  let attempts = 0;
  let searching = false;
  let canvasAvailable = hasCanvas();
  let active = false;
  let pending: (() => Promise<void>) | null = null;

  const message = (key: Message, values: Record<string, string>) =>
    copy[key].replace(/\{(\w+)\}/g, (placeholder, name: string) => values[name] ?? placeholder);
  const dimensionText = ({ width, height }: Dimensions, localized: boolean) =>
    `${localized ? number.format(width) : width} × ${localized ? number.format(height) : height} px`;
  const slotText = (format: CompressionFormat, size: Dimensions, bytes: number) =>
    `${FORMATS[format].label} · ${dimensionText(size, false)} · ${bytes} B`;
  const fileText = (format: CompressionFormat, size: Dimensions, bytes: number) =>
    `${FORMATS[format].label} · ${dimensionText(size, true)} · ${detailedBytes(bytes, locale)}`;

  function text(id: string, value: string, hideEmpty = false) {
    const element = get(id);
    if (element.textContent !== value) element.textContent = value;
    if (hideEmpty) element.hidden = !value;
  }

  function show(next: View) {
    const degraded = root.hasAttribute('data-presentation-degraded');
    view = next === 'primary' && degraded ? 'degraded' : next;
    root.dataset.presentationState = view;
    root.dataset.presentationMode = displayMode;
    exit.setAttribute('aria-label', copy[view === 'fullscreen' ? 'exitFullscreen'
      : view === 'settingsOpen' ? 'closeSettings' : view === 'reveal' ? 'hideControls' : 'showControls']);
    exit.setAttribute('aria-controls', view === 'settingsOpen' ? 'imgCompSettings' : 'imgCompReveal');
    exit.setAttribute('aria-expanded', String(view === 'reveal' || view === 'settingsOpen'));
    settingsToggle.setAttribute('aria-expanded', String(view === 'settingsOpen'));
    get('Reveal').hidden = view !== 'reveal';
    get('Settings').hidden = view !== 'settingsOpen';
    clearTimeout(hideTimer);
    if (view === 'reveal' && autoHideMs > 0) hideTimer = setTimeout(collapse, autoHideMs);
  }

  function rawSettings(): RawSettings {
    return {
      mode: modeField.value === 'target' ? 'target' : 'quality',
      unit: unitField.value === 'B' ? 'B' : 'KiB',
      allowResize: resizeField.checked,
      quality: fields.quality.value,
      maxWidth: fields.maxWidth.value,
      maxHeight: fields.maxHeight.value,
      target: fields.target.value,
    };
  }

  function effectiveSettings() {
    return validateSettings(rawSettings(), source?.image ?? { width: 1, height: 1 }, source?.format ?? 'jpg');
  }

  function render() {
    const raw = rawSettings();
    const checked = effectiveSettings();
    const targeting = raw.mode === 'target';
    const forPng = source?.format === 'png';
    get('TargetFields').hidden = !targeting;
    fields.quality.disabled = forPng;
    get('PngQuality').hidden = !forPng;
    text('QualityLabel', copy[targeting ? 'maxQuality' : 'quality']);
    text('QualityValue', number.format(Number(raw.quality)));
    for (const field of Object.keys(fields) as (keyof typeof fields)[]) {
      const invalid = !checked.ok && checked.fields.includes(field);
      if (invalid) fields[field].setAttribute('aria-invalid', 'true');
      else fields[field].removeAttribute('aria-invalid');
      const errorID = 'imgComp' + selectors[field] + 'Error';
      get(selectors[field] + 'Error').hidden = !invalid;
      const hintID = field === 'maxWidth' || field === 'maxHeight' ? 'imgCompSizeHint'
        : field === 'quality' && forPng ? 'imgCompPngQuality' : '';
      const description = [hintID, invalid ? errorID : ''].filter(Boolean).join(' ');
      if (description) fields[field].setAttribute('aria-describedby', description);
      else fields[field].removeAttribute('aria-describedby');
    }

    // A missing budget still lets the user check the first dimensions.
    const dimensions = source && (checked.ok ? checked : validateSettings({
      ...DEFAULT_SETTINGS, maxWidth: raw.maxWidth, maxHeight: raw.maxHeight,
    }, source.image, source.format));
    const estimate = dimensions?.ok ? dimensionText(dimensions.value.first, true) : '';
    text('Estimate', estimate ? `${copy.estimate} · ${estimate}` : copy[source ? 'invalidOptions' : 'estimateEmpty']);
    const parameters = [copy[targeting ? 'targetMode' : 'qualityMode'], estimate];
    if (checked.ok && targeting) parameters.push(exactBytes(checked.value.targetBytes!, locale));
    if (!forPng) parameters.push(`${copy[targeting ? 'maxQuality' : 'quality']} · ${number.format(Number(raw.quality))}`);
    text('Parameters', parameters.filter(Boolean).join(' · '));
    compress.disabled = !source || !canvasAvailable || !checked.ok || busy !== null;
    copyButton.disabled = !result;
    get('Source').setAttribute('aria-busy', String(busy === 'decoding'));
    get('Result').setAttribute('aria-busy', String(busy === 'encoding'));

    const issue = error ?? (!canvasAvailable ? 'errorCanvas' : !checked.ok ? 'invalidOptions' : null);
    const degradation = issue ?? permissionIssue;
    root.dataset.process = busy ?? (issue ? 'error' : result ? 'done' : source ? 'ready' : 'empty');
    root.dataset.errorCode = degradation ?? '';
    if (degradation) root.dataset.presentationDegraded = 'true';
    else delete root.dataset.presentationDegraded;
    if (view === 'primary' && degradation) show('degraded');
    else if (view === 'degraded' && !degradation) show('primary');

    const current = busy ?? permissionIssue ?? issue ?? status;
    const label = current ? copy[current] : '';
    text('Status', label, true);
    text('SettingsStatus', label, true);
    text('Live', label);
    text('Attempts', searching ? message('attempted', { count: number.format(attempts) }) : '', true);
  }

  function setPreview(frameID: string, id: string, url: string | undefined, alt: string) {
    const frame = get(frameID);
    if (!url) {
      frame.replaceChildren();
    } else {
      const image = document.createElement('img');
      image.id = 'imgComp' + id;
      image.alt = alt;
      image.src = url;
      frame.replaceChildren(image);
    }
  }

  function updateSource() {
    text('Source', `${copy.sourceLabel} · ${source ? slotText(source.format, source.image, source.file.size) : copy.sourceEmpty}`);
    text('SourceName', source?.file.name ?? '');
    text('SourceSize', source ? fileText(source.format, source.image, source.file.size) : '');
    get('Compare').hidden = !source;
    setPreview('OriginalFrame', 'OriginalPreview', source?.url, copy.originalPreviewAlt);
  }

  function updateResult(encoded?: Encoded, targetBytes?: number) {
    if (result) URL.revokeObjectURL(result.url);
    result = null;
    let difference = '';
    let outcomeText = '';
    let originalFits = false;
    delete root.dataset.targetOutcome;
    if (encoded && source) {
      const { tier, bytes, blob } = encoded;
      const delta = sizeChange(source.file.size, bytes, locale)!;
      difference = message(delta.direction, { bytes: delta.bytes, percent: delta.percent });
      const outcome = targetOutcome(source.file.size, bytes, targetBytes);
      root.dataset.targetOutcome = outcome.state;
      if (outcome.state !== 'off') {
        const qualified = outcome.state === 'missed' ? [copy.targetMissed, copy.smallest] : [copy.targetMet];
        qualified.push(`${copy.targetLimit} ${exactBytes(outcome.targetBytes, locale)}`, `${copy.actualSize} ${exactBytes(bytes, locale)}`);
        if (outcome.excess) qualified.push(`${copy.excess} ${exactBytes(outcome.excess, locale)}`);
        outcomeText = qualified.join(' · ');
        originalFits = outcome.originalFits;
      }
      const summary = [
        `${copy.sourceLabel} · ${fileText(source.format, source.image, source.file.size)}`,
        `${copy.resultLabel} · ${fileText(tier.format, tier, bytes)}`,
        difference,
        outcomeText,
      ].filter(Boolean).join('\n');
      result = { ...encoded, url: URL.createObjectURL(blob), name: compressedName(source.file.name, tier.format), summary };
    }
    const tier = result?.tier;
    text('Result', `${copy.resultLabel} · ${result ? slotText(result.tier.format, result.tier, result.bytes) : copy.resultEmpty}`);
    text('ResultSize', result ? fileText(result.tier.format, result.tier, result.bytes) : copy.resultEmpty);
    text('EncodedQuality', tier?.quality === undefined ? '' : `${copy.encodedQuality} · ${number.format(Math.round(tier.quality * 100))}`, true);
    text('Difference', difference);
    text('TargetOutcome', outcomeText, true);
    get('OriginalFits').hidden = !originalFits;
    setPreview('ResultFrame', 'ResultPreview', result?.url, copy.resultPreviewAlt);

    get('ResultActions').hidden = !result;
    download.hidden = !result || !canDownload;
    download.setAttribute('aria-disabled', String(!result || !canDownload));
    openResult.hidden = !result || canDownload;
    if (result) {
      openResult.href = result.url;
      download.href = result.url;
      download.download = result.name;
    } else {
      openResult.removeAttribute('href');
      download.removeAttribute('href');
      download.removeAttribute('download');
    }
    get('ManualField').hidden = true;
    manual.value = '';
  }

  function releaseSource() {
    if (source) {
      source.image.release();
      URL.revokeObjectURL(source.url);
      source = null;
    }
    updateSource();
  }

  function schedule(task: () => Promise<void>) {
    if (active) {
      pending = task;
      return;
    }
    active = true;
    void task().finally(() => {
      active = false;
      const next = pending;
      pending = null;
      if (next) schedule(next);
    });
  }

  function select(files: ArrayLike<File>, drop = false) {
    if (!files.length && !drop) {
      status = 'cancelled';
      render();
      return;
    }
    const revision = ++fileVersion;
    ++parameterVersion;
    pending = null;
    error = status = permissionIssue = null;
    searching = false;
    releaseSource();
    updateResult();
    const file = files[0];
    if (files.length !== 1 || !(file instanceof File)) {
      busy = null;
      error = files.length > 1 ? 'manyFiles' : 'remoteDrop';
      render();
      return;
    }
    busy = 'decoding';
    render();
    schedule(() => readFile(file, revision));
  }

  async function readFile(file: File, revision: number) {
    const current = () => fileVersion === revision;
    let image: DecodedImage | undefined;
    try {
      const issue = inputSizeError(file.size);
      if (issue) { error = issue; return; }
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (!current()) return;
      const inspected = inspectImage(bytes);
      if (!inspected.ok) { error = inspected.code; return; }
      const { format } = inspected.value;
      if (format === 'avif') { error = 'unsupported'; return; }
      const blob = file.slice(0, file.size, FORMATS[format].mime);
      try {
        image = await decodeImage(blob);
      } catch {
        if (!current()) return;
        let issue: Message = 'damaged';
        try {
          const sample = await decodeImage(decodeSample(format));
          sample.release();
        } catch {
          issue = 'decoderUnavailable';
        }
        if (current()) error = issue;
        return;
      }
      if (!current()) return;
      if (!withinImageLimits(image)) { error = 'decodedLimit'; return; }
      source = { file, format, image, url: URL.createObjectURL(blob) };
      image = undefined;
      status = 'ready';
      updateSource();
    } catch {
      if (current()) error = 'errorInput';
    } finally {
      image?.release();
      if (current()) {
        busy = null;
        render();
      }
    }
  }

  function changeSettings(event: Event) {
    const raw = rawSettings();
    if ((raw.mode !== 'target' && [fields.target, unitField, resizeField].some(field => field === event.target)) ||
      (source?.format === 'png' && event.target === fields.quality)) return;
    ++parameterVersion;
    if (busy === 'encoding') {
      pending = null;
      busy = null;
    }
    searching = false;
    if (source) {
      error = null;
      status = 'ready';
    }
    permissionIssue = null;
    updateResult();
    render();
  }

  function startEncoding() {
    if (!source || busy || !canvasAvailable) return;
    const checked = effectiveSettings();
    if (!checked.ok) {
      render();
      return;
    }
    const snapshot = source;
    const fileRevision = fileVersion;
    const revision = ++parameterVersion;
    updateResult();
    error = status = permissionIssue = null;
    busy = 'encoding';
    attempts = 0;
    searching = checked.value.targetBytes !== undefined;
    render();
    schedule(() => encode(snapshot, checked.value, () => fileVersion === fileRevision && parameterVersion === revision));
  }

  async function encode(snapshot: Source, settings: Settings, current: () => boolean) {
    try {
      const { format, image } = snapshot;
      if (!capabilities.get(format)) {
        const capability = await probeFormat(format);
        if (!current()) return;
        if (capability !== 'available') {
          canvasAvailable = hasCanvas();
          error = canvasAvailable ? 'codecUnavailable' : 'errorCanvas';
          return;
        }
        capabilities.set(format, true);
      }
      let best: Encoded | null = null;
      for (const tier of encodingTiers(settings, format)) {
        const output = await encodeImage(image, tier);
        if (!current()) return;
        attempts++;
        if (searching) text('Attempts', message('attempted', { count: number.format(attempts) }), true);
        if (!output.ok) {
          if (output.code === 'outputLimit') continue;
          if (output.code === 'errorCanvas') canvasAvailable = false;
          error = output.code;
          return;
        }
        const candidate = { tier, blob: output.blob, bytes: output.blob.size };
        const selection = retainCandidate(best, candidate, settings.targetBytes);
        best = selection.best;
        if (selection.stop) break;
      }
      if (!best) { error = 'noCandidate'; return; }
      updateResult(best, settings.targetBytes);
      status = root.dataset.targetOutcome === 'met' ? 'targetMet'
        : root.dataset.targetOutcome === 'missed' ? 'targetMissed' : 'done';
    } catch {
      if (current()) error = 'errorEncode';
    } finally {
      if (current()) {
        busy = null;
        render();
      }
    }
  }

  function reset() {
    ++fileVersion;
    ++parameterVersion;
    pending = null;
    busy = null;
    error = status = permissionIssue = null;
    searching = false;
    modeField.value = DEFAULT_SETTINGS.mode;
    unitField.value = DEFAULT_SETTINGS.unit;
    resizeField.checked = DEFAULT_SETTINGS.allowResize;
    for (const field of Object.keys(fields) as (keyof typeof fields)[]) fields[field].value = DEFAULT_SETTINGS[field];
    fileInput.value = '';
    releaseSource();
    updateResult();
    render();
  }

  function focusExit() {
    tabNavigation = false;
    exit.focus({ preventScroll: true });
  }

  function collapse() {
    show('primary');
    focusExit();
  }

  function toggleSettings() {
    if (view === 'fullscreen') return;
    if (view === 'settingsOpen') {
      if (settingsFrom === 'reveal') {
        show('reveal');
        settingsFocus?.focus({ preventScroll: true });
        if (!settingsFocus || document.activeElement !== settingsFocus) settingsToggle.focus();
      } else {
        collapse();
      }
      return;
    }
    settingsFrom = view;
    settingsFocus = document.activeElement instanceof HTMLElement && root.contains(document.activeElement)
      ? document.activeElement : null;
    show('settingsOpen');
    modeField.focus();
  }

  async function toggleFullscreen() {
    if (view === 'fullscreen') {
      ++fullscreenRequest;
      displayMode = 'inline';
      if (permissionIssue === 'fullscreenFallback') permissionIssue = null;
      collapse();
      render();
      if (document.fullscreenElement === root) {
        try { await document.exitFullscreen(); } catch { /* The exit control remains available. */ }
      }
      return;
    }
    const request = ++fullscreenRequest;
    displayMode = 'fallback';
    show('fullscreen');
    focusExit();
    try {
      await root.requestFullscreen();
      if (request !== fullscreenRequest) {
        if (root.dataset.presentationState !== 'fullscreen' && document.fullscreenElement === root) await document.exitFullscreen();
      } else if (document.fullscreenElement === root) {
        displayMode = 'fullscreen';
        show('fullscreen');
      } else {
        permissionIssue = 'fullscreenFallback';
        render();
      }
    } catch {
      if (request !== fullscreenRequest) return;
      permissionIssue = 'fullscreenFallback';
      render();
    }
  }

  function toggleWorkspace() {
    if (view === 'fullscreen') void toggleFullscreen();
    else if (view === 'settingsOpen') toggleSettings();
    else if (view === 'reveal') collapse();
    else show('reveal');
  }

  exit.addEventListener('click', event => {
    event.preventDefault();
    toggleWorkspace();
  });
  exit.addEventListener('focus', () => {
    if (tabNavigation && revealTriggers.includes('focus') && (view === 'primary' || view === 'degraded')) show('reveal');
  });
  get('Pick').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    select(fileInput.files ?? []);
    fileInput.value = '';
  });
  fileInput.addEventListener('cancel', () => select([]));
  get('Sample').addEventListener('click', () => select([sampleFile()]));
  compress.addEventListener('click', startEncoding);
  get('Clear').addEventListener('click', reset);
  settingsToggle.addEventListener('click', toggleSettings);
  get('SettingsClose').addEventListener('click', toggleSettings);
  get('Fullscreen').addEventListener('click', () => void toggleFullscreen());
  for (const field of Object.values(fields)) field.addEventListener('input', changeSettings);
  for (const field of [modeField, unitField, resizeField]) field.addEventListener('change', changeSettings);

  copyButton.addEventListener('click', async () => {
    const snapshot = result;
    if (!snapshot) return;
    try {
      await navigator.clipboard.writeText(snapshot.summary);
      if (snapshot !== result) return;
      permissionIssue = null;
      status = 'copied';
    } catch {
      if (snapshot !== result) return;
      get('ManualField').hidden = false;
      manual.value = snapshot.summary;
      permissionIssue = 'manualCopy';
      if (view === 'reveal') {
        manual.focus();
        manual.select();
      }
    }
    render();
  });

  download.addEventListener('click', event => {
    const snapshot = result;
    if (!snapshot || !canDownload) {
      event.preventDefault();
      return;
    }
    if (!event.defaultPrevented) {
      try {
        const handoff = URL.createObjectURL(snapshot.blob);
        download.href = handoff;
        downloadTimers.set(handoff, setTimeout(() => {
          if (download.getAttribute('href') === handoff && result === snapshot) download.href = snapshot.url;
          URL.revokeObjectURL(handoff);
          downloadTimers.delete(handoff);
        }, DOWNLOAD_GRACE_MS));
      } catch {
        event.preventDefault();
      }
    }
    setTimeout(() => {
      if (result !== snapshot) return;
      openResult.hidden = false;
      permissionIssue = event.defaultPrevented ? 'errorDownload' : null;
      status = event.defaultPrevented ? null : 'downloadRequested';
      render();
    }, 0);
  });

  document.addEventListener('keydown', event => {
    if (event.isComposing || event.keyCode === 229 || event.defaultPrevented) return;
    if (event.key === 'Tab' && !event.repeat) {
      tabNavigation = true;
      setTimeout(() => { tabNavigation = false; }, 0);
    }
    const key = [event.ctrlKey && 'Control', event.metaKey && 'Meta', event.altKey && 'Alt', event.shiftKey && 'Shift', event.key]
      .filter(Boolean).join('+');
    const action = shortcuts[key];
    if (!action || (action === 'exit' && (view === 'primary' || view === 'degraded'))) return;
    event.preventDefault();
    if (event.repeat) return;
    if (action === 'compress') startEncoding();
    if (action === 'settings') toggleSettings();
    if (action === 'fullscreen') void toggleFullscreen();
    if (action === 'exit') toggleWorkspace();
  });

  if (revealTriggers.includes('pointer')) {
    document.addEventListener('pointermove', event => {
      if ((view === 'primary' || view === 'degraded') && event.isTrusted && event.pointerType === 'mouse'
        && event.clientX >= 0 && event.clientX < CORNER_PX && event.clientY >= 0 && event.clientY < CORNER_PX) {
        show('reveal');
      }
    });
  }

  const dropTypes = (event: DragEvent) => event.dataTransfer?.types.some(type => type === 'Files' || type === 'text/uri-list');
  document.addEventListener('dragover', event => {
    if (dropTypes(event)) event.preventDefault();
  });
  document.addEventListener('drop', event => {
    if (!dropTypes(event) || !event.dataTransfer) return;
    event.preventDefault();
    if (view === 'fullscreen') return;
    show('reveal');
    select(event.dataTransfer.files, true);
  });

  document.addEventListener('fullscreenchange', () => {
    if (document.fullscreenElement === root && view === 'fullscreen') {
      displayMode = 'fullscreen';
      show('fullscreen');
    } else if (displayMode === 'fullscreen') {
      ++fullscreenRequest;
      displayMode = 'inline';
      collapse();
    }
  });

  window.addEventListener('pagehide', () => {
    ++fullscreenRequest;
    displayMode = 'inline';
    reset();
    show('primary');
    for (const [url, timer] of downloadTimers) {
      clearTimeout(timer);
      URL.revokeObjectURL(url);
    }
    downloadTimers.clear();
  });

  show(view);
  render();
}

const root = document.querySelector<HTMLElement>(presentation.primary.root);
if (root) init(root);
