/** Primitivas de desenho com brilho, ajustadas pela qualidade gráfica. */
export function glowStroke(ctx, path, hue, alpha, width, quality = 2, light = 62, sat = 95) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (quality >= 2) { ctx.strokeStyle = `hsla(${hue},${sat}%,${light}%,${0.09 * alpha})`; ctx.lineWidth = width * 9; path(); ctx.stroke(); }
  if (quality >= 1) { ctx.strokeStyle = `hsla(${hue},${sat}%,${light + 4}%,${0.28 * alpha})`; ctx.lineWidth = width * 3.4; path(); ctx.stroke(); }
  ctx.strokeStyle = `hsla(${hue},100%,${Math.min(96, light + 26)}%,${alpha})`; ctx.lineWidth = width; path(); ctx.stroke();
}
export function polyPath(ctx, xs, ys, n) { return () => { ctx.beginPath(); ctx.moveTo(xs[0], ys[0]); for (let i = 1; i < n; i++) ctx.lineTo(xs[i], ys[i]); }; }

export function halo(ctx, x, y, r, hue, alpha, light = 70) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `hsla(${hue},100%,${light + 15}%,${alpha})`); g.addColorStop(1, `hsla(${hue},100%,${light}%,0)`);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill();
}

export function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

/**
 * Glifo de técnica (indicação que não depende de cor). (x,y) = centro.
 * kinds: dot, ring-small, burst, arrow-out, bar, hook, line, wave, arrow-along, arc, cross, diamond, dots, chevron
 */
export function techGlyph(ctx, kind, x, y, s, hue, alpha, angle = 0, t = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
  ctx.strokeStyle = `hsla(${hue},100%,88%,${alpha})`; ctx.fillStyle = ctx.strokeStyle; ctx.lineWidth = Math.max(1.5, s * 0.16); ctx.lineCap = 'round';
  const b = () => ctx.beginPath();
  switch (kind) {
    case 'ring-small': b(); ctx.arc(0, 0, s * 0.35, 0, 6.283); ctx.stroke(); break;
    case 'burst': for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; b(); ctx.moveTo(Math.cos(a) * s * 0.3, Math.sin(a) * s * 0.3); ctx.lineTo(Math.cos(a) * s * 0.75, Math.sin(a) * s * 0.75); ctx.stroke(); } b(); ctx.arc(0, 0, s * 0.22, 0, 6.283); ctx.fill(); break;
    case 'arrow-out': b(); ctx.moveTo(0, -s * 0.2); ctx.lineTo(0, s * 0.75); ctx.moveTo(-s * 0.3, s * 0.45); ctx.lineTo(0, s * 0.75); ctx.lineTo(s * 0.3, s * 0.45); ctx.stroke(); b(); ctx.arc(0, -s * 0.35, s * 0.16, 0, 6.283); ctx.fill(); break;
    case 'bar': ctx.fillRect(-s * 0.55, -s * 0.14, s * 1.1, s * 0.28); break;
    case 'hook': b(); ctx.moveTo(-s * 0.3, s * 0.5); ctx.lineTo(-s * 0.3, -s * 0.2); ctx.quadraticCurveTo(-s * 0.3, -s * 0.6, s * 0.2, -s * 0.6); ctx.moveTo(s * 0.05, -s * 0.8); ctx.lineTo(s * 0.3, -s * 0.6); ctx.lineTo(s * 0.05, -s * 0.4); ctx.stroke(); break;
    case 'line': b(); ctx.moveTo(-s * 0.6, 0); ctx.lineTo(s * 0.6, 0); ctx.stroke(); break;
    case 'wave': b(); for (let i = 0; i <= 16; i++) { const xx = -s * 0.7 + i * s * 1.4 / 16, yy = Math.sin(i / 16 * Math.PI * 3 + t * 8) * s * 0.25; i ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); } ctx.stroke(); break;
    case 'arrow-along': b(); ctx.moveTo(-s * 0.7, 0); ctx.lineTo(s * 0.7, 0); ctx.moveTo(s * 0.4, -s * 0.28); ctx.lineTo(s * 0.7, 0); ctx.lineTo(s * 0.4, s * 0.28); ctx.stroke(); break;
    case 'arc': b(); ctx.arc(0, s * 0.6, s * 0.75, -Math.PI * 0.85, -Math.PI * 0.15); ctx.stroke(); b(); ctx.moveTo(s * 0.35, -s * 0.25); ctx.lineTo(s * 0.62, -s * 0.02); ctx.stroke(); break;
    case 'cross': b(); ctx.moveTo(-s * 0.4, -s * 0.4); ctx.lineTo(s * 0.4, s * 0.4); ctx.moveTo(s * 0.4, -s * 0.4); ctx.lineTo(-s * 0.4, s * 0.4); ctx.stroke(); break;
    case 'diamond': b(); ctx.moveTo(0, -s * 0.55); ctx.lineTo(s * 0.4, 0); ctx.lineTo(0, s * 0.55); ctx.lineTo(-s * 0.4, 0); ctx.closePath(); ctx.stroke(); break;
    case 'dots': for (let i = -1; i <= 1; i++) { b(); ctx.arc(i * s * 0.4, 0, s * 0.13, 0, 6.283); ctx.fill(); } break;
    case 'chevron': b(); ctx.moveTo(-s * 0.4, s * 0.25); ctx.lineTo(0, -s * 0.25); ctx.lineTo(s * 0.4, s * 0.25); ctx.stroke(); break;
    default: b(); ctx.arc(0, 0, s * 0.3, 0, 6.283); ctx.fill();
  }
  ctx.restore();
}
