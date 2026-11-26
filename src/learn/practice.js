/**
 * Follow the Lights — motor de prática. Uma única estrutura (música v1)
 * alimenta seis modos:
 *   listen      o app toca e ilumina; você observa e escuta
 *   step        uma nota (ou acorde) por vez, sem pressão de tempo
 *   guided      tempo real com luzes de antecipação e pulsos
 *   practice    guided + repetição de trechos, velocidade, tolerância e adaptação
 *   memory      as luzes aparecem e somem antes do momento de tocar
 *   performance a música completa com assistência mínima
 * Luz, som e avaliação usam o relógio do AudioContext.
 */
import { Emitter } from '../core/emitter.js';
import { Evaluator } from './evaluator.js';
import { getInstrument } from '../instruments/catalog.js';
import { beatToSec, normalizeTempoMap } from '../core/timeline.js';

export const LEARN_MODES = {
  listen: { name: 'Ouvir', desc: 'O Fingmusic toca e ilumina. Só observe.' },
  step: { name: 'Passo a passo', desc: 'Uma nota por vez, sem pressa.' },
  guided: { name: 'Guiado', desc: 'Em tempo real, com luzes antecipando cada nota.' },
  practice: { name: 'Praticar', desc: 'Repita trechos, mude a velocidade e a ajuda.' },
  memory: { name: 'Memória', desc: 'As luzes somem antes de você tocar.' },
  performance: { name: 'Apresentação', desc: 'Do começo ao fim, com o mínimo de ajuda.' },
};

export class Practice extends Emitter {
  constructor(app) {
    super();
    this.app = app;
    this.evaluator = new Evaluator();
    this.channels = new Map();
    this.active = false;
    this.adaptive = true;
    app.transport.addPart(this);
  }

  /** opts: {mode, trackId, rate, section:{from,to}|null, guideVolume, tolerance, anticipation} */
  load(song, opts = {}) {
    this.stop();
    this.song = song;
    this.mode = opts.mode ?? 'guided';
    this.track = song.tracks.find((t) => t.id === (opts.trackId ?? song.defaultTrack)) ?? song.tracks[0];
    this.notes = (opts.notesOverride ?? this.track.notes).map((n, i) => ({ ...n, i }));
    this.rate = opts.rate ?? (this.mode === 'step' ? 1 : 1);
    this.section = opts.section ?? null;
    this.guideVolume = opts.guideVolume ?? (this.mode === 'listen' ? 0.9 : this.mode === 'guided' || this.mode === 'practice' ? 0.25 : 0);
    this.tolerance = opts.tolerance ?? 1;
    this.anticipation = opts.anticipation ?? this.app.settings.anticipation ?? 1.2;
    this.map = normalizeTempoMap(song.tempo);
    this.pass = 0; this.passResults = [];
    this.evaluator.reset(); this.evaluator.setTolerance(this.tolerance * (this.mode === 'performance' ? 0.85 : 1));
    this.evaluator.latency.touch = (this.app.settings.latencyTouch ?? 0) / 1000;
    this.evaluator.latency.mouse = (this.app.settings.latencyTouch ?? 0) / 1000;
    this.evaluator.latency.hand = (this.app.settings.latencyHand ?? 70) / 1000;
    this.stepIndex = 0;
    this.emit('loaded', { song, track: this.track });
  }

  ensureChannels() {
    for (const t of this.song.tracks) {
      if (this.channels.has(t.id)) { this.channels.get(t.id).setInstrument(getInstrument(t.instrument)); continue; }
      const ch = this.app.engine.createChannel({ instrument: getInstrument(t.instrument), volume: t.volume ?? 0.8 });
      ch.syncTempo(this.map[0].bpm);
      this.channels.set(t.id, ch);
    }
  }

