/**
 * Aprender (Follow the Lights): biblioteca com filtros, detalhes da música
 * (pista, modo, velocidade, trecho), importação MIDI/JSON com escolha
 * explícita de adaptação, HUD de prática e tela de resultado com os trechos
 * mais difíceis. O progresso fica no IndexedDB.
 */
import { h, btn, setPressed, segmented, select, slider, pickFile, download, icon } from '../ui/dom.js';
import { openSheet, toast } from '../ui/sheet.js';
import { LIBRARY, songById, GENRES } from '../learn/library.js';
import { LEARN_MODES } from '../learn/practice.js';
import { KINDS, fitCheck, applyFit, instrumentRange, makeSong, normalizeSong, sequenceFromNotes } from '../learn/song.js';
import { GRADES } from '../learn/evaluator.js';
import { TECH_LABEL } from '../light/lighting.js';
import { getInstrument } from '../instruments/catalog.js';
import { parseMidi, instrumentForProgram } from '../core/midi.js';
import { db } from '../persist/db.js';
import { uid } from '../core/util.js';
import { encodeSequence } from '../genius/generator.js';

const STARS = (acc) => (acc >= 0.95 ? 3 : acc >= 0.8 ? 2 : acc >= 0.55 ? 1 : 0);

export function learnMode(ui) {
  const app = ui.app, P = app.practice;
  let offs = [], userSongs = [], progress = {}, current = null, opts = null, prevInst = null, combo = 0;
  const hudTitle = h('b', {}, ''), bar = h('div.progress', {}, h('i')), comboEl = h('span.pill', {}, ''), judgeEl = h('span.pill', {}, '');

  async function loadUser() {
    try { userSongs = (await db.all('songs')).map((s) => { try { return normalizeSong(s); } catch { return null; } }).filter(Boolean); } catch { userSongs = []; }
    try { progress = Object.fromEntries((await db.all('progress')).map((p) => [p.id, p])); } catch { progress = {}; }
  }
  const allSongs = () => [...userSongs, ...LIBRARY];

  // ───────────── biblioteca
  async function openLibrary() {
    await loadUser();
    let kind = 'all', genre = 'all', diff = 0, q = '';
    const list = h('div.list');
    const render = () => {
      const items = allSongs().filter((s) => (kind === 'all' || (kind === 'mine' ? s.license === 'user' || s.imported : s.kind === kind || (kind === 'groove' && s.kind === 'riff')))
        && (genre === 'all' || s.genre === genre) && (!diff || s.difficulty === diff) && (!q || (s.title + ' ' + (s.composer ?? '') + ' ' + (s.genre ?? '')).toLowerCase().includes(q)));
      list.replaceChildren(...items.map((s) => {
        const p = progress[s.id], inst = getInstrument(s.tracks.find((t) => t.id === s.defaultTrack)?.instrument ?? 'harp');
        return h('button.item', { type: 'button', onclick: () => { sheet.close(); openDetail(s); } },
          h('span.swatch', { style: { background: `hsl(${inst.hue},80%,60%)` } }),
          h('span.meta', {}, h('div.name', {}, s.title), h('div.desc', {}, [KINDS[s.kind] ?? s.kind, s.composer, '●'.repeat(s.difficulty ?? 1)].filter(Boolean).join(' · '))),
          p ? h('span.tag', {}, '★'.repeat(p.stars ?? 0) + '☆'.repeat(3 - (p.stars ?? 0))) : null);
      }));
      if (!items.length) list.append(h('p.note', {}, 'Nada encontrado com esses filtros.'));
    };
    const search = h('input.text-input', { type: 'search', placeholder: 'Buscar música, compositor ou estilo', oninput: (e) => { q = e.target.value.toLowerCase().trim(); render(); } });
    const sheet = openSheet({ title: 'Biblioteca', id: 'lib', size: 'lg', content: [
      search,
      h('div', { style: { height: '8px' } }),
      segmented([['all', 'Tudo'], ['song', 'Músicas'], ['groove', 'Grooves'], ['technique', 'Técnicas'], ['exercise', 'Exercícios'], ['ear', 'Ouvido'], ['progression', 'Progressões'], ['mine', 'Minhas']], kind, (v) => { kind = v; render(); }),
      h('div.grid2', { style: { marginTop: '8px' } },
        select({ label: 'Estilo', value: genre, options: [['all', 'Todos'], ...GENRES.map((g) => [g, g])], onChange: (v) => { genre = v; render(); } }),
        select({ label: 'Dificuldade', value: diff, options: [[0, 'Todas'], [1, '● Fácil'], [2, '●● Média'], [3, '●●● Difícil']], onChange: (v) => { diff = Number(v); render(); } })),
      h('div.actions', {}, btn('Importar MIDI', importMidi, { icon: 'upload', cls: 'small' }), btn('Importar lição (.json)', importJson, { icon: 'upload', cls: 'small' })),
      h('div.section-title', {}, 'Conteúdo'), list,
      h('p.note', {}, 'Melodias clássicas em domínio público com arranjos originais e composições originais do Fingmusic. Arquivos importados ficam só neste aparelho.'),
    ] });
    render();
  }

  // ───────────── detalhes e opções
  function openDetail(song, preset = {}) {
    let trackId = preset.trackId ?? song.defaultTrack, mode = preset.mode ?? (song.kind === 'technique' ? 'step' : 'guided'), rate = preset.rate ?? 1, sectionIdx = preset.sectionIdx ?? -1, guide = null, fitChoice = null;
    const body = h('div');
    const render = () => {
      const track = song.tracks.find((t) => t.id === trackId) ?? song.tracks[0];
      const inst = getInstrument(track.instrument);
      const range = instrumentRange(inst.id);
      const fit = inst.surface === 'strings' ? { fits: true, options: [] } : fitCheck(track, range);
      const fitBox = fit.fits ? null : h('div', {}, h('p.note', {}, `${fit.out} nota(s) desta pista ficam fora da extensão do ${inst.name}. Escolha como adaptar (nada muda sem a sua escolha):`),
        h('div.list', {}, ...fit.options.map((o) => { const b = h('button.item' + (fitChoice?.id === o.id ? '.on' : ''), { type: 'button', onclick: () => { fitChoice = o; render(); } }, h('span.meta', {}, h('div.name', {}, o.label))); return b; })));
      body.replaceChildren(
        song.description ? h('p.note', {}, song.description) : null,
        h('dl.kv', {}, h('dt', {}, 'Tipo'), h('dd', {}, KINDS[song.kind] ?? song.kind), h('dt', {}, 'Autor'), h('dd', {}, song.composer ?? '—'), h('dt', {}, 'Andamento'), h('dd', {}, Math.round(song.tempo[0].bpm) + ' BPM'),
          h('dt', {}, 'Técnicas'), h('dd', {}, (song.techniques ?? []).map((t) => TECH_LABEL[t] ?? t).join(', ') || '—'), progress[song.id] ? h('dt', {}, 'Seu melhor') : null, progress[song.id] ? h('dd', {}, `${Math.round(progress[song.id].best * 100)}% · ${'★'.repeat(progress[song.id].stars)}`) : null),
        h('div.section-title', {}, 'Sua parte'),
        h('div.list', {}, ...song.tracks.map((t) => h('button.item' + (t.id === trackId ? '.on' : ''), { type: 'button', onclick: () => { trackId = t.id; fitChoice = null; render(); } }, h('span.swatch', { style: { background: `hsl(${getInstrument(t.instrument).hue},80%,60%)` } }), h('span.meta', {}, h('div.name', {}, t.name), h('div.desc', {}, getInstrument(t.instrument).name + ` · ${t.notes.length} notas`))))),
        h('p.note', {}, 'As outras pistas tocam como acompanhamento.'),
        fitBox,
        h('div.section-title', {}, 'Modo'),
        h('div.list', {}, ...Object.entries(LEARN_MODES).map(([id, m]) => h('button.item' + (id === mode ? '.on' : ''), { type: 'button', onclick: () => { mode = id; render(); } }, h('span.meta', {}, h('div.name', {}, m.name), h('div.desc', {}, m.desc))))),
        mode !== 'step' ? h('div.section-title', {}, 'Velocidade') : null,
        mode !== 'step' ? segmented([['0.5', '50%'], ['0.75', '75%'], ['0.9', '90%'], ['1', '100%'], ['1.15', '115%']], String(rate), (v) => { rate = Number(v); }) : null,
        mode === 'practice' || mode === 'memory' ? select({ label: 'Trecho em loop', value: sectionIdx, options: [[-1, 'Música inteira'], ...song.sections.map((s, i) => [i, `${s.name} (compassos ${s.from / 4 + 1}–${s.to / 4})`])], onChange: (v) => { sectionIdx = Number(v); } }) : null,
        mode === 'guided' || mode === 'practice' ? slider({ label: 'Volume da guia (sua parte tocada junto)', min: 0, max: 1, value: guide ?? 0.25, format: (v) => Math.round(v * 100) + '%', onInput: (v) => { guide = v; } }) : null,
        h('div.actions', {},
          btn('Começar', () => { if (!fit.fits && !fitChoice) { toast('Escolha como adaptar a pista'); return; } sheet.close(); begin(song, { mode, trackId, rate, section: sectionIdx >= 0 ? song.sections[sectionIdx] : null, guideVolume: guide ?? undefined, fit: fitChoice, range }); }, { icon: 'play', cls: 'primary' }),
          btn('Levar ao Genius', () => { const t = song.tracks.find((x) => x.id === trackId); const code = encodeSequence(sequenceFromNotes(t.notes).slice(0, 32), { title: song.title, inst: t.instrument }); sheet.close(); ui.go('genius', { challengeCode: code, instrument: t.instrument }); }, { icon: 'brain', cls: 'small' }),
          btn('Biblioteca', () => { sheet.close(); openLibrary(); }, { icon: 'book', cls: 'small' }),
          song.license === 'user' ? btn('Exportar', () => download(new Blob([JSON.stringify(song, null, 1)], { type: 'application/json' }), slug(song.title) + '.fingmusic.json'), { icon: 'download', cls: 'small' }) : null),
      );
    };
    const sheet = openSheet({ title: song.title, id: 'detail', size: 'lg', content: body });
    render();
  }

  // ───────────── execução
  function begin(song, o) {
    current = song; opts = o;
    let track = song.tracks.find((t) => t.id === o.trackId) ?? song.tracks[0];
    if (o.fit) track = applyFit(track, o.fit, o.range);
    const inst = getInstrument(track.instrument);
    app.engine.unlock();
    app.setInstrument(inst.id, { silent: true });
    const uniq = [...new Set(track.notes.map((n) => n.m))].sort((a, b) => a - b);
    if (inst.surface === 'strings' || inst.surface === 'mallets' || inst.surface === 'theremin' || inst.surface === 'pads') app.surface.setNotes(uniq.length > 26 ? null : uniq);
    else if (inst.surface === 'keys') { const lo = uniq[0], hi = uniq[uniq.length - 1]; app.surface.setNotes(hi - lo <= 24 ? Array.from({ length: hi - lo + 1 }, (_, i) => lo + i) : uniq); }
    else if (inst.surface === 'fretboard') { const lo = uniq[0]; const s = app.surface; if (o.fit?.id === 'expand' || lo == null) s.position = 0; }
    app.layoutSurface();
    P.load(song, { ...o, notesOverride: track.notes });
    hudTitle.textContent = song.title;
    combo = 0; comboEl.textContent = ''; judgeEl.textContent = LEARN_MODES[o.mode].name;
    buildDock();
    if (!app.engine.ready) { ui.message('Toque na tela para começar', 'O áudio precisa de um toque para iniciar'); const once = app.on('touch', () => { once(); ui.hideMessage(); setTimeout(() => P.start(), 60); }); return; }
    P.start();
  }
  function buildDock() {
    const step = P.mode === 'step';
    const playBtn = btn(null, () => { if (!P.active) P.start(); else if (app.transport.playing) P.pause(); else P.resume(); }, { icon: 'pause', cls: 'icon-only', title: 'Pausar/continuar (espaço)' });
    const syncPlay = () => { playBtn.querySelector('.ic').innerHTML = icon(app.transport.playing ? 'pause' : 'play').innerHTML; };
    const speed = segmented([['0.5', '50%'], ['0.75', '75%'], ['1', '100%']], String(P.rate), (v) => P.setRate(Number(v)));
    ui.setDock(h('div.bar', {}, h('div.row.grow', {},
      step ? btn('Ouvir a nota', () => P.hint(), { icon: 'ear', cls: 'small' }) : playBtn,
      btn(null, () => P.start(), { icon: 'repeat', cls: 'small icon-only', title: 'Recomeçar' }),
      step ? null : speed,
      btn('Opções', () => openDetail(current, { mode: P.mode, trackId: P.track.id, rate: P.rate }), { icon: 'gear', cls: 'small' }),
      btn('Biblioteca', () => { P.stop(); openLibrary(); }, { icon: 'book', cls: 'small' }))));
    ui.setHud(h('div.hud-pill', {}, hudTitle, bar, judgeEl, comboEl));
    offs.push(app.transport.on('start', syncPlay), app.transport.on('pause', syncPlay), app.transport.on('stop', syncPlay));
    syncPlay();
  }

  async function showResult(r) {
    const s = r.summary, stars = STARS(s.accuracy);
    const id = r.song.id, prev = progress[id];
    const rec = { id, best: Math.max(prev?.best ?? 0, s.accuracy), stars: Math.max(prev?.stars ?? 0, stars), plays: (prev?.plays ?? 0) + 1, last: Date.now(), history: [...(prev?.history ?? []).slice(-19), { at: Date.now(), mode: r.mode, rate: r.rate, accuracy: s.accuracy, timing: s.timing }] };
    try { await db.put('progress', rec); progress[id] = rec; } catch { /* modo privado */ }
    const hard = r.sections.filter((x) => x.total && x.rate > 0.25).slice(0, 3);
    const listen = r.mode === 'listen';
    const sheet = openSheet({ title: listen ? 'Fim da audição' : 'Resultado', id: 'result', content: [
      listen ? h('p', {}, 'Agora tente tocar no modo Guiado ou Passo a passo.') : h('div', { style: { textAlign: 'center', padding: '8px 0' } }, h('div.big-num', {}, Math.round(s.accuracy * 100) + '%'), h('div', { style: { fontSize: '26px', letterSpacing: '4px' } }, '★'.repeat(stars) + '☆'.repeat(3 - stars)), prev && s.accuracy > prev.best ? h('p.muted', {}, 'Novo recorde pessoal!') : null),
      listen ? null : h('dl.kv', {}, ...['perfect', 'good', 'ok', 'miss', 'wrong'].flatMap((g) => [h('dt', {}, GRADES[g]), h('dd', {}, s[g])]),
        h('dt', {}, 'Tempo'), h('dd', {}, `${s.tendency} (${s.meanOffsetMs > 0 ? '+' : ''}${s.meanOffsetMs} ms, variação ${s.consistencyMs} ms)`),
        s.technique != null ? h('dt', {}, 'Técnica') : null, s.technique != null ? h('dd', {}, Math.round(s.technique * 100) + '%') : null),
      hard.length ? h('div.section-title', {}, 'Trechos para praticar') : null,
      ...hard.map((x) => h('button.item', { type: 'button', onclick: () => { sheet.close(); begin(r.song, { ...opts, mode: 'practice', rate: Math.min(opts.rate ?? 1, 0.75), section: x }); } }, h('span.meta', {}, h('div.name', {}, x.name), h('div.desc', {}, `${x.errors} de ${x.total} notas com erro · praticar em loop a 75%`)))),
      h('div.actions', {},
        btn('Tocar de novo', () => { sheet.close(); begin(r.song, opts); }, { icon: 'repeat', cls: 'primary' }),
        !listen && s.accuracy > 0.8 && opts.mode !== 'performance' ? btn('Próximo nível', () => { const order = ['listen', 'step', 'guided', 'practice', 'memory', 'performance']; sheet.close(); begin(r.song, { ...opts, mode: order[Math.min(order.length - 1, order.indexOf(opts.mode) + 1)], rate: 1 }); }, { icon: 'lightning' }) : null,
        btn('Biblioteca', () => { sheet.close(); openLibrary(); }, { icon: 'book' })),
    ] });
  }

  // ───────────── importação
  async function importMidi() {
    const f = await pickFile('audio/midi,audio/x-midi,.mid,.midi'); if (!f) return;
    try {
      const buf = await f.arrayBuffer();
      const m = parseMidi(buf);
      if (!m.tracks.length) throw new Error('nenhuma nota encontrada');
      const id = uid('midi');
      const song = makeSong({
        id, title: f.name.replace(/\.(mid|midi)$/i, ''), composer: 'Importado', license: 'user', imported: true, kind: 'song', genre: 'importado', difficulty: 2,
        tempo: m.tempo, timeSig: m.timeSig,
        tracks: m.tracks.slice(0, 12).map((t, i) => ({ id: 't' + i, name: t.name, role: t.isDrum ? 'drums' : 'melody', instrument: instrumentForProgram(t.program, t.isDrum), volume: t.isDrum ? 0.6 : 0.75, notes: t.notes })),
      });
      song.defaultTrack = song.tracks.find((t) => t.role !== 'drums')?.id ?? song.tracks[0].id;
      await db.put('midi', { id, name: f.name, data: buf, at: Date.now() }).catch(() => {});
      await db.put('songs', song).catch(() => {});
      userSongs.unshift(song);
      toast(`${song.tracks.length} pista(s) importada(s)`);
      openDetail(song);
    } catch (e) { toast('Não foi possível ler o MIDI: ' + e.message); }
  }
  async function importJson() {
    const f = await pickFile('application/json,.json'); if (!f) return;
    try { const song = normalizeSong({ ...JSON.parse(await f.text()), license: 'user' }); song.id = song.id ?? uid('song'); await db.put('songs', song).catch(() => {}); userSongs.unshift(song); openDetail(song); }
    catch (e) { toast(e.message); }
  }

  return {
    enter(params = {}) {
      prevInst = app.instrument.id;
      app.setSurfaceOptions({});
      offs = [
        P.on('progress', (p) => { bar.firstChild.style.width = Math.min(100, (p.step != null ? p.step / p.total : p.beat / p.length) * 100) + '%'; }),
        P.on('judge', (j) => {
          if (j.grade === 'perfect' || j.grade === 'good' || j.grade === 'ok') { combo++; if (j.grade !== 'ok') app.haptics.pulse(0.25); }
          else combo = 0;
          comboEl.innerHTML = combo > 2 ? `<b>${combo}</b> seguidas` : '';
          judgeEl.textContent = GRADES[j.grade];
        }),
        P.on('end', (r) => showResult(r)),
        P.on('adapt', (a) => toast(a.direction === 'up' ? `Mandou bem! ${a.rate < 1 ? 'Velocidade ' + Math.round(a.rate * 100) + '%' : 'Menos ajuda agora'}` : `Vamos com calma: velocidade ${Math.round(a.rate * 100)}%`)),
        app.transport.on('countin', (c) => ui.message(String(c.left), null, 600)),
      ];
      ui.setHud(h('div.hud-pill', {}, icon('book'), h('b', {}, 'Aprender'), h('span.muted', {}, 'Escolha algo na biblioteca')));
      ui.setDock(h('div.bar', {}, h('div.row.grow', {}, btn('Biblioteca', openLibrary, { icon: 'book', cls: 'primary' }), btn('Importar MIDI', importMidi, { icon: 'upload', cls: 'small' }))));
      if (params.song) openDetail(params.song, params);
      else if (params.songId && songById(params.songId)) openDetail(songById(params.songId), params);
      else openLibrary();
    },
    exit() {
      P.stop();
      offs.forEach((f) => f()); offs = [];
      app.transportOwner = 'studio';
      app.lighting.anticipation = app.settings.anticipation;
      app.setInstrument(prevInst ?? app.instrument.id, { silent: true });
    },
    shortcut(s) { if (s === 'playpause' && P.active) { if (app.transport.playing) P.pause(); else P.resume(); } },
  };
}
const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'licao';
