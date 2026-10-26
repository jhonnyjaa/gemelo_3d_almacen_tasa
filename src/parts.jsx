import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

export const Y = new THREE.Vector3(0, 1, 0);
export const BOX = new THREE.BoxGeometry(1, 1, 1);

// ---------------------------------------------------------------- utilidades
export function Inst({ items, color = '#ffffff', colors, ...events }) {
  const ref = useRef();
  useLayoutEffect(() => {
    const m = ref.current; if (!m) return;
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), S = new THREE.Vector3();
    items.forEach((it, i) => {
      Q.setFromAxisAngle(Y, it.ry || 0); P.set(it.x, it.y, it.z); S.set(it.sx, it.sy, it.sz);
      m.setMatrixAt(i, M.compose(P, Q, S));
      if (colors) m.setColorAt(i, colors[i]);
    });
    m.count = items.length;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
  }, [items, colors]);
  return (
    <instancedMesh key={items.length} ref={ref} args={[BOX, undefined, Math.max(1, items.length)]} frustumCulled={false} {...events}>
      <meshLambertMaterial color={color} />
    </instancedMesh>
  );
}

function useLabelTexture(text, color, bg) {
  return useMemo(() => {
    const c = document.createElement('canvas'), ctx = c.getContext('2d');
    const font = '600 48px system-ui, "Segoe UI", sans-serif';
    ctx.font = font;
    const w = Math.ceil(ctx.measureText(text).width) + 30;
    c.width = w; c.height = 76;
    ctx.font = font;
    if (bg) { ctx.fillStyle = bg; ctx.beginPath(); ctx.roundRect(0, 0, w, 76, 16); ctx.fill(); }
    ctx.fillStyle = color; ctx.textBaseline = 'middle'; ctx.fillText(text, 15, 40);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    t.userData = { ratio: w / 76 };
    return t;
  }, [text, color, bg]);
}
// etiqueta que siempre mira a la cámara
export function Tag({ text, position, size = 12, color = '#f1f5f9', bg = 'rgba(15,18,25,.7)' }) {
  const tex = useLabelTexture(text, color, bg);
  return (
    <sprite position={position} scale={[size * tex.userData.ratio, size, 1]} renderOrder={10}>
      <spriteMaterial map={tex} depthTest={false} transparent />
    </sprite>
  );
}
// rótulo pintado en el piso
export function FloorText({ text, x, z, y = 0.7, size = 10, rot = 0, color = '#64748b' }) {
  const tex = useLabelTexture(text, color, null);
  return (
    <mesh position={[x, y, z]} rotation={[-Math.PI / 2, 0, -(rot * Math.PI) / 180]} renderOrder={2}>
      <planeGeometry args={[size * tex.userData.ratio, size]} />
      <meshBasicMaterial map={tex} transparent depthWrite={false} />
    </mesh>
  );
}

