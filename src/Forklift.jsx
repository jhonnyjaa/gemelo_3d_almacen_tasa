import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// Posición actual del montacargas (la lee la cámara en modo "seguir").
export const forkliftPos = new THREE.Vector3(784, 0, 560);

// Ruta: bucle por los pasillos entre racks 2-3 (arriba) y 4-5 (abajo), con esquinas redondeadas.
function buildPath(x0, x1, z0, z1, r, seg = 10) {
  const pts = [];
  const arc = (cx, cz, a0, a1) => { for (let i = 0; i < seg; i++) { const a = a0 + ((a1 - a0) * i) / seg; pts.push([cx + r * Math.cos(a), cz + r * Math.sin(a)]); } };
  arc(x1 - r, z0 + r, -Math.PI / 2, 0);
  arc(x1 - r, z1 - r, 0, Math.PI / 2);
  arc(x0 + r, z1 - r, Math.PI / 2, Math.PI);
  arc(x0 + r, z0 + r, Math.PI, Math.PI * 1.5);
  const cum = [0];
  for (let i = 1; i <= pts.length; i++) {
    const a = pts[i - 1], b = pts[i % pts.length];
    cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  return { pts, cum, total: cum[pts.length] };
}
const PATH = buildPath(199, 1105, 563.5, 658.5, 24);
const SPEED = 42; // unidades/s (1 unidad ≈ 10 cm → ~15 km/h)

function at(s) {
  const { pts, cum, total } = PATH;
  s = ((s % total) + total) % total;
  let lo = 0, hi = cum.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= s) lo = m; else hi = m; }
  const a = pts[lo % pts.length], b = pts[(lo + 1) % pts.length], t = (s - cum[lo]) / (cum[lo + 1] - cum[lo] || 1);
  return { x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t };
}

function decal(text, color, bg, w = 256, h = 96, font = 'bold 54px system-ui, Arial') {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.fillStyle = color; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + 3);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

const ORANGE = '#f28a00', ORANGE_D = '#d97706', BLACK = '#1b1f27', STEEL = '#8d96a5';
const Mat = ({ c }) => <meshLambertMaterial color={c} />;
const Box = ({ p, s, c }) => <mesh position={p}><boxGeometry args={s} /><Mat c={c} /></mesh>;

function Wheel({ r, w, pos, refFn }) {
  return (
    <group position={pos}>
      <group ref={refFn}>
        <mesh rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[r, r, w, 20]} /><Mat c="#0d0f14" /></mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[r * 0.55, r * 0.55, w + 0.1, 14]} /><Mat c="#aab2c0" /></mesh>
        <mesh position={[r * 0.7, 0, 0]}><boxGeometry args={[r * 0.35, r * 0.35, w + 0.2]} /><Mat c="#e5e7eb" /></mesh>
      </group>
    </group>
  );
}

