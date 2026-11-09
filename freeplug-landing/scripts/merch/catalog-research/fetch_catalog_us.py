#!/usr/bin/env python3
"""Read-only Printify catalog download for Freeplug catalog-research.
Never creates/updates/publishes products. Token only from env header.
"""
from __future__ import annotations

import json
import os
import random
import re
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import requests

ROOT = Path("/workspace/logos/freeplug/merch/catalog-research")
RAW = ROOT / "raw"
SHIP_DIR = RAW / "shipping"
COST_DIR = RAW / "costs"
VAR_DIR = RAW / "variants"
BP_PROV_DIR = RAW / "providers_by_bp"
PROV_CACHE = RAW / "_provider_location_cache.json"
PROGRESS = RAW / "_progress.json"
LOG = RAW / "_fetch.log"

API = "https://api.printify.com/v1"
PCS = "https://printify.com/product-catalog-service/api/v2"
UA = "Freeplug-Catalog-Research-ReadOnly"
SHOP = "29664778"  # documented only; not required for catalog GETs

KEYWORD_RE = re.compile(
    r"tee|t-shirt|shirt|hoodie|sweatshirt|crewneck|tank|polo|long sleeve|"
    r"shorts|legging|jogger|youth|kids|toddler|baby|onesie|hat|cap|beanie|"
    r"mug|tumbler|bottle|glass|cup|blanket|pillow|towel|candle|rug|mat|"
    r"curtain|ornament|poster|canvas|framed|metal|tote|bag|backpack|fanny|"
    r"phone case|mouse pad|desk mat|laptop|notebook|journal|sticker|card|"
    r"calendar|pet|dog|cat|bowl|bandana|sock|shoe|sneaker|slide|necklace|"
    r"bracelet|earring|puzzle|apron|coaster|flag|banner",
    re.I,
)

# Tunables
MAX_WORKERS = 1
BASE_SLEEP = 0.28
MAX_RETRIES = 4
USE_KEYWORD_FILTER = True  # set True to stay under ~45 min budget

_lock = threading.Lock()
_session_local = threading.local()
_stats = {
    "providers_ok": 0,
    "providers_fail": 0,
    "ship_ok": 0,
    "ship_fail": 0,
    "cost_ok": 0,
    "cost_fail": 0,
    "var_ok": 0,
    "var_fail": 0,
    "prov_detail_ok": 0,
    "prov_detail_fail": 0,
    "429s": 0,
}


def log(msg: str) -> None:
    line = f"{time.strftime('%Y-%m-%d %H:%M:%S')} {msg}"
    with _lock:
        print(line, flush=True)
        with LOG.open("a") as f:
            f.write(line + "\n")


def session() -> requests.Session:
    s = getattr(_session_local, "s", None)
    if s is None:
        token = os.environ.get("PRINTIFY_API_TOKEN")
        if not token:
            raise SystemExit("PRINTIFY_API_TOKEN not set")
        s = requests.Session()
        s.headers.update(
            {
                "Authorization": f"Bearer {token}",
                "User-Agent": UA,
                "Accept": "application/json",
            }
        )
        _session_local.s = s
    return s


def get_json(url: str, dest: Path | None = None) -> tuple[int, object | None]:
    """GET with retry on 429/5xx. Returns (status, json_or_None)."""
    last_status = 0
    for attempt in range(MAX_RETRIES):
        time.sleep(BASE_SLEEP + random.uniform(0, 0.08))
        try:
            r = session().get(url, timeout=25)
        except requests.RequestException as e:
            last_status = 0
            log(f"REQERR {url} attempt={attempt} err={type(e).__name__}")
            time.sleep(1.5 * (attempt + 1))
            continue
        last_status = r.status_code
        if r.status_code == 429:
            with _lock:
                _stats["429s"] += 1
            retry_after = r.headers.get("Retry-After")
            wait = float(retry_after) if retry_after and retry_after.isdigit() else (2 ** attempt) + random.uniform(0.5, 1.5)
            wait = min(wait, 90)
            log(f"429 {url} sleep={wait:.1f}s")
            time.sleep(wait)
            continue
        if r.status_code >= 500:
            time.sleep((2 ** attempt) + random.uniform(0.2, 1.0))
            continue
        if r.status_code != 200:
            return r.status_code, None
        try:
            data = r.json()
        except Exception:
            return r.status_code, None
        if dest is not None:
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_text(json.dumps(data))
        return r.status_code, data
    return last_status, None


def load_provider_cache() -> dict:
    if PROV_CACHE.exists():
        try:
            return json.loads(PROV_CACHE.read_text())
        except Exception:
            return {}
    return {}


def save_provider_cache(cache: dict) -> None:
    PROV_CACHE.write_text(json.dumps(cache, indent=2, sort_keys=True))


