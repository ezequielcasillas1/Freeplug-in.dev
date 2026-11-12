#!/usr/bin/env python3
"""Create hidden Printify drafts for Freeplug wave-3. visible:false only. No publish."""
from __future__ import annotations
import os, json, re, base64, sys, hashlib
from pathlib import Path
from typing import Any
import requests
from PIL import Image

Image.MAX_IMAGE_PIXELS = 250_000_000

ROOT = Path("/workspace/logos/freeplug/merch")
WAVE = ROOT / "wave-3"
WORK = ROOT / "printify-work" / "wave3"
CACHE = WAVE / "_api_cache"
READY = WAVE / "printify-ready"
WORK.mkdir(parents=True, exist_ok=True)
READY.mkdir(parents=True, exist_ok=True)

SHOP = "/shops/29664778/products"
UA = "Freeplug-Wave3-Hidden-Drafts"
TOKEN = os.environ["PRINTIFY_API_TOKEN"]
assert TOKEN and len(TOKEN) > 20

session = requests.Session()
session.headers.update({"Authorization": "Bearer " + TOKEN, "User-Agent": UA, "Content-Type": "application/json"})

LIGHT = {"white","ivory","natural","cream","light ash","ash","heather","athletic heather","sand","beige","light grey","light gray","pink","baby pink","yellow","gold","orange","carolina blue","kelly","light blue","mushroom","khaki","sport grey","light pink","heliconia","grey","gray","blue"}
DARK = {"black","charcoal","navy","dark navy","dark heather","black heather","dark grey","dark gray","cranberry","maroon","forest","olive","brown","classic navy","j. navy","navy blue","storm","asphalt","cardinal","heather forest","graphite heather","military green","purple","royal","coal","alpine green","steel","forest green"}

def save(name: str, data: Any) -> None:
    (WORK / name).write_text(json.dumps(data, indent=2))

def api(method: str, path: str, body: dict | None = None) -> dict:
    allowed_post = path in ["/uploads/images.json", SHOP + ".json"]
    allowed_getput = bool(re.fullmatch(SHOP + r"/[a-f0-9]+\.json", path))
    assert (method == "POST" and allowed_post) or (method in ["GET", "PUT"] and allowed_getput)
    if method in ["POST", "PUT"] and path != "/uploads/images.json":
        assert body is not None and body.get("visible") is False
    r = session.request(method, "https://api.printify.com/v1" + path, json=body, timeout=180)
    if not r.ok:
        raise RuntimeError(f"{method} {path} -> {r.status_code} {r.text[:1200]}")
    return r.json()

def get_catalog(bp: int, pv: int) -> list[dict]:
    p = CACHE / f"catalog_blueprints_{bp}_print_providers_{pv}_variants.json.json"
    if not p.exists():
        r = session.get(f"https://api.printify.com/v1/catalog/blueprints/{bp}/print_providers/{pv}/variants.json", timeout=90)
        r.raise_for_status(); p.write_text(r.text)
    return json.loads(p.read_text())["variants"]

def color_bucket(color: str | None) -> str | None:
    if not color: return None
    c = color.strip().lower()
    if "dark heather" in c or "black heather" in c or "graphite heather" in c: return "dark"
    for d in sorted(DARK, key=len, reverse=True):
        if c == d or d in c:
            if d == "heather" and any(x in c for x in ("dark","black","graphite")): continue
            return "dark"
    for L in sorted(LIGHT, key=len, reverse=True):
        if c == L or L in c:
            if L == "heather" and any(x in c for x in ("dark","black","graphite")): return "dark"
            return "light"
    if any(x in c for x in ("navy","black","charcoal")): return "dark"
    if any(x in c for x in ("white","sand","ash","pink")): return "light"
    return None

def ensure_size(src: Path, width: int, height: int, dest: Path) -> Path:
    dest.parent.mkdir(parents=True, exist_ok=True)
    im = Image.open(src).convert("RGBA")
    if im.size == (width, height):
        if not dest.exists(): im.save(dest, "PNG", optimize=True)
        return dest
    im.resize((width, height), Image.Resampling.LANCZOS).save(dest, "PNG", optimize=True)
    return dest

uploads_path = WORK / "uploads.json"
uploads: dict = json.loads(uploads_path.read_text()) if uploads_path.exists() else {}

def upload_file(path: Path) -> str:
    key = str(path.resolve())
    if key in uploads: return uploads[key]["id"]
    data = path.read_bytes()
    h = hashlib.sha1(data[:65536] + str(path.stat().st_size).encode()).hexdigest()[:10]
    fname = f"freeplug-w3-{path.stem[:40]}-{h}.png"
    result = api("POST", "/uploads/images.json", {"file_name": fname, "contents": base64.b64encode(data).decode()})
    uploads[key] = {"id": result["id"], "file_name": fname, "path": key}
    save("uploads.json", uploads)
    return result["id"]

def ph_for(variant: dict, position: str) -> dict:
    return next(x for x in variant["placeholders"] if x["position"] == position)

def make_image_ref(image_id: str) -> dict:
    return {"id": image_id, "x": 0.5, "y": 0.5, "scale": 1, "angle": 0}

ROWS = json.load(open(WAVE / "price-check-rows.json"))["rows"]
ROW_BY = {r["slug"]: r for r in ROWS}

def art_path(cat: str, slug: str, name: str) -> Path:
    return WAVE / cat / slug / name

def prepared(slug: str, name: str, w: int, h: int, src: Path) -> Path:
    dest = READY / slug / f"{Path(name).stem}-{w}x{h}.png"
    return ensure_size(src, w, h, dest)

def build_print_areas(variant_specs):
    areas = []
    for vid, placements in variant_specs:
        placeholders = []
        for pos, method, path in placements:
            placeholders.append({"position": pos, "decoration_method": method, "images": [make_image_ref(upload_file(path))]})
        same = next((a for a in areas if a["placeholders"] == placeholders), None)
        if same: same["variant_ids"].append(vid)
        else: areas.append({"variant_ids": [vid], "placeholders": placeholders})
    return areas

