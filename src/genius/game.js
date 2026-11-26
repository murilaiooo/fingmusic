/**
 * GeniusGame: máquina de estados pura do jogo de memória musical.
 *
 *   idle → countdown → demonstrating → awaiting → validating → roundComplete → demonstrating …
 *                                              ↘ failed → (relaxed/zen: demonstrating | classic: gameOver)
 *   qualquer estado ativo ⇄ paused
 *
 * Não conhece áudio nem tela: recebe um "relógio" (now) e um agendador
 * (after) injetados, e emite eventos que a camada de apresentação usa para
 * tocar, iluminar e dar feedback. Isso torna o jogo totalmente testável.
 */
import { Emitter } from '../core/emitter.js';
import { generateSequence } from './generator.js';

export const STATES = ['idle', 'countdown', 'demonstrating', 'awaiting', 'validating', 'roundComplete', 'failed', 'paused', 'gameOver'];

export const MODES = {
  classic: { name: 'Clássico', desc: 'Uma nota nova por rodada. Um erro encerra a partida.' },
  relaxed: { name: 'Tranquilo', desc: 'Sem game over: tente de novo e peça para repetir.' },
  speed: { name: 'Velocidade', desc: 'A demonstração acelera e o tempo para responder é limitado.' },
  rhythm: { name: 'Ritmo', desc: 'Reproduza a ordem e também o ritmo das notas.' },
  musical: { name: 'Memória musical', desc: 'Frases coerentes dentro da escala.' },
  blind: { name: 'Às cegas', desc: 'Só o som, sem luzes: reconheça as notas de ouvido.' },
  reverse: { name: 'Reverso', desc: 'Toque a sequência de trás para frente.' },
  echo: { name: 'Eco', desc: 'Imite frases curtas com ritmo e dinâmica.' },
  technique: { name: 'Técnica', desc: 'Nota certa e técnica certa: suave, forte, puxar e soltar…' },
  zen: { name: 'Zen', desc: 'Sem pontuação, sem pressa, sem punições.' },
  bass: { name: 'Genius Bass', desc: 'Grooves de baixo: ordem, ritmo, intensidade e técnica.' },
};

export const DIFFICULTIES = {
  beginner: { name: 'Iniciante', elements: 4, noteSec: 0.62, gapSec: 0.22, inputTimeout: null, rhythmTol: 0.38, speedUp: 0.97, minNote: 0.34 },
  intermediate: { name: 'Intermediário', elements: 6, noteSec: 0.48, gapSec: 0.16, inputTimeout: null, rhythmTol: 0.28, speedUp: 0.96, minNote: 0.26 },
  advanced: { name: 'Avançado', elements: 8, noteSec: 0.36, gapSec: 0.12, inputTimeout: null, rhythmTol: 0.22, speedUp: 0.95, minNote: 0.2, chords: true },
  expert: { name: 'Especialista', elements: 10, noteSec: 0.3, gapSec: 0.1, inputTimeout: null, rhythmTol: 0.18, speedUp: 0.94, minNote: 0.16, chords: true, techniques: true },
};

const strategyFor = (mode, diff) => (mode === 'musical' || mode === 'echo' ? 'musical' : mode === 'bass' ? 'groove' : mode === 'rhythm' ? 'rhythmic' : diff === 'advanced' && mode === 'classic' ? 'random' : 'random');

