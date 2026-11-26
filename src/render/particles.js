/**
 * Sistema de partículas com pool fixo (typed arrays): zero alocação por
 * quadro, limite ajustado pela qualidade gráfica.
 */
export class Particles {
  constructor(max = 900) {
    this.max = max; this.limit = max; this.n = 0;
    const F = () => new Float32Array(max);
    this.x = F(); this.y = F(); this.vx = F(); this.vy = F(); this.life = F(); this.decay = F(); this.hue = F(); this.size = F(); this.kind = new Uint8Array(max);
  }
  setLimit(l) { this.limit = Math.min(this.max, l); if (this.n > this.limit) this.n = this.limit; }
  spawn(x, y, vx, vy, hue, life = 1, size = 2, kind = 0) {
    let i = this.n;
    if (i >= this.limit) i = (Math.random() * this.limit) | 0; else this.n++;
    this.x[i] = x; this.y[i] = y; this.vx[i] = vx; this.vy[i] = vy; this.life[i] = 1; this.decay[i] = 1 / (life * 1000); this.hue[i] = hue; this.size[i] = size; this.kind[i] = kind;
  }
  burst(x, y, hue, count, power = 1, spread = Math.PI * 2, dir = 0) {
    for (let k = 0; k < count; k++) {
      const a = dir + (Math.random() - 0.5) * spread, sp = (0.05 + Math.random() * 0.25) * power;
      this.spawn(x, y, Math.cos(a) * sp, Math.sin(a) * sp - 0.03 * power, hue + (Math.random() * 30 - 15), 0.5 + Math.random() * 0.6, 1.2 + Math.random() * 1.8, Math.random() < 0.25 ? 1 : 0);
    }
  }
  /** Anel de choque (kind 2): expande e some. */
  ring(x, y, hue, power = 1) { this.spawn(x, y, 0, 0, hue, 0.45 + power * 0.25, 6 + power * 10, 2); }
  update(dt) {
    let w = 0;
    for (let i = 0; i < this.n; i++) {
      const l = this.life[i] - this.decay[i] * dt;
      if (l <= 0) continue;
      if (this.kind[i] !== 2) { this.vy[i] += 0.00035 * dt; this.vx[i] *= 0.992; this.vy[i] *= 0.992; this.x[i] += this.vx[i] * dt; this.y[i] += this.vy[i] * dt; }
      else this.size[i] += dt * 0.12;
      if (w !== i) { this.x[w] = this.x[i]; this.y[w] = this.y[i]; this.vx[w] = this.vx[i]; this.vy[w] = this.vy[i]; this.decay[w] = this.decay[i]; this.hue[w] = this.hue[i]; this.size[w] = this.size[i]; this.kind[w] = this.kind[i]; }
      this.life[w] = l; w++;
    }
    this.n = w;
  }
  draw(ctx, reduce = false) {
    ctx.lineCap = 'round';
    for (let i = 0; i < this.n; i++) {
      const l = this.life[i], h = this.hue[i] | 0;
      if (this.kind[i] === 2) {
        ctx.strokeStyle = `hsla(${h},100%,75%,${l * (reduce ? 0.25 : 0.6)})`; ctx.lineWidth = 1.5 + l * 2;
        ctx.beginPath(); ctx.arc(this.x[i], this.y[i], this.size[i], 0, 6.283); ctx.stroke();
      } else if (this.kind[i] === 1) {
        ctx.fillStyle = `hsla(${h},100%,85%,${l})`;
        ctx.beginPath(); ctx.arc(this.x[i], this.y[i], this.size[i] * l, 0, 6.283); ctx.fill();
      } else {
        ctx.strokeStyle = `hsla(${h},100%,72%,${l})`; ctx.lineWidth = this.size[i] * 0.9;
        ctx.beginPath(); ctx.moveTo(this.x[i], this.y[i]); ctx.lineTo(this.x[i] - this.vx[i] * 26, this.y[i] - this.vy[i] * 26); ctx.stroke();
      }
    }
  }
}
