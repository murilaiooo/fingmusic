/**
 * Tocar (Free Play): o instrumento ocupa a tela. Dock com acordes da escala,
 * ferramentas do instrumento, jam automática, arpejador, metrônomo e um
 * gravador rápido que joga a ideia direto no Estúdio.
 */
import { h, btn, setPressed, segmented, select } from '../ui/dom.js';
import { openSheet, toast } from '../ui/sheet.js';
import { chordStrip, surfaceTools, Jam, Arpeggiator, arpControls, JAM_NAMES } from './common.js';

export function playMode(ui) {
  const app = ui.app;
  const jam = new Jam(app);
  const arp = new Arpeggiator(app);
  let offs = [];
  let strip = null;

  const build = () => {
    strip?.dispose?.();
    const isDrum = app.instrument.engine === 'drum';
    strip = isDrum ? null : chordStrip(app);
    const jamBtn = btn('Jam', () => { const on = jam.toggle(); setPressed(jamBtn, on); }, { icon: 'play', cls: 'small', title: 'Acompanhamento automático (bateria, baixo e acordes)' });
    setPressed(jamBtn, jam.on);
    const arpBtn = btn('Arp', () => { arp.setEnabled(!arp.enabled); setPressed(arpBtn, arp.enabled); if (arp.enabled) toast('Toque notas: o arpejador repete no tempo'); }, { cls: 'small', title: 'Arpejador' });
    setPressed(arpBtn, arp.enabled);
    const arpMore = btn(null, () => openSheet({ title: 'Arpejador', id: 'arp', content: [h('p.note', {}, 'Toque uma ou mais notas: o arpejador as repete sincronizado com o tempo. Com a jam ligada, segue a batida dela.'), ...arpControls(arp)] }), { icon: 'more', cls: 'small icon-only', title: 'Opções do arpejador' });
    const metro = btn(null, () => { const m = app.metronome; m.enabled = !m.enabled; setPressed(metro, m.enabled); if (m.enabled && !app.transport.playing) { app.engine.unlock(); app.transportOwner = 'metronome'; app.transport.setLoop(0, 0); app.transport.start(); } if (!m.enabled && app.transportOwner === 'metronome') app.transport.stop(); }, { icon: 'metro', cls: 'small icon-only', title: 'Metrônomo (M)' });
    setPressed(metro, app.metronome.enabled);
    const bpm = btn(app.transport.bpm + ' BPM', openTempo, { cls: 'small', title: 'Andamento' });
    const rec = btn(null, () => quickRecord(), { icon: 'rec', cls: 'small icon-only rec', title: 'Gravar no estúdio (.)' });
    const tools = surfaceTools(app);
    const more = btn(null, () => openSheet({ title: 'Acompanhamento e arpejo', id: 'playtools', content: [
      h('div.section-title', {}, 'Jam automática'),
      btn('Escolher estilo · ' + JAM_NAMES[jam.style], () => openJamSheet(), { icon: 'music' }),
      h('div.section-title', {}, 'Arpejador'), arpBtn, arpMore,
      h('p.note', {}, 'O arpejador repete as notas que você toca no ritmo escolhido.')
    ] }), { icon: 'more', cls: 'icon-only', title: 'Mais ferramentas de acompanhamento' });
    ui.setDock(
      strip,
      tools.length ? h('div.bar', {}, h('div.row.grow', {}, ...tools)) : null,
      h('div.bar.play-controls', {}, h('div.row.grow', {}, jamBtn, bpm, metro, more), rec),
    );
  };
  const openJamSheet = () => {
    const sheet = openSheet({ title: 'Jam automática', id: 'jam', content: [
      h('p.note', {}, 'Bateria, baixo e acordes no tom escolhido, gerados na hora. Toque por cima com qualquer instrumento. Para editar ou gravar, abra no Estúdio.'),
      h('div.grid2', {}, ...Object.entries(JAM_NAMES).map(([id, n]) => h('button' + (id === jam.style ? '.on' : ''), { type: 'button', onclick: () => { jam.start(id); sheet.close(); build(); } }, n))),
      h('div.actions', {}, btn('Abrir no Estúdio', () => { if (!jam.on) jam.start(); ui.go('studio', { keep: true }); }, { icon: 'studio' })),
    ] });
  };
  const openTempo = () => {
    const tr = app.transport;
    openSheet({ title: 'Andamento', id: 'tempo', size: 'sm', content: [
      h('div.row.center', {}, ...[-5, -1].map((d) => btn((d > 0 ? '+' : '') + d, () => setBpm(tr.bpm + d), { cls: 'small' })), h('span.big-num', { id: 'bpmv' }, tr.bpm), ...[1, 5].map((d) => btn('+' + d, () => setBpm(tr.bpm + d), { cls: 'small' }))),
      tapTempo(app, setBpm),
    ] });
  };
  const setBpm = (v) => { v = Math.max(40, Math.min(220, Math.round(v))); app.studio.setBpm(v); app.transport.setBpm(v); const el = document.getElementById('bpmv'); if (el) el.textContent = v; build(); };
  const quickRecord = () => {
    // ideia rápida: leva para o estúdio com o instrumento atual armado e grava
    ui.go('studio', { recordNow: true, keep: jam.on });
  };

  return {
    enter() {
      app.setSurfaceOptions({});
      build();
      offs = [app.on('instrument', build)];
      ui.coach?.maybeStart();
    },
    exit() {
      offs.forEach((f) => f()); strip?.dispose?.();
      if (arp.enabled) arp.setEnabled(false);
      if (app.metronome.enabled && app.transportOwner === 'metronome') { app.transport.stop(); }
      app.metronome.enabled = false;
      // a jam continua se o usuário foi para o estúdio
      if (ui.nextMode !== 'studio') jam.stop(); else jam.on = false;
    },
    shortcut(s) {
      if (s === 'playpause') { const on = jam.toggle(); build(); void on; }
      else if (s === 'metronome') { app.metronome.enabled = !app.metronome.enabled; build(); }
      else if (s === 'record') quickRecord();
      else if (s.startsWith('chord:')) strip?.trigger(Number(s.slice(6)));
      else if (s === 'octave-up' || s === 'octave-down') { const d = s === 'octave-up' ? 1 : -1; if (app.surface.shiftOctave) app.surface.shiftOctave(d); else if (app.surface.shiftPosition) app.surface.shiftPosition(d * 2); build(); }
    },
  };
}

/** Bate o tempo: média dos intervalos dos últimos toques. */
export function tapTempo(app, onBpm) {
  const taps = [];
  const b = h('button.btn', { type: 'button', style: { width: '100%', minHeight: '64px', marginTop: '12px' } }, 'Toque no ritmo (tap tempo)');
  b.addEventListener('pointerdown', (e) => {
    e.preventDefault(); const t = performance.now();
    if (taps.length && t - taps[taps.length - 1] > 2000) taps.length = 0;
    taps.push(t); if (taps.length > 6) taps.shift();
    if (taps.length >= 3) { const iv = (taps[taps.length - 1] - taps[0]) / (taps.length - 1); onBpm(60000 / iv); }
  });
  return b;
}
export { select, segmented };
