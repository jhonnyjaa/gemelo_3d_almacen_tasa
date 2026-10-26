import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useApp } from './state.js';
import { TYPES } from './importer.js';
import Forklift, { forkliftPos } from './Forklift.jsx';
import People from './People.jsx';

const TCOL = Object.fromEntries(Object.entries(TYPES).map(([k, v]) => [k, new THREE.Color(v.color)]));
const DIM = new THREE.Color('#aab2c0');
export const EXP = { expired: new THREE.Color('#ef4444'), soon: new THREE.Color('#f59e0b'), ok: new THREE.Color('#22c55e'), none: new THREE.Color('#94a3b8') };

import { Inst, Tag, FloorText, Y, BOX } from './parts.jsx';
import { cellGeom } from './model.js';
import Building from './Building.jsx';

// ---------------------------------------------------------------- racks
function rackParts(world, floor) {
  const up = [], beam = [], deck = [], owner = [], labels = [];
  for (const info of world.racks.values()) {
    const { r, segs, levels, ys, height, baseY, depth } = info;
    if (floor && r.floor && r.floor !== floor) continue;
    const top = baseY + height;
    for (const s of segs) {
      const cx = (s.x1 + s.x2) / 2, cz = (s.z1 + s.z2) / 2, c = Math.cos(s.th), sn = Math.sin(s.th), ry = -s.th;
      const at = (u, v) => [cx + u * c - v * sn, cz + u * sn + v * c];
      for (let l = 0; l < levels; l++) {
        deck.push({ x: cx, y: baseY + ys[l] + 0.5, z: cz, sx: s.len, sy: 0.7, sz: depth - 0.6, ry }); owner.push(r.id);
        for (const v of [-1, 1]) { const [x, z] = at(0, v * (depth / 2 - 0.5)); beam.push({ x, y: baseY + ys[l] + 1.5, z, sx: s.len, sy: 1.6, sz: 0.9, ry }); }
      }
      if (r.floor === 2) { deck.push({ x: cx, y: baseY - 2, z: cz, sx: s.len + 2, sy: 2.4, sz: depth + 3, ry }); owner.push(r.id); }
      const nc = Math.max(1, s.c1 - s.c0 + 1);
      for (let i = 0; i <= nc; i++) {
        for (const v of [-1, 1]) {
          const [x, z] = at(-s.len / 2 + (s.len * i) / nc, v * (depth / 2 - 0.5));
          up.push({ x, y: baseY + (top - baseY + 2) / 2, z, sx: 1, sy: top - baseY + 2, sz: 1, ry });
        }
      }
    }
    const m = segs[Math.floor(segs.length / 2)];
    labels.push({ id: r.id, pos: [(m.x1 + m.x2) / 2, top + 7, (m.z1 + m.z2) / 2], size: r.floor ? 7 : 11 });
  }
  return { up, beam, deck, owner, labels };
}

function useGroundDrag() {
  const { gl, camera, controls } = useThree();
  const moveItem = useApp((s) => s.moveItem), persist = useApp((s) => s.persistLayout);
  return (hit, ev) => {
    const ray = new THREE.Raycaster(), plane = new THREE.Plane(Y, 0), p = new THREE.Vector3(), ndc = new THREE.Vector2();
    const ground = (e) => {
      const r = gl.domElement.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      return ray.ray.intersectPlane(plane, p) ? p.clone() : null;
    };
    let last = ground(ev), moved = false, pend = null, raf = 0;
    if (controls) controls.enabled = false;
    const flush = () => { raf = 0; if (pend) { moveItem(hit, pend.dx, pend.dz); pend = null; } };
    const mv = (e) => {
      const g = ground(e); if (!g || !last) return;
      const dx = g.x - last.x, dz = g.z - last.z; last = g; moved = true;
      pend = pend ? { dx: pend.dx + dx, dz: pend.dz + dz } : { dx, dz };
      if (!raf) raf = requestAnimationFrame(flush);
    };
    const up = () => {
      window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up);
      if (controls) controls.enabled = true;
      cancelAnimationFrame(raf); flush(); if (moved) persist();
    };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  };
}

