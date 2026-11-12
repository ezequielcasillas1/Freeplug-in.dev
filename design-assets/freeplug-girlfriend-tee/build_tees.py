#!/usr/bin/env python3
"""Freeplug girlfriend-themed tee set — seven lines, one clean layout each.

Exact wording kept, including "don't" (typographic apostrophe).
Icons share one stroke language with the no-time calendar set.
Nothing is published or uploaded. Nothing goes live without Cheke's OK.
"""
from __future__ import annotations

import csv
import json
import math
import xml.etree.ElementTree as ET
from pathlib import Path

import cairosvg
from fontTools.misc.transform import Transform
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw, ImageFont

ROOT = Path("/workspace/logos/freeplug-girlfriend-tee")
SVG_DIR = ROOT / "svg"
PNG_DIR = ROOT / "png"
PREV_DIR = ROOT / "previews"
WEB_DIR = ROOT / "web"
MONO_SVG = Path("/workspace/logos/FP/svg/fp-monogram-black.svg")

W, H = 4500, 5400

INK = "#111111"
IVORY = "#F7F3EA"
WHITE = "#FFFFFF"
CHARCOAL = "#232323"
FP_RED = "#8B1A1E"
SOFT_PINK = "#FFDCD6"

FONTS = {
    "dispatch_bold": Path("/workspace/logos/FP/fonts/ttf/FreeplugDispatch-Bold.ttf"),
    "dispatch_cond": Path("/workspace/logos/FP/fonts/ttf/FreeplugDispatch-CondensedHeadline.ttf"),
    "dispatch_reg": Path("/workspace/logos/FP/fonts/ttf/FreeplugDispatch-Regular.ttf"),
}

# Exact wording. Typographic apostrophe in "don't".
TEES = [
    {
        "id": "01-no-time",
        "title": "Don't have time",
        "icon": "heart",
        "text": "FREEPLUG DON’T HAVE TIME FOR GIRLFRIENDS.",
        "lines": ["FREEPLUG DON’T HAVE TIME", "FOR GIRLFRIENDS."],
    },
    {
        "id": "02-plugging-needy",
        "title": "Plugging the needy",
        "icon": "plug-heart",
        "text": "Freeplug don’t have time for girlfriends. Too busy plugging the needy.",
        "lines": [
            "Freeplug don’t have time for girlfriends.",
            "Too busy plugging the needy.",
        ],
    },
    {
        "id": "03-deadlines-deeds",
        "title": "Deadlines and deeds",
        "icon": "clock-check",
        "text": "No girlfriend. Just deadlines and good deeds.",
        "lines": ["No girlfriend.", "Just deadlines and good deeds."],
    },
    {
        "id": "04-status-shipping",
        "title": "Status: shipping",
        "icon": "box",
        "text": "Relationship status: shipping.",
        "lines": ["Relationship status:", "shipping."],
    },
    {
        "id": "05-taken-mission",
        "title": "Taken by the mission",
        "icon": "target",
        "text": "Taken by the mission.",
        "lines": ["Taken by the mission."],
    },
    {
        "id": "06-single-busy-building",
        "title": "Single. Busy. Building.",
        "icon": "blocks",
        "text": "Single. Busy. Building.",
        "lines": ["Single.", "Busy.", "Building."],
    },
    {
        "id": "07-love-language",
        "title": "Love language",
        "icon": "chevrons-heart",
        "text": "My love language is free websites.",
        "lines": ["My love language is", "free websites."],
    },
]


def hex_to_rgb(s: str) -> tuple[int, int, int]:
    s = s.lstrip("#")
    return tuple(int(s[i : i + 2], 16) for i in (0, 2, 4))  # type: ignore[return-value]


def rel_lum(rgb: tuple[int, int, int]) -> float:
    def f(c: float) -> float:
        c = c / 255.0
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

    r, g, b = f(rgb[0]), f(rgb[1]), f(rgb[2])
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast_ratio(c1: str, c2: str) -> float:
    L1, L2 = rel_lum(hex_to_rgb(c1)), rel_lum(hex_to_rgb(c2))
    hi, lo = max(L1, L2), min(L1, L2)
    return (hi + 0.05) / (lo + 0.05)


