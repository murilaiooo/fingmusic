/**
 * Geradores musicais procedurais: linhas de baixo, acordes de acompanhamento e
 * arpejos. Produzem eventos de nota no formato das pistas: {b, m, v, d}.
 */
import { chordNotes, pitchClass } from './music.js';
import { rng } from '../core/util.js';

export const BASS_STYLES = {
  root: 'Fundamental',
  rootFifth: 'Fundamental e quinta',
  octave: 'Oitavas funk',
  walking: 'Walking',
  syncopated: 'Sincopado',
  slide808: '808 com slides',
};

/** Linha de baixo sobre uma progressão. chords: um acorde por compasso. */
export function generateBassline(chords, style = 'rootFifth', { base = 28, seed = 7, beatsPerBar = 4 } = {}) {
  const r = rng(seed), notes = [];
  const rootOf = (c) => base + ((c.root - base) % 12 + 12) % 12;
  chords.forEach((c, bar) => {
    const b0 = bar * beatsPerBar, R = rootOf(c), fifth = R + 7, third = R + c.intervals[1];
    const next = rootOf(chords[(bar + 1) % chords.length]);
    const push = (b, m, v = 0.8, d = 0.45) => notes.push({ b: b0 + b, m, v, d });
    switch (style) {
      case 'root': push(0, R, 0.85, 3.6); break;
      case 'rootFifth': push(0, R, 0.9, 1.4); push(1.5, R, 0.6, 0.4); push(2, fifth, 0.8, 1.2); push(3.5, r() < 0.5 ? R + 12 : fifth, 0.55, 0.4); break;
      case 'octave':
        for (let s = 0; s < 8; s++) {
          const pat = [1, 0, 1, 1, 0, 1, 0, 1][s];
          if (pat) push(s * 0.5, s % 2 ? R + 12 : R, s % 2 ? 0.65 : 0.95, 0.3);
        }
        break;
      case 'walking': {
        const approach = next + (next > R ? -1 : 1);
        [R, third, fifth, approach].forEach((m, i) => push(i, m, i ? 0.7 : 0.9, 0.9));
        break;
      }
      case 'syncopated': {
        const grid = [0, 0.75, 1.5, 2.5, 3, 3.5];
        grid.forEach((b, i) => { if (i === 0 || r() < 0.8) push(b, i === 3 ? fifth : i === 5 ? R + 12 : R, i ? 0.7 : 0.95, 0.35); });
        break;
      }
      case 'slide808': push(0, R, 1, 1.6); push(2.5, r() < 0.5 ? R : fifth - 12 + 12, 0.85, 1.2); if (r() < 0.6) push(3.5, R + 12, 0.7, 0.4); break;
      default: push(0, R);
    }
  });
  return notes;
}

/** Acordes de acompanhamento (pad/teclas): um bloco por compasso com variação rítmica opcional. */
export function generateChordTrack(chords, { base = 55, rhythm = 'sustain', beatsPerBar = 4 } = {}) {
  const notes = [];
  chords.forEach((c, bar) => {
    const ns = chordNotes(c, base);
    const hits = rhythm === 'stabs' ? [[0.5, 0.4], [1.75, 0.3], [2.5, 0.4], [3.5, 0.3]] : rhythm === 'bossa' ? [[0, 0.9], [1.5, 0.9], [3, 0.9]] : [[0, beatsPerBar - 0.1]];
    for (const [b, d] of hits) for (const m of ns) notes.push({ b: bar * beatsPerBar + b, m, v: 0.6, d });
  });
  return notes;
}

export const ARP_MODES = { up: 'Subindo', down: 'Descendo', updown: 'Sobe e desce', random: 'Aleatório', chord: 'Acorde repetido' };

/** Sequência do arpejador para um conjunto de notas seguradas. */
export function arpSequence(held, mode = 'up', octaves = 1) {
  const base = [...new Set(held)].sort((a, b) => a - b);
  if (!base.length) return [];
  let seq = [];
  for (let o = 0; o < octaves; o++) seq.push(...base.map((m) => m + 12 * o));
  if (mode === 'down') seq.reverse();
  else if (mode === 'updown' && seq.length > 2) seq = [...seq, ...seq.slice(1, -1).reverse()];
  else if (mode === 'chord') seq = [seq];
  return seq;
}

/** Sugestões de notas: notas da escala que formam consonância com as últimas tocadas. */
export function suggestNext(recent, root, scaleSteps) {
  if (!recent.length) return scaleSteps.map((s) => (root + s) % 12);
  const last = pitchClass(recent[recent.length - 1]);
  const good = [0, 3, 4, 5, 7, 8, 9];
  return scaleSteps.map((s) => (root + s) % 12).filter((pc) => good.includes(((pc - last) % 12 + 12) % 12));
}
