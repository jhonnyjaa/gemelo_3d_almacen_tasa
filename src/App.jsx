import { useEffect, useState } from 'react';
import Scene from './Scene.jsx';
import { useApp } from './state.js';
import { TYPES } from './importer.js';
import { fmtQty, parseLoc } from './model.js';
import * as XLSX from 'xlsx';
import { levelLetter } from './layout.js';

const num = (n) => n.toLocaleString('es-PE');
const Badge = ({ t }) => <span className="badge" style={{ background: TYPES[t].color }}>{t}</span>;

// ------------------------------------------------------------ panel izquierdo
function Sidebar() {
  const s = useApp();
  const counts = {};
  for (const b of s.boxes) counts[b.t] = (counts[b.t] || 0) + 1;
  const list = s.matches?.slice(0, 40);
  const loc = parseLoc(s.query);
  const rinfo = loc?.kind === 'rack' && s.world?.racks.get(loc.rack);
  const goto = rinfo && loc.level < rinfo.levels;
  if (!s.panelOpen) {
    return <button className="panel" style={{ top: 12, left: 12, padding: '8px 14px', cursor: 'pointer' }} onClick={() => s.set({ panelOpen: true })} title="Mostrar panel de configuración">☰ Panel</button>;
  }
  return (
    <div id="top" className="panel">
      <div className="row" style={{ flexWrap: 'nowrap' }}>
        <h1 className="grow">Gemelo digital · Almacén <small>TASA</small></h1>
        <button onClick={() => s.set({ panelOpen: false })} title="Minimizar panel" style={{ padding: '2px 9px' }}>—</button>
      </div>
      <div className="row">
        <label className="btn grow" style={{ textAlign: 'center' }}>Importar Excel (SAP)
          <input type="file" accept=".xlsx,.xls,.xlsm,.csv" multiple hidden onChange={(e) => { s.importFiles([...e.target.files]); e.target.value = ''; }} />
        </label>
      </div>
      <div className="mut" style={{ fontSize: 11 }}>Sube ZMMR0080, MB52 y/o ZFIR0241 (o arrástralos a la ventana). Cada archivo reemplaza los datos de su tipo. El almacén se dibuja con o sin datos.</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {Object.entries(TYPES).map(([k, t]) => {
          const ds = s.datasets[k];
          return (
            <div className="ds" key={k}>
              <span><span className="dot" style={{ background: t.color }} /> <b>{t.label}</b> <span className="mut">{t.tx}</span></span>
              <span className="mut">{ds ? <>{num(ds.items.length)} filas <a style={{ cursor: 'pointer', color: '#f87171' }} title={ds.fileName} onClick={() => s.removeDataset(k)}>✕</a></> : 'sin cargar'}</span>
            </div>
          );
        })}
      </div>
      <div>
        <input placeholder="Buscar código, descripción o lote…" value={s.query} onChange={(e) => s.setQuery(e.target.value)} autoComplete="off" />
        {(list || goto) && (
          <div id="results" style={{ display: 'block' }}>
            {goto && <div className="res" onClick={() => s.flyToCell(loc.rack, loc.level, loc.col)}>📍 <b>Ir a la celda {loc.text}</b> <span className="mut">· rack {loc.rack}, nivel {String.fromCharCode(65 + loc.level)}, columna {loc.col}</span></div>}
            {list && !list.length && <div className="res mut">Sin resultados</div>}
            {(list || []).map((b) => (
              <div className="res" key={b.key} onClick={() => s.select({ box: b }, true)}>
                <Badge t={b.t} /><b>{b.code}</b> {b.desc}
                <div className="mut">{b.loc || 'sin ubicación'} · {b.qtyText}</div>
              </div>
            ))}
            {s.matches && s.matches.length > 40 && <div className="res mut">…y {s.matches.length - 40} más (afina la búsqueda)</div>}
          </div>
        )}
      </div>
      <div className="row">
        {Object.entries(TYPES).map(([k, t]) => (
          <div key={k} className={'chip' + (s.types[k] ? '' : ' off')} onClick={() => s.toggleType(k)}>
            <span className="dot" style={{ background: t.color }} />{t.label} <span className="mut">{num(counts[k] || 0)}</span>
          </div>
        ))}
      </div>
      <div className="row"><span className="mut">Mezanine:</span>
        <select className="grow" value={s.floor} onChange={(e) => s.setFloor(+e.target.value)}>
          <option value={0}>Ambos pisos</option><option value={1}>Solo piso bajo (30–47)</option><option value={2}>Solo piso alto (48–65)</option>
        </select>
      </div>
      <div className="row"><span className="mut">Muros:</span>
        <div className="seg grow">
          {[['off', 'Ocultos'], ['low', 'Bajos'], ['high', 'Altos']].map(([k, l]) => (
            <button key={k} className={s.wallMode === k ? 'on' : ''} onClick={() => s.set({ wallMode: k })}>{l}</button>
          ))}
        </div>
      </div>
      <div className="row"><span className="mut">Colorear:</span>
        <select className="grow" value={s.colorMode} onChange={(e) => s.set({ colorMode: e.target.value })}>
          <option value="type">Por tipo (BSU / material / activo)</option><option value="expiry">Por vencimiento (MB52)</option>
        </select>
      </div>
      <div className="row">
        <label className="chip"><input type="checkbox" style={{ width: 'auto' }} checked={s.showGrid} onChange={(e) => s.set({ showGrid: e.target.checked })} /> Cuadrícula 1 m</label>
        <label className="chip"><input type="checkbox" style={{ width: 'auto' }} checked={s.heat} onChange={(e) => s.set({ heat: e.target.checked })} /> Ocupación racks</label>
      </div>
      <div className="row">
        <button className={s.measure.on ? 'on' : ''} onClick={() => s.set({ measure: { on: !s.measure.on, pts: [] } })}>📏 Medir</button>
        <button onClick={() => s.set({ follow: false }) || s.flyTo(784, 0, 520, 1500, true)}>Vista planta</button>
        {s.measure.on && <span className="mut">{s.measure.pts.length < 2 ? 'clic en 2 puntos del piso' : (Math.hypot(s.measure.pts[1].x - s.measure.pts[0].x, s.measure.pts[1].z - s.measure.pts[0].z) / 10).toFixed(2) + ' m'}</span>}
      </div>
      <div className="row">
        <label className="chip"><input type="checkbox" style={{ width: 'auto' }} checked={s.showUpper} onChange={(e) => s.set({ showUpper: e.target.checked })} /> 2º piso</label>
        <label className="chip"><input type="checkbox" style={{ width: 'auto' }} checked={s.showPlan} onChange={(e) => s.set({ showPlan: e.target.checked })} /> Plano PDF encima</label>
        <label className="chip"><input type="checkbox" style={{ width: 'auto' }} checked={s.showForklift} onChange={(e) => s.set({ showForklift: e.target.checked, follow: e.target.checked && s.follow })} /> Montacargas</label>
        <label className="chip"><input type="checkbox" style={{ width: 'auto' }} checked={s.showPeople} onChange={(e) => s.set({ showPeople: e.target.checked })} /> Personas</label>
        {s.showForklift && <label className="chip"><input type="checkbox" style={{ width: 'auto' }} checked={s.follow} onChange={(e) => s.set({ follow: e.target.checked })} /> Seguir</label>}
        <button onClick={() => s.set({ follow: false }) || s.flyTo(784, 0, 450, 1250)} title="Vista general">⌂</button>
      </div>
      <button className={'grow' + (s.edit ? ' on' : '')} onClick={() => s.set({ edit: !s.edit, editSel: null, sel: null })}>✎ Editar layout</button>
    </div>
  );
}

