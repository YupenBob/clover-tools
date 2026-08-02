#!/usr/bin/env python3
"""Generate the CloverTools brand asset set from the master clover logo.

The master artwork is `public/clover-logo.svg`. On first run the original is
preserved to `scripts/brand-src/clover-logo-original.svg` so the generator is
stable across re-runs. Outputs land in `public/` and `public/brand/`.

Usage:
    python scripts/generate-brand-assets.py
"""

from __future__ import annotations

import math
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC = os.path.join(ROOT, "public")
BRAND = os.path.join(PUBLIC, "brand")
SRC_DIR = os.path.join(ROOT, "scripts", "brand-src")
ORIGINAL = os.path.join(SRC_DIR, "clover-logo-original.svg")

MASTER = os.path.join(PUBLIC, "clover-logo.svg")
SIZE = 512
MARGIN = 0.055  # even margin fraction on the square canvas

# ---- brand palette (aligned with src/styles/global.css gold theme) ----------
COLOR_G1 = [("0%", "#E3C68D"), ("25.616%", "#CEAD71"),
            ("70.443%", "#B8935A"), ("100%", "#9C7A42")]
COLOR_G2 = [("0%", "#FBF5E1"), ("26.601%", "#F0E1B5"), ("100%", "#D9BC7F")]
MARK_G1 = [("0%", "#DDBF83"), ("50%", "#C3A05F"), ("100%", "#A98A4F")]
MARK_G2 = "#EAD9AE"
INK = "#3A332B"
TEXT_MUTED = "#8A7A5C"
TEXT_FAINT = "#B29A68"
BADGE_BG = [("0%", "#6E5331"), ("100%", "#3F2E17")]
RING = "#C9A96E"
OG_BG = "#FBF7EE"
OG_TINT = "#F1E3C6"


# ------------------------------- svg parsing --------------------------------
def parse_d(d: str):
    toks = re.findall(r"[MCLZ]|-?\d+\.?\d*(?:[eE][+-]?\d+)?", d)
    cmds, i, cur = [], 0, None
    while i < len(toks):
        t = toks[i]
        if t in "MCLZ":
            cur = t
            i += 1
            if t == "Z":
                cmds.append(("Z", None))
                cur = None
            continue
        if cur in ("M", "L"):
            cmds.append((cur, (float(toks[i]), float(toks[i + 1]))))
            i += 2
            cur = "L"
        elif cur == "C":
            cmds.append(("C", tuple(float(v) for v in toks[i:i + 6])))
            i += 6
        else:
            raise ValueError(f"unexpected token: {t}")
    return cmds


def sample(cmds, n=24):
    pts = []
    for kind, arg in cmds:
        if kind in ("M", "L"):
            pts.append(arg)
        elif kind == "C":
            x1, y1, x2, y2, x3, y3 = arg
            x0, y0 = pts[-1]
            for k in range(1, n + 1):
                t = k / n
                mt = 1 - t
                pts.append((mt ** 3 * x0 + 3 * mt ** 2 * t * x1 + 3 * mt * t ** 2 * x2 + t ** 3 * x3,
                            mt ** 3 * y0 + 3 * mt ** 2 * t * y1 + 3 * mt * t ** 2 * y2 + t ** 3 * y3))
    return pts


def art_bbox(blocks):
    """Bounding box of the master art in the original 640x480 canvas space."""
    allpts = []
    for (gdx, gdy, inner) in blocks:
        m = re.search(r'<path[^>]*?d="([^"]+)"', inner, re.S)
        tr = re.search(r'transform=" translate\(([^)]+)\)"', inner)
        tx, ty = (float(v) for v in re.findall(r"-?\d+\.?\d*", tr.group(1)))
        for (x, y) in sample(parse_d(m.group(1))):
            allpts.append((0.21 * (x + tx) + gdx + 296.9, 0.21 * (y + ty) + gdy + 226.85))
    xs = [p[0] for p in allpts]
    ys = [p[1] for p in allpts]
    return min(xs), max(xs), min(ys), max(ys)