  start(fromBeat = null) {
    if (!this.song) return;
    this.active = true;
    this.app.lighting.clear();
    this.app.lighting.anticipation = this.mode === 'performance' ? 0 : this.anticipation;
    this.evaluator.reset();
    this.offInput?.(); this.offInputOff?.();
    this.offInput = this.app.performer.on('noteon', (ev) => this.onInput(ev));
    this.offInputOff = this.app.performer.on('noteoff', (ev) => this.evaluator.judgeRelease(ev));
    if (this.mode === 'step') { this.stepIndex = 0; this.showStep(); this.emit('state', 'running'); return; }
    this.ensureChannels();
    const tr = this.app.transport;
    this.app.transportOwner = 'learn';
    tr.setTempoMap(this.map); tr.setRate(this.rate);
    const sec = this.section;
    if (sec && (this.mode === 'practice' || this.mode === 'memory')) tr.setLoop(sec.from, sec.to); else tr.setLoop(0, 0);
    tr.endBeat = sec && !(this.mode === 'practice' || this.mode === 'memory') ? sec.to : this.song.length;
    if (!this._endOff) this._endOff = tr.on('end', () => { if (this.active && this.mode !== 'step') this.finish(); });
    if (!this._wrapOff) this._wrapOff = tr.on('wrap', () => this.onPass());
    tr.start({ fromBeat: fromBeat ?? sec?.from ?? 0, countIn: this.mode === 'listen' ? 0 : this.app.transport.beatsPerBar });
    this.emit('state', 'running');
    this.sweeper = setInterval(() => this.sweep(), 60);
  }
  pause() { if (this.mode === 'step') return; this.app.transport.pause(); this.emit('state', 'paused'); }
  resume() { if (this.mode === 'step') return; this.app.transport.resume(); this.emit('state', 'running'); }
  stop() {
    this.active = false; clearInterval(this.sweeper);
    this.offInput?.(); this.offInputOff?.(); this.offInput = this.offInputOff = null;
    if (this.app.transportOwner === 'learn') { this.app.transport.stop(); this.app.transport.setLoop(0, 0); this.app.transport.setRate(1); }
    this.app.lighting.clear();
    this.emit('state', 'stopped');
  }
  setRate(r) { this.rate = r; if (this.active && this.mode !== 'step') this.app.transport.setRate(r); this.emit('rate', r); }
  setSection(sec) { this.section = sec; if (this.active) this.start(sec?.from ?? 0); }

  // ───────────── agendamento (parte do transporte)
  schedule(from, to, toTime, info) {
    if (!this.active || this.app.transportOwner !== 'learn' || this.mode === 'step') return;
    const tr = this.app.transport;
    // acompanhamento + guia
    for (const t of this.song.tracks) {
      const isPlayer = t.id === this.track.id;
      const ch = this.channels.get(t.id); if (!ch) continue;
      const vol = isPlayer ? this.guideVolume : (t.volume ?? 0.8);
      if (vol <= 0.001) continue;
      for (const n of isPlayer ? this.notes : t.notes) {
        if (n.b >= from && n.b < to) {
          const when = toTime(n.b), end = toTime(n.b + (n.d ?? 0.5));
          ch.play({ midi: n.m, vel: (n.v ?? 0.8) * (isPlayer ? vol / 0.8 : 1), when, dur: end - when, tech: ['slap', 'pop', 'mute', 'harmonic', 'pick', 'hammer'].includes(n.tech) ? n.tech : n.tech === 'ghost' ? 'mute' : null });
        }
      }
    }
    // luzes com antecedência (em batidas)
    const ahead = this.anticipation * tr.bpmAt(from) / 60 + 0.01;
    let prevKey = this._lastKey ?? null;
    const addCue = (n, bAt) => {
      const when = toTime(bAt);
      const key = this.app.surface?.keyFor?.(n.m, prevKey) ?? null; prevKey = key ?? prevKey;
      const memory = this.mode === 'memory';
      const cue = this.app.lighting.add({ midi: n.m, key, t: when, dur: Math.max(0.12, toTime(bAt + (n.d ?? 0.5)) - when), vel: n.v ?? 0.75, tech: n.tech ?? (n.chord ? 'chord' : (n.d ?? 0.5) >= 1.9 ? 'sustain' : 'finger'), demo: this.mode === 'listen', memory, b: n.b, order: null });
      if (this.mode !== 'listen') this.evaluator.expect([cue]);
      else this.app.lighting.mark(cue, 'pending');
    };
    const lo = from + ahead, hi = to + ahead;
    const len = tr.loop ? tr.loop.end - tr.loop.start : Infinity;
    for (const n of this.notes) {
      if (n.b >= lo && n.b < hi && (!tr.loop || n.b < tr.loop.end)) addCue(n, n.b);
      else if (tr.loop && n.b + len >= lo && n.b + len < hi && n.b >= tr.loop.start) addCue(n, n.b + len);
    }
    this._lastKey = prevKey;
    this.app.lighting.prune();
    this.emit('progress', { beat: from, length: this.song.length, info });
  }
  silence() { for (const ch of this.channels.values()) { /* vozes terminam naturalmente */ void ch; } }

