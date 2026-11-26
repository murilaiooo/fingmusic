/**
 * Genius: tela de configuração (modo, dificuldade, jogadores, desafio do
 * dia, código de amigo), HUD da partida (rodada, recorde, vez, progresso da
 * sequência) e resultado (recorde, conquistas, compartilhar, virar exercício).
 */
import { h, btn, segmented, toggle, icon, setPressed } from '../ui/dom.js';
import { openSheet, toast } from '../ui/sheet.js';
import { MODES, DIFFICULTIES } from '../genius/game.js';
import { ACHIEVEMENTS } from '../genius/controller.js';
import { encodeSequence, decodeSequence, dailySeed } from '../genius/generator.js';
import { songFromSequence } from '../learn/song.js';
import { db } from '../persist/db.js';
import { openInstrumentSheet } from '../ui/panels.js';

const STATE_MSG = { countdown: 'Prepare-se', demonstrating: 'Observe e escute', awaiting: 'Sua vez', validating: '', roundComplete: 'Isso!', failed: 'Ops…', paused: 'Pausado', composing: 'Acrescente uma nota' };

export function geniusMode(ui) {
  const app = ui.app, G = app.genius;
  let offs = [], prevInst = null, lastResult = null, records = {};
  const roundEl = h('b', {}, '—'), recEl = h('span.pill', {}, ''), turnEl = h('span.pill', {}, ''), dots = h('div.dots');
  const cfg = { mode: 'classic', difficulty: 'beginner', players: 1, multi: null, twoHands: false, daily: false, lights: true, sound: true };

  async function openSetup(extra = {}) {
    G.stop(); ui.hideMessage(); ui.turn(null);
    records = await G.records();
    const ach = await G.achievements();
    const best = (m = cfg.mode, d = cfg.difficulty) => records[`${m}|${d}`]?.maxLength ?? 0;
    const modeList = h('div.list');
    const renderModes = () => modeList.replaceChildren(...Object.entries(MODES).map(([id, m]) => h('button.item' + (id === cfg.mode ? '.on' : ''), { type: 'button', onclick: () => { cfg.mode = id; renderModes(); } },
      h('span.meta', {}, h('div.name', {}, m.name), h('div.desc', {}, m.desc)), best(id) ? h('span.tag', {}, 'recorde ' + best(id)) : null)));
    renderModes();
    const code = h('input.text-input', { placeholder: 'Cole o código de um amigo (opcional)', value: extra.challengeCode ?? '' });
    const daily = dailySeed(new Date(), cfg.difficulty, cfg.mode);
    const sheet = openSheet({ title: 'Genius', id: 'gsetup', size: 'lg', content: [
      h('p.note', {}, 'O próprio instrumento mostra a sequência: luz, som e a corda vibrando. Depois é sua vez de repetir.'),
      h('div.row', {}, btn(app.instrument.name, () => openInstrumentSheet(ui, { onPick: (id) => { app.setInstrument(id, { silent: true }); toast(app.instrument.name); sheet.close(); openSetup(extra); }, title: 'Instrumento do Genius' }), { icon: 'harp', cls: 'small' })),
      h('div.section-title', {}, 'Modo'), modeList,
      h('div.section-title', {}, 'Dificuldade'),
      segmented(Object.entries(DIFFICULTIES).map(([id, d]) => [id, d.name]), cfg.difficulty, (v) => { cfg.difficulty = v; renderModes(); }),
      h('p.note', {}, 'Mais elementos no instrumento, demonstração mais rápida e, nos níveis altos, acordes e técnicas.'),
      h('div.section-title', {}, 'Jogadores'),
      segmented([['solo', 'Solo'], ['duel', 'Duelo (2)'], ['build', 'Construir juntos'], ['hands', 'Duas mãos']], cfg.multi ?? (cfg.twoHands ? 'hands' : 'solo'), (v) => { cfg.multi = v === 'duel' || v === 'build' ? v : null; cfg.players = cfg.multi ? 2 : 1; cfg.twoHands = v === 'hands'; }),
      h('div.section-title', {}, 'Opções'),
      toggle({ label: 'Desafio do dia', hint: `Mesma sequência para todo mundo hoje (${daily.date}). Sem ranking: compartilhe o resultado.`, value: cfg.daily, onChange: (v) => { cfg.daily = v; } }),
      toggle({ label: 'Luzes na demonstração', value: cfg.lights, onChange: (v) => { cfg.lights = v; } }),
      toggle({ label: 'Som na demonstração', value: cfg.sound, onChange: (v) => { cfg.sound = v; } }),
      h('div.section-title', {}, 'Desafiar um amigo'), code,
      h('div.actions', {}, btn('Jogar', () => { sheet.close(); start(code.value.trim()); }, { icon: 'play', cls: 'primary' }), btn('Recordes e conquistas', () => openRecords(ach), { icon: 'trophy', cls: 'small' })),
    ] });
  }

  function start(codeStr = '') {
    app.engine.unlock();
    if (!app.engine.ready) { ui.message('Toque na tela para começar', 'O áudio precisa de um toque para iniciar'); const once = app.on('touch', () => { once(); ui.hideMessage(); setTimeout(() => start(codeStr), 80); }); return; }
    app.ensureLiveChannel();
    if (cfg.mode === 'bass' && app.instrument.family !== 'bass') app.setInstrument('bassFinger', { silent: true });
    app.setSurfaceOptions({});
    let customSequence = null;
    if (codeStr) {
      try { const d = decodeSequence(codeStr.replace(/^FM-?/, '')); customSequence = d.seq; if (d.inst) app.setInstrument(d.inst, { silent: true }); toast(`Desafio${d.title ? ': ' + d.title : ''} · ${d.seq.length} notas`); }
      catch { toast('Código inválido. Jogando uma sequência nova.'); }
    }
    let elements;
    if (customSequence) { const all = [...new Set(customSequence.flatMap((s) => (Array.isArray(s.m) ? s.m : [s.m])))].sort((a, b) => a - b); if (app.surface.constructor.name !== 'FretboardSurface') app.surface.setNotes(all); elements = all; }
    G.start({ ...cfg, customSequence, elements, players: cfg.players, multi: cfg.multi });
    buildDock();
  }

  function buildDock() {
    const pause = btn(null, () => { if (G.game?.state === 'paused') G.resume(); else G.pause(); }, { icon: 'pause', cls: 'icon-only', title: 'Pausar' });
    const replay = btn('Repetir', () => { if (!G.replay()) toast('Repetir só nos modos Tranquilo, Zen e Eco'); }, { icon: 'repeat', cls: 'small' });
    ui.setDock(h('div.bar', {}, h('div.row.grow', {}, pause, replay, btn('Novo jogo', () => openSetup(), { icon: 'brain', cls: 'small' }), btn('Recomeçar', () => start(), { icon: 'repeat', cls: 'small icon-only', title: 'Recomeçar' }))));
    ui.setHud(h('div.hud-pill', {}, icon('brain'), h('span', {}, 'Rodada ', roundEl), recEl, turnEl), dots);
    const best = records[`${cfg.mode}|${cfg.difficulty}`]?.maxLength;
    recEl.innerHTML = best ? `recorde <b>${best}</b>` : '';
  }
  function renderDots(len, done = 0, bad = -1) {
    if (len > 40) { dots.replaceChildren(h('span.pill', {}, `${done}/${len}`)); return; }
    dots.replaceChildren(...Array.from({ length: len }, (_, i) => h('i' + (i < done ? '.done' : i === bad ? '.bad' : ''))));
  }

  function onState(s) {
    const g = G.game; if (!g) return;
    roundEl.textContent = g.round;
    const multi = g.players > 1;
    turnEl.innerHTML = multi ? `vez do <b>Jogador ${g.player + 1}</b>` : '';
    if (s.to === 'demonstrating') { ui.turn('watch'); ui.message(STATE_MSG.demonstrating, multi ? `Jogador ${g.player + 1} se prepara` : `${s.sequence.length} nota${s.sequence.length > 1 ? 's' : ''}`); renderDots(s.sequence.length, 0); }
    else if (s.to === 'awaiting') { ui.turn('you'); ui.message(multi ? `Jogador ${s.player + 1}` : STATE_MSG.awaiting, g.mode === 'reverse' ? 'de trás para frente' : g.mode === 'rhythm' || g.mode === 'bass' ? 'no mesmo ritmo' : null, 900); }
    else if (s.to === 'roundComplete') { ui.turn(null); ui.message(STATE_MSG.roundComplete, s.rhythm != null ? `ritmo ${Math.round(s.rhythm * 100)}%` : null, 700); app.haptics.pulse(0.4); }
    else if (s.to === 'failed') { ui.turn(null); ui.message(STATE_MSG.failed, s.reason === 'timeout' ? 'o tempo acabou' : s.reason === 'rhythm' ? 'fora do ritmo' : s.reason === 'tech' ? 'técnica diferente' : 'nota diferente', 1100); }
    else if (s.to === 'countdown') { ui.message(STATE_MSG.countdown, null, 900); }
    else if (s.to === 'paused') { ui.message(STATE_MSG.paused, 'toque em ▶ para continuar'); }
    else if (s.to === 'composing') { ui.turn('you'); ui.message(`Jogador ${s.player + 1}`, 'toque uma nota nova para a sequência'); }
    else if (s.to === 'gameOver') { ui.turn(null); ui.hideMessage(); }
  }

  function showResult({ result: r, isRecord, unlocked }) {
    lastResult = r;
    const seq = G.game?.master.slice(0, Math.max(1, r.maxLength)) ?? [];
    const code = encodeSequence(seq, { mode: r.mode, inst: app.instrument.id });
    const share = async () => {
      const text = G.shareText(r) + `\nDesafio: ${code}`;
      try { if (navigator.share) await navigator.share({ title: 'Fingmusic Genius', text }); else { await navigator.clipboard.writeText(text); toast('Copiado!'); } } catch { /* cancelado */ }
    };
    const saveExercise = async () => {
      const song = songFromSequence(seq, { title: `Genius ${MODES[r.mode].name} (${r.maxLength})`, instrument: app.instrument.id, bpm: 80 });
      try { await db.put('songs', song); toast('Salvo em Aprender → Minhas'); } catch { toast('Não foi possível salvar'); }
      return song;
    };
    const multi = r.players?.length > 1;
    const sheet = openSheet({ title: 'Fim de jogo', id: 'gresult', content: [
      h('div', { style: { textAlign: 'center', padding: '6px 0' } }, h('div.big-num', {}, r.maxLength), h('div.muted', {}, 'notas seguidas'), isRecord && r.maxLength ? h('p', {}, '🏆 Novo recorde!') : null),
      multi ? h('p', { style: { textAlign: 'center' } }, r.winner >= 0 ? `Jogador ${r.winner + 1} venceu!` : 'Empate!') : null,
      h('dl.kv', {}, h('dt', {}, 'Pontos'), h('dd', {}, r.score), h('dt', {}, 'Acertos'), h('dd', {}, r.correct), h('dt', {}, 'Erros'), h('dd', {}, r.mistakes), r.rhythm != null ? h('dt', {}, 'Ritmo') : null, r.rhythm != null ? h('dd', {}, Math.round(r.rhythm * 100) + '%') : null),
      unlocked?.length ? h('div.section-title', {}, 'Conquistas') : null,
      ...(unlocked ?? []).map((a) => h('div.item', {}, icon('trophy'), h('span.meta', {}, h('div.name', {}, a.name)))),
      h('div.actions', {},
        btn('Jogar de novo', () => { sheet.close(); start(); }, { icon: 'repeat', cls: 'primary' }),
        btn('Compartilhar', share, { icon: 'share' }),
        r.maxLength >= 2 ? btn('Virar exercício', async () => { const s = await saveExercise(); sheet.close(); ui.go('learn', { song: s, mode: 'step' }); }, { icon: 'book' }) : null,
        btn('Outro modo', () => { sheet.close(); openSetup(); }, { icon: 'brain' })),
    ] });
  }

  async function openRecords(ach) {
    const hist = await G.history();
    openSheet({ title: 'Recordes e conquistas', id: 'grec', content: [
      h('div.section-title', {}, 'Recordes pessoais'),
      Object.keys(records).length ? h('dl.kv', {}, ...Object.entries(records).flatMap(([k, v]) => { const [m, d] = k.split('|'); return [h('dt', {}, `${MODES[m]?.name ?? m} · ${DIFFICULTIES[d]?.name ?? d}`), h('dd', {}, `${v.maxLength} notas · ${v.score} pts`)]; })) : h('p.note', {}, 'Jogue uma partida para registrar.'),
      h('div.section-title', {}, 'Conquistas'),
      h('div.list', {}, ...ACHIEVEMENTS.map((a) => h('div.item' + (ach[a.id] ? '.on' : ''), {}, icon(ach[a.id] ? 'trophy' : 'lightning'), h('span.meta', {}, h('div.name', {}, a.name), h('div.desc', {}, ach[a.id] ? 'Desbloqueada em ' + new Date(ach[a.id]).toLocaleDateString() : 'Bloqueada'))))),
      h('div.section-title', {}, 'Últimas partidas'),
      h('div.list', {}, ...hist.slice(0, 15).map((r) => h('div.item', {}, h('span.meta', {}, h('div.name', {}, `${MODES[r.mode]?.name ?? r.mode} · ${r.maxLength} notas`), h('div.desc', {}, `${new Date(r.at).toLocaleString()} · ${DIFFICULTIES[r.difficulty]?.name ?? ''}${r.daily ? ' · desafio do dia' : ''}`))))),
    ] });
  }

  return {
    enter(params = {}) {
      prevInst = app.instrument.id;
      if (params.instrument) app.setInstrument(params.instrument, { silent: true });
      offs = [
        G.on('state', onState),
        G.on('hit', (x) => { const g = G.game; if (g) renderDots(g.expected.length, x.index + (x.partial ? 0 : 1)); }),
        G.on('miss', (x) => { const g = G.game; if (g) renderDots(g.expected.length, x.index, x.index); }),
        G.on('saved', (x) => { if (x.records) records = x.records; showResult(x); }),
        G.on('blocked', () => { /* entrada bloqueada durante a demonstração: só o anel de "observe" */ }),
      ];
      ui.setHud(h('div.hud-pill', {}, icon('brain'), h('b', {}, 'Genius')));
      ui.setDock(h('div.bar', {}, h('div.row.grow', {}, btn('Novo jogo', () => openSetup(), { icon: 'play', cls: 'primary' }))));
      openSetup(params);
      void lastResult; void setPressed;
    },
    exit() { G.stop(); offs.forEach((f) => f()); offs = []; ui.turn(null); app.setInstrument(prevInst ?? app.instrument.id, { silent: true }); },
    shortcut(s) { if (s === 'playpause' && G.game) { if (G.game.state === 'paused') G.resume(); else G.pause(); } },
  };
}
