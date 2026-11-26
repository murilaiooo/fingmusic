/**
 * Criar: (1) instrumento personalizado desenhando cordas na tela, com nota,
 * timbre e cor por corda; (2) editor de lições na notação compacta do
 * Fingmusic, com gravação direto do instrumento; (3) criador de desafios do
 * Genius com código para compartilhar.
 */
import { h, btn, segmented, select, toggle, download, pickFile, icon } from '../ui/dom.js';
import { openSheet, toast } from '../ui/sheet.js';
import { INSTRUMENTS, getInstrument } from '../instruments/catalog.js';
import { db } from '../persist/db.js';
import { uid } from '../core/util.js';
import { noteName } from '../theory/music.js';
import { seq, makeSong, normalizeSong, KINDS } from '../learn/song.js';
import { encodeSequence } from '../genius/generator.js';
import { TECH_LABEL } from '../light/lighting.js';

const LETTER = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const sci = (m) => LETTER[m % 12] + (Math.floor(m / 12) - 1);
const encode = (o) => btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const decode = (c) => JSON.parse(decodeURIComponent(escape(atob(c.replace(/-/g, '+').replace(/_/g, '/')))));

/** Converte notas gravadas (tempo em segundos) para a notação compacta. */
export function notesToText(events, bpm, grid = 0.25) {
  if (!events.length) return '';
  const spb = 60 / bpm, t0 = events[0].time, groups = [];
  for (const e of events) {
    const b = Math.round((e.time - t0) / spb / grid) * grid;
    const g = groups.find((x) => Math.abs(x.b - b) < 1e-6);
    if (g) g.ms.push(e); else groups.push({ b, ms: [e] });
  }
  let out = [];
  groups.forEach((g, i) => {
    const next = groups[i + 1]?.b ?? g.b + Math.max(grid, Math.round(((g.ms[0].dur ?? spb) / spb) / grid) * grid || 1);
    const d = Math.max(grid, +(next - g.b).toFixed(3));
    const v = Math.round(Math.max(...g.ms.map((e) => e.vel)) * 100) / 100;
    const tech = g.ms[0].tech && !['finger', 'pick'].includes(g.ms[0].tech) ? '!' + g.ms[0].tech : '';
    const name = g.ms.length > 1 ? '[' + [...new Set(g.ms.map((e) => sci(e.midi)))].join(' ') + ']' : sci(g.ms[0].midi);
    out.push(`${name}:${d}${Math.abs(v - 0.75) > 0.08 ? '@' + v : ''}${tech}`);
  });
  return out.join(' ');
}

