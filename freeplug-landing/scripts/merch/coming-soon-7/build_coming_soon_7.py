#!/usr/bin/env python3
"""Freeplug coming-soon-7 buyer-shop print art. Specs from Freeplug Lead. No paid gens."""
from __future__ import annotations
from pathlib import Path
import io, json, re, math
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import numpy as np
from scipy import ndimage as nd
import cairosvg

ROOT = Path('/workspace/logos/freeplug/merch/coming-soon-7')
ROOT.mkdir(parents=True, exist_ok=True)
Image.MAX_IMAGE_PIXELS = None

RED = (186, 61, 61, 255)
INK = (17, 17, 17, 255)
IVORY = (247, 243, 234, 255)
CHAR = (34, 34, 34, 255)
GRAY = (90, 90, 90, 255)

FDIR = Path('/workspace/logos/FP/fonts/ttf')
CDIR = Path('/workspace/logos/freeplug/cursive/ttf')
MONO = re.search(r'd="([^"]+)"', Path('/workspace/logos/FP/svg/fp-monogram-black.svg').read_text()).group(1)

def font(kind, size):
    p = {
        'eb': FDIR/'FPExtended-Black.ttf',
        'e': FDIR/'FPExtended-Bold.ttf',
        'd': FDIR/'FreeplugDispatch-Bold.ttf',
        'dc': FDIR/'FreeplugDispatch-CondensedHeadline.ttf',
        'c': CDIR/'FPCursive-Bold.ttf',
        'cl': CDIR/'FPCursive-Light.ttf',
    }[kind]
    return ImageFont.truetype(str(p), size)

def fit_text(draw, text, kind, max_w, max_h, cap=900):
    size = cap
    while size > 12:
        f = font(kind, size)
        b = draw.textbbox((0, 0), text, font=f)
        if b[2]-b[0] <= max_w and b[3]-b[1] <= max_h:
            return f, b
        size -= 2
    f = font(kind, 12)
    return f, draw.textbbox((0, 0), text, font=f)

def draw_text(im, text, xy, kind, color, max_w, max_h, cap=900, align='center', stroke=0, stroke_fill=None):
    d = ImageDraw.Draw(im)
    f, b = fit_text(d, text, kind, max_w, max_h, cap)
    tw, th = b[2]-b[0], b[3]-b[1]
    if align == 'center':
        x = xy[0] + (max_w - tw)//2 - b[0]
    elif align == 'left':
        x = xy[0] - b[0]
    else:
        x = xy[0] + max_w - tw - b[0]
    y = xy[1] - b[1]
    kw = {}
    if stroke:
        kw.update(stroke_width=stroke, stroke_fill=stroke_fill or color)
    d.text((x, y), text, font=f, fill=color, **kw)
    return th

