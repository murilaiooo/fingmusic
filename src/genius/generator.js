/**
 * Gerador de sequências para o Genius (e exercícios). Determinístico por seed:
 * a mesma configuração sempre gera a mesma sequência, o que permite desafios
 * diários, compartilhamento de códigos e testes reproduzíveis.
 *
 * Uma sequência é uma lista de passos: { m: midi | [midis], d: duração em
 * batidas, rest: pausa antes (batidas), v: força, tech }.
 */
import { rng } from '../core/util.js';
import { SCALES } from '../theory/music.js';
import { GROOVES } from '../learn/grooves.js';

export const STRATEGIES = { random: 'Aleatória', musical: 'Musical', rhythmic: 'Rítmica', harmonic: 'Harmônica', groove: 'Groove', adaptive: 'Adaptativa' };

export function hashSeed(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}

const RHYTHMS = [
  [1, 1, 1, 1], [0.5, 0.5, 1, 1, 1], [1.5, 0.5, 1, 1], [0.75, 0.75, 0.5, 1, 1], [1, 0.5, 0.5, 1.5, 0.5], [0.5, 1, 0.5, 1, 1],
];

/**
 * opts: { strategy, length, elements (midis disponíveis em ordem), seed, root, scale,
 *         rhythm (bool), chords (bool), techniques ([]), weights (adaptativa: {midi: peso}), maxLeap }
 */
export function generateSequence(opts) {
  const r = rng(opts.seed ?? 1);
  const el = [...opts.elements].sort((a, b) => a - b);
  const n = opts.length ?? 32;
  const steps = [];
  const pick = (arr) => arr[Math.floor(r() * arr.length)];
  const maxLeap = opts.maxLeap ?? Math.max(2, Math.ceil(el.length / 2));
  const strategy = opts.strategy ?? 'random';

  if (strategy === 'groove') {
    const pool = GROOVES.filter((g) => !opts.genre || g.genre === opts.genre);
    const g = pool[Math.floor(r() * pool.length)] ?? GROOVES[0];
    // transpõe o groove para o conjunto disponível, mantendo intervalos
    const root = el[0];
    let prevB = 0;
    for (let i = 0; i < n; i++) {
      const src = g.notes[i % g.notes.length], cycle = Math.floor(i / g.notes.length);
      const b = src.b + cycle * g.bars * 4;
      const m = nearest(el, root + src.i);
      steps.push({ m, d: src.d, rest: Math.max(0, b - prevB - (steps.length ? steps[steps.length - 1].d : 0)), v: src.v ?? 0.75, tech: src.tech ?? 'finger', b });
      prevB = b;
    }
    steps.groove = g;
    return steps;
  }

  let idx = Math.floor(r() * el.length), prev2 = -1;
  const weights = opts.weights ?? null;
  for (let i = 0; i < n; i++) {
    let m;
    if (strategy === 'musical') {
      // movimento por graus conjuntos com saltos ocasionais; frases resolvem na tônica
      const step = r() < 0.7 ? (r() < 0.5 ? 1 : -1) : (r() < 0.5 ? 2 : -2) * (1 + Math.floor(r() * 2));
      idx = Math.max(0, Math.min(el.length - 1, idx + step));
      if ((i + 1) % 4 === 0 && r() < 0.6) idx = el.findIndex((x) => (x - (opts.root ?? el[0])) % 12 === 0) >= 0 ? nearestIndex(el, idx, (x) => ((x - (opts.root ?? el[0])) % 12 + 12) % 12 === 0) : idx;
      m = el[idx];
    } else if (strategy === 'harmonic') {
      // arpejos de acordes construídos sobre os elementos disponíveis
      const base = Math.floor(i / 3) % Math.max(1, el.length - 4);
      const triad = [el[base], el[Math.min(el.length - 1, base + 2)], el[Math.min(el.length - 1, base + 4)]];
      m = triad[i % 3];
    } else if (strategy === 'adaptive' && weights) {
      const tot = el.reduce((s, x) => s + (weights[x] ?? 1), 0);
      let k = r() * tot; m = el[0];
      for (const x of el) { k -= weights[x] ?? 1; if (k <= 0) { m = x; break; } }
    } else {
      // aleatória: evita três repetições e saltos impossíveis
      let tries = 0;
      do { const ni = Math.max(0, Math.min(el.length - 1, idx + Math.round((r() * 2 - 1) * maxLeap))); m = el[ni]; idx = ni; tries++; }
      while (tries < 8 && steps.length >= 2 && m === steps[steps.length - 1].m && m === prev2);
    }
    prev2 = steps.length ? steps[steps.length - 1].m : -1;
    const step = { m, d: 1, rest: 0, v: 0.7, tech: 'finger' };
    if (opts.chords && i > 2 && r() < 0.18) {
      const j = el.indexOf(m), two = el[Math.min(el.length - 1, j + 2)];
      if (two !== m) step.m = [m, two];
    }
    steps.push(step);
  }
  if (opts.rhythm || strategy === 'rhythmic') {
    let k = 0, pat = pick(RHYTHMS);
    for (const s of steps) { s.d = pat[k % pat.length]; if (r() < 0.12) s.rest = 0.5; k++; if (k % pat.length === 0) pat = pick(RHYTHMS); }
  }
  if (opts.dynamics) for (const s of steps) s.v = pick([0.35, 0.7, 1]);
  if (opts.techniques?.length) for (const s of steps) if (r() < 0.45) s.tech = pick(opts.techniques);
  return steps;
}

function nearest(arr, target) { let b = arr[0]; for (const x of arr) if (Math.abs(x - target) < Math.abs(b - target)) b = x; return b; }
function nearestIndex(arr, from, pred) {
  for (let d = 0; d < arr.length; d++) { if (from + d < arr.length && pred(arr[from + d])) return from + d; if (from - d >= 0 && pred(arr[from - d])) return from - d; }
  return from;
}

/** Conjunto de elementos (notas) para a dificuldade: escala a partir da tônica. */
export function elementsFor(count, root = 0, scale = 'pentMajor', base = 60) {
  const steps = SCALES[scale]?.steps ?? SCALES.pentMajor.steps, out = [];
  for (let i = 0; out.length < count; i++) out.push(base + root + Math.floor(i / steps.length) * 12 + steps[i % steps.length]);
  return out;
}

/** Semente do desafio diário: data local + dificuldade + modo. */
export function dailySeed(date = new Date(), difficulty = 'beginner', mode = 'classic') {
  const d = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
  return { seed: hashSeed('fingmusic-daily|' + d + '|' + difficulty + '|' + mode), date: d };
}

/** Código compartilhável de uma sequência personalizada (base64url de JSON compacto). */
export function encodeSequence(seq, meta = {}) {
  const data = { v: 1, ...meta, s: seq.map((x) => [x.m, x.d, x.rest || 0, Math.round((x.v ?? 0.7) * 100), x.tech && x.tech !== 'finger' ? x.tech : 0]) };
  const json = JSON.stringify(data);
  const b64 = typeof btoa === 'function' ? btoa(unescape(encodeURIComponent(json))) : Buffer.from(json).toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function decodeSequence(code) {
  const b64 = code.replace(/-/g, '+').replace(/_/g, '/');
  const json = typeof atob === 'function' ? decodeURIComponent(escape(atob(b64))) : Buffer.from(b64, 'base64').toString();
  const data = JSON.parse(json);
  if (data.v !== 1 || !Array.isArray(data.s)) throw new Error('Código inválido');
  return { ...data, seq: data.s.map(([m, d, rest, v, tech]) => ({ m, d, rest, v: v / 100, tech: tech || 'finger' })) };
}
