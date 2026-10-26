// Agrupa items en cajas (1 por tipo+código+ubicación) y calcula su posición 3D.
import { levelLetter } from './layout.js';

export const MEZZ_SLAB = 6;
const COL_PITCH = 19; // px de plano por columna cuando cols = auto

const clean = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();

const RACK_RE = /^0*(\d+)\s*-\s*([A-Za-z])\s*-\s*0*(\d+)$/;
export function parseLoc(raw) {
  const s = clean(raw);
  if (!s) return null;
  const m = RACK_RE.exec(s);
  if (m) return { kind: 'rack', rack: +m[1], level: m[2].charCodeAt(0) - 65, col: +m[3], text: `${+m[1]}-${m[2]}-${+m[3]}` };
  return { kind: 'zone', text: s };
}

export function groupBoxes(datasets) {
  const map = new Map();
  for (const ds of Object.values(datasets)) {
    for (const it of ds.items) {
      const p = parseLoc(it.loc);
      const key = `${it.t}|${it.code}|${p ? p.text : ''}`;
      let b = map.get(key);
      if (!b) {
        b = { key, t: it.t, code: it.code, desc: it.desc, loc: p ? p.text : '', p, lines: [], search: '' };
        map.set(key, b);
      }
      b.lines.push(it);
    }
  }
  const boxes = [...map.values()];
  for (const b of boxes) {
    b.search = clean(`${b.code} ${b.desc} ${b.loc} ${b.lines.map((l) => l.lote).join(' ')}`).toLowerCase();
    let ex = null;
    for (const l of b.lines) {
      const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(l.extra?.Vencimiento || '');
      if (m) { const d = new Date(+m[3], +m[2] - 1, +m[1]); if (!ex || d < ex) ex = d; }
    }
    b.expiry = ex;
    const sums = new Map();
    for (const l of b.lines) sums.set(l.um, (sums.get(l.um) || 0) + l.qty);
    b.qtyText = [...sums].map(([um, q]) => `${fmtQty(q)} ${um}`).join(' · ');
  }
  return boxes;
}
export const fmtQty = (q) => q.toLocaleString('es-PE', { maximumFractionDigits: 3 });

const lerp = (a, b, t) => a + (b - a) * t;

export function rackInfo(layout, r, need) {
  const segs = r.segments.map(([x1, z1, x2, z2]) => ({ x1, z1, x2, z2, len: Math.hypot(x2 - x1, z2 - z1), th: Math.atan2(z2 - z1, x2 - x1) }));
  const total = segs.reduce((a, s) => a + s.len, 0) || 1;
  const n = need?.get(r.id);
  const cols = Math.max(r.cols || Math.round(total / COL_PITCH) || 1, n?.col || 0);
  const levels = Math.max(r.levels, (n?.lv ?? -1) + 1);
  let cum = 0, prev = 0;
  segs.forEach((s, i) => {
    cum += s.len;
    const b = i === segs.length - 1 ? cols : Math.round((cols * cum) / total);
    s.c0 = prev + 1; s.c1 = b; prev = b;
  });
  const std = r.floor ? layout.mezzLevelHeight : layout.levelHeight;
  const base = r.lhs?.length ? r.lhs : [r.lh || std];
  const hs = Array.from({ length: levels }, (_, i) => base[Math.min(i, base.length - 1)]);
  const ys = []; let acc = 0;
  for (const h of hs) { ys.push(acc); acc += h; }
  const baseY = r.floor === 2 ? 6 * layout.mezzLevelHeight + MEZZ_SLAB : 0;
  return { r, segs, cols, levels, hs, ys, height: acc, lh: hs[0], baseY, depth: r.depth, total };
}

export function cellGeom(info, level, col) {
  const s = info.segs.find((q) => col >= q.c0 && col <= q.c1) || info.segs[info.segs.length - 1];
  const n = Math.max(1, s.c1 - s.c0 + 1);
  const t = (Math.min(col, s.c1) - s.c0 + 0.5) / n;
  return {
    cx: lerp(s.x1, s.x2, t), cz: lerp(s.z1, s.z2, t), th: s.th, cw: s.len / n, d: info.depth,
    y: info.baseY + (info.ys[level] ?? level * info.lh), h: info.hs[level] ?? info.lh,
  };
}

function pack(count, w, d, maxH) {
  let layers = 1, nx, ny, s;
  for (;;) {
    const per = Math.ceil(count / layers);
    nx = Math.max(1, Math.ceil(Math.sqrt((per * w) / d)));
    ny = Math.ceil(per / nx);
    s = Math.min(w / nx, d / ny) * 0.84;
    if (s >= 2.4 || layers >= 5 || maxH / (layers + 1) < 2) break;
    layers++;
  }
  const lh = Math.min(maxH / layers, s);
  return { nx, ny, s, layers, bh: lh };
}

