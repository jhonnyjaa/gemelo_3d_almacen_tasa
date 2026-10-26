"""Vectoriza el plano raster (tools/main.png) en polígonos para extruir en 3D.
Salida: public/plan.json con coordenadas en 'unidades de plano' (1568 px de ancho).
Uso: python -I tools/trace.py
"""
import json, math
import cv2, numpy as np

F = 1568 / 2410          # página PDF -> unidades de plano
Y0 = 466                 # la imagen principal empieza en y=466 de la página
img = cv2.imread('tools/main.png')
h, w = img.shape[:2]
hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
H, S, V = cv2.split(hsv)

yel = ((H >= 18) & (H <= 35) & (S > 100) & (V > 150))
red = (((H < 8) | (H > 172)) & (S > 150) & (V > 100))
grn = ((H >= 40) & (H <= 90) & (S > 70) & (V > 40))
drk = (g < 120) & ~yel & ~red & ~grn

to_px = lambda x, z: (x / F, z / F - Y0)
to_plan = lambda px, py: (round(px * F, 1), round((py + Y0) * F, 1))

# --- enmascarar lo que se dibuja aparte (racks y zonas de piso con cuadrícula)
mask = np.zeros((h, w), np.uint8)
for f in json.load(open('tools/footprints.json')):
    if f['kind'] == 'zone' and not any(k in f['name'] for k in ('TRANSITO', 'CROSS')):
        continue
    pad = 3 if f['kind'] == 'rack' else 2
    c, s = math.cos(f['th']), math.sin(f['th'])
    pts = []
    for u, v in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
        x = f['cx'] + u * (f['w'] / 2 + pad) * c - v * (f['d'] / 2 + pad) * s
        z = f['cz'] + u * (f['w'] / 2 + pad) * s + v * (f['d'] / 2 + pad) * c
        pts.append(to_px(x, z))
    cv2.fillPoly(mask, [np.round(np.array(pts)).astype(np.int32)], 255)
TEXTS = [  # (cx, cz, w, d) en unidades de plano: textos del plano que se re-rotulan en 3D
    (625, 558, 215, 34), (133, 514, 60, 34), (1380, 665, 85, 34), (1495, 510, 90, 16),
    (1175, 372, 44, 34), (1252, 375, 44, 16), (975, 404, 48, 26), (1370, 385, 14, 30),
]
for cx, cz, tw, td in TEXTS:
    a, b = to_px(cx - tw / 2, cz - td / 2); c, d_ = to_px(cx + tw / 2, cz + td / 2)
    cv2.rectangle(mask, (int(a), int(b)), (int(c), int(d_)), 255, -1)
drk[mask > 0] = False
# la sombra de lo enmascarado también quita rojos/amarillos? no: solo líneas negras.

k3 = np.ones((3, 3), np.uint8)
drk_u8 = cv2.morphologyEx(drk.astype(np.uint8) * 255, cv2.MORPH_CLOSE, k3)

# --- clasificar componentes conexos por tamaño: muro / equipo / marca plana
n, lab, stats, _ = cv2.connectedComponentsWithStats(drk_u8, connectivity=8)
big = np.zeros_like(drk_u8); mid = np.zeros_like(drk_u8); flat = np.zeros_like(drk_u8)
for i in range(1, n):
    x, y, bw, bh, area = stats[i]
    L = max(bw, bh) * F
    if area < 4: continue
    tgt = big if L > 110 else mid if L > 28 else flat
    tgt[lab == i] = 255
big = cv2.dilate(big, k3, iterations=1)
mid = cv2.dilate(mid, k3, iterations=1)


def polys(m, eps=0.8, min_area=2.0, holes=True):
    mode = cv2.RETR_CCOMP if holes else cv2.RETR_EXTERNAL
    cs, hier = cv2.findContours(m, mode, cv2.CHAIN_APPROX_SIMPLE)
    out = []
    if hier is None: return out
    hier = hier[0]
    for i, c in enumerate(cs):
        if hier[i][3] != -1 and holes: continue  # los huecos se anexan al padre
        if cv2.contourArea(c) < min_area: continue
        ring = cv2.approxPolyDP(c, eps, True).reshape(-1, 2)
        if len(ring) < 3: continue
        item = {'p': [v for q in ring for v in to_plan(*q)]}
        if holes:
            hs = []
            j = hier[i][2]
            while j != -1:
                if cv2.contourArea(cs[j]) >= min_area:
                    hr = cv2.approxPolyDP(cs[j], eps, True).reshape(-1, 2)
                    if len(hr) >= 3: hs.append([v for q in hr for v in to_plan(*q)])
                j = hier[j][0]
            if hs: item['h'] = hs
        out.append(item)
    return out


