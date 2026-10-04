import { byId, bindCopyBtn } from "./toolkit";
import { readFiniteNumber } from "../lib/daily-calculations";
import type { dailyText } from "../lib/daily-tool-i18n";
import type { Lang } from "../lib/i18n";

export function getDailyData() {
  return JSON.parse(byId<HTMLElement>("dailyData").textContent ?? "{}") as {
    lang: Lang;
    locale: string;
    copy: ReturnType<typeof dailyText>;
  };
}
export function text(id: string, value: string | number): void {
  const element = byId<HTMLElement>(id);
  const next = String(value);
  if (element.textContent !== next) element.textContent = next;
}
export function numberInput(id: string): number | null {
  return readFiniteNumber(byId<HTMLInputElement>(id).value);
}
export function bindLiveForm(id: string, update: () => void): void {
  const form = byId<HTMLFormElement>(id);
  form.addEventListener("input", update);
  form.addEventListener("change", update);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    update();
  });
}
export function copyControl(
  id: string,
  getValue: () => string,
): (enabled: boolean) => void {
  bindCopyBtn(id, getValue);
  return (enabled) => {
    byId<HTMLButtonElement>(id).disabled = !enabled;
  };
}
export function markInvalid(id: string, invalid: boolean): void {
  const input = byId<HTMLInputElement>(id);
  if (invalid) input.setAttribute("aria-invalid", "true");
  else input.removeAttribute("aria-invalid");
}
