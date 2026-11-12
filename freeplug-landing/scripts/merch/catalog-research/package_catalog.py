#!/usr/bin/env python3
"""Build catalog-us.jsonl + README from cached Printify raw dumps, tar.gz, token check.
Works on partial data (pairs with shipping and/or costs present).
Never prints or writes the Printify token.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path("/workspace/logos/freeplug/merch/catalog-research")
RAW = ROOT / "raw"
SHIP_DIR = RAW / "shipping"
COST_DIR = RAW / "costs"
VAR_DIR = RAW / "variants"
BP_PROV_DIR = RAW / "providers_by_bp"
TAR_PATH = ROOT / "printify-catalog-us.tar.gz"
SUMMARY = ROOT / "package_summary.txt"


def us_shipping_summary(ship: dict) -> dict:
    profiles = ship.get("profiles") or []
    us_profiles = [p for p in profiles if "US" in (p.get("countries") or []) or "USA" in (p.get("countries") or [])]
    if not us_profiles:
        return {"us_profiles": 0, "first_cents": None, "additional_cents": None}
    firsts, extras = [], []
    for p in us_profiles:
        fi = (p.get("first_item") or {}).get("cost")
        ai = (p.get("additional_items") or {}).get("cost")
        if fi is not None:
            firsts.append(fi)
        if ai is not None:
            extras.append(ai)
    return {
        "us_profiles": len(us_profiles),
        "first_cents": min(firsts) if firsts else None,
        "additional_cents": min(extras) if extras else None,
    }


def discover_pairs() -> list[tuple[int, int]]:
    """Union of pairs from shipping/ and costs/ filenames {bp}_{pid}.json."""
    pairs: set[tuple[int, int]] = set()
    for d in (SHIP_DIR, COST_DIR):
        if not d.exists():
            continue
        for p in d.glob("*.json"):
            stem = p.stem
            if "_" not in stem:
                continue
            a, b = stem.split("_", 1)
            try:
                pairs.add((int(a), int(b)))
            except ValueError:
                continue
    return sorted(pairs)


def build_jsonl(pairs: list[tuple[int, int]], blueprints: list, providers: dict) -> dict:
    bp_by_id = {b["id"]: b for b in blueprints if isinstance(b, dict) and "id" in b}
    jsonl_path = RAW / "catalog-us.jsonl"
    cost_ok = cost_missing = ship_ok = ship_missing = titled = untitled = 0
    lines = 0
    with jsonl_path.open("w") as out:
        for bid, pid in pairs:
            bp = bp_by_id.get(bid, {"id": bid})
            prov = providers.get(str(pid), {"id": pid})
            ship_path = SHIP_DIR / f"{bid}_{pid}.json"
            cost_path = COST_DIR / f"{bid}_{pid}.json"
            var_path = VAR_DIR / f"{bid}_{pid}.json"

            ship_sum = {"us_profiles": 0, "first_cents": None, "additional_cents": None}
            if ship_path.exists():
                try:
                    ship_sum = us_shipping_summary(json.loads(ship_path.read_text()))
                    ship_ok += 1
                except Exception:
                    ship_missing += 1
            else:
                ship_missing += 1

            titles: dict[int, str] = {}
            if var_path.exists():
                try:
                    vdata = json.loads(var_path.read_text())
                    for v in vdata.get("variants") or []:
                        if "id" in v:
                            titles[int(v["id"])] = v.get("title") or ""
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
                        title = titles.get(int(vid)) if vid is not None else None
                        if title:
                            titled += 1
                        else:
                            untitled += 1
                        variants_out.append(
                            {
                                "id": vid,
                                "title": title,
                                "cost_cents": cost_cents,
                                "available": v.get("available"),
                                "status": v.get("status"),
                            }
                        )
                    cost_ok += 1
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
            lines += 1
    return {
        "jsonl_path": str(jsonl_path),
        "jsonl_lines": lines,
        "cost_ok": cost_ok,
        "cost_missing": cost_missing,
        "ship_ok": ship_ok,
        "ship_missing": ship_missing,
        "variants_with_title": titled,
        "variants_without_title": untitled,
        "jsonl_bytes": jsonl_path.stat().st_size if jsonl_path.exists() else 0,
    }


def write_readme(meta: dict) -> Path:
    path = RAW / "README.md"
    path.write_text(
        f"""# Printify US catalog raw dump (read-only)

Generated for Freeplug catalog-research. **No products created, updated, or published.**

## Filter

{meta.get("filter", "keyword filter (see fetch_catalog_us.py)")}

