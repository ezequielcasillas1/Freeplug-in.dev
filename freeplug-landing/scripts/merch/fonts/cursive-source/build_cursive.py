"""FP Cursive v2: a chunky mixed-case extension of the original Fp pen construction."""
from pathlib import Path
import math,string,json
import geometry_engine as e
from shapely.geometry import GeometryCollection,Point,Polygon,LineString
from shapely.ops import unary_union
from shapely import affinity
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.pens.t2CharStringPen import T2CharStringPen
from fontTools.ttLib import TTFont,newTable
from fontTools.ttLib.tables._k_e_r_n import KernTable_format_0
from fontTools.feaLib.builder import addOpenTypeFeaturesFromString
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parent.parent
e.ROOT=ROOT
CREDIT='Ezequiel Casillas with the 72 After team'
COPYRIGHT='Copyright 2026 '+CREDIT+'. All rights reserved.'
LICENSE='Created by '+CREDIT+'. See the accompanying standalone or bundle license for permitted uses. Do not resell, share, or redistribute font files. Freeplug name and logo are trademarks of Freeplug.'

# Original logo model: 72 source-unit monoline, round caps/joins, scaled 1.5x.
# All new letter centerlines below were drawn for this revision. F and p use
# the two actual components of the logo master in Regular, not approximations.
STEM='M 160 650 L 160 155 C 160 10 -70 -65 -100 65 C -130 195 30 260 160 275'
ASC='M 110 70 L 110 625 C 110 795 -90 785 -90 620 C -90 505 110 530 110 610'
LOW={
'a':e.oval(220,260,155,190)+' M 375 450 L 375 110 C 375 50 425 55 475 125',
'b':ASC+' M 110 340 C 235 555 475 495 460 265 C 450 65 260 -10 110 100',
'c':'M 395 405 C 290 555 65 480 60 265 C 55 60 270 -10 415 130',
'd':e.oval(220,260,155,190)+' M 375 110 L 375 625 C 375 795 175 785 175 620 C 175 505 375 530 375 610 M 375 110 C 375 50 425 55 475 125',
'e':'M 65 270 C 200 240 395 335 335 425 C 275 520 80 485 60 300 C 30 75 260 -10 415 140',
'f':'M 140 -170 L 140 515 C 140 655 190 685 350 675 M 25 330 C 135 345 270 350 365 335',
'g':e.oval(220,260,155,190)+' M 375 450 L 375 -70 C 375 -275 105 -255 100 -120 C 95 -15 235 45 375 65',
'h':ASC+' M 110 315 C 225 555 420 515 420 290 L 420 115 C 420 50 470 55 520 125',
'i':'M 120 425 L 120 115 C 120 50 170 55 220 125',
'j':'M 200 425 L 200 -75 C 200 -255 -40 -255 -45 -115 C -50 -15 95 45 200 65',
'k':ASC+' M 110 250 C 255 260 405 370 350 440 C 290 515 190 410 180 330 M 180 330 C 285 265 255 90 345 80 C 380 75 410 95 445 130',
'l':ASC+' M 110 110 C 110 30 190 40 260 130',
'm':'M 80 70 L 80 435 M 80 320 C 170 535 350 515 350 290 L 350 70 M 350 320 C 440 535 620 515 620 290 L 620 115 C 620 50 670 55 720 125',
'n':'M 85 70 L 85 435 M 85 320 C 195 535 400 515 400 290 L 400 115 C 400 50 450 55 500 125',
'o':e.oval(230,260,165,190)+' M 370 385 C 395 300 445 280 480 315',
'q':e.oval(220,260,155,190)+' M 375 450 L 375 -190 C 375 -235 430 -230 470 -175',
'r':'M 85 70 L 85 435 M 85 330 C 180 495 300 495 320 395 C 325 335 365 325 405 355',
's':'M 350 420 C 255 535 70 485 75 375 C 80 255 375 290 365 155 C 355 5 135 15 65 115',
"t":'M 155 650 L 155 165 C 155 35 255 40 335 130 M 25 415 C 115 440 245 445 345 430',
'u':'M 85 435 L 85 225 C 85 10 300 15 395 235 M 395 435 L 395 115 C 395 50 445 55 495 125',
'v':'M 60 435 C 75 315 100 170 165 85 C 210 25 280 135 340 260 C 375 335 395 395 400 440',
'w':'M 55 435 C 55 255 80 125 140 80 C 200 30 285 245 315 410 M 315 410 C 315 255 340 125 400 80 C 465 25 595 285 605 440',
'x':'M 75 425 C 190 480 240 135 340 90 C 365 80 390 95 420 130 M 405 435 C 305 365 180 120 65 80',
'y':'M 70 435 C 80 255 95 85 195 85 C 280 85 355 260 390 435 M 390 435 L 390 -65 C 390 -270 115 -255 110 -120 C 105 -10 250 45 390 65',
'z':'M 60 385 C 150 470 260 475 375 425 C 280 315 170 185 70 90 C 175 150 290 25 390 95 C 415 115 435 140 450 170',
}
CAP={
'A':'M -70 40 C 15 15 60 190 135 390 C 205 575 270 720 320 690 C 360 665 345 295 355 130 C 360 40 400 25 455 100 M 45 265 C 170 300 285 305 405 280',
'B':STEM+' M 160 635 C 430 775 595 560 435 400 C 370 340 245 340 160 350 M 160 350 C 485 485 620 125 370 45 C 255 10 185 25 160 70',
'C':'M 485 575 C 510 775 190 775 80 485 C -30 210 65 -35 295 55 C 375 85 440 135 485 210',
'D':STEM+' M 160 635 C 490 825 665 520 520 230 C 435 50 265 10 160 70',
'E':'M 485 595 C 500 790 155 750 100 555 C 60 410 185 345 320 375 M 320 375 C 115 395 15 245 85 105 C 145 -15 370 10 490 145',
'G':'M 485 575 C 510 775 190 775 80 485 C -30 210 65 -35 295 55 C 375 85 430 135 450 240 L 465 335 M 300 325 C 385 355 490 360 540 335 M 450 200 C 450 20 420 -125 310 -160',
'H':STEM+' M 160 330 C 280 380 390 380 505 345 M 505 650 L 505 125 C 505 40 550 35 595 100',
'I':'M 30 595 C 130 700 295 735 405 685 M 270 695 L 270 145 C 270 40 205 30 160 70 M 30 65 C 145 20 290 20 405 100',
'J':'M 45 600 C 180 730 355 735 465 685 M 380 695 L 380 80 C 380 -180 60 -230 40 -65 C 25 30 110 105 175 110',
'K':STEM+' M 520 680 C 455 515 315 395 160 300 M 300 395 C 410 310 395 135 465 75 C 495 50 530 60 565 105',
'L':STEM+' M 160 635 C 145 790 -70 775 -60 600 C -50 465 100 475 190 525 M 20 80 C 175 145 310 -10 430 70 C 465 95 490 125 515 160',
'M':STEM+' M 160 635 C 185 735 220 670 235 560 L 280 120 C 340 310 405 540 475 680 C 515 730 530 635 530 550 L 530 125 C 530 40 575 35 620 100',
'N':STEM+' M 160 635 C 185 735 225 620 245 505 L 350 115 C 370 30 420 90 430 195 L 480 680',
'O':e.oval(260,365,225,315)+' M 440 570 C 395 675 300 710 260 640',
'P':STEM+' M 160 635 C 450 795 625 535 445 365 C 365 290 245 300 160 350',
'Q':e.oval(260,365,225,315)+' M 245 175 C 350 245 385 -105 530 -45',
'R':STEM+' M 160 635 C 450 795 625 535 445 365 C 365 290 245 300 160 350 M 300 345 C 405 285 385 125 465 70 C 495 45 535 65 565 105',
'S':'M 480 585 C 490 790 155 755 125 555 C 100 385 465 410 470 205 C 475 -25 120 0 70 140',
'T':'M 25 585 C 150 725 360 740 560 685 M 340 705 L 340 145 C 340 40 385 35 430 105',
'U':'M 75 680 L 75 260 C 75 -25 325 5 440 245 M 440 680 L 440 125 C 440 40 485 35 530 100',
'V':'M 45 680 C 120 655 80 345 130 120 C 155 10 190 30 240 100 C 370 285 455 515 465 680',
'W':'M 35 680 C 105 650 55 335 105 110 C 125 20 165 35 210 115 C 295 280 330 485 345 655 M 345 655 C 345 445 305 265 350 110 C 375 20 410 35 455 115 C 565 300 645 530 635 680',
'X':'M 65 650 C 190 755 230 340 325 125 C 365 30 405 35 460 100 M 495 680 C 390 585 275 375 185 210 C 130 100 80 45 25 65',
'Y':'M 55 680 L 55 420 C 55 180 320 280 410 680 M 410 680 L 410 85 C 410 -170 115 -230 80 -70 C 60 30 150 100 215 110',
'Z':'M 55 595 C 175 745 330 730 485 680 C 375 465 240 275 70 90 C 200 155 320 10 445 80 C 475 105 500 140 520 170',
}
DIG={
'0':e.oval(250,365,190,315),
'1':'M 75 525 C 150 570 220 635 280 690 L 280 60 M 90 60 C 190 35 315 35 400 80',
'2':'M 65 545 C 85 760 455 785 465 560 C 475 375 225 265 70 85 C 210 140 350 20 465 100',
'3':'M 75 585 C 230 780 510 700 440 500 C 410 420 320 365 240 360 M 240 360 C 525 420 545 95 315 55 C 185 30 95 65 70 140',
'4':'M 410 680 C 305 520 160 330 65 230 C 205 255 365 250 510 260 M 435 680 L 435 55',
'5':'M 480 680 C 355 650 245 655 125 680 L 100 385 C 375 525 560 270 420 120 C 315 10 135 35 75 140',
'6':'M 445 625 C 340 780 105 645 80 375 C 50 45 350 -35 460 175 C 590 435 205 500 90 275',
'7':'M 65 635 C 190 720 355 710 510 675 C 360 485 260 240 210 65 M 210 340 C 300 370 380 370 445 360',
'8':e.oval(250,520,165,160)+' '+e.oval(250,205,195,170),
'9':'M 450 425 C 350 210 65 305 85 525 C 105 750 435 780 470 550 C 515 270 355 0 130 95',
}

