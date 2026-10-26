import { DEFAULT_LAYOUT as L } from '../src/layout.js';
const out = [];
for (const r of L.racks) for (const [x1, z1, x2, z2] of r.segments) {
  const th = Math.atan2(z2 - z1, x2 - x1), len = Math.hypot(x2 - x1, z2 - z1), cx = (x1 + x2) / 2, cz = (z1 + z2) / 2;
  out.push({ cx, cz, th, w: len, d: r.depth, kind: 'rack' });
}
for (const z of L.zones) out.push({ cx: z.x, cz: z.z, th: z.rot * Math.PI / 180, w: z.w, d: z.d, kind: 'zone', name: z.name });
console.log(JSON.stringify(out));
