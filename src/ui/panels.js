/**
 * Painéis (sheets) compartilhados: instrumentos e presets, pedaleira,
 * música (tom/escala/assistência), câmera, configurações, dados e menu.
 */
import { h, icon, btn, setPressed, slider, toggle, select, segmented, download, pickFile } from './dom.js';
import { openSheet, toast, closeAllSheets } from './sheet.js';
import { INSTRUMENTS, FAMILIES, getInstrument } from '../instruments/catalog.js';
import { FX_PRESETS } from '../instruments/presets.js';
import { PEDALS, PEDAL_ORDER, defaultParams, pedalValueLabel } from '../audio/effects.js';
import { NOTE_NAMES, NOTE_LETTERS, SCALES } from '../theory/music.js';
import { db } from '../persist/db.js';
import { DEFAULTS, saveSettings } from '../persist/settings.js';

// ───────────── instrumentos
export function openInstrumentSheet(ui, { onPick = null, title = 'Instrumentos' } = {}) {
  const app = ui.app;
  let fam = app.instrument.family;
  const famSeg = segmented(Object.entries(FAMILIES).map(([id, f]) => [id, f.name]), fam, (v) => { fam = v; render(); });
  const list = h('div.list');
  const render = () => {
    list.replaceChildren(...INSTRUMENTS.filter((i) => i.family === fam).map((i) => h('button.item' + (i.id === app.instrument.id ? '.on' : ''), {
      type: 'button',
      onclick: () => { if (onPick) { onPick(i.id); sheet.close(); return; } app.engine.unlock(); app.setInstrument(i.id); render(); demo(i); },
    }, h('span.swatch', { style: { background: `linear-gradient(hsl(${i.hue},90%,66%), hsl(${(i.hue + 40) % 360},80%,45%))` } }), h('span.meta', {}, h('div.name', {}, i.name), h('div.desc', {}, i.desc ?? '')), i.engine === 'drum' ? h('span.tag', {}, 'kit') : null)));
  };
  // pequena prévia sonora ao escolher
  const demo = (i) => { const ch = app.ensureLiveChannel(); if (!ch) return; const m = i.engine === 'drum' ? 36 : (i.layout?.base ?? 48) + 12 + app.music.root; ch.play({ midi: m, vel: 0.7 }); };
  const presets = h('div.grid2', {}, ...FX_PRESETS.map((p) => h('button', { type: 'button', onclick: () => { app.engine.unlock(); app.setInstrument(p.inst); app.setFx(structuredClone(p.fx)); toast(`Preset ${p.name}`); sheet.close(); } }, p.name)));
  render();
  const sheet = openSheet({ title, id: 'inst', size: 'lg', content: [famSeg, h('div.section-title', {}, 'Timbres'), list, onPick ? null : h('div.section-title', {}, 'Presets (instrumento + pedais)'), onPick ? null : presets] });
  return sheet;
}

// ───────────── pedaleira
export function openFxSheet(ui, { channel = null, state = null, onChange = null, title = null } = {}) {
  const app = ui.app;
  const inst = app.instrument;
  let fx = structuredClone(state ?? app.settings.fx[inst.id] ?? {});
  const commit = () => { if (onChange) onChange(fx); else app.setFx(fx); channel?.setFxState(fx); };
  const grid = h('div.pedals');
  for (const id of PEDAL_ORDER) {
    const meta = PEDALS[id];
    const st = fx[id] ?? { on: false, params: defaultParams(id) };
    st.params = { ...defaultParams(id), ...st.params };
    const el = h('div.pedal' + (st.on ? '.on' : ''), { style: { '--pc': meta.color } });
    const stomp = h('button.stomp', { type: 'button', 'aria-pressed': String(!!st.on), onclick: () => { st.on = !st.on; fx[id] = st; el.classList.toggle('on', st.on); stomp.setAttribute('aria-pressed', String(st.on)); stomp.textContent = st.on ? 'Ligado' : 'Desligado'; app.haptics.pulse(0.3); commit(); } }, st.on ? 'Ligado' : 'Desligado');
    el.append(h('header', {}, h('b', {}, meta.name), h('span.led')));
    for (const [k, [label, min, max]] of Object.entries(meta.params)) {
      const opts = meta.params[k][4];
      el.append(slider({ label, min, max, step: opts ? 1 : (max - min) / 200, value: st.params[k], format: (v) => pedalValueLabel(id, k, v), onInput: (v) => { st.params[k] = v; fx[id] = st; if (st.on) { const ch = channel ?? app.performerChannelOverride ?? app.liveChannel; ch?.setFxParam(id, k, v); if (onChange) onChange(fx); else { app.settings.fx = { ...app.settings.fx, [inst.id]: fx }; app.saveSettingsSoon(); } } } }));
    }
    el.append(stomp);
    grid.append(el);
  }
  const reset = btn('Desligar todos', () => { fx = {}; commit(); sheet.close(); toast('Pedais desligados'); }, { icon: 'close', cls: 'small' });
  const sheet = openSheet({ title: title ?? `Pedais · ${inst.name}`, id: 'fx', size: 'lg', content: [h('p.note', {}, 'A ordem do sinal segue a de uma pedaleira real: octaver → compressor → wah → drives → modulação → delay → reverb.'), grid, h('div.actions', {}, reset)] });
  return sheet;
}