const HEAT = (t) => new THREE.Color().setHSL((1 - Math.min(1, Math.max(0, t))) * 0.33, 0.75, 0.5);
const DECK = new THREE.Color('#b9c0cc');

function Racks() {
  const world = useApp((s) => s.world), floor = useApp((s) => s.floor), edit = useApp((s) => s.edit);
  const heat = useApp((s) => s.heat), sel = useApp((s) => s.sel), editSel = useApp((s) => s.editSel), set = useApp((s) => s.set);
  const parts = useMemo(() => rackParts(world, floor), [world, floor]);
  const deckColors = useMemo(() => parts.deck.map((_, i) => {
    if (!heat) return DECK;
    const o = world.occ.get(parts.owner[i]); return HEAT(o ? o.used / Math.max(1, o.total) : 0);
  }), [parts, heat, world]);
  const startDrag = useGroundDrag();
  const down = (e) => {
    if (!edit || e.button !== 0) return;
    e.stopPropagation();
    const hit = { rack: parts.owner[e.instanceId] };
    set({ editSel: hit }); startDrag(hit, e.nativeEvent);
  };
  // letras de nivel (A, B, C...) del rack seleccionado
  const rid = edit ? editSel?.rack : sel?.box?.p?.kind === 'rack' ? sel.box.p.rack : sel?.cell?.rack;
  const info = rid != null && world.racks.get(rid);
  const letters = useMemo(() => {
    if (!info) return [];
    const sg = info.segs[0], c = Math.cos(sg.th), sn = Math.sin(sg.th), off = -sg.len / 2 - 6;
    return Array.from({ length: info.levels }, (_, l) => ({
      t: String.fromCharCode(65 + l), pos: [(sg.x1 + sg.x2) / 2 + off * c, info.baseY + info.ys[l] + info.hs[l] / 2, (sg.z1 + sg.z2) / 2 + off * sn],
    }));
  }, [info]);
  return (
    <group>
      <Inst items={parts.up} color="#2563eb" />
      <Inst items={parts.beam} color="#ea7a1a" />
      <Inst items={parts.deck} colors={deckColors} onPointerDown={down} />
      {parts.labels.map((l) => <Tag key={l.id} text={String(l.id)} position={l.pos} size={l.size} />)}
      {letters.map((l) => <Tag key={l.t} text={l.t} position={l.pos} size={5} color="#fde047" />)}
    </group>
  );
}

