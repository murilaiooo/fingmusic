/**
 * Teclado para piano, piano elétrico, órgão e sintetizadores.
 *  - Força pela posição vertical na tecla (mais perto da borda = mais forte).
 *  - Deslizar lateralmente = glissando; deslizar na vertical depois de
 *    pressionar = pitch bend (sintetizadores) — "aftertouch" de tela.
 *  - Retrato: duas fileiras empilhadas (duas oitavas confortáveis).
 *  - Modo escala (assistência): só as notas da escala, teclas largas iguais.
 */
import { Surface } from './base.js';
import { roundRect } from '../render/draw.js';
import { clamp } from '../core/util.js';
import { scaleNotes } from '../theory/music.js';

const BLACK = new Set([1, 3, 6, 8, 10]);

export class KeysSurface extends Surface {
  constructor(app, inst) { super(app, inst); this.octaveShift = 0; this.keys = []; this.down_ = new Map(); this.glow = new Map(); }
  capabilities() { return ['finger', 'soft', 'hard', 'sustain', 'chord', ...(this.inst.family === 'synth' ? ['bend'] : [])]; }
  layout(rect) { super.layout(rect); this.rebuild(); }
  get scaleMode() { return this.music.assist && this.music.scale !== 'chromatic'; }

  rebuild() {
    const r = this.rect, portrait = r.h > r.w * 1.1;
    const rows = portrait ? 2 : (r.h > 420 && r.w < 900 ? 2 : 1);
    const base = (this.inst.layout?.base ?? 48) + this.music.octave * 12 + this.octaveShift * 12;
    this.keys = [];
    const gap = 8, rowH = (r.h - gap * (rows - 1)) / rows;
    for (let row = 0; row < rows; row++) {
      const y = r.y + (rows - 1 - row) * (rowH + gap); // fileira de baixo = mais grave
      let lo, hi;
      if (this.fixedNotes) { const all = this.fixedNotes; const per = Math.ceil(all.length / rows); const part = all.slice(row * per, row * per + per); lo = part[0]; hi = part[part.length - 1]; if (lo == null) continue; }
      if (this.scaleMode || this.fixedNotes) {
        const notes = this.fixedNotes ? this.fixedNotes.slice(row * Math.ceil(this.fixedNotes.length / rows), (row + 1) * Math.ceil(this.fixedNotes.length / rows))
          : scaleNotes(this.music.root, this.music.scale, base + row * 12, base + row * 12 + 12 + (rows === 1 && r.w > 700 ? 12 : 0));
        const w = r.w / notes.length;
        notes.forEach((m, i) => this.keys.push({ m, x: r.x + i * w + 2, y, w: w - 4, h: rowH, black: false, scale: true }));
      } else {
        const whitesWanted = clamp(Math.floor(r.w / (portrait ? 44 : 50)), 7, rows === 1 ? 22 : 15);
        const start = base + row * 12;
        const whites = []; for (let m = start; whites.length < whitesWanted; m++) if (!BLACK.has(((m % 12) + 12) % 12)) whites.push(m);
        const ww = r.w / whites.length;
        whites.forEach((m, i) => this.keys.push({ m, x: r.x + i * ww, y, w: ww - 2, h: rowH, black: false }));
        whites.forEach((m, i) => { if (i < whites.length - 1 && BLACK.has((m + 1) % 12)) this.keys.push({ m: m + 1, x: r.x + (i + 1) * ww - ww * 0.32, y, w: ww * 0.64, h: rowH * 0.6, black: true }); });
      }
    }
  }
  elements() { return [...new Map(this.keys.map((k) => [k.m, { midi: k.m, key: null }])).values()]; }
  keyAt(p) {
    for (const k of this.keys) if (k.black && p.x >= k.x && p.x <= k.x + k.w && p.y >= k.y && p.y <= k.y + k.h) return k;
    for (const k of this.keys) if (!k.black && p.x >= k.x && p.x <= k.x + k.w && p.y >= k.y && p.y <= k.y + k.h) return k;
    return null;
  }
  velAt(k, p) { return clamp(0.25 + ((p.y - k.y) / k.h) * 0.95, 0.15, 1.2); }
  press(k, vel, source) {
    const res = this.noteOn({ midi: k.m, vel, tech: vel < 0.38 ? 'soft' : vel > 0.95 ? 'hard' : null, pan: ((k.x - this.rect.x) / this.rect.w - 0.5) * 0.6, source });
    this.glow.set(k.m, performance.now());
    this.pulse(vel * 0.4);
    if (this.quality >= 1) this.app.particles.burst(k.x + k.w / 2, k.y + 10, (this.inst.hue + (k.m % 12) * 8) % 360, 6, 0.5);
    return res;
  }
  release(st) { if (!st?.res) return; st.res.voice?.noteOff(); this.noteOff(st.res.ev); }
  down(p) {
    const k = this.keyAt(p); if (!k) return;
    this.ptrs.set(p.id, { k, res: this.press(k, this.velAt(k, p), p.source), y0: p.y });
  }
  move(p) {
    const st = this.ptrs.get(p.id); if (!st) return;
    const k = this.keyAt(p);
    if (k && k !== st.k && Math.abs(p.y - st.y0) < st.k.h * 0.35 + 30) { // glissando
      this.release(st); st.k = k; st.res = this.press(k, 0.7, p.source); st.y0 = p.y; return;
    }
    if (this.inst.family === 'synth' && st.res?.voice) {
      const semis = clamp((st.y0 - p.y) / (st.k.h * 0.5), -1, 1) * 2;
      st.res.voice.setBend(semis, 0.03);
      if (Math.abs(semis) > 0.6 && !st.bendSent) { st.bendSent = true; this.app.performer.technique(st.res.ev, 'bend', semis); }
    }
  }
  up(p) { const st = this.ptrs.get(p.id); if (!st) return; this.ptrs.delete(p.id); this.release(st); }
  keyNote(i, down, vel = 0.8) {
    const uniq = [...new Set(this.keys.map((k) => k.m))].sort((a, b) => a - b).filter((m) => this.scaleMode || this.fixedNotes || this.inScale(m));
    const m = uniq[i]; if (m == null) return;
    const k = this.keys.find((x) => x.m === m);
    const id = 'key' + i;
    if (down) this.ptrs.set(id, { k, res: this.press(k, vel, 'key'), y0: 0 }); else this.up({ id });
  }
  shiftOctave(d) { this.octaveShift = clamp(this.octaveShift + d, -2, 2); this.rebuild(); }

