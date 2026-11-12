#!/usr/bin/env python3
"""Create/update HIDDEN Printify drafts for Freeplug coming-soon-7.
Cheke approved Nov 9, 2026 10:48 AM CT: hidden drafts + mockups only.
No publish, no orders, no site/repo changes, no deploys.
Token only from PRINTIFY_API_TOKEN env. Never printed.
"""
from __future__ import annotations

import base64
import hashlib
import json
import math
import os
import re
import sys
import time
from pathlib import Path
from typing import Any

import requests
from PIL import Image, ImageDraw, ImageFont, ImageOps

Image.MAX_IMAGE_PIXELS = 300_000_000

ROOT = Path("/workspace/logos/freeplug/merch/coming-soon-7")
ART = ROOT
WORK = ROOT / "printify-work"
READY = ROOT / "printify-ready"
MOCK = ROOT / "printify-mockups"
VAR_DIR = Path("/workspace/logos/freeplug/merch/shop-build/variants")
CATALOG = Path("/workspace/owen/golive-wt/freeplug-landing/src/lib/merch/shop/shop-catalog.json")
WORK.mkdir(parents=True, exist_ok=True)
READY.mkdir(parents=True, exist_ok=True)
MOCK.mkdir(parents=True, exist_ok=True)

SHOP_ID = 29664778
SHOP = f"/shops/{SHOP_ID}/products"
BASE = "https://api.printify.com/v1"
UA = "Freeplug-ComingSoon7-Hidden-Drafts"
BRACELET_ID = "6af183d8621d8c64cd01a5f1"

TOKEN = os.environ.get("PRINTIFY_API_TOKEN", "")
assert len(TOKEN) > 20, "PRINTIFY_API_TOKEN missing"
S = requests.Session()
S.headers.update({"Authorization": "Bearer " + TOKEN, "User-Agent": UA, "Content-Type": "application/json"})
del TOKEN


def retail_from_cost(cost_cents: int) -> int:
    if not isinstance(cost_cents, int) or cost_cents < 0:
        return 0
    dollars = cost_cents / 100 / 0.55
    return int(math.ceil(dollars) * 100 - 1)


def save(name: str, data: Any) -> None:
    (WORK / name).write_text(json.dumps(data, indent=2))


def load_state() -> dict:
    p = WORK / "created-products.json"
    return json.loads(p.read_text()) if p.exists() else {}


def save_state(state: dict) -> None:
    save("created-products.json", state)


def api(method: str, path: str, body: dict | None = None, tries: int = 6) -> dict:
    allowed = (
        (method == "POST" and path in ("/uploads/images.json", SHOP + ".json"))
        or (method in ("GET", "PUT") and re.fullmatch(SHOP + r"/[a-f0-9]+\.json", path))
        or (method == "GET" and re.fullmatch(SHOP + r"\.json(\?.*)?", path))
        or (method == "GET" and re.fullmatch(r"/catalog/blueprints/\d+/print_providers/\d+/variants\.json", path))
    )
    assert allowed, f"blocked endpoint {method} {path}"
    if method in ("POST", "PUT") and path != "/uploads/images.json":
        assert body is not None and body.get("visible") is False
    for attempt in range(tries):
        try:
            r = S.request(method, BASE + path, json=body, timeout=(20, 300))
        except requests.RequestException as e:
            if attempt == tries - 1:
                raise RuntimeError(f"{method} {path} network: {type(e).__name__}: {e}")
            time.sleep(min(60, 2 ** attempt * 3))
            continue
        if r.status_code in (429, 500, 502, 503, 504):
            if attempt == tries - 1:
                raise RuntimeError(f"{method} {path} -> {r.status_code} {r.text[:600]}")
            ra = r.headers.get("Retry-After")
            time.sleep(float(ra) if ra and str(ra).isdigit() else min(90, 2 ** attempt * 5))
            continue
        if not r.ok:
            raise RuntimeError(f"{method} {path} -> {r.status_code} {r.text[:1000]}")
        if not r.content:
            return {}
        return r.json()
    raise RuntimeError(f"{method} {path} exhausted retries")


