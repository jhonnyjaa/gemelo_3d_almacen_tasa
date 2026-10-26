import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Tag } from './parts.jsx';

// Personas de contexto (1 unidad = 10 cm; una persona mide ~17,5 u).
export const walkerPos = new THREE.Vector3();
const SKIN = '#e0ac82', PANTS = '#1e293b', SHIRT = '#334155', BOOT = '#111827';

const Mat = ({ c }) => <meshLambertMaterial color={c} />;
const Box = ({ p, s, c, r }) => <mesh position={p} rotation={r}><boxGeometry args={s} /><Mat c={c} /></mesh>;

function Head({ helmet, y = 15.9 }) {
  return (
    <group position={[0, y, 0]}>
      <mesh><sphereGeometry args={[1.25, 14, 12]} /><Mat c={SKIN} /></mesh>
      <Box p={[0.9, 0.1, 0]} s={[0.3, 0.3, 0.9]} c="#c98f66" />
      {helmet && (
        <group position={[0, 0.35, 0]}>
          <mesh><sphereGeometry args={[1.55, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} /><Mat c="#facc15" /></mesh>
          <mesh position={[0, -0.05, 0]}><cylinderGeometry args={[1.62, 1.62, 0.25, 18]} /><Mat c="#eab308" /></mesh>
          <Box p={[1.3, -0.05, 0]} s={[1.2, 0.2, 2.2]} c="#eab308" />
        </group>
      )}
    </group>
  );
}

// ------------------------------------------------------------ persona caminando (casco + chaleco)
function buildPath(x0, x1, z0, z1, r, seg = 8) {
  const pts = [];
  const arc = (cx, cz, a0, a1) => { for (let i = 0; i < seg; i++) { const a = a0 + ((a1 - a0) * i) / seg; pts.push([cx + r * Math.cos(a), cz + r * Math.sin(a)]); } };
  arc(x1 - r, z0 + r, -Math.PI / 2, 0); arc(x1 - r, z1 - r, 0, Math.PI / 2);
  arc(x0 + r, z1 - r, Math.PI / 2, Math.PI); arc(x0 + r, z0 + r, Math.PI, Math.PI * 1.5);
  const cum = [0];
  for (let i = 1; i <= pts.length; i++) { const a = pts[i - 1], b = pts[i % pts.length]; cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
  return { pts, cum, total: cum[pts.length] };
}
const PATH = buildPath(255, 1095, 452, 480, 12);
const SPEED = 14; // 1,4 m/s

function at(s) {
  const { pts, cum, total } = PATH;
  s = ((s % total) + total) % total;
  let lo = 0, hi = cum.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= s) lo = m; else hi = m; }
  const a = pts[lo % pts.length], b = pts[(lo + 1) % pts.length], t = (s - cum[lo]) / (cum[lo + 1] - cum[lo] || 1);
  return { x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t };
}

