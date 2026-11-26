/** Construção de DOM declarativa e mínima, sem framework. */
export function h(tag, props = {}, ...children) {
  const [name, ...cls] = tag.split('.');
  const el = document.createElement(name || 'div');
  if (cls.length) el.className = cls.join(' ');
  for (const [k, v] of Object.entries(props ?? {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className += (el.className ? ' ' : '') + v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v;
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) if (c != null && c !== false) el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return el;
}
export const $ = (s, root = document) => root.querySelector(s);
export function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }

const P = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const ICONS = {
  menu: P('<path d="M4 7h16M4 12h10M4 17h16"/>'),
  close: P('<path d="M6 6l12 12M18 6L6 18"/>'),
  back: P('<path d="M15 5l-7 7 7 7"/>'),
  chevron: P('<path d="M7 10l5 5 5-5"/>'),
  harp: P('<path d="M6 21V5c5 0 10 3 12 9M9 19V8M12 18V9.5M15 17v-6"/>'),
  bass: P('<path d="M4 20l9-9M13 11l5-5 2 2-5 5M6 14l4 4M8 12l4 4"/>'),
  keys: P('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M8 5v8M12 5v8M16 5v8"/>'),
  mallet: P('<path d="M4 16h16M6 12h12M8 8h8M14 3l-3 9"/>'),
  wave: P('<path d="M3 12c2-6 4-6 6 0s4 6 6 0 4-6 6 0"/>'),
  drum: P('<ellipse cx="12" cy="9" rx="8" ry="3"/><path d="M4 9v6c0 1.7 3.6 3 8 3s8-1.3 8-3V9M8 3l3 5M16 3l-3 5"/>'),
  pedal: P('<rect x="6" y="3" width="12" height="18" rx="3"/><circle cx="12" cy="15" r="2.5"/><path d="M9 7h1M14 7h1"/>'),
  camera: P('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>'),
  hand: P('<path d="M8 13V5.5a1.5 1.5 0 013 0V11M11 10V4.5a1.5 1.5 0 013 0V11M14 10.5V6a1.5 1.5 0 013 0v8c0 4-3 7-7 7s-6-2.5-7-5l-1.5-3.5a1.5 1.5 0 012.6-1.4L8 13"/>'),
  more: P('<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>'),
  gear: P('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>'),
  rec: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="6.5" fill="currentColor"/></svg>',
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg>',
  pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6.5" y="5" width="4" height="14" rx="1" fill="currentColor"/><rect x="13.5" y="5" width="4" height="14" rx="1" fill="currentColor"/></svg>',
  stop: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6.5" y="6.5" width="11" height="11" rx="2" fill="currentColor"/></svg>',
  metro: P('<path d="M9 3h6l3 18H6zM12 16l5-9"/>'),
  undo: P('<path d="M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3"/>'),
  redo: P('<path d="M15 14l5-5-5-5M20 9H10a6 6 0 000 12h3"/>'),
  plus: P('<path d="M12 5v14M5 12h14"/>'),
  minus: P('<path d="M5 12h14"/>'),
  trash: P('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
  copy: P('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4H4v12h4"/>'),
  download: P('<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>'),
  upload: P('<path d="M12 20V9M7 14l5-5 5 5M5 4h14"/>'),
  share: P('<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.3 11l7.4-3.8M8.3 13l7.4 3.8"/>'),
  expand: P('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
  shrink: P('<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>'),
  music: P('<path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>'),
  spark: P('<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6"/>'),
  brain: P('<path d="M9 4a3 3 0 00-3 3 3 3 0 00-2 5 3 3 0 002 5 3 3 0 006 1V4.5A1.5 1.5 0 0010.5 3 1.5 1.5 0 009 4zM15 4a3 3 0 013 3 3 3 0 012 5 3 3 0 01-2 5 3 3 0 01-6 1"/>'),
  book: P('<path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2zM4 5v16M8 7h7"/>'),
  studio: P('<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="8" cy="6" r="1.8" fill="currentColor"/><circle cx="15" cy="12" r="1.8" fill="currentColor"/><circle cx="10" cy="18" r="1.8" fill="currentColor"/>'),
  pen: P('<path d="M4 20l4-1 11-11-3-3L5 16zM14 6l3 3"/>'),
  dice: P('<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1" fill="currentColor"/><circle cx="15" cy="15" r="1" fill="currentColor"/><circle cx="15" cy="9" r="1" fill="currentColor"/><circle cx="9" cy="15" r="1" fill="currentColor"/>'),
  orbit: P('<circle cx="12" cy="12" r="2.5"/><ellipse cx="12" cy="12" rx="9" ry="4" transform="rotate(-25 12 12)"/>'),
  eye: P('<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="2.5"/>'),
  ear: P('<path d="M7 9a5 5 0 0110 0c0 3-3 4-3 7a3 3 0 01-6 0M10 9a2 2 0 014 0"/>'),
  repeat: P('<path d="M17 2l3 3-3 3M4 11V9a4 4 0 014-4h12M7 22l-3-3 3-3M20 13v2a4 4 0 01-4 4H4"/>'),
  flip: P('<path d="M4 8h13l-3-3M20 16H7l3 3"/>'),
  check: P('<path d="M5 12l5 5 9-10"/>'),
  info: P('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>'),
  lightning: P('<path d="M13 3L5 14h6l-1 7 8-11h-6z"/>'),
  trophy: P('<path d="M8 4h8v5a4 4 0 01-8 0zM8 6H4a3 3 0 004 4M16 6h4a3 3 0 01-4 4M12 13v4M8 21h8M9 17h6"/>'),
  users: P('<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0112 0M16 4a3 3 0 010 6M18 14a6 6 0 013 6"/>'),
  calendar: P('<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>'),
};
export function icon(name, cls = '') { const s = h('span.ic' + (cls ? '.' + cls : '')); s.innerHTML = ICONS[name] ?? ''; return s; }
export function btn(label, onClick, { icon: ic = null, cls = '', title = null, pressed = null } = {}) {
  const b = h('button.btn' + (cls ? '.' + cls.split(' ').join('.') : ''), { type: 'button', onclick: onClick, title: title ?? (typeof label === 'string' ? label : null), 'aria-label': title ?? (typeof label === 'string' ? label : null) });
  if (ic) b.append(icon(ic));
  if (label) b.append(h('span.lbl', {}, label));
  if (pressed != null) b.setAttribute('aria-pressed', String(!!pressed));
  return b;
}
export function setPressed(el, v) { el.setAttribute('aria-pressed', String(!!v)); el.classList.toggle('on', !!v); }

export function slider({ label, min, max, step = 0.01, value, format = (v) => v, onInput }) {
  const out = h('output', {}, format(value));
  const input = h('input', { type: 'range', min, max, step, value });
  input.addEventListener('input', () => { const v = Number(input.value); out.textContent = format(v); onInput(v); });
  return h('label.field.slider', {}, h('span.flabel', {}, label, out), input);
}
export function toggle({ label, value, onChange, hint }) {
  const input = h('input', { type: 'checkbox', role: 'switch' }); input.checked = !!value;
  input.addEventListener('change', () => onChange(input.checked));
  return h('label.field.toggle', {}, h('span.flabel', {}, label, hint ? h('small', {}, hint) : null), input);
}
export function select({ label, value, options, onChange }) {
  const s = h('select', {}, ...options.map(([v, t]) => { const o = h('option', { value: v }, t); if (String(v) === String(value)) o.selected = true; return o; }));
  s.addEventListener('change', () => onChange(s.value));
  return h('label.field.select', {}, h('span.flabel', {}, label), s);
}
export function segmented(options, value, onChange, cls = '') {
  const wrap = h('div.seg' + (cls ? '.' + cls : ''), { role: 'radiogroup' });
  const render = (v) => { for (const b of wrap.children) setPressed(b, b.dataset.v === String(v)); };
  for (const [v, t] of options) wrap.append(h('button', { type: 'button', role: 'radio', 'data-v': v, onclick: () => { render(v); onChange(v); } }, t));
  render(value);
  wrap.set = render;
  return wrap;
}
export function download(blob, name) {
  const a = h('a', { href: URL.createObjectURL(blob), download: name });
  document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
}
export function pickFile(accept) {
  return new Promise((resolve) => {
    const i = h('input', { type: 'file', accept, style: { display: 'none' } });
    i.addEventListener('change', () => { resolve(i.files?.[0] ?? null); i.remove(); });
    document.body.append(i); i.click();
  });
}
