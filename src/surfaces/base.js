/**
 * Superfície de interação: o "instrumento na tela". Cada família tem a sua
 * (cordas livres, braço, teclas, lâminas, pads, theremin). Todas recebem
 * ponteiros unificados (toque, mouse, caneta e pontas dos dedos da câmera):
 *   { id, x, y, t, source: 'touch'|'mouse'|'pen'|'hand', pressure, hover }
 */
import { lightLine, lightRect } from '../light/render.js';
import { isRoot, inScale, noteName } from '../theory/music.js';

export class Surface {
  constructor(app, inst) {
    this.app = app; this.inst = inst;
    this.rect = { x: 0, y: 0, w: 1, h: 1 };
    this.ptrs = new Map();
    this.fixedNotes = null; // notas definidas por lição/jogo
  }
  get music() { return this.app.music; }
  get quality() { return this.app.quality; }
  layout(rect) { this.rect = rect; }
  setNotes(midis) { this.fixedNotes = midis ? [...midis].sort((a, b) => a - b) : null; this.rebuild?.(); }
  rebuild() {}
  down() {} move() {} up() {} hover() {}
  cancelAll() { for (const id of [...this.ptrs.keys()]) this.up({ id, x: 0, y: 0, t: performance.now(), cancel: true }); this.ptrs.clear(); }
  render() {}
  keyNote() {}
  /** Lista de elementos tocáveis: [{midi, key}] — usada pelo Genius e pela iluminação. */
  elements() { return []; }
  keyFor(midi) { return null; }
  capabilities() { return ['finger', 'soft', 'hard']; }
  destroy() { this.cancelAll(); }

  // utilidades
  noteOn(o) { return this.app.performer.noteOn(o); }
  noteOff(ev) { this.app.performer.noteOff(ev); }
  lightOpts() { const L = this.app.lighting; return { reduce: L.reduceFlashes || this.app.settings.reduceMotion, contrast: L.highContrast, shapes: L.showShapes, t: performance.now() / 1000 }; }
  light(midi, key) { return this.app.lighting.stateFor(midi, key, this.app.engine.now); }
  drawLightLine(ctx, midi, key, a, b, hue, order) { const st = this.light(midi, key); if (st) lightLine(ctx, st, a, b, hue, { ...this.lightOpts(), order }); return st; }
  drawLightRect(ctx, midi, key, r, hue, radius) { const st = this.light(midi, key); if (st) lightRect(ctx, st, r, hue, { ...this.lightOpts(), radius }); return st; }
  isRoot(m) { return this.music.highlightRoots && isRoot(m, this.music.root); }
  inScale(m) { return inScale(m, this.music.root, this.music.scale); }
  label(m) { return noteName(m, this.app.settings.noteLetters); }
  velFromSpeed(pxPerMs) { return Math.max(0.12, Math.min(1.25, 0.18 + pxPerMs * 0.55 * (this.app.settings.sensitivity ?? 1))); }
  pulse(v) { this.app.haptics.pulse(v); }
}