  render(ctx) {
    const now = performance.now(), held = new Set([...this.ptrs.values()].map((s) => s.k?.m));
    for (const pass of [false, true]) for (const k of this.keys) {
      if (k.black !== pass) continue;
      const hue = (this.inst.hue + (k.m % 12) * 8) % 360;
      const g = this.glow.get(k.m), recent = g ? Math.max(0, 1 - (now - g) / 500) : 0;
      const on = held.has(k.m);
      const root = this.isRoot(k.m), inS = this.inScale(k.m);
      ctx.save();
      roundRect(ctx, k.x + 1, k.y, k.w - 2, k.h, k.black ? 7 : 10);
      if (k.black) ctx.fillStyle = on ? `hsla(${hue},90%,55%,.9)` : 'rgba(18,20,34,.96)';
      else ctx.fillStyle = on ? `hsla(${hue},90%,62%,.5)` : k.scale ? `hsla(${hue},45%,${root ? 26 : 18}%,.9)` : `rgba(235,238,255,${this.music.showScale && !inS ? 0.06 : 0.12})`;
      ctx.fill();
      ctx.strokeStyle = on || recent ? `hsla(${hue},100%,80%,${0.5 + recent * 0.5})` : k.black ? 'rgba(255,255,255,.08)' : 'rgba(255,255,255,.14)';
      ctx.lineWidth = on ? 2 : 1; ctx.stroke();
      if (recent > 0) { ctx.fillStyle = `hsla(${hue},100%,75%,${recent * 0.35})`; ctx.fill(); }
      ctx.restore();
      if (root) { ctx.fillStyle = `hsla(${hue},100%,80%,.8)`; ctx.beginPath(); ctx.arc(k.x + k.w / 2, k.y + k.h - 14, 4, 0, 6.283); ctx.fill(); }
      if (this.app.settings.showNames && (!k.black || k.w > 28)) { ctx.fillStyle = k.black ? 'rgba(255,255,255,.55)' : 'rgba(255,255,255,.6)'; ctx.font = '600 10px ui-rounded,system-ui'; ctx.textAlign = 'center'; ctx.fillText(this.label(k.m).replace(/-?\d+$/, ''), k.x + k.w / 2, k.y + k.h - 26); }
      this.drawLightRect(ctx, k.m, null, k, hue, k.black ? 7 : 10);
    }
  }
}
