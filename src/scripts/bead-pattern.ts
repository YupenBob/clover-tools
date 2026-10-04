import {
  beadMaterialsCsv,
  beadTextColor,
  gridSize,
  makeBeadPattern,
  parseBeadPalette,
  type BeadPattern,
} from "../lib/bead-pattern";
import { byId, bindCopyBtn, hideStatus, showStatus } from "./toolkit";
import {
  getFunData,
  setText,
  saveBlob,
  canvasBlob,
  wrapCanvasText,
} from "./fun-ui";

const { copy } = getFunData("beads");
const t = copy.beads;
const canvas = byId<HTMLCanvasElement>("bpCanvas");
const ctx = canvas.getContext("2d")!;
const fileInput = byId<HTMLInputElement>("bpFile");
let source: HTMLCanvasElement | ImageBitmap | null = null;
let pattern: BeadPattern | null = null;
let revision = 0;
let patternVersion = 0;
const controls = ["bpPng", "bpPrint", "bpCsv", "bpCopy"];
const enableExports = (enabled: boolean) =>
  controls.forEach((id) => {
    byId<HTMLButtonElement>(id).disabled = !enabled;
  });

function sampleImage(): HTMLCanvasElement {
  const image = document.createElement("canvas");
  image.width = image.height = 32;
  const c = image.getContext("2d")!;
  // An original pixel clover, built from four overlapping leaf lobes.
  c.fillStyle = "#254B39";
  for (const [x, y] of [
    [10, 10],
    [21, 10],
    [10, 21],
    [21, 21],
  ]) {
    for (let j = -6; j <= 6; j++)
      for (let i = -6; i <= 6; i++)
        if (i * i + j * j <= 42) c.fillRect(x + i, y + j, 1, 1);
  }
  c.fillStyle = "#4C956C";
  for (const [x, y] of [
    [10, 10],
    [21, 10],
    [10, 21],
    [21, 21],
  ]) {
    for (let j = -4; j <= 4; j++)
      for (let i = -4; i <= 4; i++)
        if (i * i + j * j <= 20) c.fillRect(x + i, y + j, 1, 1);
  }
  c.fillStyle = "#A8C88A";
  for (const [x, y] of [
    [8, 7],
    [19, 7],
    [8, 18],
    [19, 18],
  ])
    c.fillRect(x, y, 3, 3);
  c.fillStyle = "#F2C66D";
  c.fillRect(14, 14, 4, 4);
  return image;
}
function clearPattern(): void {
  patternVersion++;
  pattern = null;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  byId<HTMLElement>("bpMaterials").replaceChildren();
  ["bpTotal", "bpColorCount", "bpDimensions"].forEach((id) => setText(id, "—"));
  canvas.setAttribute("aria-label", t.chartLabel);
  enableExports(false);
}
function resizePlane(): void {
  if (!pattern) return;
  const space = Math.max(160, byId<HTMLElement>("bpFrame").clientWidth - 48);
  const size = Math.min(space, 560, (560 * pattern.width) / pattern.height);
  byId<HTMLElement>("bpPlane").style.width =
    `${Math.floor(size * Number(byId<HTMLSelectElement>("bpZoom").value))}px`;
}
function drawGrid(
  target: CanvasRenderingContext2D,
  chart: BeadPattern,
  cell: number,
  x = 0,
  y = 0,
  codes = true,
): void {
  target.fillStyle = "#FFFEFB";
  target.fillRect(x, y, chart.width * cell, chart.height * cell);
  for (let row = 0; row < chart.height; row++)
    for (let col = 0; col < chart.width; col++) {
      const index = chart.cells[row * chart.width + col];
      if (index < 0) continue;
      const color = chart.palette[index].hex;
      target.fillStyle = color;
      target.fillRect(x + col * cell, y + row * cell, cell, cell);
      if (codes) {
        target.fillStyle = beadTextColor(color);
        target.font = `600 ${Math.floor(cell * 0.43)}px ui-monospace, monospace`;
        target.textAlign = "center";
        target.textBaseline = "middle";
        target.fillText(
          String(index + 1).padStart(2, "0"),
          x + (col + 0.5) * cell,
          y + (row + 0.5) * cell,
        );
      }
    }
  target.lineWidth = 0.6;
  target.strokeStyle = "#6B665633";
  target.beginPath();
  for (let i = 0; i <= chart.width; i++) {
    target.moveTo(x + i * cell, y);
    target.lineTo(x + i * cell, y + chart.height * cell);
  }
  for (let i = 0; i <= chart.height; i++) {
    target.moveTo(x, y + i * cell);
    target.lineTo(x + chart.width * cell, y + i * cell);
  }
  target.stroke();
  target.textAlign = "left";
  target.textBaseline = "alphabetic";
}
function render(): void {
  if (!pattern) return;
  canvas.width = pattern.width * 24;
  canvas.height = pattern.height * 24;
  drawGrid(ctx, pattern, 24, 0, 0, byId<HTMLInputElement>("bpCodes").checked);
  canvas.setAttribute(
    "aria-label",
    `${t.chartLabel}: ${pattern.width} × ${pattern.height}, ${pattern.total} ${t.beadCount}, ${pattern.palette.length} ${t.colorCount}`,
  );
  resizePlane();
}
function update(): void {
  patternVersion++;
  setText("bpGridValue", byId<HTMLInputElement>("bpGrid").value);
  setText("bpColorsValue", byId<HTMLInputElement>("bpColors").value);
  const custom = byId<HTMLSelectElement>("bpMode").value === "custom";
  byId<HTMLElement>("bpCustomField").hidden = !custom;
  byId<HTMLInputElement>("bpColors").disabled = custom;
  byId<HTMLInputElement>("bpCustom").removeAttribute("aria-invalid");
  hideStatus("bpStatus");
  if (!source) return;
  try {
    const colors = custom
      ? parseBeadPalette(byId<HTMLTextAreaElement>("bpCustom").value)
      : undefined;
    const [width, height] = gridSize(
      source.width,
      source.height,
      Number(byId<HTMLInputElement>("bpGrid").value),
    );
    const reduced = document.createElement("canvas");
    reduced.width = width;
    reduced.height = height;
    const context = reduced.getContext("2d", { willReadFrequently: true })!;
    context.imageSmoothingEnabled = !(source instanceof HTMLCanvasElement);
    context.drawImage(source, 0, 0, width, height);
    pattern = makeBeadPattern(
      context.getImageData(0, 0, width, height).data,
      width,
      height,
      Number(byId<HTMLInputElement>("bpColors").value),
      colors,
    );
    if (!pattern.total) {
      clearPattern();
      showStatus("bpStatus", "info", t.empty);
      return;
    }
    setText("bpTotal", pattern.total.toLocaleString());
    setText("bpColorCount", pattern.palette.length);
    setText("bpDimensions", `${width} × ${height}`);
    const entries = pattern.palette.map((color, i) => {
      const entry = document.createElement("div");
      entry.className = "bead-color-entry";
      const swatch = document.createElement("span");
      swatch.className = "bead-color-swatch";
      swatch.style.backgroundColor = color.hex;
      swatch.style.color = beadTextColor(color.hex);
      swatch.textContent = String(i + 1).padStart(2, "0");
      const value = document.createElement("code");
      value.textContent = color.hex;
      const count = document.createElement("strong");
      count.textContent = color.count.toLocaleString();
      count.setAttribute("aria-label", `${t.amount}: ${color.count}`);
      entry.append(swatch, value, count);
      return entry;
    });
    byId<HTMLElement>("bpMaterials").replaceChildren(...entries);
    render();
    enableExports(true);
  } catch {
    clearPattern();
    byId<HTMLInputElement>("bpCustom").setAttribute("aria-invalid", "true");
    showStatus("bpStatus", "error", t.customError);
  }
}
function useExample(): void {
  revision++;
  if (source instanceof ImageBitmap) source.close();
  source = sampleImage();
  byId<HTMLFormElement>("bpForm").reset();
  byId<HTMLImageElement>("bpSource").src = source.toDataURL();
  byId<HTMLImageElement>("bpSource").hidden = false;
  fileInput.value = "";
  byId<HTMLSelectElement>("bpMode").value = "auto";
  byId<HTMLInputElement>("bpGrid").value = "32";
  byId<HTMLInputElement>("bpColors").value = "8";
  byId<HTMLSelectElement>("bpZoom").value = "1";
  update();
}
async function loadImage(file: File): Promise<void> {
  const current = ++revision;
  if (source instanceof ImageBitmap) source.close();
  source = null;
  clearPattern();
  byId<HTMLImageElement>("bpSource").hidden = true;
  showStatus("bpStatus", "info", t.loading);
  let bitmap: ImageBitmap | null = null;
  try {
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
      file.size > 12 * 1024 * 1024 ||
      file.size < 1
    )
      throw new Error("file");
    bitmap = await createImageBitmap(file);
    if (current !== revision) {
      bitmap.close();
      return;
    }
    if (
      bitmap.width * bitmap.height > 32_000_000 ||
      bitmap.width > 16_000 ||
      bitmap.height > 16_000
    )
      throw new Error("size");
    source = bitmap;
    bitmap = null;
    const thumb = document.createElement("canvas");
    const scale = 192 / Math.max(source.width, source.height);
    thumb.width = Math.max(1, Math.round(source.width * scale));
    thumb.height = Math.max(1, Math.round(source.height * scale));
    thumb.getContext("2d")!.drawImage(source, 0, 0, thumb.width, thumb.height);
    byId<HTMLImageElement>("bpSource").src = thumb.toDataURL();
    byId<HTMLImageElement>("bpSource").hidden = false;
    update();
  } catch {
    bitmap?.close();
    if (current === revision) {
      source = null;
      clearPattern();
      showStatus("bpStatus", "error", t.imageError);
    }
  }
}
function makeChart(chart: BeadPattern): HTMLCanvasElement {
  const result = document.createElement("canvas");
  const cell = 24,
    margin = 48,
    top = 112;
  result.width = Math.max(620, chart.width * cell + margin * 2);
  const columns = result.width >= 850 ? 3 : 2;
  const legendY = top + chart.height * cell + 48;
  result.height =
    legendY + 52 + Math.ceil(chart.palette.length / columns) * 38 + 96;
  const c = result.getContext("2d")!;
  c.fillStyle = "#FFFEFB";
  c.fillRect(0, 0, result.width, result.height);
  c.fillStyle = "#263A31";
  c.font = "600 24px system-ui, sans-serif";
  c.fillText(t.exportTitle, margin, 40);
  c.font = "16px system-ui, sans-serif";
  c.fillText(
    `${chart.width} × ${chart.height} · ${chart.total} ${t.beadCount} · ${chart.palette.length} ${t.colorCount}`,
    margin,
    69,
  );
  drawGrid(c, chart, cell, margin, top, true);
  c.fillStyle = "#6B6656";
  c.font = "10px ui-monospace, monospace";
  c.textAlign = "center";
  for (let col = 0; col < chart.width; col++)
    c.fillText(String(col + 1), margin + (col + 0.5) * cell, top - 9);
  c.textAlign = "right";
  for (let row = 0; row < chart.height; row++)
    c.fillText(String(row + 1), margin - 9, top + (row + 0.65) * cell);
  c.textAlign = "left";
  c.font = "600 18px system-ui, sans-serif";
  c.fillText(t.materials, margin, legendY);
  chart.palette.forEach((color, i) => {
    const x = margin + ((i % columns) * (result.width - margin * 2)) / columns;
    const y = legendY + 22 + Math.floor(i / columns) * 38;
    c.fillStyle = color.hex;
    c.fillRect(x, y, 26, 26);
    c.fillStyle = beadTextColor(color.hex);
    c.font = "600 12px ui-monospace, monospace";
    c.fillText(String(i + 1).padStart(2, "0"), x + 5, y + 17);
    c.fillStyle = "#263A31";
    c.font = "14px ui-monospace, monospace";
    c.fillText(`${color.hex}  × ${color.count}`, x + 36, y + 18);
  });
  c.fillStyle = "#6B6656";
  c.font = "12px system-ui, sans-serif";
  wrapCanvasText(
    c,
    t.hint,
    margin,
    result.height - 61,
    result.width - margin * 2,
    18,
  );
  return result;
}
byId<HTMLButtonElement>("bpUpload").addEventListener("click", () =>
  fileInput.click(),
);
fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  if (file) void loadImage(file);
});
const drop = byId<HTMLElement>("bpDrop");
drop.addEventListener("dragover", (event) => {
  event.preventDefault();
  drop.classList.add("is-dragging");
});
drop.addEventListener("dragleave", () => drop.classList.remove("is-dragging"));
drop.addEventListener("drop", (event) => {
  event.preventDefault();
  drop.classList.remove("is-dragging");
  const file = event.dataTransfer?.files[0];
  if (file) void loadImage(file);
});
byId<HTMLFormElement>("bpForm").addEventListener("input", update);
byId<HTMLFormElement>("bpForm").addEventListener("change", update);
byId<HTMLFormElement>("bpForm").addEventListener("submit", (event) => {
  event.preventDefault();
  update();
});
byId<HTMLFormElement>("bpForm").addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
    event.preventDefault();
    update();
  }
});
byId<HTMLButtonElement>("bpDemo").addEventListener("click", useExample);
byId<HTMLInputElement>("bpCodes").addEventListener("change", render);
byId<HTMLSelectElement>("bpZoom").addEventListener("change", resizePlane);
new ResizeObserver(resizePlane).observe(byId<HTMLElement>("bpFrame"));
byId<HTMLButtonElement>("bpPng").addEventListener("click", async () => {
  if (!pattern) return;
  const version = patternVersion;
  try {
    const blob = await canvasBlob(makeChart(pattern));
    if (version === patternVersion) saveBlob("clover-bead-pattern.png", blob);
  } catch {
    showStatus("bpStatus", "error", copy.exportError);
  }
});
byId<HTMLButtonElement>("bpCsv").addEventListener("click", () => {
  if (pattern)
    saveBlob(
      "clover-bead-materials.csv",
      new Blob([beadMaterialsCsv(pattern)], { type: "text/csv;charset=utf-8" }),
    );
});
window.addEventListener("beforeprint", () => {
  const printCanvas = byId<HTMLCanvasElement>("bpPrintCanvas");
  if (!pattern) {
    printCanvas.width = printCanvas.height = 0;
    return;
  }
  const chart = makeChart(pattern);
  printCanvas.width = chart.width;
  printCanvas.height = chart.height;
  printCanvas.getContext("2d")!.drawImage(chart, 0, 0);
});
byId<HTMLButtonElement>("bpPrint").addEventListener("click", () =>
  window.print(),
);
bindCopyBtn("bpCopy", () =>
  pattern
    ? `${t.exportTitle}\n${pattern.width} × ${pattern.height} · ${pattern.total} ${t.beadCount}\n` +
      pattern.palette
        .map(
          (p, i) => `${String(i + 1).padStart(2, "0")}  ${p.hex}  × ${p.count}`,
        )
        .join("\n")
    : "",
);
useExample();
