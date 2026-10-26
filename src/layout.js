// Layout por defecto del almacén. Unidades = píxeles del plano (1568 x 783).
// Un rack se define por una o más `segments` [x1,z1,x2,z2] (línea central), que se
// recorren en orden: las columnas se numeran 1..cols a lo largo de ese recorrido.
// `cols: 'auto'` = largo total / 19. `levels` = niveles (A, B, C...).
// Se puede editar desde la app (panel Layout) y se guarda en el navegador.

export const PLAN = { w: 1568, h: 783.5 };

const horiz = (y, xs) => xs.map(([a, b]) => [a, y, b, y]);

const racks = [
  { id: 1, levels: 5, depth: 16, segments: horiz(506, [[245, 500], [540, 760], [798, 1090]]) },
  { id: 2, levels: 5, depth: 16, segments: horiz(524, [[245, 500], [540, 760], [798, 1090]]) },
  { id: 3, levels: 5, depth: 16, segments: horiz(603, [[211, 760], [798, 1090]]) },
  { id: 4, levels: 5, depth: 16, segments: horiz(620, [[211, 760], [798, 1090]]) },
  { id: 5, levels: 5, depth: 16, segments: horiz(697, [[160, 450], [462, 760], [767, 1305]]) },
  { id: 6, levels: 3, depth: 15, segments: [[34, 650, 134, 690]] },
  { id: 7, levels: 3, depth: 14, segments: [[232, 392, 196, 492], [281, 366, 264, 425]] },
  { id: 8, levels: 3, depth: 14, segments: [[169, 352, 235, 371]] },
  { id: 9, levels: 3, depth: 14, segments: [[152, 358, 97, 472]] },
  { id: 10, levels: 3, depth: 17, segments: [[1324, 530, 1324, 690]] },
  { id: 11, levels: 3, depth: 17, segments: [[1405, 530, 1405, 637]] },
  { id: 12, levels: 5, depth: 8, segments: [[1424, 340, 1424, 445]] },
  { id: 13, levels: 5, depth: 8, segments: [[1400, 350, 1400, 422]] },
  { id: 14, levels: 5, depth: 14, segments: [[1370, 340, 1370, 427]] },
  { id: 15, levels: 5, depth: 14, segments: [[1342, 340, 1342, 430]] },
];

// Alturas por nivel (unidades; 10 = 1 m): los niveles bajos son más chicos (artículos pequeños).
for (const r of racks) {
  if (r.id >= 12 && r.id <= 15) r.lhs = [6, 7, 8.5, 10, 10.5];
  else if (r.levels >= 5) r.lhs = [12, 14, 17, 20, 22];
}

// Mezanine: abajo 30-47, arriba 48-65 (misma huella). 6 niveles, 3 bloques de
// columnas (2 en los racks 55 y 56). 9 filas x 2 racks por piso.
for (let k = 0; k < 18; k++) {
  const row = k >> 1, side = k & 1;
  const x1 = 1446 + side * 49, x2 = x1 + 47, y = 373 + row * 31;
  for (const [floor, base] of [[1, 30], [2, 48]]) {
    const id = base + k;
    racks.push({
      id, levels: 6, depth: 15, floor, lhs: [11, 13, 15, 17, 19, 21], cols: id === 55 || id === 56 ? 4 : 6,
      groups: id === 55 || id === 56 ? 2 : 3,
      segments: [[x1, y, x2, y]],
    });
  }
}

// Zonas pintadas en el piso. `match` = textos de ubicación (SAP) que caen en la zona.
const zone = (name, match, x, z, w, d, color, rot = 0) => ({ name, match, x, z, w, d, rot, color });
const zones = [
  zone('ZONA TRANSITO TEMPORAL 1', ['ZONA TRANSITO TEMPORAL 1', 'ZTT1'], 403, 389, 167, 74, '#a3e635'),
  zone('ZONA TRANSITO TEMPORAL 2', ['ZONA TRANSITO TEMPORAL 2', 'ZTT2'], 641, 397, 232, 66, '#a3e635'),
  zone('ZONA TRANSITO TEMPORAL 3', ['ZONA TRANSITO TEMPORAL 3', 'ZTT3'], 874, 401, 156, 58, '#a3e635'),
  zone('ZONA CROSS DOCKING', ['ZONA CROSS DOCKING', 'CROSS DOCKING'], 1225, 555, 150, 85, '#f472b6'),
  zone('ACTIVOS FIJOS', ['ACTIVOS FIJOS'], 165, 560, 70, 90, '#22d3ee', 20),
];

export const DEFAULT_LAYOUT = {
  version: 1,
  levelHeight: 18,
  mezzLevelHeight: 16,
  racks,
  zones,
  labels: [
    { text: 'ALMACÉN DE COMPONENTES DE INTERCAMBIO', x: 625, z: 558, size: 11 },
    { text: 'ACTIVOS FIJOS', x: 120, z: 520, size: 8, rot: 68 },
    { text: 'ALMACÉN DE INSUMOS', x: 1364, z: 672, size: 8 },
    { text: 'ALMACÉN DE ELECTRÓNICOS', x: 1370, z: 434, size: 4.6 },
    { text: 'OFICINA RECEPCIÓN', x: 975, z: 383, size: 4.6, rot: 90 },
    { text: 'OFICINA ACTIVOS', x: 1178, z: 380, size: 4.6, rot: 90 },
    { text: 'SSHH', x: 1261, z: 380, size: 8 },
    { text: 'PLANTA BAJA', x: 1261, z: 394, size: 3.4, color: '#94a3b8' },
  ],
};

const KEY = 'gemelo3d.layout.v4';
export const loadLayout = () => {
  try {
    const s = localStorage.getItem(KEY);
    if (s) return { ...JSON.parse(s), labels: DEFAULT_LAYOUT.labels };
  } catch { /* ignore */ }
  return structuredClone(DEFAULT_LAYOUT);
};
export const saveLayout = (l) => localStorage.setItem(KEY, JSON.stringify(l));
export const resetLayout = () => { localStorage.removeItem(KEY); return structuredClone(DEFAULT_LAYOUT); };

export const levelLetter = (i) => String.fromCharCode(65 + i);
