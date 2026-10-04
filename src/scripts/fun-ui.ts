import { byId } from "./toolkit";
import type { FunText } from "../lib/fun-tool-i18n";
import type { Lang } from "../lib/i18n";

type FunSection = "beads" | "avatar" | "quiz";
export function getFunData<K extends FunSection>(
  _section: K,
): { lang: Lang; copy: Omit<FunText, FunSection> & Pick<FunText, K> } {
  return JSON.parse(byId<HTMLElement>("funData").textContent ?? "{}");
}
export function setText(id: string, value: string | number): void {
  byId<HTMLElement>(id).textContent = String(value);
}
export function saveBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  // Keep the object alive long enough for the browser to start a download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("canvas"))),
      "image/png",
    ),
  );
}
export function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  width: number,
  lineHeight: number,
): number {
  let line = "";
  const segments =
    typeof Intl.Segmenter === "function"
      ? Array.from(
          new Intl.Segmenter(undefined, { granularity: "word" }).segment(value),
          (part) => part.segment,
        )
      : value.split(/(\s+)/);
  const flush = () => {
    ctx.fillText(line.trimEnd(), x, y);
    y += lineHeight;
    line = "";
  };
  for (const segment of segments) {
    if (!line && /^\s+$/.test(segment)) continue;
    if (ctx.measureText(segment).width > width) {
      // Long unbroken text still fits, while ordinary words stay together.
      for (const char of segment) {
        if (line && ctx.measureText(line + char).width > width) flush();
        line += char;
      }
      continue;
    }
    if (line && ctx.measureText(line + segment).width > width) flush();
    if (!line && /^\s+$/.test(segment)) continue;
    line += segment;
  }
  if (line) flush();
  return y;
}