def load_state():
    p = WORK / "created-products.json"
    return json.loads(p.read_text()) if p.exists() else []

def save_state(state):
    save("created-products.json", state)

def create_product(key, title, description, blueprint, provider, variant_price, variant_specs, tags=None):
    state = load_state()
    if any(e["key"] == key for e in state):
        print(f"SKIP exists {key}", flush=True)
        return next(e for e in state if e["key"] == key)
    if not variant_specs:
        raise RuntimeError(f"No variants for {key}")
    areas = build_print_areas(variant_specs)
    body = {
        "title": title, "description": description, "blueprint_id": blueprint,
        "print_provider_id": provider, "visible": False,
        "variants": [{"id": vid, "price": int(variant_price[vid]), "is_enabled": True} for vid, _ in variant_specs],
        "print_areas": areas, "tags": tags or ["Freeplug", "Merch", "Wave3"],
    }
    save(f"{key}-create-payload.json", body)
    result = api("POST", SHOP + ".json", body)
    save(f"{key}-created.json", result)
    if result.get("visible") is not False:
        raise RuntimeError(f"STOP: visible:false not honored for {key}")
    enabled_ids = {vid for vid, _ in variant_specs}
    price_update = [{"id": vid, "price": int(variant_price[vid]), "is_enabled": True} for vid, _ in variant_specs]
    for v in result.get("variants", []):
        if v["id"] not in enabled_ids:
            price_update.append({"id": v["id"], "price": int(variant_price.get(v["id"], 9999)), "is_enabled": False})
    api("PUT", SHOP + f"/{result['id']}.json", {"visible": False, "variants": price_update})
    final = api("GET", SHOP + f"/{result['id']}.json")
    save(f"{key}-final.json", final)
    assert final.get("visible") is False
    assert not final.get("is_locked")
    assert not final.get("external")
    enabled = [v for v in final["variants"] if v.get("is_enabled")]
    price_issues = []
    for v in enabled:
        expected = variant_price.get(v["id"])
        if expected is not None and int(v["price"]) != int(expected):
            price_issues.append({"id": v["id"], "got": v["price"], "expected": expected})
    entry = {
        "key": key, "id": final["id"], "title": title, "blueprint": blueprint, "provider": provider,
        "visible": False,
        "enabled_variants": [{"id": v["id"], "title": v["title"], "price": v["price"], "cost": v.get("cost"), "options": v.get("options")} for v in enabled],
        "price_ok": not price_issues, "price_issues": price_issues,
        "images": [{"src": im.get("src"), "variant_ids": im.get("variant_ids"), "position": im.get("position")} for im in final.get("images", [])[:12]],
        "image_count": len(final.get("images", [])),
    }
    state.append(entry); save_state(state)
    print(f"CREATED {key} {entry['id']} variants={len(enabled)} price_ok={entry['price_ok']}", flush=True)
    return entry

def pick_by_colors(catalog, want_light, sizes=None):
    out = []
    for v in catalog:
        opts = v.get("options") or {}
        color = opts.get("color"); size = opts.get("size")
        if sizes is not None and size not in sizes and str(size) not in sizes: continue
        if want_light is None: out.append(v); continue
        if color is None: out.append(v); continue
        bucket = color_bucket(color)
        if want_light and bucket == "light": out.append(v)
        elif (not want_light) and bucket == "dark": out.append(v)
    return out

def variants_for(bp, pv):
    return get_catalog(bp, pv)