function Walker() {
  const root = useRef(), body = useRef(), legL = useRef(), legR = useRef(), armL = useRef(), armR = useRef();
  const s = useRef(120);
  useFrame((_, dt) => {
    dt = Math.min(dt, 0.1);
    s.current += SPEED * dt;
    const p = at(s.current), q = at(s.current + 3);
    root.current.position.set(p.x, 0, p.z); root.current.rotation.y = -Math.atan2(q.z - p.z, q.x - p.x);
    walkerPos.set(p.x, 9, p.z);
    const ph = (s.current / 4.2) * Math.PI; // un paso ≈ 0,75 m
    const sw = Math.sin(ph) * 0.65;
    legL.current.rotation.z = sw; legR.current.rotation.z = -sw;
    armL.current.rotation.z = -sw * 0.8; armR.current.rotation.z = sw * 0.8;
    body.current.position.y = Math.abs(Math.cos(ph)) * 0.35;
  });
  const leg = (ref, z) => (
    <group ref={ref} position={[0, 8.4, z]}>
      <Box p={[0, -4.2, 0]} s={[2.2, 8.4, 2.2]} c={PANTS} />
      <Box p={[0.7, -8.1, 0]} s={[3.6, 1.2, 2.4]} c={BOOT} />
    </group>
  );
  const arm = (ref, z) => (
    <group ref={ref} position={[0, 14.3, z]}>
      <Box p={[0, -3.2, 0]} s={[1.7, 6.4, 1.7]} c={SHIRT} />
      <Box p={[0, -6.8, 0]} s={[1.5, 1.2, 1.5]} c={SKIN} />
    </group>
  );
  return (
    <group ref={root}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.3, 0]}><circleGeometry args={[3.6, 16]} /><meshBasicMaterial color="#000" transparent opacity={0.22} depthWrite={false} /></mesh>
      <group ref={body}>
        {leg(legL, 1.3)}{leg(legR, -1.3)}
        {/* torso con chaleco reflectivo */}
        <Box p={[0, 11.7, 0]} s={[2.6, 6.6, 5]} c={SHIRT} />
        <Box p={[0, 11.9, 0]} s={[2.85, 6.0, 5.25]} c="#ff7a00" />
        <Box p={[0, 10.3, 0]} s={[2.9, 0.55, 5.3]} c="#e5e7eb" />
        <Box p={[0, 12.6, 0]} s={[2.9, 0.55, 5.3]} c="#e5e7eb" />
        {arm(armL, 3.3)}{arm(armR, -3.3)}
        <Head helmet />
      </group>
    </group>
  );
}

