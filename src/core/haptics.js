/**
 * Feedback háptico. Android/Chrome: navigator.vibrate. iOS Safari 18+ não
 * implementa vibrate, mas aciona um "tick" háptico ao alternar um
 * <input type=checkbox switch>; usamos esse recurso só quando disponível.
 * (Não verificado em hardware real neste ambiente — ver docs/TESTING.md.)
 */
let enabled = true, iosSwitch = null, last = 0;

function ensureIosSwitch() {
  if (iosSwitch || typeof document === 'undefined') return iosSwitch;
  const ua = navigator.userAgent;
  if (!/iPhone|iPad|iPod/.test(ua) && !(navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return null;
  const label = document.createElement('label');
  label.setAttribute('aria-hidden', 'true');
  label.style.cssText = 'position:fixed;left:-100px;top:-100px;width:1px;height:1px;opacity:0;pointer-events:none';
  const input = document.createElement('input');
  input.type = 'checkbox'; input.setAttribute('switch', ''); input.tabIndex = -1;
  label.appendChild(input); document.body.appendChild(label);
  iosSwitch = label; return label;
}

export const haptics = {
  setEnabled(v) { enabled = !!v; },
  get enabled() { return enabled; },
  /** strength: 0..1 */
  pulse(strength = 0.5) {
    if (!enabled) return;
    const t = performance.now();
    if (t - last < 35) return; // evita saturar o motor de vibração
    last = t;
    if (navigator.vibrate) { navigator.vibrate(Math.round(6 + strength * 22)); return; }
    const sw = ensureIosSwitch();
    if (sw) sw.click();
  },
};
