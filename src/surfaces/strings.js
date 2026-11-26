/**
 * Cordas de luz livres — a assinatura do Fingmusic (harpa, koto, sitar,
 * synth pluck, instrumentos personalizados e Playground).
 *
 * Gestos:
 *  - deslizar atravessando cordas: dedilhado/strum (velocidade = força,
 *    ponto de cruzamento = timbre);
 *  - tocar e soltar rápido: nota;
 *  - tocar, segurar e puxar para o lado: acumula tensão; soltar = ataque
 *    proporcional ao quanto foi puxado (+ "snap" com força máxima);
 *  - encostar e manter o dedo parado numa corda que soa: abafa;
 *  - várias cordas ao mesmo tempo com vários dedos (multitouch).
 */
import { Surface } from './base.js';
import { StringModel } from '../physics/string.js';
import { glowStroke, polyPath } from '../render/draw.js';
import { degreeToMidi, snapToScale } from '../theory/music.js';
import { segCross, pointSegment, clamp, dist } from '../core/util.js';
import { getInstrument } from '../instruments/catalog.js';

const K = 36;
let sid = 0;

export class StringsSurface extends Surface {
  constructor(app, inst, opts = {}) {
    super(app, inst);
    this.strings = [];
    this.custom = opts.custom ?? null; // [{a:{x,y}, b:{x,y}, midi, hue?, inst?}] em coordenadas normalizadas
    this.tool = 'play'; // play | draw | edit
    this.selected = null;
    this.toys = opts.toys ?? false; // Playground: orbes com gravidade
    this.orbs = []; this.emitters = [];
    this.xs = new Float32Array(K + 1); this.ys = new Float32Array(K + 1);
  }

  layout(rect) { super.layout(rect); this.rebuild(); }

  notesForLayout() {
    if (this.fixedNotes) return this.fixedNotes;
    const L = this.inst.layout ?? { base: 48, count: 11 };
    const portrait = this.rect.h > this.rect.w;
    const maxBySpace = Math.max(5, Math.floor((portrait || L.orient === 'vertical' ? this.rect.w : this.rect.h) / 30));
    const count = Math.min(L.count ?? 11, maxBySpace);
    const scale = this.music.scale;
    const base = (L.base ?? 48) + this.music.octave * 12;
    return Array.from({ length: count }, (_, i) => degreeToMidi(i, this.music.root, scale, base));
  }

  rebuild() {
    const old = new Map(this.strings.map((s) => [s.key, s]));
    const r = this.rect;
    this.strings = [];
    if (this.custom) {
      for (const c of this.custom) this._addString({ x: r.x + c.a.x * r.w, y: r.y + c.a.y * r.h }, { x: r.x + c.b.x * r.w, y: r.y + c.b.y * r.h }, c.midi, c, old);
      return;
    }
    const notes = this.notesForLayout(), n = notes.length;
    const orient = this.inst.layout?.orient === 'vertical' || r.h > r.w * 1.05 ? 'vertical' : 'horizontal';
    this.orient = orient;
    notes.forEach((m, i) => {
      const t = n > 1 ? i / (n - 1) : 0.5;
      let a, b;
      if (orient === 'vertical') {
        const pad = Math.min(36, r.w * 0.07), x = r.x + pad + (r.w - pad * 2) * t;
        a = { x, y: r.y + r.h * (0.04 + 0.26 * t) }; b = { x, y: r.y + r.h * (0.97 - 0.04 * t) };
      } else {
        const pad = Math.min(30, r.h * 0.07), y = r.y + r.h - pad - (r.h - pad * 2) * t;
        a = { x: r.x + r.w * (0.05 + 0.18 * t), y }; b = { x: r.x + r.w * (0.97 - 0.03 * t), y };
      }
      this._addString(a, b, m, null, old);
    });
  }
  _addString(a, b, midi, custom, old) {
    const key = 'n' + midi + (custom ? ':' + this.strings.length : '');
    const prev = old?.get(key);
    const s = prev ?? { id: ++sid, model: new StringModel(K), born: performance.now(), last: 0, pulses: [] };
    Object.assign(s, { key, a, b, midi, custom, len: dist(a, b), hue: custom?.hue ?? this.hueFor(midi), inst: custom?.inst ? getInstrument(custom.inst) : null });
    s.model.setPitch(midi);
    this.strings.push(s);
  }
  hueFor(m) { return (this.inst.hue + (m - 48) * 6 + 360) % 360; }
  spacing() { return this.strings.length > 1 ? Math.min(...this.strings.slice(1).map((s, i) => dist(s.a, this.strings[i].a) || 999), 80) : 60; }

