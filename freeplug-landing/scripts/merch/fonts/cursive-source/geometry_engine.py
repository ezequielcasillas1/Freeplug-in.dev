"""Original Freeplug outlines and font production. Run from the project venv."""
from pathlib import Path
import math, json, string, re, shutil
from shapely.geometry import LineString, Polygon, Point, GeometryCollection
from shapely.ops import unary_union
from shapely import affinity
from shapely.geometry.polygon import orient
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.pens.t2CharStringPen import T2CharStringPen
from fontTools.pens.basePen import BasePen
from fontTools.svgLib.path import parse_path
from fontTools.ttLib import TTFont
from fontTools.feaLib.builder import addOpenTypeFeaturesFromString
from PIL import Image, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parent.parent
COPYRIGHT='Copyright 2026 Ezequiel Casillas with the 72 After team. All rights reserved.'
LICENSE='Created by Ezequiel Casillas with the 72 After team. See the accompanying standalone or bundle license for permitted uses. Do not resell, share, or redistribute the font files. Freeplug name and logo are trademarks of Freeplug.'

class Flatten(BasePen):
    def __init__(self): super().__init__(None); self.paths=[]; self.p=[]
    def _moveTo(self,p):
        if self.p:self.paths.append(self.p)
        self.p=[p]
    def _lineTo(self,p): self.p.append(p)
    def _curveToOne(self,p1,p2,p3):
        p0=self.p[-1]
        for n in range(1,33):
            t=n/32; u=1-t
            self.p.append(tuple(u**3*p0[i]+3*u*u*t*p1[i]+3*u*t*t*p2[i]+t**3*p3[i] for i in range(2)))
    def _qCurveToOne(self,p1,p2):
        p0=self.p[-1]
        for n in range(1,21):
            t=n/20;u=1-t
            self.p.append(tuple(u*u*p0[i]+2*u*t*p1[i]+t*t*p2[i] for i in range(2)))
    def _closePath(self):
        if self.p and self.p[-1]!=self.p[0]:self.p.append(self.p[0])
        self.paths.append(self.p);self.p=[]
    def _endPath(self):
        if self.p:self.paths.append(self.p);self.p=[]

def paths(d):
    p=Flatten();parse_path(d,p)
    if p.p:p.paths.append(p.p)
    return p.paths

def stroke(d,s,rounded=False):
    return unary_union([LineString(p).buffer(s/2,cap_style=1 if rounded else 2,join_style=1,quad_segs=12) for p in paths(d) if len(p)>1])

def oval(cx,cy,rx,ry):
    k=.55228475
    return f'M {cx+rx} {cy} C {cx+rx} {cy+k*ry} {cx+k*rx} {cy+ry} {cx} {cy+ry} C {cx-k*rx} {cy+ry} {cx-rx} {cy+k*ry} {cx-rx} {cy} C {cx-rx} {cy-k*ry} {cx-k*rx} {cy-ry} {cx} {cy-ry} C {cx+k*rx} {cy-ry} {cx+rx} {cy-k*ry} {cx+rx} {cy} Z'

