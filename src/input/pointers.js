/**
 * Entrada unificada: Pointer Events (toque, mouse, caneta) e teclado.
 * Multitouch completo; pressão real quando o dispositivo informa.
 */
export function bindPointers(el, sink) {
  const active = new Set();
  const P = (e, extra = {}) => ({ id: 'p' + e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), source: e.pointerType === 'mouse' ? 'mouse' : e.pointerType === 'pen' ? 'pen' : 'touch', pressure: e.pressure, ...extra });
  el.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    try { el.setPointerCapture(e.pointerId); } catch { /* */ }
    active.add(e.pointerId); sink.down(P(e)); e.preventDefault();
  }, { passive: false });
  el.addEventListener('pointermove', (e) => {
    if (!active.has(e.pointerId)) return;
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const c of evs.length ? evs : [e]) sink.move(P(c, { id: 'p' + e.pointerId, source: e.pointerType === 'mouse' ? 'mouse' : e.pointerType === 'pen' ? 'pen' : 'touch' }));
  });
  const end = (cancel) => (e) => { if (!active.has(e.pointerId)) return; active.delete(e.pointerId); sink.up(P(e, { cancel })); };
  el.addEventListener('pointerup', end(false));
  el.addEventListener('pointercancel', end(true));
  el.addEventListener('lostpointercapture', end(false));
  el.addEventListener('contextmenu', (e) => e.preventDefault());
}

const ROW1 = ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'ç', ';', "'"];
const ROW2 = ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'];
/** Teclado do computador: duas fileiras de notas + atalhos. */
export function bindKeyboard(app) {
  const held = new Map();
  const idxOf = (k) => { const a = ROW1.indexOf(k); if (a >= 0) return a; const b = ROW2.indexOf(k); return b >= 0 ? 10 + b : -1; };
  addEventListener('keydown', (e) => {
    if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName) || e.target.isContentEditable) return;
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); e.shiftKey ? app.studio.redo() : app.studio.undo(); return; }
    if (e.ctrlKey || e.metaKey) return;
    if (k === ' ') { e.preventDefault(); app.emit('shortcut', 'playpause'); return; }
    if (e.repeat) return;
    if (k === 'z' || k === 'x') { app.emit('shortcut', k === 'z' ? 'octave-down' : 'octave-up'); return; }
    if (k === 'm') { app.emit('shortcut', 'metronome'); return; }
    if (k === '.') { app.emit('shortcut', 'record'); return; }
    if (/^[1-7]$/.test(k)) { app.emit('shortcut', 'chord:' + (Number(k) - 1)); return; }
    const i = idxOf(k); if (i < 0) return;
    // não captura teclas quando um elemento da interface (botão) tem foco e o usuário navega
    app.engine.unlock();
    const vel = e.shiftKey ? 1.1 : e.altKey ? 0.4 : 0.78;
    held.set(k, i); app.surface?.keyNote(i, true, vel);
    e.preventDefault();
  });
  addEventListener('keyup', (e) => { const k = e.key.toLowerCase(); if (held.has(k)) { app.surface?.keyNote(held.get(k), false); held.delete(k); } });
  addEventListener('blur', () => { for (const [k, i] of held) app.surface?.keyNote(i, false); held.clear(); });
}
