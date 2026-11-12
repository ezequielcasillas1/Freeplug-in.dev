#!/usr/bin/env python3
"""Freeplug giving-verses tee set: 10 KJV excerpts, light/dark garment, mockups."""
from __future__ import annotations
from pathlib import Path
import io, json, re, math, textwrap
from PIL import Image, ImageDraw, ImageFont
import numpy as np
from scipy import ndimage as nd
import cairosvg

ROOT = Path('/workspace/logos/freeplug/merch/tshirts/giving-verses')
ROOT.mkdir(parents=True, exist_ok=True)
Image.MAX_IMAGE_PIXELS = None

RED = (186, 61, 61, 255)
INK = (17, 17, 17, 255)
IVORY = (247, 243, 234, 255)
CHAR = (34, 34, 34, 255)
MUTED = (90, 90, 90, 255)

FDIR = Path('/workspace/logos/FP/fonts/ttf')
CDIR = Path('/workspace/logos/freeplug/cursive/ttf')
MONO = re.search(r'd="([^"]+)"', Path('/workspace/logos/FP/svg/fp-monogram-black.svg').read_text()).group(1)

W, H = 4500, 5400

def font(kind, size):
    p = {
        'eb': FDIR/'FPExtended-Black.ttf',
        'e': FDIR/'FPExtended-Bold.ttf',
        'er': FDIR/'FPExtended-Regular.ttf',
        'd': FDIR/'FreeplugDispatch-Bold.ttf',
        'dc': FDIR/'FreeplugDispatch-CondensedHeadline.ttf',
        'dr': FDIR/'FreeplugDispatch-Regular.ttf',
        'c': CDIR/'FPCursive-Bold.ttf',
        'cl': CDIR/'FPCursive-Light.ttf',
        'cr': CDIR/'FPCursive-Regular.ttf',
    }[kind]
    return ImageFont.truetype(str(p), size)

def fit_font(draw, text, kind, max_w, max_h, cap=400, floor=28):
    size = cap
    while size > floor:
        f = font(kind, size)
        b = draw.textbbox((0, 0), text, font=f)
        if b[2]-b[0] <= max_w and b[3]-b[1] <= max_h:
            return f, b
        size -= 2
    f = font(kind, floor)
    return f, draw.textbbox((0, 0), text, font=f)

def draw_centered_line(im, text, y, kind, color, max_w, max_h, cap=400, stroke=0, stroke_fill=None):
    d = ImageDraw.Draw(im)
    f, b = fit_font(d, text, kind, max_w, max_h, cap)
    x = (W - (b[2]-b[0])) // 2 - b[0]
    kw = {}
    if stroke:
        kw.update(stroke_width=stroke, stroke_fill=stroke_fill or color)
    d.text((x, y - b[1]), text, font=f, fill=color, **kw)
    return b[3]-b[1]

def wrap_lines(text, kind, max_w, max_h_total, cap=220, floor=36, prefer_lines=None):
    """Greedy wrap that fits width; return list of lines and chosen font size."""
    # try sizes
    words = text.split()
    for size in range(cap, floor-1, -2):
        f = font(kind, size)
        # measure with dummy image
        dummy = Image.new('RGBA', (10,10)); d = ImageDraw.Draw(dummy)
        lines, cur = [], ''
        for w in words:
            trial = (cur + ' ' + w).strip()
            b = d.textbbox((0,0), trial, font=f)
            if b[2]-b[0] <= max_w:
                cur = trial
            else:
                if cur: lines.append(cur)
                cur = w
        if cur: lines.append(cur)
        # height
        heights = []
        total = 0
        for ln in lines:
            b = d.textbbox((0,0), ln, font=f)
            h = b[3]-b[1]
            heights.append(h)
            total += h
        gap = int(size * 0.28)
        total += gap * max(0, len(lines)-1)
        if total <= max_h_total and (prefer_lines is None or len(lines) <= prefer_lines + 2):
            return lines, f, size, gap
    # fallback
    f = font(kind, floor)
    return [text], f, floor, int(floor*0.28)