class Face:
    def __init__(self, path: Path):
        self.path = path
        self.font = TTFont(str(path))
        self.gs = self.font.getGlyphSet()
        self.cmap = self.font.getBestCmap()
        self.upem = self.font["head"].unitsPerEm
        self.hmtx = self.font["hmtx"]
        self.kern = {}
        if "kern" in self.font:
            for table in self.font["kern"].kernTables:
                try:
                    self.kern.update(table.kernTable)
                except Exception:
                    pass

    def _name(self, ch: str) -> str:
        if ord(ch) not in self.cmap:
            raise KeyError(f"Missing glyph {ch!r} in {self.path.name}")
        return self.cmap[ord(ch)]

    def _adv(self, ch: str) -> float:
        return self.hmtx[self._name(ch)][0]

    def _kern(self, a: str, b: str) -> float:
        if not a or not b:
            return 0
        return self.kern.get((self._name(a), self._name(b)), 0)

    def measure(self, text: str, size: float, tracking: float = 0) -> float:
        scale = size / self.upem
        x = 0.0
        prev = ""
        for i, ch in enumerate(text):
            if i:
                x += self._kern(prev, ch) * scale
            x += self._adv(ch) * scale
            if i < len(text) - 1:
                x += tracking
            prev = ch
        return x

    def _glyph_d(self, ch: str, scale: float, x: float, y: float) -> str:
        name = self._name(ch)
        pen = SVGPathPen(self.gs)
        tp = TransformPen(pen, Transform(scale, 0, 0, -scale, x, y))
        self.gs[name].draw(tp)
        return pen.getCommands()

    def paths(
        self,
        text: str,
        size: float,
        x: float,
        y: float,
        anchor: str = "left",
        tracking: float = 0,
    ) -> list[str]:
        width = self.measure(text, size, tracking)
        if anchor == "center":
            x = x - width / 2
        elif anchor == "right":
            x = x - width
        scale = size / self.upem
        out: list[str] = []
        cursor = x
        prev = ""
        for i, ch in enumerate(text):
            if i:
                cursor += self._kern(prev, ch) * scale
            if ch != " ":
                out.append(self._glyph_d(ch, scale, cursor, y))
            cursor += self._adv(ch) * scale
            if i < len(text) - 1:
                cursor += tracking
            prev = ch
        return out


FACES: dict[str, Face] = {}


def face(name: str) -> Face:
    if name not in FACES:
        FACES[name] = Face(FONTS[name])
    return FACES[name]


def paths_el(ds: list[str], fill: str, cls: str = "") -> str:
    cattr = f' class="{cls}"' if cls else ""
    return "\n".join(f'<path{cattr} d="{d}" fill="{fill}" />' for d in ds if d and d.strip())


def text_el(
    face_name: str,
    text: str,
    size: float,
    x: float,
    y: float,
    fill: str,
    anchor: str = "left",
    tracking: float = 0,
    cls: str = "",
) -> str:
    ds = face(face_name).paths(text, size, x, y, anchor=anchor, tracking=tracking)
    return paths_el(ds, fill, cls=cls)


def monogram_svg(x: float, y: float, size: float, fill: str) -> str:
    tree = ET.parse(MONO_SVG)
    root = tree.getroot()
    d = None
    for el in root.iter():
        if el.tag.endswith("path") and el.get("d"):
            d = el.get("d")
            break
    if not d:
        raise RuntimeError("Could not read monogram path")
    s = size / 1024.0
    return (
        f'<g class="fp-monogram" transform="translate({x:.3f},{y:.3f}) scale({s:.6f})">'
        f'<path d="{d}" fill="{fill}" /></g>'
    )


def palette(garment: str) -> dict:
    if garment == "light":
        return {
            "garment": "light",
            "ink": INK,
            "accent": FP_RED,
            "grounds": [("ivory tee", IVORY), ("white tee", WHITE)],
            "tee": IVORY,
        }
    if garment == "dark":
        return {
            "garment": "dark",
            "ink": IVORY,
            "accent": SOFT_PINK,
            "grounds": [("black tee", INK), ("charcoal tee", CHARCOAL)],
            "tee": INK,
        }
    raise ValueError(garment)