# Centerlines drawn here, not extracted from any existing typeface.
UP={
'A':'M 55 0 L 285 700 L 515 0 M 133 235 L 437 235',
'B':'M 85 0 L 85 700 L 300 700 C 570 700 570 370 300 370 L 85 370 M 300 370 C 590 370 595 0 300 0 L 85 0',
'C':'M 515 605 C 405 750 75 735 75 350 C 75 -35 405 -50 515 95',
'D':'M 85 0 L 85 700 L 275 700 C 630 700 630 0 275 0 Z',
'E':'M 505 700 L 85 700 L 85 0 L 505 0 M 85 355 L 440 355',
'F':'M 85 0 L 85 700 L 505 700 M 85 375 L 435 375',
'G':'M 515 605 C 405 750 75 735 75 350 C 75 -25 410 -45 530 100 L 530 325 L 330 325',
'H':'M 85 0 L 85 700 M 515 0 L 515 700 M 85 355 L 515 355',
'I':'M 90 0 L 90 700',
'J':'M 410 700 L 410 170 C 410 -55 80 -55 80 165',
'K':'M 85 0 L 85 700 M 515 700 L 85 280 M 270 460 L 535 0',
'L':'M 85 700 L 85 0 L 490 0',
'M':'M 85 0 L 85 700 L 350 190 L 615 700 L 615 0',
'N':'M 85 0 L 85 700 L 515 0 L 515 700',
'O':oval(300,350,235,360),
'P':'M 85 0 L 85 700 L 300 700 C 595 700 595 335 300 335 L 85 335',
'Q':oval(300,350,235,360)+' M 350 160 L 560 -85',
'R':'M 85 0 L 85 700 L 300 700 C 595 700 595 355 300 355 L 85 355 M 300 355 L 545 0',
'S':'M 505 605 C 405 765 90 740 85 540 C 80 330 525 400 525 175 C 525 -40 195 -65 70 100',
'T':'M 25 700 L 575 700 M 300 700 L 300 0',
'U':'M 85 700 L 85 220 C 85 -95 515 -95 515 220 L 515 700',
'V':'M 45 700 L 285 0 L 525 700',
'W':'M 45 700 L 205 0 L 385 555 L 565 0 L 725 700',
'X':'M 55 700 L 525 0 M 525 700 L 55 0',
'Y':'M 45 700 L 285 345 L 525 700 M 285 345 L 285 0',
'Z':'M 65 700 L 525 700 L 65 0 L 525 0',
'0':oval(285,350,210,355),
'1':'M 90 560 L 245 700 L 245 0 M 80 0 L 430 0',
'2':'M 70 555 C 70 780 500 780 500 550 C 500 400 120 155 70 0 L 515 0',
'3':'M 70 605 C 190 785 500 730 500 535 C 500 420 390 355 250 355 M 250 355 C 590 385 605 -35 285 -15 C 185 -15 95 30 55 95',
'4':'M 420 0 L 420 700 L 55 200 L 560 200',
'5':'M 505 700 L 115 700 L 85 375 C 500 540 660 65 335 -10 C 220 -40 110 20 60 95',
'6':'M 475 650 C 260 825 65 585 65 290 C 65 -110 525 -100 525 210 C 525 495 145 495 75 275',
'7':'M 50 700 L 535 700 L 205 0',
'8':oval(285,520,200,185)+' '+oval(285,180,225,195),
'9':'M 95 50 C 310 -125 505 115 505 410 C 505 810 45 800 45 490 C 45 205 425 205 495 425',
}
LO={
'a':oval(260,245,185,250)+' M 445 0 L 445 510 C 445 715 145 735 85 595',
'b':'M 85 0 L 85 735 M 85 390 C 170 570 490 580 490 255 C 490 -70 170 -65 85 110',
'c':'M 460 440 C 345 585 75 545 75 255 C 75 -35 345 -75 460 70',
'd':'M 490 0 L 490 735 M 490 390 C 405 570 85 580 85 255 C 85 -70 405 -65 490 110',
'e':'M 85 265 L 485 265 C 485 610 75 595 75 255 C 75 -35 345 -70 470 70',
'f':'M 135 0 L 135 555 C 135 735 255 785 355 715 M 20 505 L 335 505',
'g':oval(265,255,190,255)+' M 455 510 L 455 -55 C 455 -265 185 -275 85 -150',
'h':'M 85 0 L 85 735 M 85 345 C 165 585 465 585 465 330 L 465 0',
'i':'M 95 0 L 95 510',
'j':'M 215 510 L 215 -75 C 215 -220 95 -255 20 -185',
'k':'M 85 0 L 85 735 M 470 510 L 85 180 M 250 325 L 490 0',
'l':'M 95 735 L 95 90 C 95 5 130 -15 190 0',
'm':'M 85 0 L 85 510 M 85 355 C 150 585 400 585 400 330 L 400 0 M 400 355 C 465 585 715 585 715 330 L 715 0',
'n':'M 85 0 L 85 510 M 85 345 C 165 585 465 585 465 330 L 465 0',
'o':oval(280,255,205,265),
'p':'M 85 -235 L 85 510 M 85 390 C 170 570 490 580 490 255 C 490 -70 170 -65 85 110',
'q':'M 490 -235 L 490 510 M 490 390 C 405 570 85 580 85 255 C 85 -70 405 -65 490 110',
'r':'M 85 0 L 85 510 M 85 320 C 145 535 265 565 370 485',
's':'M 420 440 C 330 570 85 550 85 395 C 85 235 435 290 435 130 C 435 -45 175 -55 65 70',
 't':'M 145 685 L 145 120 C 145 -20 245 -35 340 20 M 25 505 L 340 505',
'u':'M 85 510 L 85 175 C 85 -85 385 -85 465 155 M 465 510 L 465 0',
'v':'M 45 510 L 255 0 L 465 510',
'w':'M 40 510 L 185 0 L 360 420 L 535 0 L 680 510',
'x':'M 60 510 L 465 0 M 465 510 L 60 0',
'y':'M 45 510 L 255 0 M 465 510 L 185 -190 C 160 -245 90 -255 35 -220',
'z':'M 65 510 L 465 510 L 65 0 L 465 0',
}
# The double-storey a uses a 510-unit upper curve: compact and distinct from the uppercase.
LO['a']=oval(250,180,175,180)+' M 425 0 L 425 330 C 425 575 160 565 85 440'
PUN={
'.':None, ',':'M 125 55 C 125 -15 110 -70 55 -110', ':':None,';':'M 125 55 C 125 -15 110 -70 55 -110',
'!':'M 100 700 L 100 180','?':'M 55 565 C 55 780 445 785 445 565 C 445 435 250 415 250 220 L 250 180',
"'":'M 95 710 L 75 535','"':'M 95 710 L 75 535 M 250 710 L 230 535',
'-':'M 55 265 L 330 265','–':'M 50 265 L 520 265','—':'M 50 265 L 820 265',
'_':'M 25 -135 L 535 -135','/':'M 30 -95 L 430 755','\\':'M 30 755 L 430 -95',
'(':'M 245 770 C 35 585 35 105 245 -90',')':'M 65 770 C 275 585 275 105 65 -90',
'[':'M 255 770 L 90 770 L 90 -90 L 255 -90',']':'M 65 770 L 230 770 L 230 -90 L 65 -90',
'{':'M 275 770 C 125 770 125 710 125 540 C 125 390 80 350 35 340 C 80 330 125 290 125 140 C 125 -30 125 -90 275 -90',
'}':'M 35 770 C 185 770 185 710 185 540 C 185 390 230 350 275 340 C 230 330 185 290 185 140 C 185 -30 185 -90 35 -90',
'+':'M 55 315 L 515 315 M 285 85 L 285 545','=':'M 55 420 L 515 420 M 55 210 L 515 210',
'<':'M 435 565 L 75 315 L 435 65','>':'M 75 565 L 435 315 L 75 65',
'*':'M 245 730 L 245 330 M 55 590 L 435 470 M 55 470 L 435 590',
'#':'M 210 710 L 100 -10 M 440 710 L 330 -10 M 35 230 L 500 230 M 65 470 L 530 470',
'|':'M 95 780 L 95 -160','~':'M 45 270 C 165 440 325 100 445 270',
'^':'M 45 460 L 235 710 L 425 460','`':'M 75 730 L 195 590',
'$':UP['S']+' M 285 800 L 285 -100',
'%':oval(155,540,115,150)+' '+oval(445,160,115,150)+' M 70 -10 L 530 710',
'&':'M 540 0 L 175 425 C -80 725 480 845 445 550 C 425 405 65 375 65 175 C 65 -90 440 -85 525 200 L 580 365',
'@':oval(345,320,300,345)+' '+oval(345,330,145,180)+' M 490 510 L 490 205 C 490 75 655 115 650 335',
'‘':'M 165 745 C 100 710 95 650 95 585', '’':'M 95 745 C 95 680 90 620 25 585',
'“':'M 165 745 C 100 710 95 650 95 585 M 335 745 C 270 710 265 650 265 585',
'”':'M 95 745 C 95 680 90 620 25 585 M 265 745 C 265 680 260 620 195 585',
'€':'M 505 605 C 395 750 100 735 100 350 C 100 -35 395 -50 505 95 M 20 440 L 400 440 M 20 275 L 360 275',
'£':'M 70 0 L 505 0 M 50 330 L 395 330 M 130 0 C 230 130 130 350 130 535 C 130 760 395 785 495 620',
}
ORIG_STROKES=[
'M688 262 C650 258 570 262 525 263 C478 264 462 285 450 315 L360 520',
'M360 520 C330 590 300 660 240 668 C190 674 180 615 205 565 C240 495 320 455 400 445',
'M400 445 L535 432', 'M652 375 L522 765',
'M628 470 C660 410 710 388 750 392 C822 398 836 470 812 538 C785 608 715 628 665 618 C632 611 615 595 605 578']

