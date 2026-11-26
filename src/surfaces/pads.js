/**
 * Pads de bateria. Força pela distância ao centro do pad; "Repetir" (note
 * repeat) dispara o pad segurado em semicolcheias sincronizadas ao BPM.
 */
import { Surface } from './base.js';
import { roundRect } from '../render/draw.js';
import { clamp } from '../core/util.js';
import { KITS } from '../audio/drums.js';

export class PadsSurface extends Surface {
  constructor(app, inst) { super(app, inst); this.pads = []; this.hits = new Map(); this.repeat = false; this.repeatDiv = 0.25; }
  get kit() { return KITS[this.inst.kit] ?? KITS.electro; }
  layout(rect) { super.layout(rect); this.rebuild(); }
  capabilities() { return ['finger', 'soft', 'hard']; }
  rebuild() {
    const r = this.rect, lanes = this.fixedNotes ? this.kit.lanes.filter((l) => this.fixedNotes.includes(l.m)) : this.kit.lanes;
    const portrait = r.h > r.w, cols = portrait ? 3 : lanes.length > 8 ? 6 : 4, rows = Math.ceil(lanes.length / cols);
    const gap = 10, w = (r.w - gap * (cols - 1)) / cols, h = (r.h - gap * (rows - 1)) / rows;
    this.pads = lanes.map((l, i) => ({ lane: l, m: l.m, x: r.x + (i % cols) * (w + gap), y: r.y + (rows - 1 - Math.floor(i / cols)) * (h + gap), w, h }));
  }
  elements() { return this.pads.map((p) => ({ midi: p.m, key: null })); }
  padAt(p) { return this.pads.find((d) => p.x >= d.x && p.x <= d.x + d.w && p.y >= d.y && p.y <= d.y + d.h); }
  hit(pad, p, source, velOverride) {
    const cx = pad.x + pad.w / 2, cy = pad.y + pad.h / 2, off = Math.hypot((p.x - cx) / (pad.w / 2), (p.y - cy) / (pad.h / 2)) / 1.414;
    const vel = velOverride ?? clamp(1.1 - off * 0.75, 0.25, 1.1);
    const res = this.noteOn({ midi: pad.m, vel, tech: vel < 0.45 ? 'soft' : vel > 0.95 ? 'hard' : null, source });
    this.hits.set(pad.m, { t: performance.now(), v: vel });
    this.pulse(vel * 0.6);
    if (this.quality >= 1) this.app.particles.burst(p.x, p.y, this.hueOf(pad), 8, 0.7 * vel);
    return res;
  }
  hueOf(pad) { const c = pad.lane.color; const n = parseInt(c.slice(1), 16); const r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); if (mx === mn) return 220; let h = mx === r ? (g - b) / (mx - mn) : mx === g ? 2 + (b - r) / (mx - mn) : 4 + (r - g) / (mx - mn); return ((h * 60) + 360) % 360; }
  down(p) {
    const pad = this.padAt(p); if (!pad) return;
    const res = this.hit(pad, p, p.source);
    const st = { pad, res, p };
    if (this.repeat) {
      // repetição sincronizada ao relógio musical
      const tr = this.app.transport, eng = this.app.engine;
      st.timer = setInterval(() => {
        const beat = tr.playing ? tr.beatNow() : (eng.now * (tr.bpm / 60));
        const step = Math.floor(beat / this.repeatDiv);
        if (step !== st.lastStep) { st.lastStep = step; if (st.lastStep != null && st.started) this.hit(pad, st.p, p.source, res?.ev?.vel * 0.85); st.started = true; }
      }, 8);
    }
    this.ptrs.set(p.id, st);
  }
  move(p) { const st = this.ptrs.get(p.id); if (st) st.p = p; }
  up(p) { const st = this.ptrs.get(p.id); if (!st) return; clearInterval(st.timer); this.ptrs.delete(p.id); if (st.res) this.noteOff(st.res.ev); }
  keyNote(i, down, vel = 0.9) { if (!down) return; const pad = this.pads[i]; if (pad) this.hit(pad, { x: pad.x + pad.w / 2, y: pad.y + pad.h / 2 }, 'key', vel); }
  render(ctx) {
    const now = performance.now();
    for (const pad of this.pads) {
      const hue = this.hueOf(pad), h = this.hits.get(pad.m), k = h ? Math.max(0, 1 - (now - h.t) / 260) : 0;
      const s = k * 4;
      roundRect(ctx, pad.x + s, pad.y + s, pad.w - s * 2, pad.h - s * 2, 16);
      ctx.fillStyle = `hsla(${hue},70%,${14 + k * 40}%,.9)`; ctx.fill();
      ctx.strokeStyle = `hsla(${hue},100%,75%,${0.3 + k * 0.7})`; ctx.lineWidth = 1.5 + k * 2; ctx.stroke();
      ctx.fillStyle = `rgba(255,255,255,${0.55 + k * 0.45})`; ctx.font = '700 13px ui-rounded,system-ui'; ctx.textAlign = 'center';
      ctx.fillText(pad.lane.short, pad.x + pad.w / 2, pad.y + pad.h / 2 + 2);
      ctx.fillStyle = 'rgba(255,255,255,.38)'; ctx.font = '500 10px ui-rounded,system-ui';
      if (pad.h > 70) ctx.fillText(pad.lane.name, pad.x + pad.w / 2, pad.y + pad.h / 2 + 18);
      this.drawLightRect(ctx, pad.m, null, pad, hue, 16);
    }
  }
}