# ---------------------------------------------------------------------------
# Strictly minimal, single-weight line icons.
# Same stroke, caps, and joins as the no-time calendar set (1.7 on a 24-unit grid).
# ---------------------------------------------------------------------------

ICON_SW = 1.7

# Shared two-lobe heart from the no-time calendar mark (no strike).
HEART = (
    "M 12 19 "
    "C 7.2 15.4 4.5 12.8 4.5 9.4 "
    "C 4.5 6.8 6.4 5 8.8 5 "
    "C 10.2 5 11.4 5.7 12 6.7 "
    "C 12.6 5.7 13.8 5 15.2 5 "
    "C 17.6 5 19.5 6.8 19.5 9.4 "
    "C 19.5 12.8 16.8 15.4 12 19 Z"
)


def _heart_at(cx: float, cy: float, scale: float) -> str:
    """The shared heart path, translated so its 24-grid center (12,12) maps to (cx,cy) and scaled."""
    # Path sits in 4.5..19.5 x, 5..19 y; visual center ~ (12, 12).
    tx = cx - 12 * scale
    ty = cy - 12 * scale
    return f'<g transform="translate({tx:.3f},{ty:.3f}) scale({scale:.4f})"><path d="{HEART}" /></g>'


def icon_mark(kind: str) -> tuple[str, float, float]:
    """Stroke-only geometry and its viewBox width, height."""
    if kind == "heart":
        # Same struck heart as the no-time calendar Friday mark.
        geom = f'<path d="{HEART}" /><line x1="5.5" y1="18.5" x2="18.5" y2="5.5" />'
        return geom, 24.0, 24.0

    if kind == "plug-heart":
        # Calendar plug, with a cord that forms the shared heart above it.
        heart = _heart_at(12, 9.2, 0.78)
        geom = (
            heart
            + '<line x1="12" y1="15.4" x2="12" y2="17.4" />'
            + '<rect x="8.2" y="17.4" width="7.6" height="6.2" rx="1.5" ry="1.5" />'
            + '<line x1="10.5" y1="23.6" x2="10.5" y2="26.8" />'
            + '<line x1="13.5" y1="23.6" x2="13.5" y2="26.8" />'
        )
        return geom, 24.0, 28.0

    if kind == "clock-check":
        # Calendar clock + a simple two-stroke check, one lockup.
        geom = (
            '<circle cx="10" cy="12" r="8" />'
            '<line x1="10" y1="12" x2="10" y2="7.5" />'
            '<line x1="10" y1="12" x2="14" y2="12" />'
            '<path d="M 23 13.2 L 26.4 17.2 L 36 6.6" />'
        )
        return geom, 40.0, 24.0

    if kind == "box":
        # Same package box as the no-time calendar Saturday mark.
        geom = (
            '<rect x="6" y="6" width="12" height="12" rx="0.5" ry="0.5" />'
            '<line x1="6" y1="12" x2="18" y2="12" />'
        )
        return geom, 24.0, 24.0

    if kind == "target":
        geom = (
            '<circle cx="12" cy="12" r="8.5" />'
            '<circle cx="12" cy="12" r="4.4" />'
            '<line x1="12" y1="2.2" x2="12" y2="5.6" />'
            '<line x1="12" y1="18.4" x2="12" y2="21.8" />'
            '<line x1="2.2" y1="12" x2="5.6" y2="12" />'
            '<line x1="18.4" y1="12" x2="21.8" y2="12" />'
        )
        return geom, 24.0, 24.0

    if kind == "blocks":
        # Three stroke squares in a 2+1 stack — building up.
        geom = (
            '<rect x="3.6" y="13.2" width="8" height="8" rx="0.6" ry="0.6" />'
            '<rect x="12.4" y="13.2" width="8" height="8" rx="0.6" ry="0.6" />'
            '<rect x="8" y="4.4" width="8" height="8" rx="0.6" ry="0.6" />'
        )
        return geom, 24.0, 24.0

    if kind == "chevrons-heart":
        # </> flanking the shared heart.
        heart = _heart_at(16, 12, 0.58)
        geom = (
            '<path d="M 7.2 5.2 L 2.2 12 L 7.2 18.8" />'
            + heart
            + '<path d="M 24.8 5.2 L 29.8 12 L 24.8 18.8" />'
        )
        return geom, 32.0, 24.0

    raise ValueError(kind)


