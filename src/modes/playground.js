/**
 * Playground: toque em qualquer espaço vazio para criar um emissor de orbes.
 * Os orbes caem com gravidade no tempo da música e tocam as cordas em que
 * batem. Inclui o dado "Surpresa" (instrumento, escala e pedais aleatórios).
 */
import { h, btn, slider, icon, setPressed } from '../ui/dom.js';
import { toast } from '../ui/sheet.js';
import { INSTRUMENTS } from '../instruments/catalog.js';
import { FX_PRESETS } from '../instruments/presets.js';
import { SCALES } from '../theory/music.js';

export function playgroundMode(ui) {
  const app = ui.app, tr = app.transport;
  let offs = [], count = h('b', {}, '0');
  const start = () => { app.engine.unlock(); if (!app.engine.ready) return; app.transportOwner = 'playground'; tr.setLoop(0, 0); if (!tr.playing) tr.start(); };
  function dock() {
    const play = btn(null, () => { if (tr.playing) tr.stop(); else start(); dock(); }, { icon: tr.playing ? 'pause' : 'play', cls: 'icon-only', title: 'Pausar/continuar' });
    ui.setDock(h('div.bar', {}, h('div.row.grow', {},
      play,
      btn('Surpresa', surprise, { icon: 'dice', cls: 'small' }),
      btn('Limpar', () => app.surface.clearToys?.(), { icon: 'trash', cls: 'small' }),
      h('div', { style: { minWidth: '150px', flex: '1' } }, slider({ label: 'Gravidade', min: 0.2, max: 2.5, value: app.settings.gravity ?? 1, format: (v) => v.toFixed(1) + '×', onInput: (v) => app.update({ gravity: v }) })))));
    ui.setHud(h('div.hud-pill', {}, icon('orbit'), h('span', {}, 'Emissores: ', count), h('span.muted', {}, 'toque no vazio para criar')));
  }
  function surprise() {
    const pool = INSTRUMENTS.filter((i) => i.surface === 'strings' || i.family === 'strings' || i.family === 'synth' || i.family === 'mallets');
    const inst = pool[Math.floor(Math.random() * pool.length)];
    const scales = ['pentMajor', 'pentMinor', 'dorian', 'japanese', 'major', 'blues', 'wholeTone'];
    const scale = scales[Math.floor(Math.random() * scales.length)];
    app.setMusic({ root: Math.floor(Math.random() * 12), scale });
    app.setInstrument(inst.id, { silent: true });
    const p = FX_PRESETS[Math.floor(Math.random() * FX_PRESETS.length)];
    app.setFx(structuredClone(p.fx));
    toast(`${inst.name} · ${SCALES[scale].name} · pedais ${p.name}`);
  }
  return {
    enter() {
      app.surfaceOpts = { surface: 'strings', toys: true };
      app.setInstrument(app.instrument.engine === 'drum' ? 'harp' : app.instrument.id, { silent: true });
      offs = [app.on('toy-change', (n) => { count.textContent = n; if (n && !tr.playing) { start(); dock(); } }), app.on('instrument', () => { void setPressed; })];
      dock();
      ui.message('Toque num espaço vazio', 'cada toque cria um emissor de orbes', 2600);
    },
    exit() { if (app.transportOwner === 'playground') tr.stop(); app.surface.clearToys?.(); app.setSurfaceOptions({}); offs.forEach((f) => f()); offs = []; },
    shortcut(s) { if (s === 'playpause') { if (tr.playing) tr.stop(); else start(); dock(); } },
  };
}
