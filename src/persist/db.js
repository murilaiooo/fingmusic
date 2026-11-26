/**
 * Persistência local com IndexedDB (sem cadastro, sem servidor).
 * Stores: sessions, instruments, songs, midi, genius, progress, kv.
 * Inclui backup completo (exportar/importar JSON).
 */
const DB_NAME = 'fingmusic', DB_VERSION = 1;
export const STORES = ['sessions', 'instruments', 'songs', 'midi', 'genius', 'progress', 'kv'];
let dbp = null;

function open() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) { reject(new Error('IndexedDB indisponível')); return; }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => { const db = req.result; for (const s of STORES) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' }); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  dbp.catch(() => { dbp = null; });
  return dbp;
}
function tx(store, mode, fn) {
  return open().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(store, mode), s = t.objectStore(store);
    let out; const r = fn(s);
    if (r) r.onsuccess = () => { out = r.result; };
    t.oncomplete = () => resolve(out); t.onerror = () => reject(t.error); t.onabort = () => reject(t.error);
  }));
}
export const db = {
  put: (store, value) => tx(store, 'readwrite', (s) => s.put({ ...value, updatedAt: Date.now() })),
  get: (store, id) => tx(store, 'readonly', (s) => s.get(id)),
  all: (store) => tx(store, 'readonly', (s) => s.getAll()).then((x) => x ?? []),
  del: (store, id) => tx(store, 'readwrite', (s) => s.delete(id)),
  clear: (store) => tx(store, 'readwrite', (s) => s.clear()),
  async exportAll(settings) {
    const out = { format: 'fingmusic-backup', version: 1, exportedAt: new Date().toISOString(), settings, stores: {} };
    for (const s of STORES) {
      const rows = await this.all(s).catch(() => []);
      out.stores[s] = rows.map((r) => (r.data instanceof ArrayBuffer ? { ...r, data: { __b64: b64(r.data) } } : r));
    }
    return out;
  },
  async importAll(json) {
    if (json?.format !== 'fingmusic-backup') throw new Error('Arquivo de backup inválido.');
    let n = 0;
    for (const s of STORES) for (const r of json.stores?.[s] ?? []) { await this.put(s, r.data?.__b64 ? { ...r, data: unb64(r.data.__b64) } : r); n++; }
    return { count: n, settings: json.settings };
  },
};
function b64(buf) { let s = ''; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); return btoa(s); }
function unb64(s) { const bin = atob(s), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer; }