def icon_svg(kind: str, cx: float, y: float, height: float, stroke: str) -> str:
    """Place an icon centered at cx, top at y, with a given visual height."""
    geom, vb_w, vb_h = icon_mark(kind)
    s = height / vb_h
    x = cx - (vb_w * s) / 2
    return (
        f'<g class="icon-{kind}" transform="translate({x:.3f},{y:.3f}) scale({s:.5f})" '
        f'fill="none" stroke="{stroke}" stroke-width="{ICON_SW}" '
        f'stroke-linecap="round" stroke-linejoin="round">'
        f"{geom}</g>"
    )


def wrap_svg(inner: str, w: int = W, h: int = H) -> str:
    return (
        f'<?xml version="1.0" encoding="UTF-8"?>\n'
        f'<svg xmlns="http://www.w3.org/2000/svg" '
        f'viewBox="0 0 {w} {h}" width="{w}" height="{h}">\n'
        f"<!-- Freeplug concept only. Nothing goes live without Cheke's OK. -->\n"
        f"{inner}\n"
        f"</svg>\n"
    )


def place(inner: str, x: float, y: float) -> str:
    return f'<g transform="translate({x:.3f},{y:.3f})">\n{inner}\n</g>'


# ---------------------------------------------------------------------------
# One clean centered layout for every line
# ---------------------------------------------------------------------------

ICON_H = 300
MONO_S = 130
MAX_LINE_W = 2800
BASE_SIZE = 132
TRACK = 2


def layout_tee(spec: dict, p: dict) -> dict:
    ink, accent = p["ink"], p["accent"]
    fb = face("dispatch_bold")
    parts = [f'<g class="{spec["id"]}">']
    texts: list[dict] = []

    lines = list(spec["lines"])
    size = BASE_SIZE
    # Slightly smaller type when a line is long, or when there are three lines.
    widths = [fb.measure(ln, size, TRACK) for ln in lines]
    if max(widths) > MAX_LINE_W:
        size = size * (MAX_LINE_W / max(widths))
        widths = [fb.measure(ln, size, TRACK) for ln in lines]
    if len(lines) >= 3:
        size = min(size, 124)
        widths = [fb.measure(ln, size, TRACK) for ln in lines]

    lead = size * 1.28
    type_w = max(widths)
    width = max(type_w, ICON_H * 1.4, MONO_S)
    cx = width / 2

    y = 0.0
    parts.append(icon_svg(spec["icon"], cx, y, ICON_H, accent))
    texts.append({"id": "icon", "text": f'{spec["icon"]} icon', "color": accent, "kind": "accent"})
    y += ICON_H + 88

    y += size
    for i, ln in enumerate(lines):
        parts.append(
            text_el("dispatch_bold", ln, size, cx, y, ink, anchor="center", tracking=TRACK, cls="line")
        )
        texts.append({"id": f"line-{i}", "text": ln, "color": ink, "kind": "body"})
        y += lead
    y -= lead

    y += 80
    parts.append(monogram_svg(cx - MONO_S / 2, y, MONO_S, accent))
    texts.append({"id": "monogram", "text": "FP monogram", "color": accent, "kind": "accent"})
    y += MONO_S

    parts.append("</g>")
    block = "\n".join(parts)
    x = (W - width) / 2
    top = 980
    return {
        "key": spec["id"],
        "title": spec["title"],
        "text": spec["text"],
        "inner": place(block, x, top),
        "texts": texts,
        "block": block,
        "block_box": (0, 0, width, y),
        "placed_box": (x, top, x + width, top + y),
    }


def write_png(svg: str, path: Path, w: int, h: int) -> None:
    cairosvg.svg2png(bytestring=svg.encode("utf-8"), write_to=str(path), output_width=w, output_height=h)