def catalog_item(slug: str) -> dict:
    cat = json.loads(CATALOG.read_text())
    for it in cat["items"]:
        if it["slug"] == slug:
            return it
    raise KeyError(slug)


def variants_for(bp: int, pv: int) -> list[dict]:
    cache = WORK / f"variants_{bp}_{pv}.json"
    if cache.exists():
        return json.loads(cache.read_text())["variants"]
    src = VAR_DIR / f"{bp}_{pv}.json"
    if src.exists():
        data = json.loads(src.read_text())
        cache.write_text(json.dumps(data))
        return data["variants"]
    data = api("GET", f"/catalog/blueprints/{bp}/print_providers/{pv}/variants.json")
    cache.write_text(json.dumps(data))
    return data["variants"]


def ph_for(variant: dict, position: str) -> dict:
    return next(x for x in variant["placeholders"] if x["position"] == position)


def fit_art(src: Path, width: int, height: int, dest: Path, bg: tuple | None) -> Path:
    """Contain art into WxH. bg=None keeps transparent; else RGBA tuple pad color."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists() and dest.stat().st_size > 50:
        return dest
    im = Image.open(src).convert("RGBA")
    if im.size == (width, height):
        im.save(dest, "PNG", optimize=True)
        return dest
    contained = ImageOps.contain(im, (width, height), Image.Resampling.LANCZOS)
    if bg is None:
        canvas = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    else:
        canvas = Image.new("RGBA", (width, height), bg)
    x = (width - contained.width) // 2
    y = (height - contained.height) // 2
    canvas.paste(contained, (x, y), contained)
    canvas.save(dest, "PNG", optimize=True)
    return dest


uploads_path = WORK / "uploads.json"
uploads: dict = json.loads(uploads_path.read_text()) if uploads_path.exists() else {}


def upload_file(path: Path) -> str:
    key = str(path.resolve())
    if key in uploads:
        return uploads[key]["id"]
    data = path.read_bytes()
    h = hashlib.sha1(data[:65536] + str(path.stat().st_size).encode()).hexdigest()[:10]
    fname = f"freeplug-cs7-{path.stem[:50]}-{h}.png"
    print(f"  upload {path.name} ({len(data)//1024} KB) -> {fname}", flush=True)
    result = api("POST", "/uploads/images.json", {"file_name": fname, "contents": base64.b64encode(data).decode()})
    uploads[key] = {"id": result["id"], "file_name": fname, "path": key}
    save("uploads.json", uploads)
    return result["id"]


def make_image_ref(image_id: str, scale: float = 1.0, x: float = 0.5, y: float = 0.5) -> dict:
    return {"id": image_id, "x": x, "y": y, "scale": scale, "angle": 0}


def build_print_areas(variant_specs: list) -> list:
    areas = []
    for vid, placements in variant_specs:
        placeholders = []
        for pos, method, path, scale, x, y in placements:
            ph = {"position": pos, "images": [make_image_ref(upload_file(path), scale=scale, x=x, y=y)]}
            if method:
                ph["decoration_method"] = method
            placeholders.append(ph)
        same = next((a for a in areas if a["placeholders"] == placeholders), None)
        if same:
            same["variant_ids"].append(vid)
        else:
            areas.append({"variant_ids": [vid], "placeholders": placeholders})
    return areas


def ivory_bg(src: Path) -> tuple:
    im = Image.open(src).convert("RGBA")
    # sample a near-corner pixel that is opaque
    for pt in [(10, 10), (im.width - 10, 10), (10, im.height - 10), (im.width // 2, 10)]:
        px = im.getpixel(pt)
        if px[3] > 200:
            return px
    return (245, 240, 230, 255)


SPECS = [
    {
        "slug": "fanny-pack-468",
        "title": "Freeplug Stay Charged Fanny Pack",
        "description": "Stay Charged. A Freeplug fanny pack with the Stay Charged mark on the front. Made to order.",
        "blueprint": 468,
        "provider": 99,
        "art_light": "fanny-pack-468/front-light-garment.png",
        "art_dark": "fanny-pack-468/front-dark-garment.png",
        "positions": ["front"],  # top_part_to_front left blank; front mark only
        "mode": "garment",
    },
    {
        "slug": "glass-cutting-board-938",
        "title": "Freeplug Luke 6:38 Glass Cutting Board",
        "description": "Give, and it shall be given unto you. Luke 6:38 (King James Version). A glass cutting board with Freeplug Running Over artwork. Made to order.",
        "blueprint": 938,
        "provider": 92,
        "art_light": "glass-cutting-board-938/front-light-surface.png",
        "art_dark": "glass-cutting-board-938/front-dark-surface.png",
        "positions": ["front"],
        "mode": "surface",
    },
    {
        "slug": "garden-house-banner-976",
        "title": "Freeplug Welcome Home Garden Banner",
        "description": "Welcome Home. A garden and house banner with Freeplug artwork. Made to order.",
        "blueprint": 976,
        "provider": 92,
        "art_light": "garden-house-banner-976/front-light-surface.png",
        "art_dark": "garden-house-banner-976/front-dark-surface.png",
        "positions": ["front"],
        "mode": "surface",
    },
    {
        "slug": "matte-canvas-stretched-1-25-1159",
        "title": "Freeplug Running Over Matte Canvas 1.25\"",
        "description": "Give, and it shall be given unto you. Luke 6:38 (King James Version). A stretched matte canvas (1.25 inch depth) from the Freeplug Running Over line. Made to order.",
        "blueprint": 1159,
        "provider": 450,
        "art_front": "matte-canvas-stretched-1-25-1159/front.png",
        "positions": ["front"],
        "mode": "canvas",
    },
    {
        "slug": "matte-canvas-stretched-0-75-multi-size-937",
        "title": "Freeplug San Marcos Plug Matte Canvas 0.75\"",
        "description": "San Marcos Plug. A stretched matte canvas (0.75 inch depth) with Freeplug city-pride artwork. Made to order.",
        "blueprint": 937,
        "provider": 450,
        "art_front": "matte-canvas-stretched-0-75-multi-size-937/front.png",
        "positions": ["front"],
        "mode": "canvas",
    },
    {
        "slug": "metal-art-sign-1206",
        "title": "Freeplug You Know a Plug Metal Sign",
        "description": "You Know a Plug. A metal art sign with Freeplug artwork. Made to order.",
        "blueprint": 1206,
        "provider": 99,
        "art_light": "metal-art-sign-1206/front-light-surface.png",
        "art_dark": "metal-art-sign-1206/front-dark-surface.png",
        "positions": ["front"],
        "mode": "surface",
    },
]


def pick_art_for_variant(spec: dict, variant: dict) -> Path:
    mode = spec["mode"]
    if mode == "canvas":
        return ART / spec["art_front"]
    # surface/garment with no color: prefer light-surface (dark ink) for clear/light blanks
    color = ((variant.get("options") or {}).get("color") or "").strip().lower()
    if not color:
        return ART / spec["art_light"]
    dark_tokens = ("black", "charcoal", "navy", "dark", "forest", "maroon", "olive", "brown", "cranberry", "graphite", "coal")
    if any(t in color for t in dark_tokens):
        return ART / spec["art_dark"]
    return ART / spec["art_light"]


def build_specs(spec: dict) -> tuple[dict, list]:
    cat = variants_for(spec["blueprint"], spec["provider"])
    shop = catalog_item(spec["slug"])
    from_price = int(shop["fromRetailCents"])
    # per-variant retail when catalog has them
    per = {int(v["id"]): int(v["retailCents"]) for v in (shop.get("variants") or []) if v.get("retailCents")}
    prices: dict[int, int] = {}
    specs = []
    bg = None
    if spec["mode"] == "canvas":
        bg = ivory_bg(ART / spec["art_front"])
    for v in cat:
        art = pick_art_for_variant(spec, v)
        placements = []
        for pos in spec["positions"]:
            try:
                ph = ph_for(v, pos)
            except StopIteration:
                continue
            w, h = int(ph["width"]), int(ph["height"])
            dest = READY / spec["slug"] / f"{art.stem}-{v['id']}-{w}x{h}.png"
            use_bg = bg if spec["mode"] == "canvas" else None
            path = fit_art(art, w, h, dest, use_bg)
            method = ph.get("decoration_method")
            placements.append((pos, method, path, 1.0, 0.5, 0.5))
        if not placements:
            continue
        specs.append((v["id"], placements))
        prices[v["id"]] = per.get(v["id"], from_price)
    return prices, specs


def create_product(spec: dict) -> dict:
    state = load_state()
    slug = spec["slug"]
    if slug in state and state[slug].get("id") and not state[slug].get("failed"):
        print(f"SKIP exists {slug} {state[slug]['id']}", flush=True)
        return state[slug]
    print(f"\n=== Building {slug} ===", flush=True)
    prices, variant_specs = build_specs(spec)
    print(f"  variants prepared: {len(variant_specs)}", flush=True)
    if not variant_specs:
        raise RuntimeError(f"No variants for {slug}")
    areas = build_print_areas(variant_specs)
    body = {
        "title": spec["title"],
        "description": spec["description"],
        "blueprint_id": spec["blueprint"],
        "print_provider_id": spec["provider"],
        "visible": False,
        "variants": [{"id": vid, "price": int(prices[vid]), "is_enabled": True} for vid, _ in variant_specs],
        "print_areas": areas,
        "tags": ["Freeplug", "Shop", "ComingSoon7"],
    }
    save(f"{slug}-create-payload.json", {**body, "print_areas": f"<{len(areas)} groups>"})
    # payload too large with areas; save slim then full separately
    save(f"{slug}-create-payload-full.json", body)
    result = api("POST", SHOP + ".json", body)
    save(f"{slug}-created.json", result)
    if result.get("visible") is not False:
        raise RuntimeError(f"STOP: visible:false not honored for {slug}")
    pid = result["id"]
    # Reprice from actual Printify costs when available; keep catalog per-variant when set
    shop = catalog_item(slug)
    per = {int(v["id"]): int(v["retailCents"]) for v in (shop.get("variants") or []) if v.get("retailCents")}
    enabled_ids = {vid for vid, _ in variant_specs}
    price_update = []
    for v in result.get("variants", []):
        vid = v["id"]
        if vid in per:
            price = per[vid]
        elif v.get("cost"):
            price = retail_from_cost(int(v["cost"]))
        else:
            price = int(prices.get(vid, shop["fromRetailCents"]))
        price_update.append({"id": vid, "price": int(price), "is_enabled": vid in enabled_ids})
    api("PUT", SHOP + f"/{pid}.json", {"visible": False, "variants": price_update})
    final = api("GET", SHOP + f"/{pid}.json")
    save(f"{slug}-final.json", final)
    assert final.get("visible") is False
    assert not final.get("is_locked")
    assert not final.get("external")
    enabled = [v for v in final["variants"] if v.get("is_enabled")]
    entry = {
        "slug": slug,
        "id": final["id"],
        "title": final.get("title"),
        "blueprint": spec["blueprint"],
        "provider": spec["provider"],
        "visible": False,
        "enabled_count": len(enabled),
        "prices": sorted({int(v["price"]) for v in enabled}),
        "price_min": min(int(v["price"]) for v in enabled),
        "price_max": max(int(v["price"]) for v in enabled),
        "costs": sorted({int(v["cost"]) for v in enabled if v.get("cost") is not None}),
        "image_count": len(final.get("images") or []),
        "images": [
            {"src": im.get("src"), "variant_ids": im.get("variant_ids"), "position": im.get("position"), "is_default": im.get("is_default")}
            for im in (final.get("images") or [])[:20]
        ],
        "action": "created",
    }
    state[slug] = entry
    save_state(state)
    print(f"CREATED {slug} {entry['id']} variants={entry['enabled_count']} prices={entry['prices']} images={entry['image_count']}", flush=True)
    return entry


def update_bracelet() -> dict:
    slug = "natural-stone-stretch-bar-bracelet-engraving-2651"
    state = load_state()
    if state.get(slug, {}).get("action") == "updated" and state[slug].get("id") == BRACELET_ID:
        print(f"SKIP bracelet already updated {BRACELET_ID}", flush=True)
        return state[slug]
    print(f"\n=== Updating bracelet {BRACELET_ID} ===", flush=True)
    art = ART / slug / "engraving.png"
    # exact 1560x240
    dest = READY / slug / "engraving-1560x240.png"
    fit_art(art, 1560, 240, dest, None)
    image_id = upload_file(dest)
    shop = catalog_item(slug)
    cat = variants_for(2651, 217)
    existing = api("GET", SHOP + f"/{BRACELET_ID}.json")
    # Printify requires EVERY product variant id in print_areas (product has 147700 not in current catalog)
    all_product_vids = [v["id"] for v in existing.get("variants") or []]
    if not all_product_vids:
        all_product_vids = [v["id"] for v in cat]
    catalog_enable = {int(v["id"]) for v in (shop.get("variants") or [])} or {v["id"] for v in cat}
    prices = {int(v["id"]): int(v.get("retailCents") or shop["fromRetailCents"]) for v in (shop.get("variants") or [])}
    for vid in all_product_vids:
        prices.setdefault(vid, int(shop["fromRetailCents"]))
    # Confirm placeholder from existing or catalog
    ph = None
    for pa in existing.get("print_areas") or []:
        for cand in pa.get("placeholders") or []:
            if cand.get("position") == "front":
                ph = cand
                break
    if ph is None:
        ph = ph_for(cat[0], "front")
    notes = []
    # art is 1560x240; placeholder size from catalog
    cat_ph = ph_for(cat[0], "front")
    if (cat_ph["width"], cat_ph["height"]) != (1560, 240):
        notes.append(f"engraving area mismatch: got {cat_ph['width']}x{cat_ph['height']}, art 1560x240")
    if cat_ph.get("decoration_method") != "laser-engraving":
        notes.append(f"decoration_method={cat_ph.get('decoration_method')}")
    if 147700 in all_product_vids and 147700 not in catalog_enable:
        notes.append("kept legacy variant 147700 disabled (not in current catalog)")
    body = {
        "title": "Freeplug Natural Stone Stretch Bar Bracelet (Engraving)",
        "description": "FREEPLUG. A natural stone stretch bar bracelet with a laser-engraved Freeplug wordmark. Made to order.",
        "visible": False,
        "variants": [
            {"id": vid, "price": int(prices[vid]), "is_enabled": bool(vid in catalog_enable)}
            for vid in all_product_vids
        ],
        "print_areas": [
            {
                "variant_ids": all_product_vids,
                "placeholders": [
                    {
                        "position": "front",
                        "decoration_method": cat_ph.get("decoration_method") or "laser-engraving",
                        "images": [make_image_ref(image_id, scale=1.0, x=0.5, y=0.5)],
                    }
                ],
            }
        ],
        "tags": ["Freeplug", "Shop", "ComingSoon7"],
    }
    save(f"{slug}-update-payload.json", body)
    api("PUT", SHOP + f"/{BRACELET_ID}.json", body)
    final = api("GET", SHOP + f"/{BRACELET_ID}.json")
    save(f"{slug}-final.json", final)
    assert final.get("visible") is False
    enabled = [v for v in final["variants"] if v.get("is_enabled")]
    entry = {
        "slug": slug,
        "id": final["id"],
        "title": final.get("title"),
        "blueprint": 2651,
        "provider": 217,
        "visible": False,
        "enabled_count": len(enabled),
        "prices": sorted({int(v["price"]) for v in enabled}),
        "price_min": min(int(v["price"]) for v in enabled) if enabled else None,
        "price_max": max(int(v["price"]) for v in enabled) if enabled else None,
        "costs": sorted({int(v["cost"]) for v in enabled if v.get("cost") is not None}),
        "image_count": len(final.get("images") or []),
        "images": [
            {"src": im.get("src"), "variant_ids": im.get("variant_ids"), "position": im.get("position"), "is_default": im.get("is_default")}
            for im in (final.get("images") or [])[:20]
        ],
        "action": "updated",
        "notes": notes,
    }
    state[slug] = entry
    save_state(state)
    print(f"UPDATED {slug} {entry['id']} variants={entry['enabled_count']} prices={entry['prices']} images={entry['image_count']} notes={notes}", flush=True)
    return entry


def wait_for_images(pid: str, tries: int = 8) -> dict:
    for i in range(tries):
        final = api("GET", SHOP + f"/{pid}.json")
        imgs = final.get("images") or []
        if imgs:
            return final
        time.sleep(3 + i)
    return final


def download_mockups(state: dict) -> dict:
    out_index = {}
    for slug, entry in state.items():
        if not entry.get("id"):
            continue
        dest_dir = MOCK / slug
        dest_dir.mkdir(parents=True, exist_ok=True)
        final = wait_for_images(entry["id"])
        imgs = final.get("images") or []
        entry["image_count"] = len(imgs)
        saved = []
        # Prefer front / default images
        ranked = sorted(
            imgs,
            key=lambda im: (
                0 if im.get("is_default") else 1,
                0 if (im.get("position") in (None, "front")) else 1,
                0 if "front" in (im.get("src") or "").lower() else 1,
            ),
        )
        for i, im in enumerate(ranked[:6]):
            url = im.get("src")
            if not url:
                continue
            dest = dest_dir / f"front-{i}.jpg"
            if not dest.exists():
                r = S.get(url, timeout=120)
                r.raise_for_status()
                dest.write_bytes(r.content)
            saved.append(str(dest))
        out_index[slug] = {"id": entry["id"], "files": saved, "image_count": len(imgs)}
        entry["mockup_files"] = saved
        print(f"mockups {slug}: {len(saved)} files (api images={len(imgs)})", flush=True)
    save_state(state)
    save("mockup-index.json", out_index)
    return out_index


def contact_sheet(state: dict) -> Path:
    items = []
    for slug in [
        "fanny-pack-468",
        "glass-cutting-board-938",
        "garden-house-banner-976",
        "matte-canvas-stretched-1-25-1159",
        "matte-canvas-stretched-0-75-multi-size-937",
        "metal-art-sign-1206",
        "natural-stone-stretch-bar-bracelet-engraving-2651",
    ]:
        e = state.get(slug) or {}
        files = e.get("mockup_files") or []
        # fallback to Milo mockup if Printify images not ready
        path = Path(files[0]) if files else (ART / slug / "mockup.png")
        items.append((slug, e, path))
    cols = 4
    cw, ch, header = 420, 500, 100
    rows = math.ceil(len(items) / cols)
    sheet = Image.new("RGB", (cols * cw, header + rows * ch), (247, 243, 234))
    draw = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 18)
        small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 14)
    except Exception:
        font = ImageFont.load_default()
        small = font
    draw.text((24, 18), "FREEPLUG — COMING SOON 7  ·  HIDDEN PRINTIFY DRAFTS", font=font, fill=(23, 23, 23))
    draw.text((24, 48), "Proposal only · Not published · Not on the site · Nov 9, 2026 CT", font=small, fill=(60, 60, 60))
    for i, (slug, e, path) in enumerate(items):
        x = (i % cols) * cw
        y = header + (i // cols) * ch
        if path.exists():
            im = Image.open(path).convert("RGB")
            im = ImageOps.contain(im, (cw - 24, 360))
            sheet.paste(im, (x + (cw - im.width) // 2, y))
        title = (e.get("title") or slug).replace("Freeplug ", "")
        # wrap
        line = title
        lines = []
        while len(line) > 34:
            j = line.rfind(" ", 0, 34)
            j = j if j > 0 else 34
            lines.append(line[:j])
            line = line[j:].strip()
        lines.append(line)
        for j, ln in enumerate(lines[:2]):
            draw.text((x + 14, y + 370 + j * 22), ln, font=font, fill=(23, 23, 23))
        if e.get("price_min") is not None:
            if e["price_min"] == e.get("price_max"):
                pr = f"${e['price_min']/100:.2f}"
            else:
                pr = f"${e['price_min']/100:.2f}–${e['price_max']/100:.2f}"
        else:
            pr = "—"
        pid = (e.get("id") or "")[:10]
        draw.text((x + 14, y + 420), f"{pr} · HIDDEN · {pid}", font=small, fill=(186, 61, 61))
        draw.text((x + 14, y + 442), f"{e.get('enabled_count', '?')} variants", font=small, fill=(80, 80, 80))
    out = MOCK / "contact-sheet.png"
    sheet.save(out)
    print(f"Contact sheet: {out}", flush=True)
    return out


def write_report(state: dict, failures: list) -> None:
    report = {
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "shopId": SHOP_ID,
        "visible": False,
        "items": state,
        "failures": failures,
        "contactSheet": str(MOCK / "contact-sheet.png"),
    }
    (ROOT / "printify-created.json").write_text(json.dumps(report, indent=2))
    lines = [
        "# Coming-Soon-7 — Hidden Printify Drafts",
        "",
        f"Generated {report['generatedAt']} (box-local / America/Chicago).",
        f"Shop `{SHOP_ID}`. All drafts `visible: false`. No publish, no orders, no site changes.",
        "",
        "| Slug | Product ID | Action | Variants | Prices (USD) | Images | Notes |",
        "|---|---|---|---:|---|---:|---|",
    ]
    for slug in [
        "fanny-pack-468",
        "glass-cutting-board-938",
        "garden-house-banner-976",
        "matte-canvas-stretched-1-25-1159",
        "matte-canvas-stretched-0-75-multi-size-937",
        "metal-art-sign-1206",
        "natural-stone-stretch-bar-bracelet-engraving-2651",
    ]:
        e = state.get(slug) or {}
        if e.get("price_min") is not None:
            if e["price_min"] == e.get("price_max"):
                pr = f"${e['price_min']/100:.2f}"
            else:
                pr = f"${e['price_min']/100:.2f}–${e['price_max']/100:.2f}"
        else:
            pr = "—"
        notes = "; ".join(e.get("notes") or []) or "—"
        lines.append(
            f"| `{slug}` | `{e.get('id','')}` | {e.get('action','')} | {e.get('enabled_count','')} | {pr} | {e.get('image_count','')} | {notes} |"
        )
    if failures:
        lines += ["", "## Failures", ""]
        for f in failures:
            lines.append(f"- **{f.get('slug')}**: {f.get('error')}")
    lines += [
        "",
        "## Mockups",
        f"- Contact sheet: `{MOCK / 'contact-sheet.png'}`",
        f"- Per-item folders under `{MOCK}/`",
        "",
        "## Art source",
        f"- Milo art: `{ART}/<slug>/`",
        "- Bracelet: updated existing draft `6af183d8621d8c64cd01a5f1` (no duplicate).",
        "",
    ]
    (ROOT / "PRINTIFY-REPORT.md").write_text("\n".join(lines))
    print("Wrote printify-created.json and PRINTIFY-REPORT.md", flush=True)


def main():
    only = set(sys.argv[1:]) if len(sys.argv) > 1 else None
    failures = []
    # Create 6 new drafts
    for spec in SPECS:
        if only and spec["slug"] not in only:
            continue
        try:
            create_product(spec)
        except Exception as e:
            failures.append({"slug": spec["slug"], "error": str(e)[:900]})
            save("failures.json", failures)
            print(f"FAIL {spec['slug']}: {e}", flush=True)
        time.sleep(0.8)
    # Update bracelet
    if not only or "natural-stone-stretch-bar-bracelet-engraving-2651" in only or "bracelet" in only:
        try:
            update_bracelet()
        except Exception as e:
            failures.append({"slug": "natural-stone-stretch-bar-bracelet-engraving-2651", "error": str(e)[:900]})
            save("failures.json", failures)
            print(f"FAIL bracelet: {e}", flush=True)
    state = load_state()
    try:
        download_mockups(state)
    except Exception as e:
        failures.append({"slug": "_mockups", "error": str(e)[:900]})
        print(f"FAIL mockups: {e}", flush=True)
    try:
        contact_sheet(state)
    except Exception as e:
        failures.append({"slug": "_contact_sheet", "error": str(e)[:900]})
        print(f"FAIL contact sheet: {e}", flush=True)
    write_report(state, failures)
    print(f"\nDONE created/updated={len(state)} failures={len(failures)}", flush=True)


if __name__ == "__main__":
    main()
