/**
 * Bottom sheet (retrato) / painel lateral (paisagem), com alça de arrastar,
 * fundo que fecha ao tocar e foco acessível. Não cobre o instrumento inteiro.
 */
import { h, icon } from './dom.js';

const stack = [];
export function openSheet({ title, content, onClose, size = 'md', id = null, actions = null, footer = null }) {
  if (id) { const ex = stack.find((s) => s.id === id); if (ex) ex.close(); }
  const previousFocus = document.activeElement;
  const backdrop = h('div.sheet-backdrop', { onclick: () => api.close() });
  const body = h('div.sheet-body');
  const handle = h('div.sheet-handle', { 'aria-hidden': 'true' });
  const head = h('header.sheet-head', {}, h('h2', {}, title), actions, h('button.btn.icon-only', { type: 'button', 'aria-label': 'Fechar', onclick: () => api.close() }, icon('close')));
  const panel = h('section.sheet.sheet-' + size, { role: 'dialog', 'aria-modal': 'true', 'aria-label': title, tabindex: -1 }, handle, head, body, footer ? h('div.sheet-footer', {}, footer) : null);
  const root = h('div.sheet-root', {}, backdrop, panel);
  document.body.append(root);
  requestAnimationFrame(() => { if (!api.closed) { root.classList.add('open'); panel.focus({ preventScroll: true }); } });
  const api = {
    id, root, body, panel,
    set(c) { body.replaceChildren(...[c].flat().filter(Boolean)); },
    close() {
      if (api.closed) return; api.closed = true;
      root.classList.remove('open');
      root.style.pointerEvents = 'none';
      root.inert = true;
      setTimeout(() => root.remove(), 260);
      const index = stack.indexOf(api);
      if (index >= 0) stack.splice(index, 1);
      refreshModals();
      if (previousFocus?.isConnected && !previousFocus.closest('[inert]')) previousFocus.focus({ preventScroll: true });
      else stack.at(-1)?.panel.focus({ preventScroll: true });
      onClose?.();
    },
  };
  api.set(typeof content === 'function' ? content(api) : content);
  // arrastar para baixo fecha
  let y0 = null, dy = 0;
  handle.addEventListener('pointerdown', (e) => { y0 = e.clientY; handle.setPointerCapture(e.pointerId); });
  handle.addEventListener('pointermove', (e) => { if (y0 == null) return; dy = Math.max(0, e.clientY - y0); panel.style.transform = `translateY(${dy}px)`; });
  handle.addEventListener('pointerup', () => { if (dy > 90) api.close(); panel.style.transform = ''; y0 = null; dy = 0; });
  const resetDrag = () => { panel.style.transform = ''; y0 = null; dy = 0; };
  handle.addEventListener('pointercancel', resetDrag);
  handle.addEventListener('lostpointercapture', resetDrag);
  stack.push(api);
  refreshModals();
  return api;
}
function refreshModals() {
  const top = stack.at(-1);
  for (const s of stack) s.root.inert = s !== top;
  for (const el of document.querySelectorAll('#home, #topbar, #hud, #dock, #stage, #exitImmersive')) el.inert = !!top;
}
export function closeAllSheets() { for (const s of [...stack]) s.close(); }
export const sheetOpen = () => stack.length > 0;
addEventListener('keydown', (e) => {
  const s = stack.at(-1); if (!s) return;
  if (e.key === 'Escape') { e.preventDefault(); s.close(); return; }
  if (e.key !== 'Tab') return;
  const nodes = [...s.panel.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex="0"]')].filter((el) => el.getClientRects().length);
  const first = nodes[0], last = nodes.at(-1);
  if (!first) { e.preventDefault(); s.panel.focus(); }
  else if (e.shiftKey && (document.activeElement === first || document.activeElement === s.panel)) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && (document.activeElement === last || document.activeElement === s.panel)) { e.preventDefault(); first.focus(); }
});

let toastEl = null, toastTimer = 0;
export function toast(msg, ms = 2600) {
  if (!toastEl) { toastEl = h('div.toast', { role: 'status', 'aria-live': 'polite' }); document.body.append(toastEl); }
  toastEl.textContent = msg; toastEl.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => toastEl.classList.remove('show'), ms);
}
