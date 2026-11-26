/**
 * Bottom sheet (retrato) / painel lateral (paisagem), com alça de arrastar,
 * fundo que fecha ao tocar e foco acessível. Não cobre o instrumento inteiro.
 */
import { h, icon } from './dom.js';

const stack = [];
export function openSheet({ title, content, onClose, size = 'md', id = null, actions = null }) {
  if (id) { const ex = stack.find((s) => s.id === id); if (ex) { ex.close(); return null; } }
  const backdrop = h('div.sheet-backdrop', { onclick: () => api.close() });
  const body = h('div.sheet-body');
  const handle = h('div.sheet-handle', { 'aria-hidden': 'true' });
  const head = h('header.sheet-head', {}, h('h2', {}, title), actions, h('button.btn.icon-only', { type: 'button', 'aria-label': 'Fechar', onclick: () => api.close() }, icon('close')));
  const panel = h('section.sheet.sheet-' + size, { role: 'dialog', 'aria-modal': 'false', 'aria-label': title }, handle, head, body);
  const root = h('div.sheet-root', {}, backdrop, panel);
  document.body.append(root);
  requestAnimationFrame(() => root.classList.add('open'));
  const api = {
    id, root, body, panel,
    set(c) { body.replaceChildren(...[c].flat().filter(Boolean)); },
    close() {
      if (api.closed) return; api.closed = true;
      root.classList.remove('open');
      setTimeout(() => root.remove(), 260);
      stack.splice(stack.indexOf(api), 1);
      onClose?.();
    },
  };
  api.set(typeof content === 'function' ? content(api) : content);
  // arrastar para baixo fecha
  let y0 = null, dy = 0;
  handle.addEventListener('pointerdown', (e) => { y0 = e.clientY; handle.setPointerCapture(e.pointerId); });
  handle.addEventListener('pointermove', (e) => { if (y0 == null) return; dy = Math.max(0, e.clientY - y0); panel.style.transform = `translateY(${dy}px)`; });
  handle.addEventListener('pointerup', () => { if (dy > 90) api.close(); panel.style.transform = ''; y0 = null; dy = 0; });
  stack.push(api);
  return api;
}
export function closeAllSheets() { for (const s of [...stack]) s.close(); }
export const sheetOpen = () => stack.length > 0;
addEventListener('keydown', (e) => { if (e.key === 'Escape' && stack.length) stack[stack.length - 1].close(); });

let toastEl = null, toastTimer = 0;
export function toast(msg, ms = 2600) {
  if (!toastEl) { toastEl = h('div.toast', { role: 'status', 'aria-live': 'polite' }); document.body.append(toastEl); }
  toastEl.textContent = msg; toastEl.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => toastEl.classList.remove('show'), ms);
}
