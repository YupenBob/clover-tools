import { byId, hideStatus, showStatus } from './toolkit';
import {
  hslToRgb,
  parseHex,
  parseHsl,
  parseRgb,
  previewInk,
  rgbToHex,
  rgbToHsl,
  type RGB,
} from '../lib/color-values';
import type { colorText } from '../lib/visual-tool-i18n';

const t = JSON.parse(byId<HTMLElement>('colorTextLabels').textContent ?? '{}') as ReturnType<
  typeof colorText
>;
const picker = byId<HTMLInputElement>('ccPicker');
const hexInput = byId<HTMLInputElement>('ccHex');
const rgbInput = byId<HTMLInputElement>('ccRgb');
const hslInput = byId<HTMLInputElement>('ccHsl');
const preview = byId<HTMLElement>('ccPreview');
const detail = byId<HTMLElement>('ccDetail');
const variants = byId<HTMLElement>('ccVariants');

function render(rgb: RGB) {
  const hex = rgbToHex(rgb),
    hsl = rgbToHsl(rgb);
  const [h, s, l] = hsl;
  const hslText = `${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%`;
  const values = [hex, `rgb(${rgb.join(', ')})`, `hsl(${hslText})`];
  picker.value = hexInput.value = hex;
  rgbInput.value = rgb.join(', ');
  hslInput.value = hslText;
  preview.style.backgroundColor = hex;
  preview.style.color = previewInk(rgb);
  byId<HTMLElement>('ccPreviewValue').textContent = hex;
  detail.querySelectorAll<HTMLButtonElement>('.color-value').forEach((button, index) => {
    button.dataset.value = values[index];
    button.querySelector('code')!.textContent = values[index];
  });
  const related = [
    [(h + 180) % 360, s, l],
    [h, s, Math.max(0, l - 20)],
    [h, s, Math.min(100, l + 20)],
  ];
  variants.querySelectorAll<HTMLButtonElement>('.color-variant').forEach((button, index) => {
    const hex = rgbToHex(hslToRgb(related[index] as [number, number, number]));
    button.dataset.hex = hex;
    button.querySelector<HTMLElement>('.color-variant-swatch')!.style.backgroundColor = hex;
    button.querySelector('code')!.textContent = hex;
  });
  for (const input of [hexInput, rgbInput, hslInput]) input.removeAttribute('aria-invalid');
  hideStatus('ccStatus');
}

function commit(input: HTMLInputElement) {
  let rgb: RGB | null = null;
  if (input === hexInput) rgb = parseHex(input.value);
  if (input === rgbInput) rgb = parseRgb(input.value);
  if (input === hslInput) {
    const hsl = parseHsl(input.value);
    if (hsl) rgb = hslToRgb(hsl);
  }
  if (rgb) render(rgb);
  else {
    input.setAttribute('aria-invalid', 'true');
    showStatus(
      'ccStatus',
      'error',
      input === hexInput ? t.invalidHex : input === rgbInput ? t.invalidRgb : t.invalidHsl,
    );
  }
}

picker.addEventListener('input', () => {
  const rgb = parseHex(picker.value);
  if (rgb) render(rgb);
});
for (const input of [hexInput, rgbInput, hslInput]) {
  input.addEventListener('change', () => commit(input));
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commit(input);
    }
  });
}
detail.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('.color-value');
  if (button) window.CT.copy(button.dataset.value ?? '');
});
variants.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('.color-variant');
  if (button) {
    const rgb = parseHex(button.dataset.hex ?? '');
    if (rgb) render(rgb);
  }
});
render([201, 169, 110]);