def build_all(preview_scale: float = 0.20):
    for d in (SVG_DIR, PNG_DIR, PREV_DIR, WEB_DIR):
        d.mkdir(parents=True, exist_ok=True)

    built = []
    rows = []
    for spec in TEES:
        for garment in ("light", "dark"):
            pal = palette(garment)
            layout = layout_tee(spec, pal)
            svg = wrap_svg(layout["inner"])
            stem = f"{spec['id']}-{garment}"
            svg_path = SVG_DIR / f"{stem}.svg"
            png_path = PNG_DIR / f"{stem}.png"
            prev_path = PREV_DIR / f"{stem}.png"
            svg_path.write_text(svg)
            write_png(svg, png_path, W, H)
            write_png(svg, prev_path, int(W * preview_scale), int(H * preview_scale))
            print(f"wrote {png_path}")

            web_w, web_h = 1200, 1440
            art = Image.open(png_path).convert("RGBA").resize((web_w, web_h), Image.Resampling.LANCZOS)
            thumb = Image.new("RGB", (web_w, web_h), hex_to_rgb(pal["tee"]))
            thumb.paste(art, (0, 0), art)
            web_path = WEB_DIR / f"{stem}.jpg"
            thumb.save(web_path, "JPEG", quality=90, optimize=True)

            for t in layout["texts"]:
                min_req = 4.5
                for gname, ghex in pal["grounds"]:
                    ratio = contrast_ratio(t["color"], ghex)
                    rows.append(
                        {
                            "design": spec["id"],
                            "title": spec["title"],
                            "garment": garment,
                            "element": t["id"],
                            "text": t["text"],
                            "ink": t["color"],
                            "kind": t["kind"],
                            "ground": gname,
                            "ground_hex": ghex,
                            "min_required": min_req,
                            "ratio": round(ratio, 2),
                            "pass": ratio >= min_req,
                        }
                    )

            built.append(
                {
                    "key": spec["id"],
                    "title": spec["title"],
                    "text": spec["text"],
                    "garment": garment,
                    "svg": str(svg_path),
                    "png": str(png_path),
                    "preview": str(prev_path),
                    "web": str(web_path),
                    "placed_box": layout["placed_box"],
                    "ink": pal["ink"],
                    "accent": pal["accent"],
                    "tee": pal["tee"],
                }
            )
    return built, rows


def write_contrast_csv(rows: list[dict]) -> Path:
    path = ROOT / "CONTRAST-CHECK.csv"
    fields = [
        "design",
        "title",
        "garment",
        "element",
        "text",
        "ink",
        "kind",
        "ground",
        "ground_hex",
        "min_required",
        "ratio",
        "pass",
    ]
    with path.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        for row in rows:
            w.writerow(row)
    fails = [r for r in rows if not r["pass"]]
    print(f"contrast: {len(rows)} checks, {len(fails)} fails")
    for r in fails:
        print("  FAIL", r)
    return path


def write_variants(built: list[dict]) -> Path:
    variants = []
    for b in built:
        variants.append(
            {
                "id": f"{b['key']}-{b['garment']}",
                "text": b["text"],
                "garment": b["garment"],
                "title": b["title"],
                "ink": b["ink"],
                "accent": b["accent"],
                "tee_ground": b["tee"],
                "svg": b["svg"],
                "png": b["png"],
                "web": b["web"],
            }
        )
    data = {
        "product": "freeplug-girlfriend-tee",
        "note": "Concepts only. Nothing goes live without Cheke's OK. Seven lines, one layout each, light and dark.",
        "variants": variants,
    }
    path = ROOT / "variants.json"
    path.write_text(json.dumps(data, indent=2) + "\n")
    print(f"wrote {path}")
    return path