// Montacargas Toyota 2.5 t (modelo procedural): +X = adelante.
export default function Forklift() {
  const root = useRef(), wheels = useRef([]), beacon = useRef(), lift = useRef();
  const s = useRef(40);
  const tex = useMemo(() => ({
    toyota: decal('TOYOTA', '#111827', '#f28a00'),
    ton: decal('2.5 t', '#ffffff', '#1f2937', 192, 96, 'bold 58px system-ui, Arial'),
  }), []);
  useFrame((st, dt) => {
    dt = Math.min(dt, 0.1);
    s.current += SPEED * dt;
    const p = at(s.current), p2 = at(s.current + 6);
    const h = Math.atan2(p2.z - p.z, p2.x - p.x);
    root.current.position.set(p.x, 0, p.z); root.current.rotation.y = -h;
    forkliftPos.set(p.x, 12, p.z);
    for (const w of wheels.current) if (w) w.rotation.z -= (SPEED * dt) / 3;
    const k = 0.5 + 0.5 * Math.sin(st.clock.elapsedTime * 7);
    if (beacon.current) beacon.current.material.emissiveIntensity = 0.2 + 2 * k;
    if (lift.current) lift.current.position.y = 4.2 + 0.6 * Math.sin(st.clock.elapsedTime * 0.8);
  });
  const W = (i) => (el) => { wheels.current[i] = el; };
  return (
    <group ref={root}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[3, 0.35, 0]}><planeGeometry args={[34, 14]} /><meshBasicMaterial color="#000" transparent opacity={0.22} depthWrite={false} /></mesh>
      {/* chasis y contrapeso */}
      <Box p={[-3.5, 5.5, 0]} s={[17, 5, 11]} c={ORANGE} />
      <Box p={[-9.5, 9.5, 0]} s={[8, 10, 11]} c={ORANGE_D} />
      <Box p={[-4, 10.5, 0]} s={[8, 3.2, 9.4]} c={ORANGE} />
      <Box p={[3.2, 9, 0]} s={[6, 4, 9]} c={ORANGE} />
      <Box p={[-12.9, 8, 0]} s={[0.4, 3, 7]} c={BLACK} />
      {/* asiento y volante */}
      <Box p={[-3, 12.6, 0]} s={[3.6, 1.6, 6.4]} c={BLACK} />
      <Box p={[-5, 15.2, 0]} s={[1, 5.2, 6.2]} c={BLACK} />
      <mesh position={[3.4, 13.3, 0]} rotation={[0, 0, -0.9]}><cylinderGeometry args={[0.35, 0.35, 5, 8]} /><Mat c={BLACK} /></mesh>
      <mesh position={[4.6, 15.4, 0]} rotation={[0, 0, -0.9]}><cylinderGeometry args={[1.7, 1.7, 0.3, 16]} /><Mat c={BLACK} /></mesh>
      {/* techo de protección y baliza */}
      {[[-6.8, -4.8], [-6.8, 4.8], [4.2, -4.8], [4.2, 4.8]].map(([x, z], i) => <Box key={i} p={[x, 17.4, z]} s={[0.8, 10, 0.8]} c={BLACK} />)}
      <Box p={[-1.3, 22.6, 0]} s={[12, 0.7, 11]} c="#2b313c" />
      {[-3.6, -1.2, 1.2, 3.6].map((z, i) => <Box key={'b' + i} p={[-1.3, 22.7, z]} s={[12.2, 0.75, 0.5]} c={BLACK} />)}
      <mesh ref={beacon} position={[-6.5, 23.8, 0]}>
        <cylinderGeometry args={[0.9, 1.1, 1.6, 12]} /><meshStandardMaterial color="#1d4ed8" emissive="#3b82f6" emissiveIntensity={1} />
      </mesh>
      {/* mástil */}
      {[-4, 4].map((z, i) => <Box key={'m' + i} p={[7.4, 11, z]} s={[1.3, 22, 1.6]} c="#2b313c" />)}
      <Box p={[7.4, 21.2, 0]} s={[1.3, 1.4, 9.6]} c="#2b313c" />
      <Box p={[7.4, 3.6, 0]} s={[1.3, 1.6, 9.6]} c="#2b313c" />
      {/* carro, horquillas y carga */}
      <group ref={lift} position={[0, 4.2, 0]}>
        <Box p={[8.8, 4.5, 0]} s={[1, 8, 10]} c={STEEL} />
        <Box p={[8.8, 9, 0]} s={[1.2, 0.8, 10]} c={STEEL} />
        {[-3.2, 3.2].map((z, i) => <Box key={'f' + i} p={[14.8, 0.45, z]} s={[11.5, 0.9, 1.5]} c={STEEL} />)}
        <Box p={[15.4, 1.5, 0]} s={[10.2, 1.2, 12]} c="#b8864b" />
        <Box p={[15.4, 6.0, 0]} s={[9.2, 7.8, 10.8]} c="#c89b5a" />
        <Box p={[15.4, 8.1, 0]} s={[9.3, 0.5, 10.9]} c="#d9b27a" />
      </group>
      {/* ruedas */}
      <Wheel r={3.4} w={2.8} pos={[3.2, 3.4, 6.2]} refFn={W(0)} /><Wheel r={3.4} w={2.8} pos={[3.2, 3.4, -6.2]} refFn={W(1)} />
      <Wheel r={2.7} w={2.4} pos={[-9.5, 2.7, 5.4]} refFn={W(2)} /><Wheel r={2.7} w={2.4} pos={[-9.5, 2.7, -5.4]} refFn={W(3)} />
      {/* rótulos laterales */}
      {[1, -1].map((side) => (
        <group key={side}>
          <mesh position={[-9.5, 10, 5.56 * side]} rotation={[0, side === 1 ? 0 : Math.PI, 0]}><planeGeometry args={[6.4, 2.4]} /><meshBasicMaterial map={tex.toyota} /></mesh>
          <mesh position={[-2.2, 6.6, 5.56 * side]} rotation={[0, side === 1 ? 0 : Math.PI, 0]}><planeGeometry args={[4.6, 2.3]} /><meshBasicMaterial map={tex.ton} /></mesh>
        </group>
      ))}
    </group>
  );
}