def ensure_provider(pid: int, cache: dict, cache_lock: threading.Lock) -> dict | None:
    key = str(pid)
    with cache_lock:
        if key in cache:
            return cache[key]
    status, data = get_json(f"{API}/catalog/print_providers/{pid}.json")
    if status != 200 or not isinstance(data, dict):
        with _lock:
            _stats["prov_detail_fail"] += 1
        log(f"PROV_FAIL pid={pid} status={status}")
        return None
    loc = data.get("location") or {}
    entry = {
        "id": data.get("id", pid),
        "title": data.get("title"),
        "country": (loc.get("country") if isinstance(loc, dict) else None),
        "location": loc,
    }
    with cache_lock:
        cache[key] = entry
        # periodic flush
        if len(cache) % 10 == 0:
            save_provider_cache(cache)
    with _lock:
        _stats["prov_detail_ok"] += 1
    return entry


def us_shipping_summary(ship: dict) -> dict:
    """Extract US first/additional cents (min across US profiles if several)."""
    profiles = ship.get("profiles") or []
    us_profiles = []
    for p in profiles:
        countries = p.get("countries") or []
        if "US" in countries or "USA" in countries:
            us_profiles.append(p)
    if not us_profiles:
        return {"us_profiles": 0, "first_cents": None, "additional_cents": None, "profiles": []}
    firsts = []
    extras = []
    compact = []
    for p in us_profiles:
        fi = (p.get("first_item") or {}).get("cost")
        ai = (p.get("additional_items") or {}).get("cost")
        if fi is not None:
            firsts.append(fi)
        if ai is not None:
            extras.append(ai)
        compact.append(
            {
                "variant_ids_count": len(p.get("variant_ids") or []),
                "first_cents": fi,
                "additional_cents": ai,
                "currency": (p.get("first_item") or {}).get("currency"),
            }
        )
    return {
        "us_profiles": len(us_profiles),
        "first_cents": min(firsts) if firsts else None,
        "additional_cents": min(extras) if extras else None,
        "profiles": compact,
    }


def fetch_blueprint_providers(bp: dict) -> list[dict]:
    bid = bp["id"]
    dest = BP_PROV_DIR / f"{bid}.json"
    if dest.exists():
        try:
            data = json.loads(dest.read_text())
            with _lock:
                _stats["providers_ok"] += 1
            return data if isinstance(data, list) else []
        except Exception:
            pass
    status, data = get_json(f"{API}/catalog/blueprints/{bid}/print_providers.json", dest)
    if status != 200 or not isinstance(data, list):
        with _lock:
            _stats["providers_fail"] += 1
        log(f"BP_PROV_FAIL bp={bid} status={status}")
        return []
    with _lock:
        _stats["providers_ok"] += 1
    return data


def fetch_pair(bid: int, pid: int) -> None:
    # Hot path: shipping + costs only. Variant titles backfilled separately.
    ship_path = SHIP_DIR / f"{bid}_{pid}.json"
    cost_path = COST_DIR / f"{bid}_{pid}.json"

    if not ship_path.exists():
        status, _ = get_json(
            f"{API}/catalog/blueprints/{bid}/print_providers/{pid}/shipping.json",
            ship_path,
        )
        with _lock:
            if status == 200:
                _stats["ship_ok"] += 1
            else:
                _stats["ship_fail"] += 1
                log(f"SHIP_FAIL bp={bid} pid={pid} status={status}")
    else:
        with _lock:
            _stats["ship_ok"] += 1

    if not cost_path.exists():
        status, _ = get_json(
            f"{PCS}/blueprints/{bid}/print-providers/{pid}/variants",
            cost_path,
        )
        with _lock:
            if status == 200:
                _stats["cost_ok"] += 1
            else:
                _stats["cost_fail"] += 1
                log(f"COST_FAIL bp={bid} pid={pid} status={status}")
    else:
        with _lock:
            _stats["cost_ok"] += 1