def make_contact_sheet(built: list[dict], scale: float = 0.12) -> Path:
    cell_w, cell_h = int(W * scale), int(H * scale)
    pad = 28
    label_h = 54
    header_h = 140
    footer_h = 60
    cols = 7
    keys = [t["id"] for t in TEES]
    close_h = 420
    close_label_h = 28
    row_h = label_h + cell_h + 10 + close_label_h + close_h + pad
    sheet_w = pad + cols * (cell_w + pad)
    sheet_h = header_h + 2 * row_h + footer_h
    sheet = Image.new("RGB", (sheet_w, sheet_h), (36, 36, 36))
    draw = ImageDraw.Draw(sheet)
    try:
        title_font = ImageFont.truetype(str(FONTS["dispatch_bold"]), 40)
        sub_font = ImageFont.truetype(str(FONTS["dispatch_reg"]), 22)
        lab_font = ImageFont.truetype(str(FONTS["dispatch_cond"]), 18)
        foot_font = ImageFont.truetype(str(FONTS["dispatch_reg"]), 18)
    except Exception:
        title_font = sub_font = lab_font = foot_font = ImageFont.load_default()

    def center_text(txt, font, y, fill=IVORY):
        bbox = draw.textbbox((0, 0), txt, font=font)
        tw = bbox[2] - bbox[0]
        draw.text(((sheet_w - tw) / 2, y), txt, font=font, fill=fill)

    center_text("FREEPLUG  -  Seven girlfriend-themed tees", title_font, 24, IVORY)
    center_text(
        "One clean layout each  -  nothing goes live without Cheke's OK",
        sub_font,
        78,
        "#C9C9C9",
    )

    index = {(b["key"], b["garment"]): b for b in built}
    short = {
        "01-no-time": "01  No time",
        "02-plugging-needy": "02  Plugging",
        "03-deadlines-deeds": "03  Deadlines",
        "04-status-shipping": "04  Shipping",
        "05-taken-mission": "05  Mission",
        "06-single-busy-building": "06  Building",
        "07-love-language": "07  Love language",
    }

    for r, garment in enumerate(("light", "dark")):
        tee = IVORY if garment == "light" else INK
        ink_lab = "dark ink on ivory" if garment == "light" else "ivory ink on black"
        for c, key in enumerate(keys):
            b = index[(key, garment)]
            x = pad + c * (cell_w + pad)
            y = header_h + r * row_h
            draw.text((x, y + 10), f"{short[key]}  -  {ink_lab}", font=lab_font, fill=IVORY)
            bg = Image.new("RGB", (cell_w, cell_h), hex_to_rgb(tee))
            art = Image.open(b["preview"]).convert("RGBA")
            art = art.resize((cell_w, cell_h), Image.Resampling.LANCZOS)
            bg.paste(art, (0, 0), art)
            sheet.paste(bg, (x, y + label_h))

            cy = y + label_h + cell_h + 6
            draw.text((x, cy), "Detail", font=lab_font, fill="#A9A9A9")
            full = Image.open(b["png"]).convert("RGBA")
            x0, y0, x1, y1 = b["placed_box"]
            pad_px = 80
            box = (
                max(0, int(x0 - pad_px)),
                max(0, int(y0 - pad_px)),
                min(W, int(x1 + pad_px)),
                min(H, int(y1 + pad_px)),
            )
            crop = full.crop(box)
            tw, th = cell_w, close_h
            close_bg = Image.new("RGB", (tw, th), hex_to_rgb(tee))
            cw, ch = crop.size
            s = min(tw / cw, th / ch)
            nw, nh = max(1, int(cw * s)), max(1, int(ch * s))
            crop_r = crop.resize((nw, nh), Image.Resampling.LANCZOS)
            close_bg.paste(crop_r, ((tw - nw) // 2, (th - nh) // 2), crop_r)
            sheet.paste(close_bg, (x, cy + close_label_h))

    center_text(
        "Exact wording  -  dark ink on light garments, light ink on dark  -  concepts, not production files",
        foot_font,
        sheet_h - 40,
        "#A9A9A9",
    )
    out = ROOT / "contact-sheet.png"
    sheet.save(out, "PNG")
    print(f"wrote {out}  {sheet.size}")
    return out


if __name__ == "__main__":
    built, rows = build_all(preview_scale=0.18)
    write_contrast_csv(rows)
    write_variants(built)
    make_contact_sheet(built, scale=0.12)
    print("done")