// world: { racks, cells, zones, placed, stats }
export function buildWorld(layout, allBoxes, visible, floorFilter) {
  const need = new Map();
  for (const b of allBoxes) {
    if (b.p?.kind !== 'rack') continue;
    const n = need.get(b.p.rack) || { lv: -1, col: 0 };
    n.lv = Math.max(n.lv, b.p.level); n.col = Math.max(n.col, b.p.col);
    need.set(b.p.rack, n);
  }
  const racks = new Map();
  for (const r of layout.racks) racks.set(r.id, rackInfo(layout, r, need));
  const zoneBy = new Map();
  layout.zones.forEach((z, i) => { for (const m of [z.name, ...(z.match || [])]) zoneBy.set(clean(m), i); });

  const cells = new Map(), zoneCells = new Map();
  const unknown = new Map();
  let noLoc = 0;
  for (const b of allBoxes) {
    b.placed = false;
    if (!b.p) { noLoc++; continue; }
    if (b.p.kind === 'rack') {
      const info = racks.get(b.p.rack);
      if (!info) { unknown.set(b.loc, (unknown.get(b.loc) || 0) + 1); continue; }
      if (!visible(b) || (floorFilter && info.r.floor && info.r.floor !== floorFilter)) { b.placed = true; continue; }
      const k = `${b.p.rack}|${b.p.level}|${b.p.col}`;
      (cells.get(k) || cells.set(k, []).get(k)).push(b);
    } else {
      const zi = zoneBy.get(b.p.text);
      if (zi === undefined) { unknown.set(b.loc, (unknown.get(b.loc) || 0) + 1); continue; }
      if (!visible(b)) { b.placed = true; continue; }
      (zoneCells.get(zi) || zoneCells.set(zi, []).get(zi)).push(b);
    }
  }

  const placed = []; // {b,x,y,z,sx,sy,sz,th}
  const cellInfo = new Map();
  for (const [k, list] of cells) {
    const [rk, lv, col] = k.split('|').map(Number);
    const info = racks.get(rk);
    const g = cellGeom(info, lv, col);
    const w = g.cw - 1.6, d = g.d - 2.4;
    const { nx, ny, s, layers, bh } = pack(list.length, w, d, g.h - 3.5);
    const per = nx * ny;
    const cos = Math.cos(g.th), sin = Math.sin(g.th);
    list.forEach((b, i) => {
      const layer = Math.floor(i / per), j = i % per;
      const u = -w / 2 + ((j % nx) + 0.5) * (w / nx), v = -d / 2 + (Math.floor(j / nx) + 0.5) * (d / ny);
      placed.push({ b, x: g.cx + u * cos - v * sin, y: g.y + 1.5 + layer * bh, z: g.cz + u * sin + v * cos, sx: s, sy: bh * 0.94, sz: s, th: g.th });
      b.placed = true;
    });
    cellInfo.set(k, { list, g, rack: rk, level: lv, col, label: `${rk}-${levelLetter(lv)}-${col}` });
  }
  const zoneInfo = new Map();
  for (const [zi, list] of zoneCells) {
    const z = layout.zones[zi];
    const a = (z.rot * Math.PI) / 180, cos = Math.cos(a), sin = Math.sin(a);
    let pitch = Math.min(8.5, Math.sqrt((z.w * z.d) / list.length));
    let nx, ny;
    for (;;) { nx = Math.max(1, Math.floor(z.w / pitch)); ny = Math.ceil(list.length / nx); if (ny * pitch <= z.d || pitch < 1.2) break; pitch *= 0.93; }
    const s = pitch * 0.82;
    list.forEach((b, i) => {
      const u = -z.w / 2 + ((i % nx) + 0.5) * pitch, v = -z.d / 2 + (Math.floor(i / nx) + 0.5) * pitch;
      placed.push({ b, x: z.x + u * cos - v * sin, y: 0.4, z: z.z + u * sin + v * cos, sx: s, sy: s * 0.8, sz: s, th: a });
      b.placed = true;
    });
    zoneInfo.set(zi, { list, label: z.name });
  }
  const occ = new Map();
  for (const info of racks.values()) occ.set(info.r.id, { used: 0, total: info.levels * info.cols });
  for (const k of cellInfo.keys()) occ.get(+k.split('|')[0]).used++;
  return { racks, cells: cellInfo, zones: zoneInfo, placed, occ, stats: { noLoc, unknown, total: allBoxes.length } };
}
