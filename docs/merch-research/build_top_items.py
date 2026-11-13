#!/usr/bin/env python3
"""Build TOP-ITEMS.csv/md from Printify catalog-us.jsonl (read-only inputs)."""
from __future__ import annotations

import argparse
import csv
import json
import math
import re
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

SIZES = {
    "XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL",
    "2T", "3T", "4T", "5T", "6T", "12M", "18M", "24M",
    "One size", "One Size", "OS",
}


def round_retail(cost_max_usd: float) -> float:
    raw = cost_max_usd / 0.55
    dollars = int(raw)
    if raw > dollars:
        return dollars + 0.99
    return max(0.99, dollars - 1 + 0.99)


def parse_variant_range(variants: list[dict]) -> tuple[int, str, str]:
    avail = [v for v in variants if v.get("available") and v.get("cost_cents")]
    colors: set[str] = set()
    sizes: set[str] = set()
    for v in avail:
        t = (v.get("title") or "").strip()
        if not t:
            colors.add("(untitled)")
            continue
        if " / " in t:
            left, right = t.split(" / ", 1)
            left, right = left.strip(), right.strip()
            if right in SIZES or re.match(r"^\d", right):
                colors.add(left)
                sizes.add(right)
            elif left in SIZES or re.match(r"^\d", left):
                sizes.add(left)
                colors.add(right)
            else:
                colors.add(t)
        else:
            colors.add(t)
    if sizes:
        size_range = f"{len(sizes)} sizes ({', '.join(sorted(sizes)[:8])}{'…' if len(sizes) > 8 else ''})"
    else:
        size_range = f"{len(colors)} options" if colors else "n/a"
    color_range = f"{len(colors)} colors"
    if len(colors) <= 12 and colors:
        color_range = f"{len(colors)} colors ({', '.join(sorted(colors)[:10])}{'…' if len(colors) > 10 else ''})"
    return len(avail), size_range, color_range


def pair_metrics(row: dict) -> dict[str, Any] | None:
    avail = [v for v in row.get("variants", []) if v.get("available") and v.get("cost_cents")]
    if not avail:
        return None
    ship_first = row.get("us_shipping_first_cents")
    ship_add = row.get("us_shipping_additional_cents")
    if ship_first is None or ship_add is None:
        return None
    costs = [v["cost_cents"] for v in avail]
    vc, sr, cr = parse_variant_range(row["variants"])
    return {
        "variant_count": vc,
        "size_range": sr,
        "color_range": cr,
        "cost_min_cents": min(costs),
        "cost_max_cents": max(costs),
        "ship_first_cents": ship_first,
        "ship_add_cents": ship_add,
        "sort_key": max(costs) + ship_first - vc * 3,
    }


def rank_providers(rows: list[dict]) -> list[tuple[dict, dict, float]]:
    ranked: list[tuple[dict, dict, float]] = []
    for r in rows:
        m = pair_metrics(r)
        if m:
            ranked.append((r, m, m["sort_key"]))
    ranked.sort(key=lambda x: (x[2], -x[1]["variant_count"]))
    return ranked


# Curated blueprint IDs (well-known blanks + diverse merch); extend via catalog scoring.
CURATED_BLUEPRINT_IDS: dict[str, list[int]] = {
    "apparel_tees": [12, 6, 706, 145, 9, 5, 32, 33, 34, 79, 380, 481],
    "apparel_long_sleeve": [41, 44, 45, 129, 1118, 77, 155, 356],
    "apparel_hoodies_sweatshirts": [49, 92, 77, 2001, 680, 439, 314, 1925, 528, 377],
    "apparel_tanks": [39, 348, 571, 315, 472],
    "hats": [458, 1725, 1734, 1221, 1691, 5385, 5284, 4802],
    "drinkware": [478, 479, 68, 425, 503, 483, 633, 620, 951, 604, 1511],
    "home_decor": [522, 277, 235, 677, 2764, 938, 5541, 7391, 677],
    "wall_art": [282, 540, 1206, 97, 937, 944, 1159, 284],
    "bags": [553, 414, 413, 468, 559, 507, 1313, 1990],
    "tech_desk": [269, 268, 608, 429, 74, 1125, 608, 1203],
    "pets": [562, 570, 419, 571, 567, 569, 572],
    "outdoor_seasonal": [352, 483, 1124, 976, 531, 734, 1124, 517],
    "jewelry": [430, 765, 531],
    "socks_shoes": [376, 452, 574, 871, 1433, 2941, 1903],
    "kids_baby": [568, 580, 314, 581, 583, 2728, 1617],
    "stickers_paper": [400, 600, 384, 74, 765, 5372, 661],
}