  elements() { return this.strings.map((s) => ({ midi: s.midi, key: null, string: s })); }
  capabilities() { return ['finger', 'soft', 'hard', 'pull', 'chord', 'sustain']; }

  hit(p, extra = 0) {
    const radius = Math.max(16, this.spacing() * 0.45) + extra;
    let best = null;
    for (const s of this.strings) {
      const { d, t } = pointSegment(p, s.a, s.b);
      if (t > 0.015 && t < 0.985 && d < radius && (!best || d < best.d)) best = { s, d, t };
    }
    return best;
  }

  // ───────────── produzir som
  pluck(s, vel, t, { tech = null, dir = 1, source = 'touch', pointer = null } = {}) {
    const now = performance.now();
    if (now - s.last < 40 && tech !== 'pull' && tech !== 'snap') return null;
    s.last = now;
    if (s.ev) this.noteOff(s.ev);
    const p = { x: s.a.x + (s.b.x - s.a.x) * t, y: s.a.y + (s.b.y - s.a.y) * t };
    const res = this.noteOn({ midi: s.midi, vel, pos: Math.min(t, 1 - t) * 2 * 0.5, tech: tech ?? (vel < 0.38 ? 'soft' : vel > 0.95 ? 'hard' : null), pan: ((p.x - this.rect.x) / this.rect.w) * 2 - 1, source, target: s.key, inst: s.inst });
    if (!res) { s.model.pluck(t, 4 * dir); return null; }
    s.ev = res.ev; s.voice = res.voice; s.ringUntil = now + 2500;
    s.model.pluck(t, (8 + vel * 22) * dir);
    const q = this.quality;
    this.app.particles.burst(p.x, p.y, s.hue, Math.round((6 + vel * 26) * (q >= 2 ? 1 : q === 1 ? 0.5 : 0.25)), 0.6 + vel);
    if (q >= 1) s.pulses.push({ t, dir: 1, e: vel }, { t, dir: -1, e: vel });
    this.pulse(vel * 0.6);
    return res;
  }