Title keyword regex covered common merch words (tee, hoodie, mug, tote, hat, blanket, etc.).
Blueprints whose titles do not match were skipped to keep the download under the time budget.

## Files

| Path | Description |
|------|-------------|
| `blueprints.json` | Full Printify catalog blueprints list (~3,022) |
| `providers.json` | Cached print-provider details keyed by id |
| `providers_by_bp/{{id}}.json` | Raw print_providers.json per scanned blueprint |
| `shipping/{{bp}}_{{pid}}.json` | Raw shipping.json for US blueprint×provider pairs |
| `costs/{{bp}}_{{pid}}.json` | Raw product-catalog-service v2 variants (costs in cents) |
| `variants/{{bp}}_{{pid}}.json` | Catalog variants.json titles (optional / partial backfill) |
| `catalog-us.jsonl` | One JSON object per US blueprint×provider pair |

## `catalog-us.jsonl` fields

- `blueprint_id`, `blueprint_title`, `blueprint_brand`, `blueprint_model`
- `provider_id`, `provider_name`, `provider_country`
- `us_shipping_first_cents`, `us_shipping_additional_cents` (min across US profiles; cents)
- `us_shipping_profiles`
- `variants[]`: `id`, `title`, `cost_cents`, `available`, `status`

## Sources

- `GET https://api.printify.com/v1/catalog/blueprints.json`
- `GET https://api.printify.com/v1/catalog/blueprints/{{id}}/print_providers.json`
- `GET https://api.printify.com/v1/catalog/print_providers/{{id}}.json`
- `GET https://api.printify.com/v1/catalog/blueprints/{{id}}/print_providers/{{pid}}/shipping.json`
- `GET https://api.printify.com/v1/catalog/blueprints/{{id}}/print_providers/{{pid}}/variants.json`
- `GET https://printify.com/product-catalog-service/api/v2/blueprints/{{id}}/print-providers/{{pid}}/variants`

Shop referenced: `29664778`. Token only via env `PRINTIFY_API_TOKEN` in Authorization header (never on disk).

## Counts (this package run)

- Blueprints total: {meta.get("blueprints_total")}
- Blueprints scanned (providers_by_bp files): {meta.get("blueprints_scanned")}
- Unique providers in providers.json: {meta.get("unique_providers")}
- US pairs packaged (from shipping/costs caches): {meta.get("us_pairs_packaged")}
- JSONL lines: {meta.get("jsonl_lines")}
- Cost successes / missing: {meta.get("cost_ok")} / {meta.get("cost_missing")}
- Ship successes / missing: {meta.get("ship_ok")} / {meta.get("ship_missing")}
- Variant titles present / missing: {meta.get("variants_with_title")} / {meta.get("variants_without_title")}
- Partial run: {meta.get("partial")}
- Packaged at (America/Chicago box local): {meta.get("packaged_at")}

## Gaps

