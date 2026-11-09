#!/usr/bin/env python3
"""Freeplug buyer shop: create HIDDEN Printify drafts (visible:false). Never publishes, never orders.
Idempotent + restartable. State: created-products.json, failures.json in this dir."""
from __future__ import annotations
import os, sys, json, re, time, base64, random
from pathlib import Path
import requests

HERE = Path(__file__).resolve().parent
PLAN = Path("/workspace/shopdraft/repo/docs/merch-research/SHOP-DRAFT-PLAN.json")
CATALOG = Path("/workspace/shopdraft/repo/freeplug-landing/src/lib/merch/shop/shop-catalog.json")
VARIANTS = Path("/workspace/logos/freeplug/merch/shop-build/variants")
# File naming: "*-dark-garment.png" = light ink (for dark garments); "*-light-garment.png" = dark ink.
LOGO_LIGHT_INK = Path("/workspace/logos/freeplug/merch/beanie-freeplug/front-embroidery-dark-garment.png")
LOGO_DARK_INK = Path("/workspace/logos/freeplug/merch/beanie-freeplug/front-embroidery-light-garment.png")
SHOP_ID = 29664778
SHOP = f"/shops/{SHOP_ID}/products"
BASE = "https://api.printify.com/v1"
UA = "Freeplug-Shop-Hidden-Drafts"

TOKEN = os.environ.get("PRINTIFY_API_TOKEN", "")
assert len(TOKEN) > 20, "PRINTIFY_API_TOKEN missing"
S = requests.Session()
S.headers.update({"Authorization": "Bearer " + TOKEN, "User-Agent": UA, "Content-Type": "application/json"})
del TOKEN

def jload(p, default):
    p = HERE / p
    return json.loads(p.read_text()) if p.exists() else default

def jsave(p, data):
    tmp = HERE / (p + ".tmp"); tmp.write_text(json.dumps(data, indent=2)); tmp.replace(HERE / p)

def api(method, path, body=None, tries=6):
    ok = (method == "POST" and path in ("/uploads/images.json", SHOP + ".json")) or \
         (method in ("GET", "PUT") and re.fullmatch(SHOP + r"/[a-f0-9]+\.json", path)) or \
         (method == "GET" and re.fullmatch(SHOP + r"\.json\?page=\d+&limit=\d+", path))
    assert ok, f"blocked endpoint {method} {path}"
    if method in ("POST", "PUT") and path != "/uploads/images.json":
        assert body is not None and body.get("visible") is False
    for a in range(tries):
        try:
            r = S.request(method, BASE + path, json=body, timeout=(15, 120))
        except requests.RequestException as e:
            if a == tries - 1: raise RuntimeError(f"{method} {path} network: {type(e).__name__}")
            time.sleep(min(60, 2 ** a * 3)); continue
        if r.status_code == 429 or r.status_code >= 500:
            if a == tries - 1: raise RuntimeError(f"{method} {path} -> {r.status_code} {r.text[:400]}")
            ra = r.headers.get("Retry-After")
            time.sleep(float(ra) if ra and ra.isdigit() else min(90, 2 ** a * 5 + random.random())); continue
        if not r.ok:
            raise RuntimeError(f"{method} {path} -> {r.status_code} {r.text[:800]}")
        return r.json()

def upload(path: Path, key: str) -> str:
    ups = jload("uploads.json", {})
    if key in ups: return ups[key]["id"]
    res = api("POST", "/uploads/images.json", {"file_name": f"freeplug-shop-{key}.png", "contents": base64.b64encode(path.read_bytes()).decode()})
    ups[key] = {"id": res["id"], "file_name": res.get("file_name"), "path": str(path)}
    jsave("uploads.json", ups)
    return res["id"]

LIGHT = {"white","ivory","natural","cream","light ash","ash","heather","athletic heather","sand","beige","light grey","light gray","pink","baby pink","yellow","gold","orange","carolina blue","kelly","light blue"}
DARK = {"black","charcoal","navy","dark navy","dark heather","black heather","dark grey","dark gray","cranberry","maroon","forest","olive","brown","classic navy","j. navy"}
def ink_for_color(color):
    if not color: return "dark"
    c = color.lower()
    if any(d in c for d in DARK): return "light"
    return "dark"

