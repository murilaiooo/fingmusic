/**
 * Casca da interface: barra superior, HUD, dock inferior, mensagens centrais
 * e o roteamento entre modos. Cada modo (src/modes/*) recebe esta "ui" e
 * monta os próprios controles no dock/HUD; o instrumento fica sempre visível.
 */
import { h, icon, btn, setPressed, clear } from './dom.js';
import { closeAllSheets, toast } from './sheet.js';
import { getInstrument, FAMILIES } from '../instruments/catalog.js';
import { NOTE_NAMES, NOTE_LETTERS, SCALES } from '../theory/music.js';
import { openInstrumentSheet, openFxSheet, openMusicSheet, openSettingsSheet, openCameraSheet, openMenuSheet } from './panels.js';

export class Shell {
  constructor(app) {
    this.app = app;
    this.modes = {};
    this.current = null;
    this.buildTopbar();
    this.hud = h('div#hud');
    this.dock = h('div#dock');
    this.center = h('div.center-msg.hidden', { 'aria-live': 'polite' });
    this.ring = h('div.turn-ring');
    this.exitImm = btn(null, () => this.setImmersive(false), { icon: 'shrink', cls: 'icon-only', title: 'Sair do modo imersivo' });
    this.exitImm.id = 'exitImmersive'; this.exitImm.classList.add('hidden');
    document.body.append(this.ring, this.topbar, this.hud, this.dock, this.center, this.exitImm);
    // o instrumento ocupa o espaço entre barra superior e dock
    const ro = new ResizeObserver(() => this.syncInsets());
    ro.observe(this.dock); ro.observe(this.topbar);
    app.on('instrument', () => this.refreshChips());
    app.on('music', () => this.refreshChips());
    app.on('fx', () => this.refreshChips());
    app.on('camera', (on) => { setPressed(this.camBtn, on); this.syncInsets(); });
    app.on('camera-status', (st) => { if (st === 'loading') toast('Carregando rastreamento de mãos…'); if (st === 'error') toast('Não foi possível abrir a câmera.'); });
    app.on('shortcut', (s) => this.current?.shortcut?.(s));
    this.refreshChips();
  }

  buildTopbar() {
    const app = this.app;
    this.instChip = h('button.chip', { type: 'button', onclick: () => openInstrumentSheet(this), 'aria-label': 'Trocar instrumento' }, h('span.dot'), h('span.txt'), icon('chevron'));
    this.keyChip = h('button.chip', { type: 'button', onclick: () => openMusicSheet(this), 'aria-label': 'Tom, escala e assistência' }, icon('music'), h('span.txt'));
    this.fxBtn = h('button.btn.icon-only.rel', { type: 'button', onclick: () => openFxSheet(this), 'aria-label': 'Pedais de efeito', title: 'Pedais' }, icon('pedal'));
    this.camBtn = btn(null, () => this.toggleCamera(), { icon: 'camera', cls: 'icon-only', title: 'Modo câmera (mãos no ar)' });
    this.immBtn = btn(null, () => this.setImmersive(true), { icon: 'expand', cls: 'icon-only', title: 'Modo imersivo' });
    this.menuBtn = btn(null, () => openMenuSheet(this), { icon: 'menu', cls: 'icon-only', title: 'Menu' });
    this.backBtn = btn(null, () => this.go('home'), { icon: 'back', cls: 'icon-only', title: 'Início' });
    this.modeLabel = h('span.brand', {}, '');
    this.topbar = h('header#topbar', {}, this.backBtn, this.instChip, this.keyChip, h('div.spacer'), h('div.tb-icons', {}, this.fxBtn, this.camBtn, this.immBtn, this.menuBtn));
    this.settingsBtn = () => openSettingsSheet(this);
    void app;
  }

