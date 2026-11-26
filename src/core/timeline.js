/**
 * Tempo musical: conversão batida <-> segundos com mapa de andamento
 * (mudanças de BPM) e multiplicador de velocidade (prática lenta).
 * Puro e testável. tempoMap: [{b: batida, bpm}] ordenado, com b=0 no início.
 */
export function normalizeTempoMap(map, fallback = 100) {
  const m = (map && map.length ? map : [{ b: 0, bpm: fallback }]).map((x) => ({ b: Math.max(0, x.b), bpm: Math.max(20, Math.min(400, x.bpm)) })).sort((a, b) => a.b - b.b);
  if (m[0].b > 0) m.unshift({ b: 0, bpm: m[0].bpm });
  return m;
}

/** Segundos decorridos da batida 0 até a batida b. */
export function beatToSec(b, map, rate = 1) {
  let s = 0;
  if (b < 0) return (b * 60) / (map[0].bpm * rate);
  for (let i = 0; i < map.length; i++) {
    const seg = map[i], end = i + 1 < map.length ? map[i + 1].b : Infinity;
    if (b <= seg.b) break;
    const span = Math.min(b, end) - seg.b;
    s += (span * 60) / (seg.bpm * rate);
  }
  return s;
}

/** Batida correspondente a `sec` segundos desde a batida 0. */
export function secToBeat(sec, map, rate = 1) {
  if (sec < 0) return (sec * map[0].bpm * rate) / 60;
  let acc = 0;
  for (let i = 0; i < map.length; i++) {
    const seg = map[i], end = i + 1 < map.length ? map[i + 1].b : Infinity;
    const segSec = end === Infinity ? Infinity : ((end - seg.b) * 60) / (seg.bpm * rate);
    if (sec <= acc + segSec) return seg.b + ((sec - acc) * seg.bpm * rate) / 60;
    acc += segSec;
  }
  return 0;
}

export const bpmAt = (b, map) => { let v = map[0].bpm; for (const s of map) if (s.b <= b) v = s.bpm; return v; };

/** Aplica swing a uma batida (colcheias/semicolcheias pares atrasadas). */
export function swingBeat(b, swing, grid = 0.5) {
  if (!swing) return b;
  const pos = b / grid, idx = Math.round(pos);
  if (Math.abs(pos - idx) > 0.02 || idx % 2 === 0) return b;
  return b + swing * grid * 0.5;
}

/** Quantiza uma batida para a grade (1 = semínima, 0.5 = colcheia, 0.25 = semicolcheia). */
export const quantize = (b, grid, strength = 1) => (grid ? b + (Math.round(b / grid) * grid - b) * strength : b);
