import { StringsSurface } from './strings.js';
import { FretboardSurface } from './fretboard.js';
import { KeysSurface } from './keys.js';
import { MalletsSurface } from './mallets.js';
import { PadsSurface } from './pads.js';
import { ThereminSurface } from './theremin.js';

const MAP = { strings: StringsSurface, fretboard: FretboardSurface, keys: KeysSurface, mallets: MalletsSurface, pads: PadsSurface, theremin: ThereminSurface };
/** Cria a superfície natural do instrumento (ou a forçada: ex. cordas no modo Criar). */
export function createSurface(app, inst, opts = {}) {
  const Cls = MAP[opts.surface ?? inst.surface] ?? StringsSurface;
  return new Cls(app, inst, opts);
}