def mark(weight,part=None,exact=False):
    if exact and part is None:
        shape=GeometryCollection()
        for p in paths((ROOT/'source/original-fp-monogram.d').read_text()):
            shape=shape.symmetric_difference(Polygon(p).buffer(0))
    else:
        ss=ORIG_STROKES if part is None else ORIG_STROKES[:3] if part=='F' else ORIG_STROKES[3:]
        shape=unary_union([stroke(d,weight,True) for d in ss])
    return affinity.affine_transform(shape,[1.38,0,0,-1.38,0,705*1.38])

def glyph_shape(ch,weight,fp):
    rounded=fp
    s=weight
    if ch in UP:shape=stroke(UP[ch],s,rounded)
    elif ch in LO:
        shape=stroke(LO[ch],s,rounded)
        if ch in 'ij':shape=unary_union([shape,Point(95 if ch=='i' else 215,675).buffer(s*.60,quad_segs=12)])
    elif ch in PUN:
        shape=stroke(PUN[ch],s*.82,rounded) if PUN[ch] else GeometryCollection()
        for x,y in ({'.':[(95,32)],':':[(95,32),(95,390)],';':[(125,390)],'!':[(100,32)],'?':[(250,32)]}.get(ch,[])):
            shape=unary_union([shape,Point(x,y).buffer(s*.63,quad_segs=12)])
    elif ch=='…':shape=unary_union([Point(x,32).buffer(s*.63,quad_segs=12) for x in (80,260,440)])
    elif ch=='•':shape=Point(100,290).buffer(s*1.15,quad_segs=16)
    elif ch=='°':shape=stroke(oval(125,610,85,85),s*.65,rounded)
    else:shape=GeometryCollection()
    # Normalize skeleton vertical extremes so weight doesn't alter cap height.
    if ch in UP:
        shape=affinity.scale(shape,yfact=700/(700+s),xfact=1,origin=(0,350))
    elif ch in LO:
        # Lowercase baseline roundovers remain optically overshot.
        shape=affinity.scale(shape,yfact=510/(510+s*.75),xfact=1,origin=(0,255))
    return shape

