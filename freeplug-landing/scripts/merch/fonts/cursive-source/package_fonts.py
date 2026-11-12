"""Package finished owner-created fonts without publishing anything."""
from pathlib import Path
from zipfile import ZipFile,ZIP_DEFLATED
from fontTools.ttLib import TTFont
import io,json,hashlib
ROOT=Path(__file__).resolve().parent.parent
BASE=ROOT.parent
OLD=Path('/workspace/logos/FP/fonts')

def standalone(root,name,folder):
    files=sorted(p for p in root.rglob('*') if p.is_file() and '.venv' not in p.parts and '__pycache__' not in p.parts and '_superseded-v1' not in p.parts and p.suffix!='.zip' and p.name!='FILES.txt')
    (root/'FILES.txt').write_text('\n'.join(str(p.relative_to(root)) for p in files)+'\nFILES.txt\n'+name+'\n')
    files.append(root/'FILES.txt')
    out=root/name
    with ZipFile(out,'w',ZIP_DEFLATED) as z:
        for p in files:z.write(p,Path(folder)/p.relative_to(root))
    return out

oldzip=standalone(OLD,'freeplug-custom-fonts-v1.zip','freeplug-custom-fonts-v1')
cursivezip=standalone(ROOT,'freeplug-fp-cursive-v1.zip','freeplug-fp-cursive-v1')
entries=[]
for folder,prefix,source,stems in [
    ('FP-Extended','FPExtended-',OLD,['Light','Regular','Bold','Black','Outline','Italic']),
    ('Freeplug-Dispatch','FreeplugDispatch-',OLD,['Regular','Bold','CondensedHeadline']),
    ('FP-Cursive','FPCursive-',ROOT,['Light','Regular','Bold'])]:
    for kind in ['ttf','otf','woff2']:
        for stem in stems:
            p=source/kind/(prefix+stem+'.'+kind)
            entries.append((p,Path(folder)/kind/p.name))
for p,arc in [
    (OLD/'specimen-fp-extended.png','FP-Extended/specimen-fp-extended.png'),
    (OLD/'specimen-fp-extended-review.png','FP-Extended/specimen-fp-extended-review.png'),
    (OLD/'specimen-dispatch.png','Freeplug-Dispatch/specimen-dispatch.png'),
    (OLD/'specimen-dispatch-review.png','Freeplug-Dispatch/specimen-dispatch-review.png'),
    (ROOT/'specimen-fp-cursive.png','FP-Cursive/specimen-fp-cursive.png'),
    (ROOT/'specimen-fp-cursive-review.png','FP-Cursive/specimen-fp-cursive-review.png'),
    (OLD/'glyph-coverage-proof.png','specimens/glyph-coverage-proof.png'),
    (ROOT/'glyph-and-join-proof.png','specimens/glyph-and-join-proof.png'),
    (ROOT/'compare-logo-vs-font.png','FP-Cursive/compare-logo-vs-font.png'),
    (BASE/'CREDITS.txt','CREDITS.txt'),
    (BASE/'BUNDLE-LICENSE.txt','BUNDLE-LICENSE.txt'),
    (BASE/'BUNDLE-README.md','README.md')]:entries.append((p,Path(arc)))
out=BASE/'freeplug-font-bundle-v1.zip'
with ZipFile(out,'w',ZIP_DEFLATED) as z:
    for p,arc in entries:z.write(p,Path('freeplug-font-bundle-v1')/arc)
    inventory=[str(Path('freeplug-font-bundle-v1')/a) for _,a in entries]
    z.writestr('freeplug-font-bundle-v1/FILES.txt','\n'.join(inventory)+'\nfreeplug-font-bundle-v1/FILES.txt\n')
for p in [oldzip,cursivezip,out]:
    with ZipFile(p) as z:assert z.testzip() is None
with ZipFile(out) as z:
    fonts=[n for n in z.namelist() if Path(n).suffix in ['.ttf','.otf','.woff2']]
    assert len(fonts)==36
    for name in fonts:
        f=TTFont(io.BytesIO(z.read(name)));f.ensureDecompiled()
        assert set(n.toUnicode() for n in f['name'].names if n.nameID==9)=={'Ezequiel Casillas with the 72 After team'}
        f.close()
    assert len([n for n in z.namelist() if 'LICENSE' in n])==1
report=[{'path':str(p),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in [oldzip,cursivezip,out]]
(BASE/'PACKAGE-REPORT.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
print('All ZIP integrity checks passed. Bundle: 36 fonts / 12 styles / 3 families / one bundle license.')
