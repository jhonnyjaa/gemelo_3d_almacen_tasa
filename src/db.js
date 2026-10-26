// Persistencia local (IndexedDB): un dataset por tipo (BSU / MAT / ACT).
const open = () => new Promise((res, rej) => {
  const rq = indexedDB.open('gemelo-3d', 1);
  rq.onupgradeneeded = () => rq.result.createObjectStore('datasets');
  rq.onsuccess = () => res(rq.result);
  rq.onerror = () => rej(rq.error);
});
const tx = async (mode, fn) => {
  const db = await open();
  return new Promise((res, rej) => {
    const t = db.transaction('datasets', mode);
    const out = fn(t.objectStore('datasets'));
    t.oncomplete = () => res(out.result);
    t.onerror = () => rej(t.error);
  });
};
export const saveDataset = (type, ds) => tx('readwrite', (s) => s.put(ds, type));
export const loadAll = async () => {
  const out = {};
  for (const t of ['BSU', 'MAT', 'ACT']) { const v = await tx('readonly', (s) => s.get(t)); if (v) out[t] = v; }
  return out;
};
export const clearDataset = (type) => tx('readwrite', (s) => s.delete(type));
