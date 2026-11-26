/**
 * Braço com trastes para violões, guitarras, ukulele, cavaquinho e baixos.
 * Duas zonas, pensadas para as duas mãos:
 *  - Braço (trastes): pressione as casas. Com a corda soando, pressionar uma
 *    casa faz hammer-on; soltar com outra casa presa faz pull-off; arrastar ao
 *    longo da corda faz slide; empurrar para o lado faz bend; balançar = vibrato.
 *  - Zona de toque (perto da ponte): toque para dedilhar (ou slap, nos baixos
 *    slap), puxe e solte para pop/estalo, deslize atravessando para strum.
 *  - Botões momentâneos: Abafar (palm mute) e Harm. (harmônicos); "Tap" liga o
 *    tapping (casas soam sozinhas).
 * Orientação: horizontal em paisagem (graves em cima), vertical em retrato.
 */
import { Surface } from './base.js';
import { StringModel } from '../physics/string.js';
import { glowStroke, polyPath, roundRect } from '../render/draw.js';
import { clamp, dist } from '../core/util.js';
import { inScale } from '../theory/music.js';

const K = 28;

export class FretboardSurface extends Surface {
  constructor(app, inst) {
    super(app, inst);
    this.tuning = inst.layout.tuning;
    this.position = 0; // primeira casa visível
    this.mods = { mute: false, harm: false, tap: false };
    this.fretless = !!inst.fretless;
    this.strs = this.tuning.map((m, i) => ({ i, open: m, frets: new Map(), model: new StringModel(K), voice: null, ev: null, last: 0, hue: (inst.hue + i * 9) % 360 }));
    this.strs.forEach((s) => s.model.setPitch(s.open));
    this.xs = new Float32Array(K + 1); this.ys = new Float32Array(K + 1);
  }
  get isBass() { return this.inst.family === 'bass'; }
  capabilities() { return ['finger', 'soft', 'hard', 'pull', 'mute', 'harmonic', 'hammer', 'slide', 'bend', 'vibrato', 'chord', ...(this.inst.tech === 'slap' || this.inst.tech === 'pop' ? ['slap', 'pop'] : [])]; }

  layout(rect) {
    super.layout(rect);
    this.land = rect.w >= rect.h;
    this.L = this.land ? rect.w : rect.h;
    this.Wd = this.land ? rect.h : rect.w;
    this.fretEnd = this.L * (this.land ? 0.68 : 0.64);
    this.nutW = Math.min(34, this.L * 0.05);
    this.frets = clamp(Math.floor((this.fretEnd - this.nutW) / (this.land ? 50 : 56)), 4, 12);
    this.fretW = (this.fretEnd - this.nutW) / this.frets;
    this.pluckStart = this.fretEnd + this.L * 0.025;
    this.bridge = this.L * 0.975;
    const n = this.strs.length, margin = Math.min(this.Wd * 0.12, 48);
    this.spacing = (this.Wd - margin * 2) / Math.max(1, n - 1);
    this.strs.forEach((s, k) => { s.v = margin + k * this.spacing; });
  }
  P(u, v) { const r = this.rect; return this.land ? { x: r.x + u, y: r.y + v } : { x: r.x + v, y: r.y + u }; }
  U(p) { const r = this.rect; return this.land ? { u: p.x - r.x, v: p.y - r.y } : { u: p.y - r.y, v: p.x - r.x }; }
  maxFret() { return this.position + this.frets; }
  fretAtU(u) { return u < this.nutW ? 0 : this.position + (u - this.nutW) / this.fretW + (this.fretless ? 0.5 : 0); }
  uOfFret(f) { return f <= this.position ? this.nutW * 0.5 : this.nutW + (f - this.position - 0.5) * this.fretW; }
  nearestString(v) { let best = null; for (const s of this.strs) { const d = Math.abs(s.v - v); if (!best || d < best.d) best = { s, d }; } return best && best.d < this.spacing * 0.62 ? best.s : null; }
  effFret(s) { let f = 0; for (const x of s.frets.values()) f = Math.max(f, x.fret); return f; }
  midiAt(s, fret) { return s.open + (this.fretless ? fret : Math.round(fret)); }
  sounding(s) { return s.voice?.alive && performance.now() - s.last < 3200; }

