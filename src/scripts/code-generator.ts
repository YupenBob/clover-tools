import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';
import { byId, bindCtrlEnter, hideStatus, showStatus } from './toolkit';
import type { qrText } from '../lib/visual-tool-i18n';

const t = JSON.parse(byId<HTMLElement>('qrTextLabels').textContent ?? '{}') as ReturnType<
  typeof qrText
>;
const input = byId<HTMLTextAreaElement>('qrText');
const type = byId<HTMLSelectElement>('qrType');
const size = byId<HTMLSelectElement>('qrSize');
const level = byId<HTMLSelectElement>('qrLevel');
const canvas = byId<HTMLCanvasElement>('qrCanvas');
const svg = byId<SVGSVGElement>('barcodeSvg');
const preview = byId<HTMLElement>('qrPreview');
const empty = byId<HTMLElement>('qrEmpty');
const download = byId<HTMLButtonElement>('qrDownload');
const generateButton = byId<HTMLButtonElement>('qrBtn');
let revision = 0;
let exportImage: string | null = null;

function invalidate() {
  revision++;
  exportImage = null;
  download.disabled = true;
  generateButton.disabled = false;
  preview.dataset.ready = 'false';
  canvas.hidden = true;
  svg.setAttribute('hidden', '');
  empty.hidden = false;
  hideStatus('qrStatus');
  byId<HTMLElement>('qrLevelField').hidden = type.value !== 'qrcode';
  size.disabled = type.value !== 'qrcode';
}

async function barcodeImage(source: SVGSVGElement): Promise<string> {
  const url = URL.createObjectURL(
    new Blob([new XMLSerializer().serializeToString(source)], { type: 'image/svg+xml' }),
  );
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const target = document.createElement('canvas');
    target.width = image.naturalWidth;
    target.height = image.naturalHeight;
    target.getContext('2d')!.drawImage(image, 0, 0);
    return target.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function generate() {
  invalidate();
  const text = input.value.trim();
  if (!text) {
    showStatus('qrStatus', 'error', t.missing);
    return;
  }
  const current = revision;
  generateButton.disabled = true;
  showStatus('qrStatus', 'info', t.generating);
  try {
    if (type.value === 'qrcode') {
      const target = document.createElement('canvas');
      await QRCode.toCanvas(target, text, {
        width: Number(size.value),
        margin: 4,
        errorCorrectionLevel: level.value as 'L' | 'M' | 'Q' | 'H',
        color: { dark: '#232019', light: '#ffffff' },
      });
      if (current !== revision) return;
      canvas.width = target.width;
      canvas.height = target.height;
      canvas.getContext('2d')!.drawImage(target, 0, 0);
      exportImage = target.toDataURL('image/png');
      canvas.hidden = false;
    } else {
      const target = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      JsBarcode(target, text, {
        format: 'CODE128',
        width: 2,
        height: 80,
        displayValue: true,
        margin: 12,
        lineColor: '#232019',
        background: '#ffffff',
      });
      const png = await barcodeImage(target);
      if (current !== revision) return;
      for (const attr of Array.from(target.attributes)) svg.setAttribute(attr.name, attr.value);
      svg.replaceChildren(...Array.from(target.childNodes));
      exportImage = png;
      svg.removeAttribute('hidden');
    }
    empty.hidden = true;
    preview.dataset.ready = 'true';
    download.disabled = false;
    showStatus('qrStatus', 'success', t.success);
  } catch (error) {
    if (current === revision)
      showStatus('qrStatus', 'error', `${t.failed}: ${(error as Error).message}`);
  } finally {
    if (current === revision) generateButton.disabled = false;
  }
}

for (const element of [input, type, size, level])
  element.addEventListener(element === input ? 'input' : 'change', invalidate);
generateButton.addEventListener('click', generate);
byId<HTMLButtonElement>('qrSample').addEventListener('click', () => {
  input.value = 'https://clovertools.cn';
  invalidate();
});
download.addEventListener('click', () => {
  if (!exportImage) return;
  const link = document.createElement('a');
  link.href = exportImage;
  link.download = 'clover-code.png';
  link.click();
});
bindCtrlEnter('qrText', generate);