def source_mark(w,part=None):
    # Existing helper's exact master uses 1.38x, baseline 705; convert to 1.5x/700.
    sh=e.mark(w,exact=(w==72))
    if part is not None:
        pp=e.contour_polys(sh)
        sh=max(pp,key=lambda p:p.bounds[3]) if part=='F' else min(pp,key=lambda p:p.bounds[1])
    sh=affinity.scale(sh,xfact=1.5/1.38,yfact=1.5/1.38,origin=(0,0))
    return affinity.translate(sh,yoff=-7.5)

def slanted_stroke(d,w):
    # Slant the pen trajectory BEFORE outlining. This preserves genuinely round
    # terminals and constant-width strokes rather than skewing circles to ellipses.
    return unary_union([LineString([(x+.30*y,y) for x,y in pts]).buffer(w/2,cap_style=1,join_style=1,quad_segs=16) for pts in e.paths(d) if len(pts)>1])

ALL=[]
def build(style,source_weight):
    weight=source_weight*1.5
    chars=list(dict.fromkeys(' '+string.ascii_uppercase+string.ascii_lowercase+string.digits+string.punctuation+'‘’“”–—…•°€£\u00a0'))
    cmap={ord(c):e.gname(c) for c in chars};shapes={};metrics={};raw={}
    sh=Polygon([(0,0),(440,0),(440,700),(0,700)],holes=[[(65,65),(375,65),(375,635),(65,635)]])
    shapes['.notdef']=affinity.translate(sh,xoff=45);metrics['.notdef']=(530,45)
    for ch in chars:
        n=e.gname(ch)
        if ch in ' \u00a0':shapes[n]=GeometryCollection();metrics[n]=(260,0);continue
        if ch=='F':sh=source_mark(source_weight,'F')
        elif ch=='p':sh=source_mark(source_weight,'p')
        else:
            d=(CAP.get(ch) or LOW.get(ch) or DIG.get(ch))
            if d:
                sh=slanted_stroke(d,weight)
                if ch in 'ij':sh=unary_union([sh,Point((120 if ch=='i' else 200)+.30*615,615).buffer(weight*.58,quad_segs=16)])
            else:
                sh=e.glyph_shape(ch,weight,True)
        raw[ch]=sh
        x0,_,x1,_=sh.bounds
        sb=24 if ch.islower() else 30
        if ch in '.,:;!\'"‘’“”':sb=45
        shapes[n]=affinity.translate(sh,xoff=sb-x0);metrics[n]=(round(x1-x0+2*sb),sb)
    # Original mark stays an exact combined-logo silhouette in Regular.
    sh=source_mark(source_weight);x0,_,x1,_=sh.bounds
    shapes['fpMark']=affinity.translate(sh,xoff=30-x0);metrics['fpMark']=(round(x1-x0+54),30);cmap[0xE000]='fpMark'
    # Preserve the original F/p relationship with liga disabled as well.
    F=raw['F'];p=raw['p'];kern={(e.gname('F'),e.gname('p')):round(p.bounds[0]-F.bounds[2]-54)}
    for ch in string.ascii_lowercase:
        if ch!='p':kern[(e.gname('F'),e.gname(ch))]=-300 if ch in 'aceos' else -330
    for pair,v in [('AV',-70),('AW',-55),('AY',-65),('AT',-45),('TA',-45),('To',-90),('Ta',-85),('Te',-65),('Ty',-45),('Yo',-70),('Wa',-50),('Va',-60),('PA',-45),('LT',-45),('oo',-12),('ee',-15),('re',-20),('ri',-15),('ug',-15),('pl',-15),('fr',-20),('st',-15),('th',-10),('it',-15)]:kern[(e.gname(pair[0]),e.gname(pair[1]))]=v
    # Hand-fit an optional flowing ee; ordinary glyphs remain robust nonconnecting forms.
    base=shapes[e.gname('e')];adv=metrics[e.gname('e')][0]-28;y=140
    cut=base.intersection(LineString([(-1000,y),(3000,y)]))
    if not cut.is_empty:
        xl,_,xr,_=cut.bounds
        link=e.stroke(f'M {xr-4} {y} C {xr+25} {y+20} {adv+xl-25} {y+20} {adv+xl+4} {y}',weight*.8,True)
        shapes['ee.join']=unary_union([base,affinity.translate(base,xoff=adv),link]);metrics['ee.join']=(adv+metrics[e.gname('e')][0],24)
    feat='languagesystem DFLT dflt; languagesystem latn dflt;\nfeature kern {\n'+'\n'.join(f'pos {a} {b} {v};' for (a,b),v in kern.items())+'\n} kern;\n'
    feat+='feature liga { sub uni0046 uni0070 by fpMark; } liga;\n'
    if 'ee.join' in shapes:feat+='feature dlig { sub uni0065 uni0065 by ee.join; } dlig;\n'
    ps='FPCursive-'+style
    for kind in ['ttf','otf']:
        fb=FontBuilder(1000,isTTF=kind=='ttf');fb.setupGlyphOrder(list(shapes));fb.setupCharacterMap(cmap)
        if kind=='ttf':
            glyphs={}
            for n,sh in shapes.items():pen=TTGlyphPen(None);e.drawshape(pen,sh);glyphs[n]=pen.glyph()
            fb.setupGlyf(glyphs)
        else:
            cs={}
            for n,sh in shapes.items():pen=T2CharStringPen(metrics[n][0],None);e.drawshape(pen,sh);cs[n]=pen.getCharString(private=None,globalSubrs=None)
            fb.setupCFF(ps,{'FullName':'FP Cursive '+style,'FamilyName':'FP Cursive','Weight':style,'Copyright':COPYRIGHT},cs,{})
        fb.setupHorizontalMetrics(metrics);fb.setupHorizontalHeader(ascent=950,descent=-360,lineGap=0)
        fb.setupNameTable({'familyName':'FP Cursive'+(' Light' if style=='Light' else ''),'styleName':'Regular' if style=='Light' else style,'typographicFamily':'FP Cursive','typographicSubfamily':style,'uniqueFontIdentifier':'Freeplug:2026:'+ps+':2.000','fullName':'FP Cursive '+style,'psName':ps,'version':'Version 2.000','copyright':COPYRIGHT,'designer':CREDIT,'manufacturer':CREDIT,'trademark':'Freeplug name and logo are trademarks of Freeplug.','description':'Chunky round monoline script extended from the original Freeplug Fp mark; uppercase and true lowercase.','licenseDescription':LICENSE})
        bold=style=='Bold';fb.setupOS2(version=4,sTypoAscender=950,sTypoDescender=-360,sTypoLineGap=0,usWinAscent=1100,usWinDescent=400,usWeightClass={'Light':300,'Regular':400,'Bold':700}[style],usWidthClass=5,fsType=0,sxHeight=500,sCapHeight=710,fsSelection=(32 if bold else 64)|128)
        fb.setupPost(italicAngle=-16.7,underlinePosition=-260,underlineThickness=65);fb.setupMaxp();fb.font['head'].macStyle=1 if bold else 0
        addOpenTypeFeaturesFromString(fb.font,feat)
        kt=newTable('kern');kt.version=0;st=KernTable_format_0();st.version=0;st.coverage=1;st.kernTable=kern;kt.kernTables=[st];fb.font['kern']=kt
        fb.save(ROOT/kind/(ps+'.'+kind))
    web=TTFont(ROOT/'ttf'/(ps+'.ttf'));web.flavor='woff2';web.save(ROOT/'woff2'/(ps+'.woff2'))
    ALL.append({'family':'FP Cursive','style':style,'basename':ps,'version':'2.000','source_stroke':source_weight,'font_stroke':weight,'unicode_count':len(cmap),'glyph_count':len(shapes),'kern_pairs':len(kern),'formats':['ttf','otf','woff2']})