// ------------------------------------------------------------ detalle
function Detail() {
  const { sel, world, boxes, byCode, layout, select, types } = useApp();
  if (!sel) return null;
  const Li = ({ b }) => <div className="li" onClick={() => select({ box: b }, true)}><Badge t={b.t} /><b>{b.code}</b> <span className="mut">{b.desc}</span></div>;
  let body;
  if (sel.zone != null) {
    const z = layout.zones[sel.zone], info = world.zones.get(sel.zone);
    body = <>
      <div className="row"><h2 className="grow">{z.name}</h2><button onClick={() => select(null)}>✕</button></div>
      <div className="mut">Zona · {info ? info.list.length : 0} cajas</div>
      <div className="sec">Contenido</div>
      {(info?.list || []).map((b) => <Li key={b.key} b={b} />)}
      {!info && <div className="mut">Vacía</div>}
    </>;
  } else if (sel.cell) {
    const { rack, level, col } = sel.cell, key = rack + '|' + level + '|' + col, c = world.cells.get(key);
    const info = world.racks.get(rack);
    body = <>
      <div className="row"><h2 className="grow">Celda {rack}-{String.fromCharCode(65 + level)}-{col}</h2><button onClick={() => select(null)}>✕</button></div>
      <div className="mut">Alto del nivel: {(info.hs[level] / 10).toFixed(2)} m · {c ? c.list.length + ' artículos' : 'vacía'}</div>
      {c && <><div className="sec">Contenido</div>{c.list.map((b) => <Li key={b.key} b={b} />)}</>}
    </>;
  } else {
    const b = sel.box, t = TYPES[b.t];
    const others = (byCode.get(b.code) || []).filter((x) => x !== b);
    let mates = [];
    if (b.p?.kind === 'rack') mates = world.cells.get(`${b.p.rack}|${b.p.level}|${b.p.col}`)?.list || [];
    else if (b.p) mates = boxes.filter((x) => x.loc === b.loc && types[x.t]);
    const extraKeys = [...new Set(b.lines.flatMap((l) => Object.entries(l.extra).filter(([, v]) => v !== '' && v != null).map(([k]) => k)))];
    const placed = world.placed.some((p) => p.b === b);
    const fly = () => { const p = world.placed.find((x) => x.b === b); if (p) useApp.getState().flyTo(p.x, p.y, p.z, 120); };
    body = <>
      <div className="row"><div className="grow"><Badge t={b.t} /><span className="mut">{t.label} · {t.tx}</span></div><button onClick={() => select(null)}>✕</button></div>
      <h2>{b.code}</h2><div>{b.desc}</div>
      <div className="row" style={{ marginTop: 8 }}><span>Ubicación: <b>{b.loc || 'sin ubicación en SAP'}</b></span>{placed && <button onClick={fly}>Ver en 3D</button>}</div>
      <div style={{ marginTop: 4 }}>Cantidad total: <b>{b.qtyText}</b></div>
      <table><tbody>
        <tr><th>{b.t === 'ACT' ? 'Sub' : 'Lote'}</th><th className="n">Cant.</th><th>UM</th></tr>
        {b.lines.map((l, i) => <tr key={i}><td>{(b.t === 'ACT' ? l.sub : l.lote) || '—'}</td><td className="n">{fmtQty(l.qty)}</td><td>{l.um}</td></tr>)}
      </tbody></table>
      {extraKeys.length > 0 && <table><tbody>{extraKeys.map((k) => (
        <tr key={k}><th>{k}</th><td>{[...new Set(b.lines.map((l) => l.extra[k]).filter((v) => v !== '' && v != null))].join(' · ')}</td></tr>
      ))}</tbody></table>}
      {others.length > 0 && <><div className="sec">Mismo código en otras ubicaciones ({others.length})</div>
        {others.map((o) => <div className="li" key={o.key} onClick={() => select({ box: o }, true)}>{o.loc || 'sin ubicación'} <span className="mut">· {o.qtyText}</span></div>)}</>}
      {mates.length > 1 && <><div className="sec">Misma ubicación: {b.loc} ({mates.length})</div>
        {mates.filter((x) => x !== b).map((x) => <Li key={x.key} b={x} />)}</>}
    </>;
  }
  return <div id="detail" className="panel" style={{ display: 'block' }}>{body}</div>;
}

