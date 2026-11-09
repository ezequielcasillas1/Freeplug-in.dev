from pathlib import Path
import json, zipfile
from fontTools.ttLib import TTFont
from fontTools import subset
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.t2CharStringPen import T2CharStringPen
from fontTools.pens.qu2cuPen import Qu2CuPen
from PIL import Image, ImageDraw, ImageFont
root=Path('/workspace/logos/freeplug/demo')
credit='Ezequiel Casillas with the 72 After team'
license="""Thanks for trying the Freeplug demo fonts!

FP Extended Demo, Freeplug Dispatch Demo, and FP Cursive Demo are free for personal, non-commercial use only.
Commercial use, websites, and client work need the full Freeplug Font Bundle ($49.99) at https://freeplug-in.dev/merch.
Please don't sell, share, or redistribute the font files.
The Freeplug name and logo remain Freeplug's trademarks.
Created by Ezequiel Casillas with the 72 After team.
"""
(root/'LICENSE.txt').write_text(license)
(root/'README.txt').write_text('Freeplug Personal-Use Demo Pack\n\nIncludes FP Extended Demo, Freeplug Dispatch Demo, and FP Cursive Demo.\nOne weight each: Regular, in TTF, OpenType/CFF OTF, and WOFF2.\nBasic Latin characters only (U+0020-007E where available); no accented characters, alternates, or ligatures. Kerning is retained for included glyphs.\nSee specimen-demo.png and LICENSE.txt.\n\nFor commercial use, websites, and client work, get the full Freeplug Font Bundle ($49.99):\nhttps://freeplug-in.dev/merch\n\nCreated by '+credit+'\n')
sources=[('FP Extended','FPExtended','/workspace/logos/FP/fonts/ttf/FPExtended-Regular.ttf'),('Freeplug Dispatch','FreeplugDispatch','/workspace/logos/FP/fonts/ttf/FreeplugDispatch-Regular.ttf'),('FP Cursive','FPCursive','/workspace/logos/freeplug/cursive/ttf/FPCursive-Regular.ttf')]
report=[]
for family,stem,src in sources:
 f=TTFont(src); before=len(f.getGlyphOrder()); expected=set(f.getBestCmap()) & set(range(32,127))
 opts=subset.Options(); opts.layout_features=['kern']; opts.name_IDs=['*']; opts.name_legacy=True; opts.name_languages=['*']; opts.legacy_kern=True
 sub=subset.Subsetter(options=opts); sub.populate(unicodes=expected); sub.subset(f)
 if 'GSUB' in f: del f['GSUB']
 fam=family+' Demo'; ps=stem+'Demo-Regular'
 names={0:'Copyright 2026 '+credit,1:fam,2:'Regular',3:ps+';Demo;1.000',4:fam+' Regular',6:ps,8:credit,9:credit,13:license.strip(),14:'https://freeplug-in.dev/merch',16:fam,17:'Regular'}
 nt=f['name']; nt.names=[n for n in nt.names if n.nameID not in names and n.nameID not in [18,21,22,25]]
 for nid,text in names.items():
  nt.setName(text,nid,3,1,0x409)
  # ASCII-only strings allow a matching legacy Macintosh record.
  nt.setName(text,nid,1,0,0)
 f.save(root/'ttf'/f'{ps}.ttf')
 f.flavor='woff2'; f.save(root/'woff2'/f'{ps}.woff2'); f.flavor=None
 # Convert TrueType quadratic outlines to genuine cubic OpenType/CFF.
 glyphset=f.getGlyphSet(); chars={}
 for g in f.getGlyphOrder():
  pen=T2CharStringPen(f['hmtx'][g][0],glyphset)
  glyphset[g].draw(Qu2CuPen(pen,1.0,all_cubic=True))
  chars[g]=pen.getCharString()
 fb=FontBuilder(font=f,isTTF=False)
 fb.isTTF=False
 fb.setupCFF(ps,{'FullName':fam+' Regular','FamilyName':fam,'Weight':'Regular','Notice':'Copyright 2026 '+credit},chars,{})
 for tag in ['glyf','loca']: del f[tag]
 f.sfntVersion='OTTO'; fb.setupMaxp(); f.save(root/'otf'/f'{ps}.otf')
 for folder,ext in [('ttf','ttf'),('otf','otf'),('woff2','woff2')]:
  out=TTFont(root/folder/f'{ps}.{ext}')
  assert set(out.getBestCmap())==expected
  assert len(out.getGlyphOrder())<before
  assert all('Demo' in out['name'].getDebugName(i) for i in [1,4,6,16])
  assert 'GSUB' not in out
 report.append({'family':fam,'source_glyphs':before,'demo_glyphs':len(f.getGlyphOrder()),'codepoints':len(expected),'missing_basic_latin':[chr(c) for c in range(32,127) if c not in expected]})
# Draw each face using its own file, with labels in Dispatch Demo.
im=Image.new('RGB',(1800,1150),'#f8f6ef'); d=ImageDraw.Draw(im)
label=ImageFont.truetype(str(root/'ttf/FreeplugDispatchDemo-Regular.ttf'),26)
d.text((55,30),'FREEPLUG PERSONAL-USE DEMO PACK',font=label,fill='#163d2b')
for i,(family,stem,_) in enumerate(sources):
 y=110+i*340; p=str(root/'ttf'/f'{stem}Demo-Regular.ttf')
 d.text((55,y),family+' Demo / Regular',font=label,fill='#163d2b')
 d.text((55,y+48),'Freeplug 72 After - Create something great!',font=ImageFont.truetype(p,47),fill='#151b16')
 small=ImageFont.truetype(p,29)
 for j,line in enumerate(['ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz 0123456789', ''.join(chr(c) for c in range(32,65)), ''.join(chr(c) for c in range(91,97))+' '+''.join(chr(c) for c in range(123,127))]):
  d.text((55,y+120+j*42),line,font=small,fill='#151b16')
im.save(root/'specimen-demo.png')
Path('/workspace/logos/freeplug/demo-build/validation.json').write_text(json.dumps(report,indent=2))
zip_path=Path('/workspace/logos/freeplug/freeplug-fonts-personal-demo.zip')
with zipfile.ZipFile(zip_path,'w',zipfile.ZIP_DEFLATED) as z:
 for p in sorted(root.rglob('*')):
  if p.is_file(): z.write(p,p.relative_to(root))
print(json.dumps(report,indent=2)); print('ZIP:',zip_path,zip_path.stat().st_size)