def blobs(m, close=3, min_area=25):
    m = cv2.morphologyEx(m.astype(np.uint8) * 255, cv2.MORPH_CLOSE, np.ones((close, close), np.uint8))
    return polys(m, eps=1.0, min_area=min_area, holes=False)


out = {
    'size': [round(w * F, 1), round(h * F, 1)], 'y0': round(Y0 * F, 1),
    'walls': polys(big), 'mid': polys(mid), 'flat': polys(flat, eps=0.6, min_area=1.5, holes=False),
    'yellow': polys(cv2.morphologyEx(yel.astype(np.uint8) * 255, cv2.MORPH_CLOSE, k3), eps=1.0, min_area=6),
    'red': blobs(red), 'green': blobs(grn),
}
json.dump(out, open('public/plan.json', 'w'), separators=(',', ':'))
print({k: len(v) for k, v in out.items() if isinstance(v, list)})

# vista previa para revisar
prev = np.full((h, w, 3), 255, np.uint8)
prev[flat > 0] = (180, 180, 180); prev[mid > 0] = (120, 120, 120); prev[big > 0] = (0, 0, 0)
prev[yel] = (0, 215, 255); prev[red] = (0, 0, 255); prev[grn] = (0, 160, 0)
prev[mask > 0] = (255, 200, 120) if False else prev[mask > 0]
cv2.imwrite('tools/preview.png', prev)


# ---------------- segundo piso (recuadro "Segundo piso", ampliación de la zona de oficinas)
im = cv2.imread('tools/inset.png')
ih, iw = im.shape[:2]
hs = cv2.cvtColor(im, cv2.COLOR_BGR2HSV); gg = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY)
Hh, Ss, Vv = cv2.split(hs)
ired = (((Hh < 8) | (Hh > 172)) & (Ss > 150) & (Vv > 100))
idrk = (gg < 120) & ~ired
# mapeo: píxel del recuadro -> plano (el recuadro se ve a 1000..1568 en x y 0..234 en z de la vista, ampliado ~2.47x)
K = 0.405
def inset_plan(px, py):
    return round(1200 + (px * F) * K, 1), round(445 - (234 - py * F) * K, 1)
def ipolys(m, eps=1.0, min_area=3, holes=True):
    mode = cv2.RETR_CCOMP if holes else cv2.RETR_EXTERNAL
    cs, hier = cv2.findContours(m, mode, cv2.CHAIN_APPROX_SIMPLE)
    res = []
    if hier is None: return res
    hier = hier[0]
    for i, c in enumerate(cs):
        if holes and hier[i][3] != -1: continue
        if cv2.contourArea(c) < min_area: continue
        r = cv2.approxPolyDP(c, eps, True).reshape(-1, 2)
        if len(r) < 3: continue
        it = {'p': [v for q in r for v in inset_plan(*q)]}
        if holes:
            hh = []; j = hier[i][2]
            while j != -1:
                if cv2.contourArea(cs[j]) >= min_area:
                    q = cv2.approxPolyDP(cs[j], eps, True).reshape(-1, 2)
                    if len(q) >= 3: hh.append([v for p in q for v in inset_plan(*p)])
                j = hier[j][0]
            if hh: it['h'] = hh
        res.append(it)
    return res
d8 = cv2.dilate(idrk.astype(np.uint8) * 255, k3, iterations=1)
n2, lab2, st2, _ = cv2.connectedComponentsWithStats(d8, connectivity=8)
iw_big = np.zeros_like(d8); iw_low = np.zeros_like(d8)
for i in range(1, n2):
    x, y, bw, bh, area = st2[i]
    (iw_big if max(bw, bh) > 120 else iw_low)[lab2 == i] = 255
upper = {
    'walls': ipolys(iw_big), 'low': ipolys(iw_low, holes=False),
    'red': ipolys(cv2.morphologyEx(ired.astype(np.uint8) * 255, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8)), holes=False, min_area=40),
    'bounds': [*inset_plan(0, 0), *inset_plan(iw, ih)],
}
out['upper'] = upper
json.dump(out, open('public/plan.json', 'w'), separators=(',', ':'))
print('upper', {k: len(v) for k, v in upper.items()}, upper['bounds'])
