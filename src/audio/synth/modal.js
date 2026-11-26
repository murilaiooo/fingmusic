/**
 * Síntese modal/aditiva renderizada (soma de parciais com decaimentos
 * independentes). Usada para piano, piano elétrico (FM), marimba, vibrafone,
 * kalimba e sinos. Renderizar em buffer mantém o custo de CPU baixo durante a
 * execução: tocar uma nota custa um único AudioBufferSourceNode.
 */
import { clamp, rng } from '../../core/util.js';

/**
 * partials: [{r: razão, a: amplitude, t: T60 em s}], com inarmonicidade opcional B
 * (f_n = n f sqrt(1 + B n²)), batimento (detune em cents) e ruído de ataque.
 */
export function renderModal(o) {
  const sr = o.sr ?? 48000, f0 = o.freq, dur = o.dur ?? 2.5, vel = clamp(o.vel ?? 0.7, 0.02, 1.5);
  const len = Math.max(64, Math.floor(sr * dur)), out = new Float32Array(len);
  const B = o.inharm ?? 0, random = rng(o.seed ?? Math.round(f0 * 31));
  const nyq = sr * 0.45;
  const brightTilt = o.velBright ?? 0.6; // força realça parciais altos
  for (const p of o.partials) {
    const n = p.r;
    const f = f0 * n * (B ? Math.sqrt(1 + B * n * n) : 1);
    if (f >= nyq) continue;
    const amp = p.a * Math.pow(Math.max(0.05, vel), (n > 1.5 ? brightTilt * Math.log2(n + 1) : 0));
    const k = Math.exp(-6.9078 / (Math.max(0.01, p.t) * sr)); // T60
    const det = p.det ? 2 ** (p.det / 1200) : 0;
    const w = (2 * Math.PI * f) / sr, w2 = det ? w * det : 0;
    let e = amp, ph = random() * 6.283, ph2 = random() * 6.283;
    const att = Math.max(1, Math.floor(sr * (p.att ?? 0.0015)));
    // Sine recurrence avoids two transcendental calls per sample/partial.
    let y = Math.sin(ph), prev = Math.sin(ph-w), y2 = Math.sin(ph2), prev2 = Math.sin(ph2-w2);
    const a1 = 2*Math.cos(w), a2 = 2*Math.cos(w2);
    for (let i = 0; i < len; i++) {
      const env = i < att ? i / att : 1;
      out[i] += e * env * (det ? 0.5 * (y+y2) : y);
      const next=a1*y-prev; prev=y; y=next;
      if(det){const next2=a2*y2-prev2;prev2=y2;y2=next2;}
      e *= k; if (e < 1e-5) break;
    }
  }
  if (o.noise) {
    const nl = Math.floor(sr * (o.noise.len ?? 0.01)); let z = 0;
    for (let i = 0; i < nl && i < len; i++) {
      z += ((random() * 2 - 1) - z) * (o.noise.tone ?? 0.3);
      out[i] += z * (o.noise.amount ?? 0.2) * vel * Math.exp(-i / (nl * 0.25));
    }
  }
  normalizeTo(out, 0.9);
  const fade = Math.min(len, Math.floor(sr * 0.03));
  for (let i = 0; i < fade; i++) out[len - 1 - i] *= i / fade;
  return out;
}

/** Piano elétrico por FM de dois operadores com índice que decai (latido do "tine"). */
export function renderFM(o) {
  const sr = o.sr ?? 48000, f = o.freq, dur = o.dur ?? 2.5, vel = clamp(o.vel ?? 0.7, 0.02, 1.5);
  const len = Math.floor(sr * dur), out = new Float32Array(len);
  const ratio = o.ratio ?? 1, idx0 = (o.index ?? 2.2) * (0.35 + vel * 0.9), idxT = o.indexDecay ?? 0.35;
  const t60 = o.decay ?? 2.2, kA = Math.exp(-6.9078 / (t60 * sr)), kI = Math.exp(-6.9078 / (idxT * sr));
  const tine = o.tine ?? 0.25, wT = (2 * Math.PI * f * 7.1) / sr, kT = Math.exp(-6.9078 / (0.08 * sr));
  let pc = 0, pm = 0, pt = 0, a = 1, ix = idx0, at = tine * vel;
  const wc = (2 * Math.PI * f) / sr, wm = wc * ratio;
  for (let i = 0; i < len; i++) {
    const env = i < 48 ? i / 48 : 1;
    out[i] = env * (a * Math.sin(pc + ix * Math.sin(pm)) + at * Math.sin(pt));
    pc += wc; pm += wm; pt += wT; a *= kA; ix *= kI; at *= kT;
  }
  normalizeTo(out, 0.85);
  const fade = Math.floor(sr * 0.03); for (let i = 0; i < fade; i++) out[len - 1 - i] *= i / fade;
  return out;
}

export function normalizeTo(buf, target) {
  let pk = 1e-9; for (let i = 0; i < buf.length; i++) pk = Math.max(pk, Math.abs(buf[i]));
  const g = target / pk; for (let i = 0; i < buf.length; i++) buf[i] *= g;
  return buf;
}
