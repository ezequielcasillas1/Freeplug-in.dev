#!/usr/bin/env python3
"""Read-only: GET each created draft, verify hidden, collect mockups per color, write printify-products.filled.json."""
import os, json, time
from pathlib import Path
import requests
HERE = Path(__file__).resolve().parent
PLAN = Path("/workspace/shopdraft/repo/docs/merch-research/SHOP-DRAFT-PLAN.json")
BASE_MAP = Path("/workspace/shopdraft/repo/freeplug-landing/src/lib/merch/shop/printify-products.json")
VARIANTS = Path("/workspace/logos/freeplug/merch/shop-build/variants")
S = requests.Session()
S.headers.update({"Authorization": "Bearer " + os.environ["PRINTIFY_API_TOKEN"], "User-Agent": "Freeplug-Shop-Hidden-Drafts"})
def get(pid):
    for a in range(6):
        try:
            r = S.get(f"https://api.printify.com/v1/shops/29664778/products/{pid}.json", timeout=(15, 90))
            if r.status_code == 429 or r.status_code >= 500: time.sleep(5 * 2 ** a); continue
            r.raise_for_status(); return r.json()
        except requests.RequestException:
            time.sleep(5 * 2 ** a)
    raise RuntimeError(f"GET {pid} failed")
state = json.load(open(HERE / "created-products.json"))
cache = json.load(open(HERE / "product-cache.json")) if (HERE / "product-cache.json").exists() else {}
plan = {i["slug"]: i for i in json.load(open(PLAN))["items"]}
base = json.load(open(BASE_MAP))
out = {"bySlug": {}}
verify = {"hidden": 0, "not_hidden": [], "published_or_locked": [], "no_mockups": []}
for slug, row in base["bySlug"].items():
    entry = dict(row)
    st = state.get(slug)
    if not st:
        out["bySlug"][slug] = entry; continue
    vmeta = {v["id"]: v for v in json.load(open(VARIANTS / f"{row['blueprintId']}_{row['providerId']}.json"))["variants"]}
    prices = plan[slug]["retail_cents_by_variant"]
    variants, mock, pid_by_var = [], {}, {}
    for part in st["parts"]:
        p = get(part["id"]); cache[part["id"]] = {"visible": p.get("visible"), "is_locked": p.get("is_locked"), "external": p.get("external"), "images": len(p.get("images", []))}
        if p.get("visible") is False: verify["hidden"] += 1
        else: verify["not_hidden"].append(part["id"])
        if p.get("is_locked") or p.get("external"): verify["published_or_locked"].append(part["id"])
        enabled = {v["id"]: v for v in p["variants"] if v.get("is_enabled")}
        color_of = {}
        for vid in part["variant_ids"]:
            o = vmeta.get(vid, {}).get("options") or {}
            color_of[vid] = o.get("color")
            pid_by_var[str(vid)] = part["id"]
            ev = enabled.get(vid)
            variants.append({"id": vid, "printifyProductId": part["id"], "color": o.get("color"), "size": o.get("size"),
                             "title": (ev or {}).get("title") or vmeta.get(vid, {}).get("title"),
                             "priceCents": (ev or {}).get("price", int(prices[str(vid)])), "enabled": ev is not None})
        for im in p.get("images", []):
            colors = {color_of[v] for v in im.get("variant_ids", []) if v in color_of}
            for c in colors:
                k = c or "default"
                lst = mock.setdefault(k, [])
                if im["src"] not in lst and len(lst) < 6:
                    (lst.insert(0, im["src"]) if im.get("is_default") else lst.append(im["src"]))
    if not mock: verify["no_mockups"].append(slug)
    entry.update({"printifyProductId": st["parts"][0]["id"], "printifyProductIds": [x["id"] for x in st["parts"]],
                  "productIdByVariant": pid_by_var, "variants": variants, "mockupsByColor": mock})
    out["bySlug"][slug] = entry
json.dump(out, open(HERE / "printify-products.filled.json", "w"), indent=2)
json.dump(cache, open(HERE / "product-cache.json", "w"), indent=1)
json.dump(verify, open(HERE / "verification.json", "w"), indent=2)
print(json.dumps({k: (v if isinstance(v, int) else len(v)) for k, v in verify.items()}), "filled", sum(1 for v in out["bySlug"].values() if v.get("printifyProductId")))
