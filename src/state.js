import { create } from 'zustand';
import { loadLayout, saveLayout, resetLayout } from './layout.js';
import { parseFile } from './importer.js';
import { loadAll, saveDataset, clearDataset } from './db.js';
import { groupBoxes, buildWorld, cellGeom } from './model.js';

export const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export const useApp = create((set, get) => ({
  datasets: {}, layout: loadLayout(), boxes: [], byCode: new Map(), world: null,
  types: { BSU: true, MAT: true, ACT: true }, floor: 0, query: '', matches: null,
  sel: null, edit: false, editSel: null, hover: null, cam: null, toast: null, modal: null,
  wallMode: 'low', showUpper: true, showPlan: false, showForklift: true, follow: false,
  panelOpen: true, showPeople: true, showGrid: true, heat: false, colorMode: 'type', measure: { on: false, pts: [] },

  init: async () => { set({ datasets: await loadAll() }); get().rebuild(); },

  rebuild: () => {
    const boxes = groupBoxes(get().datasets);
    const byCode = new Map();
    for (const b of boxes) (byCode.get(b.code) || byCode.set(b.code, []).get(b.code)).push(b);
    set({ boxes, byCode, sel: null });
    get().compute();
  },

  compute: () => {
    const { boxes, types, query, layout, floor } = get();
    const toks = norm(query).split(/\s+/).filter(Boolean);
    const matches = toks.length && query.trim().length >= 2 ? boxes.filter((b) => types[b.t] && toks.every((t) => b.search.includes(t))) : null;
    set({ matches, world: buildWorld(layout, boxes, (b) => types[b.t], floor) });
  },

  notify: (msg, err = false) => {
    set({ toast: { msg, err } });
    clearTimeout(get()._tt); set({ _tt: setTimeout(() => set({ toast: null }), err ? 7000 : 3500) });
  },

  importFiles: async (files) => {
    for (const f of files) {
      try {
        get().notify(`Leyendo ${f.name}…`);
        await new Promise((r) => setTimeout(r, 30));
        const { type, items, fileName } = await parseFile(f);
        const ds = { items, fileName, at: Date.now() };
        set({ datasets: { ...get().datasets, [type]: ds } });
        await saveDataset(type, ds);
        get().notify(`${type}: ${items.length.toLocaleString('es-PE')} filas importadas`);
      } catch (e) { console.error(e); get().notify(e.message, true); }
    }
    get().rebuild();
  },
  removeDataset: async (t) => {
    const d = { ...get().datasets }; delete d[t]; set({ datasets: d }); await clearDataset(t); get().rebuild();
  },

  setQuery: (q) => { set({ query: q }); get().compute(); },
  toggleType: (t) => { set({ types: { ...get().types, [t]: !get().types[t] } }); get().compute(); },
  setFloor: (f) => { set({ floor: f }); get().compute(); },
  set: (p) => set(p),

  select: (sel, fly = false) => {
    set({ sel });
    if (fly && sel?.box) {
      const b = sel.box, w = get().world;
      const p = w.placed.find((x) => x.b === b);
      if (p) get().flyTo(p.x, p.y, p.z, 120);
      else if (b.p?.kind === 'zone') {
        const zi = get().layout.zones.findIndex((z) => [z.name, ...(z.match || [])].some((m) => norm(m) === norm(b.p.text)));
        if (zi >= 0) { const z = get().layout.zones[zi]; get().flyTo(z.x, 0, z.z, Math.max(160, z.w)); }
      }
    }
  },
  flyTo: (x, y, z, dist = 140, top = false) => set({ cam: { x, y, z, dist, top, id: Math.random() } }),
  addMeasure: (p) => { const m = get().measure; set({ measure: { on: true, pts: m.pts.length >= 2 ? [{ x: p.x, z: p.z }] : [...m.pts, { x: p.x, z: p.z }] } }); },
  flyToCell: (rack, level, col) => {
    const info = get().world.racks.get(rack); if (!info || level >= info.levels) return false;
    const g = cellGeom(info, level, col);
    set({ sel: { cell: { rack, level, col } } }); get().flyTo(g.cx, g.y, g.cz, 90); return true;
  },

  // ---- layout
  commitLayout: (layout, persist = true) => { set({ layout }); if (persist) saveLayout(layout); get().compute(); },
  moveItem: (hit, dx, dz) => {
    const L = structuredClone(get().layout);
    if (hit.rack != null) {
      const r = L.racks.find((x) => x.id === hit.rack);
      r.segments = r.segments.map(([a, b, c, d]) => [a + dx, b + dz, c + dx, d + dz]);
    } else if (hit.zone != null) { L.zones[hit.zone].x += dx; L.zones[hit.zone].z += dz; }
    get().commitLayout(L, false);
  },
  persistLayout: () => saveLayout(get().layout),
  resetLayout: () => { get().commitLayout(resetLayout(), false); set({ editSel: null }); },
}));