// ───────────── música
export function openMusicSheet(ui) {
  const app = ui.app, m = app.music;
  const names = app.settings.noteLetters ? NOTE_LETTERS : NOTE_NAMES;
  const keys = h('div.keys12', {}, ...names.map((n, i) => { const b = h('button', { type: 'button', onclick: () => { app.setMusic({ root: i }); for (const x of keys.children) x.classList.toggle('on', x === b); } }, n); if (i === m.root) b.classList.add('on'); return b; }));
  const scales = h('div.grid2', {}, ...Object.entries(SCALES).map(([id, s]) => { const b = h('button', { type: 'button', onclick: () => { app.setMusic({ scale: id }); for (const x of scales.children) x.classList.toggle('on', x === b); } }, s.name); if (id === m.scale) b.classList.add('on'); return b; }));
  const oct = segmented([['-2', '−2'], ['-1', '−1'], ['0', '0'], ['1', '+1'], ['2', '+2']], String(m.octave ?? 0), (v) => app.setMusic({ octave: Number(v) }));
  openSheet({ title: 'Tom e escala', id: 'music', content: [
    h('div.section-title', {}, 'Tônica'), keys,
    h('div.section-title', {}, 'Escala'), scales,
    h('div.section-title', {}, 'Oitava'), oct,
    h('div.section-title', {}, 'Assistência'),
    toggle({ label: 'Só notas da escala', hint: 'Cordas e teclas seguem a escala escolhida (sem notas "erradas").', value: m.assist, onChange: (v) => app.setMusic({ assist: v }) }),
    toggle({ label: 'Destacar a tônica', value: m.highlightRoots, onChange: (v) => app.setMusic({ highlightRoots: v }) }),
    toggle({ label: 'Mostrar notas da escala no braço', value: m.showScale, onChange: (v) => app.setMusic({ showScale: v }) }),
    toggle({ label: 'Nomes em letras (C D E…)', value: app.settings.noteLetters, onChange: (v) => { app.update({ noteLetters: v }); ui.refreshChips(); } }),
  ] });
}

