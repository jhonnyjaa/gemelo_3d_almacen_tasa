import * as XLSX from 'xlsx';

export const TYPES = {
  BSU: { label: 'Bienes 2° uso', tx: 'ZMMR0080', color: '#f59e0b' },
  MAT: { label: 'Materiales', tx: 'MB52', color: '#3b82f6' },
  ACT: { label: 'Activos', tx: 'ZFIR0241', color: '#10b981' },
};

const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

// Formato SAP: coma = miles, punto = decimal, signo negativo al final ("129,358.27-").
export function parseNum(v) {
  if (typeof v === 'number') return v;
  let s = String(v ?? '').trim();
  if (!s) return 0;
  let neg = false;
  if (s.endsWith('-')) { neg = true; s = s.slice(0, -1); }
  const n = parseFloat(s.replace(/,/g, ''));
  return Number.isFinite(n) ? (neg ? -n : n) : 0;
}

const fmtDate = (v) => {
  if (v instanceof Date && !isNaN(v)) {
    return `${String(v.getUTCDate()).padStart(2, '0')}/${String(v.getUTCMonth() + 1).padStart(2, '0')}/${v.getUTCFullYear()}`;
  }
  return String(v ?? '').trim();
};
const str = (v) => (v instanceof Date ? fmtDate(v) : String(v ?? '').trim());

function detect(headers) {
  const h = headers.map(norm);
  if (h.includes('act.fijo')) return 'ACT';
  if (h.includes('texto breve de material')) return 'MAT';
  if (h.includes('descripcion del bien')) return 'BSU';
  return null;
}

export async function parseFile(file) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '', blankrows: false });
  // la cabecera es la primera fila que permita detectar el tipo
  let hi = -1, type = null;
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    type = detect(rows[i]);
    if (type) { hi = i; break; }
  }
  if (!type) throw new Error(`${file.name}: no reconozco el formato (esperaba ZMMR0080, MB52 o ZFIR0241)`);
  const hdr = rows[hi].map(norm);
  // primera columna con ese nombre (hay cabeceras repetidas: Denominación, Tipo...)
  const col = (...names) => { for (const n of names) { const i = hdr.indexOf(norm(n)); if (i >= 0) return i; } return -1; };
  const get = (r, c) => (c >= 0 ? r[c] : '');
  const data = rows.slice(hi + 1);
  const items = [];

  if (type === 'BSU') {
    const c = {
      loc: col('Ubicación'), code: col('Material'), lote: col('Lote'), desc: col('Descripción del bien'),
      qty: col('Libre utilización'), um: col('Unidad de medida'), estado: col('Estado del bien'),
      marca: col('Marca'), modelo: col('Modelo'), serie: col('Nro. de serie'),
    };
    for (const r of data) {
      const code = str(get(r, c.code));
      if (!code) continue;
      items.push({
        t: 'BSU', code, desc: str(get(r, c.desc)), qty: parseNum(get(r, c.qty)), um: str(get(r, c.um)),
        lote: str(get(r, c.lote)), loc: str(get(r, c.loc)),
        extra: { Estado: str(get(r, c.estado)), Marca: str(get(r, c.marca)), Modelo: str(get(r, c.modelo)), Serie: str(get(r, c.serie)) },
      });
    }
  } else if (type === 'MAT') {
    const c = {
      loc: col('Ubicación'), code: col('Material'), lote: col('Lote'), desc: col('Texto breve de material'),
      qty: col('Libre utilización'), um: col('Unidad medida base'), qi: col('Inspecc.de calidad'),
      blq: col('Bloqueado'), cad: col('Cad./FPC'), fab: col('Fec. Fabric.'),
    };
    for (const r of data) {
      const code = str(get(r, c.code));
      if (!code) continue;
      items.push({
        t: 'MAT', code, desc: str(get(r, c.desc)), qty: parseNum(get(r, c.qty)), um: str(get(r, c.um)),
        lote: str(get(r, c.lote)), loc: str(get(r, c.loc)),
        extra: {
          'Insp. calidad': parseNum(get(r, c.qi)) || '', Bloqueado: parseNum(get(r, c.blq)) || '',
          Vencimiento: fmtDate(get(r, c.cad)), Fabricación: fmtDate(get(r, c.fab)),
        },
      });
    }
  } else {
    const c = {
      loc: col('Ubi.Física'), code: col('Act.Fijo'), sub: col('Subnúmero'), desc: col('Denominación'),
      extra: col('Denominación extra'), old: col('Cod.Antiguo'), serie: col('Serie'),
      fab: col('Fabricante del activo fijo'), estado: col('Est.Traslado'),
    };
    for (const r of data) {
      const code = str(get(r, c.code));
      if (!code) continue;
      items.push({
        t: 'ACT', code, desc: str(get(r, c.desc)), qty: 1, um: 'UN',
        lote: '', loc: str(get(r, c.loc)), sub: str(get(r, c.sub)),
        extra: {
          'Cód. antiguo': str(get(r, c.old)), Detalle: str(get(r, c.extra)), Serie: str(get(r, c.serie)),
          Fabricante: str(get(r, c.fab)), Traslado: str(get(r, c.estado)),
        },
      });
    }
  }
  return { type, items, fileName: file.name };
}