def draw_wrapped(im, text, y0, kind, color, max_w, max_h, cap=220, floor=36, stroke=0, stroke_fill=None):
    lines, f, size, gap = wrap_lines(text, kind, max_w, max_h, cap, floor)
    d = ImageDraw.Draw(im)
    y = y0
    for ln in lines:
        b = d.textbbox((0,0), ln, font=f)
        x = (W - (b[2]-b[0])) // 2 - b[0]
        kw = {}
        if stroke:
            kw.update(stroke_width=stroke, stroke_fill=stroke_fill or color)
        d.text((x, y - b[1]), ln, font=f, fill=color, **kw)
        y += (b[3]-b[1]) + gap
    return y - y0, lines, size

def mono_img(size, color):
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 1024 1024"><path d="{MONO}" fill="rgb({color[0]},{color[1]},{color[2]})"/></svg>'
    a = Image.open(io.BytesIO(cairosvg.svg2png(bytestring=svg.encode()))).convert('RGBA')
    bb = a.getbbox()
    if bb: a = a.crop(bb)
    a.thumbnail((size, size), Image.Resampling.LANCZOS)
    out = Image.new('RGBA', (size, size), (0,0,0,0))
    out.alpha_composite(a, ((size-a.width)//2, (size-a.height)//2))
    return out

def paste(im, art, xy):
    im.alpha_composite(art, (int(xy[0]), int(xy[1])))

def circle_mark(im, xy, diam, ring=RED, fill=IVORY):
    d = ImageDraw.Draw(im)
    d.ellipse([xy[0], xy[1], xy[0]+diam, xy[1]+diam], fill=ring)
    m = mono_img(int(diam*0.62), fill)
    paste(im, m, (xy[0]+(diam-m.width)//2, xy[1]+(diam-m.height)//2 + int(diam*0.02)))

# ---- motifs (hand-drawn, no paid gen) ----
def motif_open_hand(size, color=INK):
    im = Image.new('RGBA', (size, size), (0,0,0,0))
    d = ImageDraw.Draw(im)
    s = size
    # palm
    d.ellipse([s*0.22, s*0.38, s*0.78, s*0.92], outline=color, width=max(6,s//40))
    # fingers up
    for i, (x0,x1) in enumerate([(0.28,0.38),(0.40,0.50),(0.52,0.62),(0.64,0.74)]):
        top = s*(0.12 if i!=1 else 0.06)
        d.rounded_rectangle([s*x0, top, s*x1, s*0.48], radius=s//20, outline=color, width=max(5,s//45))
    # thumb
    d.arc([s*0.05, s*0.45, s*0.35, s*0.85], 200, 340, fill=color, width=max(6,s//40))
    return im

def motif_bread(size, color=INK, accent=RED):
    im = Image.new('RGBA', (size, size), (0,0,0,0))
    d = ImageDraw.Draw(im)
    s = size
    d.ellipse([s*0.12, s*0.28, s*0.88, s*0.82], outline=color, width=max(6,s//40))
    d.arc([s*0.20, s*0.18, s*0.80, s*0.55], 200, 340, fill=color, width=max(5,s//50))
    # crumbs / wheat mark
    d.line([(s*0.35,s*0.45),(s*0.65,s*0.45)], fill=accent, width=max(4,s//60))
    d.line([(s*0.5,s*0.38),(s*0.5,s*0.70)], fill=accent, width=max(4,s//60))
    return im

def motif_light(size, color=INK, accent=RED):
    im = Image.new('RGBA', (size, size), (0,0,0,0))
    d = ImageDraw.Draw(im)
    s = size
    cx, cy = s//2, s//2
    r = int(s*0.22)
    d.ellipse([cx-r, cy-r, cx+r, cy+r], outline=accent, width=max(6,s//40))
    d.ellipse([cx-r//2, cy-r//2, cx+r//2, cy+r//2], fill=accent)
    for ang in range(0, 360, 45):
        rad = math.radians(ang)
        x0 = cx + int(math.cos(rad)*r*1.35)
        y0 = cy + int(math.sin(rad)*r*1.35)
        x1 = cx + int(math.cos(rad)*r*2.05)
        y1 = cy + int(math.sin(rad)*r*2.05)
        d.line([(x0,y0),(x1,y1)], fill=color, width=max(5,s//50))
    return im

def motif_heart_plug(size, color=INK, accent=RED):
    """Small heart with tiny plug prongs — brand-adjacent, not trademarked."""
    im = Image.new('RGBA', (size, size), (0,0,0,0))
    d = ImageDraw.Draw(im)
    s = size
    # heart
    r = int(s*0.22)
    d.ellipse([s*0.18, s*0.22, s*0.18+2*r, s*0.22+2*r], fill=accent)
    d.ellipse([s*0.82-2*r, s*0.22, s*0.82, s*0.22+2*r], fill=accent)
    d.polygon([(s*0.18, s*0.22+r), (s*0.82, s*0.22+r), (s*0.5, s*0.82)], fill=accent)
    # two prongs below (plug hint)
    pw = max(6, s//28)
    d.rectangle([s*0.38, s*0.78, s*0.38+pw, s*0.95], fill=color)
    d.rectangle([s*0.62-pw, s*0.78, s*0.62, s*0.95], fill=color)
    return im

def motif_quote_marks(size, color=RED):
    im = Image.new('RGBA', (size, size), (0,0,0,0))
    d = ImageDraw.Draw(im)
    f = font('eb', max(40, size//2))
    d.text((0, 0), '"', font=f, fill=color)
    return im

def binary(im):
    a = np.array(im.convert('RGBA'))
    a[:,:,3] = np.where(a[:,:,3] >= 128, 255, 0).astype(np.uint8)
    a[a[:,:,3]==0, :3] = 0
    return Image.fromarray(a)

def invert_for_dark(im):
    a = np.array(im.convert('RGBA'))
    mask = a[:,:,3] > 128
    if not mask.any():
        return im
    rgb = a[:,:,:3].astype(int)
    redish = mask & (rgb[:,:,0] > 130) & (rgb[:,:,0] > rgb[:,:,1]+35) & (rgb[:,:,0] > rgb[:,:,2]+35)
    other = mask & ~redish
    a[other, :3] = np.array(IVORY[:3], dtype=np.uint8)
    a[redish, :3] = np.array(RED[:3], dtype=np.uint8)
    if redish.any():
        ring = nd.binary_dilation(redish, iterations=6) & ~redish
        a[ring, :3] = np.array(IVORY[:3], dtype=np.uint8)
        a[ring, 3] = 255
        a[redish, :3] = np.array(RED[:3], dtype=np.uint8)
        a[redish, 3] = 255
    return binary(Image.fromarray(a))

def canvas():
    return Image.new('RGBA', (W, H), (0,0,0,0))

def mockup(art, title, subtitle, on_dark=True):
    out = Image.new('RGB', (1100, 900), '#e7e3dc')
    d = ImageDraw.Draw(out)
    d.text((36, 20), title[:58].upper(), font=font('d', 22), fill=INK[:3])
    d.text((36, 50), subtitle.upper(), font=font('dc', 15), fill=RED[:3])
    fill = '#1a1a1a' if on_dark else '#f3efe8'
    pts = [(320,140),(250,180),(190,310),(270,350),(300,290),(295,720),(620,720),(615,290),(645,350),(725,310),(665,180),(595,140)]
    d.polygon(pts, fill=fill)
    d.arc((405,118,520,188), 0, 180, fill='#777', width=3)
    a = art.copy()
    bb = a.getbbox()
    if bb: a = a.crop(bb)
    a.thumbnail((300, 360), Image.Resampling.LANCZOS)
    out.paste(a, (325+(280-a.width)//2, 270+(340-a.height)//2), a)
    d.text((36, 850), 'ORIGINAL FLAT PREVIEW / NOT A COLOR OR SCALE PROOF', font=font('d', 14), fill=(90,90,90))
    return out

def brand_footer(im, y=4850, color=INK, with_circle=False):
    if with_circle:
        circle_mark(im, ((W-220)//2, y-40), 220)
        draw_centered_line(im, 'FREEPLUG', y+220, 'e', color, 3000, 100, cap=90)
    else:
        m = mono_img(160, color)
        paste(im, m, ((W-m.width)//2, y))
        draw_centered_line(im, 'FREEPLUG', y+180, 'e', color, 2800, 90, cap=80)

def thin_rule(im, y, color=RED, width=2400, thickness=8):
    d = ImageDraw.Draw(im)
    x0 = (W-width)//2
    d.rectangle([x0, y, x0+width, y+thickness], fill=color)

# ========== VERSE DATA (verified excerpts) ==========
VERSES = [
  dict(n=1, slug='01-proverbs-19-17', ref='PROVERBS 19:17', book='Proverbs 19:17',
       text='He that hath pity upon the poor lendeth unto the LORD.',
       motif='hand', layout='stacked-serif',
       note='First clause of full verse; second clause omitted without ellipsis (kept as given).'),
  dict(n=2, slug='02-deuteronomy-15-11', ref='DEUTERONOMY 15:11', book='Deuteronomy 15:11',
       text='Thou shalt open thine hand wide unto thy brother, to thy poor, and to thy needy.',
       motif='hand', layout='open-hand-hero',
       note='Middle of full verse; omitted leading frame and trailing "in thy land" (kept as given).'),
  dict(n=3, slug='03-proverbs-22-9', ref='PROVERBS 22:9', book='Proverbs 22:9',
       text='He that hath a bountiful eye shall be blessed; for he giveth of his bread to the poor.',
       motif='bread', layout='bread-split',
       note='Exact full verse match.'),
  dict(n=4, slug='04-psalm-41-1', ref='PSALM 41:1', book='Psalm 41:1',
       text='Blessed is he that considereth the poor.',
       motif='none', layout='large-blessed',
       note='First clause; second clause about LORD delivering omitted (kept as given). Ref printed as PSALM (common); source page is Psalms 41:1.'),
  dict(n=5, slug='05-isaiah-58-10', ref='ISAIAH 58:10', book='Isaiah 58:10',
       text='If thou draw out thy soul to the hungry... then shall thy light rise in obscurity.',
       motif='light', layout='light-rise',
       note='Dropped leading And; ellipsis marks omitted middle; trailing clause about darkness/noonday omitted (kept as given). Ellipsis rendered as three periods if needed.'),
  dict(n=6, slug='06-matthew-25-40', ref='MATTHEW 25:40', book='Matthew 25:40',
       text='Inasmuch as ye have done it unto one of the least of these my brethren, ye have done it unto me.',
       motif='heart', layout='two-column-feel',
       note='Exact match of the Inasmuch...me portion inside the full verse.'),
  dict(n=7, slug='07-acts-20-35', ref='ACTS 20:35', book='Acts 20:35',
       text='It is more blessed to give than to receive.',
       motif='none', layout='cursive-hero',
       note='Exact quote of the Lord Jesus words within the verse.'),
  dict(n=8, slug='08-hebrews-13-16', ref='HEBREWS 13:16', book='Hebrews 13:16',
       text='To do good and to communicate forget not.',
       motif='none', layout='rule-framed',
       note='Dropped leading But and trailing sacrifice clause (kept as given).'),
  dict(n=9, slug='09-1-john-3-18', ref='1 JOHN 3:18', book='1 John 3:18',
       text='Let us not love in word... but in deed and in truth.',
       motif='heart', layout='deed-truth',
       note='Dropped My little children; ellipsis marks omitted neither in tongue (kept as given).'),
  dict(n=10, slug='10-galatians-2-10', ref='GALATIANS 2:10', book='Galatians 2:10',
       text='Remember the poor.',
       motif='circle', layout='minimal-bold',
       note='Core phrase from full verse; capitalized as given.'),
]

def sanitize_text(t):
    # FP fonts: prefer ASCII ellipsis as three periods if … missing; we checked … exists in cmap but middle-dot didn't historically — use ...
    return t.replace('…', '...').replace('·', '-')

def build_layout(v):
    im = canvas()
    text = sanitize_text(v['text'])
    layout = v['layout']
    mx = int(W * 0.08)
    max_w = W - 2*mx

    if layout == 'stacked-serif':
        # motif top, verse in Dispatch, ref, brand
        hand = motif_open_hand(700, INK)
        paste(im, hand, ((W-hand.width)//2, 520))
        h, _, _ = draw_wrapped(im, text, 1400, 'd', INK, max_w, 2200, cap=200, floor=70)
        thin_rule(im, 1400+h+80, RED, 900, 10)
        draw_centered_line(im, v['ref'] + '  -  KJV', 1400+h+140, 'dc', RED, max_w, 120, cap=90)
        brand_footer(im, 4700, INK)

    elif layout == 'open-hand-hero':
        hand = motif_open_hand(1100, RED)
        paste(im, hand, ((W-hand.width)//2, 380))
        h, _, _ = draw_wrapped(im, text, 1650, 'e', INK, max_w, 2400, cap=170, floor=60)
        draw_centered_line(im, v['ref'] + '  -  KJV', 1650+h+120, 'd', RED, max_w, 120, cap=85)
        m = mono_img(180, INK); paste(im, m, ((W-m.width)//2, 4800))
        draw_centered_line(im, 'FREEPLUG', 5000, 'e', INK, 2400, 80, cap=70)

    elif layout == 'bread-split':
        bread = motif_bread(650, INK, RED)
        paste(im, bread, ((W-bread.width)//2, 480))
        # split at semicolon if present
        if ';' in text:
            a, b = text.split(';', 1)
            a, b = a.strip()+';', b.strip()
            h1, _, _ = draw_wrapped(im, a, 1300, 'c', INK, max_w, 900, cap=160, floor=55)
            h2, _, _ = draw_wrapped(im, b, 1300+h1+80, 'd', INK, max_w, 1200, cap=150, floor=55)
            h = h1+h2+80
        else:
            h, _, _ = draw_wrapped(im, text, 1300, 'd', INK, max_w, 2200, cap=160, floor=55)
        draw_centered_line(im, v['ref'] + '  -  KJV', 1300+h+160, 'dc', RED, max_w, 110, cap=85)
        brand_footer(im, 4750, INK)

    elif layout == 'large-blessed':
        # lead word huge
        lead = 'Blessed'
        rest = text[len('Blessed'):].strip() if text.startswith('Blessed') else text
        draw_centered_line(im, lead, 900, 'eb', RED, max_w, 500, cap=420)
        thin_rule(im, 1500, INK, 700, 8)
        h, _, _ = draw_wrapped(im, rest, 1650, 'c', INK, max_w, 1800, cap=200, floor=70)
        draw_centered_line(im, v['ref'] + '  -  KJV', 1650+h+160, 'd', INK, max_w, 120, cap=90)
        circle_mark(im, ((W-280)//2, 4600), 280)
        draw_centered_line(im, 'FREEPLUG', 4950, 'e', INK, 2400, 80, cap=70)

    elif layout == 'light-rise':
        light = motif_light(800, INK, RED)
        paste(im, light, ((W-light.width)//2, 420))
        # two parts around ellipsis
        if '...' in text:
            a, b = text.split('...', 1)
            h1, _, _ = draw_wrapped(im, a.strip(), 1400, 'd', INK, max_w, 1000, cap=150, floor=55)
            draw_centered_line(im, '...', 1400+h1+40, 'eb', RED, 800, 120, cap=100)
            h2, _, _ = draw_wrapped(im, b.strip(), 1400+h1+200, 'c', INK, max_w, 1200, cap=160, floor=55)
            h = h1+h2+200
        else:
            h, _, _ = draw_wrapped(im, text, 1400, 'd', INK, max_w, 2200, cap=150, floor=55)
        draw_centered_line(im, v['ref'] + '  -  KJV', 1400+h+140, 'dc', RED, max_w, 110, cap=85)
        brand_footer(im, 4750, INK)

    elif layout == 'two-column-feel':
        # centered stack with heart motif and strong Extended
        heart = motif_heart_plug(520, INK, RED)
        paste(im, heart, ((W-heart.width)//2, 420))
        h, _, _ = draw_wrapped(im, text, 1100, 'e', INK, max_w-200, 2800, cap=150, floor=52)
        thin_rule(im, 1100+h+100, RED, 1100, 10)
        draw_centered_line(im, v['ref'] + '  -  KJV', 1100+h+160, 'd', RED, max_w, 110, cap=85)
        draw_centered_line(im, 'FREEPLUG', 4900, 'e', INK, 2400, 90, cap=75)

    elif layout == 'cursive-hero':
        # short verse — big cursive
        h, _, _ = draw_wrapped(im, text, 1400, 'c', INK, max_w-100, 2000, cap=260, floor=90)
        thin_rule(im, 1400+h+120, RED, 600, 10)
        draw_centered_line(im, v['ref'] + '  -  KJV', 1400+h+200, 'd', RED, max_w, 120, cap=95)
        circle_mark(im, ((W-320)//2, 420), 320)
        draw_centered_line(im, 'FREEPLUG', 4800, 'e', INK, 2400, 90, cap=80)

    elif layout == 'rule-framed':
        # top and bottom rules framing verse
        thin_rule(im, 1100, RED, 2800, 12)
        h, _, _ = draw_wrapped(im, text, 1400, 'eb', INK, max_w-200, 2200, cap=180, floor=70)
        thin_rule(im, 1400+h+160, RED, 2800, 12)
        draw_centered_line(im, v['ref'] + '  -  KJV', 1400+h+260, 'dc', INK, max_w, 120, cap=90)
        m = mono_img(200, INK); paste(im, m, ((W-m.width)//2, 4600))
        draw_centered_line(im, 'FREEPLUG', 4850, 'e', INK, 2400, 90, cap=75)

    elif layout == 'deed-truth':
        heart = motif_heart_plug(480, INK, RED)
        paste(im, heart, ((W-heart.width)//2, 500))
        if '...' in text:
            a, b = text.split('...', 1)
            h1, _, _ = draw_wrapped(im, a.strip(), 1200, 'd', INK, max_w, 900, cap=160, floor=60)
            draw_centered_line(im, '...', 1200+h1+30, 'eb', RED, 600, 100, cap=90)
            h2, _, _ = draw_wrapped(im, b.strip(), 1200+h1+180, 'c', RED, max_w, 1000, cap=180, floor=70)
            h = h1+h2+180
        else:
            h, _, _ = draw_wrapped(im, text, 1200, 'd', INK, max_w, 2200, cap=160, floor=60)
        draw_centered_line(im, v['ref'] + '  -  KJV', 1200+h+160, 'd', INK, max_w, 110, cap=85)
        brand_footer(im, 4750, INK)

    elif layout == 'minimal-bold':
        # giant short line
        circle_mark(im, ((W-900)//2, 700), 900)
        draw_centered_line(im, text.upper() if len(text)<24 else text, 2000, 'eb', INK, max_w, 700, cap=320)
        thin_rule(im, 2900, RED, 800, 10)
        draw_centered_line(im, v['ref'] + '  -  KJV', 3050, 'd', RED, max_w, 140, cap=100)
        draw_centered_line(im, 'FREEPLUG', 4700, 'e', INK, 2800, 120, cap=100)

    else:
        h, _, _ = draw_wrapped(im, text, 1200, 'd', INK, max_w, 2500, cap=180, floor=60)
        draw_centered_line(im, v['ref'] + '  -  KJV', 1200+h+120, 'd', RED, max_w, 120, cap=90)
        brand_footer(im, 4700, INK)

    return binary(im)

LIGHT = ["white","ivory","natural","cream","light ash","ash","heather","athletic heather","sand","beige","light grey","light gray","pink","baby pink","yellow","gold","orange","carolina blue","kelly","light blue"]
DARK = ["black","charcoal","navy","dark navy","dark heather","black heather","dark grey","dark gray","cranberry","maroon","forest","olive","brown","classic navy","j. navy"]

entries = []
for v in VERSES:
    folder = ROOT / v['slug']
    folder.mkdir(parents=True, exist_ok=True)
    light = build_layout(v)
    dark = invert_for_dark(light)
    lp = folder / f"{v['slug']}-light-garment.png"
    dp = folder / f"{v['slug']}-dark-garment.png"
    light.save(lp, dpi=(300,300))
    dark.save(dp, dpi=(300,300))
    mp = folder / 'mockup.png'
    mockup(dark, f"{v['n']:02d} {v['book']}", 'giving-verses / freeplug tee / 4500x5400', True).save(mp)
    entries.append(dict(
        number=v['n'], slug=v['slug'], book=v['book'], ref=v['ref'],
        text=sanitize_text(v['text']), layout=v['layout'], motif=v['motif'],
        verification_note=v['note'],
        files={
            lp.name: dict(ink='dark charcoal + brand red', allowed=LIGHT, never=DARK),
            dp.name: dict(ink='ivory + brand red (ivory outline)', allowed=DARK, never=LIGHT),
            'mockup.png': dict(ink='preview', allowed=[], never=[]),
        },
        paths=dict(light=str(lp), dark=str(dp), mockup=str(mp)),
    ))
    print('built', v['slug'])

# overview contact sheet
cols, rows = 5, 2
cell_w, cell_h = 420, 520
sheet = Image.new('RGB', (40 + cols*cell_w, 90 + rows*cell_h), '#e7e3dc')
d = ImageDraw.Draw(sheet)
d.text((28, 18), 'FREEPLUG GIVING-VERSES / 10 KJV TEE DESIGNS', font=font('d', 26), fill=INK[:3])
d.text((28, 52), 'Verified against kingjamesbibleonline.org  -  light/dark garment  -  no Printify', font=font('dc', 14), fill=RED[:3])
for i, e in enumerate(entries):
    m = Image.open(e['paths']['mockup'])
    m.thumbnail((cell_w-24, cell_h-60), Image.Resampling.LANCZOS)
    x = 20 + (i % cols) * cell_w
    y = 90 + (i // cols) * cell_h
    sheet.paste(m, (x + (cell_w-m.width)//2, y))
    d.text((x+8, y+cell_h-48), f"{e['number']:02d} {e['book']}", font=font('dc', 13), fill=INK[:3])
sheet.save(ROOT/'overview.png')

# MANIFEST
lines = [
    '# Freeplug Giving-Verses — Tee Designs',
    '',
    'Ten Freeplug-branded tee designs, one per KJV excerpt about giving to the poor. These replace the Luke 6:38 verse on Freeplug tees.',
    '',
    '**Source check:** kingjamesbibleonline.org (WebFetch). Excerpts kept as provided; differences noted below.',
    '',
    '**Print size:** 4500×5400 transparent PNG. Contrast: `-light-garment` (dark ink) / `-dark-garment` (ivory ink; red outlined in ivory).',
    '',
    '**Rules:** No AI mention, no street address, no trademarked marks. No Printify / site uploads. No paid image generation.',
    '',
    '## Inventory',
    '',
]
for e in entries:
    lines += [
        f"### {e['number']:02d} — {e['book']}",
        f"- **Folder:** `{e['slug']}/`",
        f"- **Text (as printed):** {e['text']}",
        f"- **Reference line:** {e['ref']} - KJV",
        f"- **Layout / motif:** {e['layout']} / {e['motif']}",
        f"- **Verification:** {e['verification_note']}",
        f"- **Light garment:** `{Path(e['paths']['light']).name}` → light blanks only",
        f"- **Dark garment:** `{Path(e['paths']['dark']).name}` → dark blanks only",
        f"- **Mockup:** `mockup.png`",
        '',
    ]
lines += [
    '## Overview',
    '- `overview.png` — contact sheet of all 10',
    '',
    '## Verification summary',
    '- Proverbs 19:17, Psalm 41:1, Hebrews 13:16, Galatians 2:10: excerpts are leading/core clauses of longer verses; omitted remainder not marked with ellipsis (kept as given).',
    '- Deuteronomy 15:11: middle excerpt; omitted "in thy land" and verse opening (kept as given).',
    '- Isaiah 58:10 / 1 John 3:18: ellipses mark omitted interior words (kept as given); leading And / My little children dropped.',
    '- Proverbs 22:9: exact full verse.',
    '- Matthew 25:40 / Acts 20:35: exact match of the quoted portion within the full verse.',
    '- LORD kept in all caps where present (Proverbs 19:17).',
    '- Ellipsis character normalized to ASCII `...` for font safety.',
]
(ROOT/'MANIFEST.md').write_text('\n'.join(lines))
(ROOT/'manifest.json').write_text(json.dumps({'entries': entries, 'source': 'https://www.kingjamesbibleonline.org/'}, indent=2))

# Update CONTRAST_MAP
cm_path = Path('/workspace/logos/freeplug/merch/CONTRAST_MAP.json')
cm = json.loads(cm_path.read_text())
cm['mappings'] = [m for m in cm.get('mappings', []) if not str(m.get('item','')).startswith('tshirts/giving-verses/')]
created = cm.setdefault('created_files', [])
for e in entries:
    files = {}
    for fn, info in e['files'].items():
        if 'mockup' in fn: continue
        files[fn] = {
            'ink': info['ink'],
            'allowed_blank_colors': info['allowed'],
            'never': info['never'],
        }
        p = str(ROOT/e['slug']/fn)
        if p not in created:
            created.append(p)
    cm['mappings'].append({'item': f"tshirts/giving-verses/{e['slug']}", 'files': files})
cm_path.write_text(json.dumps(cm, indent=2))
print('DONE', len(entries))