export class GeniusGame extends Emitter {
  /**
   * opts: { mode, difficulty, seed, elements:[midi], root, scale, now:()=>s, after:(s,fn)=>cancel,
   *         players: 1|2, multi: null|'duel'|'build'|'friend', customSequence, techniques:[], startLength }
   */
  constructor(opts) {
    super();
    this.opts = opts;
    this.mode = opts.mode ?? 'classic';
    this.diff = DIFFICULTIES[opts.difficulty ?? 'beginner'];
    this.now = opts.now; this.after = opts.after;
    this.state = 'idle';
    this.round = 0;
    this.score = 0;
    this.correctNotes = 0;
    this.mistakes = 0;
    this.timings = [];
    this.players = opts.players ?? 1;
    this.player = 0;
    this.playerScores = Array(this.players).fill(0);
    this.alive = Array(this.players).fill(true);
    this.elements = opts.elements;
    this.speed = 1;
    this.assistUsed = 0;
    this.history = [];
    this.lastInput = { midi: null, t: -1 };
    this._timers = [];
    const isCustom = !!opts.customSequence;
    this.master = isCustom ? opts.customSequence.map((s) => ({ ...s })) : generateSequence({
      strategy: strategyFor(this.mode, opts.difficulty), length: 64, elements: this.elements, seed: opts.seed ?? 1,
      root: opts.root, scale: opts.scale, rhythm: this.mode === 'rhythm' || this.mode === 'echo' || this.mode === 'bass',
      chords: this.diff.chords && this.mode !== 'blind' && this.mode !== 'bass', dynamics: this.mode === 'echo' || this.mode === 'technique',
      techniques: this.mode === 'technique' ? (opts.techniques ?? ['soft', 'hard', 'pull']) : null, genre: opts.genre,
    });
    this.length = opts.startLength ?? (this.mode === 'echo' ? 3 : this.mode === 'bass' ? 2 : 1);
    if (this.mode === 'echo' && !isCustom) this.echoBase = 0;
  }

  get sequence() {
    if (this.mode === 'echo') return this.master.slice(this.echoBase, this.echoBase + this.length);
    return this.master.slice(0, this.length);
  }
  /** Ordem esperada (reverso inverte). Cada passo pode ser nota única ou acorde. */
  get expected() { const s = this.sequence; return this.mode === 'reverse' ? [...s].reverse() : s; }
  get showLights() { return this.mode !== 'blind'; }
  get scored() { return this.mode !== 'zen'; }
  get forgiving() { return ['relaxed', 'zen', 'echo'].includes(this.mode); }

  _set(state, info = {}) { const from = this.state; this.state = state; this.emit('state', { from, to: state, ...info }); }
  _later(sec, fn) { const c = this.after(sec, () => { this._timers = this._timers.filter((x) => x !== c); fn(); }); this._timers.push(c); return c; }
  _clearTimers() { for (const c of this._timers) c(); this._timers = []; }

  start() {
    this._clearTimers();
    this.round = 1; this._set('countdown', { beats: 3 });
    this._later(1.6, () => this.demonstrate());
  }

  /** Durações da demonstração: devolve [{step, at, dur}] em segundos relativos. */
  timeline() {
    const sec = this.diff.noteSec * this.speed, gap = this.diff.gapSec * this.speed;
    const rhythmic = this.mode === 'rhythm' || this.mode === 'echo' || this.mode === 'bass';
    const out = []; let t = 0;
    for (const step of this.sequence) {
      if (rhythmic) { t += (step.rest ?? 0) * sec; out.push({ step, at: t, dur: step.d * sec * 0.92 }); t += step.d * sec; }
      else { out.push({ step, at: t, dur: sec }); t += sec + gap; }
    }
    return { items: out, total: t };
  }

  demonstrate() {
    this._clearTimers();
    this.inputIndex = 0; this.inputs = []; this.chordBuf = [];
    const tl = this.timeline();
    this._set('demonstrating', { round: this.round, timeline: tl, lights: this.showLights, sequence: this.sequence });
    this._later(tl.total + 0.25, () => this.awaitInput());
  }

  awaitInput() {
    this._set('awaiting', { round: this.round, length: this.expected.length, player: this.player });
    this.turnStarted = this.now();
    if (this.mode === 'speed') {
      const limit = 1.5 + this.expected.length * 0.9 * this.speed;
      this.deadline = this.turnStarted + limit;
      this._timeoutTimer = this._later(limit, () => { if (this.state === 'awaiting') this.fail('timeout'); });
    } else this.deadline = null;
  }

  /** Repetir a demonstração (modos tolerantes). Conta como uso de assistência. */
  replay() { if (this.state === 'awaiting' && (this.forgiving || this.mode === 'relaxed')) { this.assistUsed++; this.demonstrate(); return true; } return false; }