def mono_img(size, color):
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 1024 1024"><path d="{MONO}" fill="rgb({color[0]},{color[1]},{color[2]})"/></svg>'
    a = Image.open(io.BytesIO(cairosvg.svg2png(bytestring=svg.encode()))).convert('RGBA')
    bb = a.getbbox()
    if bb:
        a = a.crop(bb)
    a.thumbnail((size, size), Image.Resampling.LANCZOS)
    out = Image.new('RGBA', (size, size), (0,0,0,0))
    out.alpha_composite(a, ((size-a.width)//2, (size-a.height)//2))
    return out

def paste(im, art, xy):
    im.alpha_composite(art, xy)

def circle_mark(im, xy, diam, ring=RED, fill=IVORY):
    d = ImageDraw.Draw(im)
    d.ellipse([xy[0], xy[1], xy[0]+diam, xy[1]+diam], fill=ring)
    m = mono_img(int(diam*0.62), fill)
    paste(im, m, (xy[0]+(diam-m.width)//2, xy[1]+(diam-m.height)//2 + int(diam*0.02)))

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
        ring = nd.binary_dilation(redish, iterations=max(3, int(min(a.shape[:2])*0.002))) & ~redish
        a[ring, :3] = np.array(IVORY[:3], dtype=np.uint8)
        a[ring, 3] = 255
        a[redish, :3] = np.array(RED[:3], dtype=np.uint8)
        a[redish, 3] = 255
    return binary(Image.fromarray(a))

def margin_box(w, h, pct=0.07):
    mx, my = int(w*pct), int(h*pct)
    return mx, my, w-mx, h-my

def canvas(w, h):
    return Image.new('RGBA', (w, h), (0,0,0,0))

def save_png(im, path, dpi=300):
    path.parent.mkdir(parents=True, exist_ok=True)
    binary(im).save(path, dpi=(dpi, dpi))

def mockup_generic(art, title, subtitle, bg='#e7e3dc', surface='#f3efe8', shape='rect'):
    out = Image.new('RGB', (1200, 900), bg)
    d = ImageDraw.Draw(out)
    d.text((36, 22), title[:60].upper(), font=font('d', 24), fill=INK[:3])
    d.text((36, 54), subtitle.upper(), font=font('dc', 16), fill=RED[:3])
    # surface frame
    if shape == 'square':
        box = (300, 140, 900, 740)
        d.rounded_rectangle(box, radius=28, fill=surface, outline='#bbb', width=2)
    elif shape == 'banner':
        box = (420, 120, 780, 780)
        d.rounded_rectangle(box, radius=18, fill=surface, outline='#999', width=2)
        # pole
        d.rectangle((595, 90, 605, 120), fill='#777')
    elif shape == 'board':
        box = (250, 180, 950, 720)
        d.rounded_rectangle(box, radius=12, fill='#f8f8f8', outline='#ccc', width=2)
        # glass sheen
        d.rectangle((250, 180, 950, 220), fill='#eef6ff')
    elif shape == 'metal':
        box = (340, 120, 860, 780)
        d.rounded_rectangle(box, radius=8, fill='#2a2a2a', outline='#555', width=3)
        surface = '#2a2a2a'
    elif shape == 'bracelet':
        box = (150, 380, 1050, 520)
        d.rounded_rectangle(box, radius=40, fill='#c9b39a', outline='#8a7358', width=2)
        # beads
        for i in range(8):
            cx = 200 + i*100
            d.ellipse((cx-28, 410, cx+28, 490), fill='#a89078', outline='#6e5844')
        # bar
        d.rounded_rectangle((420, 430, 780, 470), radius=6, fill='#d8c8b0', outline='#8a7358')
    else:  # canvas
        box = (340, 100, 860, 780)
        d.rectangle(box, fill=surface, outline='#aaa', width=2)
        # shadow
        d.rectangle((348, 788, 868, 798), fill='#ccc')

    # paste art fitted into box with padding
    a = art.copy().convert('RGBA')
    bb = a.getbbox()
    if bb:
        a = a.crop(bb)
    pad = 40 if shape != 'bracelet' else 10
    max_w = box[2]-box[0]-pad*2
    max_h = box[3]-box[1]-pad*2
    a.thumbnail((max_w, max_h), Image.Resampling.LANCZOS)
    px = box[0] + (box[2]-box[0]-a.width)//2
    py = box[1] + (box[3]-box[1]-a.height)//2
    out.paste(a, (px, py), a)
    d.text((36, 850), 'ORIGINAL FLAT PREVIEW / NOT A COLOR OR SCALE PROOF', font=font('d', 15), fill=(90,90,90))
    return out

LIGHT_BLANKS = ["white","ivory","natural","cream","light ash","ash","heather","athletic heather","sand","beige","light grey","light gray","pink","baby pink","yellow","gold","orange","carolina blue","kelly","light blue"]
DARK_BLANKS = ["black","charcoal","navy","dark navy","dark heather","black heather","dark grey","dark gray","cranberry","maroon","forest","olive","brown","classic navy","j. navy"]

items_meta = []

# ========== 1. FANNY PACK 468 / 3000x3000 ==========
slug = 'fanny-pack-468'
folder = ROOT/slug
W=H=3000
im = canvas(W,H)
x0,y0,x1,y1 = margin_box(W,H,0.08)
# circle mark top
diam = 1100
circle_mark(im, ((W-diam)//2, y0+80), diam)
draw_text(im, 'STAY CHARGED', (x0, y0+1300), 'eb', INK, x1-x0, 280, cap=220)
draw_text(im, 'FREEPLUG', (x0, y0+1650), 'e', RED, x1-x0, 200, cap=160)
draw_text(im, 'ON THE GO', (x0, y0+1950), 'd', INK, x1-x0, 140, cap=110)
light = binary(im)
dark = invert_for_dark(light)
save_png(light, folder/'front-light-garment.png')
save_png(dark, folder/'front-dark-garment.png')
mock = mockup_generic(dark, '01 Fanny Pack — Stay Charged', 'bp 468 / Printify Choice 99 / 3000x3000', surface='#1a1a1a', shape='square')
mock.save(folder/'mockup.png')
items_meta.append(dict(
    slug=slug, name='Fanny Pack — Stay Charged', blueprint=468, blueprint_name='Fanny Pack',
    provider=99, provider_name='Printify Choice', print_area='front', size=[3000,3000],
    orientation='square', files={
        'front-light-garment.png': dict(ink='dark charcoal + brand red', allowed=LIGHT_BLANKS, never=DARK_BLANKS),
        'front-dark-garment.png': dict(ink='ivory + brand red (ivory outline)', allowed=DARK_BLANKS, never=LIGHT_BLANKS),
        'mockup.png': dict(ink='preview', allowed=[], never=[]),
    }, notes='Safe margin ~8%. Color-variable fabric.'
))

# ========== 2. GLASS CUTTING BOARD 938 / 3000x3000 ==========
slug = 'glass-cutting-board-938'
folder = ROOT/slug
W=H=3000
im = canvas(W,H)
x0,y0,x1,y1 = margin_box(W,H,0.07)
# kitchen mark: circle + measuring/give line
diam = 900
circle_mark(im, ((W-diam)//2, y0+120), diam, ring=RED, fill=IVORY)
draw_text(im, 'Give, and it shall', (x0, y0+1150), 'c', INK, x1-x0, 220, cap=200)
draw_text(im, 'be given unto you', (x0, y0+1420), 'c', INK, x1-x0, 220, cap=200)
draw_text(im, 'LUKE 6:38 - KJV', (x0, y0+1750), 'd', RED, x1-x0, 120, cap=100)
draw_text(im, 'FREEPLUG', (x0, y0+2000), 'e', INK, x1-x0, 160, cap=130)
# dark ink for clear/white glass (primary)
light = binary(im)  # dark ink -> light/clear surface
# light ink version for dark-tinted glass variants if any
dark = invert_for_dark(light)
save_png(light, folder/'front-light-surface.png')
save_png(dark, folder/'front-dark-surface.png')
mock = mockup_generic(light, '02 Glass Cutting Board — Luke 6:38', 'bp 938 / Pic The Gift 92 / 3000x3000', shape='board')
mock.save(folder/'mockup.png')
items_meta.append(dict(
    slug=slug, name='Glass Cutting Board — Luke 6:38 KJV', blueprint=938, blueprint_name='Glass Cutting Board',
    provider=92, provider_name='Pic The Gift', print_area='front', size=[3000,3000],
    orientation='square', files={
        'front-light-surface.png': dict(ink='dark charcoal + brand red', allowed=['clear glass','white glass','frosted light'], never=['dark tinted glass']),
        'front-dark-surface.png': dict(ink='ivory + brand red', allowed=['dark tinted glass'], never=['clear glass','white glass']),
        'mockup.png': dict(ink='preview', allowed=[], never=[]),
    }, notes='Primary: dark ink on clear/white glass (2 variants). Exact KJV first clause. Margin ~7%.'
))

# ========== 3. GARDEN & HOUSE BANNER 976 / 3000x3000 portrait-safe ==========
slug = 'garden-house-banner-976'
folder = ROOT/slug
W=H=3000
im = canvas(W,H)
# portrait-safe column in center of square
col_w = int(W*0.62)
cx0 = (W-col_w)//2
x0,y0,x1,y1 = margin_box(W,H,0.08)
# constrain text to portrait column
px0, px1 = cx0, cx0+col_w
# hills-like bands (drawn, not Krea)
d = ImageDraw.Draw(im)
# sky band
d.ellipse([px0-40, y0+80, px1+40, y0+520], fill=RED)
# hill shapes
d.polygon([(px0-20,y0+480),(px0+col_w*0.3,y0+340),(px0+col_w*0.55,y0+460),(px0+col_w*0.8,y0+360),(px1+20,y0+500),(px1+20,y0+620),(px0-20,y0+620)], fill=INK)
d.polygon([(px0-20,y0+560),(px0+col_w*0.25,y0+480),(px0+col_w*0.5,y0+560),(px0+col_w*0.75,y0+500),(px1+20,y0+580),(px1+20,y0+700),(px0-20,y0+700)], fill=CHAR)
circle_mark(im, (px0+(col_w-700)//2, y0+740), 700)
draw_text(im, 'WELCOME', (px0, y0+1550), 'eb', INK, col_w, 200, cap=160)
draw_text(im, 'HOME', (px0, y0+1780), 'c', RED, col_w, 260, cap=220)
draw_text(im, 'SAN MARCOS', (px0, y0+2100), 'd', INK, col_w, 120, cap=100)
draw_text(im, 'FREEPLUG', (px0, y0+2280), 'e', INK, col_w, 140, cap=110)
light = binary(im)
dark = invert_for_dark(light)
save_png(light, folder/'front-light-surface.png')
save_png(dark, folder/'front-dark-surface.png')
mock = mockup_generic(light, '03 Garden Banner — Welcome Home', 'bp 976 / Pic The Gift 92 / 3000x3000 portrait-safe', shape='banner')
mock.save(folder/'mockup.png')
items_meta.append(dict(
    slug=slug, name='Garden & House Banner — Welcome Home', blueprint=976, blueprint_name='Garden & House Banner',
    provider=92, provider_name='Pic The Gift', print_area='front', size=[3000,3000],
    orientation='portrait-safe-in-square', files={
        'front-light-surface.png': dict(ink='dark + brand red', allowed=LIGHT_BLANKS+['white banner'], never=DARK_BLANKS),
        'front-dark-surface.png': dict(ink='ivory + brand red', allowed=DARK_BLANKS+['black banner'], never=LIGHT_BLANKS),
        'mockup.png': dict(ink='preview', allowed=[], never=[]),
    }, notes='Vertical layout centered in square print area. Margin ~8%. No street address.'
))

# ========== 4. MATTE CANVAS 1.25" 1159 / 3600x4800 — faith Running Over ==========
slug = 'matte-canvas-stretched-1-25-1159'
folder = ROOT/slug
W,H = 3600,4800
im = canvas(W,H)
# opaque ivory full bleed background for canvas (wrap-friendly)
bg = Image.new('RGBA', (W,H), IVORY)
# key art centered with large quiet margins (~8% + crop tolerance)
x0,y0,x1,y1 = margin_box(W,H,0.10)
# decorative measuring cup (vector drawn)
d = ImageDraw.Draw(bg)
cx, cy = W//2, y0 + 900
# cup body
d.rounded_rectangle([cx-420, cy-200, cx+420, cy+520], radius=40, fill=None, outline=INK, width=28)
d.arc([cx+380, cy-40, cx+560, cy+280], 270, 90, fill=INK, width=28)
# hearts overflowing
for hx,hy,r in [(cx-120,cy-280,70),(cx+40,cy-340,90),(cx+180,cy-260,60),(cx-40,cy-180,50),(cx+100,cy-160,55)]:
    # heart approx as two circles + triangle
    d.ellipse([hx-r, hy-r, hx, hy+r//2], fill=RED)
    d.ellipse([hx, hy-r, hx+r, hy+r//2], fill=RED)
    d.polygon([(hx-r,hy-r//4),(hx+r,hy-r//4),(hx,hy+r)], fill=RED)
draw_text(bg, 'RUNNING OVER', (x0, cy+620), 'eb', RED, x1-x0, 260, cap=220)
draw_text(bg, 'Give, and it shall', (x0, cy+980), 'c', INK, x1-x0, 220, cap=180)
draw_text(bg, 'be given unto you', (x0, cy+1240), 'c', INK, x1-x0, 220, cap=180)
draw_text(bg, 'LUKE 6:38 - KJV', (x0, cy+1580), 'd', RED, x1-x0, 140, cap=110)
# small mark near bottom center (crop-safe)
m = mono_img(280, INK)
paste(bg, m, ((W-m.width)//2, y1-400))
draw_text(bg, 'FREEPLUG', (x0, y1-280), 'e', INK, x1-x0, 140, cap=100)
# canvases typically one surface (ivory printed wrap) — provide opaque print
save_png(bg, folder/'front.png')
# also transparent art-only for flexibility
art_only = canvas(W,H)
art_only.alpha_composite(ImageChops if False else bg)  # noop guard
# rebuild transparent version of key elements only for light/dark surface naming
im2 = canvas(W,H)
d2 = ImageDraw.Draw(im2)
cx, cy = W//2, y0 + 900
d2.rounded_rectangle([cx-420, cy-200, cx+420, cy+520], radius=40, outline=INK, width=28)
d2.arc([cx+380, cy-40, cx+560, cy+280], 270, 90, fill=INK, width=28)
for hx,hy,r in [(cx-120,cy-280,70),(cx+40,cy-340,90),(cx+180,cy-260,60),(cx-40,cy-180,50),(cx+100,cy-160,55)]:
    d2.ellipse([hx-r, hy-r, hx, hy+r//2], fill=RED)
    d2.ellipse([hx, hy-r, hx+r, hy+r//2], fill=RED)
    d2.polygon([(hx-r,hy-r//4),(hx+r,hy-r//4),(hx,hy+r)], fill=RED)
draw_text(im2, 'RUNNING OVER', (x0, cy+620), 'eb', RED, x1-x0, 260, cap=220)
draw_text(im2, 'Give, and it shall', (x0, cy+980), 'c', INK, x1-x0, 220, cap=180)
draw_text(im2, 'be given unto you', (x0, cy+1240), 'c', INK, x1-x0, 220, cap=180)
draw_text(im2, 'LUKE 6:38 - KJV', (x0, cy+1580), 'd', RED, x1-x0, 140, cap=110)
m = mono_img(280, INK); paste(im2, m, ((W-m.width)//2, y1-400))
draw_text(im2, 'FREEPLUG', (x0, y1-280), 'e', INK, x1-x0, 140, cap=100)
save_png(im2, folder/'front-art-transparent.png')
mock = mockup_generic(bg, '04 Canvas 1.25" — Running Over', 'bp 1159 / Roma 450 / 3600x4800 crop-tolerant', shape='canvas', surface='#f7f3ea')
mock.save(folder/'mockup.png')
items_meta.append(dict(
    slug=slug, name='Matte Canvas 1.25" — Running Over (Luke 6:38)', blueprint=1159,
    blueprint_name='Matte Canvas, Stretched, 1.25"', provider=450, provider_name='Roma Imaging',
    print_area='front', size=[3600,4800], orientation='portrait', files={
        'front.png': dict(ink='full ivory background + dark/red art', allowed=['matte canvas wrap'], never=[]),
        'front-art-transparent.png': dict(ink='transparent art only', allowed=['reference'], never=[]),
        'mockup.png': dict(ink='preview', allowed=[], never=[]),
    }, notes='Art-led, key elements centered with ~10% margin for 52-size crop tolerance. Exact KJV clause. Distinct from #5.'
))

# ========== 5. MATTE CANVAS 0.75" 937 / 3600x4800 — distinct San Marcos Plug ==========
slug = 'matte-canvas-stretched-0-75-multi-size-937'
folder = ROOT/slug
W,H = 3600,4800
bg = Image.new('RGBA', (W,H), IVORY)
x0,y0,x1,y1 = margin_box(W,H,0.10)
d = ImageDraw.Draw(bg)
# abstract hill landscape (distinct from #4)
# sky wash band
d.rectangle([0,0,W,int(H*0.42)], fill=(232,220,205,255))
# hills
d.polygon([(0,int(H*0.38)),(int(W*0.25),int(H*0.28)),(int(W*0.45),int(H*0.36)),(int(W*0.7),int(H*0.24)),(W,int(H*0.34)),(W,int(H*0.48)),(0,int(H*0.48))], fill=RED)
d.polygon([(0,int(H*0.44)),(int(W*0.3),int(H*0.36)),(int(W*0.55),int(H*0.44)),(int(W*0.8),int(H*0.38)),(W,int(H*0.46)),(W,int(H*0.55)),(0,int(H*0.55))], fill=INK)
# river curve
pts = []
for i in range(40):
    t = i/39
    x = int(W*(0.35+0.12*math.sin(t*math.pi*2)))
    y = int(H*(0.40 + t*0.12))
    pts.append((x,y))
for i in range(len(pts)-1):
    d.line([pts[i], pts[i+1]], fill=IVORY, width=36)
# centered brand stack (crop safe)
draw_text(bg, 'SAN MARCOS', (x0, int(H*0.58)), 'eb', INK, x1-x0, 280, cap=240)
draw_text(bg, 'PLUG', (x0, int(H*0.66)), 'c', RED, x1-x0, 360, cap=320)
diam = 720
circle_mark(bg, ((W-diam)//2, int(H*0.76)), diam)
draw_text(bg, 'FREEPLUG', (x0, int(H*0.92)), 'e', INK, x1-x0, 140, cap=110)
save_png(bg, folder/'front.png')
# transparent art companion
im2 = canvas(W,H)
d2 = ImageDraw.Draw(im2)
d2.polygon([(0,int(H*0.38)),(int(W*0.25),int(H*0.28)),(int(W*0.45),int(H*0.36)),(int(W*0.7),int(H*0.24)),(W,int(H*0.34)),(W,int(H*0.48)),(0,int(H*0.48))], fill=RED)
d2.polygon([(0,int(H*0.44)),(int(W*0.3),int(H*0.36)),(int(W*0.55),int(H*0.44)),(int(W*0.8),int(H*0.38)),(W,int(H*0.46)),(W,int(H*0.55)),(0,int(H*0.55))], fill=INK)
for i in range(len(pts)-1):
    d2.line([pts[i], pts[i+1]], fill=IVORY, width=36)
draw_text(im2, 'SAN MARCOS', (x0, int(H*0.58)), 'eb', INK, x1-x0, 280, cap=240)
draw_text(im2, 'PLUG', (x0, int(H*0.66)), 'c', RED, x1-x0, 360, cap=320)
circle_mark(im2, ((W-diam)//2, int(H*0.76)), diam)
draw_text(im2, 'FREEPLUG', (x0, int(H*0.92)), 'e', INK, x1-x0, 140, cap=110)
save_png(im2, folder/'front-art-transparent.png')
mock = mockup_generic(bg, '05 Canvas 0.75" — San Marcos Plug', 'bp 937 / Roma 450 / 3600x4800 crop-tolerant', shape='canvas', surface='#f7f3ea')
mock.save(folder/'mockup.png')
items_meta.append(dict(
    slug=slug, name='Matte Canvas 0.75" Multi-Size — San Marcos Plug', blueprint=937,
    blueprint_name='Matte Canvas, Stretched, 0.75" (Multi-Size)', provider=450, provider_name='Roma Imaging',
    print_area='front', size=[3600,4800], orientation='portrait', files={
        'front.png': dict(ink='full ivory/cream background + dark/red art', allowed=['matte canvas wrap'], never=[]),
        'front-art-transparent.png': dict(ink='transparent art only', allowed=['reference'], never=[]),
        'mockup.png': dict(ink='preview', allowed=[], never=[]),
    }, notes='Distinct from #4 (landscape + San Marcos Plug). ~10% margin, centered for 60-size crop tolerance. Reuses bp 937 / Roma 450 (Lead: Roma; prior merch used Jondo 105 — Lead spec wins).'
))

# ========== 6. METAL ART SIGN 1206 / 3600x4800 ==========
slug = 'metal-art-sign-1206'
folder = ROOT/slug
W,H = 3600,4800
im = canvas(W,H)
x0,y0,x1,y1 = margin_box(W,H,0.08)
diam = 1600
circle_mark(im, ((W-diam)//2, y0+200), diam)
draw_text(im, 'YOU KNOW', (x0, y0+2000), 'd', INK, x1-x0, 200, cap=160)
draw_text(im, 'A PLUG', (x0, y0+2300), 'eb', RED, x1-x0, 360, cap=300)
draw_text(im, 'FREEPLUG', (x0, y0+2850), 'e', INK, x1-x0, 200, cap=150)
draw_text(im, 'EST. SAN MARCOS', (x0, y0+3200), 'dc', INK, x1-x0, 120, cap=90)
light = binary(im)
dark = invert_for_dark(light)
# metal signs often dark metal or white metal — both
save_png(light, folder/'front-light-surface.png')
save_png(dark, folder/'front-dark-surface.png')
mock = mockup_generic(dark, '06 Metal Art Sign — You Know a Plug', 'bp 1206 / Printify Choice 99 / 3600x4800', shape='metal')
mock.save(folder/'mockup.png')
items_meta.append(dict(
    slug=slug, name='Metal Art Sign — You Know a Plug', blueprint=1206, blueprint_name='Metal Art Sign',
    provider=99, provider_name='Printify Choice', print_area='front', size=[3600,4800],
    orientation='portrait', files={
        'front-light-surface.png': dict(ink='dark + brand red', allowed=['white metal','silver light'], never=['black metal','dark bronze']),
        'front-dark-surface.png': dict(ink='ivory + brand red', allowed=['black metal','dark bronze','charcoal metal'], never=['white metal']),
        'mockup.png': dict(ink='preview', allowed=[], never=[]),
    }, notes='Portrait. Margin ~8%. No street address (city pride only).'
))

# ========== 7. BRACELET ENGRAVING 2651 / 1560x240 ==========
slug = 'natural-stone-stretch-bar-bracelet-engraving-2651'
folder = ROOT/slug
W,H = 1560,240
# Engraving: pure black, simple, tiny-safe
# Design: FREEPLUG wordmark centered, or fp mono + FREEPLUG
# Keep strokes bold — use Dispatch condensed / Extended Black at large size for short bar

def bracelet_svg_and_png():
    # Build SVG with fontTools path for FREEPLUG
    from fontTools.ttLib import TTFont
    from fontTools.pens.svgPathPen import SVGPathPen
    from fontTools.pens.transformPen import TransformPen
    from fontTools.misc.transform import Transform

    text = 'FREEPLUG'
    ttf = TTFont(str(FDIR/'FPExtended-Black.ttf'))
    glyph_set = ttf.getGlyphSet()
    cmap = ttf.getBestCmap()
    # measure
    from fontTools.pens.boundsPen import BoundsPen
    pen_b = BoundsPen(glyph_set)
    x = 0
    gs = []
    for ch in text:
        gname = cmap.get(ord(ch))
        if not gname:
            continue
        g = glyph_set[gname]
        bp = BoundsPen(glyph_set); g.draw(bp)
        gs.append((gname, g, x, g.width))
        x += g.width
    total_w = x
    # target box with margin ~8%
    mx, my = int(W*0.08), int(H*0.18)
    aw, ah = W - 2*mx, H - 2*my
    # scale to fit
    # font units typically ~1000 UPM
    upm = ttf['head'].unitsPerEm
    # get bounds of full string
    minx=miny=10**9; maxx=maxy=-10**9
    for gname,g,ox,_ in gs:
        bp = BoundsPen(glyph_set); g.draw(bp)
        if bp.bounds:
            a,b,c,d = bp.bounds
            minx=min(minx,a+ox); maxx=max(maxx,c+ox); miny=min(miny,b); maxy=max(maxy,d)
    gw, gh = maxx-minx, maxy-miny
    scale = min(aw/gw, ah/gh)
    # center
    ox = mx + (aw - gw*scale)/2 - minx*scale
    oy = my + (ah - gh*scale)/2 + maxy*scale  # SVG y-down flip later

    paths = []
    for gname,g,gx,_ in gs:
        sp = SVGPathPen(glyph_set)
        # flip Y and scale
        tr = Transform(scale, 0, 0, -scale, ox + gx*scale, oy)
        tp = TransformPen(sp, tr)
        g.draw(tp)
        paths.append(sp.getCommands())

    svg = f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">
  <!-- Freeplug bracelet engraving. Pure black. Laser-safe. -->
  <g fill="#000000">
    {''.join(f'<path d="{p}"/>' for p in paths)}
  </g>
</svg>
'''
    (folder/'engraving.svg').write_text(svg)
    png = Image.open(io.BytesIO(cairosvg.svg2png(bytestring=svg.encode(), output_width=W, output_height=H))).convert('RGBA')
    # force pure black
    a = np.array(png)
    mask = a[:,:,3] > 128
    a[mask, :3] = 0
    a[mask, 3] = 255
    a[~mask] = 0
    Image.fromarray(a).save(folder/'engraving.png', dpi=(300,300))
    return Image.fromarray(a)

folder.mkdir(parents=True, exist_ok=True)
br = bracelet_svg_and_png()
mock = mockup_generic(br, '07 Stone Bracelet — FREEPLUG Engraving', 'bp 2651 / Fulfill Engine 217 / 1560x240', shape='bracelet')
mock.save(folder/'mockup.png')
items_meta.append(dict(
    slug=slug, name='Natural Stone Stretch Bar Bracelet — FREEPLUG Engraving', blueprint=2651,
    blueprint_name='Natural Stone Stretch Bar Bracelet (Engraving)', provider=217, provider_name='Fulfill Engine',
    print_area='engraving', size=[1560,240], orientation='landscape-bar', files={
        'engraving.png': dict(ink='pure black (laser)', allowed=['stone bar engraving'], never=[]),
        'engraving.svg': dict(ink='vector black', allowed=['stone bar engraving'], never=[]),
        'mockup.png': dict(ink='preview', allowed=[], never=[]),
    }, notes='Engraving only. Pure black on transparent. Simple FREEPLUG Extended Black wordmark. Margin ~8% x / ~18% y. No gradients/fine detail.'
))

# ========== OVERVIEW ==========
# 7 mockups in a contact sheet
cols, rows = 4, 2
cell_w, cell_h = 560, 440
sheet = Image.new('RGB', (40+cols*cell_w, 80+rows*cell_h), '#e7e3dc')
d = ImageDraw.Draw(sheet)
d.text((30, 22), 'FREEPLUG COMING-SOON-7 / BUYER SHOP PRINT ART', font=font('d', 28), fill=INK[:3])
d.text((30, 52), 'Lead specs. Local files only. No Printify uploads.', font=font('dc', 16), fill=RED[:3])
for i, meta in enumerate(items_meta):
    mpath = ROOT/meta['slug']/'mockup.png'
    m = Image.open(mpath)
    m.thumbnail((cell_w-30, cell_h-50), Image.Resampling.LANCZOS)
    x = 20 + (i%cols)*cell_w
    y = 80 + (i//cols)*cell_h
    sheet.paste(m, (x+(cell_w-m.width)//2, y))
    d.text((x+10, y+cell_h-40), f"{i+1}. {meta['slug'][:42]}", font=font('dc', 14), fill=INK[:3])
sheet.save(ROOT/'overview.png')

# ========== MANIFEST ==========
lines = [
    '# Freeplug Coming-Soon-7 — Buyer Shop Print Art',
    '',
    'Lead-provided blueprint/provider/size specs. Local files only. No Printify product creation or uploads. No Krea / paid generation.',
    '',
    '## Contrast rule',
    'Dark ink only on light surfaces/garments. Light (ivory) ink only on dark surfaces/garments. Brand red preserved; ivory outline on dark versions. See `/workspace/logos/freeplug/merch/CONTRAST_MAP.json`.',
    '',
    '## Safe margin',
    'About 5–8% (canvases ~10% for multi-size crop tolerance). Exact print areas to be re-checked later.',
    '',
    '## Inventory',
    '',
]
for i, m in enumerate(items_meta, 1):
    lines += [
        f"### {i}. {m['name']}",
        f"- **Slug / folder:** `{m['slug']}/`",
        f"- **Blueprint:** {m['blueprint']} — {m['blueprint_name']}",
        f"- **Provider:** {m['provider']} — {m['provider_name']}",
        f"- **Print area:** {m['print_area']} @ {m['size'][0]}×{m['size'][1]} ({m['orientation']})",
        f"- **Notes:** {m['notes']}",
        '- **Files:**',
    ]
    for fn, info in m['files'].items():
        allowed = ', '.join(info['allowed'][:8]) + ('…' if len(info['allowed'])>8 else '')
        never = ', '.join(info['never'][:6]) + ('…' if len(info['never'])>6 else '')
        lines.append(f"  - `{m['slug']}/{fn}` — ink: {info['ink']}" + (f" | allowed: {allowed}" if allowed else '') + (f" | NEVER: {never}" if never else ''))
    lines.append('')

lines += [
    '## Overview',
    '- `overview.png` — contact sheet of all 7 mockups',
    '',
    '## Assumptions',
    '- Canvas provider listed as Roma Imaging (450) per Lead (prior running-over-canvas used Jondo 105; Lead wins).',
    '- Glass cutting board: dark-ink file is primary for clear/white glass; light-ink companion included for dark-tinted variants.',
    '- Garden banner: art laid out portrait-safe in the center column of the square 3000×3000 area.',
    '- Bracelet: Extended Black wordmark FREEPLUG only; no mono (too fine for 240px-tall engraving).',
    '- No street address. Faith text is exact KJV Luke 6:38 first clause where used.',
]
(ROOT/'MANIFEST.md').write_text('\n'.join(lines))
(ROOT/'manifest.json').write_text(json.dumps({'items': items_meta}, indent=2))

# ========== UPDATE CONTRAST_MAP.json ==========
cm_path = Path('/workspace/logos/freeplug/merch/CONTRAST_MAP.json')
cm = json.loads(cm_path.read_text())
# remove prior coming-soon-7 mappings if any
cm['mappings'] = [m for m in cm.get('mappings', []) if not str(m.get('item','')).startswith('coming-soon-7/')]
created = cm.setdefault('created_files', [])
for m in items_meta:
    files = {}
    for fn, info in m['files'].items():
        if fn.endswith('.png') and 'mockup' not in fn and 'transparent' not in fn:
            files[fn] = {
                'ink': info['ink'],
                'allowed_blank_colors': info['allowed'],
                'never': info['never'],
            }
            p = str(ROOT/m['slug']/fn)
            if p not in created:
                created.append(p)
    if files:
        cm['mappings'].append({'item': f"coming-soon-7/{m['slug']}", 'files': files})

cm_path.write_text(json.dumps(cm, indent=2))
print('DONE', len(items_meta), 'items')
for m in items_meta:
    print('-', m['slug'], m['size'], list(m['files']))