  // ───────────── ponteiros
  down(p) {
    if (this.tool === 'draw') { this.ptrs.set(p.id, { mode: 'draw', a: { x: p.x, y: p.y }, b: { x: p.x, y: p.y } }); return; }
    if (this.tool === 'edit') { this.editDown(p); return; }
    if (this.toys && !this.hit(p)) { this.addEmitter(p); return; }
    const h = this.hit(p);
    const st = { mode: h ? 'touch' : 'strum', s: h?.s, t: h?.t ?? 0, last: { x: p.x, y: p.y, t: p.t }, start: { x: p.x, y: p.y, t: p.t }, moved: 0, offset: 0, ticks: 0, vHist: [] };
    this.ptrs.set(p.id, st);
  }
  move(p) {
    const st = this.ptrs.get(p.id); if (!st) return;
    if (st.mode === 'draw') { st.b = { x: p.x, y: p.y }; return; }
    if (st.mode === 'drag-end') { this.editMove(st, p); return; }
    const dt = Math.max(1, p.t - st.last.t), seg = dist(st.last, p);
    st.moved += seg;
    st.vHist.push({ v: seg / dt, t: p.t }); if (st.vHist.length > 5) st.vHist.shift();
    if (st.mode === 'touch' || st.mode === 'pull') {
      const s = st.s, dx = s.b.x - s.a.x, dy = s.b.y - s.a.y, len = s.len || 1;
      const nx = -dy / len, ny = dx / len;
      const off = (p.x - (s.a.x + dx * st.t)) * nx + (p.y - (s.a.y + dy * st.t)) * ny;
      const maxPull = Math.min(130, Math.max(46, Math.min(this.rect.w, this.rect.h) * 0.22));
      if (st.mode === 'touch' && Math.abs(off) > 9) { st.mode = 'pull'; if (s.ev && s.voice?.alive) { s.voice.kill(0.06); } }
      if (st.mode === 'touch' && dist(st.start, p) > 28) { st.mode = 'strum'; }
      if (st.mode === 'pull') {
        st.offset = clamp(off, -maxPull, maxPull); st.max = maxPull;
        s.model.hold(st.t, st.offset);
        const k = Math.abs(st.offset) / maxPull, tick = Math.floor(k * 4);
        if (tick > st.ticks) { st.ticks = tick; this.pulse(0.15 + k * 0.4); }
        if (k > 0.6 && Math.random() < k * 0.35 * (this.quality ? 1 : 0.3)) {
          const gp = { x: s.a.x + dx * st.t + nx * st.offset, y: s.a.y + dy * st.t + ny * st.offset };
          this.app.particles.burst(gp.x, gp.y, s.hue, 1, 0.4);
        }
      }
    }
    if (st.mode === 'strum') this.strum(st.last, p, dt, p.source, p.id);
    st.last = { x: p.x, y: p.y, t: p.t };
  }
  up(p) {
    const st = this.ptrs.get(p.id); if (!st) return;
    this.ptrs.delete(p.id);
    if (p.cancel) { if (st.s?.model.grab) st.s.model.release(); return; }
    if (st.mode === 'draw') { this.finishDraw(st); return; }
    if (st.mode === 'drag-end') { this.editUp(st); return; }
    const s = st.s, held = p.t - st.start.t;
    if (st.mode === 'pull') {
      const off = s.model.release(), k = Math.abs(off) / (st.max || 80);
      const rel = st.vHist.length ? Math.max(...st.vHist.map((x) => x.v)) : 0;
      if (k < 0.08) return;
      const vel = clamp(0.22 + k * 1.0 + rel * 0.05, 0.15, 1.35);
      const tech = k > 0.85 ? 'snap' : 'pull';
      const res = this.pluck(s, vel, st.t, { tech, dir: -Math.sign(off), source: p.source });
      s.model.y.set(s.model.y); // forma triangular já aplicada por release()
      const gp = { x: s.a.x + (s.b.x - s.a.x) * st.t, y: s.a.y + (s.b.y - s.a.y) * st.t };
      if (res) {
        this.app.particles.ring(gp.x, gp.y, s.hue, k);
        this.app.particles.burst(gp.x, gp.y, s.hue, Math.round(k * 40 * (this.quality ? 1 : 0.4)), 1 + k * 1.4);
        if (k > 0.7) this.app.fx?.flash(s.hue, k);
        this.pulse(0.5 + k * 0.5);
      }
      return;
    }
    if (st.mode === 'touch') {
      if (held < 240 && st.moved < 12) this.pluck(s, 0.6, st.t, { source: p.source });
      else if (s.voice?.alive) { s.voice.kill(0.09); s.model.damp(); if (s.ev) { this.noteOff(s.ev); s.ev = null; } }
    }
  }
  /** Pontas dos dedos da câmera (sem pinça) atravessando cordas. */
  hover(p) {
    const st = this.ptrs.get(p.id);
    if (!st || st.mode !== 'hover') { this.ptrs.set(p.id, { mode: 'hover', last: { x: p.x, y: p.y, t: p.t } }); return; }
    this.strum(st.last, p, Math.max(1, p.t - st.last.t), 'hand', p.id);
    st.last = { x: p.x, y: p.y, t: p.t };
  }
  hoverEnd(id) { this.ptrs.delete(id); }

  strum(a, b, dt, source, pid) {
    const seg = dist(a, b); if (seg < 2.5) return;
    const vel = this.velFromSpeed(seg / dt);
    const held = new Set([...this.ptrs.values()].filter((x) => x.mode === 'pull').map((x) => x.s));
    for (const s of this.strings) {
      if (held.has(s)) continue;
      const t = segCross(a, b, s.a, s.b);
      if (t >= 0) { const dx = s.b.x - s.a.x, dy = s.b.y - s.a.y; const side = Math.sign((b.x - a.x) * -dy + (b.y - a.y) * dx) || 1; this.pluck(s, vel, t, { dir: side, source }); }
    }
  }

  keyNote(i, down, vel = 0.8) { if (!down) return; const s = this.strings[i]; if (s) this.pluck(s, vel, 0.5, { source: 'key' }); }

