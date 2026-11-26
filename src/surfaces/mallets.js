/**
 * Lâminas (marimba, vibrafone), dentes de kalimba e sinos.
 * Força pela posição do golpe: centro da lâmina = mais forte e encorpado.
 */
import { Surface } from './base.js';
import { roundRect, halo } from '../render/draw.js';
import { clamp } from '../core/util.js';
import { degreeToMidi } from '../theory/music.js';

export class MalletsSurface extends Surface {
  constructor(app, inst) { super(app, inst); this.bars = []; this.hits = new Map(); }
  layout(rect) { super.layout(rect); this.rebuild(); }
  capabilities() { return ['finger', 'soft', 'hard', 'tremolo']; }
  notes() {
    if (this.fixedNotes) return this.fixedNotes;
    const L = this.inst.layout, portrait = this.rect.h > this.rect.w;
    const count = Math.min(L.count ?? 12, Math.max(7, Math.floor((portrait ? this.rect.h : this.rect.w) / 42)));
    return Array.from({ length: count }, (_, i) => degreeToMidi(i, this.music.root, this.music.scale, (L.base ?? 60) + this.music.octave * 12));
  }
  rebuild() {
    const r = this.rect, notes = this.notes(), n = notes.length, arrange = this.inst.layout?.arrange;
    this.bars = [];
    if (arrange === 'kalimba') {
      // centro grave, alternando para os lados (como uma kalimba real)
      const order = []; notes.forEach((m, i) => { if (i % 2 === 0) order.push(m); else order.unshift(m); });
      const w = r.w / order.length;
      order.forEach((m, i) => { const rank = notes.indexOf(m) / Math.max(1, n - 1); const h = r.h * (0.95 - 0.5 * rank); this.bars.push({ m, x: r.x + i * w + 3, y: r.y, w: w - 6, h, shape: 'tine' }); });
    } else if (arrange === 'bells') {
      const cols = Math.ceil(Math.sqrt(n * r.w / r.h)), rows = Math.ceil(n / cols), cw = r.w / cols, ch = r.h / rows;
      notes.forEach((m, i) => { const c = i % cols, ro = Math.floor(i / cols); const rad = Math.min(cw, ch) * (0.46 - 0.12 * i / n); this.bars.push({ m, x: r.x + c * cw + cw / 2 - rad, y: r.y + (rows - 1 - ro) * ch + ch / 2 - rad, w: rad * 2, h: rad * 2, shape: 'bell' }); });
    } else {
      const portrait = r.h > r.w;
      notes.forEach((m, i) => {
        const t = i / Math.max(1, n - 1);
        if (portrait) { const h = r.h / n; const w = r.w * (0.98 - 0.35 * t); this.bars.push({ m, x: r.x + (r.w - w) / 2, y: r.y + r.h - (i + 1) * h + 3, w, h: h - 6, shape: 'bar' }); }
        else { const w = r.w / n; const h = r.h * (0.98 - 0.35 * t); this.bars.push({ m, x: r.x + i * w + 3, y: r.y + (r.h - h) / 2, w: w - 6, h, shape: 'bar' }); }
      });
    }
  }
  elements() { return this.bars.map((b) => ({ midi: b.m, key: null })); }
  barAt(p) { return this.bars.find((b) => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h); }
  strike(b, p, source) {
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    const off = b.shape === 'tine' ? (b.y + b.h - p.y) / b.h : Math.hypot((p.x - cx) / (b.w / 2), (p.y - cy) / (b.h / 2)) / 1.4;
    const vel = clamp(1.05 - off * 0.6, 0.2, 1.15);
    const res = this.noteOn({ midi: b.m, vel, tech: vel < 0.4 ? 'soft' : vel > 0.95 ? 'hard' : null, pan: ((cx - this.rect.x) / this.rect.w - 0.5) * 0.8, source });
    this.hits.set(b.m, { t: performance.now(), x: p.x, y: p.y, v: vel });
    this.app.particles.ring(p.x, p.y, this.hue(b.m), vel * 0.6);
    this.pulse(vel * 0.5);
    return res;
  }
  hue(m) { return (this.inst.hue + (m % 24) * 7) % 360; }
  down(p) { const b = this.barAt(p); if (b) this.ptrs.set(p.id, { b, res: this.strike(b, p, p.source) }); }
  move(p) { const st = this.ptrs.get(p.id); if (!st) return; const b = this.barAt(p); if (b && b !== st.b) { st.b = b; st.res = this.strike(b, p, p.source); } }
  up(p) { const st = this.ptrs.get(p.id); if (st) { this.ptrs.delete(p.id); if (st.res) this.noteOff(st.res.ev); } }
  keyNote(i, down) { if (!down) return; const sorted = [...this.bars].sort((a, b) => a.m - b.m), b = sorted[i]; if (b) this.strike(b, { x: b.x + b.w / 2, y: b.y + b.h / 2 }, 'key'); }
  render(ctx) {
    const now = performance.now();
    for (const b of this.bars) {
      const hue = this.hue(b.m), h = this.hits.get(b.m), k = h ? Math.max(0, 1 - (now - h.t) / 700) : 0;
      const wob = k * 3 * Math.sin((now - (h?.t ?? 0)) / 22);
      ctx.save();
      if (b.shape === 'bell') { ctx.beginPath(); ctx.arc(b.x + b.w / 2, b.y + b.h / 2, b.w / 2 + wob, 0, 6.283); }
      else roundRect(ctx, b.x, b.y + (b.shape === 'bar' ? wob : 0), b.w, b.h, b.shape === 'tine' ? b.w / 2 : 12);
      const gr = ctx.createLinearGradient(b.x, b.y, b.x, b.y + b.h);
      gr.addColorStop(0, `hsla(${hue},70%,${30 + k * 30}%,.85)`); gr.addColorStop(1, `hsla(${hue},70%,${16 + k * 20}%,.85)`);
      ctx.fillStyle = gr; ctx.fill();
      ctx.strokeStyle = `hsla(${hue},100%,80%,${0.25 + k * 0.6})`; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.restore();
      if (k > 0 && h) halo(ctx, h.x, h.y, 30 * h.v, hue, k * 0.6);
      if (this.isRoot(b.m)) { ctx.fillStyle = `hsla(${hue},100%,85%,.85)`; ctx.beginPath(); ctx.arc(b.x + b.w / 2, b.y + b.h - 12, 4, 0, 6.283); ctx.fill(); }
      if (this.app.settings.showNames) { ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.font = '600 10px ui-rounded,system-ui'; ctx.textAlign = 'center'; ctx.fillText(this.label(b.m).replace(/-?\d+$/, ''), b.x + b.w / 2, b.y + 16); }
      this.drawLightRect(ctx, b.m, null, b, hue, b.shape === 'tine' ? b.w / 2 : 12);
    }
  }
}
