// Pequenos utilitários compartilhados por todos os módulos.
export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const mtof = (m) => 440 * 2 ** ((m - 69) / 12);
export const ftom = (f) => 69 + 12 * Math.log2(f / 440);
export const dbToGain = (db) => 10 ** (db / 20);
export const uid = (p = 'id') => p + '_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
export const now = () => performance.now();

/** Gerador pseudoaleatório determinístico (mulberry32) — usado em padrões procedurais. */
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function debounce(fn, ms) {
  let t = 0;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

export const deepClone = (o) => (typeof structuredClone === 'function' ? structuredClone(o) : JSON.parse(JSON.stringify(o)));

/** Distância de um ponto a um segmento; devolve {d, t} com t em [0,1]. */
export function pointSegment(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy || 1;
  const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / l2, 0, 1);
  return { d: Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t)), t };
}

/** Interseção de segmentos p→q e a→b. Devolve t em b (0..1) ou -1. */
export function segCross(p, q, a, b) {
  const rx = q.x - p.x, ry = q.y - p.y, sx = b.x - a.x, sy = b.y - a.y;
  const den = rx * sy - ry * sx;
  if (Math.abs(den) < 1e-9) return -1;
  const ax = a.x - p.x, ay = a.y - p.y;
  const u = (ax * sy - ay * sx) / den, t = (ax * ry - ay * rx) / den;
  return u >= 0 && u <= 1 && t >= 0 && t <= 1 ? t : -1;
}