def jobs():
    J = []
    def add(key, title, desc, bp, pv, builder):
        J.append({"key": key, "title": title, "description": desc, "blueprint": bp, "provider": pv, "builder": builder})

    def b_pullover():
        price = 6499; cat = variants_for(2001, 29); sizes = {"S","M","L","XL","2XL","3XL"}; specs=[]; prices={}
        for want_light, front_name, back_name in [(True,"front-light-garment.png","back-light-garment.png"),(False,"front-dark-garment.png","back-dark-garment.png")]:
            for v in pick_by_colors(cat, want_light, sizes):
                fph=ph_for(v,"front"); bph=ph_for(v,"back")
                fp=prepared("stay-charged-pullover", front_name, fph["width"], fph["height"], art_path("apparel","stay-charged-pullover",front_name))
                bp_=prepared("stay-charged-pullover", back_name, bph["width"], bph["height"], art_path("apparel","stay-charged-pullover",back_name))
                specs.append((v["id"], [("front", fph["decoration_method"], fp), ("back", bph["decoration_method"], bp_)]))
                prices[v["id"]] = price
        return prices, specs
    add("stay-charged-pullover","Freeplug Stay Charged Pullover Hoodie","Stay Charged. A heavyweight pullover hoodie with the Freeplug mark on the chest and a battery-bar graphic on the back.",2001,29,b_pullover)

    def b_zip():
        price=6599; cat=variants_for(1925,99); sizes={"S","M","L","XL","2XL"}; specs=[]; prices={}
        for want_light, fname in [(True,"left-chest-embroidery-light-garment.png"),(False,"left-chest-embroidery-dark-garment.png")]:
            for v in pick_by_colors(cat, want_light, sizes):
                try: eph=ph_for(v,"front_left_chest")
                except StopIteration: continue
                if eph.get("decoration_method") != "embroidery": continue
                path=prepared("day-one-zip", fname, eph["width"], eph["height"], art_path("apparel","day-one-zip",fname))
                specs.append((v["id"], [("front_left_chest","embroidery",path)])); prices[v["id"]]=price
        return prices, specs
    add("day-one-zip","Freeplug Plugged In Since Day One Zip Hoodie","Plugged In Since Day One. A fleece zip-up hoodie with left-chest embroidery of the Freeplug mark. Embroidery is digitized after the first order; a physical sample is recommended before selling.",1925,99,b_zip)

    def b_longsleeve():
        price=3399; cat=variants_for(41,29); sizes={"S","M","L","XL","2XL"}; specs=[]; prices={}
        for want_light, fname in [(True,"front-light-garment.png"),(False,"front-dark-garment.png")]:
            for v in pick_by_colors(cat, want_light, sizes):
                col=((v.get("options") or {}).get("color") or "").lower()
                if col in {"red","cardinal"}: continue
                fph=ph_for(v,"front")
                path=prepared("good-measure-longsleeve", fname, fph["width"], fph["height"], art_path("apparel","good-measure-longsleeve",fname))
                specs.append((v["id"], [("front", fph["decoration_method"], path)])); prices[v["id"]]=price
        return prices, specs
    add("good-measure-longsleeve","Freeplug Good Measure Long Sleeve Tee","Good Measure. Unisex jersey long-sleeve tee with Luke 6:38 artwork on the front (King James Version). Front print only.",41,29,b_longsleeve)

    def b_joggers():
        price=4799; cat=variants_for(1903,410); sizes={"S","M","L","XL","2XL"}; specs=[]; prices={}
        for want_light, fname in [(True,"thigh-embroidery-light-garment.png"),(False,"thigh-embroidery-dark-garment.png")]:
            for v in pick_by_colors(cat, want_light, sizes):
                eph=ph_for(v,"front_apparel_embroidery")
                path=prepared("hustle-joggers", fname, eph["width"], eph["height"], art_path("apparel","hustle-joggers",fname))
                specs.append((v["id"], [("front_apparel_embroidery","embroidery",path)])); prices[v["id"]]=price
        return prices, specs
    add("hustle-joggers","Freeplug Low Battery High Hustle Joggers","Low Battery, High Hustle. Unisex joggers with thigh embroidery. Embroidery is digitized after the first order; a physical sample is recommended before selling.",1903,410,b_joggers)

    def b_socks():
        price=1299; cat=variants_for(376,1); specs=[]; prices={}
        src=art_path("accessories","charged-socks","leg-panel.png")
        for v in cat:
            size=(v.get("options") or {}).get("size")
            if size not in {"M","L"}: continue
            placements=[]
            for pos in ["front_left_leg","front_right_leg","back_left_leg","back_right_leg"]:
                ph=ph_for(v,pos)
                path=prepared("charged-socks", f"leg-{size}-{pos}.png", ph["width"], ph["height"], src)
                placements.append((pos, ph["decoration_method"], path))
            specs.append((v["id"], placements)); prices[v["id"]]=price
        return prices, specs
    add("charged-socks","Freeplug Fully Charged Feet Socks","Fully Charged Feet. Sublimation socks with an all-over plug and lightning pattern.",376,1,b_socks)

    def b_gaiter():
        price=2299; cat=variants_for(970,99); specs=[]; prices={}
        src=art_path("accessories","fp-gaiter","front.png")
        for v in cat:
            placements=[]
            for pos in ["front","back"]:
                try: ph=ph_for(v,pos)
                except StopIteration: continue
                path=prepared("fp-gaiter", f"{pos}.png", ph["width"], ph["height"], src)
                placements.append((pos, ph["decoration_method"], path))
            if placements:
                specs.append((v["id"], placements)); prices[v["id"]]=price
        return prices, specs
    add("fp-gaiter","Freeplug FP Circle Neck Gaiter","A midweight neck gaiter with a repeating Freeplug circle pattern.",970,99,b_gaiter)

    for design, slogan in [("fp-mark","FP Mark"),("plug","Plug"),("bolt","Bolt")]:
        def make_pin(design=design):
            def b():
                price=399; cat=variants_for(430,1); specs=[]; prices={}
                src=art_path("accessories","pin-set",f"{design}.png")
                for v in cat:
                    if (v.get("options") or {}).get("size") != '1.25"': continue
                    ph=ph_for(v,"front")
                    path=prepared(f"pin-{design}","front.png", ph["width"], ph["height"], src)
                    specs.append((v["id"], [("front", ph["decoration_method"], path)])); prices[v["id"]]=price
                return prices, specs
            return b
        add(f"pin-{design}", f"Freeplug {slogan} Pin Button", f"A 1.25 inch Freeplug {slogan} pin button. Sold individually.", 430, 1, make_pin())

    def b_tote():
        price=3699; cat=variants_for(553,217); specs=[]; prices={}
        for want_light, fname in [(True,"front-light-garment.png"),(False,"front-dark-garment.png")]:
            for v in pick_by_colors(cat, want_light, None):
                try: ph=ph_for(v,"front")
                except StopIteration: ph=ph_for(v,"front_dtf")
                path=prepared("carry-tote", fname, ph["width"], ph["height"], art_path("bags","carry-tote",fname))
                specs.append((v["id"], [(ph["position"], ph["decoration_method"], path)])); prices[v["id"]]=price
        return prices, specs
    add("carry-tote","Freeplug Carry the Connection Tote","Carry the Connection. A cotton tote bag with Freeplug artwork on the front.",553,217,b_tote)

    def b_drawstring():
        price=5599; cat=variants_for(414,10); specs=[]; prices={}
        src=art_path("bags","gym-drawstring","front.png")
        for v in cat:
            ph=ph_for(v,"front"); path=prepared("gym-drawstring","front.png", ph["width"], ph["height"], src)
            specs.append((v["id"], [("front", ph["decoration_method"], path)])); prices[v["id"]]=price
        return prices, specs
    add("gym-drawstring","Freeplug Gym Plug Drawstring Bag","Gym Plug. A drawstring bag with Freeplug artwork.",414,10,b_drawstring)

    def b_backpack():
        price=7999; cat=variants_for(413,10); specs=[]; prices={}
        src=art_path("bags","charger-backpack","front.png"); strap=art_path("bags","charger-backpack","strap-top.png")
        for v in cat:
            placements=[]; ph=ph_for(v,"front")
            path=prepared("charger-backpack","front.png", ph["width"], ph["height"], src)
            placements.append(("front", ph["decoration_method"], path))
            try:
                sph=ph_for(v,"top_part_to_front")
                if strap.exists():
                    sp=prepared("charger-backpack","strap-top.png", sph["width"], sph["height"], strap)
                    placements.append(("top_part_to_front", sph["decoration_method"], sp))
            except StopIteration: pass
            specs.append((v["id"], placements)); prices[v["id"]]=price
        return prices, specs
    add("charger-backpack","Freeplug Charger Not Included Backpack","Charger Not Included. A backpack with a Freeplug mark on the front.",413,10,b_backpack)

    def b_fanny():
        price=4399; cat=variants_for(468,10); specs=[]; prices={}
        src=art_path("bags","pocket-fanny","front.png")
        for v in cat:
            ph=ph_for(v,"front"); path=prepared("pocket-fanny","front.png", ph["width"], ph["height"], src)
            specs.append((v["id"], [("front", ph["decoration_method"], path)])); prices[v["id"]]=price
        return prices, specs
    add("pocket-fanny","Freeplug Pocket Plug Fanny Pack","Pocket Plug. A fanny pack with Freeplug artwork.",468,10,b_fanny)


    def b_blanket():
        cat=variants_for(522,1); specs=[]; prices={}
        src=art_path("home-living","recharge-blanket","front.png")
        size_price={'30" × 40"':2699,'50" × 60"':4299}
        for v in cat:
            size=(v.get("options") or {}).get("size")
            if size not in size_price: continue
            ph=ph_for(v,"front"); path=prepared("recharge-blanket", f"front-{size}.png", ph["width"], ph["height"], src)
            specs.append((v["id"], [("front", ph["decoration_method"], path)])); prices[v["id"]]=size_price[size]
        return prices, specs
    add("recharge-blanket","Freeplug Recharge Mode Throw Blanket","Recharge Mode. A velveteen plush blanket with a sleepy battery graphic.",522,1,b_blanket)

    def b_clock():
        price=5399; cat=variants_for(277,1); specs=[]; prices={}
        src=art_path("home-living","plug-clock","front.png")
        for v in cat:
            opts=v.get("options") or {}; title=v.get("title","")
            if "10" not in title and "10" not in str(opts.get("size","")): continue
            if "Black" not in title and str(opts.get("color","")).lower() not in ("black",""): 
                if "black" not in title.lower(): continue
            ph=ph_for(v,"front"); path=prepared("plug-clock","front.png", ph["width"], ph["height"], src)
            specs.append((v["id"], [("front", ph["decoration_method"], path)])); prices[v["id"]]=price
        if not specs:
            for v in cat[:1]:
                ph=ph_for(v,"front"); path=prepared("plug-clock","front.png", ph["width"], ph["height"], src)
                specs.append((v["id"], [("front", ph["decoration_method"], path)])); prices[v["id"]]=price
        return prices, specs
    add("plug-clock","Freeplug Plug Time Wall Clock","Plug Time. A wall clock with Freeplug bolts at 12, 3, 6 and 9.",277,1,b_clock)

    def b_curtain():
        price=7399; cat=variants_for(235,10); specs=[]; prices={}
        src=art_path("home-living","rinse-curtain","front.png")
        for v in cat:
            ph=ph_for(v,"front"); path=prepared("rinse-curtain","front.png", ph["width"], ph["height"], src)
            specs.append((v["id"], [("front", ph["decoration_method"], path)])); prices[v["id"]]=price
        return prices, specs
    add("rinse-curtain","Freeplug Rinse Recharge Repeat Shower Curtain","Rinse, Recharge, Repeat. A shower curtain with Freeplug artwork.",235,10,b_curtain)

    def b_cutting():
        cat=variants_for(938,92); specs=[]; prices={}
        src=art_path("kitchen","plugged-cutting-board","front.png")
        size_price={'8" x 11"':2799,'11" x 15"':3899}
        for v in cat:
            matched=None
            size=(v.get("options") or {}).get("size") or ""
            for sk in size_price:
                if sk in size or sk in v["title"]: matched=sk; break
            if not matched: continue
            ph=ph_for(v,"front"); path=prepared("plugged-cutting-board", f"front-{matched}.png", ph["width"], ph["height"], src)
            specs.append((v["id"], [("front", ph["decoration_method"], path)])); prices[v["id"]]=size_price[matched]
        return prices, specs
    add("plugged-cutting-board","Freeplug Plugged-In Kitchen Cutting Board","Plugged-In Kitchen. A glass cutting board with Freeplug artwork.",938,92,b_cutting)

    for design, label in [("fp","FP Mark"),("plug","Plug"),("bolt","Bolt"),("charged","Charged")]:
        def make_coaster(design=design):
            def b():
                price=3699; cat=variants_for(2764,59); specs=[]; prices={}
                src=art_path("kitchen","coaster-set",f"{design}.png")
                for v in cat:
                    ph=ph_for(v,"front"); path=prepared(f"coaster-{design}","front.png", ph["width"], ph["height"], src)
                    specs.append((v["id"], [("front", ph["decoration_method"], path)])); prices[v["id"]]=price
                return prices, specs
            return b
        add(f"coaster-{design}", f"Freeplug {label} Coaster Set", f"A set of 4 hardboard coasters with the Freeplug {label} design.", 2764, 59, make_coaster())

    def b_pint():
        price=2399; cat=variants_for(633,86); specs=[]; prices={}
        src=art_path("drinkware","recharge-pint","front.png")
        for v in cat:
            ph=ph_for(v,"front"); path=prepared("recharge-pint","front.png", ph["width"], ph["height"], src)
            specs.append((v["id"], [("front", ph["decoration_method"], path)])); prices[v["id"]]=price
        return prices, specs
    add("recharge-pint","Freeplug Recharge Station Pint Glass","Recharge Station. A 16oz pint glass with Freeplug artwork.",633,86,b_pint)

    def b_cancooler():
        price=899; cat=variants_for(951,92); specs=[]; prices={}
        src=art_path("drinkware","cool-can-cooler","front.png")
        for v in cat:
            ph=ph_for(v,"front"); path=prepared("cool-can-cooler", f"front-{v['id']}.png", ph["width"], ph["height"], src)
            specs.append((v["id"], [("front", ph["decoration_method"], path)])); prices[v["id"]]=price
        return prices, specs
    add("cool-can-cooler","Freeplug Keep It Cool Can Cooler","Keep It Cool, Keep It Plugged. A Freeplug can cooler.",951,92,b_cancooler)

    def b_wine():
        price=3299; cat=variants_for(620,86); specs=[]; prices={}
        for want_light, fname in [(True,"front-light-garment.png"),(False,"front-dark-garment.png")]:
            for v in pick_by_colors(cat, want_light, None):
                ph=ph_for(v,"front"); path=prepared("unplugged-wine", fname, ph["width"], ph["height"], art_path("drinkware","unplugged-wine",fname))
                specs.append((v["id"], [("front", ph["decoration_method"], path)])); prices[v["id"]]=price
        for v in cat:
            if v["id"] in prices: continue
            bucket=color_bucket((v.get("options") or {}).get("color"))
            fname="front-light-garment.png" if bucket=="light" else "front-dark-garment.png"
            ph=ph_for(v,"front"); path=prepared("unplugged-wine", fname, ph["width"], ph["height"], art_path("drinkware","unplugged-wine",fname))
            specs.append((v["id"], [("front", ph["decoration_method"], path)])); prices[v["id"]]=price
        return prices, specs
    add("unplugged-wine","Freeplug Unplugged Hours Wine Tumbler","Unplugged Hours. A 12oz wine tumbler with Freeplug artwork.",620,86,b_wine)


    def b_bandana():
        cat=variants_for(562,70); specs=[]; prices={}
        src=art_path("pets","good-boy-bandana","front.png")
        size_price={'20" × 10"':2599,'27" × 13"':2999}
        for v in cat:
            size=(v.get("options") or {}).get("size")
            if size not in size_price: continue
            ph=ph_for(v,"front"); path=prepared("good-boy-bandana", f"front-{size}.png", ph["width"], ph["height"], src)
            specs.append((v["id"], [("front", ph["decoration_method"], path)])); prices[v["id"]]=size_price[size]
        return prices, specs
    add("good-boy-bandana","Freeplug Good Boy Fully Charged Pet Bandana","Good Boy Fully Charged. A pet bandana with Freeplug artwork.",562,70,b_bandana)

    def b_bowl():
        price=4599; cat=variants_for(570,70); specs=[]; prices={}
        src=art_path("pets","fuel-bowl","front.png")
        for v in cat:
            ph=ph_for(v,"front"); path=prepared("fuel-bowl","front.png", ph["width"], ph["height"], src)
            specs.append((v["id"], [("front", ph["decoration_method"], path)])); prices[v["id"]]=price
        return prices, specs
    add("fuel-bowl","Freeplug Fuel Station Pet Bowl","Fuel Station. A pet bowl with Freeplug artwork.",570,70,b_bowl)

    def b_petbed():
        cat=variants_for(419,10); specs=[]; prices={}
        src=art_path("pets","recharge-pet-bed","front.png")
        for v in cat:
            if (v.get("options") or {}).get("size") != '28" × 18"': continue
            ph=ph_for(v,"front"); path=prepared("recharge-pet-bed","front.png", ph["width"], ph["height"], src)
            specs.append((v["id"], [("front", ph["decoration_method"], path)])); prices[v["id"]]=5399
        return prices, specs
    add("recharge-pet-bed","Freeplug Recharge Zone Pet Bed","Recharge Zone. A pet bed with Freeplug artwork. 28 by 18 inches.",419,10,b_petbed)

    def b_dogtee():
        price=4199; cat=variants_for(571,70); specs=[]; prices={}
        for want_light, fname in [(True,"front-light-garment.png"),(False,"front-dark-garment.png")]:
            for v in pick_by_colors(cat, want_light, None):
                ph=ph_for(v,"front"); path=prepared("human-knows-dog-tee", fname, ph["width"], ph["height"], art_path("pets","human-knows-dog-tee",fname))
                specs.append((v["id"], [("front", ph["decoration_method"], path)])); prices[v["id"]]=price
        return prices, specs
    add("human-knows-dog-tee","Freeplug My Human Knows a Plug Pet Tank","My Human Knows a Plug. A pet tank top with Freeplug artwork.",571,70,b_dogtee)

    def b_onesie():
        price=2599; cat=variants_for(568,39); specs=[]; prices={}
        for want_light, fname in [(True,"front-light-garment.png"),(False,"front-dark-garment.png")]:
            for v in pick_by_colors(cat, want_light, None):
                ph=ph_for(v,"front"); path=prepared("newest-onesie", fname, ph["width"], ph["height"], art_path("kids-baby","newest-onesie",fname))
                specs.append((v["id"], [("front", ph["decoration_method"], path)])); prices[v["id"]]=price
        return prices, specs
    add("newest-onesie","Freeplug Newest Plug Baby Onesie","Newest Plug. A baby short-sleeve onesie with Freeplug artwork.",568,39,b_onesie)

    def b_toddler():
        price=1999; cat=variants_for(580,39); specs=[]; prices={}
        for want_light, fname in [(True,"front-light-garment.png"),(False,"front-dark-garment.png")]:
            for v in pick_by_colors(cat, want_light, None):
                col=((v.get("options") or {}).get("color") or "").lower()
                if col in {"red","cardinal"}: continue
                ph=ph_for(v,"front"); path=prepared("mini-plug-tee", fname, ph["width"], ph["height"], art_path("kids-baby","mini-plug-tee",fname))
                specs.append((v["id"], [("front", ph["decoration_method"], path)])); prices[v["id"]]=price
        return prices, specs
    add("mini-plug-tee","Freeplug Mini Plug Toddler Tee","Mini Plug. A toddler short-sleeve tee with Freeplug artwork.",580,39,b_toddler)

    def b_kidshoodie():
        price=3999; cat=variants_for(314,29); specs=[]; prices={}
        for want_light, fname in [(True,"front-light-garment.png"),(False,"front-dark-garment.png")]:
            for v in pick_by_colors(cat, want_light, None):
                ph=ph_for(v,"front"); path=prepared("charging-kids-hoodie", fname, ph["width"], ph["height"], art_path("kids-baby","charging-kids-hoodie",fname))
                specs.append((v["id"], [("front", ph["decoration_method"], path)])); prices[v["id"]]=price
        return prices, specs
    add("charging-kids-hoodie","Freeplug Charging Up Youth Hoodie","Charging Up. A youth heavy-blend hooded sweatshirt with a half-full battery graphic.",314,29,b_kidshoodie)

    def b_tough():
        price=1999; cat=variants_for(269,1); specs=[]; prices={}
        src=art_path("tech","dont-hit-1-case","front.png")
        for v in cat:
            if not any(x in v["title"] for x in ["iPhone 15","iPhone 14","iPhone 13","iPhone 16","Galaxy S2","Pixel"]): continue
            ph=ph_for(v,"front"); path=prepared("dont-hit-1-case", f"front-{v['id']}.png", ph["width"], ph["height"], src)
            specs.append((v["id"], [("front", ph["decoration_method"], path)])); prices[v["id"]]=price
        if not specs:
            for v in cat[:8]:
                ph=ph_for(v,"front"); path=prepared("dont-hit-1-case", f"front-{v['id']}.png", ph["width"], ph["height"], src)
                specs.append((v["id"], [("front", ph["decoration_method"], path)])); prices[v["id"]]=price
        return prices, specs
    add("dont-hit-1-case","Freeplug Don't Let Me Hit 1% Tough Phone Case","Don't Let Me Hit 1%. A tough phone case with Freeplug artwork.",269,1,b_tough)

    def b_slim():
        price=1799; cat=variants_for(268,1); specs=[]; prices={}
        src=art_path("tech","slim-fp-case","front.png")
        for v in cat:
            if not any(x in v["title"] for x in ["iPhone 15","iPhone 14","iPhone 13","iPhone 16","Galaxy S2","Pixel"]): continue
            ph=ph_for(v,"front"); path=prepared("slim-fp-case", f"front-{v['id']}.png", ph["width"], ph["height"], src)
            specs.append((v["id"], [("front", ph["decoration_method"], path)])); prices[v["id"]]=price
        if not specs:
            for v in cat[:8]:
                ph=ph_for(v,"front"); path=prepared("slim-fp-case", f"front-{v['id']}.png", ph["width"], ph["height"], src)
                specs.append((v["id"], [("front", ph["decoration_method"], path)])); prices[v["id"]]=price
        return prices, specs
    add("slim-fp-case","Freeplug Minimal FP Slim Phone Case","A slim phone case with a minimal Freeplug circle mark.",268,1,b_slim)

    def b_mouse():
        price=899; cat=variants_for(608,28); specs=[]; prices={}
        src=art_path("tech","click-mousepad","front.png")
        for v in cat:
            if "9" in v["title"] or "9" in str((v.get("options") or {}).get("size","")):
                ph=ph_for(v,"front"); path=prepared("click-mousepad","front.png", ph["width"], ph["height"], src)
                specs.append((v["id"], [("front", ph["decoration_method"], path)])); prices[v["id"]]=price
        if not specs:
            v=cat[0]; ph=ph_for(v,"front"); path=prepared("click-mousepad","front.png", ph["width"], ph["height"], src)
            specs.append((v["id"], [("front", ph["decoration_method"], path)])); prices[v["id"]]=price
        return prices, specs
    add("click-mousepad","Freeplug Click Connect Get Paid Mouse Pad","Click, Connect, Get Paid. A rectangle mouse pad with Freeplug artwork.",608,28,b_mouse)

    def b_laptop():
        price=3399; cat=variants_for(429,1); specs=[]; prices={}
        src=art_path("tech","website-laptop-sleeve","front.png")
        for v in cat:
            size=str((v.get("options") or {}).get("size",""))
            if not (size.startswith("12") or size.startswith("13") or "12\"" in v["title"] or "13\"" in v["title"] or "12" in v["title"] or "13" in v["title"]):
                continue
            ph=ph_for(v,"front"); path=prepared("website-laptop-sleeve", f"front-{v['id']}.png", ph["width"], ph["height"], src)
            specs.append((v["id"], [("front", ph["decoration_method"], path)])); prices[v["id"]]=price
        return prices, specs
    add("website-laptop-sleeve","Freeplug Website Was Free Laptop Sleeve","Website Was Free. A laptop sleeve with Freeplug artwork.",429,1,b_laptop)

    def b_notebook():
        price=1499; cat=variants_for(74,1); specs=[]; prices={}
        src=art_path("stationery","ideas-notebook","front.png")
        for v in cat:
            ph=ph_for(v,"front"); path=prepared("ideas-notebook","front.png", ph["width"], ph["height"], src)
            specs.append((v["id"], [("front", ph["decoration_method"], path)])); prices[v["id"]]=price
        return prices, specs
    add("ideas-notebook","Freeplug Ideas Worth Plugging Notebook","Ideas Worth Plugging. A spiral ruled notebook with Freeplug cover artwork.",74,1,b_notebook)


    for slug, title_bit in [("poster-1-plug-map","Plug Map"),("poster-2-hustle-hours","Hustle Hours"),("poster-3-free-is-a-feeling","Free Is a Feeling"),("poster-4-wired-different","Wired Different")]:
        def make_poster(slug=slug):
            def b():
                cat=variants_for(282,2); specs=[]; prices={}
                src=art_path("wall-art",slug,"18x24.png")
                want={'16″ x 20″':2199,'18″ x 24″':2199}
                for v in cat:
                    opts=v.get("options") or {}
                    if opts.get("paper") and opts.get("paper") != "Matte": continue
                    size=opts.get("size")
                    if size not in want: continue
                    ph=ph_for(v,"front"); path=prepared(slug, f"{size}.png", ph["width"], ph["height"], src)
                    specs.append((v["id"], [("front", ph["decoration_method"], path)])); prices[v["id"]]=want[size]
                return prices, specs
            return b
        add(slug, f"Freeplug {title_bit} Poster", f"{title_bit}. A matte vertical Freeplug poster.", 282, 2, make_poster())

    def b_framed_stay():
        cat=variants_for(540,2); specs=[]; prices={}
        src=art_path("wall-art","stay-connected-framed","16x20.png")
        want={'16″ x 20″':10399,'11" x 14"':7799}
        for v in cat:
            opts=v.get("options") or {}
            if opts.get("color") != "Black": continue
            size=opts.get("size")
            if size not in want: continue
            ph=ph_for(v,"front"); path=prepared("stay-connected-framed", f"{size}.png", ph["width"], ph["height"], src)
            specs.append((v["id"], [("front", ph["decoration_method"], path)])); prices[v["id"]]=want[size]
        return prices, specs
    add("stay-connected-framed","Freeplug Stay Connected Framed Print","Stay Connected. A framed vertical poster with minimalist Freeplug line art. Black frame.",540,2,b_framed_stay)

    def b_sign():
        cat=variants_for(1206,228); specs=[]; prices={}
        src=art_path("wall-art","plug-parking-sign","front.png")
        for v in cat:
            opts=v.get("options") or {}; size=str(opts.get("size","")); title=v["title"]
            if not ('10″ x 8″' in size or '10" x 8"' in size or ("10" in title and "8" in title)): continue
            ph=ph_for(v,"front"); path=prepared("plug-parking-sign","front.png", ph["width"], ph["height"], src)
            specs.append((v["id"], [("front", ph["decoration_method"], path)])); prices[v["id"]]=3199
        if not specs:
            v=cat[0]; ph=ph_for(v,"front"); path=prepared("plug-parking-sign","front.png", ph["width"], ph["height"], src)
            specs.append((v["id"], [("front", ph["decoration_method"], path)])); prices[v["id"]]=3199
        return prices, specs
    add("plug-parking-sign","Freeplug Plug Parking Only Metal Sign","Plug Parking Only. A metal art sign with Freeplug artwork.",1206,228,b_sign)

    def b_towel():
        cat=variants_for(352,1); specs=[]; prices={}
        src=art_path("outdoor","solar-towel","front.png")
        size_price={'30" × 60"':4299,'36" × 72"':5499}
        for v in cat:
            size=(v.get("options") or {}).get("size")
            if size not in size_price: continue
            ph=ph_for(v,"front"); path=prepared("solar-towel", f"front-{v['id']}.png", ph["width"], ph["height"], src)
            specs.append((v["id"], [("front", ph["decoration_method"], path)])); prices[v["id"]]=size_price[size]
        return prices, specs
    add("solar-towel","Freeplug Solar Charging Beach Towel","Solar Charging. A beach towel with Freeplug artwork.",352,1,b_towel)

    def b_campmug():
        price=2099; cat=variants_for(483,28); specs=[]; prices={}
        src=art_path("outdoor","offgrid-camping-mug","front.png")
        for v in cat:
            ph=ph_for(v,"front"); path=prepared("offgrid-camping-mug","front.png", ph["width"], ph["height"], src)
            specs.append((v["id"], [("front", ph["decoration_method"], path)])); prices[v["id"]]=price
        return prices, specs
    add("offgrid-camping-mug","Freeplug Off-Grid Plug Camping Mug","Off-Grid Plug. An enamel-style camping mug with Freeplug artwork.",483,28,b_campmug)

    def b_picnic():
        price=7399; cat=variants_for(1124,28); specs=[]; prices={}
        src=art_path("outdoor","unplug-picnic","front.png")
        for v in cat:
            ph=ph_for(v,"front"); path=prepared("unplug-picnic","front.png", ph["width"], ph["height"], src)
            specs.append((v["id"], [("front", ph["decoration_method"], path)])); prices[v["id"]]=price
        return prices, specs
    add("unplug-picnic","Freeplug Unplug Together Picnic Blanket","Unplug Together. A picnic blanket with Freeplug artwork.",1124,28,b_picnic)

    def b_flag():
        cat=variants_for(976,92); specs=[]; prices={}
        src=art_path("outdoor","plug-lives-flag","front.png")
        for v in cat:
            size=(v.get("options") or {}).get("size") or ""
            if "12" in size and "18" in size: pr=1899
            elif "24" in size: pr=3699
            else: continue
            ph=ph_for(v,"front"); path=prepared("plug-lives-flag", f"front-{v['id']}.png", ph["width"], ph["height"], src)
            specs.append((v["id"], [("front", ph["decoration_method"], path)])); prices[v["id"]]=pr
        return prices, specs
    add("plug-lives-flag","Freeplug A Plug Lives Here Garden Flag","A Plug Lives Here. A garden and house banner with Freeplug artwork.",976,92,b_flag)

    def b_ornament():
        price=1199; cat=variants_for(531,59); specs=[]; prices={}
        src=art_path("seasonal","plugged-ornament","circle.png")
        for v in cat:
            if "Circle" not in v["title"] and "circle" not in v["title"].lower():
                shape=(v.get("options") or {}).get("shape")
                if shape and shape != "Circle": continue
            ph=ph_for(v,"front"); path=prepared("plugged-ornament","circle.png", ph["width"], ph["height"], src)
            specs.append((v["id"], [("front", ph["decoration_method"], path)])); prices[v["id"]]=price
        if not specs:
            v=cat[0]; ph=ph_for(v,"front"); path=prepared("plugged-ornament","circle.png", ph["width"], ph["height"], src)
            specs.append((v["id"], [("front", ph["decoration_method"], path)])); prices[v["id"]]=price
        return prices, specs
    add("plugged-ornament","Freeplug Plugged-In Christmas Ornament","Plugged-In Christmas. A ceramic ornament with string-lights shaped into the Freeplug mark.",531,59,b_ornament)

    def b_ugly():
        price=3499; cat=variants_for(49,29); sizes={"S","M","L","XL","2XL","3XL"}; specs=[]; prices={}
        for want_light, fname in [(True,"front-light-garment.png"),(False,"front-dark-garment.png")]:
            for v in pick_by_colors(cat, want_light, sizes):
                col=((v.get("options") or {}).get("color") or "").lower()
                if col in {"red","heliconia","gold","orange","irish green"}: continue
                ph=ph_for(v,"front"); path=prepared("ugly-sweater-crew", fname, ph["width"], ph["height"], art_path("seasonal","ugly-sweater-crew",fname))
                specs.append((v["id"], [("front", ph["decoration_method"], path)])); prices[v["id"]]=price
        return prices, specs
    add("ugly-sweater-crew","Freeplug Ugly Sweater Crewneck","An ugly-sweater style printed pattern of plugs and bolts on a heavy-blend crewneck. Printed pattern, not real knit.",49,29,b_ugly)

    def b_stocking():
        price=3099; cat=variants_for(734,59); specs=[]; prices={}
        src=art_path("seasonal","running-over-stocking","front.png")
        for v in cat:
            ph=ph_for(v,"front"); path=prepared("running-over-stocking","front.png", ph["width"], ph["height"], src)
            specs.append((v["id"], [("front", ph["decoration_method"], path)])); prices[v["id"]]=price
        return prices, specs
    add("running-over-stocking","Freeplug Fill It Running Over Stocking","Fill It Running Over. A Christmas stocking with a nod to Luke 6:38 (King James Version).",734,59,b_stocking)

    def b_woven():
        cat=variants_for(1626,10); specs=[]; prices={}
        src=art_path("running-over","kjv-woven-blanket","front.png")
        for v in cat:
            size=(v.get("options") or {}).get("size") or ""
            if "52" in size and "37" in size: pr=5299
            elif "60" in size and "50" in size: pr=7199
            else: continue
            ph=ph_for(v,"front"); path=prepared("kjv-woven-blanket", f"front-{v['id']}.png", ph["width"], ph["height"], src)
            specs.append((v["id"], [("front", ph["decoration_method"], path)])); prices[v["id"]]=pr
        return prices, specs
    add("kjv-woven-blanket","Freeplug Running Over Luke 6:38 Woven Blanket","Give, and it shall be given unto you. Luke 6:38 (King James Version). A woven blanket from the Running Over faith line.",1626,10,b_woven)

    def b_tray():
        price=13999; cat=variants_for(780,59); specs=[]; prices={}
        src=art_path("running-over","kjv-serving-tray","front.png")
        for v in cat:
            if "11" in v["title"] and "17" in v["title"]:
                ph=ph_for(v,"front"); path=prepared("kjv-serving-tray","front.png", ph["width"], ph["height"], src)
                specs.append((v["id"], [("front", ph["decoration_method"], path)])); prices[v["id"]]=price
        if not specs:
            v=cat[0]; ph=ph_for(v,"front"); path=prepared("kjv-serving-tray","front.png", ph["width"], ph["height"], src)
            specs.append((v["id"], [("front", ph["decoration_method"], path)])); prices[v["id"]]=price
        return prices, specs
    add("kjv-serving-tray","Freeplug Running Over Luke 6:38 Serving Tray","Give, and it shall be given unto you. Luke 6:38 (King James Version). An acrylic serving tray from the Running Over faith line.",780,59,b_tray)

    for i in (1,2,3,4):
        def make_bm(i=i):
            def b():
                price=1099; cat=variants_for(765,59); specs=[]; prices={}
                src=art_path("running-over","kjv-bookmarks",f"bookmark-{i}.png")
                for v in cat:
                    ph=ph_for(v,"front"); path=prepared(f"kjv-bookmark-{i}","front.png", ph["width"], ph["height"], src)
                    specs.append((v["id"], [("front", ph["decoration_method"], path)])); prices[v["id"]]=price
                return prices, specs
            return b
        add(f"kjv-bookmark-{i}", f"Freeplug Luke 6:38 Bookmark {i}", "Luke 6:38 (King James Version). A Freeplug faith bookmark from the Running Over line.", 765, 59, make_bm())

    def b_pressed():
        cat=variants_for(540,2); specs=[]; prices={}
        src=art_path("running-over","pressed-down-framed","16x20.png")
        want={'16″ x 20″':10399,'11" x 14"':7799}
        for v in cat:
            opts=v.get("options") or {}
            if opts.get("color") != "Black": continue
            size=opts.get("size")
            if size not in want: continue
            ph=ph_for(v,"front"); path=prepared("pressed-down-framed", f"{size}.png", ph["width"], ph["height"], src)
            specs.append((v["id"], [("front", ph["decoration_method"], path)])); prices[v["id"]]=want[size]
        return prices, specs
    add("pressed-down-framed","Freeplug Pressed Down Shaken Together Framed Print","Pressed Down, Shaken Together. Luke 6:38 (King James Version). A framed vertical poster from the Running Over faith line. Black frame.",540,2,b_pressed)

    def b_teatowel():
        price=3199; cat=variants_for(677,70); specs=[]; prices={}
        src=art_path("running-over","thanksgiving-tea-towel","front.png")
        for v in cat:
            ph=ph_for(v,"front"); path=prepared("thanksgiving-tea-towel","front.png", ph["width"], ph["height"], src)
            specs.append((v["id"], [("front", ph["decoration_method"], path)])); prices[v["id"]]=price
        return prices, specs
    add("thanksgiving-tea-towel","Freeplug Thanksgiving Luke 6:38 Tea Towel","Give, and it shall be given unto you. Luke 6:38 (King James Version). A tea towel from the Running Over faith line.",677,70,b_teatowel)

    return J


def main():
    only = None
    if len(sys.argv) > 1 and sys.argv[1] != "--all":
        only = set(sys.argv[1:])
    all_jobs = jobs()
    print(f"Jobs defined: {len(all_jobs)}", flush=True)
    failures = []
    for job in all_jobs:
        key = job["key"]
        if only and key not in only:
            continue
        try:
            print(f"\n=== Building {key} ===", flush=True)
            prices, specs = job["builder"]()
            print(f"  variants prepared: {len(specs)}", flush=True)
            if not specs:
                failures.append({"key": key, "error": "no variants matched"})
                print(f"FAIL {key}: no variants", flush=True)
                continue
            create_product(key, job["title"], job["description"], job["blueprint"], job["provider"], prices, specs)
        except Exception as e:
            failures.append({"key": key, "error": str(e)[:800]})
            save("failures.json", failures)
            print(f"FAIL {key}: {e}", flush=True)
            continue
    save("failures.json", failures)
    state = load_state()
    print(f"\nDONE created={len(state)} failures={len(failures)}", flush=True)

if __name__ == "__main__":
    main()
