import { Emitter } from './emitter.js';

/**
 * Estado global observável. Mantido propositalmente simples: um objeto raso
 * por domínio, mudanças via set(), e assinaturas por chave.
 */
export class Store extends Emitter {
  constructor(initial) { super(); this.state = { ...initial }; }
  get(k) { return this.state[k]; }
  set(patch) {
    const changed = [];
    for (const k in patch) if (this.state[k] !== patch[k]) { this.state[k] = patch[k]; changed.push(k); }
    for (const k of changed) this.emit('change:' + k, this.state[k]);
    if (changed.length) this.emit('change', changed);
  }
  watch(k, fn, immediate = true) {
    const off = this.on('change:' + k, fn);
    if (immediate) fn(this.state[k]);
    return off;
  }
}