def label(d,text,x,y,size=28,color='#59635d'):
    labelpath=Path('/workspace/logos/FP/fonts/ttf/FreeplugDispatch-Regular.ttf')
    if not labelpath.exists():labelpath=ROOT/'ttf/FPCursive-Regular.ttf'
    ft=ImageFont.truetype(str(labelpath),size);d.text((x,y),text,font=ft,fill=color)

def put(d,text,x,y,size,style='Regular',color='#182b23',maxwidth=2000,features=None):
    ft=ImageFont.truetype(str(ROOT/'ttf'/('FPCursive-'+style+'.ttf')),size)
    while d.textlength(text,font=ft,features=features)>maxwidth:size-=1;ft=ImageFont.truetype(str(ROOT/'ttf'/('FPCursive-'+style+'.ttf')),size)
    d.text((x,y),text,font=ft,fill=color,anchor='lt',features=features)

def specimen():
    W,H=2400,2270;im=Image.new('RGB',(W,H),'#f6f2e9');d=ImageDraw.Draw(im)
    label(d,'FREEPLUG / FP CURSIVE / LOGO-LED REDRAW',75,35,32,'#8b1a1e');put(d,'Freeplug',70,105,150,maxwidth=1400)
    label(d,'Created by '+CREDIT,75,285,30)
    for i,style in enumerate(['Light','Regular','Bold']):
        y=365+i*595;d.line((75,y,W-75,y),fill='#b4bdb2',width=2);label(d,style.upper(),75,y+20,28,'#8b1a1e')
        put(d,'Freeplug',70,y+85,155,style,maxwidth=1250);put(d,'\ue000',1900,y+70,150,style,maxwidth=400)
        put(d,'I Know a Plug',75,y+265,73,style,maxwidth=1000);put(d,"It's so cheap it's free",1150,y+265,73,style,maxwidth=1160)
        put(d,string.ascii_uppercase,75,y+365,62,style,maxwidth=2250)
        put(d,string.ascii_lowercase,75,y+440,65,style,maxwidth=2250)
        put(d,'0123456789  & @ # $ % + - / ! ? . , : ;',75,y+520,54,style,maxwidth=2250)
    label(d,'TRUE LOWERCASE / ROUND MONOLINE / THREE WEIGHTS / VERSION 2.000',75,2190,27)
    im.save(ROOT/'specimen-fp-cursive.png');im.thumbnail((1400,1500));im.save(ROOT/'specimen-fp-cursive-review.png')