  // ───────────── modo criação (instrumentos personalizados)
  finishDraw(st) {
    const len = dist(st.a, st.b); if (len < 36) return;
    const r = this.rect, diag = Math.hypot(r.w, r.h);
    const k = clamp((len / diag - 0.05) / 0.7, 0, 1);
    const midi = snapToScale(Math.round(84 - k * 36), this.music.root, this.music.scale);
    const c = { a: { x: (st.a.x - r.x) / r.w, y: (st.a.y - r.y) / r.h }, b: { x: (st.b.x - r.x) / r.w, y: (st.b.y - r.y) / r.h }, midi, hue: null, inst: null };
    if (!this.custom) this.custom = [];
    this.custom.push(c); this.rebuild();
    const s = this.strings[this.strings.length - 1];
    this.pluck(s, 0.6, 0.5);
    this.app.emit('custom-change', this.custom);
  }
  editDown(p) {
    // arrastar extremidade ou selecionar corda
    for (const s of this.strings) for (const end of ['a', 'b']) if (dist(p, s[end]) < 26) { this.ptrs.set(p.id, { mode: 'drag-end', s, end }); this.select(s); return; }
    const h = this.hit(p, 6);
    this.select(h?.s ?? null);
    if (h) this.ptrs.set(p.id, { mode: 'drag-end', s: h.s, end: 'both', last: { x: p.x, y: p.y } });
  }
  editMove(st, p) {
    const r = this.rect, s = st.s, c = s.custom; if (!c) return;
    if (st.end === 'both') { const dx = (p.x - st.last.x) / r.w, dy = (p.y - st.last.y) / r.h; c.a.x += dx; c.a.y += dy; c.b.x += dx; c.b.y += dy; st.last = { x: p.x, y: p.y }; }
    else { c[st.end] = { x: clamp((p.x - r.x) / r.w, 0, 1), y: clamp((p.y - r.y) / r.h, 0, 1) }; }
    this.rebuild(); this.selected = this.strings.find((x) => x.custom === c) ?? null;
  }
  editUp() { this.app.emit('custom-change', this.custom); }
  select(s) { this.selected = s; this.app.emit('string-select', s ? { index: this.strings.indexOf(s), custom: s.custom } : null); }

  // ───────────── Playground: emissores de orbes com gravidade
  addEmitter(p) {
    if (this.emitters.length >= 6) this.emitters.shift();
    const hue = (this.inst.hue + this.emitters.length * 47) % 360;
    this.emitters.push({ x: p.x, y: p.y, hue, every: [1, 2, 0.5][this.emitters.length % 3], next: null });
    this.app.emit('toy-change', this.emitters.length);
  }
  clearToys() { this.emitters = []; this.orbs = []; this.app.emit('toy-change', 0); }
  stepToys(dt) {
    const tr = this.app.transport;
    if (this.emitters.length && tr.playing) {
      const beat = tr.beatNow();
      for (const e of this.emitters) {
        const n = Math.floor(beat / e.every);
        if (e.next == null) e.next = n + 1;
        if (n >= e.next) { e.next = n + 1; this.orbs.push({ x: e.x + (Math.random() - 0.5) * 4, y: e.y, vx: (Math.random() - 0.5) * 0.02, vy: 0, hue: e.hue, life: 9000, cool: new Map() }); }
      }
    }
    const g = 0.0009 * (this.app.settings.gravity ?? 1);
    for (const o of this.orbs) {
      const px = o.x, py = o.y;
      o.vy += g * dt; o.x += o.vx * dt; o.y += o.vy * dt; o.life -= dt;
      for (const s of this.strings) {
        const t = segCross({ x: px, y: py }, { x: o.x, y: o.y }, s.a, s.b);
        if (t < 0 || (o.cool.get(s) ?? 0) > performance.now()) continue;
        o.cool.set(s, performance.now() + 120);
        const dx = s.b.x - s.a.x, dy = s.b.y - s.a.y, len = s.len || 1, nx = -dy / len, ny = dx / len;
        const vn = o.vx * nx + o.vy * ny, speed = Math.hypot(o.vx, o.vy);
        o.vx -= 1.75 * vn * nx; o.vy -= 1.75 * vn * ny; // quica com perda
        o.x = px; o.y = py;
        this.pluck(s, clamp(0.25 + speed * 1.6, 0.2, 1.1), t, { dir: Math.sign(vn) || 1, source: 'toy' });
      }
    }
    this.orbs = this.orbs.filter((o) => o.life > 0 && o.y < this.rect.y + this.rect.h + 40 && o.x > -40 && o.x < this.rect.x + this.rect.w + 40);
    if (this.orbs.length > 60) this.orbs.splice(0, this.orbs.length - 60);
  }