  // ───────────── entrada
  onInput(ev) {
    if (!this.active) return;
    if (this.mode === 'step') return this.stepInput(ev);
    if (this.mode === 'listen') return;
    const ol = this.app.engine.outputLatency;
    const r = this.evaluator.judge({ ...ev, time: ev.time - ol });
    if (!r) return;
    if (r.grade === 'wrong') { this.app.lighting.flash({ midi: ev.midi, key: ev.target }, 'miss'); this.emit('judge', r); return; }
    this.app.lighting.mark(r.cue, 'hit');
    this.emit('judge', r);
  }
  sweep() {
    const now = this.app.engine.now - this.app.engine.outputLatency;
    const missed = this.evaluator.sweep(now);
    for (const c of missed) { this.app.lighting.mark(c, 'miss'); this.emit('judge', { grade: 'miss', cue: c }); }
  }
  onPass() {
    this.pass++;
    const s = this.evaluator.summary();
    this.passResults.push(s);
    this.emit('pass', { pass: this.pass, summary: s });
    if (this.mode === 'practice' && this.adaptive && this.pass >= 1) {
      // adaptação gradual: ajusta UMA variável por vez
      if (s.accuracy > 0.9 && s.timing > 0.7) {
        if (this.rate < 1) this.setRate(Math.min(1, +(this.rate + 0.1).toFixed(2)));
        else if (this.guideVolume > 0) this.guideVolume = Math.max(0, this.guideVolume - 0.1);
        else if (this.anticipation > 0.6) { this.anticipation -= 0.2; this.app.lighting.anticipation = this.anticipation; }
        this.emit('adapt', { direction: 'up', rate: this.rate, guide: this.guideVolume, anticipation: this.anticipation });
      } else if (s.accuracy < 0.55) {
        if (this.rate > 0.5) this.setRate(Math.max(0.5, +(this.rate - 0.1).toFixed(2)));
        else { this.tolerance = Math.min(2, this.tolerance + 0.25); this.evaluator.setTolerance(this.tolerance); }
        this.emit('adapt', { direction: 'down', rate: this.rate, tolerance: this.tolerance });
      }
      this.evaluator.reset();
    }
  }

  // ───────────── passo a passo
  stepGroup(i) {
    const n0 = this.notes[i]; if (!n0) return [];
    return this.notes.filter((n) => Math.abs(n.b - n0.b) < 0.06);
  }
  showStep() {
    const L = this.app.lighting; L.clear();
    const group = this.stepGroup(this.stepIndex);
    if (!group.length) { this.finish(); return; }
    this.stepPending = new Set(group.map((n) => n.m));
    let prev = this._lastKey ?? null;
    this.stepCues = group.map((n) => { const key = this.app.surface?.keyFor?.(n.m, prev) ?? null; prev = key ?? prev; return L.add({ midi: n.m, key, t: this.app.engine.now + 0.25, dur: 0.3, vel: n.v ?? 0.75, tech: n.tech ?? (group.length > 1 ? 'chord' : 'finger'), waiting: true }); });
    this._lastKey = prev;
    // prévia discreta da próxima nota
    const next = this.stepGroup(this.stepIndex + group.length);
    for (const n of next) L.add({ midi: n.m, key: this.app.surface?.keyFor?.(n.m, prev) ?? null, t: this.app.engine.now + 60, dur: 0.2, vel: 0.3, tech: 'finger' });
    this.emit('progress', { beat: group[0].b, length: this.song.length, step: this.stepIndex, total: this.notes.length });
  }
  stepInput(ev) {
    if (!this.stepPending) return;
    if (this.stepPending.has(ev.midi)) {
      this.stepPending.delete(ev.midi);
      const cue = this.stepCues.find((c) => c.midi === ev.midi && c.state === 'pending');
      if (cue) { cue.waiting = false; this.app.lighting.mark(cue, 'hit'); }
      this.evaluator.results.push({ grade: 'perfect', ev, cue, offset: 0, velOk: true, techOk: true });
      if (!this.stepPending.size) { this.stepIndex += this.stepCues.length; setTimeout(() => this.active && this.showStep(), 260); }
      this.emit('judge', { grade: 'perfect', cue });
    } else {
      this.evaluator.results.push({ grade: 'wrong', ev });
      this.app.lighting.flash({ midi: ev.midi, key: ev.target }, 'miss');
      this.emit('judge', { grade: 'wrong', ev });
    }
  }
  /** Toca a nota esperada (ajuda no modo passo a passo). */
  hint() {
    const ch = this.channels.get(this.track.id) ?? (this.ensureChannels(), this.channels.get(this.track.id));
    for (const m of this.stepPending ?? []) ch?.play({ midi: m, vel: 0.7 });
  }

  finish() {
    if (!this.active) return;
    const summary = this.evaluator.summary();
    const sections = this.evaluator.hardestSections(this.song.sections ?? []);
    this.active = false; clearInterval(this.sweeper);
    this.offInput?.(); this.offInputOff?.(); this.offInput = this.offInputOff = null;
    if (this.app.transportOwner === 'learn') this.app.transport.stop();
    this.emit('end', { summary, sections, mode: this.mode, song: this.song, track: this.track, rate: this.rate });
  }
  /** Duração (s) de um trecho na velocidade atual. */
  durationOf(from, to) { return (beatToSec(to, this.map) - beatToSec(from, this.map)) / this.rate; }
}
