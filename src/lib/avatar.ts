/** Original geometric avatar artwork. User text is only hashed, never inserted into SVG. */
export type AvatarStyle = "orbit" | "pixel" | "tile";
export interface AvatarOptions {
  seed: string;
  style: AvatarStyle;
  accent: string;
  background: string;
  shape: "round" | "soft" | "square";
  transparent: boolean;
}
export function avatarRandom(seed: string): () => number {
  let value = 2166136261;
  for (const char of seed.normalize("NFC")) {
    value ^= char.codePointAt(0)!;
    value = Math.imul(value, 16777619);
  }
  return () => {
    value += 0x6d2b79f5;
    let x = value;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
export function createAvatar(options: AvatarOptions): string {
  const { seed, style, accent, background, shape, transparent } = options;
  if (
    !seed.trim() ||
    [...seed].length > 80 ||
    !["orbit", "pixel", "tile"].includes(style) ||
    !["round", "soft", "square"].includes(shape) ||
    ![accent, background].every((color) => /^#[0-9a-f]{6}$/i.test(color))
  )
    throw new RangeError("avatar");
  const random = avatarRandom(seed);
  const pick = (n: number) => Math.floor(random() * n);
  const ink = "#263342";
  const pale = "#FFFCF5";
  const radius = shape === "round" ? 160 : shape === "soft" ? 72 : 0;
  let art = "";
  if (style === "orbit") {
    const width = 130 + pick(4) * 12,
      height = 130 + pick(3) * 14;
    const left = (320 - width) / 2,
      top = (320 - height) / 2;
    const eye = pick(4),
      mouth = pick(3),
      antenna = pick(3);
    art += `<circle cx="160" cy="167" r="111" fill="${accent}" opacity=".13"/>`;
    art += `<path d="M${left - 9} 153v36M${left + width + 9} 153v36" stroke="${ink}" stroke-width="13" stroke-linecap="round"/>`;
    if (antenna !== 2)
      art += `<path d="M160 ${top}v-25" stroke="${ink}" stroke-width="8"/><${antenna === 0 ? 'circle cx="160" cy="' + (top - 30) + '" r="11"' : 'rect x="149" y="' + (top - 41) + '" width="22" height="22" rx="5"'} fill="${accent}" stroke="${ink}" stroke-width="5"/>`;
    art += `<rect x="${left}" y="${top}" width="${width}" height="${height}" rx="${32 + pick(4) * 8}" fill="${accent}" stroke="${ink}" stroke-width="6"/>`;
    art += `<rect x="${left + 14}" y="${top + 28}" width="${width - 28}" height="68" rx="22" fill="${pale}"/>`;
    for (const x of [133, 187]) {
      if (eye === 0)
        art += `<path d="M${x - 8} 155q8 -12 16 0" fill="none" stroke="${ink}" stroke-width="6" stroke-linecap="round"/>`;
      else if (eye === 1)
        art += `<rect x="${x - 7}" y="145" width="14" height="20" rx="5" fill="${ink}"/>`;
      else
        art += `<circle cx="${x}" cy="155" r="${eye === 2 ? 9 : 6}" fill="${ink}"/><circle cx="${x + 2}" cy="152" r="2" fill="${pale}"/>`;
    }
    art +=
      mouth === 0
        ? `<path d="M142 197q18 18 36 0" fill="none" stroke="${ink}" stroke-width="6" stroke-linecap="round"/>`
        : mouth === 1
          ? `<rect x="144" y="195" width="32" height="9" rx="4.5" fill="${ink}"/>`
          : `<circle cx="160" cy="200" r="8" fill="${ink}"/>`;
    art += `<circle cx="${left + 21}" cy="${top + height - 17}" r="4" fill="${pale}"/><circle cx="${left + width - 21}" cy="${top + height - 17}" r="4" fill="${pale}"/>`;
  } else if (style === "pixel") {
    const cell = 23,
      offset = 45;
    // Bilateral silhouette; the face remains readable across every seed.
    for (let y = 0; y < 10; y++)
      for (let x = 0; x < 5; x++) {
        const filled =
          y >= 2 && y <= 7 ? x > 0 || random() > 0.55 : random() > 0.45;
        if (!filled) continue;
        for (const col of [x, 9 - x])
          art += `<rect x="${offset + col * cell}" y="${offset + y * cell}" width="23" height="23" fill="${y === 8 ? ink : accent}"/>`;
      }
    for (const x of [114, 183])
      art += `<rect x="${x}" y="137" width="23" height="23" fill="${pale}"/><rect x="${x + 6}" y="143" width="11" height="11" fill="${ink}"/>`;
    art += `<path d="M137 183h46v12h-46z" fill="${ink}"/>`;
  } else {
    const cell = 38,
      offset = 65;
    const shapes = ["circle", "square", "arc"];
    const tileShape = shapes[pick(3)];
    for (let y = 0; y < 5; y++)
      for (let x = 0; x < 3; x++) {
        const filled = random() > 0.32 || (x === 2 && y === 2);
        const color = random() > 0.25 ? accent : ink;
        if (!filled) continue;
        for (const col of x === 2 ? [2] : [x, 4 - x]) {
          const px = offset + col * cell,
            py = offset + y * cell;
          art +=
            tileShape === "circle"
              ? `<circle cx="${px + 17}" cy="${py + 17}" r="16" fill="${color}"/>`
              : tileShape === "square"
                ? `<rect x="${px}" y="${py}" width="34" height="34" rx="5" fill="${color}"/>`
                : `<path d="M${px} ${py}h34v34a34 34 0 0 1 -34 -34" fill="${color}"/>`;
        }
      }
  }
  const backdrop = transparent
    ? ""
    : `<rect width="320" height="320" rx="${radius}" fill="${background}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320"><defs><clipPath id="frame"><rect width="320" height="320" rx="${radius}"/></clipPath></defs><g clip-path="url(#frame)">${backdrop}${art}</g></svg>`;
}