  elements() {
    const out = [];
    for (const s of this.strs) for (let f = this.position; f <= this.maxFret(); f++) out.push({ midi: s.open + f, key: `s${s.i}f${f}` });
    return out;
  }
  /** Melhor posição (corda, casa) para uma nota, perto da anterior. */
  keyFor(midi, prevKey = null) {
    const prev = prevKey ? /s(\d+)f(\d+)/.exec(prevKey) : null;
    let best = null;
    for (const s of this.strs) {
      const f = midi - s.open;
      if (f < 0 || f > Math.max(this.maxFret(), 12)) continue;
      const cost = (f > this.maxFret() || (f < this.position && f !== 0) ? 50 : 0) + f * 0.6 + (prev ? Math.abs(s.i - +prev[1]) * 1.5 + Math.abs(f - +prev[2]) * 0.8 : 0);
      if (!best || cost < best.cost) best = { cost, key: `s${s.i}f${f}` };
    }
    return best?.key ?? null;
  }

  // ───────────── som
  pluckString(s, vel, { tech = null, pos = null, source = 'touch', dir = 1 } = {}) {
    const fret = this.effFret(s);
    const midi = this.midiAt(s, Math.floor(fret + 1e-6));
    const frac = this.fretless ? fret - Math.floor(fret + 1e-6) : 0;
    let t = tech;
    if (this.mods.mute) t = 'mute'; else if (this.mods.harm) t = 'harmonic';
    if (s.ev) this.noteOff(s.ev);
    const res = this.noteOn({ midi, vel, tech: t ?? (vel < 0.38 ? 'soft' : vel > 0.95 ? 'hard' : null), pos, pan: (s.i / (this.strs.length - 1 || 1) - 0.5) * 0.4, source, target: `s${s.i}f${Math.round(fret)}` });
    s.last = performance.now();
    s.model.pluck(0.5, (6 + vel * 14) * dir, 0.18);
    if (!res) return null;
    s.voice = res.voice; s.ev = res.ev; s.voiceMidi = midi; s.bend = 0;
    if (frac && s.voice) s.voice.setBend(frac, 0);
    const bp = this.P((this.pluckStart + this.bridge) / 2, s.v);
    this.app.particles.burst(bp.x, bp.y, s.hue, Math.round((5 + vel * 18) * (this.quality ? 1 : 0.3)), 0.5 + vel);
    this.pulse(vel * 0.6);
    return res;
  }
  /** Muda a altura da nota soando (hammer-on, pull-off, slide, bend). */
  repitch(s, tech, glide) {
    if (!this.sounding(s)) return false;
    const fret = this.effFret(s), target = s.open + fret + (s.bend ?? 0);
    s.voice.setBend(target - s.voiceMidi, glide);
    const rounded = s.open + Math.round(fret);
    if (tech && rounded !== s.lastReported) {
      s.lastReported = rounded;
      const r = this.noteOn({ midi: rounded, vel: 0.5, tech, silent: true, source: 'touch', target: `s${s.i}f${Math.round(fret)}` });
      if (r) s.ev = r.ev;
    }
    s.model.pluck(0.5, 3, 0.3);
    return true;
  }