# Category detection rules (first match wins)
CATEGORY_RULES: list[tuple[str, re.Pattern]] = [
    ("stickers_paper", re.compile(r"sticker|notebook|journal|bookmark|greeting\s*card|postcard", re.I)),
    ("kids_baby", re.compile(r"\bbaby\b|\bkids\b|\byouth\b|\btoddler\b|onesie|infant", re.I)),
    ("apparel_tees", re.compile(r"\b(tee|t-shirt|t shirt|crew tee|jersey tee|polo|shirt)\b", re.I)),
    ("apparel_long_sleeve", re.compile(r"long\s*sleeve|ls\s*tee|raglan", re.I)),
    ("apparel_hoodies_sweatshirts", re.compile(r"hoodie|sweatshirt|crewneck|pullover|zip\s*up|fleece", re.I)),
    ("apparel_tanks", re.compile(r"\btank\b|muscle\s*tee|racerback", re.I)),
    ("hats", re.compile(r"\b(hat|cap|beanie|bucket\s*hat|trucker|visor|snapback)\b", re.I)),
    ("drinkware", re.compile(r"mug|tumbler|glass|bottle|cup|cooler|pint|can\s*cooler|travel\s*mug", re.I)),
    ("wall_art", re.compile(r"poster|canvas|framed|metal\s*art|print\b|wall\s*art", re.I)),
    ("bags", re.compile(r"tote|backpack|fanny|drawstring|duffel|sling\s*bag|gym\s*bag", re.I)),
    ("tech_desk", re.compile(r"phone\s*case|mouse\s*pad|desk\s*mat|laptop\s*sleeve|ipad|airpods", re.I)),
    ("pets", re.compile(r"\bpet\b|dog\b|cat\b|bandana.*pet|pet\s*bed|pet\s*bowl", re.I)),
    ("kids_baby", re.compile(r"\bbaby\b|\bkids\b|\byouth\b|\btoddler\b|onesie|infant", re.I)),
    ("socks_shoes", re.compile(r"\bsock|sneaker|shoe\b|flip\s*flop|slide", re.I)),
    ("jewelry", re.compile(r"\bjewel|necklace|bracelet|earring|pin\s*button|enamel\s*pin", re.I)),
    ("outdoor_seasonal", re.compile(r"beach\s*towel|picnic|flag|ornament|stocking|camping|garden|banner|seasonal", re.I)),
    ("home_decor", re.compile(r"blanket|pillow|curtain|clock|coaster|cutting\s*board|apron|towel|tapestry", re.I)),
]

FAMOUS_BOOST = {
    ("Bella+Canvas", "3001"): 50,
    ("Gildan", "5000"): 45,
    ("Gildan", "18000"): 40,
    ("Gildan", "18500"): 40,
    ("Comfort Colors", "1717"): 40,
    ("Gildan", "64000"): 35,
    ("Next Level", "3600"): 30,
    ("Bella+Canvas", "6004"): 25,
    ("Bella+Canvas", "3480"): 20,
    ("Gildan", "2000"): 20,
    ("Gildan", "2300"): 15,
    ("Yupoong", "6245"): 25,
    ("Richardson", "112"): 20,
    ("AS Colour", "5001"): 15,
}

TARGETS = {
    "apparel_tees": 22,
    "apparel_long_sleeve": 12,
    "apparel_hoodies_sweatshirts": 18,
    "apparel_tanks": 8,
    "hats": 12,
    "drinkware": 14,
    "home_decor": 22,
    "wall_art": 14,
    "bags": 12,
    "tech_desk": 12,
    "pets": 10,
    "outdoor_seasonal": 12,
    "jewelry": 6,
    "socks_shoes": 6,
    "kids_baby": 10,
    "stickers_paper": 10,
}

