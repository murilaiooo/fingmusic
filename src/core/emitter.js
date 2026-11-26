/** Emissor de eventos mínimo. on() devolve a função de cancelamento. */
export class Emitter {
  constructor() { this._h = new Map(); }
  on(type, fn) {
    if (!this._h.has(type)) this._h.set(type, new Set());
    this._h.get(type).add(fn);
    return () => this._h.get(type)?.delete(fn);
  }
  emit(type, payload) {
    const set = this._h.get(type);
    if (set) for (const fn of [...set]) { try { fn(payload); } catch (e) { console.error(e); } }
  }
}