// ───────────── câmera
export function openCameraSheet(ui, { intro = false } = {}) {
  const app = ui.app, s = app.settings;
  const start = async () => {
    app.update({ cameraIntroSeen: true }); sheet.close();
    try { await app.enableCamera(); toast('Faça uma pinça (polegar + indicador) para tocar'); }
    catch (e) { toast(e?.name === 'NotAllowedError' ? 'Permissão da câmera negada.' : 'Câmera indisponível: ' + (e?.message ?? e)); app.disableCamera(); }
  };
  const roles = [['play', 'Tocar'], ['fx', 'Efeito (altura = filtro/wah)'], ['off', 'Ignorar']];
  const apply = () => { const t = app.tracker; if (!t) return; Object.assign(t, { pinchOn: s.pinchOn, pinchOff: s.pinchOff, maxFps: s.maxHandFps, fingers: s.handFingers === 1 ? [8] : s.handFingers === 3 ? [8, 12, 16] : [8, 12] }); t.roles = { Left: s.handRoleLeft, Right: s.handRoleRight }; };
  const calib = h('div.list');
  const calibStep = (kind, label) => btn(label, () => {
    const r = app.tracker?.calibrateSample(kind);
    if (!r) toast('Mostre uma mão para a câmera'); else if (r.pending) toast('Agora a outra posição'); else { app.update({ pinchOn: r.pinchOn, pinchOff: r.pinchOff }); toast('Pinça calibrada'); }
  }, { cls: 'small' });
  calib.append(h('div.row', {}, calibStep('closed', '1. Pinça fechada'), calibStep('open', '2. Mão aberta')));
  const content = [
    h('p.note', {}, 'O Fingmusic usa a câmera para ver suas mãos e tocar no ar. Todo o processamento acontece neste aparelho: nenhuma imagem é enviada ou gravada. O modelo de mãos (MediaPipe, ~8 MB) é baixado uma vez e fica em cache.'),
    h('div.actions', {}, app.cameraOn ? btn('Desligar câmera', () => { app.disableCamera(); sheet.close(); }, { icon: 'close' }) : btn('Ativar câmera', start, { icon: 'camera', cls: 'primary' }),
      app.cameraOn ? btn('Trocar frente/trás', () => app.tracker.flip(), { icon: 'flip' }) : null),
  ];
  if (!intro) content.push(
    h('div.section-title', {}, 'Imagem'),
    slider({ label: 'Opacidade do vídeo', min: 0, max: 1, value: s.cameraOpacity, format: (v) => Math.round(v * 100) + '%', onInput: (v) => app.update({ cameraOpacity: v }) }),
    toggle({ label: 'Mostrar esqueleto da mão', value: s.showSkeleton, onChange: (v) => app.update({ showSkeleton: v }) }),
    h('div.section-title', {}, 'Mãos'),
    select({ label: 'Mão esquerda', value: s.handRoleLeft, options: roles, onChange: (v) => { app.update({ handRoleLeft: v }); apply(); } }),
    select({ label: 'Mão direita', value: s.handRoleRight, options: roles, onChange: (v) => { app.update({ handRoleRight: v }); apply(); } }),
    select({ label: 'Dedos que tocam ao passar', value: s.handFingers, options: [[1, 'Só indicador'], [2, 'Indicador e médio'], [3, 'Três dedos']], onChange: (v) => { app.update({ handFingers: Number(v) }); apply(); } }),
    h('div.section-title', {}, 'Sensibilidade e estabilidade'),
    slider({ label: 'Pinça: fecha em', min: 0.15, max: 0.6, value: s.pinchOn, format: (v) => v.toFixed(2), onInput: (v) => { app.update({ pinchOn: v, pinchOff: Math.max(v + 0.08, s.pinchOff) }); apply(); } }),
    slider({ label: 'Pinça: abre em', min: 0.25, max: 0.8, value: s.pinchOff, format: (v) => v.toFixed(2), onInput: (v) => { app.update({ pinchOff: Math.max(v, s.pinchOn + 0.05) }); apply(); } }),
    slider({ label: 'Quadros por segundo da câmera', min: 12, max: 30, step: 1, value: s.maxHandFps, format: (v) => v + ' fps', onInput: (v) => { app.update({ maxHandFps: v }); apply(); } }),
    h('div.section-title', {}, 'Calibrar pinça'), h('p.note', {}, 'Com a câmera ligada, mostre a mão e toque em cada passo.'), calib,
  );
  const sheet = openSheet({ title: 'Modo câmera', id: 'cam', content });
}

