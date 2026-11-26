/**
 * Modelo físico (visual) de corda: equação de onda 1D discretizada com
 * amortecimento, extremidades fixas. Suporta:
 *  - segurar um ponto e puxar (forma triangular com tensão acumulada);
 *  - soltar (a corda oscila e o pulso viaja e reflete nas pontas);
 *  - toque com impulso localizado (dedilhado/strum);
 *  - abafamento (amortecimento forte) e energia para a iluminação.
 * A frequência visual é escalada (não é a do áudio) para ser perceptível.
 */
export class StringModel {
  constructor(n = 36) {
    this.n = n;
    this.y = new Float32Array(n + 1);
    this.v = new Float32Array(n + 1);
    this.c2 = 0.5; // velocidade de onda² (em pontos por passo)
    this.damping = 0.0035;
    this.grab = null; // {t, offset}
    this.dampUntil = 0;
  }
  setPitch(midi) { this.c2 = Math.min(0.95, 0.25 + (midi - 24) / 70 * 0.6); }
  /** Impulso gaussiano em t (0..1) com amplitude em px e direção (sinal). */
  pluck(t, amp, width = 0.08) {
    const n = this.n;
    for (let i = 1; i < n; i++) {
      const x = i / n, g = Math.exp(-((x - t) ** 2) / (2 * width * width));
      this.v[i] += amp * g * 0.35;
      this.y[i] += amp * g * 0.25 * Math.sin(Math.PI * x);
    }
  }
  hold(t, offset) { this.grab = { t: Math.min(0.97, Math.max(0.03, t)), offset }; }
  release() {
    if (!this.grab) return 0;
    const { t, offset } = this.grab;
    this.grab = null;
    // forma triangular inicial: soltar uma corda puxada
    for (let i = 0; i <= this.n; i++) { const x = i / this.n; this.y[i] = offset * (x < t ? x / t : (1 - x) / (1 - t)); this.v[i] = 0; }
    return offset;
  }
  damp(ms = 180) { this.dampUntil = performance.now() + ms; }
  step(dtMs) {
    const n = this.n, y = this.y, v = this.v;
    if (this.grab) {
      // corda presa no dedo: relaxa suavemente para a forma triangular
      const { t, offset } = this.grab;
      for (let i = 0; i <= n; i++) { const x = i / n, target = offset * (x < t ? x / t : (1 - x) / (1 - t)); y[i] += (target - y[i]) * 0.45; v[i] = 0; }
      return;
    }
    const steps = Math.min(6, Math.max(1, Math.round(dtMs / 6)));
    const extra = performance.now() < this.dampUntil ? 0.12 : 0;
    const d = 1 - this.damping - extra;
    for (let s = 0; s < steps; s++) {
      for (let i = 1; i < n; i++) v[i] = (v[i] + this.c2 * (y[i - 1] - 2 * y[i] + y[i + 1])) * d;
      for (let i = 1; i < n; i++) y[i] += v[i];
      y[0] = y[n] = 0;
    }
  }
  energy() { let e = 0; for (let i = 1; i < this.n; i++) e += Math.abs(this.y[i]); return e / this.n; }
  reset() { this.y.fill(0); this.v.fill(0); this.grab = null; }
}
