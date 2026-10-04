/** Image-to-bead quantization. Numbers identify this chart's colors, not a bead brand. */
export type Rgb = readonly [number, number, number];
export interface BeadPattern {
  width: number;
  height: number;
  palette: { hex: string; count: number }[];
  cells: Int16Array;
  total: number;
}

export function gridSize(
  width: number,
  height: number,
  longest: number,
): [number, number] {
  if (
    ![width, height, longest].every(Number.isFinite) ||
    width <= 0 ||
    height <= 0 ||
    !Number.isInteger(longest) ||
    longest < 8 ||
    longest > 96
  )
    throw new RangeError("grid");
  const scale = longest / Math.max(width, height);
  return [
    Math.max(1, Math.round(width * scale)),
    Math.max(1, Math.round(height * scale)),
  ];
}
export function parseBeadPalette(source: string): string[] {
  const values = source
    .trim()
    .split(/[\s,;，；]+/)
    .filter(Boolean);
  if (
    values.length < 2 ||
    values.length > 32 ||
    values.some((value) => !/^#?[0-9a-f]{6}$/i.test(value))
  )
    throw new RangeError("palette");
  const colors = [
    ...new Set(
      values.map((value) => "#" + value.replace(/^#/, "").toUpperCase()),
    ),
  ];
  if (colors.length < 2) throw new RangeError("palette");
  return colors;
}
const hex = (rgb: Rgb): string =>
  "#" +
  rgb
    .map((v) => Math.round(v).toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
const rgb = (value: string): Rgb => [
  parseInt(value.slice(1, 3), 16),
  parseInt(value.slice(3, 5), 16),
  parseInt(value.slice(5, 7), 16),
];
// Weight green most heavily; quantization is a screen-color approximation.
function distance(a: Rgb, b: Rgb): number {
  return (
    2 * (a[0] - b[0]) ** 2 + 4 * (a[1] - b[1]) ** 2 + 3 * (a[2] - b[2]) ** 2
  );
}
function reduceColors(pixels: Rgb[], limit: number): Rgb[] {
  const histogram = new Map<string, { color: Rgb; weight: number }>();
  for (const color of pixels) {
    const key = color.join(",");
    const entry = histogram.get(key);
    if (entry) entry.weight++;
    else histogram.set(key, { color, weight: 1 });
  }
  const boxes = [[...histogram.values()]];
  const spread = (box: (typeof boxes)[number]) => {
    const ranges = [0, 1, 2].map(
      (channel) =>
        Math.max(...box.map((p) => p.color[channel])) -
        Math.min(...box.map((p) => p.color[channel])),
    );
    const channel = ranges.indexOf(Math.max(...ranges));
    return {
      channel,
      range: ranges[channel],
      weight: box.reduce((n, p) => n + p.weight, 0),
    };
  };
  while (boxes.length < limit) {
    let index = -1,
      best = -1;
    boxes.forEach((box, i) => {
      const { range, weight } = spread(box);
      const score = range * Math.sqrt(weight);
      if (box.length > 1 && score > best) {
        index = i;
        best = score;
      }
    });
    if (index < 0) break;
    const box = boxes[index];
    const { channel, weight } = spread(box);
    box.sort((a, b) => a.color[channel] - b.color[channel]);
    let cumulative = 0,
      split = 1;
    for (let i = 0; i < box.length - 1; i++) {
      cumulative += box[i].weight;
      split = i + 1;
      if (cumulative >= weight / 2) break;
    }
    boxes.splice(index, 1, box.slice(0, split), box.slice(split));
  }
  return boxes.map((box) => {
    const weight = box.reduce((n, p) => n + p.weight, 0);
    return [0, 1, 2].map((channel) =>
      Math.round(
        box.reduce((n, p) => n + p.color[channel] * p.weight, 0) / weight,
      ),
    ) as unknown as Rgb;
  });
}

export function makeBeadPattern(
  data: ArrayLike<number>,
  width: number,
  height: number,
  maxColors = 12,
  custom?: string[],
): BeadPattern {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    width > 96 ||
    height > 96 ||
    data.length !== width * height * 4 ||
    !Number.isInteger(maxColors) ||
    maxColors < 2 ||
    maxColors > 32
  )
    throw new RangeError("image");
  const pixels: Rgb[] = [];
  const positions: number[] = [];
  for (let i = 0; i < data.length; i += 4) {
    if (
      ![data[i], data[i + 1], data[i + 2], data[i + 3]].every(
        (v) => Number.isInteger(v) && v >= 0 && v <= 255,
      )
    )
      throw new RangeError("image");
    if (data[i + 3] < 128) continue;
    const alpha = data[i + 3] / 255;
    pixels.push(
      [0, 1, 2].map((c) =>
        Math.round(data[i + c] * alpha + 255 * (1 - alpha)),
      ) as unknown as Rgb,
    );
    positions.push(i / 4);
  }
  const cells = new Int16Array(width * height).fill(-1);
  if (!pixels.length) return { width, height, palette: [], cells, total: 0 };
  const colors = custom
    ? parseBeadPalette(custom.join(",")).map(rgb)
    : reduceColors(pixels, maxColors);
  // Merge equal averaged colors, then sort by brightness for stable labels.
  const unique = [...new Set(colors.map(hex))].sort((a, b) => {
    const ar = rgb(a),
      br = rgb(b);
    return (
      ar[0] * 0.299 +
        ar[1] * 0.587 +
        ar[2] * 0.114 -
        (br[0] * 0.299 + br[1] * 0.587 + br[2] * 0.114) || a.localeCompare(b)
    );
  });
  const palette = unique.map((color) => ({ hex: color, count: 0 }));
  const values = unique.map(rgb);
  pixels.forEach((color, i) => {
    let closest = 0,
      min = Infinity;
    values.forEach((candidate, j) => {
      const d = distance(color, candidate);
      if (d < min) {
        min = d;
        closest = j;
      }
    });
    cells[positions[i]] = closest;
    palette[closest].count++;
  });
  // Hide unused custom colors and relabel the grid and count table together.
  const remap = palette.map(
    (_, i) => palette.slice(0, i).filter((p) => p.count > 0).length,
  );
  for (let i = 0; i < cells.length; i++)
    if (cells[i] >= 0) cells[i] = remap[cells[i]];
  return {
    width,
    height,
    palette: palette.filter((p) => p.count > 0),
    cells,
    total: pixels.length,
  };
}

export function beadMaterialsCsv(pattern: BeadPattern): string {
  return (
    "code,hex,beads\r\n" +
    pattern.palette
      .map(
        (color, i) =>
          `${String(i + 1).padStart(2, "0")},${color.hex},${color.count}`,
      )
      .join("\r\n") +
    "\r\n"
  );
}
export function beadTextColor(color: string): string {
  const [r, g, b] = rgb(color);
  return r * 0.299 + g * 0.587 + b * 0.114 > 155 ? "#252525" : "#FFFFFF";
}