// ───────────── configurações
export function openSettingsSheet(ui) {
  const app = ui.app, s = app.settings;
  const latOut = h('output', {}, '');
  const calibrate = () => latencyCalibration(ui, (ms) => { app.update({ latencyTouch: ms }); latOut.textContent = ms + ' ms'; });
  openSheet({ title: 'Configurações', id: 'settings', size: 'lg', content: [
    h('div.section-title', {}, 'Som'),
    slider({ label: 'Volume geral', min: 0, max: 1, value: s.volume, format: (v) => Math.round(v * 100) + '%', onInput: (v) => { app.update({ volume: v }); app.engine.setVolume(v); } }),
    slider({ label: 'Ambiência (reverb da sala)', min: 0, max: 0.6, value: s.ambience, format: (v) => Math.round(v / 0.6 * 100) + '%', onInput: (v) => { app.update({ ambience: v }); app.engine.setAmbience(v); } }),
    slider({ label: 'Volume do metrônomo', min: 0, max: 1, value: s.metronomeVolume, format: (v) => Math.round(v * 100) + '%', onInput: (v) => { app.update({ metronomeVolume: v }); app.metronome.volume = v; } }),
    h('div.section-title', {}, 'Toque'),
    slider({ label: 'Sensibilidade (força do toque)', min: 0.5, max: 2, value: s.sensitivity, format: (v) => v.toFixed(1) + '×', onInput: (v) => app.update({ sensitivity: v }) }),
    toggle({ label: 'Vibração (háptico)', hint: 'No iPhone depende do iOS 18+ e da opção de sons do sistema.', value: s.haptics, onChange: (v) => { app.update({ haptics: v }); app.haptics.setEnabled(v); } }),
    h('div.section-title', {}, 'Sincronia (Follow the Lights)'),
    h('div.field', {}, h('span.flabel', {}, 'Latência do toque', latOut)),
    slider({ label: 'Compensação manual', min: -60, max: 200, step: 1, value: s.latencyTouch, format: (v) => v + ' ms', onInput: (v) => app.update({ latencyTouch: v }) }),
    slider({ label: 'Compensação da câmera', min: 0, max: 250, step: 1, value: s.latencyHand, format: (v) => v + ' ms', onInput: (v) => app.update({ latencyHand: v }) }),
    btn('Calibrar latência tocando no ritmo', calibrate, { icon: 'metro', cls: 'small' }),
    slider({ label: 'Antecipação das luzes', min: 0.4, max: 2.5, value: s.anticipation, format: (v) => v.toFixed(1) + ' s', onInput: (v) => { app.update({ anticipation: v }); app.applyLightingSettings(); } }),
    h('div.section-title', {}, 'Visual e acessibilidade'),
    select({ label: 'Qualidade gráfica', value: s.quality, options: [['auto', 'Automática (recomendado)'], ['high', 'Alta'], ['medium', 'Média'], ['low', 'Econômica']], onChange: (v) => app.update({ quality: v }) }),
    toggle({ label: 'Reduzir movimento e flashes', value: s.reduceMotion, onChange: (v) => { app.update({ reduceMotion: v }); app.applyLightingSettings(); } }),
    toggle({ label: 'Alto contraste', value: s.highContrast, onChange: (v) => { app.update({ highContrast: v }); document.documentElement.dataset.contrast = v ? 'high' : ''; app.applyLightingSettings(); } }),
    toggle({ label: 'Formas nas técnicas', hint: 'Cada técnica tem um símbolo, não só uma cor.', value: s.showShapes, onChange: (v) => { app.update({ showShapes: v }); app.applyLightingSettings(); } }),
    toggle({ label: 'Mostrar nomes das notas', value: s.showNames, onChange: (v) => app.update({ showNames: v }) }),
    h('div.section-title', {}, 'Ajuda'),
    btn('Rever o tutorial', () => { closeAllSheets(); app.update({ tutorialDone: false }); ui.go('play'); ui.coach?.start(); }, { icon: 'info', cls: 'small' }),
    h('div.section-title', {}, 'Desempenho'), statsBlock(app),
  ] });
}
function statsBlock(app) {
  const dl = h('dl.kv');
  const upd = () => { const s = app.stats(); dl.replaceChildren(h('dt', {}, 'Quadros/s'), h('dd', {}, s.fps), h('dt', {}, 'Qualidade'), h('dd', {}, ['econômica', 'média', 'alta'][s.quality]), h('dt', {}, 'Vozes ativas'), h('dd', {}, s.voices), h('dt', {}, 'Latência de saída'), h('dd', {}, s.audioLatencyMs + ' ms'), h('dt', {}, 'Câmera'), h('dd', {}, s.handMs == null ? 'desligada' : s.handMs + ' ms/quadro')); if (dl.isConnected) setTimeout(upd, 1000); };
  setTimeout(upd, 50);
  return dl;
}

