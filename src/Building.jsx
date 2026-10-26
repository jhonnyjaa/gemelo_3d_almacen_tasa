import { useMemo } from 'react';
import * as THREE from 'three';
import { useApp } from './state.js';
import { Inst, Tag, FloorText } from './parts.jsx';

// ---------------------------------------------------------------------------
// Geometría de la nave, medida sobre el plano (unidades de plano; 1 u ≈ 10 cm).
// Cada muro es una polilínea [x,z]; los huecos (puertas) son tramos separados.
// ---------------------------------------------------------------------------
const OUTLINE = [ // perímetro de la nave (incluye el ala de Activos Fijos)
  [150, 332], [287, 347], [420, 345.5], [763, 341], [1010, 338], [1320, 336.5], [1553, 334.5],
  [1553, 707], [154, 717], [137.5, 715], [9, 657],
];
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const WING_A = [287, 347], WING_B = [137.5, 715];

export const WALLS = [
  // perímetro exterior
  [...OUTLINE, OUTLINE[0]],
  // pared entre el ala de Activos Fijos y la nave (con abertura de paso)
  [WING_A, lerp(WING_A, WING_B, 0.212)],
  [lerp(WING_A, WING_B, 0.356), WING_B],
  // Almacén de insumos
  [[1340, 526], [1307, 526], [1307, 707]],
  [[1392, 526], [1421, 526], [1421, 707]],
  // Almacén de electrónicos
  [[1320, 336.5], [1320, 441], [1360, 441]],
  [[1395, 441], [1421, 441], [1421, 336]],
  // SSHH (1er piso, bajo las oficinas) y Oficina activos
  [[1202, 337], [1202, 422], [1240, 422]],
  [[1256, 422], [1320, 422]],
  [[1155, 337], [1155, 422], [1170, 422]],
  [[1184, 422], [1202, 422]],
  // Oficina recepción
  [[951, 339], [951, 428], [968, 428]],
  [[982, 428], [998, 428], [998, 339]],
];

// Segundo piso: losa y oficinas (elevadas sobre SSHH / Oficina activos)
const UP = { y: 46, x0: 1200, x1: 1430, z0: 352, z1: 445 };
const UPPER_WALLS = [
  [[1203, 425], [1225, 425]], [[1240, 425], [1257, 425], [1257, 355]],           // Operaciones
  [[1203, 355], [1203, 425]],
  [[1257, 413], [1285, 413]], [[1300, 413], [1324, 413], [1324, 355]],           // Planificación
  [[1324, 413], [1340, 413]], [[1354, 413], [1370, 413], [1370, 355]],           // Jefatura
  [[1370, 438], [1370, 445], [1425, 445]], [[1425, 445], [1425, 355], [1203, 355]], // Sala de reuniones
  [[1370, 355], [1370, 425]],
];
const UPPER_LABELS = [
  ['OPERACIONES', 1230, 390, 90], ['PLANIFICACIÓN', 1291, 384, 90], ['JEFATURA', 1347, 384, 90], ['SALA DE REUNIONES', 1397, 400, 90],
  ['PASILLO · ESCALERA', 1300, 435, 0],
];
const WALL_H = { off: 0, low: 22, high: 70 };

function segItems(lines, h, thick, y0 = 0) {
  const out = [];
  for (const pl of lines) {
    for (let i = 0; i < pl.length - 1; i++) {
      const [x1, z1] = pl[i], [x2, z2] = pl[i + 1];
      const len = Math.hypot(x2 - x1, z2 - z1);
      out.push({ x: (x1 + x2) / 2, y: y0 + h / 2, z: (z1 + z2) / 2, sx: len + thick, sy: h, sz: thick, ry: -Math.atan2(z2 - z1, x2 - x1) });
    }
  }
  return out;
}
const caps = (items, y0, h) => items.map((it) => ({ ...it, y: y0 + h + 0.35, sy: 0.7, sz: it.sz + 0.5 }));