def clean_num(s: str) -> str:
    return re.sub(r"-?\d+\.\d+", lambda m: f"{float(m.group()):.2f}", s)


def style_to_attrs(style: str) -> dict:
    out = {}
    for item in style.split(";"):
        k, _, v = item.strip().partition(":")
        k, v = k.strip(), v.strip()
        if not k:
            continue
        if k == "fill":
            if v.startswith("url("):
                out["fill"] = v
            elif v.startswith("rgba"):
                r, g, b = (int(x) for x in re.findall(r"\d+", v)[:3])
                out["fill"] = f"#{r:02X}{g:02X}{b:02X}"
            else:
                out["fill"] = v
        elif k == "opacity" and v != "1":
            out["opacity"] = v
        elif k == "fill-rule" and v != "nonzero":
            out["fill-rule"] = v
    return out


def clean_path(inner: str) -> str:
    m = re.search(r"<path([^>]*?)d=\"([^\"]+)\"([^>]*)>", inner, re.S)
    pre, d, post = m.group(1), m.group(2), m.group(3)
    both = pre + " " + post
    style = re.search(r'style="([^"]*)"', both)
    attrs = style_to_attrs(style.group(1)) if style else {}
    parts = []
    tf = re.search(r'transform="([^"]*)"', both)
    if tf:
        parts.append(f'transform="{clean_num(tf.group(1))}"')
    parts.append(f'fill="{attrs["fill"]}"')
    if "opacity" in attrs:
        parts.append(f'opacity="{attrs["opacity"]}"')
    if "fill-rule" in attrs:
        parts.append(f'fill-rule="{attrs["fill-rule"]}"')
    return "<path " + " ".join(parts) + f' d="{clean_num(d)}"/>'


def with_fill(path_html: str, fill: str) -> str:
    return re.sub(r'fill="[^"]*"', f'fill="{fill}"', path_html, count=1)


def gradient_geometry(inner: str):
    g = re.search(r'<radialGradient[^>]*>', inner)
    if not g:
        return None
    nums = re.findall(r'(?:cx|cy|r|fx|fy)="([-\d.]+)"', g.group(0))
    return [float(v) for v in nums]


def radial_gradient(gid: str, geo, stops) -> str:
    cx, cy, r = geo[0], geo[1], geo[2]
    attrs = (f'<radialGradient id="{gid}" gradientUnits="userSpaceOnUse" '
             f'cx="{cx:.2f}" cy="{cy:.2f}" r="{r:.2f}">')
    stops_html = "".join(f'<stop offset="{o}" stop-color="{c}"/>' for o, c in stops)
    return attrs + stops_html + "</radialGradient>"


def logo_groups(prefix: str = "g", g1_stops=COLOR_G1, g2_stops=COLOR_G2,
                include_white=True) -> str:
    """The three cleaned logo layers, keeping the original 640x480 coordinate space."""
    out = []
    for i, (gdx, gdy, inner) in enumerate(BLOCKS, start=1):
        geo = gradient_geometry(inner)
        path = clean_path(inner)
        group_attrs = f'matrix(0.21 0 0 0.21 {gdx} {gdy})'
        if i == 1:
            body = radial_gradient(f"{prefix}1", geo, g1_stops) + with_fill(path, f"url(#{prefix}1)")
        elif i == 2:
            body = radial_gradient(f"{prefix}2", geo, g2_stops) + with_fill(path, f"url(#{prefix}2)")
        else:
            if not include_white:
                continue
            body = path
        out.append(f'<g transform="{group_attrs}">{body}</g>')
    return "\n    ".join(out)


