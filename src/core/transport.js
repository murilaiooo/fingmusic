/**
 * Transporte musical com agendamento antecipado (lookahead) no relógio do
 * AudioContext. O timer de JS só "acorda" o agendador; o momento exato de
 * cada evento é sempre um tempo de áudio (ctx.currentTime), então a música
 * não sofre com variações de FPS ou atrasos do setInterval.
 *
 * Partes (parts) registradas recebem janelas [de, até) em batidas e a função
 * para converter batida -> tempo de áudio.
 */
import { Emitter } from './emitter.js';
import { beatToSec, secToBeat, normalizeTempoMap, bpmAt } from './timeline.js';

export class Transport extends Emitter {
  constructor(engine) {
    super();
    this.engine = engine;
    this.tempoMap = normalizeTempoMap(null, 100);
    this.rate = 1;
    this.loop = null; // {start, end} em batidas, ou null
    this.playing = false;
    this.anchorTime = 0; // tempo de áudio em que o "cursor" estava em anchorBeat
    this.anchorBeat = 0;
    this.scheduledTo = 0; // batida "absoluta" (desenrolada) já agendada
    this.parts = new Set();
    this.lookahead = 0.14;
    this.interval = 25;
    this.timer = 0;
    this.beatsPerBar = 4;
  }
  get bpm() { return this.tempoMap[0].bpm; }
  setBpm(bpm) {
    const b = this.playing ? this.beatNow() : this.anchorBeat;
    this.tempoMap = normalizeTempoMap([{ b: 0, bpm }]);
    if (this.playing) this._reanchor(b);
    this.emit('tempo', bpm);
  }
  setTempoMap(map) { const b = this.playing ? this.beatNow() : this.anchorBeat; this.tempoMap = normalizeTempoMap(map, this.bpm); if (this.playing) this._reanchor(b); }
  setRate(r) { const b = this.playing ? this.beatNow() : this.anchorBeat; this.rate = Math.max(0.25, Math.min(2, r)); if (this.playing) this._reanchor(b); this.emit('rate', this.rate); }
  setLoop(start, end) { this.loop = end > start ? { start, end } : null; }
  bpmAt(b) { return bpmAt(b, this.tempoMap) * this.rate; }

  /** "Linha contínua" de tempo: batida absoluta desenrolada (sem voltar no loop). */
  _absToTime(abs) {
    const s0 = beatToSec(this.anchorBeat, this.tempoMap, this.rate);
    if (!this.loop) return this.anchorTime + beatToSec(abs, this.tempoMap, this.rate) - s0;
    // dentro de loop: tempo linear por batida dentro do loop (tempo constante por segmento)
    return this.anchorTime + this._loopSec(this.anchorBeat, abs);
  }
  _loopSec(fromAbs, toAbs) {
    // integra segundos entre posições desenroladas, mapeando cada volta para o loop
    const { start, end } = this.loop, len = end - start;
    let s = 0, b = fromAbs;
    while (b < toAbs - 1e-9) {
      const local = this._wrap(b), segEnd = Math.min(toAbs, b + (end - local));
      s += beatToSec(local + (segEnd - b), this.tempoMap, this.rate) - beatToSec(local, this.tempoMap, this.rate);
      b = segEnd;
      if (len <= 0) break;
    }
    return s;
  }
  _wrap(abs) { if (!this.loop) return abs; const { start, end } = this.loop, len = end - start; if (abs < end) return abs; return start + ((abs - start) % len); }

  /** Posição musical (batida dentro da música/loop) no tempo de áudio t. */
  beatAt(t = this.engine.now) {
    if (!this.playing) return this.anchorBeat;
    const abs = this._timeToAbs(t);
    return this._wrap(abs);
  }
  beatNow() { return this.beatAt(this.engine.now); }
  _timeToAbs(t) {
    const dt = t - this.anchorTime;
    if (!this.loop) return secToBeat(beatToSec(this.anchorBeat, this.tempoMap, this.rate) + dt, this.tempoMap, this.rate);
    // busca incremental (loops têm tempo normalmente constante)
    const spb = 60 / this.bpmAt(this._wrap(this.anchorBeat));
    let guess = this.anchorBeat + dt / spb;
    for (let i = 0; i < 3; i++) { const err = this._absToTime(guess) - t; guess -= err / spb; }
    return guess;
  }
  /** Tempo de áudio de uma batida local, a partir de agora (próxima ocorrência). */
  timeOfBeat(local) {
    if (!this.playing) return null;
    const nowAbs = this._timeToAbs(this.engine.now);
    let abs = nowAbs + (local - this._wrap(nowAbs));
    if (abs < nowAbs - 1e-6 && this.loop) abs += this.loop.end - this.loop.start;
    return this._absToTime(abs);
  }

