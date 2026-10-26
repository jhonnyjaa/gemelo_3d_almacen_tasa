"""Extrae las imágenes del PDF y aplica encima los tapados blancos (figuras vectoriales
con relleno blanco) que se hicieron en el PDF para ocultar elementos."""
import pymupdf, numpy as np, cv2
d = pymupdf.open('tools/layout_almacen.pdf'); page = d[0]
whites = [x for x in page.get_drawings() if x['fill'] == (1.0, 1.0, 1.0)]
for im, name in zip(page.get_images(full=True), ['inset', 'main']):
    pix = pymupdf.Pixmap(d, im[0]); a = np.frombuffer(pix.samples, np.uint8).reshape(pix.height, pix.width, 3).copy()
    bb = page.get_image_bbox(im); sx = pix.width / bb.width; sy = pix.height / bb.height
    n = 0
    for w in whites:
        pts = []
        for it in w['items']:
            if it[0] == 'l': pts += [it[1], it[2]]
            elif it[0] == 're': r = it[1]; pts += [r.tl, r.tr, r.br, r.bl]
            elif it[0] == 'qu': q = it[1]; pts += [q.ul, q.ur, q.lr, q.ll]
        if not pts: continue
        poly = np.array([[(p.x - bb.x0) * sx, (p.y - bb.y0) * sy] for p in pts])
        if poly[:, 0].max() < 0 or poly[:, 1].max() < 0 or poly[:, 0].min() > pix.width or poly[:, 1].min() > pix.height: continue
        hull = cv2.convexHull(np.round(poly).astype(np.int32))
        cv2.fillConvexPoly(a, hull, (255, 255, 255)); n += 1
    cv2.imwrite(f'tools/{name}.png', cv2.cvtColor(a, cv2.COLOR_RGB2BGR)); print(name, a.shape, 'tapados:', n)