def mark_groups(prefix: str = "m") -> str:
    """Simplified two-layer mark: outer silhouette gradient + flat inner highlight."""
    out = []
    for i, (gdx, gdy, inner) in enumerate(BLOCKS, start=1):
        if i > 2:
            break
        path = clean_path(inner)
        group_attrs = f'matrix(0.21 0 0 0.21 {gdx} {gdy})'
        if i == 1:
            body = radial_gradient(f"{prefix}1", gradient_geometry(inner), MARK_G1) + with_fill(path, f"url(#{prefix}1)")
        else:
            d = re.search(r'<path[^>]*?d="([^"]+)"', inner, re.S).group(1)
            tf = re.search(r'transform="([^"]*)"', inner)
            attr = f' transform="{clean_num(tf.group(1))}"' if tf else ""
            body = f'<path{attr} fill="{MARK_G2}" opacity="0.9" d="{clean_num(d)}"/>'
        out.append(f'<g transform="{group_attrs}">{body}</g>')
    return "\n    ".join(out)


def fit_transform(target_size: float) -> str:
    """Square-canvas wrapper that centers the master art with even margins.

    The master artwork is already centered near the origin of its own
    coordinate space (the old root translate only moved it to the 640x480
    canvas), so no extra centering translate is needed here.
    """
    art_w = BBOX[1] - BBOX[0]
    art_h = BBOX[3] - BBOX[2]
    s = target_size / max(art_w, art_h)
    lcx = (BBOX[0] + BBOX[1]) / 2 - 296.9  # art center in group-local space
    lcy = (BBOX[2] + BBOX[3]) / 2 - 226.85
    return f'transform="translate({SIZE / 2 - s * lcx:.2f} {SIZE / 2 - s * lcy:.2f}) scale({s:.5f})"'


def write(path: str, content: str) -> None:
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(content)
    print(f"wrote {os.path.relpath(path, ROOT)} ({len(content)} bytes)")


def svg(view_box: str, body: str, title: str = "CloverTools") -> str:
    w, h = view_box.split()
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" '
            f'viewBox="0 0 {view_box}" role="img" aria-label="{title}">\n'
            f"  <title>{title}</title>\n  {body}\n</svg>\n")


# --------------------------------- main -------------------------------------
os.makedirs(BRAND, exist_ok=True)
os.makedirs(SRC_DIR, exist_ok=True)

if not os.path.exists(ORIGINAL):
    if os.path.exists(MASTER):
        with open(MASTER, encoding="utf-8") as f:
            with open(ORIGINAL, "w", encoding="utf-8", newline="\n") as out:
                out.write(f.read())
        print(f"preserved original artwork -> {os.path.relpath(ORIGINAL, ROOT)}")
    else:
        raise SystemExit(f"master logo missing: {MASTER}")

src = open(ORIGINAL, encoding="utf-8").read()
BLOCKS = [(float(a), float(b), c) for a, b, c in
          re.findall(r'<g transform="matrix\(0\.21 0 0 0\.21 ([-\d.]+) ([-\d.]+)\)">(.*?)</g>', src, re.S)]
if len(BLOCKS) != 3:
    raise SystemExit(f"expected 3 logo layers, found {len(BLOCKS)}")

BBOX = art_bbox(BLOCKS)
print(f"master art bbox: x {BBOX[0]:.2f}..{BBOX[1]:.2f} y {BBOX[2]:.2f}..{BBOX[3]:.2f}")

# 1. master logo: cleaned, centered, brand gold
fit = fit_transform(SIZE * (1 - 2 * MARGIN))
write(os.path.join(PUBLIC, "clover-logo.svg"),
      svg(f"{SIZE} {SIZE}", f'<g {fit}>\n    {logo_groups("lg")}\n  </g>'))

# 2. simplified mark (also used as favicon.svg)
mark_fit = fit_transform(SIZE * (1 - 2 * MARGIN))
mark_body = f'<g {mark_fit}>\n    {mark_groups("m")}\n  </g>'
write(os.path.join(BRAND, "clover-logo-mark.svg"), svg(f"{SIZE} {SIZE}", mark_body))
write(os.path.join(BRAND, "favicon.svg"), svg(f"{SIZE} {SIZE}", mark_body))