  refreshChips() {
    const app = this.app, inst = app.instrument;
    this.instChip.querySelector('.dot').style.color = `hsl(${inst.hue},90%,66%)`;
    this.instChip.querySelector('.txt').textContent = inst.name;
    const names = app.settings.noteLetters ? NOTE_LETTERS : NOTE_NAMES;
    this.keyChip.querySelector('.txt').textContent = inst.surface === 'pads' ? `${app.transport.bpm} BPM` : `${names[app.music.root]} · ${SCALES[app.music.scale]?.name ?? ''}`;
    const fx = app.settings.fx[inst.id] ?? {};
    const n = Object.values(fx).filter((f) => f.on).length;
    this.fxBtn.querySelector('.badge')?.remove();
    if (n) this.fxBtn.append(h('span.badge', {}, n));
  }

  syncInsets() {
    const top = this.app.mode === 'home' || document.body.classList.contains('immersive') ? 8 : this.topbar.getBoundingClientRect().bottom;
    const hudH = this.hud.childElementCount ? this.hud.getBoundingClientRect().height + 8 : 0;
    const bottom = this.app.mode === 'home' ? 8 : innerHeight - this.dock.getBoundingClientRect().top;
    this.app.setInsets({ top: Math.max(8, top + hudH), bottom: Math.max(8, bottom) });
  }

  setDock(...rows) { clear(this.dock).append(...rows.flat().filter(Boolean)); this.syncInsets(); }
  setHud(...els) { clear(this.hud).append(...els.flat().filter(Boolean)); requestAnimationFrame(() => this.syncInsets()); }
  message(text, sub = null, ms = 0) {
    clear(this.center).append(text, sub ? h('small', {}, sub) : '');
    this.center.classList.remove('hidden');
    clearTimeout(this.msgTimer);
    if (ms) this.msgTimer = setTimeout(() => this.center.classList.add('hidden'), ms);
  }
  hideMessage() { this.center.classList.add('hidden'); }
  turn(kind) { this.ring.className = 'turn-ring' + (kind ? ' ' + kind : ''); }

  setImmersive(v) {
    document.body.classList.toggle('immersive', v);
    this.exitImm.classList.toggle('hidden', !v);
    this.dock.classList.toggle('hidden', v); this.hud.classList.toggle('hidden', v);
    this.syncInsets();
    if (v) { toast('Modo imersivo: toque em ⤡ para voltar'); document.documentElement.requestFullscreen?.().catch(() => {}); }
    else if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  }

  async toggleCamera() {
    const app = this.app;
    if (app.cameraOn) { app.disableCamera(); return; }
    if (!app.settings.cameraIntroSeen) { openCameraSheet(this, { intro: true }); return; }
    try { await app.enableCamera(); toast('Faça uma pinça (polegar + indicador) para tocar'); }
    catch (e) { toast(e?.message?.includes('Permission') || e?.name === 'NotAllowedError' ? 'Permissão da câmera negada. Libere nas configurações do navegador.' : 'Câmera indisponível: ' + (e?.message ?? e)); app.disableCamera(); }
  }

  register(id, mode) { this.modes[id] = mode; }
  go(id, params = {}) {
    const app = this.app;
    if (document.body.classList.contains('immersive')) this.setImmersive(false);
    closeAllSheets();
    this.hideMessage(); this.turn(null);
    this.nextMode = id;
    if (this.current) { try { this.current.exit?.(); } catch (e) { console.error(e); } }
    app.performer.locked = false;
    app.lighting.clear();
    app.mode = id;
    document.body.className = 'mode-' + id;
    if (id !== 'home') { app.settings.lastMode = id; app.saveSettingsSoon(); }
    clear(this.hud); clear(this.dock);
    this.current = this.modes[id] ?? null;
    this.current?.enter?.(params);
    this.refreshChips();
    this.syncInsets();
    app.emit('mode', id);
  }
}

export function instrumentLabel(id) { const i = getInstrument(id); return `${i.name} · ${FAMILIES[i.family]?.name ?? ''}`; }
