#!/usr/bin/env python3
"""Fetch Printify variants + blueprint images for the 195 top items.
Read-only. Restartable. Token only from env into Authorization header.
"""
from __future__ import annotations

import csv
import json
import os
import sys
import time
import traceback
from io import BytesIO
from pathlib import Path

import requests
from PIL import Image

ROOT = Path("/workspace/logos/freeplug/merch/shop-build")
CSV_PATH = ROOT / "src/top-items/docs/merch-research/TOP-ITEMS.csv"
BP_PATH = Path("/tmp/bp.json")
OLD_VARIANTS = Path("/workspace/logos/freeplug/merch/catalog-research/raw/variants")
VAR_DIR = ROOT / "variants"
IMG_DIR = ROOT / "images"
OUT_JSON = ROOT / "shop-enrich.json"
LOG = ROOT / "enrich.log"
PROGRESS = ROOT / "enrich_progress.json"

VAR_DIR.mkdir(parents=True, exist_ok=True)
IMG_DIR.mkdir(parents=True, exist_ok=True)

UA = "FreeplugCatalogResearch/1.0"
BASE = "https://api.printify.com/v1/catalog/blueprints"


def log(msg: str) -> None:
    line = f"{time.strftime('%Y-%m-%d %H:%M:%S')} {msg}"
    print(line, flush=True)
    with LOG.open("a") as f:
        f.write(line + "\n")


def save_progress(d: dict) -> None:
    PROGRESS.write_text(json.dumps(d, indent=2))


def headers() -> dict:
    token = os.environ.get("PRINTIFY_API_TOKEN")
    if not token:
        raise SystemExit("PRINTIFY_API_TOKEN unset")
    return {
        "Authorization": f"Bearer {token}",
        "User-Agent": UA,
        "Accept": "application/json",
    }


def load_pairs() -> list[tuple[int, int, dict]]:
    rows = list(csv.DictReader(CSV_PATH.open()))
    out = []
    for r in rows:
        out.append((int(r["blueprint_id"]), int(r["provider_id"]), r))
    return out


def fetch_variants(bp: int, pid: int, sess: requests.Session) -> dict | None:
    cache = VAR_DIR / f"{bp}_{pid}.json"
    if cache.exists() and cache.stat().st_size > 50:
        try:
            return json.loads(cache.read_text())
        except Exception:
            pass
    # seed from older catalog cache if present
    old = OLD_VARIANTS / f"{bp}_{pid}.json"
    if old.exists() and old.stat().st_size > 50:
        try:
            data = json.loads(old.read_text())
            cache.write_text(json.dumps(data))
            return data
        except Exception:
            pass

    url = f"{BASE}/{bp}/print_providers/{pid}/variants.json"
    delays = [1, 2, 4, 8, 16]
    for attempt, delay in enumerate(delays, 1):
        try:
            r = sess.get(url, headers=headers(), timeout=(10, 20))
            if r.status_code == 200:
                data = r.json()
                cache.write_text(json.dumps(data))
                return data
            if r.status_code in (429, 500, 502, 503, 504):
                log(f"retry {bp}_{pid} status={r.status_code} attempt={attempt}")
                time.sleep(delay)
                continue
            log(f"FAIL variants {bp}_{pid} status={r.status_code} body={r.text[:200]}")
            # write sentinel so we don't hammer forever
            cache.write_text(json.dumps({"_error": r.status_code, "variants": []}))
            return None
        except (requests.Timeout, requests.ConnectionError) as e:
            log(f"retry {bp}_{pid} err={type(e).__name__} attempt={attempt}")
            time.sleep(delay)
        except Exception as e:
            log(f"FAIL variants {bp}_{pid} {type(e).__name__}: {e}")
            return None
    log(f"FAIL variants {bp}_{pid} after retries")
    return None


def normalize_variants(data: dict | None) -> list[dict]:
    if not data or not isinstance(data, dict):
        return []
    vs = data.get("variants") or []
    out = []
    for v in vs:
        opts = v.get("options") or {}
        placeholders = []
        for ph in v.get("placeholders") or []:
            placeholders.append(
                {
                    "position": ph.get("position"),
                    "width": ph.get("width"),
                    "height": ph.get("height"),
                    "decoration_method": ph.get("decoration_method"),
                }
            )
        out.append(
            {
                "id": v.get("id"),
                "title": v.get("title") or "",
                "color": opts.get("color") or opts.get("Color") or "",
                "size": opts.get("size") or opts.get("Size") or "",
                "placeholders": placeholders,
            }
        )
    return out


