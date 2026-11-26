/**
 * Desenho dos estados de iluminação sobre os elementos do instrumento.
 * Antecipação: brilho crescente · Pulso: flash no instante exato ·
 * Sustain: luz contínua com progresso · Técnica: glifo e animação próprios ·
 * Acerto: explosão · Erro: marca discreta e nova indicação.
 * Sempre há uma forma além da cor (acessibilidade).
 */
import { TECH_GLYPH } from './lighting.js';
import { techGlyph, halo, roundRect } from '../render/draw.js';

const MISS_HUE = 8;

/** Linha (corda): a,b em px. */
export function lightLine(ctx, st, a, b, hue, opts = {}) {
  if (!st) return;
  const { reduce = false, contrast = false, shapes = true, t = performance.now() / 1000, order = null } = opts;
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
  const mid = { x: a.x + dx * 0.5, y: a.y + dy * 0.5 };
  const tech = st.cue?.tech ?? 'finger', vel = st.cue?.vel ?? 0.7;
  const L = contrast ? 92 : 70;
  const hueUse = st.phase === 'miss' ? MISS_HUE : hue;
  const line = (w, alpha, from = 0, to = 1) => { ctx.strokeStyle = `hsla(${hueUse},100%,${L}%,${alpha})`; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(a.x + dx * from, a.y + dy * from); ctx.lineTo(a.x + dx * to, a.y + dy * to); ctx.stroke(); };
  ctx.save(); ctx.lineCap = 'round';
  const velScale = tech === 'soft' || tech === 'ghost' ? 0.55 : tech === 'hard' ? 1.4 : 0.7 + vel * 0.5;
  switch (st.phase) {
    case 'anticipate': {
      const k = st.k * st.k;
      line(10 + 18 * k * velScale, 0.06 + 0.22 * k);
      line(2 + 2 * k, 0.25 + 0.55 * k);
      // transição: um ponto de luz percorre a corda chegando ao centro no instante exato
      if (!reduce) { const p = 0.5 * k; ctx.fillStyle = `hsla(${hueUse},100%,90%,${0.4 + 0.6 * k})`; for (const s of [p, 1 - p]) { ctx.beginPath(); ctx.arc(a.x + dx * s, a.y + dy * s, 2 + 3 * k, 0, 6.283); ctx.fill(); } }
      break;
    }
    case 'pulse': {
      const f = 1 - st.k * 0; line(16 * velScale, reduce ? 0.35 : 0.55); line(4, 1);
      if (!reduce) halo(ctx, mid.x, mid.y, 40 * velScale, hueUse, 0.55);
      break;
    }
    case 'sustain': case 'wait': {
      const breath = st.phase === 'wait' ? 0.55 + 0.45 * Math.sin(t * 5) : 1;
      line(12 * velScale, 0.22 * breath); line(3, 0.85 * breath);
      if (st.phase === 'sustain' && st.cue?.dur > 0.35) { ctx.strokeStyle = `hsla(${hueUse},100%,95%,0.9)`; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(a.x + dx * (1 - st.k), a.y + dy * (1 - st.k)); ctx.stroke(); }
      break;
    }
    case 'hit': line(20 * st.k, 0.35 * st.k); break;
    case 'miss': {
      ctx.setLineDash([6, 6]); line(3, 0.7 * st.k); ctx.setLineDash([]);
      techGlyph(ctx, 'cross', mid.x + nx * 22, mid.y + ny * 22, 14, MISS_HUE, st.k);
      break;
    }
    default: break;
  }
  // animações específicas de técnica
  if (st.phase === 'anticipate' || st.phase === 'pulse' || st.phase === 'sustain' || st.phase === 'wait') {
    const k = st.phase === 'anticipate' ? st.k : 1;
    const pos = st.cue?.pos ?? 0.5;
    if (!reduce) {
      if (tech === 'vibrato' || tech === 'tremolo') { ctx.strokeStyle = `hsla(${hueUse},100%,85%,${0.5 * k})`; ctx.lineWidth = 2; ctx.beginPath(); for (let i = 0; i <= 30; i++) { const s = i / 30, w = Math.sin(s * 40 + t * (tech === 'tremolo' ? 30 : 12)) * 5 * Math.sin(Math.PI * s); const x = a.x + dx * s + nx * w, y = a.y + dy * s + ny * w; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); }
      if (tech === 'pull' || tech === 'snap' || tech === 'bend' || tech === 'pop') { const off = (tech === 'bend' ? 14 : 26) * k * (0.6 + 0.4 * Math.sin(t * 4)); ctx.strokeStyle = `hsla(${hueUse},100%,85%,${0.55 * k})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(a.x + dx * pos + nx * off, a.y + dy * pos + ny * off); ctx.lineTo(b.x, b.y); ctx.stroke(); }
      if (tech === 'slide') { const s = (t * 0.8) % 1; halo(ctx, a.x + dx * s, a.y + dy * s, 12, hueUse, 0.6 * k); }
      if (tech === 'harmonic') halo(ctx, a.x + dx * 0.5, a.y + dy * 0.5, 10 + 8 * k, hueUse, 0.9 * k, 85);
    }
    if (shapes) {
      const g = TECH_GLYPH[tech] ?? 'dot';
      const gx = mid.x + nx * 26, gy = mid.y + ny * 26;
      techGlyph(ctx, g, gx, gy, 13 + 5 * velScale, hueUse, 0.4 + 0.6 * k, Math.atan2(dy, dx), t);
      if (order != null) { ctx.fillStyle = `hsla(${hueUse},100%,92%,${0.5 + 0.5 * k})`; ctx.font = '700 12px ui-rounded,system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.fillText(String(order), gx + nx * 18, gy + ny * 18 + 4); }
    }
  }
  ctx.restore();
}

/** Elemento retangular (tecla, pad, lâmina, casa do braço). */
export function lightRect(ctx, st, r, hue, opts = {}) {
  if (!st) return;
  const { reduce = false, contrast = false, shapes = true, t = performance.now() / 1000, radius = 10 } = opts;
  const tech = st.cue?.tech ?? 'finger', vel = st.cue?.vel ?? 0.7;
  const hueUse = st.phase === 'miss' ? MISS_HUE : hue, L = contrast ? 92 : 68;
  ctx.save();
  let alpha = 0, inset = 0;
  if (st.phase === 'anticipate') { alpha = 0.12 + 0.45 * st.k * st.k; inset = (1 - st.k) * Math.min(r.w, r.h) * 0.3; }
  else if (st.phase === 'pulse') alpha = reduce ? 0.6 : 0.95;
  else if (st.phase === 'sustain' || st.phase === 'wait') alpha = st.phase === 'wait' ? 0.45 + 0.3 * Math.sin(t * 5) : 0.6;
  else if (st.phase === 'hit') alpha = 0.6 * st.k;
  else if (st.phase === 'miss') alpha = 0.35 * st.k;
  ctx.fillStyle = `hsla(${hueUse},100%,${L}%,${alpha * (tech === 'soft' || tech === 'ghost' ? 0.6 : 1)})`;
  roundRect(ctx, r.x + inset, r.y + inset, r.w - inset * 2, r.h - inset * 2, radius); ctx.fill();
  ctx.strokeStyle = `hsla(${hueUse},100%,88%,${Math.min(1, alpha + 0.25)})`; ctx.lineWidth = st.phase === 'pulse' ? 3 : 2;
  if (st.phase === 'miss') ctx.setLineDash([5, 5]);
  roundRect(ctx, r.x + 1, r.y + 1, r.w - 2, r.h - 2, radius); ctx.stroke(); ctx.setLineDash([]);
  if (st.phase === 'sustain' && st.cue?.dur > 0.35) { ctx.fillStyle = `hsla(${hueUse},100%,95%,0.8)`; const hh = r.h * (1 - st.k); ctx.fillRect(r.x + 4, r.y + r.h - hh, 4, hh); }
  if (shapes && st.phase !== 'hit') {
    const g = st.phase === 'miss' ? 'cross' : TECH_GLYPH[tech] ?? 'dot';
    const s = Math.min(22, Math.min(r.w, r.h) * 0.32) * (tech === 'hard' ? 1.2 : tech === 'soft' ? 0.8 : 1) * (0.6 + 0.4 * vel);
    techGlyph(ctx, g, r.x + r.w / 2, r.y + r.h * 0.3, s, hueUse, st.phase === 'anticipate' ? 0.3 + 0.7 * st.k : 1, 0, t);
  }
  ctx.restore();
}