def contour_polys(shape):
    if shape.is_empty:return []
    if shape.geom_type=='Polygon':return [shape]
    return [p for p in shape.geoms if p.geom_type=='Polygon']

def drawshape(pen,shape):
    # TrueType clockwise outer contours, counterclockwise counters.
    for p in contour_polys(shape.simplify(.36,preserve_topology=True)):
        p=orient(p,sign=-1)
        for ring in [p.exterior,*p.interiors]:
            pts=[(round(x),round(y)) for x,y in list(ring.coords)[:-1]]
            # Rounding can create duplicate vertices; discard them.
            pts=[p for i,p in enumerate(pts) if i==0 or p!=pts[i-1]]
            if len(set(pts))<3:continue
            pen.moveTo(pts[0])
            for pt in pts[1:]:pen.lineTo(pt)
            pen.closePath()

def gname(c):return 'uni%04X'%ord(c)

FONTS=[]

def build(family,style,weight,width=1.0,slant=0,outline=False,fp=False,markweight=72):
    chars=list(dict.fromkeys(' '+string.ascii_uppercase+string.ascii_lowercase+string.digits+string.punctuation+'‘’“”–—…•°€£\u00a0'))
    cmap={ord(c):gname(c) for c in chars}
    shapes={'.notdef':Polygon([(0,0),(440,0),(440,700),(0,700)],holes=[[(65,65),(375,65),(375,635),(65,635)]])}
    metrics={'.notdef':(550,55)}
    for c in chars:
        name=gname(c)
        if c in ' \u00a0':shapes[name]=GeometryCollection();metrics[name]=(290,0);continue
        cc=c.upper() if fp and c.islower() else c
        sh=glyph_shape(cc,weight,fp)
        if fp and outline:sh=sh.difference(sh.buffer(-15,join_style=1))
        sh=affinity.affine_transform(sh,[width,slant,0,1,0,0])
        if sh.is_empty:raise ValueError(('Empty glyph',c))
        x0,y0,x1,y1=sh.bounds
        sb=(28 if family=='FP Cursive' else 52) if fp else 48
        if c in '.,:;!\'"‘’“”':sb=60
        sh=affinity.translate(sh,xoff=sb-x0)
        shapes[name]=sh
        metrics[name]=(round((x1-x0)+2*sb),sb)
    if fp:
        for n,part in [('fpMark',None),('F.mark','F'),('P.mark','P')]:
            sh=mark(markweight,part,exact=style=='Regular')
            if outline:sh=sh.difference(sh.buffer(-15,join_style=1))
            if style=='Italic':sh=affinity.skew(sh,8,0,origin=(0,0))
            x0,_,x1,_=sh.bounds;sh=affinity.translate(sh,xoff=50-x0)
            shapes[n]=sh;metrics[n]=(round(x1-x0+100),50)
        cmap[0xE000]='fpMark'
    if family=='FP Cursive':
        base=shapes['uni0045'];advance=metrics['uni0045'][0]-25
        # A hand-tuned flowing double-E join at the lower exit, not universal joins.
        y=125
        cut=base.intersection(LineString([(-1000,y),(3000,y)]))
        xleft,_,xright,_=cut.bounds
        x1=xright-5;x2=advance+xleft+5
        link=stroke(f'M {x1} {y} C {x1+35} {y+25} {x2-35} {y+25} {x2} {y}',weight*.68,True)
        shapes['EE.liga']=unary_union([base,affinity.translate(base,xoff=advance),link])
        metrics['EE.liga']=(advance+metrics['uni0045'][0],28)
    order=list(shapes)
    kern={}
    for pair,value in [('AV',-65),('AW',-45),('AY',-65),('AT',-35),('FA',-40),('LT',-42),('LV',-45),('LY',-55),('PA',-45),('TA',-45),('TO',-20),('VA',-65),('WA',-40),('YA',-60),('YO',-35),('Yo',-45),('To',-45),('Ta',-50),('Te',-40),('Ty',-35),('Wa',-30),('Wo',-30),('Va',-40),('Ve',-40),('Vo',-40),('Ya',-50),('Ye',-45),('Fo',-25),('Pa',-30),('r.',-20),('v.',-35),('w.',-25),('y.',-35)]:
        a,b=pair
        kern[(gname(a),gname(b))]=round(value*width)
    feat='languagesystem DFLT dflt; languagesystem latn dflt;\nfeature kern {\n'
    feat+='\n'.join(f'pos {a} {b} {v};' for (a,b),v in kern.items())+'\n} kern;\n'
    if fp:
        feat+='feature liga { sub uni0046 uni0050 by fpMark; sub uni0046 uni0070 by fpMark; sub uni0066 uni0070 by fpMark; } liga;\n'
        feat+='feature ss01 { sub uni0046 by F.mark; sub uni0050 by P.mark; sub uni0066 by F.mark; sub uni0070 by P.mark; } ss01;\n'
    if family=='FP Cursive':
        feat+='feature dlig { sub uni0045 uni0045 by EE.liga; sub uni0065 uni0065 by EE.liga; sub uni0045 uni0065 by EE.liga; sub uni0065 uni0045 by EE.liga; } dlig;\n'
    ps=family.replace(' ','')+'-'+style.replace(' ','')
    for kind in ['ttf','otf']:
        fb=FontBuilder(1000,isTTF=kind=='ttf');fb.setupGlyphOrder(order);fb.setupCharacterMap(cmap)
        if kind=='ttf':
            glyphs={}
            for n,sh in shapes.items():
                pen=TTGlyphPen(None);drawshape(pen,sh);glyphs[n]=pen.glyph()
            fb.setupGlyf(glyphs)
        else:
            cs={}
            for n,sh in shapes.items():
                pen=T2CharStringPen(metrics[n][0],None);drawshape(pen,sh);cs[n]=pen.getCharString(private=None,globalSubrs=None)
            fb.setupCFF(ps,{'FullName':family+' '+style,'FamilyName':family,'Weight':style,'Copyright':COPYRIGHT},cs,{})
        fb.setupHorizontalMetrics(metrics)
        fb.setupHorizontalHeader(ascent=930,descent=-310,lineGap=0)
        legacy_family=family if style in ['Regular','Bold','Italic'] else family+' '+style
        legacy_style=style if style in ['Regular','Bold','Italic'] else ('Bold' if style=='Condensed Headline' else 'Regular')
        fb.setupNameTable({'familyName':legacy_family,'styleName':legacy_style,'typographicFamily':family,'typographicSubfamily':style,'uniqueFontIdentifier':'Freeplug:2026:'+ps+':1.000','fullName':family+' '+style,'psName':ps,'version':'Version 1.000','copyright':COPYRIGHT,'manufacturer':'Ezequiel Casillas with the 72 After team','designer':'Ezequiel Casillas with the 72 After team','trademark':'Freeplug name and logo are trademarks of Freeplug.','description':'Original custom lettering for Freeplug branding and merchandise.','licenseDescription':LICENSE})
        wc={'Light':300,'Regular':400,'Bold':700,'Black':900,'Outline':400,'Italic':400,'Condensed Headline':700}[style]
        italic=style=='Italic';bold=style in ['Bold','Condensed Headline']
        fb.setupOS2(version=4,sTypoAscender=930,sTypoDescender=-310,sTypoLineGap=0,usWinAscent=1000,usWinDescent=350,usWeightClass=wc,usWidthClass=4 if width<.9 else 5,fsType=0,sxHeight=700 if fp else 510,sCapHeight=700,fsSelection=(1 if italic else 0)|(32 if bold else 0)|(64 if not italic and not bold else 0)|128)
        fb.setupPost(italicAngle=-math.degrees(math.atan(slant)) if slant else 0,underlinePosition=-140,underlineThickness=55)
        fb.font['head'].macStyle=(1 if bold else 0)|(2 if italic else 0)
        fb.setupMaxp()
        addOpenTypeFeaturesFromString(fb.font,feat)
        from fontTools.ttLib import newTable
        kt=newTable('kern');kt.version=0
        from fontTools.ttLib.tables._k_e_r_n import KernTable_format_0
        st=KernTable_format_0();st.version=0;st.coverage=1;st.kernTable=kern;kt.kernTables=[st];fb.font['kern']=kt
        out=ROOT/kind/(ps+'.'+kind);fb.save(out)
        # Both outline formats are independently rendered below.
        ff=TTFont(out);ff.ensureDecompiled();ff.close()
        ImageFont.truetype(str(out),42).getmask("FREEPLUG I Know a Plug It's so cheap it's free 0123456789")
    web=TTFont(ROOT/'ttf'/(ps+'.ttf'));web.flavor='woff2';web.save(ROOT/'woff2'/(ps+'.woff2'));web.close()
    wf=TTFont(ROOT/'woff2'/(ps+'.woff2'));wf.ensureDecompiled();wf.close()
    # FreeType does not accept WOFF2 directly: decode and render the same outlines.
    wf=TTFont(ROOT/'woff2'/(ps+'.woff2'));wf.flavor=None;wf.save(ROOT/'source'/'woff2-render-check.ttf')
    ImageFont.truetype(str(ROOT/'source'/'woff2-render-check.ttf'),42).getmask('Freeplug 0123456789')
    (ROOT/'source'/'woff2-render-check.ttf').unlink()
    FONTS.append({'family':family,'style':style,'basename':ps,'unicode_count':len(cmap),'glyph_count':len(order),'kern_pairs':len(kern),'formats':['ttf','otf','woff2']})