# 3. rounded-square badge
badge_scale = 0.62
badge_fit = fit_transform(SIZE * badge_scale)
badge_body = f'''<defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="{BADGE_BG[0][1]}"/><stop offset="1" stop-color="{BADGE_BG[1][1]}"/>
    </linearGradient>
    <clipPath id="clip"><rect width="{SIZE}" height="{SIZE}" rx="116"/></clipPath>
  </defs>
  <g clip-path="url(#clip)">
    <rect width="{SIZE}" height="{SIZE}" fill="url(#bg)"/>
    <g {badge_fit}>
    {logo_groups("b")}
    </g>
  </g>
  <rect x="8" y="8" width="496" height="496" rx="108" fill="none" stroke="{RING}" stroke-width="5" opacity="0.85"/>'''
write(os.path.join(BRAND, "clover-logo-badge.svg"), svg(f"{SIZE} {SIZE}", badge_body))

# 4. circular avatar badge
avatar_body = f'''<defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="{BADGE_BG[0][1]}"/><stop offset="1" stop-color="{BADGE_BG[1][1]}"/>
    </linearGradient>
  </defs>
  <circle cx="256" cy="256" r="256" fill="url(#bg)"/>
  <g {badge_fit}>
    {logo_groups("a")}
  </g>
  <circle cx="256" cy="256" r="250" fill="none" stroke="{RING}" stroke-width="6" opacity="0.85"/>'''
write(os.path.join(PUBLIC, "clover-avatar.svg"), svg(f"{SIZE} {SIZE}", avatar_body))

# 5. horizontal wordmark
art_h = BBOX[3] - BBOX[2]
s_word = 112.0 / art_h
wx = 16 - s_word * (BBOX[0] - 296.9)
wy = 14 - s_word * (BBOX[2] - 226.85)
word_body = (f'<g transform="translate({wx:.2f} {wy:.2f}) scale({s_word:.5f})">\n'
             f'    {logo_groups("w")}\n  </g>\n'
             f'  <text x="150" y="94" font-family="Arial, Helvetica, \'Segoe UI\', sans-serif" '
             f'font-size="62" font-weight="700" letter-spacing="2" fill="{INK}">CloverTools</text>')
write(os.path.join(BRAND, "clover-logo-wordmark.svg"), svg("660 140", word_body))

# 6. social share card (og:image source)
s_og = 130.0 / art_h
og_body = f'''<defs>
    <radialGradient id="tint" gradientUnits="userSpaceOnUse" cx="600" cy="300" r="620">
      <stop offset="0" stop-color="{OG_TINT}" stop-opacity="0.7"/>
      <stop offset="1" stop-color="{OG_TINT}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="ogbg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="{BADGE_BG[0][1]}"/><stop offset="1" stop-color="{BADGE_BG[1][1]}"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="{OG_BG}"/>
  <rect width="1200" height="630" fill="url(#tint)"/>
  <g opacity="0.045" transform="translate(980 320) scale(1.15)">
    {logo_groups("wm")}
  </g>
  <g transform="translate(600 200)">
    <circle r="105" fill="url(#ogbg)"/>
    <g transform="scale({s_og:.5f})">
    {logo_groups("og")}
    </g>
    <circle r="101.5" fill="none" stroke="{RING}" stroke-width="5" opacity="0.9"/>
  </g>
  <text x="600" y="385" text-anchor="middle" font-family="Arial, Helvetica, \'Segoe UI\', sans-serif"
        font-size="86" font-weight="700" letter-spacing="2" fill="{INK}">CloverTools</text>
  <text x="600" y="452" text-anchor="middle" font-family="\'Microsoft YaHei\', \'PingFang SC\', sans-serif"
        font-size="34" fill="{TEXT_MUTED}">精选在线工具箱，打开即用</text>
  <text x="600" y="510" text-anchor="middle" font-family="Arial, sans-serif"
        font-size="24" letter-spacing="6" fill="{TEXT_FAINT}">clovertools.cn</text>'''
write(os.path.join(BRAND, "clover-og.svg"), svg("1200 630", og_body, "CloverTools"))

print("done.")