DISPLAY_CATEGORY = {
    "apparel_tees": "Apparel — Tees",
    "apparel_long_sleeve": "Apparel — Long sleeves",
    "apparel_hoodies_sweatshirts": "Apparel — Hoodies & sweatshirts",
    "apparel_tanks": "Apparel — Tanks",
    "hats": "Hats",
    "drinkware": "Drinkware",
    "home_decor": "Home & decor",
    "wall_art": "Wall art",
    "bags": "Bags",
    "tech_desk": "Tech & desk",
    "pets": "Pets",
    "outdoor_seasonal": "Outdoor & seasonal",
    "jewelry": "Jewelry & pins",
    "socks_shoes": "Socks & shoes",
    "kids_baby": "Kids & baby",
    "stickers_paper": "Stickers & paper",
}


@dataclass
class Item:
    category: str
    blueprint_id: int
    title: str
    brand: str
    model: str
    provider_id: int
    provider_name: str
    runner_up: str
    variant_count: int
    size_range: str
    color_range: str
    cost_min: float
    cost_max: float
    ship_first: float
    ship_add: float
    suggested_retail: float
    break_even: float
    margin_pct: float
    note: str
    score: float = 0.0


def categorize(title: str, brand: str, model: str) -> str:
    text = f"{title} {brand} {model}"
    for cat, pat in CATEGORY_RULES:
        if pat.search(text):
            return cat
    return "home_decor"


def build_items(catalog_path: Path) -> list[Item]:
    by_bp: dict[int, list[dict]] = defaultdict(list)
    with catalog_path.open() as f:
        for line in f:
            row = json.loads(line)
            if row.get("provider_country") != "US":
                continue
            by_bp[row["blueprint_id"]].append(row)

    candidates: dict[str, list[tuple[float, Item]]] = defaultdict(list)
    seen_bp: set[int] = set()

    def make_item(bp_id: int, cat: str, boost: float = 0) -> Item | None:
        rows = by_bp.get(bp_id)
        if not rows:
            return None
        ranked = rank_providers(rows)
        if not ranked:
            return None
        chosen, m, _ = ranked[0]
        runner = ""
        if len(ranked) > 1:
            r2 = ranked[1][0]
            runner = f"{r2['provider_id']} {r2['provider_name']}"
        base = rows[0]
        cost_min = m["cost_min_cents"] / 100
        cost_max = m["cost_max_cents"] / 100
        retail = round_retail(cost_max)
        ship_f = m["ship_first_cents"] / 100
        ship_a = m["ship_add_cents"] / 100
        stripe = retail * 0.029 + 0.30
        break_even = cost_max + ship_f + stripe
        margin = (retail - cost_max) / retail * 100 if retail else 0
        brand = base.get("blueprint_brand") or ""
        model = base.get("blueprint_model") or ""
        fam = FAMOUS_BOOST.get((brand, model), 0)
        note_parts = []
        if fam:
            note_parts.append("Popular blank")
        if chosen["provider_name"] == "Printify Choice":
            note_parts.append("Choice routes across US network")
        if m["variant_count"] < 15:
            note_parts.append("Limited variant breadth")
        score = boost + fam + m["variant_count"] / 5 - m["cost_max_cents"] / 500
        return Item(
            category=cat,
            blueprint_id=bp_id,
            title=base.get("blueprint_title") or "",
            brand=brand,
            model=model,
            provider_id=chosen["provider_id"],
            provider_name=chosen["provider_name"],
            runner_up=runner,
            variant_count=m["variant_count"],
            size_range=m["size_range"],
            color_range=m["color_range"],
            cost_min=cost_min,
            cost_max=cost_max,
            ship_first=ship_f,
            ship_add=ship_a,
            suggested_retail=retail,
            break_even=round(break_even, 2),
            margin_pct=round(margin, 1),
            note="; ".join(note_parts) if note_parts else "Solid US cost + shipping data",
            score=score,
        )

    for cat, ids in CURATED_BLUEPRINT_IDS.items():
        for bp_id in ids:
            it = make_item(bp_id, cat, boost=30)
            if it:
                candidates[cat].append((it.score, it))

    for bp_id, rows in by_bp.items():
        if bp_id in seen_bp:
            continue
        base = rows[0]
        cat = categorize(base.get("blueprint_title") or "", base.get("blueprint_brand") or "", base.get("blueprint_model") or "")
        it = make_item(bp_id, cat, boost=0)
        if not it:
            continue
        min_vars = 1 if cat == "socks_shoes" else 3
        if it.variant_count < min_vars:
            continue
        title_l = (it.title or "").lower()
        if "embroidery" in title_l and it.cost_max > 40:
            continue
        candidates[cat].append((it.score, it))

    selected: list[Item] = []
    used: set[int] = set()

    for cat, target in TARGETS.items():
        pool = sorted(candidates.get(cat, []), key=lambda x: -x[0])
        count = 0
        for _, it in pool:
            if it.blueprint_id in used:
                continue
            selected.append(it)
            used.add(it.blueprint_id)
            count += 1
            if count >= target:
                break

    # Fill to ~175 if under target
    if len(selected) < 150:
        for cat in TARGETS:
            pool = sorted(candidates.get(cat, []), key=lambda x: -x[0])
            for _, it in pool:
                if it.blueprint_id in used:
                    continue
                selected.append(it)
                used.add(it.blueprint_id)
                if len(selected) >= 175:
                    break
            if len(selected) >= 175:
                break

    # Cap at 200
    selected.sort(key=lambda x: (DISPLAY_CATEGORY.get(x.category, x.category), -x.score, x.title))
    return selected[:200]


