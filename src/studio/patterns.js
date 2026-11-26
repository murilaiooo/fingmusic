/**
 * Padrões de bateria originais por gênero, com variação procedural (ghost
 * notes, viradas) por seed. Cada linha tem 16 passos (semicolcheias):
 *   x = forte, o = médio, . = ghost, - = silêncio
 * Notas geradas no formato de pista: {b, m (GM), v, d}.
 */
import { rng } from '../core/util.js';

const P = (kit, bpm, swing, lanes, extra = {}) => ({ kit, bpm, swing, lanes, ...extra });
export const DRUM_STYLES = {
  funk: { name: 'Funk', ...P('acoustic', 98, 0.08, { 36: 'x--x--o---x--o--', 38: '----x--.-.--x--.', 42: 'xoxoxoxoxoxoxoxo', 46: '--------------x-' }) },
  rock: { name: 'Rock', ...P('acoustic', 112, 0, { 36: 'x-----x-x-------', 38: '----x-------x---', 42: 'x-o-x-o-x-o-x-o-', 49: 'x---------------' }) },
  hiphop: { name: 'Hip-hop', ...P('electro', 88, 0.28, { 36: 'x------x-x----o-', 38: '----x-------x---', 42: 'x-o-x-o-x-o-xoo-', 37: '-------.-------.' }) },
  trap: { name: 'Trap', ...P('electro', 140, 0, { 36: 'x------x--x-----', 39: '--------x-------', 42: 'x-o-x-o-x-o-x-o-', 46: '-------------o--' }, { halfTime: true, rolls: true }) },
  house: { name: 'House', ...P('electro', 122, 0.05, { 36: 'x---x---x---x---', 39: '----x-------x---', 46: '--x---x---x---x-', 42: 'oo.ooo.ooo.ooo.o', 70: '..o...o...o...o.' }) },
  lofi: { name: 'Lo-fi', ...P('electro', 78, 0.55, { 36: 'x------x-x------', 38: '----x-------x---', 42: 'o-o-o-o-o-o-o-o-', 70: '-.-.-.-.-.-.-.-.' }) },
  jazz: { name: 'Jazz', ...P('acoustic', 132, 0.66, { 51: 'x---x-o-x---x-o-', 42: '----x-------x---', 36: '.-------.-------', 38: '------.-------.-' }) },
  reggae: { name: 'Reggae', ...P('acoustic', 76, 0.4, { 36: '--------x-------', 37: '--------x-------', 42: 'x-o-x-o-x-o-x-o-', 46: '------------o---' }) },
  disco: { name: 'Disco', ...P('acoustic', 118, 0, { 36: 'x---x---x---x---', 38: '----x-------x---', 46: '--x---x---x---x-', 42: 'o-o-o-o-o-o-o-o-' }) },
  samba: { name: 'Samba', ...P('brazil', 104, 0.06, { 36: '----x-------x---', 41: 'x-------x-------', 38: 'x.ox.oxox.ox.oxo', 37: 'x-x-xx-x-x-xx-x-', 70: 'xooxxooxxooxxoox' }) },
  bossa: { name: 'Bossa nova', ...P('brazil', 128, 0, { 41: 'x--x----x--x----', 37: 'x--x--x---x--x--', 70: 'xoooxoooxoooxooo' }, { rimBars: ['x--x--x---x--x--', '--x--x--x--x----'] }) },
  baiao: { name: 'Baião', ...P('brazil', 96, 0, { 36: 'x--x----x--x----', 41: '------x-------x-', 54: 'oxooxoxooxooxoxo', 67: '--x---x---x---x-' }) },
};

const VEL = { x: 0.95, o: 0.68, '.': 0.32 };
const LEN = 0.25;

/** Gera notas de bateria para `bars` compassos. */
export function generateDrums(styleId, bars = 2, { seed = 3, variation = 0.5, fill = true } = {}) {
  const st = DRUM_STYLES[styleId] ?? DRUM_STYLES.rock, r = rng(seed), notes = [];
  for (let bar = 0; bar < bars; bar++) {
    const last = bar === bars - 1 && bars > 1;
    for (const [lane, row] of Object.entries(st.lanes)) {
      let pattern = row;
      if (st.rimBars && Number(lane) === 37) pattern = st.rimBars[bar % 2];
      for (let s = 0; s < 16; s++) {
        let c = pattern[s];
        if (last && fill && s >= 12 && (lane === '38' || lane === '37') && r() < 0.6 * variation + 0.2) c = s % 2 ? '.' : 'o';
        if (c === '-' && lane === '38' && r() < 0.08 * variation) c = '.';
        if (c === '-') continue;
        const v = Math.min(1, VEL[c] * (0.92 + r() * 0.12));
        notes.push({ b: bar * 4 + s * LEN, m: Number(lane), v, d: LEN });
      }
    }
    // virada com toms no fim do último compasso
    if (last && fill && st.kit !== 'brazil' && r() < 0.5 + variation * 0.4) {
      [[3, 48], [3.25, 48], [3.5, 45], [3.75, 45]].forEach(([b, m]) => notes.push({ b: bar * 4 + b, m, v: 0.8, d: LEN }));
    }
    if (st.rolls) for (let s = 0; s < 4; s++) if (r() < 0.35) { const b0 = bar * 4 + s + 0.5; for (let k = 0; k < 4; k++) notes.push({ b: b0 + k * 0.125, m: 42, v: 0.5 + k * 0.1, d: 0.125 }); }
  }
  return notes.sort((a, b) => a.b - b.b);
}