  // ───────────── desenho
  render(ctx, now, dt) {
    if (this.toys) this.stepToys(dt);
    const q = this.quality, showNames = this.app.settings.showNames;
    const order = this.app.lighting.cues.length ? null : null;
    for (const s of this.strings) {
      s.model.step(dt);
      const m = s.model, dx = s.b.x - s.a.x, dy = s.b.y - s.a.y, len = s.len || 1, nx = -dy / len, ny = dx / len;
      for (let i = 0; i <= K; i++) { const t = i / K; this.xs[i] = s.a.x + dx * t + nx * m.y[i]; this.ys[i] = s.a.y + dy * t + ny * m.y[i]; }
      const e = Math.min(1, m.energy() / 4);
      const grabbed = m.grab ? Math.min(1, Math.abs(m.grab.offset) / 90) : 0;
      const fadeIn = Math.min(1, (now - s.born) / 300);
      const sel = this.selected === s;
      const alpha = (0.55 + 0.45 * Math.max(e, grabbed)) * fadeIn;
      const width = (1.4 + e * 1.2 - grabbed * 0.5) * (sel ? 1.6 : 1);
      // luz de aprendizado por baixo da corda
      this.drawLightLine(ctx, s.midi, s.key, s.a, s.b, s.hue);
      glowStroke(ctx, polyPath(ctx, this.xs, this.ys, K + 1), s.hue, alpha, width, q, 60 + grabbed * 20, 95 - grabbed * 40);
      // pinos e fundamental
      ctx.fillStyle = `hsla(${s.hue},100%,85%,${0.85 * fadeIn})`;
      for (const p of [s.a, s.b]) { ctx.beginPath(); ctx.arc(p.x, p.y, 2.6, 0, 6.283); ctx.fill(); }
      if (this.isRoot(s.midi)) { ctx.strokeStyle = `hsla(${s.hue},100%,85%,.7)`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(s.b.x, s.b.y, 7, 0, 6.283); ctx.stroke(); }
      if (showNames) {
        ctx.font = '600 11px ui-rounded,system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = `hsla(${s.hue},90%,85%,.8)`;
        const vert = Math.abs(dy) > Math.abs(dx);
        ctx.fillText(this.label(s.midi), vert ? s.b.x : s.a.x - 16, vert ? s.b.y + 17 : s.a.y + 4);
      }
      // tensão: medidor circular no ponto puxado
      if (m.grab) {
        const gx = s.a.x + dx * m.grab.t + nx * m.grab.offset, gy = s.a.y + dy * m.grab.t + ny * m.grab.offset;
        ctx.strokeStyle = `hsla(${s.hue},100%,${70 + grabbed * 25}%,.9)`; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(gx, gy, 18, -Math.PI / 2, -Math.PI / 2 + grabbed * 6.283); ctx.stroke();
        ctx.fillStyle = `hsla(${s.hue},100%,90%,${0.3 + grabbed * 0.6})`; ctx.beginPath(); ctx.arc(gx, gy, 5 + grabbed * 5, 0, 6.283); ctx.fill();
      }
      // pulsos de luz correndo pela corda
      for (const p of s.pulses) {
        p.t += p.dir * 0.0011 * dt * (0.6 + p.e);
        if (p.t < 0 || p.t > 1) { p.dead = true; continue; }
        const i = Math.round(p.t * K);
        ctx.fillStyle = `hsla(${s.hue},100%,92%,${0.8 * (1 - Math.abs(p.t - 0.5))})`;
        ctx.beginPath(); ctx.arc(this.xs[i], this.ys[i], 2.5 + p.e * 2.5, 0, 6.283); ctx.fill();
      }
      if (s.pulses.length) s.pulses = s.pulses.filter((p) => !p.dead);
    }
    // prévia de desenho
    for (const st of this.ptrs.values()) if (st.mode === 'draw' && dist(st.a, st.b) > 6) {
      const r = this.rect, diag = Math.hypot(r.w, r.h), k = clamp((dist(st.a, st.b) / diag - 0.05) / 0.7, 0, 1);
      const midi = snapToScale(Math.round(84 - k * 36), this.music.root, this.music.scale), hue = this.hueFor(midi);
      glowStroke(ctx, () => { ctx.beginPath(); ctx.moveTo(st.a.x, st.a.y); ctx.lineTo(st.b.x, st.b.y); }, hue, 0.9, 1.6, q);
      ctx.font = '700 13px ui-rounded,system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = `hsl(${hue},90%,85%)`;
      ctx.fillText(this.label(midi), (st.a.x + st.b.x) / 2, (st.a.y + st.b.y) / 2 - 14);
    }
    if (this.tool === 'edit') for (const s of this.strings) for (const p of [s.a, s.b]) { ctx.strokeStyle = this.selected === s ? '#fff' : 'rgba(255,255,255,.35)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(p.x, p.y, 10, 0, 6.283); ctx.stroke(); }
    // orbes e emissores
    for (const e of this.emitters) { ctx.strokeStyle = `hsla(${e.hue},100%,75%,.8)`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(e.x, e.y, 9, 0, 6.283); ctx.stroke(); ctx.fillStyle = `hsla(${e.hue},100%,75%,.25)`; ctx.fill(); }
    for (const o of this.orbs) { ctx.fillStyle = `hsla(${o.hue},100%,80%,.95)`; ctx.beginPath(); ctx.arc(o.x, o.y, 4.5, 0, 6.283); ctx.fill(); }
    void order;
  }
}