// ------------------------------------------------------------ editor de layout
function Editor() {
  const { edit, editSel, layout, world, commitLayout, resetLayout, set, notify } = useApp();
  if (!edit) return null;
  const upd = (fn) => { const L = structuredClone(layout); fn(L); commitLayout(L); };
  let form = <div className="mut">Clic en un rack o zona para seleccionarlo; arrástralo para moverlo.</div>;
  if (editSel?.rack != null) {
    const r = layout.racks.find((x) => x.id === editSel.rack), info = world.racks.get(r.id);
    const setR = (k, v) => upd((L) => { const x = L.racks.find((q) => q.id === r.id); if (v === undefined) delete x[k]; else x[k] = v; });
    form = <>
      <b>Rack {r.id}</b> <span className="mut">{info.levels} niveles (A–{levelLetter(info.levels - 1)}) · {info.cols} columnas</span>
      <div className="mut">Largo {(info.total / 10).toFixed(1)} m · fondo {(r.depth / 10).toFixed(1)} m · alto {(info.height / 10).toFixed(1)} m · col. {(info.total / info.cols / 10).toFixed(2)} m · ocupación {world.occ.get(r.id).used}/{world.occ.get(r.id).total}</div>
      <label>Niveles</label><input type="number" min="1" max="26" defaultValue={r.levels} key={'l' + r.id + r.levels} onBlur={(e) => setR('levels', Math.max(1, +e.target.value))} />
      <label>Columnas (vacío = automático según largo)</label><input type="number" min="1" defaultValue={r.cols || ''} placeholder={info.cols} key={'c' + r.id + r.cols} onBlur={(e) => setR('cols', e.target.value ? Math.max(1, Math.round(+e.target.value)) : undefined)} />
      <label>Alturas por nivel en metros, de A hacia arriba (ej: 1.2, 1.4, 1.7, 2, 2.2)</label>
      <input key={'h' + r.id + JSON.stringify(r.lhs) + r.lh} defaultValue={info.hs.map((h) => +(h / 10).toFixed(2)).join(', ')}
        onBlur={(e) => { const a = e.target.value.split(',').map((x) => parseFloat(x.trim()) * 10).filter((x) => x > 2); setR('lhs', a.length ? a : undefined); }} />
      <label>Profundidad</label><input type="number" min="2" defaultValue={r.depth} key={'d' + r.id + r.depth} onBlur={(e) => setR('depth', Math.max(2, +e.target.value))} />
      <label>Segmentos [x1,z1,x2,z2] (JSON)</label>
      <textarea rows={3} key={'s' + JSON.stringify(r.segments)} defaultValue={JSON.stringify(r.segments.map((s) => s.map((n) => Math.round(n * 10) / 10)))}
        onBlur={(e) => { try { const s = JSON.parse(e.target.value); if (!s.every((a) => a.length === 4 && a.every(Number.isFinite))) throw new Error('Formato inválido'); setR('segments', s); } catch (er) { notify(er.message, true); } }} />
      <div className="row" style={{ marginTop: 8 }}><button className="danger" onClick={() => { upd((L) => { L.racks = L.racks.filter((q) => q.id !== r.id); }); set({ editSel: null }); }}>Eliminar rack</button></div>
      <div className="mut" style={{ marginTop: 6 }}>Las columnas se numeran 1..N siguiendo el orden de los segmentos. Para invertir el sentido, invierte los extremos.</div>
    </>;
  } else if (editSel?.zone != null) {
    const z = layout.zones[editSel.zone], i = editSel.zone;
    const setZ = (k, v) => upd((L) => { L.zones[i][k] = v; });
    form = <>
      <b>Zona</b>
      <label>Nombre</label><input defaultValue={z.name} key={'n' + i + z.name} onBlur={(e) => setZ('name', e.target.value)} />
      <label>Ubicaciones SAP que caen aquí (separadas por coma)</label><input defaultValue={(z.match || []).join(', ')} key={'m' + i + z.match} onBlur={(e) => setZ('match', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))} />
      <div className="row">
        {[['w', 'Ancho'], ['d', 'Fondo'], ['rot', 'Giro°']].map(([k, l]) => (
          <div className="grow" key={k}><label>{l}</label><input type="number" defaultValue={Math.round(z[k])} key={k + i + z[k]} onBlur={(e) => setZ(k, +e.target.value)} /></div>
        ))}
      </div>
      <div className="mut">= {(z.w / 10).toFixed(1)} × {(z.d / 10).toFixed(1)} m ({((z.w * z.d) / 100).toFixed(0)} m²)</div>
      <label>Color</label><input type="color" value={z.color} onChange={(e) => setZ('color', e.target.value)} />
      <div className="row" style={{ marginTop: 8 }}><button className="danger" onClick={() => { upd((L) => { L.zones.splice(i, 1); }); set({ editSel: null }); }}>Eliminar zona</button></div>
    </>;
  }
  const act = {
    addzone: () => {
      const name = prompt('Nombre de la zona (también será una ubicación SAP reconocida):'); if (!name) return;
      upd((L) => { L.zones.push({ name: name.toUpperCase(), match: [name.toUpperCase()], x: 784, z: 392, w: 80, d: 50, rot: 0, color: '#c084fc' }); });
      set({ editSel: { zone: layout.zones.length } });
    },
    addrack: () => {
      const id = +prompt('Número del rack nuevo:');
      if (!id || layout.racks.some((r) => r.id === id)) { notify('Número inválido o repetido', true); return; }
      upd((L) => { L.racks.push({ id, levels: 5, depth: 16, segments: [[724, 392, 844, 392]] }); });
      set({ editSel: { rack: id } });
    },
    reset: () => { if (confirm('¿Restaurar el layout original? Se pierden tus cambios de racks y zonas.')) resetLayout(); },
    json: () => set({ modal: 'json' }),
  };
  return (
    <div id="editor" className="panel" style={{ display: 'block' }}>
      {form}
      <hr style={{ border: 0, borderTop: '1px solid var(--line)', margin: '10px 0' }} />
      <div className="row"><button onClick={act.addzone}>+ Zona</button><button onClick={act.addrack}>+ Rack</button><button onClick={act.json}>JSON…</button><button className="danger" onClick={act.reset}>Restaurar</button></div>
    </div>
  );
}