  start({ at = null, fromBeat = null, countIn = 0 } = {}) {
    const ctx = this.engine.ctx; if (!ctx) return;
    this.stopTimer();
    const startBeat = fromBeat ?? (this.loop ? this.loop.start : 0);
    const t0 = (at ?? ctx.currentTime + 0.08);
    this.anchorBeat = startBeat - countIn;
    this.anchorTime = t0;
    this.countInEnd = countIn ? startBeat : null;
    this.scheduledTo = this.anchorBeat;
    this.playing = true;
    this.emit('start', { time: t0, beat: startBeat, countIn });
    this._tick();
    this.timer = setInterval(() => this._tick(), this.interval);
  }
  /** Pausa preservando a posição; resume() continua do mesmo ponto. */
  pause() { if (!this.playing) return; const b = this.beatNow(); this.stopTimer(); this.playing = false; this.anchorBeat = b; this.emit('pause', b); this._silence(); }
  resume() { if (this.playing) return; this.start({ fromBeat: this.anchorBeat }); }
  stop() { this.stopTimer(); this.playing = false; this.anchorBeat = this.loop ? this.loop.start : 0; this.emit('stop'); this._silence(); }
  seek(b) { const was = this.playing; this.stopTimer(); this.playing = false; this.anchorBeat = b; this._silence(); if (was) this.start({ fromBeat: b }); }
  stopTimer() { clearInterval(this.timer); this.timer = 0; }
  _silence() { for (const p of this.parts) p.silence?.(); }
  _reanchor(beat) {
    const t = this.engine.now; this.anchorTime = t; this.anchorBeat = beat; this.scheduledTo = beat;
    for (const p of this.parts) p.silence?.();
  }

  addPart(p) { this.parts.add(p); return () => this.parts.delete(p); }

  _tick() {
    if (!this.playing) return;
    const ctx = this.engine.ctx; const now = ctx.currentTime;
    // retomada após interrupção (ex.: iOS suspendeu o contexto): reancora sem disparar rajadas
    if (this._absToTime(this.scheduledTo) < now - 0.25) { this._reanchor(this._wrap(this._timeToAbs(now))); this.anchorBeat = this._wrap(this.anchorBeat); }
    const horizon = now + this.lookahead;
    const toAbs = this._timeToAbs(horizon);
    if (toAbs <= this.scheduledTo) return;
    let from = this.scheduledTo;
    // divide a janela em trechos contínuos (sem atravessar o fim do loop)
    while (from < toAbs - 1e-9) {
      const local = this._wrap(from);
      let segEnd = toAbs;
      if (this.loop && local + (toAbs - from) > this.loop.end) segEnd = from + (this.loop.end - local);
      if (this.loop && from < this.loop.start && this.anchorBeat < this.loop.start) segEnd = Math.min(segEnd, this.loop.start);
      const localTo = local + (segEnd - from), absBase = from;
      const toTime = (b) => this._absToTime(absBase + (b - local));
      for (const p of this.parts) p.schedule(local, localTo, toTime, { abs: from });
      from = segEnd;
      if (this.loop && Math.abs(this._wrap(from) - this.loop.start) < 1e-9 && from > absBase) this.emit('wrap', { time: this._absToTime(from) });
    }
    this.scheduledTo = toAbs;
    if (!this.loop && this.endBeat != null && this._wrap(toAbs) >= this.endBeat) {
      const tEnd = this._absToTime(this.endBeat);
      setTimeout(() => { if (this.playing && this.engine.now >= tEnd - 0.01) { this.stop(); this.emit('end'); } }, Math.max(0, (tEnd - now) * 1000 + 30));
      this.endBeat = null;
    }
  }
}

/** Metrônomo como parte do transporte (inclusive na contagem regressiva). */
export class Metronome {
  constructor(engine, transport) { this.engine = engine; this.transport = transport; this.enabled = false; this.forceCountIn = false; this.volume = 0.5; }
  schedule(from, to, toTime) {
    const tr = this.transport;
    const inCount = tr.countInEnd != null;
    if (!this.enabled && !inCount) return;
    for (let b = Math.ceil(from - 1e-9); b < to; b++) {
      if (!this.enabled && !(tr.countInEnd != null && b < tr.countInEnd)) continue;
      if (tr.countInEnd != null && b >= tr.countInEnd && !this.enabled) continue;
      const t = toTime(b), accent = ((b % tr.beatsPerBar) + tr.beatsPerBar) % tr.beatsPerBar === 0;
      this.click(t, accent);
      if (tr.countInEnd != null && b < tr.countInEnd) tr.emit('countin', { beat: b, left: tr.countInEnd - b, time: t });
    }
  }
  click(t, accent) {
    const ctx = this.engine.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = accent ? 1760 : 1175; o.type = 'triangle';
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(this.volume * (accent ? 0.5 : 0.32), t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    o.connect(g); g.connect(this.engine.master.input); o.start(t); o.stop(t + 0.06); o.onended = () => { o.disconnect(); g.disconnect(); };
  }
}