export function createMode(ui) {
  const app = ui.app;
  let offs = [], tab = 'inst', custom = [], name = 'Meu instrumento', baseInst = 'harp', selected = null, currentId = null;

  // ───────────── instrumento personalizado
  function applySurface() {
    app.surfaceOpts = { surface: 'strings', custom };
    app.setInstrument(baseInst, { silent: true });
    app.surface.tool = tool;
  }
  let tool = 'draw';
  function instDock() {
    const toolSeg = segmented([['draw', 'Desenhar'], ['edit', 'Editar'], ['play', 'Tocar']], tool, (v) => { tool = v; app.surface.tool = v; if (v === 'draw' && !custom.length) ui.message('Arraste o dedo para criar uma corda', 'cordas longas são graves; curtas, agudas', 2200); });
    const sel = selected ? h('div.bar', {}, h('div.row.grow', {},
      h('span.pill', {}, 'Corda: ', h('b', {}, noteName(selected.midi, app.settings.noteLetters))),
      btn(null, () => editSel({ midi: selected.midi - 1 }), { icon: 'minus', cls: 'small icon-only', title: 'Meio tom abaixo' }),
      btn(null, () => editSel({ midi: selected.midi + 1 }), { icon: 'plus', cls: 'small icon-only', title: 'Meio tom acima' }),
      btn('Oitava', () => editSel({ midi: selected.midi + (selected.midi < 72 ? 12 : -24) }), { cls: 'small' }),
      btn('Timbre', () => pickStringInst(), { cls: 'small' }),
      btn('Cor', () => editSel({ hue: ((selected.hue ?? 0) + 47) % 360 }), { cls: 'small' }),
      btn(null, () => { custom.splice(custom.indexOf(selected), 1); selected = null; applySurface(); instDock(); }, { icon: 'trash', cls: 'small icon-only danger', title: 'Apagar corda' }))) : null;
    ui.setDock(sel, h('div.bar', {}, h('div.row.grow', {}, toolSeg,
      btn('Salvar', saveInst, { icon: 'download', cls: 'small' }),
      btn('Meus', openMine, { icon: 'harp', cls: 'small' }),
      btn(null, () => { custom = []; selected = null; currentId = null; applySurface(); instDock(); }, { icon: 'trash', cls: 'small icon-only', title: 'Limpar tudo' }),
      btn(null, openCreateMenu, { icon: 'more', cls: 'small icon-only', title: 'Outras criações' }))));
  }
  function editSel(patch) {
    if (!selected) return;
    Object.assign(selected, patch);
    selected.midi = Math.max(24, Math.min(96, selected.midi));
    applySurface(); instDock();
    const s = app.surface.strings.find((x) => x.custom === selected); if (s) app.surface.pluck(s, 0.6, 0.5);
  }
  function pickStringInst() {
    const sheet = openSheet({ title: 'Timbre desta corda', id: 'sinst', content: [h('div.list', {}, h('button.item', { type: 'button', onclick: () => { editSel({ inst: null }); sheet.close(); } }, h('span.meta', {}, h('div.name', {}, 'Igual ao instrumento base'))),
      ...INSTRUMENTS.filter((i) => i.engine !== 'drum').map((i) => h('button.item' + (selected?.inst === i.id ? '.on' : ''), { type: 'button', onclick: () => { editSel({ inst: i.id }); sheet.close(); } }, h('span.swatch', { style: { background: `hsl(${i.hue},80%,60%)` } }), h('span.meta', {}, h('div.name', {}, i.name)))))] });
  }
  async function saveInst() {
    if (!custom.length) { toast('Desenhe pelo menos uma corda'); return; }
    const nameIn = h('input.text-input', { value: name });
    const baseSel = select({ label: 'Timbre base', value: baseInst, options: INSTRUMENTS.filter((i) => i.engine !== 'drum').map((i) => [i.id, i.name]), onChange: (v) => { baseInst = v; applySurface(); } });
    const sheet = openSheet({ title: 'Salvar instrumento', id: 'isave', content: [nameIn, baseSel, h('div.actions', {},
      btn('Salvar', async () => { name = nameIn.value || name; currentId = currentId ?? uid('ci'); try { await db.put('instruments', { id: currentId, name, base: baseInst, custom: structuredClone(custom), at: Date.now() }); toast('Instrumento salvo'); sheet.close(); } catch (e) { toast('Erro: ' + e.message); } }, { icon: 'download', cls: 'primary' }),
      btn('Copiar código', async () => { const code = 'FMI-' + encode({ n: nameIn.value || name, b: baseInst, c: custom.map((c) => [r3(c.a.x), r3(c.a.y), r3(c.b.x), r3(c.b.y), c.midi, c.hue ?? null, c.inst ?? null]) }); try { await navigator.clipboard.writeText(code); toast('Código copiado'); } catch { prompt('Copie o código:', code); } }, { icon: 'share' }))] });
  }
  async function openMine() {
    let list = []; try { list = (await db.all('instruments')).sort((a, b) => b.at - a.at); } catch { /* */ }
    const codeIn = h('input.text-input', { placeholder: 'Cole um código FMI-… para importar' });
    const sheet = openSheet({ title: 'Meus instrumentos', id: 'mine', content: [
      list.length ? h('div.list', {}, ...list.map((it) => h('div.item', {}, h('span.meta', { style: { cursor: 'pointer' }, onclick: () => { load(it); sheet.close(); } }, h('div.name', {}, it.name), h('div.desc', {}, `${it.custom.length} cordas · ${getInstrument(it.base).name}`)), btn(null, async () => { await db.del('instruments', it.id); sheet.close(); openMine(); }, { icon: 'trash', cls: 'small icon-only' })))) : h('p.note', {}, 'Nada salvo ainda.'),
      h('div.section-title', {}, 'Importar'), codeIn,
      h('div.actions', {}, btn('Importar código', () => { try { const o = decode(codeIn.value.trim().replace(/^FMI-/, '')); load({ id: null, name: o.n, base: o.b, custom: o.c.map(([ax, ay, bx, by, midi, hue, inst]) => ({ a: { x: ax, y: ay }, b: { x: bx, y: by }, midi, hue, inst })) }); sheet.close(); } catch { toast('Código inválido'); } }, { icon: 'upload' })),
    ] });
  }
  function load(it) { custom = structuredClone(it.custom); name = it.name; baseInst = it.base ?? 'harp'; currentId = it.id; selected = null; tool = 'play'; applySurface(); instDock(); toast(it.name); }

  // ───────────── editor de lições
  function openLessonEditor(initial = null) {
    const L = initial ?? { title: 'Minha lição', kind: 'exercise', instrument: app.instrument.engine === 'drum' ? 'harp' : app.instrument.id, bpm: 80, text: 'C4 D4 E4 G4:2 | E4 D4 C4:2', description: '' };
    const title = h('input.text-input', { value: L.title });
    const desc = h('input.text-input', { value: L.description, placeholder: 'Dica para quem for praticar (opcional)' });
    const text = h('textarea.text-input', { value: L.text, spellcheck: false, rows: 6 });
    const err = h('p.note', {}, '');
    let recording = false, events = [], offRec = null;
    const recBtn = btn('Gravar do instrumento', () => {
      recording = !recording; recBtn.classList.toggle('on', recording);
      if (recording) { events = []; offRec = app.performer.on('noteon', (e) => events.push(e)); const offOff = app.performer.on('noteoff', (e) => { const x = events.find((y) => y.id === e.id); if (x) x.dur = e.dur; }); const o = offRec; offRec = () => { o(); offOff(); }; toast('Toque a frase no instrumento e depois pare'); sheet.panel.style.opacity = '.35'; }
      else { offRec?.(); sheet.panel.style.opacity = ''; if (events.length) { text.value = notesToText(events, L.bpm); toast(`${events.length} notas convertidas`); } }
    }, { icon: 'rec', cls: 'small rec' });
    const build = () => {
      const notes = seq(text.value);
      if (!notes.length) throw new Error('Escreva pelo menos uma nota');
      return makeSong({ id: L.id ?? uid('les'), title: title.value || 'Lição', composer: 'Você', license: 'user', kind: L.kind, genre: 'minhas', description: desc.value, difficulty: 1, tempo: [{ b: 0, bpm: L.bpm }], techniques: [...new Set(notes.map((n) => n.tech).filter(Boolean))],
        tracks: [{ id: 'main', name: title.value || 'Lição', role: 'melody', instrument: L.instrument, notes }], source: text.value });
    };
    const validate = () => { try { const s = build(); err.textContent = `✓ ${s.tracks[0].notes.length} notas · ${s.length / 4} compassos`; return s; } catch (e) { err.textContent = '⚠ ' + e.message; return null; } };
    text.addEventListener('input', validate);
    const sheet = openSheet({ title: 'Editor de lições', id: 'lesson', size: 'lg', onClose: () => offRec?.(), content: [
      title, h('div', { style: { height: '6px' } }), desc,
      h('div.grid2', {},
        select({ label: 'Instrumento', value: L.instrument, options: INSTRUMENTS.map((i) => [i.id, i.name]), onChange: (v) => { L.instrument = v; } }),
        select({ label: 'Tipo', value: L.kind, options: Object.entries(KINDS), onChange: (v) => { L.kind = v; } })),
      select({ label: 'Andamento', value: L.bpm, options: [60, 70, 80, 90, 100, 110, 120, 140].map((b) => [b, b + ' BPM']), onChange: (v) => { L.bpm = Number(v); } }),
      h('div.section-title', {}, 'Notas'),
      text, err,
      h('div.row', {}, recBtn),
      h('p.note', {}, 'Formato: nota[:duração][@força][!técnica]. Ex.: "C4:2@0.4!soft", "[C4 E4 G4]:2" (acorde), "r:1" (pausa). Técnicas: ' + Object.keys(TECH_LABEL).join(', ') + '.'),
      h('div.actions', {},
        btn('Testar', () => { const s = validate(); if (s) { sheet.close(); ui.go('learn', { song: s, mode: 'step' }); } }, { icon: 'play', cls: 'primary' }),
        btn('Salvar', async () => { const s = validate(); if (!s) return; try { await db.put('songs', s); L.id = s.id; toast('Salvo em Aprender → Minhas'); } catch (e) { toast(e.message); } }, { icon: 'download' }),
        btn('Exportar JSON', () => { const s = validate(); if (s) download(new Blob([JSON.stringify(s, null, 1)], { type: 'application/json' }), 'licao.fingmusic.json'); }, { icon: 'share', cls: 'small' }),
        btn('Abrir JSON', async () => { const f = await pickFile('application/json,.json'); if (!f) return; try { const s = normalizeSong(JSON.parse(await f.text())); sheet.close(); openLessonEditor({ id: s.id, title: s.title, kind: s.kind, instrument: s.tracks[0].instrument, bpm: s.tempo[0].bpm, description: s.description ?? '', text: s.source ?? notesToTextFromBeats(s.tracks[0].notes) }); } catch (e) { toast(e.message); } }, { icon: 'upload', cls: 'small' })),
    ] });
    validate();
  }

  // ───────────── criador de desafios
  function openChallengeMaker() {
    let events = [], rec = false, off = null;
    const out = h('p.note', {}, 'Toque "Gravar", toque sua frase no instrumento e pare. O código gerado recria o desafio em qualquer aparelho com o Fingmusic.');
    const codeBox = h('input.text-input', { readonly: true, placeholder: 'O código aparece aqui' });
    const recBtn = btn('Gravar frase', () => {
      rec = !rec; recBtn.classList.toggle('on', rec);
      if (rec) { events = []; off = app.performer.on('noteon', (e) => events.push(e)); sheet.panel.style.opacity = '.35'; toast('Toque a frase'); }
      else {
        off?.(); sheet.panel.style.opacity = '';
        if (events.length < 2) { toast('Toque pelo menos 2 notas'); return; }
        const steps = events.slice(0, 32).map((e, i) => ({ m: e.midi, d: Math.max(0.25, Math.min(2, Math.round(((events[i + 1]?.time ?? e.time + 0.5) - e.time) / 0.15) * 0.25)), rest: 0, v: Math.round(e.vel * 100) / 100, tech: e.tech === 'slap' || e.tech === 'pop' || e.tech === 'mute' || e.tech === 'harmonic' ? e.tech : 'finger' }));
        codeBox.value = encodeSequence(steps, { title: 'Desafio', inst: app.instrument.id });
        out.textContent = `${steps.length} notas gravadas no ${app.instrument.name}.`;
      }
    }, { icon: 'rec', cls: 'rec' });
    const sheet = openSheet({ title: 'Criar desafio do Genius', id: 'chal', onClose: () => off?.(), content: [out, recBtn, h('div', { style: { height: '8px' } }), codeBox, h('div.actions', {},
      btn('Compartilhar', async () => { if (!codeBox.value) return; const text = `Desafio Fingmusic Genius (${app.instrument.name}): ${codeBox.value}`; try { if (navigator.share) await navigator.share({ text }); else { await navigator.clipboard.writeText(text); toast('Copiado'); } } catch { /* */ } }, { icon: 'share' }),
      btn('Jogar agora', () => { if (!codeBox.value) return; const c = codeBox.value; sheet.close(); ui.go('genius', { challengeCode: c }); }, { icon: 'brain', cls: 'primary' }))] });
  }

  function openCreateMenu() {
    const item = (ic, n, d, fn) => h('button.item', { type: 'button', onclick: fn }, icon(ic), h('span.meta', {}, h('div.name', {}, n), h('div.desc', {}, d)));
    const sheet = openSheet({ title: 'Criar', id: 'cmenu', content: [h('div.list', {},
      item('harp', 'Instrumento de cordas', 'Desenhe cordas na tela, escolha nota, timbre e cor', () => { sheet.close(); tab = 'inst'; applySurface(); instDock(); }),
      item('book', 'Lição para Follow the Lights', 'Escreva ou grave uma frase e pratique com luzes', () => { sheet.close(); openLessonEditor(); }),
      item('brain', 'Desafio do Genius', 'Grave uma frase e mande o código para alguém', () => { sheet.close(); openChallengeMaker(); }))] });
  }

  return {
    enter(params = {}) {
      offs = [
        app.on('string-select', (s) => { selected = s?.custom ?? null; instDock(); }),
        app.on('custom-change', (c) => { custom = c ?? []; }),
      ];
      ui.setHud(h('div.hud-pill', {}, icon('pen'), h('b', {}, 'Criar')));
      baseInst = app.instrument.surface === 'strings' ? app.instrument.id : 'harp';
      applySurface(); instDock();
      if (params.open === 'lesson') openLessonEditor(); else if (params.open === 'challenge') openChallengeMaker();
      else if (!custom.length) { openCreateMenu(); }
      void tab; void toggle;
    },
    exit() { offs.forEach((f) => f()); offs = []; app.setSurfaceOptions({}); },
  };
}
const r3 = (v) => Math.round(v * 1000) / 1000;
function notesToTextFromBeats(notes) {
  const groups = [];
  for (const n of notes) { const g = groups.find((x) => Math.abs(x.b - n.b) < 0.01); if (g) g.ns.push(n); else groups.push({ b: n.b, ns: [n] }); }
  return groups.map((g, i) => { const d = +((groups[i + 1]?.b ?? g.b + (g.ns[0].d ?? 1)) - g.b).toFixed(3); const nm = g.ns.length > 1 ? '[' + g.ns.map((n) => sci(n.m)).join(' ') + ']' : sci(g.ns[0].m); return `${nm}:${d}${g.ns[0].tech ? '!' + g.ns[0].tech : ''}`; }).join(' ');
}