  // ───────────── ponteiros
  down(p) {
    const { u, v } = this.U(p);
    const s = this.nearestString(v);
    if (u >= this.pluckStart - 10) {
      this.ptrs.set(p.id, { zone: 'pluck', mode: s ? 'touch' : 'strum', s, start: { u, v, t: p.t }, last: { x: p.x, y: p.y, t: p.t }, plucked: new Set(), vHist: [] });
      return;
    }
    if (!s || u > this.fretEnd) return;
    const f = u < this.nutW ? 0 : this.fretless ? clamp(this.fretAtU(u), 0, this.maxFret()) : clamp(Math.ceil(this.fretAtU(u)), this.position + 1, this.maxFret());
    const st = { zone: 'fret', s, fret: f, start: { u, v, t: p.t }, axis: null, revs: 0, lastDv: 0, lastSign: 0, revT: [] };
    this.ptrs.set(p.id, st);
    s.frets.set(p.id, st);
    if (this.sounding(s)) {
      s.lastReported = null;
      this.repitch(s, 'hammer', 0.006);
      this.pulse(0.25);
    } else if (this.mods.tap) {
      this.pluckString(s, 0.55, { tech: 'hammer' });
      s.lastReported = s.voiceMidi;
    }
  }
  move(p) {
    const st = this.ptrs.get(p.id); if (!st) return;
    const { u, v } = this.U(p);
    if (st.zone === 'fret') {
      const s = st.s, du = u - st.start.u, dv = v - st.start.v;
      if (!st.axis && Math.hypot(du, dv) > 10) st.axis = Math.abs(du) > Math.abs(dv) * 1.2 ? 'along' : 'across';
      if (st.axis === 'along') {
        // slide
        const f = this.fretless ? clamp(this.fretAtU(u), 0, this.maxFret()) : clamp(Math.ceil(this.fretAtU(u)), this.position + 1, this.maxFret());
        if (f !== st.fret) { st.fret = f; this.repitch(s, 'slide', this.fretless ? 0.02 : 0.045); }
      } else if (st.axis === 'across') {
        const maxB = this.isBass ? 1 : 2;
        s.bend = clamp(Math.abs(dv) / this.spacing * 1.6, 0, maxB);
        this.repitch(s, null, 0.03);
        const sign = Math.sign(dv - st.lastDv);
        if (sign && sign !== st.lastSign && Math.abs(dv - st.lastDv) > 1) { st.revT.push(p.t); st.lastSign = sign; }
        st.lastDv = dv;
        st.revT = st.revT.filter((t) => p.t - t < 1200);
        if (s.ev && this.sounding(s)) {
          if (st.revT.length >= 3 && !st.vibSent) { st.vibSent = true; this.app.performer.technique(s.ev, 'vibrato'); }
          else if (s.bend > 0.6 && !st.bendSent) { st.bendSent = true; this.app.performer.technique(s.ev, 'bend', s.bend); }
        }
      }
      return;
    }
    // zona de toque
    const dt = Math.max(1, p.t - st.last.t), seg = dist(st.last, p);
    st.vHist.push(seg / dt); if (st.vHist.length > 5) st.vHist.shift();
    const dv = v - st.start.v;
    if (st.mode === 'touch') {
      if (Math.abs(dv) > this.spacing * 0.55) { st.mode = 'strum'; this.pluckString(st.s, this.velFromSpeed(seg / dt), { source: p.source, dir: Math.sign(dv) }); st.plucked.add(st.s); }
      else if (Math.abs(dv) > 9) st.mode = 'pull';
    }
    if (st.mode === 'pull') {
      st.offset = clamp(dv, -this.spacing * 0.5, this.spacing * 0.5);
      st.s.model.hold(0.5, st.offset * 0.8);
    }
    if (st.mode === 'strum') {
      const a = this.U(st.last);
      for (const s of this.strs) {
        if ((a.v - s.v) * (v - s.v) < 0 && !st.plucked.has(s)) { st.plucked.add(s); this.pluckString(s, this.velFromSpeed(seg / dt), { source: p.source, dir: Math.sign(v - a.v) }); }
      }
      // permite ida e volta no strum
      if (st.plucked.size === this.strs.length || Math.sign(v - a.v) !== st.dir) { if (Math.sign(v - a.v)) { st.dir = Math.sign(v - a.v); st.plucked = new Set(); } }
    }
    st.last = { x: p.x, y: p.y, t: p.t };
  }
  up(p) {
    const st = this.ptrs.get(p.id); if (!st) return;
    this.ptrs.delete(p.id);
    if (st.zone === 'fret') {
      const s = st.s; s.frets.delete(p.id);
      s.bend = 0;
      if (p.cancel) return;
      if (this.sounding(s)) {
        if (s.frets.size) { s.lastReported = null; this.repitch(s, 'hammer', 0.006); } // pull-off
        else { s.voice.kill(0.07); s.model.damp(); if (s.ev) this.noteOff(s.ev); s.ev = null; }
      }
      return;
    }
    if (p.cancel || !st.s) { st.s?.model.release(); return; }
    const s = st.s;
    if (st.mode === 'pull') {
      const off = s.model.release(), k = Math.abs(off) / (this.spacing * 0.4);
      if (k < 0.12) return;
      const vel = clamp(0.3 + k * 0.9, 0.2, 1.3);
      const slappy = this.inst.tech === 'slap' || this.inst.tech === 'pop';
      this.pluckString(s, vel, { tech: slappy ? 'pop' : k > 0.85 ? 'snap' : 'pull', source: p.source, dir: -Math.sign(off) });
      const bp = this.P((this.pluckStart + this.bridge) / 2, s.v); this.app.particles.ring(bp.x, bp.y, s.hue, k);
    } else if (st.mode === 'touch' && p.t - st.start.t < 400) {
      const pressure = p.pressure && p.pressure !== 0.5 ? p.pressure : null;
      const vel = pressure ? clamp(0.2 + pressure, 0.2, 1.2) : 0.75;
      // posição do toque dentro da zona muda o timbre (perto da ponte = mais brilhante)
      const pos = clamp((this.bridge - st.start.u) / (this.bridge - this.pluckStart), 0.05, 1) * 0.35;
      this.pluckString(s, vel, { pos, source: p.source });
    }
  }
  hover(p) {
    // pontas dos dedos da câmera atravessando as cordas na zona de toque
    const { u, v } = this.U(p);
    const prev = this.ptrs.get(p.id);
    if (!prev || prev.mode !== 'hover') { this.ptrs.set(p.id, { mode: 'hover', last: { u, v, t: p.t } }); return; }
    if (u > this.pluckStart - 20) for (const s of this.strs) if ((prev.last.v - s.v) * (v - s.v) < 0) this.pluckString(s, this.velFromSpeed(Math.abs(v - prev.last.v) / Math.max(1, p.t - prev.last.t)), { source: 'hand' });
    prev.last = { u, v, t: p.t };
  }
  hoverEnd(id) { this.ptrs.delete(id); }