// ------------------------------------------------------------ puesto de trabajo (silla + escritorio + PC) con persona sentada
function screenTexture(title, lines, accent) {
  const c = document.createElement('canvas'); c.width = 320; c.height = 200;
  const g = c.getContext('2d');
  g.fillStyle = '#f8fafc'; g.fillRect(0, 0, 320, 200);
  g.fillStyle = accent; g.fillRect(0, 0, 320, 34);
  g.fillStyle = '#fff'; g.font = 'bold 20px system-ui, Arial'; g.textBaseline = 'middle'; g.fillText(title, 10, 18);
  g.fillStyle = '#334155'; g.font = '15px system-ui, Arial';
  lines.forEach((l, i) => { g.fillText(l, 12, 56 + i * 26); g.fillStyle = '#cbd5e1'; g.fillRect(12, 66 + i * 26, 296, 1); g.fillStyle = '#334155'; });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

function Workstation({ position, title, lines, accent, label, papers = false }) {
  const armL = useRef(), armR = useRef(), head = useRef();
  const tex = useMemo(() => screenTexture(title, lines, accent), [title, lines, accent]);
  useFrame((st) => {
    const t = st.clock.elapsedTime;
    armL.current.rotation.z = 1.15 + Math.sin(t * 9) * 0.05; armR.current.rotation.z = 1.15 + Math.sin(t * 9 + 1.7) * 0.05;
    head.current.rotation.z = -0.12 + Math.sin(t * 1.3) * 0.03;
  });
  return (
    <group position={position} rotation={[0, Math.PI / 2, 0]}>{/* +X local = hacia el norte (-z) */}
      <group position={[1.5, 0, 0]}>
      {/* silla */}
      <Box p={[-1.5, 4.6, 0]} s={[5.4, 0.8, 5.4]} c="#1f2937" />
      <Box p={[-4.1, 8.4, 0]} s={[0.8, 6.8, 5.2]} c="#1f2937" />
      <mesh position={[-1.5, 2.2, 0]}><cylinderGeometry args={[0.35, 0.35, 4.4, 8]} /><Mat c="#6b7280" /></mesh>
      <Box p={[-1.5, 0.5, 0]} s={[5, 0.5, 0.7]} c="#4b5563" /><Box p={[-1.5, 0.5, 0]} s={[0.7, 0.5, 5]} c="#4b5563" />
      {/* persona sentada */}
      <Box p={[-1.2, 5.6, 0]} s={[2.8, 2.0, 4.6]} c={PANTS} />
      <Box p={[1.8, 5.5, 1.3]} s={[4.6, 1.8, 2.0]} c={PANTS} /><Box p={[1.8, 5.5, -1.3]} s={[4.6, 1.8, 2.0]} c={PANTS} />
      <Box p={[3.7, 2.9, 1.3]} s={[2.0, 5.2, 2.0]} c={PANTS} /><Box p={[3.7, 2.9, -1.3]} s={[2.0, 5.2, 2.0]} c={PANTS} />
      <Box p={[4.4, 0.4, 1.3]} s={[3.4, 0.9, 2.2]} c={BOOT} /><Box p={[4.4, 0.4, -1.3]} s={[3.4, 0.9, 2.2]} c={BOOT} />
      <Box p={[-1.8, 9.4, 0]} s={[2.6, 6.4, 5]} c="#e2e8f0" />
      {[1, -1].map((side, i) => (
        <group key={side} ref={i ? armR : armL} position={[-1.8, 11.9, 3.3 * side]} rotation={[0, 0, 1.15]}>
          <Box p={[0, -3.2, 0]} s={[1.6, 6.4, 1.6]} c="#e2e8f0" />
          <Box p={[0, -6.8, 0]} s={[1.4, 1.2, 1.4]} c={SKIN} />
        </group>
      ))}
      <group ref={head} position={[-1.7, 0, 0]}><Head helmet={false} y={14.0} /></group>
      </group>
      {/* escritorio */}
      <Box p={[7, 7.2, 0]} s={[8.5, 0.8, 21]} c="#a16207" />
      {[[3.1, 9.2], [3.1, -9.2], [10.9, 9.2], [10.9, -9.2]].map(([x, z], i) => <Box key={i} p={[x, 3.4, z]} s={[0.8, 7, 0.8]} c="#78350f" />)}
      <Box p={[11.1, 5.5, 0]} s={[0.4, 3.2, 20]} c="#92400e" />
      {/* PC: monitor (pantalla hacia la persona), teclado y mouse */}
      <Box p={[9.1, 8.2, 0]} s={[1.4, 1.2, 2.4]} c="#111827" />
      <Box p={[9.1, 10.6, 0]} s={[0.7, 4.4, 7.4]} c="#111827" />
      <mesh position={[8.7, 10.7, 0]} rotation={[0, -Math.PI / 2, 0]}><planeGeometry args={[6.8, 4.1]} /><meshBasicMaterial map={tex} /></mesh>
      <Box p={[5.7, 7.75, 0]} s={[2.0, 0.3, 6.2]} c="#e5e7eb" /><Box p={[5.7, 7.75, 5.2]} s={[1.3, 0.3, 1.0]} c="#e5e7eb" />
      {papers && <>
        <Box p={[6.7, 7.7, -6.5]} s={[3.0, 0.15, 2.1]} c="#f8fafc" /><Box p={[7.0, 7.85, -6.3]} s={[3.0, 0.15, 2.1]} c="#f1f5f9" />
        <Box p={[8.0, 7.75, 7.2]} s={[2.4, 1.1, 3.4]} c="#cbd5e1" />
      </>}
      <group rotation={[0, -Math.PI / 2, 0]}><Tag text={label} position={[0, 30, 0]} size={3.4} bg="rgba(15,18,25,.6)" /></group>
    </group>
  );
}

export default function People() {
  return (
    <group>
      <Walker />
      <Workstation position={[975, 0, 360]} accent="#1d4ed8" title="GUÍA DE REMISIÓN"
        lines={['N° 0001-004512', 'Remitente: PROVEEDOR S.A.', 'Destino: ALMACÉN L001', 'Ítem 1  ·  10 UN', 'Ítem 2  ·  4 CJ']} label="Recepción · registrando guía de remisión" papers />
      <Workstation position={[1178, 0, 356]} accent="#0f766e" title="ACTIVOS FIJOS"
        lines={['Act.Fijo 3000869', 'CENTRIFUGA 3 30000 LT/H', 'Ubi.Física: PATIO EXT', 'Estado: PEND_REP']} label="Activos · gestión de activos fijos" />
    </group>
  );
}