def write_csv(path: Path, items: list[Item]) -> None:
    fields = [
        "category", "blueprint_id", "blueprint_title", "brand", "model",
        "provider_id", "provider_name", "runner_up_provider",
        "variant_count", "size_range", "color_range",
        "cost_min_usd", "cost_max_usd",
        "us_shipping_first_usd", "us_shipping_additional_usd",
        "suggested_retail_usd", "break_even_usd", "margin_at_retail_pct", "note",
    ]
    with path.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        for it in items:
            w.writerow({
                "category": DISPLAY_CATEGORY.get(it.category, it.category),
                "blueprint_id": it.blueprint_id,
                "blueprint_title": it.title,
                "brand": it.brand,
                "model": it.model,
                "provider_id": it.provider_id,
                "provider_name": it.provider_name,
                "runner_up_provider": it.runner_up,
                "variant_count": it.variant_count,
                "size_range": it.size_range,
                "color_range": it.color_range,
                "cost_min_usd": f"{it.cost_min:.2f}",
                "cost_max_usd": f"{it.cost_max:.2f}",
                "us_shipping_first_usd": f"{it.ship_first:.2f}",
                "us_shipping_additional_usd": f"{it.ship_add:.2f}",
                "suggested_retail_usd": f"{it.suggested_retail:.2f}",
                "break_even_usd": f"{it.break_even:.2f}",
                "margin_at_retail_pct": f"{it.margin_pct:.1f}",
                "note": it.note,
            })