def chunks_for(item, limit=100):
    vmeta = {v["id"]: v for v in json.load(open(VARIANTS / f"{item['blueprint_id']}_{item['provider_id']}.json"))["variants"]}
    vids = item["variant_ids"]
    if len(vids) <= limit: return [vids]
    by = {}
    for v in vids: by.setdefault((vmeta[v].get("options") or {}).get("color"), []).append(v)
    out, cur = [], []
    for color, vs in by.items():
        if len(vs) > limit:
            for i in range(0, len(vs), limit): out.append(vs[i:i+limit])
            continue
        if len(cur) + len(vs) > limit: out.append(cur); cur = []
        cur = cur + vs
    if cur: out.append(cur)
    return out

def build_body(item, title, ids):
    vmeta = {v["id"]: v for v in json.load(open(VARIANTS / f"{item['blueprint_id']}_{item['provider_id']}.json"))["variants"]}
    pa = item["print_area"]; pos = pa.get("position") or {}
    groups = {"light": [], "dark": []}
    for vid in item["variant_ids"]:
        color = (vmeta[vid].get("options") or {}).get("color")
        ink = item["logo_by_color"].get(color) if color else None
        if ink not in ("light", "dark"): ink = ink_for_color(color)
        groups[ink].append(vid)
    areas = []
    for ink, vids in groups.items():
        if not vids: continue
        ph = next(p for p in vmeta[vids[0]]["placeholders"] if p["position"] == pa["place"])
        placeholder = {"position": pa["place"], "images": [{"id": ids[ink], "x": pos.get("x", 0.5), "y": pos.get("y", 0.5), "scale": pos.get("scale", 0.5), "angle": 0}]}
        if ph.get("decoration_method"): placeholder["decoration_method"] = ph["decoration_method"]
        areas.append({"variant_ids": vids, "placeholders": [placeholder]})
    prices = item["retail_cents_by_variant"]
    return {
        "title": f"Freeplug {title}"[:200],
        "description": f"Freeplug logo {title}. Made to order.",
        "blueprint_id": item["blueprint_id"], "print_provider_id": item["provider_id"], "visible": False,
        "variants": [{"id": v, "price": int(prices[str(v)]), "is_enabled": True} for v in item["variant_ids"]],
        "print_areas": areas, "tags": ["Freeplug", "Shop"],
    }

def main():
    only = sys.argv[1:]
    plan = json.load(open(PLAN))["items"]
    titles = {i["slug"]: i["title"] for i in json.load(open(CATALOG))["items"]}
    ids = {"light": upload(LOGO_LIGHT_INK, "logo-light-ink"), "dark": upload(LOGO_DARK_INK, "logo-dark-ink")}
    for item in plan:
        slug = item["slug"]
        if only and slug not in only: continue
        state = jload("created-products.json", {})
        if slug in state: print("SKIP", slug, flush=True); continue
        try:
            parts = chunks_for(item)
            prog = jload("partial.json", {}).get(slug, [])
            for n, vids in enumerate(parts):
                if n < len(prog): continue
                sub = dict(item, variant_ids=vids)
                t = titles.get(slug, slug)
                body = build_body(sub, t if len(parts) == 1 else f"{t} ({n+1} of {len(parts)})", ids)
                res = api("POST", SHOP + ".json", body)
                pid = res["id"]
                if res.get("visible") is not False:
                    api("PUT", SHOP + f"/{pid}.json", {"visible": False})
                want = set(vids)
                stray = [v for v in res.get("variants", []) if v.get("is_enabled") and v["id"] not in want]
                if stray:
                    api("PUT", SHOP + f"/{pid}.json", {"visible": False, "variants": [{"id": v["id"], "price": v["price"], "is_enabled": v["id"] in want} for v in res["variants"]]})
                prog.append({"id": pid, "variant_ids": vids})
                p = jload("partial.json", {}); p[slug] = prog; jsave("partial.json", p)
                time.sleep(0.7)
            state = jload("created-products.json", {})
            state[slug] = {"id": prog[0]["id"], "parts": prog, "blueprint": item["blueprint_id"], "provider": item["provider_id"], "created_at": time.strftime("%Y-%m-%dT%H:%M:%S%z")}
            jsave("created-products.json", state)
            fails = jload("failures.json", {}); fails.pop(slug, None); jsave("failures.json", fails)
            print("CREATED", slug, [x["id"] for x in prog], len(item["variant_ids"]), flush=True)
        except Exception as e:
            fails = jload("failures.json", {}); fails[slug] = str(e)[:900]; jsave("failures.json", fails)
            print("FAIL", slug, str(e)[:300], flush=True)
        time.sleep(0.7)

if __name__ == "__main__":
    main()
