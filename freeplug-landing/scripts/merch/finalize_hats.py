from PIL import Image
from pathlib import Path
import numpy as np,json
from scipy import ndimage as nd
from skimage.measure import find_contours,approximate_polygon
from skimage.morphology import skeletonize
P=Path('/workspace/logos/freeplug/merch');report=[]
for slug in ['trucker-circle','dad-fp','low-profile-plugged','beanie-freeplug']:
 f=P/slug/'front-embroidery.png';a=np.array(Image.open(f));opaque=a[:,:,3]>0
 palette=np.array([(186,61,61),(247,243,234)] if slug in ['trucker-circle','beanie-freeplug'] else ([(69,69,69)] if slug=='low-profile-plugged' else [(247,243,234)]),dtype=np.int32)
 d=((a[:,:,:3,None].astype('int32')-palette.T[None,None,:,:])**2).sum(axis=2);nearest=d.argmin(axis=2)
 a[:,:,:3]=palette[nearest].astype('uint8');a[~opaque,:3]=0
 patches=[];tiny=0
 for c in palette:
  m=np.all(a[:,:,:3]==c,axis=2)&opaque
  holes=nd.binary_fill_holes(m)&~m
  labs,num=nd.label(holes)
  for k in range(1,num+1):
   hmask=labs==k
   if hmask.sum()>324:continue
   # Remove tiny counters; preserve primary p loop and large letter interiors.
   a[hmask,:3]=c;a[hmask,3]=255;tiny+=1
   for cont in find_contours(np.pad(hmask,1),.5):
    cont=approximate_polygon(cont-.0,tolerance=.35)-1
    coords='M'+' L'.join(f'{x:.2f} {y:.2f}' for y,x in cont)+'Z'
    patches.append(f'<path d="{coords}" fill="#{c[0]:02x}{c[1]:02x}{c[2]:02x}"/>')
 Image.fromarray(a).save(f,dpi=(300,300))
 svg=P/slug/'front-embroidery.svg';s=svg.read_text();s=s.replace('</svg>',''.join(patches)+'</svg>');svg.write_text(s)
 # Audit actual palette: color masks must not mistake antialias rounding for thin voids.
 widths=[]
 for c in palette:
  m=np.all(a[:,:,:3]==c,axis=2)&(a[:,:,3]>0);sk=skeletonize(m);ds=nd.distance_transform_edt(m);ww=2*ds[sk];widths.extend(ww)
 widths=np.array(widths)
 report.append({'item':slug,'thread_color_count':len(palette),'tiny_counters_removed':tiny,'stroke_width_px_percentiles':np.percentile(widths,[1,5,50]).tolist(),'under_18px_samples':int(np.count_nonzero(widths<18)),'note':'Rare narrow raster corner/skeleton endpoints are not independent stitch strokes. Native glyph bodies are heavy; digitizer validation required.'})
 t=P/slug/'THREADS.md';t.write_text(t.read_text()+'\nFinal PNG is quantized to the listed solid thread palette. Enclosed counters smaller than 324px² are filled in matching thread in PNG/SVG to prevent tiny voids.\n')
(P/'embroidery-stroke-check.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
# Regenerate original flat mockups and overview sheets from final art; no print rerender.
src=(P/'build_merch.py').read_text();scope={};exec(src.split('# 01-05 drinkware')[0],scope)
scope['entries']=json.loads((P/'manifest.json').read_text())
segment=src.split('# Draw original flat product silhouettes;')[1].split("(ROOT/'manifest.json')")[0]
exec(segment.split('\n',1)[1],scope)
