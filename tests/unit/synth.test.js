import { describe, it, expect } from 'vitest';
import { renderPluck } from '../../src/audio/synth/pluck.js';
import { renderModal, renderFM } from '../../src/audio/synth/modal.js';

/** Estima a frequência fundamental (YIN simplificado). */
function pitchOf(buf, sr, from = 2000, len = 8192) {
  const x = buf.subarray(from, from + len), maxLag = Math.floor(sr / 30), W = len - maxLag;
  const d = new Float64Array(maxLag); 
  for (let lag = 1; lag < maxLag; lag++) { let s = 0; for (let i = 0; i < W; i++) { const v = x[i] - x[i + lag]; s += v * v; } d[lag] = s; }
  let run = 0; const cm = new Float64Array(maxLag); cm[0] = 1;
  for (let lag = 1; lag < maxLag; lag++) { run += d[lag]; cm[lag] = d[lag] * lag / (run || 1); }
  let lag = 2; while (lag < maxLag - 1 && !(cm[lag] < 0.15 && cm[lag] <= cm[lag + 1])) lag++;
  if (lag >= maxLag - 1) { lag = 2; for (let l = 2; l < maxLag; l++) if (cm[l] < cm[lag]) lag = l; }
  const a = cm[lag - 1], b = cm[lag], c = cm[lag + 1];
  return sr / (lag + (a - c) / (2 * (a - 2 * b + c) || 1));
}
const cents = (f, ref) => 1200 * Math.log2(f / ref);

describe('síntese de cordas (Karplus-Strong estendido)', () => {
  const sr = 48000;
  it('afina com precisão (< 6 cents) em vários registros', () => {
    for (const f of [41.2, 82.41, 110, 220, 440, 880]) {
      const b = renderPluck({ sr, freq: f, dur: 1, vel: 0.7, noise: 0.1 });
      expect(Math.abs(cents(pitchOf(b, sr), f))).toBeLessThan(6);
    }
  });
  it('não clipa e decai', () => {
    const b = renderPluck({ sr, freq: 110, dur: 2, vel: 1.2, decay: 1.5 });
    let pk = 0; for (const v of b) pk = Math.max(pk, Math.abs(v));
    expect(pk).toBeLessThan(2);
    const rms = (a, z) => Math.sqrt(a.subarray(a.length * z | 0, (a.length * z | 0) + 2000).reduce((s, v) => s + v * v, 0) / 2000);
    expect(rms(b, 0.8)).toBeLessThan(rms(b, 0.05) * 0.2);
  });
  it('palm mute decai muito mais rápido', () => {
    const open = renderPluck({ sr, freq: 82, dur: 1, decay: 3 }), mute = renderPluck({ sr, freq: 82, dur: 1, decay: 3, mute: true });
    const e = (a) => a.subarray(24000, 26000).reduce((s, v) => s + v * v, 0);
    expect(e(mute)).toBeLessThan(e(open) * 0.05);
  });
  it('força maior gera timbre mais brilhante', () => {
    const hf = (a) => { let s = 0; for (let i = 1001; i < 5000; i++) s += (a[i] - a[i - 1]) ** 2; let t = 0; for (let i = 1000; i < 5000; i++) t += a[i] ** 2; return s / t; };
    const soft = renderPluck({ sr, freq: 110, vel: 0.2, dur: 0.5, seed: 1 }), hard = renderPluck({ sr, freq: 110, vel: 1.2, dur: 0.5, seed: 1 });
    expect(hf(hard)).toBeGreaterThan(hf(soft));
  });
  it('síntese modal e FM afinadas', () => {
    const m = renderModal({ sr, freq: 220, partials: [{ r: 1, a: 1, t: 2 }, { r: 2, a: 0.3, t: 1 }], dur: 0.8 });
    expect(Math.abs(cents(pitchOf(m, sr), 220))).toBeLessThan(6);
    const f = renderFM({ sr, freq: 220, dur: 0.8 });
    expect(Math.abs(cents(pitchOf(f, sr, 8000), 220))).toBeLessThan(10);
  });
});
