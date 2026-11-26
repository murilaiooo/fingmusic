/**
 * Estúdio (Jam Studio): transporte, gravação com contagem, pistas com
 * mute/solo/volume/pan, sequenciador de bateria por passos, editor de notas
 * (piano roll), salvar/abrir sessões, exportar WAV/MIDI e transformar uma
 * pista em desafio do Genius.
 */
import { h, btn, setPressed, segmented, slider, select, toggle, download, icon } from '../ui/dom.js';
import { openSheet, toast } from '../ui/sheet.js';
import { getInstrument, INSTRUMENTS } from '../instruments/catalog.js';
import { KITS } from '../audio/drums.js';
import { DRUM_STYLES, generateDrums } from '../studio/patterns.js';
import { newSession } from '../studio/session.js';
import { openInstrumentSheet, openFxSheet } from '../ui/panels.js';
import { buildJamSession, JAM_NAMES } from './common.js';
import { tapTempo } from './play.js';
import { db } from '../persist/db.js';
import { noteName } from '../theory/music.js';
import { encodeSequence } from '../genius/generator.js';
import { sequenceFromNotes, makeSong } from '../learn/song.js';

export function studioMode(ui) {
  const app = ui.app, S = app.studio, tr = app.transport;
  let offs = [], posEl = h('b', {}, '1.1'), recPill = h('span.pill', {}, ''), raf = 0, tracksSheet = null;

  const armed = () => S.track(S.armed);
  function bindArmed() {
    const t = armed();
    if (!t) { app.usePerformerChannel(null); return; }
    if (app.instrument.id !== t.instrument) app.setInstrument(t.instrument, { silent: true });
    app.engine.unlock();
    const ch = S.channelFor(t);
    if (ch) app.usePerformerChannel(ch);
  }

  function buildDock() {
    const playB = btn(null, () => { app.engine.unlock(); app.transportOwner = 'studio'; if (tr.playing) S.stop(); else S.play(); }, { icon: tr.playing ? 'stop' : 'play', cls: 'icon-only', title: 'Tocar/parar (espaço)' });
    const recB = btn(null, () => toggleRec(), { icon: 'rec', cls: 'icon-only rec', title: 'Gravar (.)' }); setPressed(recB, S.recording);
    const metro = btn(null, () => { app.metronome.enabled = !app.metronome.enabled; setPressed(metro, app.metronome.enabled); }, { icon: 'metro', cls: 'small icon-only', title: 'Metrônomo' }); setPressed(metro, app.metronome.enabled);
    const t = armed();
    ui.setDock(h('div.bar', {}, h('div.row.grow', {},
      playB, recB,
      btn(t ? t.name : 'Pistas', () => openTracks(), { icon: 'studio', cls: 'small', title: 'Pistas' }),
      metro,
      h('button.pill', { type: 'button', style: { background: 'none', border: 0, color: 'inherit' }, onclick: () => openSessionSettings() }, h('b', {}, S.session.bpm), ' BPM · ', h('b', {}, S.session.bars), ' comp.'),
      btn(null, () => S.undo(), { icon: 'undo', cls: 'small icon-only', title: 'Desfazer (Ctrl+Z)' }),
      btn(null, () => S.redo(), { icon: 'redo', cls: 'small icon-only', title: 'Refazer' }),
      btn(null, () => openFile(), { icon: 'more', cls: 'small icon-only', title: 'Sessão, exportar' }))));
    ui.setHud(h('div.hud-pill', {}, icon('studio'), h('span', {}, S.session.name), posEl, recPill));
  }
  function toggleRec() {
    app.engine.unlock(); app.transportOwner = 'studio';
    if (S.recording) { S.stopRecording(); toast('Gravação encerrada'); }
    else { if (!S.armed) S.addTrack(app.instrument.id); bindArmed(); S.startRecording(); toast(S.countIn && !tr.playing ? 'Contagem: 4 tempos…' : 'Gravando (overdub)'); }
    buildDock();
  }
  function tick() {
    raf = requestAnimationFrame(tick);
    if (!tr.playing) return;
    const b = tr.beatNow(), loop = S.loopBeats;
    if (b < 0) { posEl.textContent = 'conta ' + Math.ceil(-b); return; }
    const lb = ((b % loop) + loop) % loop;
    posEl.textContent = `${Math.floor(lb / 4) + 1}.${Math.floor(lb % 4) + 1}`;
    for (const c of document.querySelectorAll('canvas[data-trk]')) drawTrack(c, S.track(c.dataset.trk), lb / loop);
    const grid = document.querySelector('.stepgrid'); if (grid) { const step = Math.floor((lb % 4) * 4) + (Math.floor(lb / 4) === Number(grid.dataset.bar) ? 0 : 99); for (const btnEl of grid.querySelectorAll('button')) btnEl.classList.toggle('now', Number(btnEl.dataset.s) === step); }
  }

  // ───────────── pistas
  function openTracks() {
    const list = h('div.tracks');
    const render = () => {
      list.replaceChildren(...S.session.tracks.map((t) => {
        const inst = getInstrument(t.instrument);
        const cv = h('canvas', { 'data-trk': t.id, width: 600, height: 52 });
        const m = btn('M', () => { S.update(t.id, { mute: !t.mute }); render(); }, { cls: 'small', title: 'Silenciar' }); setPressed(m, t.mute);
        const s = btn('S', () => { S.update(t.id, { solo: !t.solo }); render(); }, { cls: 'small', title: 'Solo' }); setPressed(s, t.solo);
        const arm = btn(null, () => { S.arm(t.id); bindArmed(); render(); buildDock(); }, { icon: 'rec', cls: 'small icon-only', title: 'Armar para gravar' }); setPressed(arm, S.armed === t.id);
        const row = h('div.track' + (S.armed === t.id ? '.armed' : ''), {},
          h('span.color', { style: { background: `hsl(${t.hue},80%,60%)` } }),
          h('div', { style: { minWidth: 0 } }, h('div.tname', {}, t.name, h('small.muted', {}, ` · ${inst.name} · ${t.notes.length} notas`)), cv),
          h('div.tbtns', {}, arm, m, s, btn(null, () => trackMenu(t, render), { icon: 'more', cls: 'small icon-only', title: 'Mais' })));
        requestAnimationFrame(() => drawTrack(cv, t, -1));
        return row;
      }));
      if (!S.session.tracks.length) list.append(h('p.note', {}, 'Nenhuma pista. Adicione um instrumento ou uma bateria pronta, ou só toque e aperte gravar.'));
    };
    render();
    const off = S.on('change', render);
    tracksSheet = openSheet({ title: 'Pistas', id: 'tracks', size: 'lg', onClose: () => { off(); tracksSheet = null; }, content: [
      list,
      h('div.actions', {},
        btn('Instrumento', () => openInstrumentSheet(ui, { onPick: (id) => { S.addTrack(id); bindArmed(); buildDock(); }, title: 'Nova pista' }), { icon: 'plus', cls: 'small' }),
        btn('Bateria pronta', () => drumPicker(), { icon: 'drum', cls: 'small' }),
        btn('Jam completa', () => jamPicker(), { icon: 'spark', cls: 'small' })),
      h('div.section-title', {}, 'Gravação'),
      toggle({ label: 'Contagem antes de gravar', value: S.countIn, onChange: (v) => { S.countIn = v; } }),
      toggle({ label: 'Quantizar ao gravar', hint: 'Alinha as notas à grade escolhida.', value: S.quantizeOnRecord, onChange: (v) => { S.quantizeOnRecord = v; } }),
      select({ label: 'Grade', value: S.session.quantize, options: [[0.25, '1/16'], [0.5, '1/8'], [1, '1/4'], [0.3333, 'tercina']], onChange: (v) => { S.session.quantize = Number(v); } }),
    ] });
  }
  function trackMenu(t, rerender) {
    const isDrum = getInstrument(t.instrument).engine === 'drum';
    const sheet = openSheet({ title: t.name, id: 'tmenu', content: [
      h('input.text-input', { value: t.name, onchange: (e) => S.update(t.id, { name: e.target.value || t.name }) }),
      slider({ label: 'Volume', min: 0, max: 1.2, value: t.volume, format: (v) => Math.round(v * 100) + '%', onInput: (v) => S.update(t.id, { volume: v }) }),
      slider({ label: 'Pan', min: -1, max: 1, value: t.pan, format: (v) => (Math.abs(v) < 0.05 ? 'centro' : v < 0 ? 'E ' + Math.round(-v * 100) : 'D ' + Math.round(v * 100)), onInput: (v) => S.update(t.id, { pan: v }) }),
      h('div.grid2', {},
        h('button', { type: 'button', onclick: () => { sheet.close(); editNotes(t); } }, isDrum ? 'Editar passos' : 'Editar notas'),
        h('button', { type: 'button', onclick: () => { S.quantizeTrack(t.id); toast('Quantizado'); } }, 'Quantizar'),
        isDrum ? null : h('button', { type: 'button', onclick: () => S.transposeTrack(t.id, 12) }, 'Oitava +'),
        isDrum ? null : h('button', { type: 'button', onclick: () => S.transposeTrack(t.id, -12) }, 'Oitava −'),
        h('button', { type: 'button', onclick: () => openFxSheet(ui, { state: t.fx, title: `Pedais · ${t.name}`, onChange: (fx) => S.update(t.id, { fx: structuredClone(fx) }) }) }, 'Pedais'),
        h('button', { type: 'button', onclick: () => openInstrumentSheet(ui, { onPick: (id) => { S.update(t.id, { instrument: id }, true); if (S.armed === t.id) bindArmed(); rerender(); }, title: 'Trocar instrumento' }) }, 'Trocar timbre'),
        h('button', { type: 'button', onclick: () => { S.duplicateTrack(t.id); sheet.close(); } }, 'Duplicar'),
        h('button', { type: 'button', onclick: () => { S.clearTrack(t.id); } }, 'Limpar notas'),
        isDrum ? null : h('button', { type: 'button', onclick: () => { sheet.close(); toGenius(t); } }, 'Desafio no Genius'),
        isDrum ? null : h('button', { type: 'button', onclick: () => { sheet.close(); toLesson(t); } }, 'Virar lição'),
        h('button', { type: 'button', style: { color: 'var(--rose)' }, onclick: () => { S.removeTrack(t.id); sheet.close(); bindArmed(); buildDock(); } }, 'Apagar pista')),
    ] });
  }
  function drumPicker() {
    const sheet = openSheet({ title: 'Bateria pronta', id: 'drums', content: [
      h('p.note', {}, 'Padrões originais por gênero, com variações a cada vez. O andamento da sessão é ajustado ao estilo.'),
      h('div.grid3', {}, ...Object.entries(DRUM_STYLES).map(([id, st]) => h('button', { type: 'button', onclick: () => {
        const kit = st.kit === 'brazil' ? 'drumsBrazil' : st.kit === 'electro' ? 'drumsElectro' : 'drumsAcoustic';
        const t = S.addTrack(kit, { name: 'Bateria ' + st.name });
        S.setNotes(t.id, generateDrums(id, S.session.bars, { seed: Math.floor(Math.random() * 999) }), false);
        S.setBpm(st.bpm); S.session.swing = st.swing ?? 0;
        sheet.close(); toast(`${st.name} · ${st.bpm} BPM`); buildDock();
      } }, st.name))),
    ] });
  }
  function jamPicker() {
    const sheet = openSheet({ title: 'Jam completa', id: 'jamp', content: [
      h('p.note', {}, 'Substitui a sessão atual por bateria, baixo e acordes no seu tom (dá para desfazer).'),
      h('div.grid2', {}, ...Object.entries(JAM_NAMES).map(([id, n]) => h('button', { type: 'button', onclick: () => { S.snapshot(); const s = buildJamSession(app, id); S.restore(s); tr.setBpm(s.bpm); sheet.close(); tracksSheet?.close(); buildDock(); toast(`${n}: ${s.chords.join(' · ')}`); } }, n))),
    ] });
  }

  // ───────────── edição
  function editNotes(t) {
    const isDrum = getInstrument(t.instrument).engine === 'drum';
    if (isDrum) return stepEditor(t);
    pianoRoll(t);
  }
  function stepEditor(t) {
    const kit = KITS[getInstrument(t.instrument).kit] ?? KITS.electro;
    let bar = 0;
    const grid = h('div.stepgrid');
    const render = () => {
      grid.dataset.bar = bar;
      grid.replaceChildren(...kit.lanes.map((l) => h('div.lane', { style: { '--lc': l.color } }, h('span', {}, l.name), ...Array.from({ length: 16 }, (_, s) => {
        const b = bar * 4 + s * 0.25;
        const on = t.notes.some((n) => n.m === l.m && Math.abs(n.b - b) < 0.01);
        return h('button' + (on ? '.on' : ''), { type: 'button', 'data-s': s, 'aria-label': `${l.name} passo ${s + 1}`, onclick: () => { S.toggleNote(t.id, b, l.m, 0.25); render(); } });
      }))));
    };
    render();
    const barSeg = segmented(Array.from({ length: S.session.bars }, (_, i) => [String(i), 'Comp. ' + (i + 1)]), '0', (v) => { bar = Number(v); render(); });
    openSheet({ title: 'Passos · ' + t.name, id: 'steps', size: 'lg', content: [barSeg, grid, h('div.actions', {}, btn('Copiar para todos os compassos', () => {
      const src = t.notes.filter((n) => n.b >= bar * 4 && n.b < bar * 4 + 4);
      const out = []; for (let k = 0; k < S.session.bars; k++) out.push(...src.map((n) => ({ ...n, b: n.b - bar * 4 + k * 4 })));
      S.setNotes(t.id, out.sort((a, b) => a.b - b.b)); render(); toast('Padrão copiado');
    }, { icon: 'copy', cls: 'small' }))] });
  }
  function pianoRoll(t) {
    const cv = h('canvas.roll');
    const loop = S.loopBeats;
    const ms = t.notes.map((n) => n.m);
    let lo = Math.min(...ms, 60) - 2, hi = Math.max(...ms, 72) + 2;
    if (hi - lo < 14) hi = lo + 14;
    const draw = () => {
      const r = cv.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
      cv.width = r.width * dpr; cv.height = r.height * dpr;
      const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
      const W = r.width, H = r.height, rows = hi - lo + 1, rh = H / rows;
      c.fillStyle = '#0b0c16'; c.fillRect(0, 0, W, H);
      for (let m = lo; m <= hi; m++) { const y = H - (m - lo + 1) * rh; if ([1, 3, 6, 8, 10].includes(m % 12)) { c.fillStyle = 'rgba(255,255,255,.03)'; c.fillRect(0, y, W, rh); } if (m % 12 === app.music.root) { c.fillStyle = 'rgba(127,242,207,.06)'; c.fillRect(0, y, W, rh); } }
      for (let b = 0; b <= loop * 4; b++) { const x = b / 4 / loop * W; c.fillStyle = b % 16 === 0 ? 'rgba(255,255,255,.25)' : b % 4 === 0 ? 'rgba(255,255,255,.1)' : 'rgba(255,255,255,.04)'; c.fillRect(x, 0, 1, H); }
      for (const n of t.notes) { if (n.m < lo || n.m > hi) continue; const x = n.b / loop * W, w = Math.max(3, (n.d ?? 0.25) / loop * W), y = H - (n.m - lo + 1) * rh; c.fillStyle = `hsla(${t.hue},85%,${50 + (n.v ?? 0.8) * 20}%,.95)`; c.fillRect(x, y + 1, w, rh - 2); }
      c.fillStyle = 'rgba(255,255,255,.5)'; c.font = '10px system-ui';
      for (let m = lo; m <= hi; m++) if (m % 12 === 0) c.fillText(noteName(m, true), 3, H - (m - lo) * rh - 3);
    };
    cv.addEventListener('pointerdown', (e) => {
      const r = cv.getBoundingClientRect();
      const grid = S.session.quantize || 0.25;
      const b = Math.floor((e.clientX - r.left) / r.width * loop / grid) * grid;
      const m = hi - Math.floor((e.clientY - r.top) / r.height * (hi - lo + 1));
      const hit = t.notes.find((n) => n.m === m && b >= n.b - 0.01 && b < n.b + (n.d ?? 0.25));
      if (hit) S.deleteNote(t.id, hit); else { S.toggleNote(t.id, b, m, grid); S.channelFor(t)?.play({ midi: m, vel: 0.7 }); }
      draw();
    });
    openSheet({ title: 'Notas · ' + t.name, id: 'roll', size: 'lg', content: [h('p.note', {}, 'Toque numa célula vazia para criar uma nota; toque numa nota para apagar. A grade segue a quantização da sessão.'), cv,
      h('div.row', {}, btn('Mais agudo', () => { lo += 6; hi += 6; draw(); }, { icon: 'plus', cls: 'small' }), btn('Mais grave', () => { lo -= 6; hi -= 6; draw(); }, { icon: 'minus', cls: 'small' }))] });
    requestAnimationFrame(draw);
  }
  function drawTrack(cv, t, playhead) {
    if (!cv || !t) return;
    const c = cv.getContext('2d'), W = cv.width, H = cv.height, loop = S.loopBeats;
    c.clearRect(0, 0, W, H);
    const ms = t.notes.map((n) => n.m), lo = Math.min(...ms, 127), hi = Math.max(...ms, 0), span = Math.max(1, hi - lo);
    c.fillStyle = `hsl(${t.hue},85%,62%)`;
    for (const n of t.notes) { const x = n.b / loop * W, w = Math.max(2, (n.d ?? 0.25) / loop * W), y = H - 6 - (n.m - lo) / span * (H - 12); c.fillRect(x, y - 2, w, 4); }
    if (playhead >= 0) { c.fillStyle = 'rgba(255,255,255,.8)'; c.fillRect(playhead * W, 0, 2, H); }
  }

  // ───────────── sessão
  function openSessionSettings() {
    const nameIn = h('input.text-input', { value: S.session.name, onchange: (e) => { S.session.name = e.target.value || 'Sessão'; buildDock(); } });
    const bpmOut = h('span.big-num', {}, S.session.bpm);
    const setB = (v) => { v = Math.max(40, Math.min(220, Math.round(v))); S.setBpm(v); bpmOut.textContent = v; buildDock(); };
    openSheet({ title: 'Sessão', id: 'sset', content: [
      nameIn,
      h('div.section-title', {}, 'Andamento'),
      h('div.row.center', {}, btn('−5', () => setB(S.session.bpm - 5), { cls: 'small' }), btn('−1', () => setB(S.session.bpm - 1), { cls: 'small' }), bpmOut, btn('+1', () => setB(S.session.bpm + 1), { cls: 'small' }), btn('+5', () => setB(S.session.bpm + 5), { cls: 'small' })),
      tapTempo(app, setB),
      h('div.section-title', {}, 'Tamanho do loop'),
      segmented([['1', '1'], ['2', '2'], ['4', '4'], ['8', '8'], ['16', '16']], String(S.session.bars), (v) => { S.setBars(Number(v)); buildDock(); }),
      slider({ label: 'Swing', min: 0, max: 0.7, value: S.session.swing ?? 0, format: (v) => Math.round(v * 100) + '%', onInput: (v) => { S.session.swing = v; } }),
    ] });
  }
  async function openFile() {
    let saved = [];
    try { saved = (await db.all('sessions')).sort((a, b) => (b.savedAt ?? 0) - (a.savedAt ?? 0)); } catch { /* */ }
    const prog = h('div.progress', { style: { display: 'none' } }, h('i'));
    const sheet = openSheet({ title: 'Sessão e exportação', id: 'sfile', content: [
      h('div.actions', {},
        btn('Salvar', async () => { const s = structuredClone(S.session); s.savedAt = Date.now(); try { await db.put('sessions', s); toast('Sessão salva'); } catch (e) { toast('Erro ao salvar: ' + e.message); } }, { icon: 'download', cls: 'primary' }),
        btn('Nova', () => { S.snapshot(); S.restore(newSession({ bpm: S.session.bpm, key: { root: app.music.root, scale: app.music.scale } })); sheet.close(); buildDock(); }, { icon: 'plus' })),
      h('div.section-title', {}, 'Exportar'),
      h('div.actions', {},
        btn('Áudio WAV', async () => {
          if (!S.session.tracks.some((t) => t.notes.length)) { toast('Grave algo antes de exportar'); return; }
          prog.style.display = 'block';
          try { const blob = await S.exportWav(2, (p) => { prog.firstChild.style.width = Math.round(p * 100) + '%'; }); download(blob, slug(S.session.name) + '.wav'); toast('WAV exportado'); }
          catch (e) { toast('Falha ao renderizar: ' + e.message); }
          prog.style.display = 'none';
        }, { icon: 'wave' }),
        btn('MIDI', () => download(S.exportMidi(), slug(S.session.name) + '.mid'), { icon: 'music' }),
        btn('Sessão (.json)', () => download(new Blob([JSON.stringify(S.session)], { type: 'application/json' }), slug(S.session.name) + '.fingmusic-session.json'), { icon: 'copy' })),
      prog,
      h('div.section-title', {}, 'Sessões salvas'),
      saved.length ? h('div.list', {}, ...saved.map((s) => h('div.item', {},
        h('span.meta', { onclick: () => { S.load(structuredClone(s)); tr.setBpm(s.bpm); sheet.close(); buildDock(); toast('Sessão aberta'); }, style: { cursor: 'pointer' } }, h('div.name', {}, s.name), h('div.desc', {}, `${s.tracks.length} pistas · ${s.bpm} BPM · ${new Date(s.savedAt ?? s.createdAt).toLocaleString()}`)),
        btn(null, async () => { await db.del('sessions', s.id); sheet.close(); openFile(); }, { icon: 'trash', cls: 'small icon-only', title: 'Apagar' })))) : h('p.note', {}, 'Nenhuma sessão salva ainda.'),
    ] });
  }
  function toGenius(t) {
    if (!t.notes.length) { toast('Pista vazia'); return; }
    const code = encodeSequence(sequenceFromNotes(t.notes).slice(0, 32), { title: t.name, inst: t.instrument });
    ui.go('genius', { challengeCode: code, instrument: t.instrument });
  }
  async function toLesson(t) {
    if (!t.notes.length) { toast('Pista vazia'); return; }
    const others = S.session.tracks.filter((x) => x !== t && x.notes.length);
    const song = makeSong({ id: 'les-' + Date.now().toString(36), title: `${S.session.name} · ${t.name}`, composer: 'Você', license: 'user', kind: 'song', genre: 'minhas', tempo: [{ b: 0, bpm: S.session.bpm }],
      tracks: [{ id: 'main', name: t.name, role: 'melody', instrument: t.instrument, notes: t.notes.map(({ _id, ...n }) => n) }, ...others.map((o, i) => ({ id: 'acc' + i, name: o.name, role: 'accompaniment', instrument: o.instrument, volume: o.volume, notes: o.notes.map(({ _id, ...n }) => n) }))],
      defaultTrack: 'main', length: S.loopBeats });
    try { await db.put('songs', song); } catch { /* */ }
    ui.go('learn', { song, mode: 'guided' });
  }

  return {
    enter(params = {}) {
      app.setSurfaceOptions({});
      app.transportOwner = 'studio';
      if (!S.session.tracks.length && !params.keep) S.session.key = { root: app.music.root, scale: app.music.scale };
      tr.setBpm(S.session.bpm); tr.setLoop(0, S.loopBeats);
      offs = [
        S.on('change', () => { if (!tracksSheet) buildDock(); }),
        S.on('record', (on) => { recPill.innerHTML = on ? '<b style="color:#ff6b81">● REC</b>' : ''; buildDock(); }),
        tr.on('start', buildDock), tr.on('stop', buildDock),
        tr.on('countin', (c) => ui.message(String(c.left), 'gravando em…', 600)),
        app.on('instrument', () => { /* troca manual de timbre: arma uma pista nova ao gravar */ }),
      ];
      if (S.armed) bindArmed(); else app.usePerformerChannel(null);
      buildDock();
      tick();
      if (params.recordNow) { if (!S.session.tracks.some((t) => t.instrument === app.instrument.id)) S.addTrack(app.instrument.id); else S.arm(S.session.tracks.find((t) => t.instrument === app.instrument.id).id); bindArmed(); toggleRec(); }
      else if (!S.session.tracks.length) openTracks();
    },
    exit() {
      cancelAnimationFrame(raf);
      if (S.recording) S.stopRecording();
      S.stop();
      app.metronome.enabled = false;
      app.usePerformerChannel(null);
      offs.forEach((f) => f()); offs = [];
    },
    shortcut(s) { if (s === 'playpause') { app.transportOwner = 'studio'; if (tr.playing) S.stop(); else S.play(); } else if (s === 'record') toggleRec(); else if (s === 'metronome') { app.metronome.enabled = !app.metronome.enabled; buildDock(); } },
  };
}
const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'sessao';
export { INSTRUMENTS };
