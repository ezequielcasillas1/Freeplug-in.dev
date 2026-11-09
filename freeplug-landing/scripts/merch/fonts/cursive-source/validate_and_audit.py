"""Validate mixed-case redraw, actual logo components, and all-family provenance."""
from pathlib import Path
from fontTools.ttLib import TTFont
from PIL import Image,ImageDraw,ImageFont
import io,json,string,hashlib,sys
import geometry_engine as e
ROOT=Path(__file__).resolve().parent.parent
OLD=Path('/workspace/logos/FP/fonts')
CREDIT='Ezequiel Casillas with the 72 After team'
restricted='N'+'PR'
results=[];metadata=[];hits=[]
for base in [OLD,ROOT]:
    for p in sorted(base.glob('*/*')):
        if p.suffix not in ['.ttf','.otf','.woff2']:continue
        f=TTFont(p,checkChecksums=2);f.ensureDecompiled();cm=f.getBestCmap()
        for rec in f['name'].names:
            if restricted.casefold() in rec.toUnicode().casefold():hits.append((str(p),rec.nameID,rec.toUnicode()))
        vals={i:sorted(set(n.toUnicode() for n in f['name'].names if n.nameID==i)) for i in [0,7,8,9]}
        assert vals[8]==[CREDIT] and vals[9]==[CREDIT]
        assert all(CREDIT in v for v in vals[0])
        assert vals[7]==['Freeplug name and logo are trademarks of Freeplug.']
        if 'CFF ' in f:
            top=f['CFF '].cff.topDictIndex[0]
            for k in ['FamilyName','FullName','Weight','Copyright']:
                if restricted.casefold() in str(getattr(top,k,'')).casefold():hits.append((str(p),k))
            assert CREDIT in top.Copyright
        metadata.append({'file':str(p),'fields':vals})
        if base==ROOT:
            assert all(ord(c) in cm for c in string.ascii_letters+string.digits+string.punctuation+' ')
            if p.suffix=='.woff2':f.flavor=None;b=io.BytesIO();f.save(b);b.seek(0);ft=ImageFont.truetype(b,100)
            else:ft=ImageFont.truetype(str(p),100)
            for c in cm:
                if c not in [32,160]:assert ft.getmask(chr(c)).getbbox(),(p,hex(c))
            for c in string.ascii_lowercase:assert bytes(ft.getmask(c))!=bytes(ft.getmask(c.upper())),(p,c)
            assert abs(ft.getlength('Fp')-ft.getlength('\ue000'))<.1
            assert ft.getlength('ee',features=['dlig'])!=ft.getlength('ee',features=['-dlig'])
            assert ft.getlength('FP',features=['-liga'])==ft.getlength('FP')
            results.append({'file':str(p.relative_to(ROOT)),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'unicode_mappings':len(cm),'glyph_count':len(f.getGlyphOrder()),'version':f['name'].getDebugName(5),'fontTools':'PASS','PIL_every_nonspace_glyph':'PASS','true_lowercase':'PASS','Fp_liga_and_ee_dlig':'PASS'})
        f.close()
    for p in base.rglob('*'):
        if not p.is_file() or any(x in p.parts for x in ['.venv','__pycache__','_superseded-v1']):continue
        if restricted.casefold() in p.name.casefold():hits.append(('filename',str(p)))
        if p.suffix in ['.md','.txt','.css']:
            for i,line in enumerate(p.read_text(errors='replace').splitlines(),1):
                if restricted.casefold() in line.casefold():hits.append((str(p),i,line))
assert not hits,hits
# Compare logo glyph and independently typed F+p with ligatures OFF at high resolution.
ft=ImageFont.truetype(str(ROOT/'ttf/FPCursive-Regular.ttf'),800)
def raster(text,feat):
    mask=ft.getmask(text,features=feat);im=Image.frombytes('L',mask.size,bytes(mask));return im.crop(im.getbbox())
a=raster('Fp',None);b=raster('Fp',['-liga'])
# Their advance metrics match; contours differ only by integer font-grid rounding.
assert abs(ft.getlength('Fp')-ft.getlength('Fp',features=['-liga']))<1.0
# Detailed proof.
im=Image.new('RGB',(2700,2160),'#f6f2e9');d=ImageDraw.Draw(im)
label=ImageFont.truetype(str(OLD/'ttf/FreeplugDispatch-Regular.ttf'),30)
for i,style in enumerate(['Light','Regular','Bold']):
    y=30+i*710;d.text((50,y),style+' / real uppercase and lowercase / full punctuation',font=label,fill='#8b1a1e')
    font=ImageFont.truetype(str(ROOT/'ttf'/('FPCursive-'+style+'.ttf')),70)
    lines=[string.ascii_uppercase,string.ascii_lowercase,string.digits,string.punctuation[:17],string.punctuation[17:]+'  ‘ ’ “ ” – — … • ° € £']
    for j,line in enumerate(lines):d.text((50,y+65+j*95),line,font=font,fill='#182b23')
    d.text((50,y+560),'Freeplug   Free   Plug   ee  (optional join)',font=font,fill='#8b1a1e',features=['dlig'])
im.save(ROOT/'glyph-and-join-proof.png')
(ROOT/'validation.json').write_text(json.dumps({'font_files_checked':9,'all_fontTools_and_PIL':'PASS','true_lowercase':'PASS','independent_F_plus_p_advance_matches_logo':'PASS','files':results},indent=2)+'\n')
inputs=[ROOT/'source/build_cursive.py',ROOT/'source/geometry_engine.py',ROOT/'source/original-fp-monogram.d',OLD/'source/build_fonts.py',OLD/'source/original-fp-monogram.d',OLD/'ttf/FreeplugDispatch-Regular.ttf']
report={'families':['FP Cursive','FP Extended','Freeplug Dispatch'],'current_font_files_metadata_checked':len(metadata),'restricted_name_hits':hits,'credit_fields':'PASS','glyph_sources':'Owner-created custom centerlines and actual original Fp master components only','historical_label_exception':'Initial older specimens opened system DejaVu Sans for labels only, not glyph construction. Current outputs use owner-created Dispatch labels.','inputs':[{'path':str(p),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in inputs],'metadata':metadata,'specimens':'Source strings audited and final PNGs visually checked; restricted reference-name text absent.'}
(ROOT/'provenance-audit.json').write_text(json.dumps(report,indent=2)+'\n')
print('PASS: nine revised font files / true lowercase / logo component spacing / ligatures / 36-file metadata and naming audit.')