def comparison():
    im=Image.new('RGB',(2600,1860),'#f6f2e9');d=ImageDraw.Draw(im)
    label(d,'ORIGINAL Fp LOGO  /  FP CURSIVE REGULAR  /  LETTERING COMPARISON',65,30,32,'#8b1a1e')
    # Rasterize the actual source path separately, not the font glyph.
    import cairosvg,io
    master=(ROOT/'source/original-fp-monogram.d').read_text()
    svg=f'<svg xmlns="http://www.w3.org/2000/svg" width="900" height="850" viewBox="120 200 780 640"><path d="{master}" fill="#182b23"/></svg>'
    logo=Image.open(io.BytesIO(cairosvg.svg2png(bytestring=svg.encode(),output_width=480,output_height=395))).convert('RGBA')
    im.paste(logo,(80,155),logo)
    label(d,'Original project vector',80,95,30)
    label(d,'Typed Fp: standard ligature',790,95,30)
    put(d,'Fp',790,175,400,maxwidth=750)
    label(d,'Typed F + p: ligature OFF',1660,95,30)
    put(d,'Fp',1650,175,400,maxwidth=850,features=['-liga'])
    label(d,'Regular pen width = original 72 source units, scaled 1.5x (108 font units).',75,610,29)
    d.line((65,680,2535,680),fill='#b4bdb2',width=2)
    for text,x,y,size,mw in [('Freeplug',70,750,235,1600),('Free',70,1050,190,950),('Plug',1330,1050,190,1150),("It's so cheap it's free",70,1370,160,2450)]:put(d,text,x,y,size,maxwidth=mw)
    label(d,'Mixed-case words use new letterforms; only F and p are the logo components.',75,1685,30)
    label(d,CREDIT+' / Freeplug name and logo remain Freeplug trademarks.',75,1750,28)
    im.save(ROOT/'compare-logo-vs-font.png')

if __name__=='__main__':
    for style,w in [('Light',52),('Regular',72),('Bold',88)]:build(style,w)
    (ROOT/'manifest.json').write_text(json.dumps(ALL,indent=2)+'\n')
    specimen();comparison();print('Three logo-led mixed-case script weights built.')