def write_md(path: Path, items: list[Item], catalog_path: Path) -> None:
    from collections import Counter

    cats = Counter(it.category for it in items)
    margins = [it.margin_pct for it in items]
    by_cost = sorted(items, key=lambda x: x.cost_max)
    cheapest = by_cost[:5]
    priciest = by_cost[-5:][::-1]

    lines = [
        "# Printify US blanks — top items research",
        "",
        "Read-only analysis from partial `catalog-us.jsonl` (keyword-filtered fetch).",
        "",
        "## Data caveats",
        "",
        "- **Partial catalog:** 2,395 US blueprint×provider rows packaged (~2,219 blueprints scanned of 3,022; keyword filter on titles).",
        "- **Not in repo:** Raw JSONL is not committed; regenerate from Printify catalog fetch.",
        "- **Costs:** Product-catalog-service v2 unit costs (typically one print area); multi-area DTG may cost more at draft time.",
        "- **Variant titles:** Many variants lack titles in this dump; size/color counts use parsed titles where present.",
        "- **Printify Choice:** Lowest cost often routes via Choice; confirm fulfillment facility on real orders.",
        "",
        "## Summary",
        "",
        f"- **Total picks:** {len(items)} unique blueprints (one best US provider each).",
        f"- **Typical margin at suggested retail:** {min(margins):.1f}%–{max(margins):.1f}% (formula: retail = ceil to next $X.99 from cost_max ÷ 0.55).",
        f"- **Cheapest pick (max variant cost):** {cheapest[0].title} — ${cheapest[0].cost_max:.2f}",
        f"- **Priciest pick:** {priciest[0].title} — ${priciest[0].cost_max:.2f}",
        "",
        "### Counts per category",
        "",
        "| Category | Count |",
        "| --- | ---: |",
    ]
    for cat_key in TARGETS:
        lines.append(f"| {DISPLAY_CATEGORY[cat_key]} | {cats.get(cat_key, 0)} |")

    lines += [
        "",
        "### Five cheapest (by cost_max)",
        "",
        "| Blueprint | Brand/Model | Cost max | Suggested retail |",
        "| --- | --- | ---: | ---: |",
    ]
    for it in cheapest:
        lines.append(f"| {it.title} (#{it.blueprint_id}) | {it.brand} {it.model} | ${it.cost_max:.2f} | ${it.suggested_retail:.2f} |")

    lines += [
        "",
        "### Five priciest (by cost_max)",
        "",
        "| Blueprint | Brand/Model | Cost max | Suggested retail |",
        "| --- | --- | ---: | ---: |",
    ]
    for it in priciest:
        lines.append(f"| {it.title} (#{it.blueprint_id}) | {it.brand} {it.model} | ${it.cost_max:.2f} | ${it.suggested_retail:.2f} |")

    lines += [
        "",
        "## Buyer section — recommended tabs & filters",
        "",
        "**Primary tabs** (mirror category groups below): Apparel, Hats, Drinkware, Home, Wall art, Bags, Tech & desk, Pets, Kids, Outdoor & seasonal, Accessories (socks, jewelry, stickers).",
        "",
        "**Filters:**",
        "- Price band (under $25 / $25–50 / $50+ suggested retail)",
        "- Product type (tee, hoodie, mug, poster, …)",
        "- Brand (Bella+Canvas, Gildan, Comfort Colors, …)",
        "- Color family (when variant titles available)",
        "- Size (apparel & kids)",
        "",
        "**Sort defaults:** Featured (score), Price low→high, Margin high→low.",
        "",
        "## Items by category",
        "",
    ]

    current = None
    for it in items:
        disp = DISPLAY_CATEGORY.get(it.category, it.category)
        if disp != current:
            current = disp
            lines.append(f"### {disp}")
            lines.append("")
            lines.append(
                "| ID | Title | Brand/Model | Provider | Variants | Cost (min–max) | Ship 1st/add | Retail | Margin | Note |"
            )
            lines.append("| ---: | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |")
        lines.append(
            f"| {it.blueprint_id} | {it.title} | {it.brand} {it.model} | {it.provider_name} | {it.variant_count} | "
            f"${it.cost_min:.2f}–${it.cost_max:.2f} | ${it.ship_first:.2f}/${it.ship_add:.2f} | "
            f"${it.suggested_retail:.2f} | {it.margin_pct:.1f}% | {it.note} |"
        )

    path.write_text("\n".join(lines) + "\n")


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument(
        "--catalog",
        type=Path,
        default=Path(
            "/home/ubuntu/.cursor/projects/agent-repos-Freeplug-in-dev/uploads/catalog-us_0138.jsonl"
        ),
    )
    p.add_argument("--out-dir", type=Path, default=Path(__file__).resolve().parent)
    args = p.parse_args()
    # Default catalog path when run from repo
    catalog = args.catalog
    if not catalog.exists():
        env = Path("/home/ubuntu/.cursor/projects/agent-repos-Freeplug-in-dev/uploads/catalog-us_0138.jsonl")
        if env.exists():
            catalog = env
    items = build_items(catalog)
    write_csv(args.out_dir / "TOP-ITEMS.csv", items)
    write_md(args.out_dir / "TOP-ITEMS.md", items, catalog)
    print(f"Wrote {len(items)} items to {args.out_dir}")


if __name__ == "__main__":
    main()
