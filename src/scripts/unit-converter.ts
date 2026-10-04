import { byId, bindCtrlEnter, hideStatus, showStatus } from './toolkit';
import type { Unit, UnitCategory } from '../lib/unit-data';
import type { unitText } from '../lib/visual-tool-i18n';

const { units, copy: t } = JSON.parse(byId<HTMLElement>('unitData').textContent ?? '{}') as {
  units: Record<UnitCategory, Unit[]>;
  copy: ReturnType<typeof unitText>;
};
const category = byId<HTMLSelectElement>('ucCat');
const fromSelect = byId<HTMLSelectElement>('ucFrom');
const toSelect = byId<HTMLSelectElement>('ucTo');
const input = byId<HTMLInputElement>('ucValue');
const copy = byId<HTMLButtonElement>('ucCopy');
let equation = '';

function toBase(value: number, unit: Unit): number {
  if (unit.id === 'c') return value;
  if (unit.id === 'f') return (value - 32) / 1.8;
  if (unit.id === 'k') return value - 273.15;
  return value * (unit.factor ?? 1);
}
function fromBase(value: number, unit: Unit): number {
  if (unit.id === 'c') return value;
  if (unit.id === 'f') return value * 1.8 + 32;
  if (unit.id === 'k') return value + 273.15;
  return value / (unit.factor ?? 1);
}

function convert() {
  hideStatus('ucStatus');
  const available = units[category.value as UnitCategory];
  const from = available.find((unit) => unit.id === fromSelect.value)!;
  const to = available.find((unit) => unit.id === toSelect.value)!;
  const value = Number(input.value);
  const result = fromBase(toBase(value, from), to);
  if (!input.value.trim() || !Number.isFinite(value) || !Number.isFinite(result)) {
    input.setAttribute('aria-invalid', 'true');
    equation = '';
    copy.disabled = true;
    byId<HTMLElement>('ucNumber').textContent = '—';
    byId<HTMLElement>('ucUnit').textContent = '';
    byId<HTMLElement>('ucSource').textContent = '';
    showStatus('ucStatus', 'error', t.invalid);
    return;
  }
  input.removeAttribute('aria-invalid');
  const number = Number(result.toPrecision(12)).toString();
  byId<HTMLElement>('ucNumber').textContent = number;
  byId<HTMLElement>('ucUnit').textContent = to.name;
  byId<HTMLElement>('ucSource').textContent = `${value} ${from.name} =`;
  equation = `${value} ${from.name} = ${number} ${to.name}`;
  copy.disabled = false;
}

function populate() {
  const available = units[category.value as UnitCategory];
  for (const select of [fromSelect, toSelect])
    select.replaceChildren(...available.map((unit) => new Option(unit.name, unit.id)));
  toSelect.value = category.value === 'temperature' ? 'f' : available[1].id;
  convert();
}
category.addEventListener('change', populate);
fromSelect.addEventListener('change', convert);
toSelect.addEventListener('change', convert);
input.addEventListener('input', convert);
byId<HTMLButtonElement>('ucSwap').addEventListener('click', () => {
  const from = fromSelect.value;
  fromSelect.value = toSelect.value;
  toSelect.value = from;
  convert();
});
byId<HTMLButtonElement>('ucBtn').addEventListener('click', convert);
copy.addEventListener('click', () => {
  if (equation) window.CT.copy(equation);
});
bindCtrlEnter('ucValue', convert);
populate();
