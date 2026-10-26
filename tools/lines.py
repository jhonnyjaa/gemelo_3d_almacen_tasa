import cv2, numpy as np, json, math
F = 1568/2410; Y0 = 466
img = cv2.imread('tools/main.png'); g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV); H,S,V = cv2.split(hsv)
yel = ((H>=18)&(H<=35)&(S>100)&(V>150)); red=(((H<8)|(H>172))&(S>150)&(V>100)); grn=((H>=40)&(H<=90)&(S>70)&(V>40))
drk = ((g<130)&~yel&~red&~grn).astype(np.uint8)*255
# quitar racks/zonas (se dibujan aparte)
mask = np.zeros_like(drk)
for f in json.load(open('tools/footprints.json')):
    if f['kind']=='zone' and not any(k in f['name'] for k in ('TRANSITO','CROSS')): continue
    pad = 3
    c,s = math.cos(f['th']), math.sin(f['th']); pts=[]
    for u,v in ((-1,-1),(1,-1),(1,1),(-1,1)):
        x=f['cx']+u*(f['w']/2+pad)*c-v*(f['d']/2+pad)*s; z=f['cz']+u*(f['w']/2+pad)*s+v*(f['d']/2+pad)*c
        pts.append((x/F, z/F-Y0))
    cv2.fillPoly(mask,[np.round(np.array(pts)).astype(np.int32)],255)
drk[mask>0]=0
lsd = cv2.createLineSegmentDetector(cv2.LSD_REFINE_STD)
segs = lsd.detect(255-drk)[0]
segs = segs.reshape(-1,4) if segs is not None else np.zeros((0,4))
L = np.hypot(segs[:,2]-segs[:,0], segs[:,3]-segs[:,1])
keep = segs[L>45/F*0.6]   # >= ~27 unidades
print(len(segs), len(keep))
prev = np.full(img.shape,255,np.uint8); prev[drk>0]=(200,200,200)
for x1,y1,x2,y2 in keep: cv2.line(prev,(int(x1),int(y1)),(int(x2),int(y2)),(0,0,255),2)
cv2.imwrite('tools/lines_prev.png', prev)
np.save('tools/segs.npy', keep)