def download_images(bp_id: int, urls: list[str], sess: requests.Session) -> list[dict]:
    """Download up to 2 images, convert to webp max 1000px wide. Return list of {file, source}."""
    results = []
    for i, url in enumerate(urls[:2]):
        # detect existing
        existing = list(IMG_DIR.glob(f"{bp_id}-{i}.*"))
        webp_path = IMG_DIR / f"{bp_id}-{i}.webp"
        if webp_path.exists() and webp_path.stat().st_size > 100:
            results.append({"file": webp_path.name, "source": url})
            continue
        # clean other ext leftovers
        for e in existing:
            if e.suffix.lower() != ".webp":
                try:
                    e.unlink()
                except Exception:
                    pass
        try:
            r = sess.get(
                url,
                headers={"User-Agent": UA},
                timeout=(10, 30),
                stream=True,
            )
            if r.status_code != 200:
                log(f"FAIL image bp={bp_id} n={i} status={r.status_code}")
                continue
            raw = r.content
            img = Image.open(BytesIO(raw))
            img = img.convert("RGBA") if img.mode in ("P", "LA") else img.convert("RGB") if img.mode not in ("RGB", "RGBA") else img
            w, h = img.size
            if w > 1000:
                nh = int(h * (1000 / w))
                img = img.resize((1000, max(nh, 1)), Image.Resampling.LANCZOS)
            # prefer RGB for webp size
            if img.mode == "RGBA":
                # keep alpha
                pass
            else:
                img = img.convert("RGB")
            img.save(webp_path, "WEBP", quality=80, method=4)
            results.append({"file": webp_path.name, "source": url})
        except Exception as e:
            log(f"FAIL image bp={bp_id} n={i} {type(e).__name__}: {e}")
    return results


def main() -> int:
    log("START enrich_shop")
    pairs = load_pairs()
    log(f"pairs={len(pairs)}")
    bp_list = json.loads(BP_PATH.read_text())
    by_id = {b["id"]: b for b in bp_list}

    sess = requests.Session()
    # connection pool
    adapter = requests.adapters.HTTPAdapter(pool_connections=4, pool_maxsize=4, max_retries=0)
    sess.mount("https://", adapter)

    progress = {
        "pairs_total": len(pairs),
        "variants_ok": 0,
        "variants_fail": 0,
        "images_items": 0,
        "images_total": 0,
        "done": False,
    }

    enrich_items = []
    fail_variants = []
    missing_images = []

    # Phase 1: variants
    log("PHASE variants")
    for idx, (bp, pid, row) in enumerate(pairs, 1):
        cache = VAR_DIR / f"{bp}_{pid}.json"
        had_cache = cache.exists() and cache.stat().st_size > 50
        oldc = OLD_VARIANTS / f"{bp}_{pid}.json"
        had_old = (not had_cache) and oldc.exists() and oldc.stat().st_size > 50
        data = fetch_variants(bp, pid, sess)
        variants = normalize_variants(data)
        if variants:
            progress["variants_ok"] += 1
        else:
            progress["variants_fail"] += 1
            fail_variants.append({"blueprint_id": bp, "provider_id": pid, "title": row.get("blueprint_title")})
        # pace ~2.5 req/sec only on real network fetches
        if not had_cache and not had_old:
            time.sleep(0.4)

        imgs_meta = by_id.get(bp, {}).get("images") or []
        # store intermediate; images filled in phase 2
        enrich_items.append(
            {
                "blueprint_id": bp,
                "provider_id": pid,
                "blueprint_title": row.get("blueprint_title"),
                "brand": row.get("brand"),
                "model": row.get("model"),
                "category": row.get("category"),
                "image_files": [],
                "image_sources": list(imgs_meta[:2]),
                "variants": variants,
            }
        )
        if idx % 25 == 0 or idx == len(pairs):
            progress["last_idx"] = idx
            save_progress(progress)
            log(f"variants progress {idx}/{len(pairs)} ok={progress['variants_ok']} fail={progress['variants_fail']}")

    # Phase 2: images (unique blueprints — all 195 unique)
    log("PHASE images")
    # reuse session; images.printify.com
    for idx, item in enumerate(enrich_items, 1):
        bp = item["blueprint_id"]
        urls = item["image_sources"]
        if not urls:
            missing_images.append(bp)
            continue
        results = download_images(bp, urls, sess)
        item["image_files"] = [r["file"] for r in results]
        item["image_sources"] = [r["source"] for r in results] if results else urls
        if results:
            progress["images_items"] += 1
            progress["images_total"] += len(results)
        else:
            missing_images.append(bp)
        if idx % 25 == 0 or idx == len(enrich_items):
            save_progress(progress)
            log(f"images progress {idx}/{len(enrich_items)} items={progress['images_items']} files={progress['images_total']}")
        time.sleep(0.15)

    # Write enrich json
    out = {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "item_count": len(enrich_items),
        "variants_ok": progress["variants_ok"],
        "variants_fail": progress["variants_fail"],
        "images_items": progress["images_items"],
        "images_total": progress["images_total"],
        "fail_variants": fail_variants,
        "missing_images": missing_images,
        "items": enrich_items,
    }
    OUT_JSON.write_text(json.dumps(out, indent=2))
    log(f"wrote {OUT_JSON} bytes={OUT_JSON.stat().st_size}")

    # tar.gz
    import tarfile

    tar_path = ROOT / "shop-images.tar.gz"
    with tarfile.open(tar_path, "w:gz") as tar:
        tar.add(OUT_JSON, arcname="shop-enrich.json")
        tar.add(IMG_DIR, arcname="images")
    progress["done"] = True
    progress["tar_bytes"] = tar_path.stat().st_size
    progress["fail_variants"] = fail_variants
    progress["missing_images"] = missing_images
    save_progress(progress)
    log(f"DONE tar={tar_path} size={tar_path.stat().st_size}")
    log(
        f"SUMMARY pairs={len(pairs)} var_ok={progress['variants_ok']} var_fail={progress['variants_fail']} "
        f"img_items={progress['images_items']} img_files={progress['images_total']} "
        f"missing_img={len(missing_images)}"
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception:
        log("CRASH\n" + traceback.format_exc())
        raise