# Specimens use only the delivered custom faces for content. System sans labels are not font sources.
LABEL=str(ROOT/'ttf'/'FreeplugDispatch-Regular.ttf')
def specimen(family,filename):
    fs=[f for f in FONTS if f['family']==family]
    rowh=440 if family=='FP Extended' else 490
    W=1800;H=215+rowh*len(fs)+110
    im=Image.new('RGB',(W,H),'#f6f3eb');d=ImageDraw.Draw(im)
    def label(text,x,y,size=22,fill='#59605e'):
        d.text((x,y),text,font=ImageFont.truetype(LABEL,size),fill=fill)
    label('FREEPLUG  /  CUSTOM TYPE COLLECTION',70,35,23,'#8b1a1e')
    label(family,65,76,65,'#172823')
    label('ORIGINAL LETTERING  •  2026  •  DESKTOP + WEB',70,159,20)
    for i,f in enumerate(fs):
        y=215+rowh*i
        d.line((70,y,W-70,y),fill='#b9bfb5',width=2)
        label(f['style'].upper(),70,y+19,21,'#8b1a1e')
        p=ROOT/'ttf'/(f['basename']+'.ttf')
        def text(t,x,yy,size,fill='#172823'):
            font=ImageFont.truetype(str(p),size)
            while d.textlength(t,font=font)>W-x-75:
                size-=1;font=ImageFont.truetype(str(p),size)
            d.text((x,yy),t,font=font,fill=fill,anchor='lt')
        text('FREEPLUG',65,y+66,100)
        if family=='FP Extended':text('\ue000',1410,y+54,115,'#8b1a1e')
        text('I Know a Plug',70,y+178,57)
        text("It's so cheap it's free",730,y+178,57)
        text(string.ascii_uppercase,70,y+260,48)
        if family=='FP Extended':
            text('0123456789  & @ # $ % + - / ! ? . , : ;',70,y+330,42)
            label('Lowercase keys map to uppercase.  U+E000 = original Fp mark.  ss01 = script F / p.',70,y+393,19)
        else:
            text(string.ascii_lowercase,70,y+325,46)
            text('0123456789  & @ # $ % + - / ! ? . , : ;',70,y+393,40)
    label('EZEQUIEL CASILLAS / FREEPLUG  •  PRIVATE BRAND FONT FILES  •  VERSION 1.000',70,H-62,19)
    im.save(ROOT/filename)
    im.thumbnail((1200,2400));im.save(ROOT/filename.replace('.png','-review.png'))

if __name__=='__main__':
    for style,w,mw in [('Light',44,42),('Regular',76,72),('Bold',110,100),('Black',150,124),('Outline',110,100),('Italic',76,72)]:
        build('FP Extended',style,w,slant=.26 if style=='Italic' else .10,outline=style=='Outline',fp=True,markweight=mw)
    for style,w,width in [('Regular',76,1),('Bold',118,1),('Condensed Headline',118,.79)]:
        build('Freeplug Dispatch',style,w,width=width)
    specimen('FP Extended','specimen-fp-extended.png')
    specimen('Freeplug Dispatch','specimen-dispatch.png')
    (ROOT/'manifest.json').write_text(json.dumps(FONTS,indent=2)+'\n')
    print(json.dumps(FONTS,indent=2))