  keyNote(i, down, vel = 0.8) {
    if (!down) return;
    const ms = this.elements().map((e) => e.midi).filter((m) => inScale(m, this.music.root, this.music.scale));
    const uniq = [...new Set(ms)].sort((a, b) => a - b), midi = uniq[i];
    if (midi == null) return;
    const key = this.keyFor(midi), m = /s(\d+)f(\d+)/.exec(key); if (!m) return;
    const s = this.strs[+m[1]], f = +m[2];
    const fake = 'k' + i; s.frets.set(fake, { fret: f });
    this.pluckString(s, vel, { source: 'key' });
    setTimeout(() => s.frets.delete(fake), 300);
  }
  shiftPosition(d) { this.position = clamp(this.position + d, 0, 12); }

  // ───────────── desenho
  render(ctx, now, dt) {
    const q = this.quality, r = this.rect;
    const P = (u, v) => this.P(u, v);
    // braço
    const a0 = P(0, this.strs[0].v - this.spacing * 0.6), a1 = P(this.fretEnd, this.strs[this.strs.length - 1].v + this.spacing * 0.6);
    ctx.fillStyle = 'rgba(255,255,255,0.025)';
    const nx = Math.min(a0.x, a1.x), ny = Math.min(a0.y, a1.y);
    roundRect(ctx, nx, ny, Math.abs(a1.x - a0.x), Math.abs(a1.y - a0.y), 14); ctx.fill();
    // zona de toque
    const z0 = P(this.pluckStart, this.strs[0].v - this.spacing * 0.6), z1 = P(this.bridge, this.strs[this.strs.length - 1].v + this.spacing * 0.6);
    const zg = ctx.createLinearGradient(z0.x, z0.y, this.land ? z1.x : z0.x, this.land ? z0.y : z1.y);
    zg.addColorStop(0, `hsla(${this.inst.hue},80%,60%,0.03)`); zg.addColorStop(1, `hsla(${this.inst.hue},80%,60%,0.11)`);
    ctx.fillStyle = zg; roundRect(ctx, Math.min(z0.x, z1.x), Math.min(z0.y, z1.y), Math.abs(z1.x - z0.x), Math.abs(z1.y - z0.y), 16); ctx.fill();
    if (this.mods.mute) { ctx.fillStyle = 'rgba(255,255,255,0.07)'; const m0 = P(this.bridge - 26, this.strs[0].v - this.spacing * 0.6), m1 = P(this.bridge, this.strs[this.strs.length - 1].v + this.spacing * 0.6); ctx.fillRect(Math.min(m0.x, m1.x), Math.min(m0.y, m1.y), Math.abs(m1.x - m0.x), Math.abs(m1.y - m0.y)); }
    // trastes
    ctx.lineWidth = 1.5;
    for (let k = 0; k <= this.frets; k++) {
      const u = this.nutW + k * this.fretW, p0 = P(u, this.strs[0].v - this.spacing * 0.45), p1 = P(u, this.strs[this.strs.length - 1].v + this.spacing * 0.45);
      ctx.strokeStyle = k === 0 && this.position === 0 ? 'rgba(255,255,255,.55)' : this.fretless ? 'rgba(255,255,255,.07)' : 'rgba(255,255,255,.16)';
      ctx.lineWidth = k === 0 && this.position === 0 ? 4 : 1.5;
      ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
    }
    // marcações e números de casa
    ctx.font = '600 10px ui-rounded,system-ui'; ctx.textAlign = 'center';
    for (let k = 1; k <= this.frets; k++) {
      const f = this.position + k, u = this.nutW + (k - 0.5) * this.fretW, mid = (this.strs[0].v + this.strs[this.strs.length - 1].v) / 2;
      if ([3, 5, 7, 9, 15, 17].includes(f % 24) || f === 12) {
        ctx.fillStyle = 'rgba(255,255,255,.10)';
        if (f === 12) for (const o of [-1, 1]) { const c = P(u, mid + o * this.spacing); ctx.beginPath(); ctx.arc(c.x, c.y, 5, 0, 6.283); ctx.fill(); }
        else { const c = P(u, mid); ctx.beginPath(); ctx.arc(c.x, c.y, 5, 0, 6.283); ctx.fill(); }
      }
      const lp = P(u, this.strs[this.strs.length - 1].v + this.spacing * 0.75);
      ctx.fillStyle = 'rgba(255,255,255,.32)'; ctx.fillText(String(f), lp.x, lp.y + 4);
    }
    // notas da escala no braço (assistência)
    const showScale = this.music.showScale;
    for (const s of this.strs) {
      for (let k = 0; k <= this.frets; k++) {
        const f = k === 0 ? 0 : this.position + k, midi = s.open + f;
        const u = k === 0 ? this.nutW * 0.5 : this.nutW + (k - 0.5) * this.fretW, c = P(u, s.v);
        const root = this.isRoot(midi);
        if (showScale && inScale(midi, this.music.root, this.music.scale)) {
          ctx.fillStyle = root ? `hsla(${this.inst.hue},100%,80%,.55)` : 'rgba(255,255,255,.13)';
          ctx.beginPath(); ctx.arc(c.x, c.y, root ? 6 : 3.5, 0, 6.283); ctx.fill();
          if (this.app.settings.showNames && (root || this.fretW > 40)) { ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.font = '600 9px ui-rounded,system-ui'; ctx.fillText(this.label(midi).replace(/-?\d+$/, ''), c.x, c.y - 9); }
        }
        // iluminação por casa
        const key = `s${s.i}f${f}`;
        const cellW = k === 0 ? this.nutW : this.fretW;
        const st = this.light(midi, key);
        if (st) {
          const c0 = this.land ? { x: c.x - cellW / 2 + 3, y: c.y - this.spacing * 0.42, w: cellW - 6, h: this.spacing * 0.84 } : { x: c.x - this.spacing * 0.42, y: c.y - cellW / 2 + 3, w: this.spacing * 0.84, h: cellW - 6 };
          this.drawLightRect(ctx, midi, key, c0, s.hue, 10);
          // a zona de toque da mesma corda também acende
          this.drawLightLine(ctx, midi, key, P(this.pluckStart, s.v), P(this.bridge, s.v), s.hue);
        }
      }
    }
    // cordas (parte vibrante: da casa presa até a ponte)
    for (const s of this.strs) {
      s.model.step(dt);
      const fret = this.effFret(s), u0 = fret > 0 ? this.uOfFret(Math.round(fret)) + (this.fretless ? 0 : this.fretW * 0.45) : 0;
      const e = Math.min(1, s.model.energy() / 3);
      const thick = (this.isBass ? 2.8 : 1.8) - s.i * (this.isBass ? 0.35 : 0.2);
      // trecho morto antes da casa
      if (u0 > 0) { const p0 = P(0, s.v), p1 = P(u0, s.v); ctx.strokeStyle = `hsla(${s.hue},40%,70%,.25)`; ctx.lineWidth = thick; ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke(); }
      const bendOff = (s.bend ?? 0) * this.spacing * 0.35;
      for (let i = 0; i <= K; i++) {
        const t = i / K, u = u0 + (this.bridge - u0) * t, dv = s.model.y[i] + bendOff * Math.sin(Math.PI * Math.min(1, t * 2.5));
        const pt = P(u, s.v + dv); this.xs[i] = pt.x; this.ys[i] = pt.y;
      }
      glowStroke(ctx, polyPath(ctx, this.xs, this.ys, K + 1), s.hue, 0.55 + 0.45 * e, thick * (1 + e * 0.4), q);
    }
    // dedos
    for (const st of this.ptrs.values()) {
      if (st.zone !== 'fret') continue;
      const c = P(this.uOfFret(Math.round(st.fret)) + (st.fret > 0 ? 0 : 0), st.s.v + (st.s.bend ?? 0) * this.spacing * 0.35);
      ctx.fillStyle = `hsla(${st.s.hue},100%,80%,.35)`; ctx.beginPath(); ctx.arc(c.x, c.y, 15, 0, 6.283); ctx.fill();
      ctx.strokeStyle = `hsla(${st.s.hue},100%,88%,.9)`; ctx.lineWidth = 2; ctx.stroke();
    }
    void r;
  }
}