// Cuadricula: 1 m (10 u) fina, 10 m (100 u) marcada. El UV de ShapeGeometry = coordenadas del plano.
function gridTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 1000;
  const g = c.getContext('2d');
  g.fillStyle = '#d6dbe3'; g.fillRect(0, 0, 1000, 1000);
  g.strokeStyle = 'rgba(71,85,105,.20)'; g.lineWidth = 1;
  for (let i = 1; i < 10; i++) { g.beginPath(); g.moveTo(i * 100 + .5, 0); g.lineTo(i * 100 + .5, 1000); g.moveTo(0, i * 100 + .5); g.lineTo(1000, i * 100 + .5); g.stroke(); }
  g.strokeStyle = 'rgba(30,41,59,.55)'; g.lineWidth = 3;
  g.strokeRect(1, 1, 998, 998);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(0.01, 0.01); t.anisotropy = 8; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function Floor() {
  const showGrid = useApp((s) => s.showGrid);
  const geo = useMemo(() => {
    const sh = new THREE.Shape(); OUTLINE.forEach(([x, z], i) => (i ? sh.lineTo(x, z) : sh.moveTo(x, z)));
    const g = new THREE.ShapeGeometry(sh); g.rotateX(Math.PI / 2); return g;
  }, []);
  const tex = useMemo(gridTexture, []);
  return <mesh geometry={geo}><meshLambertMaterial color={showGrid ? '#ffffff' : '#d6dbe3'} map={showGrid ? tex : null} side={THREE.DoubleSide} /></mesh>;
}

function MeasurePlane() {
  const on = useApp((s) => s.measure.on), add = useApp((s) => s.addMeasure);
  if (!on) return null;
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[784, 0.3, 520]} onClick={(e) => { if (e.delta > 4) return; add(e.point); }}>
      <planeGeometry args={[1700, 900]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}

function Stairs() { // escalera metálica al 2º piso
  const n = 14, x0 = 1412, x1 = 1343, rise = UP.y / n, run = (x0 - x1) / n;
  const steps = Array.from({ length: n }, (_, i) => ({ x: x0 - run * (i + 0.5), y: (rise * (i + 1)) / 2, z: 452, sx: run, sy: rise * (i + 1), sz: 11, ry: 0 }));
  const landing = [{ x: 1332, y: UP.y - 1, z: 451, sx: 22, sy: 2, sz: 13, ry: 0 }];
  return <><Inst items={steps} color="#64748b" /><Inst items={landing} color="#94a3b8" /></>;
}

export default function Building() {
  const wallMode = useApp((s) => s.wallMode), showUpper = useApp((s) => s.showUpper), showPlan = useApp((s) => s.showPlan);
  const h = WALL_H[wallMode];
  const walls = useMemo(() => segItems(WALLS, h, 3), [h]);
  const wallCaps = useMemo(() => caps(walls, 0, h), [walls, h]);
  const upper = useMemo(() => segItems(UPPER_WALLS, 14, 1.8, UP.y), []);
  const upperCaps = useMemo(() => caps(upper, UP.y, 14), [upper]);
  const rails = useMemo(() => segItems([[[UP.x0, UP.z0], [UP.x1, UP.z0], [UP.x1, UP.z1], [UP.x0, UP.z1], [UP.x0, UP.z0]]], 5, 0.8, UP.y), []);
  const columns = useMemo(() => [[1203, 357], [1315, 357], [1427, 357], [1203, 442], [1315, 442], [1427, 442]].map(([x, z]) => ({ x, y: UP.y / 2, z, sx: 3, sy: UP.y, sz: 3, ry: 0 })), []);
  const tex = useMemo(() => { const t = new THREE.TextureLoader().load('/plano.png'); t.colorSpace = THREE.SRGBColorSpace; return t; }, []);
  return (
    <group>
      <Floor />
      <MeasurePlane />
      {h > 0 && <><Inst items={walls} color="#c3cad6" /><Inst items={wallCaps} color="#8a95a6" /></>}
      <Stairs />
      {showPlan && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[1558.1 / 2, 0.9, 303.2 + 434 / 2]} renderOrder={3}>
          <planeGeometry args={[1558.1, 434]} /><meshBasicMaterial map={tex} transparent opacity={0.55} depthWrite={false} />
        </mesh>
      )}
      {showUpper && (
        <group>
          <mesh position={[(UP.x0 + UP.x1) / 2, UP.y - 1, (UP.z0 + UP.z1) / 2]}>
            <boxGeometry args={[UP.x1 - UP.x0, 2, UP.z1 - UP.z0]} /><meshLambertMaterial color="#cdd5e0" />
          </mesh>
          <Inst items={columns} color="#7b8596" />
          <Inst items={upper} color="#eef2f7" /><Inst items={upperCaps} color="#9aa5b6" />
          <Inst items={rails} color="#64748b" />
          {UPPER_LABELS.map(([t, x, z, r]) => <FloorText key={t} text={t} x={x} z={z} y={UP.y + 0.5} size={4.6} rot={r} color="#334155" />)}
          <Tag text="2º PISO · OFICINAS" position={[(UP.x0 + UP.x1) / 2, UP.y + 16, UP.z0 - 4]} size={6} />
        </group>
      )}
    </group>
  );
}
