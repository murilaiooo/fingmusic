/**
 * Theremin: altura contínua no eixo horizontal, volume no vertical.
 * Com assistência ligada, a altura "puxa" suavemente para as notas da escala.
 * Cada dedo é uma voz. Mudanças de nota estáveis geram eventos (para Genius/aulas).
 */
import { Surface } from './base.js';
import { clamp } from '../core/util.js';
import { inScale, snapToScale } from '../theory/music.js';
import { halo } from '../render/draw.js';

export class ThereminSurface extends Surface {
  constructor(app, inst) { super(app, inst); this.lo = 48; this.hi = 76; this.trail = []; }
  capabilities() { return ['finger', 'slide', 'vibrato', 'sustain']; }
  layout(rect) { super.layout(rect); this.rebuild(); }
  rebuild() { const b = (this.inst.layout?.base ?? 48) + this.music.octave * 12; this.lo = this.fixedNotes ? this.fixedNotes[0] - 1 : b; this.hi = this.fixedNotes ? this.fixedNotes[this.fixedNotes.length - 1] + 1 : b + 26; }
  elements() { const out = []; for (let m = this.lo; m <= this.hi; m++) if (this.fixedNotes ? this.fixedNotes.includes(m) : this.inScale(m)) out.push({ midi: m, key: null }); return out; }
  pitchAt(x) {
    const raw = this.lo + ((x - this.rect.x) / this.rect.w) * (this.hi - this.lo);
    if (!this.music.assist) return raw;
    const near = snapToScale(Math.round(raw), this.music.root, this.music.scale);
    return raw + (near - raw) * 0.75; // atração suave, ainda permite deslizar
  }
  xOf(m) { return this.rect.x + ((m - this.lo) / (this.hi - this.lo)) * this.rect.w; }
  volAt(y) { return clamp(1 - (y - this.rect.y) / this.rect.h, 0.05, 1) * 1.1; }
  down(p) {
    const pitch = this.pitchAt(p.x), base = Math.round(pitch);
    const res = this.noteOn({ midi: base, vel: this.volAt(p.y), source: p.source });
    if (res?.voice) res.voice.setBend(pitch - base, 0);
    this.ptrs.set(p.id, { res, base, stable: base, since: p.t, x: p.x, y: p.y });
  }
  move(p) {
    const st = this.ptrs.get(p.id); if (!st?.res) return;
    const pitch = this.pitchAt(p.x); st.x = p.x; st.y = p.y;
    st.res.voice?.setBend(pitch - st.base, 0.02);
    // volume contínuo pelo eixo Y
    const near = Math.round(pitch);
    if (near !== st.stable) { st.stable = near; st.since = p.t; st.reported = false; }
    else if (!st.reported && p.t - st.since > 140 && near !== st.lastReported) {
      st.reported = true; st.lastReported = near;
      const r = this.app.performer.noteOn({ midi: near, vel: this.volAt(p.y), tech: 'slide', silent: true, source: p.source });
      if (r) st.ev = r.ev;
    }
    this.trail.push({ x: p.x, y: p.y, t: performance.now() });
  }
  up(p) { const st = this.ptrs.get(p.id); if (!st) return; this.ptrs.delete(p.id); st.res?.voice?.noteOff(); if (st.res) this.noteOff(st.res.ev); }
  keyNote(i, down) {
    const ms = this.elements().map((e) => e.midi), m = ms[i]; if (m == null) return;
    const id = 'k' + i, x = this.xOf(m), y = this.rect.y + this.rect.h * 0.3;
    if (down) this.down({ id, x, y, t: performance.now(), source: 'key' }); else this.up({ id });
  }
  render(ctx) {
    const r = this.rect;
    for (let m = this.lo; m <= this.hi; m++) {
      const x = this.xOf(m), inS = this.inScale(m), root = this.isRoot(m);
      ctx.strokeStyle = root ? `hsla(${this.inst.hue},100%,80%,.45)` : inS ? 'rgba(255,255,255,.12)' : 'rgba(255,255,255,.035)';
      ctx.lineWidth = root ? 2 : 1; ctx.beginPath(); ctx.moveTo(x, r.y); ctx.lineTo(x, r.y + r.h); ctx.stroke();
      if (inS && this.app.settings.showNames) { ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.font = '600 10px ui-rounded,system-ui'; ctx.textAlign = 'center'; ctx.fillText(this.label(m).replace(/-?\d+$/, ''), x, r.y + r.h - 6); }
      this.drawLightLine(ctx, m, null, { x, y: r.y + 10 }, { x, y: r.y + r.h - 20 }, this.inst.hue + (m % 12) * 10);
    }
    const now = performance.now();
    this.trail = this.trail.filter((t) => now - t.t < 600);
    for (const t of this.trail) { const k = 1 - (now - t.t) / 600; ctx.fillStyle = `hsla(${this.inst.hue},100%,75%,${k * 0.35})`; ctx.beginPath(); ctx.arc(t.x, t.y, 3 + k * 5, 0, 6.283); ctx.fill(); }
    for (const st of this.ptrs.values()) halo(ctx, st.x, st.y, 30 + this.volAt(st.y) * 30, this.inst.hue, 0.6);
    ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.font = '600 10px ui-rounded,system-ui'; ctx.textAlign = 'left';
    ctx.fillText('↑ volume', r.x + 6, r.y + 14); ctx.textAlign = 'right'; ctx.fillText('altura →', r.x + r.w - 6, r.y + 14);
  }
}