/** Calibração: o usuário toca junto com 8 cliques; a média do atraso vira a compensação. */
function latencyCalibration(ui, done) {
  const app = ui.app; app.engine.unlock();
  if (!app.engine.ready) { toast('Toque no instrumento uma vez para ativar o som'); return; }
  const bpm = 90, beat = 60 / bpm, t0 = app.engine.now + 1, N = 8, taps = [];
  for (let i = 0; i < N; i++) app.metronome.click(t0 + i * beat, i % 4 === 0);
  const pad = h('button.btn.primary', { type: 'button', style: { width: '100%', minHeight: '120px', fontSize: '18px' } }, 'Toque aqui junto com os cliques');
  pad.addEventListener('pointerdown', (e) => { e.preventDefault(); taps.push(app.engine.now); });
  const sheet = openSheet({ title: 'Calibrar latência', id: 'lat', content: [h('p.note', {}, 'Ouça 8 cliques e toque no botão exatamente junto com cada um.'), pad] });
  setTimeout(() => {
    const ol = app.engine.outputLatency, offs = [];
    for (const t of taps) { const k = Math.round((t - t0) / beat); if (k >= 0 && k < N) offs.push(t - (t0 + k * beat) - ol); }
    sheet?.close();
    if (offs.length < 4) { toast('Poucos toques detectados. Tente de novo.'); return; }
    offs.sort((a, b) => a - b);
    const med = offs[Math.floor(offs.length / 2)];
    const ms = Math.round(Math.max(-60, Math.min(200, med * 1000)));
    done(ms); toast(`Compensação ajustada para ${ms} ms`);
  }, (1 + N * beat + 0.6) * 1000);
}

// ───────────── dados e backup
export function openDataSheet(ui) {
  const app = ui.app;
  openSheet({ title: 'Seus dados', id: 'data', content: [
    h('p.note', {}, 'Tudo fica salvo neste aparelho (IndexedDB): sessões, instrumentos personalizados, músicas importadas, progresso e recordes. Faça um backup para levar para outro aparelho.'),
    h('div.actions', {},
      btn('Exportar backup', async () => { const data = await db.exportAll(app.settings); download(new Blob([JSON.stringify(data)], { type: 'application/json' }), `fingmusic-backup-${new Date().toISOString().slice(0, 10)}.json`); }, { icon: 'download' }),
      btn('Importar backup', async () => {
        const f = await pickFile('application/json,.json'); if (!f) return;
        try { const r = await db.importAll(JSON.parse(await f.text())); if (r.settings) { Object.assign(app.settings, r.settings); saveSettings(app.settings); } toast(`${r.count} itens restaurados`); }
        catch (e) { toast('Falha ao importar: ' + e.message); }
      }, { icon: 'upload' })),
    h('div.section-title', {}, 'Zona de perigo'),
    btn('Restaurar configurações padrão', () => { Object.assign(app.settings, structuredClone(DEFAULTS)); saveSettings(app.settings); toast('Configurações restauradas. Recarregue o app.'); }, { cls: 'small danger' }),
  ] });
}

// ───────────── menu principal
export function openMenuSheet(ui) {
  const go = (id) => () => { ui.go(id); };
  const item = (ic, name, desc, fn) => h('button.item', { type: 'button', onclick: fn }, icon(ic), h('span.meta', {}, h('div.name', {}, name), h('div.desc', {}, desc)));
  openSheet({ title: 'Fingmusic', id: 'menu', content: [
    h('div.list', {},
      item('harp', 'Tocar', 'Modo livre com acordes, arpejador e jam', go('play')),
      item('book', 'Aprender', 'Follow the Lights: músicas, grooves e técnicas', go('learn')),
      item('brain', 'Genius', 'Jogo de memória musical no próprio instrumento', go('genius')),
      item('studio', 'Estúdio', 'Looper com pistas, bateria e exportação', go('studio')),
      item('pen', 'Criar', 'Instrumentos, lições e desafios próprios', go('create')),
      item('orbit', 'Playground', 'Orbes, gravidade e cordas que tocam sozinhas', go('playground'))),
    h('div.section-title', {}, 'Ajustes'),
    h('div.list', {},
      item('gear', 'Configurações', 'Som, toque, latência, acessibilidade', () => openSettingsSheet(ui)),
      item('camera', 'Câmera', 'Mãos no ar, calibração, privacidade', () => openCameraSheet(ui)),
      item('download', 'Dados e backup', 'Exportar e importar tudo', () => openDataSheet(ui)),
      item('info', 'Sobre', 'Créditos e licenças', () => openAbout())),
  ] });
}
function openAbout() {
  openSheet({ title: 'Sobre', id: 'about', content: [
    h('p', {}, 'Fingmusic transforma gestos em música: cordas de luz, baixos, teclas, sintetizadores e bateria, todos sintetizados em tempo real no navegador.'),
    h('p.note', {}, 'Nenhum sample de terceiros. Músicas da biblioteca: melodias em domínio público com arranjos originais, ou composições originais do projeto. O rastreamento de mãos usa MediaPipe (Apache 2.0) e roda localmente.'),
  ] });
}
export { getInstrument, setPressed };