- Keyword-filtered blueprints omitted from scan.
- Cost or shipping files missing for some pairs → empty variants or null shipping cents.
- Variant titles often null unless `variants/` backfill ran.
- Partial packaging is valid if fetch was still running.
"""
    )
    return path


def token_check() -> dict:
    """Match-only grep for the env token value across output paths. Never print the token."""
    token = os.environ.get("PRINTIFY_API_TOKEN") or ""
    if not token:
        return {"ok": False, "reason": "PRINTIFY_API_TOKEN unset", "matches": 0}
    # Check packaging outputs + raw tree, excluding nothing that should hold the token
    targets = [
        str(RAW / "catalog-us.jsonl"),
        str(RAW / "README.md"),
        str(RAW / "blueprints.json"),
        str(RAW / "providers.json"),
        str(TAR_PATH),
        str(ROOT / "package_catalog.py"),
        str(ROOT / "fetch_catalog_us.py"),
        str(ROOT / "backfill_variants.py"),
        str(SUMMARY),
    ]
    # Also scan shipping/costs/variants for accidental token leakage via rg --files-with-matches
    # Use Python only so we never echo the token in a shell command line visible in logs.
    matches = []
    scan_files = [Path(t) for t in targets if Path(t).exists() and Path(t).is_file()]
    for d in (SHIP_DIR, COST_DIR, VAR_DIR, BP_PROV_DIR):
        if d.exists():
            # sample all files — token should never appear
            scan_files.extend(p for p in d.rglob("*") if p.is_file())
    for meta in (RAW / "_meta.json", RAW / "_fetch.log", RAW / "_stdout.log", RAW / "_provider_location_cache.json"):
        if meta.exists():
            scan_files.append(meta)
    for p in scan_files:
        try:
            # skip huge binary tar until after we build; for tar use binary search
            data = p.read_bytes()
        except Exception:
            continue
        if token.encode() in data:
            matches.append(str(p))
    return {"ok": len(matches) == 0, "matches": len(matches), "paths": matches, "files_scanned": len(scan_files)}


def main() -> int:
    RAW.mkdir(parents=True, exist_ok=True)
    bp_path = RAW / "blueprints.json"
    if not bp_path.exists() and Path("/tmp/bp.json").exists():
        bp_path.write_text(Path("/tmp/bp.json").read_text())
    blueprints = json.loads(bp_path.read_text()) if bp_path.exists() else []
    providers = {}
    prov_path = RAW / "providers.json"
    if prov_path.exists():
        providers = json.loads(prov_path.read_text())

    pairs = discover_pairs()
    scanned = len(list(BP_PROV_DIR.glob("*.json"))) if BP_PROV_DIR.exists() else 0
    ship_n = len(list(SHIP_DIR.glob("*.json"))) if SHIP_DIR.exists() else 0
    cost_n = len(list(COST_DIR.glob("*.json"))) if COST_DIR.exists() else 0
    var_n = len(list(VAR_DIR.glob("*.json"))) if VAR_DIR.exists() else 0

    # Heuristic: expected full US pairs from last fetch log / meta if present
    expected = None
    meta_path = RAW / "_meta.json"
    if meta_path.exists():
        try:
            expected = json.loads(meta_path.read_text()).get("us_pairs")
        except Exception:
            pass
    if expected is None:
        # parse last us_pairs= from fetch log
        logp = RAW / "_fetch.log"
        if logp.exists():
            for line in reversed(logp.read_text().splitlines()):
                if "us_pairs=" in line:
                    try:
                        expected = int(line.split("us_pairs=")[1].split()[0])
                    except Exception:
                        pass
                    break
    partial = True
    if expected is not None and ship_n >= expected and cost_n >= expected:
        partial = False
    # also partial if fetch process still alive (caller may package mid-run)
    try:
        # non-fatal check: if package_summary says so
        pass
    except Exception:
        pass

    jstats = build_jsonl(pairs, blueprints, providers)
    filter_note = "keyword filter applied (see fetch_catalog_us.py USE_KEYWORD_FILTER)"
    meta = {
        "filter": filter_note,
        "blueprints_total": len(blueprints),
        "blueprints_scanned": scanned,
        "unique_providers": len(providers),
        "us_pairs_packaged": len(pairs),
        "expected_us_pairs": expected,
        "shipping_files": ship_n,
        "cost_files": cost_n,
        "variant_files": var_n,
        "partial": partial,
        "packaged_at": time.strftime("%Y-%m-%d %H:%M:%S %Z"),
        **jstats,
    }
    write_readme(meta)

    # tar.gz compact file + README only (as briefed)
    if TAR_PATH.exists():
        TAR_PATH.unlink()
    subprocess.run(
        [
            "tar",
            "-czf",
            str(TAR_PATH),
            "-C",
            str(RAW),
            "catalog-us.jsonl",
            "README.md",
        ],
        check=True,
    )
    meta["tar_path"] = str(TAR_PATH)
    meta["tar_bytes"] = TAR_PATH.stat().st_size

    # token check AFTER tar so tar is included
    tcheck = token_check()
    meta["token_check_ok"] = tcheck["ok"]
    meta["token_check_matches"] = tcheck["matches"]
    meta["token_check_files_scanned"] = tcheck["files_scanned"]
    # never put matching paths that might be sensitive beyond count; paths listed only if match (should be empty)
    if tcheck["paths"]:
        meta["token_check_match_paths"] = tcheck["paths"]

    SUMMARY.write_text(json.dumps(meta, indent=2) + "\n")
    # also refresh _meta packaging section without token
    (RAW / "_package_meta.json").write_text(json.dumps(meta, indent=2) + "\n")

    print(
        f"PACKAGED lines={meta['jsonl_lines']} pairs={meta['us_pairs_packaged']} "
        f"cost_ok={meta['cost_ok']} cost_missing={meta['cost_missing']} "
        f"partial={meta['partial']} tar_bytes={meta['tar_bytes']} "
        f"token_ok={meta['token_check_ok']}"
    )
    return 0 if tcheck["ok"] else 2


if __name__ == "__main__":
    sys.exit(main())