// ------------------------------------------------------------ modales, estado, tooltip
function exportMissing() {
  const { boxes } = useApp.getState();
  const rows = [];
  for (const b of boxes) {
    if (b.p && b.placed) continue;
    for (const l of b.lines) rows.push({ Tipo: b.t, Código: b.code, Subnúmero: l.sub || '', Descripción: b.desc, Lote: l.lote, Cantidad: l.qty, UM: l.um, 'Ubicación (SAP)': b.loc || '', Motivo: b.p ? 'Ubicación no reconocida' : 'Sin ubicación' });
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Pendientes');
  XLSX.writeFile(wb, 'articulos_sin_ubicar.xlsx');
}

function Modal() {
  const { modal, set, world, layout, commitLayout, notify } = useApp();
  const [txt, setTxt] = useState('');
  useEffect(() => { if (modal === 'json') setTxt(JSON.stringify(layout, null, 1)); }, [modal]); // eslint-disable-line
  if (!modal) return null;
  const close = () => set({ modal: null });
  let body;
  if (modal === 'unknown') {
    const rows = [...world.stats.unknown].sort((a, b) => b[1] - a[1]);
    body = <>
      <div className="row"><h2 className="grow" style={{ margin: 0 }}>Ubicaciones no reconocidas</h2><button onClick={close}>Cerrar</button></div>
      <p className="mut">No coinciden con un rack del layout ni con una zona. Corrige el dato en el Excel, crea la zona (Editar layout → + Zona) o agrega el texto a "Ubicaciones SAP" de una zona.</p>
      <div className="row"><button onClick={exportMissing}>⬇ Descargar Excel (sin ubicación + no reconocidas)</button></div>
      <table><tbody><tr><th>Ubicación (SAP)</th><th className="n">Cajas</th></tr>{rows.map(([l, n]) => <tr key={l}><td>{l}</td><td className="n">{n}</td></tr>)}</tbody></table>
    </>;
  } else {
    body = <>
      <div className="row"><h2 className="grow" style={{ margin: 0 }}>Layout (JSON)</h2><button onClick={close}>Cerrar</button></div>
      <p className="mut">Fuente de verdad del layout: cópialo, versiónalo o pega uno nuevo.</p>
      <textarea rows={18} style={{ fontFamily: 'monospace', fontSize: 11 }} value={txt} onChange={(e) => setTxt(e.target.value)} />
      <div className="row" style={{ marginTop: 8 }}>
        <button onClick={() => { try { const n = JSON.parse(txt); if (!Array.isArray(n.racks) || !Array.isArray(n.zones)) throw new Error('Debe tener racks[] y zones[]'); commitLayout(n); set({ editSel: null, modal: null }); } catch (e) { notify(e.message, true); } }}>Aplicar</button>
        <button onClick={() => { const u = URL.createObjectURL(new Blob([txt], { type: 'application/json' })); Object.assign(document.createElement('a'), { href: u, download: 'layout_almacen.json' }).click(); URL.revokeObjectURL(u); }}>Descargar .json</button>
      </div>
    </>;
  }
  return <div id="modal" style={{ display: 'flex' }} onClick={(e) => e.target.id === 'modal' && close()}><div className="box">{body}</div></div>;
}

function Status() {
  const world = useApp((s) => s.world), set = useApp((s) => s.set);
  if (!world) return null;
  const st = world.stats, unk = [...st.unknown.values()].reduce((a, b) => a + b, 0);
  return (
    <div id="status" className="panel">
      <span>Cajas en 3D: <b>{num(world.placed.length)}</b></span>
      <span className="mut">Sin ubicación: {num(st.noLoc)}</span>
      {unk > 0 && <span>Ubicación no reconocida: <a onClick={() => set({ modal: 'unknown' })}>{num(unk)} (ver)</a></span>}
      {(unk > 0 || st.noLoc > 0) && <a onClick={exportMissing}>⬇ Excel de pendientes</a>}
      <span className="mut">Clic: detalle · Arrastrar: rotar · Rueda: zoom · Clic der.: mover</span>
    </div>
  );
}

function Legend() {
  const mode = useApp((s) => s.colorMode), heat = useApp((s) => s.heat);
  if (mode !== 'expiry' && !heat) return null;
  const Item = ({ c, t }) => <span className="row" style={{ gap: 5 }}><span className="dot" style={{ background: c }} />{t}</span>;
  return (
    <div className="panel" style={{ left: '50%', bottom: 12, transform: 'translateX(-50%)', padding: '7px 12px', display: 'flex', gap: 16 }}>
      {mode === 'expiry' && <><Item c="#ef4444" t="Vencido" /><Item c="#f59e0b" t="≤ 90 días" /><Item c="#22c55e" t="> 90 días" /><Item c="#94a3b8" t="Sin fecha" /></>}
      {heat && <span className="row" style={{ gap: 6 }}>Ocupación de racks: <span style={{ width: 90, height: 10, borderRadius: 4, background: 'linear-gradient(90deg,hsl(119,75%,50%),hsl(60,75%,50%),hsl(0,75%,50%))' }} /> 0 % → 100 %</span>}
    </div>
  );
}

function Tip() {
  const h = useApp((s) => s.hover);
  if (!h) return null;
  return <div id="tip" style={{ left: h.x + 14, top: h.y + 14 }}><Badge t={h.b.t} /><b>{h.b.code}</b> {h.b.desc}<div className="mut">{h.b.loc} · {h.b.qtyText}</div></div>;
}

export default function App() {
  const init = useApp((s) => s.init), toast = useApp((s) => s.toast), importFiles = useApp((s) => s.importFiles);
  const [drag, setDrag] = useState(false);
  useEffect(() => { init(); }, [init]);
  useEffect(() => {
    let n = 0;
    const on = (t, f) => addEventListener(t, f);
    const en = (e) => { e.preventDefault(); n++; setDrag(true); };
    const lv = () => { if (--n <= 0) { n = 0; setDrag(false); } };
    const ov = (e) => e.preventDefault();
    const dr = (e) => { e.preventDefault(); n = 0; setDrag(false); importFiles([...e.dataTransfer.files]); };
    on('dragenter', en); on('dragleave', lv); on('dragover', ov); on('drop', dr);
    return () => { removeEventListener('dragenter', en); removeEventListener('dragleave', lv); removeEventListener('dragover', ov); removeEventListener('drop', dr); };
  }, [importFiles]);
  return (
    <>
      <div id="view"><Scene /></div>
      <Sidebar /><Detail /><Editor /><Status /><Legend /><Tip /><Modal />
      {drag && <div id="drop" style={{ display: 'flex' }}>Suelta los Excel aquí</div>}
      {toast && <div id="toast" className={toast.err ? 'err' : ''} style={{ display: 'block' }}>{toast.msg}</div>}
    </>
  );
}