// ---------------------------------------------------------------- zonas pintadas y rótulos
function Zones() {
  const layout = useApp((s) => s.layout), edit = useApp((s) => s.edit), set = useApp((s) => s.set), select = useApp((s) => s.select);
  const startDrag = useGroundDrag();
  return (
    <group>
      {layout.zones.map((z, i) => (
        <group key={i} position={[z.x, 0.4, z.z]} rotation={[0, -(z.rot * Math.PI) / 180, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}
            onPointerDown={(e) => { if (!edit || e.button !== 0) return; e.stopPropagation(); const hit = { zone: i }; set({ editSel: hit }); startDrag(hit, e.nativeEvent); }}
            onClick={(e) => { if (edit || e.delta > 4) return; e.stopPropagation(); select({ zone: i }); }}>
            <planeGeometry args={[z.w, z.d]} /><meshBasicMaterial color={z.color} transparent opacity={0.3} depthWrite={false} />
          </mesh>
          <lineSegments rotation={[-Math.PI / 2, 0, 0]}>
            <edgesGeometry args={[new THREE.PlaneGeometry(z.w, z.d)]} /><lineBasicMaterial color={z.color} />
          </lineSegments>
        </group>
      ))}
      {layout.zones.map((z, i) => <Tag key={'t' + i} text={z.name} position={[z.x, 16, z.z]} size={7} color={z.color} />)}
      {(layout.labels || []).map((l, i) => <FloorText key={i} {...l} />)}
    </group>
  );
}

// ---------------------------------------------------------------- cajas (artículos)
function Boxes() {
  const world = useApp((s) => s.world), matches = useApp((s) => s.matches), edit = useApp((s) => s.edit);
  const select = useApp((s) => s.select), set = useApp((s) => s.set);
  const items = useMemo(() => world.placed.map((p) => ({ x: p.x, y: p.y + p.sy / 2, z: p.z, sx: p.sx, sy: p.sy, sz: p.sz, ry: -p.th, b: p.b })), [world]);
  const colorMode = useApp((s) => s.colorMode);
  const colors = useMemo(() => {
    const hl = matches ? new Set(matches.map((b) => b.key)) : null;
    const now = Date.now();
    return items.map((it) => {
      if (hl && !hl.has(it.b.key)) return DIM;
      if (colorMode !== 'expiry') return TCOL[it.b.t];
      const e = it.b.expiry; if (!e) return EXP.none;
      const d = (e.getTime() - now) / 86400000;
      return d < 0 ? EXP.expired : d <= 90 ? EXP.soon : EXP.ok;
    });
  }, [items, matches, colorMode]);
  const lastHover = useRef(null);
  return (
    <Inst items={items} colors={colors}
      onClick={(e) => { if (edit || e.delta > 4) return; e.stopPropagation(); select({ box: items[e.instanceId].b }); }}
      onPointerMove={(e) => {
        if (edit) return; e.stopPropagation();
        const b = items[e.instanceId]?.b; document.body.style.cursor = 'pointer';
        if (lastHover.current !== b || true) { lastHover.current = b; set({ hover: { b, x: e.nativeEvent.clientX, y: e.nativeEvent.clientY } }); }
      }}
      onPointerOut={() => { document.body.style.cursor = ''; lastHover.current = null; set({ hover: null }); }} />
  );
}

function Outline({ t, color }) {
  const geo = useMemo(() => new THREE.EdgesGeometry(BOX), []);
  if (!t) return null;
  return (
    <lineSegments geometry={geo} position={[t.x, t.y, t.z]} scale={[t.sx, t.sy, t.sz]} rotation={[0, t.ry, 0]} renderOrder={20}>
      <lineBasicMaterial color={color} depthTest={false} />
    </lineSegments>
  );
}
function Selection() {
  const sel = useApp((s) => s.sel), world = useApp((s) => s.world);
  const box = useMemo(() => {
    const p = sel?.box && world.placed.find((x) => x.b === sel.box);
    return p && { x: p.x, y: p.y + p.sy / 2, z: p.z, sx: p.sx * 1.25, sy: p.sy * 1.25, sz: p.sz * 1.25, ry: -p.th };
  }, [sel, world]);
  const cell = useMemo(() => {
    const b = sel?.box, k = sel?.cell || (b?.p?.kind === 'rack' ? { rack: b.p.rack, level: b.p.level, col: b.p.col } : null);
    const info = k && world.racks.get(k.rack);
    if (!info || k.level >= info.levels) return null;
    const g = cellGeom(info, k.level, k.col);
    return { x: g.cx, y: g.y + g.h / 2, z: g.cz, sx: g.cw, sy: g.h - 1.5, sz: g.d, ry: -g.th };
  }, [sel, world]);
  return <><Outline t={cell} color="#22d3ee" /><Outline t={box} color="#fde047" /></>;
}

// ---------------------------------------------------------------- cámara
function Rig() {
  const { camera, controls } = useThree();
  const cam = useApp((s) => s.cam), follow = useApp((s) => s.follow);
  const anim = useRef(null), prev = useRef(null);
  useEffect(() => {
    if (!cam || !controls) return;
    const dir = cam.top ? new THREE.Vector3(0, 1, 0.0001).normalize() : camera.position.clone().sub(controls.target).normalize();
    if (!cam.top) { dir.y = Math.max(dir.y, 0.7); dir.normalize(); }
    const to = new THREE.Vector3(cam.x, cam.y, cam.z);
    anim.current = { t0: performance.now(), from: camera.position.clone(), fromT: controls.target.clone(), to: to.clone().addScaledVector(dir, cam.dist), toT: to };
  }, [cam, camera, controls]);
  useEffect(() => {
    if (!follow || !controls) return;
    controls.target.copy(forkliftPos); camera.position.copy(forkliftPos).add(new THREE.Vector3(-70, 80, 100));
    prev.current = forkliftPos.clone(); anim.current = null;
  }, [follow, camera, controls]);
  useFrame(() => {
    if (follow && controls) {
      if (prev.current) { const d = forkliftPos.clone().sub(prev.current); camera.position.add(d); controls.target.add(d); }
      prev.current = forkliftPos.clone(); controls.update(); return;
    }
    prev.current = null;
    const a = anim.current; if (!a || !controls) return;
    const k = Math.min(1, (performance.now() - a.t0) / 800), e = k * k * (3 - 2 * k);
    camera.position.lerpVectors(a.from, a.to, e); controls.target.lerpVectors(a.fromT, a.toT, e); controls.update();
    if (k >= 1) anim.current = null;
  });
  return null;
}

function Measure() {
  const m = useApp((s) => s.measure);
  const geo = useMemo(() => new THREE.BufferGeometry(), []);
  const [a, b] = m.pts;
  useMemo(() => { if (a && b) geo.setAttribute('position', new THREE.Float32BufferAttribute([a.x, 1.5, a.z, b.x, 1.5, b.z], 3)); }, [a, b, geo]);
  if (!m.on) return null;
  const d = a && b ? Math.hypot(b.x - a.x, b.z - a.z) : 0;
  return (
    <group>
      {m.pts.map((p, i) => <mesh key={i} position={[p.x, 1.5, p.z]} renderOrder={30}><sphereGeometry args={[1.6, 12, 12]} /><meshBasicMaterial color="#f43f5e" depthTest={false} /></mesh>)}
      {a && b && (
        <>
          <line geometry={geo} renderOrder={30}><lineBasicMaterial color="#f43f5e" depthTest={false} /></line>
          <Tag text={(d / 10).toFixed(2) + ' m'} position={[(a.x + b.x) / 2, 12, (a.z + b.z) / 2]} size={8} color="#fecdd3" />
        </>
      )}
    </group>
  );
}

function ScaleBar() { // regla de 10 m con marcas cada 1 m
  const ticks = Array.from({ length: 11 }, (_, i) => ({ x: 120 + i * 10, y: 1.2, z: 745, sx: i % 5 ? 0.5 : 0.9, sy: 0.4, sz: i % 5 ? 3 : 5, ry: 0 }));
  return (
    <group>
      <Inst items={[{ x: 170, y: 1.2, z: 745, sx: 100, sy: 0.4, sz: 0.9, ry: 0 }, ...ticks]} color="#e2e8f0" />
      <Tag text="10 m" position={[170, 9, 745]} size={6} />
    </group>
  );
}

export default function Scene() {
  const world = useApp((s) => s.world), showForklift = useApp((s) => s.showForklift), showPeople = useApp((s) => s.showPeople);
  const edit = useApp((s) => s.edit), select = useApp((s) => s.select);
  return (
    <Canvas camera={{ position: [784, 1050, 830], fov: 45, near: 1, far: 9000 }} dpr={[1, 2]} gl={{ antialias: true }}
      onPointerMissed={() => !edit && select(null)}>
      <color attach="background" args={['#0b0e14']} />
      <hemisphereLight args={['#ffffff', '#8890a0', 1.6]} />
      <directionalLight position={[500, 900, 300]} intensity={1.6} />
      <OrbitControls makeDefault target={[784, 0, 450]} maxPolarAngle={Math.PI * 0.49} minDistance={25} maxDistance={2800} />
      <Rig />
      <Building />
      <Measure />
      <ScaleBar />
      {showForklift && <Forklift />}
      {showPeople && <People />}
      {world && <><Zones /><Racks /><Boxes /><Selection /></>}
    </Canvas>
  );
}