def main() -> int:
    for d in (RAW, SHIP_DIR, COST_DIR, VAR_DIR, BP_PROV_DIR):
        d.mkdir(parents=True, exist_ok=True)

    bp_path = Path("/tmp/bp.json")
    if not bp_path.exists():
        log("bp.json missing; refetching")
        status, data = get_json(f"{API}/catalog/blueprints.json", bp_path)
        if status != 200:
            log(f"Failed to fetch blueprints status={status}")
            return 1
    blueprints = json.loads(bp_path.read_text())
    if not isinstance(blueprints, list):
        log("bp.json not a list")
        return 1

    # Copy blueprints into raw/
    (RAW / "blueprints.json").write_text(json.dumps(blueprints))

    filter_note = "none (all blueprints)"
    scanned = blueprints
    if USE_KEYWORD_FILTER:
        scanned = [b for b in blueprints if KEYWORD_RE.search(b.get("title") or "")]
        filter_note = f"keyword filter applied: {len(scanned)}/{len(blueprints)} blueprints"

    log(f"START blueprints_total={len(blueprints)} scanned={len(scanned)} filter={filter_note} workers={MAX_WORKERS}")

    # Phase 1: providers per blueprint
    bp_providers: dict[int, list[dict]] = {}
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as ex:
        futs = {ex.submit(fetch_blueprint_providers, b): b for b in scanned}
        done = 0
        for fut in as_completed(futs):
            b = futs[fut]
            try:
                provs = fut.result()
            except Exception as e:
                log(f"BP_PROV_EXC bp={b['id']} {type(e).__name__}")
                provs = []
            bp_providers[b["id"]] = provs
            done += 1
            if done % 100 == 0 or done == len(scanned):
                log(f"providers_phase {done}/{len(scanned)} stats={_stats}")

    # Phase 2: resolve provider locations, collect US pairs
    cache = load_provider_cache()
    cache_lock = threading.Lock()
    all_pids = sorted({p["id"] for provs in bp_providers.values() for p in provs if "id" in p})
    log(f"unique_providers={len(all_pids)}")

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as ex:
        futs = {ex.submit(ensure_provider, pid, cache, cache_lock): pid for pid in all_pids}
        done = 0
        for fut in as_completed(futs):
            done += 1
            if done % 25 == 0 or done == len(all_pids):
                log(f"provider_detail_phase {done}/{len(all_pids)}")
            try:
                fut.result()
            except Exception as e:
                log(f"PROV_EXC {type(e).__name__}")

    save_provider_cache(cache)
    (RAW / "providers.json").write_text(json.dumps(cache, indent=2, sort_keys=True))

    us_pairs: list[tuple[int, int]] = []
    for bid, provs in bp_providers.items():
        for p in provs:
            pid = p.get("id")
            if pid is None:
                continue
            entry = cache.get(str(pid))
            if entry and (entry.get("country") or "").upper() == "US":
                us_pairs.append((bid, pid))
    us_pairs = sorted(set(us_pairs))
    log(f"us_pairs={len(us_pairs)}")

    # Phase 3: shipping + costs + variants per US pair
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as ex:
        futs = [ex.submit(fetch_pair, bid, pid) for bid, pid in us_pairs]
        done = 0
        for fut in as_completed(futs):
            done += 1
            try:
                fut.result()
            except Exception as e:
                log(f"PAIR_EXC {type(e).__name__}: {e}")
            if done % 25 == 0 or done == len(us_pairs):
                log(f"pair_phase {done}/{len(us_pairs)} stats={_stats}")

    # Phase 4: build catalog-us.jsonl
    bp_by_id = {b["id"]: b for b in blueprints}
    jsonl_path = RAW / "catalog-us.jsonl"
    lines_written = 0
    cost_success = 0
    cost_missing = 0
    with jsonl_path.open("w") as out:
        for bid, pid in us_pairs:
            bp = bp_by_id.get(bid, {"id": bid})
            prov = cache.get(str(pid), {"id": pid})
            ship_path = SHIP_DIR / f"{bid}_{pid}.json"
            cost_path = COST_DIR / f"{bid}_{pid}.json"
            var_path = VAR_DIR / f"{bid}_{pid}.json"

            ship_sum = {"us_profiles": 0, "first_cents": None, "additional_cents": None}
            if ship_path.exists():
                try:
                    ship_sum = us_shipping_summary(json.loads(ship_path.read_text()))
                except Exception:
                    pass

            titles: dict[int, str] = {}
            if var_path.exists():
                try:
                    vdata = json.loads(var_path.read_text())
                    for v in vdata.get("variants") or []:
                        if "id" in v:
                            titles[v["id"]] = v.get("title") or ""
                except Exception:
                    pass

            variants_out = []
            if cost_path.exists():
                try:
                    cdata = json.loads(cost_path.read_text())
                    for v in cdata.get("data") or []:
                        vid = v.get("id")
                        costs = v.get("costs") or []
                        cost_cents = None
                        if costs and isinstance(costs[0], dict):
                            cost_cents = costs[0].get("result")
                        variants_out.append(
                            {
                                "id": vid,
                                "title": titles.get(vid),
                                "cost_cents": cost_cents,
                                "available": v.get("available"),
                                "status": v.get("status"),
                            }
                        )
                    cost_success += 1
                except Exception:
                    cost_missing += 1
            else:
                cost_missing += 1

            rec = {
                "blueprint_id": bid,
                "blueprint_title": bp.get("title"),
                "blueprint_brand": bp.get("brand"),
                "blueprint_model": bp.get("model"),
                "provider_id": pid,
                "provider_name": prov.get("title"),
                "provider_country": prov.get("country"),
                "us_shipping_first_cents": ship_sum.get("first_cents"),
                "us_shipping_additional_cents": ship_sum.get("additional_cents"),
                "us_shipping_profiles": ship_sum.get("us_profiles"),
                "variants": variants_out,
            }
            out.write(json.dumps(rec, separators=(",", ":")) + "\n")
            lines_written += 1

    # README
    readme = f"""# Printify US catalog raw dump (read-only)

Generated for Freeplug catalog-research. **No products created, updated, or published.**

## Filter

{filter_note}

Title keyword regex covered common merch words (tee, hoodie, mug, tote, hat, blanket, etc.).
Blueprints whose titles do not match (e.g. Wall Clock, Pin Buttons, Swimsuits, Bodysuits, Scarves)
were skipped to keep the download under the time budget. Re-run with `USE_KEYWORD_FILTER = False`
in `fetch_catalog_us.py` for the full 3,022.

## Files

| Path | Description |
|------|-------------|
| `blueprints.json` | Full Printify catalog blueprints list (all ~3,022), copied from `/tmp/bp.json` |
| `providers.json` | Cached print-provider details keyed by id: id, title, country, location |
| `providers_by_bp/{{id}}.json` | Raw `/catalog/blueprints/{{id}}/print_providers.json` per scanned blueprint |
| `shipping/{{bp}}_{{pid}}.json` | Raw shipping.json for each US blueprint×provider pair |
| `costs/{{bp}}_{{pid}}.json` | Raw product-catalog-service v2 variants (includes `costs[].result` in cents) |
| `variants/{{bp}}_{{pid}}.json` | Raw catalog variants.json (titles / placeholders); used to label costs |
| `catalog-us.jsonl` | One JSON object per US blueprint×provider pair (compact) |
| `_provider_location_cache.json` | Resume cache for provider location lookups |
| `_fetch.log` | Fetch log |

## `catalog-us.jsonl` fields

- `blueprint_id`, `blueprint_title`, `blueprint_brand`, `blueprint_model`
- `provider_id`, `provider_name`, `provider_country` (always `US` in this file)
- `us_shipping_first_cents`, `us_shipping_additional_cents` (min across US profiles; cents)
- `us_shipping_profiles` (count of US shipping profiles)
- `variants[]`: `id`, `title` (from catalog API), `cost_cents` (from PCS `costs[0].result`), `available`, `status`

## Sources

- `GET https://api.printify.com/v1/catalog/blueprints.json`
- `GET https://api.printify.com/v1/catalog/blueprints/{{id}}/print_providers.json`
- `GET https://api.printify.com/v1/catalog/print_providers/{{id}}.json` (location.country)
- `GET https://api.printify.com/v1/catalog/blueprints/{{id}}/print_providers/{{pid}}/shipping.json`
- `GET https://api.printify.com/v1/catalog/blueprints/{{id}}/print_providers/{{pid}}/variants.json`
- `GET https://printify.com/product-catalog-service/api/v2/blueprints/{{id}}/print-providers/{{pid}}/variants`

Shop referenced: `{SHOP}`. All requests sent `User-Agent: {UA}` and `Authorization: Bearer` from env `PRINTIFY_API_TOKEN` (token never written to disk).

## Counts (this run)

- Blueprints total in catalog: {len(blueprints)}
- Blueprints scanned: {len(scanned)}
- Unique providers seen: {len(all_pids)}
- US blueprint×provider pairs: {len(us_pairs)}
- JSONL lines: {lines_written}
- Cost file successes (pairs with parsable costs): {cost_success}
- Cost missing/fail: {cost_missing}
- Runtime stats: {json.dumps(_stats)}

## Gaps

- Cost endpoint failures are logged as `COST_FAIL` in `_fetch.log`; those pairs still appear in JSONL with empty `variants`.
- Shipping with no US profile yields null first/additional cents.
- Variant titles are null when catalog variants fetch failed but PCS costs succeeded.
- Non-keyword blueprints omitted (see Filter).
"""
    (RAW / "README.md").write_text(readme)

    meta = {
        "blueprints_total": len(blueprints),
        "blueprints_scanned": len(scanned),
        "filter": filter_note,
        "unique_providers": len(all_pids),
        "us_pairs": len(us_pairs),
        "jsonl_lines": lines_written,
        "cost_success": cost_success,
        "cost_missing": cost_missing,
        "stats": _stats,
        "finished_at": time.strftime("%Y-%m-%d %H:%M:%S %z"),
    }
    (RAW / "_meta.json").write_text(json.dumps(meta, indent=2))
    log(f"DONE meta={json.dumps(meta)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