  /** Entrada do usuário: {midi, time, vel, tech}. Devolve o resultado imediato. */
  input(ev) {
    if (this.state !== 'awaiting') { this.emit('blocked', ev); return { accepted: false, reason: this.state }; }
    // evita que um mesmo gesto gere notas duplicadas
    if (ev.midi === this.lastInput.midi && ev.time - this.lastInput.t < 0.07) return { accepted: false, reason: 'debounce' };
    this.lastInput = { midi: ev.midi, t: ev.time };
    const exp = this.expected[this.inputIndex];
    if (!exp) return { accepted: false, reason: 'done' };
    const want = Array.isArray(exp.m) ? exp.m : [exp.m];
    if (want.length > 1) {
      // acorde: aceita as notas em qualquer ordem dentro de 350 ms
      if (!want.includes(ev.midi)) return this._wrong(ev, exp);
      this.chordBuf = this.chordBuf.filter((x) => ev.time - x.time < 0.35);
      if (!this.chordBuf.some((x) => x.midi === ev.midi)) this.chordBuf.push(ev);
      this.emit('hit', { ev, index: this.inputIndex, partial: this.chordBuf.length < want.length });
      if (this.chordBuf.length < want.length) return { accepted: true, partial: true };
      this.chordBuf = [];
    } else if (ev.midi !== want[0]) return this._wrong(ev, exp);
    if (this.mode === 'technique' || this.mode === 'bass') {
      const tech = exp.tech ?? 'finger';
      if (!techOk(tech, ev)) return this._wrong(ev, exp, 'technique');
    }
    this.inputs.push({ ...ev, index: this.inputIndex });
    this.correctNotes++;
    if (want.length === 1) this.emit('hit', { ev, index: this.inputIndex });
    this.inputIndex++;
    if (this.inputIndex >= this.expected.length) return this.validate();
    return { accepted: true, correct: true };
  }

  _wrong(ev, exp, reason = 'note') {
    this.mistakes++;
    this.emit('miss', { ev, expected: exp, index: this.inputIndex, reason });
    if (this.forgiving) {
      // modos tolerantes: mostra a nota correta e deixa continuar do mesmo ponto
      this.emit('hint', { expected: exp, index: this.inputIndex });
      return { accepted: true, correct: false, retry: true };
    }
    this.fail(reason, exp);
    return { accepted: true, correct: false };
  }

  validate() {
    this._clearTimers();
    this._set('validating');
    let rhythmOk = true, rhythmScore = 1;
    if (this.mode === 'rhythm' || this.mode === 'bass' || this.mode === 'echo') {
      const r = rhythmAccuracy(this.timeline().items, this.inputs, this.mode === 'reverse');
      rhythmScore = r.score; rhythmOk = r.score >= 1 - this.diff.rhythmTol * 1.6 || this.forgiving;
      this.timings.push(r.score);
    }
    if (!rhythmOk) return this.fail('rhythm');
    const pts = this.expected.length * 10 * (1 + Object.keys(DIFFICULTIES).indexOf(this.opts.difficulty ?? 'beginner') * 0.5) * (0.5 + rhythmScore / 2) * (this.mode === 'speed' ? 1 + (1 - this.speed) : 1);
    if (this.scored) { this.score += Math.round(pts); this.playerScores[this.player] += Math.round(pts); }
    this._set('roundComplete', { round: this.round, length: this.expected.length, rhythm: rhythmScore });
    this._later(0.7, () => this.nextRound());
    return { accepted: true, correct: true, roundComplete: true };
  }

  nextRound() {
    this.round++;
    if (this.players > 1 && this.opts.multi === 'duel') {
      // duelo: todos tentam a mesma sequência; só cresce quando todos jogaram
      this.player = (this.player + 1) % this.players;
      if (this.player !== 0) { this.round--; return this.demonstrate(); }
    }
    if (this.opts.multi === 'build') {
      this.player = (this.player + 1) % this.players;
      this._set('composing', { player: this.player });
      return;
    }
    this.progress();
    this.demonstrate();
  }

  /** Dificuldade progressiva: alterna qual variável aumenta, nunca todas juntas. */
  progress() {
    if (this.mode === 'echo') { this.echoBase += this.length; this.length = Math.min(8, 3 + Math.floor(this.round / 3)); return; }
    this.length = Math.min(this.master.length, this.length + 1);
    if (this.mode === 'speed') this.speed = Math.max(this.diff.minNote / this.diff.noteSec, this.speed * this.diff.speedUp * this.diff.speedUp);
    else if (this.round % 4 === 0) this.speed = Math.max(this.diff.minNote / this.diff.noteSec, this.speed * this.diff.speedUp);
  }

  /** Build Together: o jogador da vez acrescenta uma nota própria. */
  compose(ev) {
    if (this.state !== 'composing') return false;
    this.master.splice(this.length, 0, { m: ev.midi, d: 1, rest: 0, v: ev.vel ?? 0.7, tech: 'finger' });
    this.length++;
    this.demonstrate();
    return true;
  }

  fail(reason, expected) {
    this._clearTimers();
    this._set('failed', { reason, expected, round: this.round });
    if (this.players > 1) {
      this.alive[this.player] = false;
      const left = this.alive.filter(Boolean).length;
      if (left <= 1) { this._later(1.2, () => this.gameOver()); return; }
      this._later(1.2, () => { do { this.player = (this.player + 1) % this.players; } while (!this.alive[this.player]); this.demonstrate(); });
      return;
    }
    if (this.forgiving || this.mode === 'relaxed') this._later(1.2, () => this.demonstrate());
    else this._later(1.2, () => this.gameOver());
  }

  gameOver() {
    this._clearTimers();
    const best = this.mode === 'echo' ? this.round - 1 : Math.max(0, this.length - 1);
    this.result = {
      mode: this.mode, difficulty: this.opts.difficulty ?? 'beginner', seed: this.opts.seed, round: this.round,
      maxLength: best, score: this.score, correct: this.correctNotes, mistakes: this.mistakes,
      rhythm: this.timings.length ? this.timings.reduce((a, b) => a + b, 0) / this.timings.length : null,
      assist: this.assistUsed, players: this.playerScores.slice(), winner: this.players > 1 ? this.alive.findIndex(Boolean) : null,
    };
    this._set('gameOver', { result: this.result });
  }

  pause() { if (['idle', 'gameOver', 'paused'].includes(this.state)) return; this._clearTimers(); this.resumeTo = this.state === 'awaiting' ? 'awaiting' : 'demonstrating'; this._set('paused'); }
  resume() { if (this.state !== 'paused') return; if (this.resumeTo === 'awaiting') this.awaitInput(); else this.demonstrate(); }
  stop() { this._clearTimers(); this._set('idle'); }
}

export function techOk(tech, ev) {
  if (tech === 'finger' || tech === 'normal') return true;
  if (tech === 'soft' || tech === 'ghost') return ev.vel < 0.5;
  if (tech === 'hard') return ev.vel > 0.8;
  if (tech === 'pull') return ev.tech === 'pull' || ev.tech === 'snap' || ev.tech === 'pop';
  // slide e hammer-on chegam como novas notas com a técnica marcada pelo braço (fretboard)
  return ev.tech === tech;
}

/** Compara intervalos entre ataques (proporção), independente do andamento absoluto. */
export function rhythmAccuracy(items, inputs) {
  if (items.length < 2 || inputs.length < 2) return { score: 1 };
  const ref = items.map((x) => x.at), got = inputs.map((x) => x.time);
  const refSpan = ref[ref.length - 1] - ref[0] || 1, gotSpan = got[got.length - 1] - got[0] || 1;
  let err = 0;
  for (let i = 1; i < Math.min(ref.length, got.length); i++) {
    const r = (ref[i] - ref[i - 1]) / refSpan, g = (got[i] - got[i - 1]) / gotSpan;
    err += Math.abs(r - g);
  }
  const tempoRatio = gotSpan / refSpan;
  const tempoPenalty = Math.min(0.3, Math.abs(Math.log(tempoRatio)) * 0.25);
  return { score: Math.max(0, 1 - err - tempoPenalty), tempoRatio };
}
