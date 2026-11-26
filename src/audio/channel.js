/**
 * Canal de mixagem: vozes -> inserts do instrumento -> pedaleira -> volume -> pan -> saída.
 * Um canal por pista do estúdio (e um canal "ao vivo" para o modo livre).
 */
import { buildInserts } from './inserts.js';
import { createEffect, PEDAL_ORDER, defaultParams } from './effects.js';
import { disconnectAll } from './dsp.js';
import { startVoice } from './voices.js';
import { clamp } from '../core/util.js';

export class Channel {
  constructor(ctx, dest, { instrument, volume = 0.8, pan = 0 } = {}) {
    this.ctx = ctx;
    this.voiceIn = ctx.createGain();
    this.fxIn = ctx.createGain();
    this.fxOut = ctx.createGain();
    this.gain = ctx.createGain();
    this.panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    this.out = this.panner ?? this.gain;
    if (this.panner) this.gain.connect(this.panner);
    this.out.connect(dest);
    this.fxOut.connect(this.gain);
    this.inserts = null;
    this.effects = new Map(); // id -> effect instance
    this.fxState = {}; // id -> {on, params}
    this.bpm = 100; this.root = 0;
    this._mute = false; this._vol = volume;
    this.setVolume(volume); this.setPan(pan);
    if (instrument) this.setInstrument(instrument);
    this._wireFx();
  }

  setInstrument(inst) {
    if (this.inst?.id === inst.id && this.inserts) return;
    this.inst = inst;
    const old = this.inserts;
    this.inserts = buildInserts(this.ctx, inst.insert ?? []);
    this.inserts.sync(this.bpm); this.inserts.tune(this.root);
    this.voiceIn.disconnect();
    this.voiceIn.connect(this.inserts.input);
    this.inserts.output.connect(this.fxIn);
    if (old) setTimeout(() => old.dispose(), 4000); // deixa as caudas soarem
  }

  /** Aplica o estado completo da pedaleira: {reverb:{on:true, params:{...}}, ...} */
  setFxState(state = {}) {
    this.fxState = JSON.parse(JSON.stringify(state));
    for (const id of PEDAL_ORDER) {
      const st = this.fxState[id];
      const has = this.effects.get(id);
      if (st?.on && !has) this.effects.set(id, createEffect(this.ctx, id, st.params));
      else if (st?.on && has) for (const [k, v] of Object.entries(st.params ?? {})) has.set(k, v);
      else if (!st?.on && has) { this.effects.delete(id); const fx = has; setTimeout(() => fx.dispose(), 60); }
    }
    this._wireFx();
  }
  setFxParam(id, key, value) {
    const st = this.fxState[id] ?? (this.fxState[id] = { on: false, params: defaultParams(id) });
    st.params = { ...defaultParams(id), ...st.params, [key]: value };
    this.effects.get(id)?.set(key, value);
  }
  _wireFx() {
    const t = this.ctx.currentTime;
    // pequena rampa para evitar estalos ao religar
    this.fxOut.gain.cancelScheduledValues(t);
    this.fxOut.gain.setValueAtTime(this.fxOut.gain.value, t);
    this.fxOut.gain.linearRampToValueAtTime(0.0001, t + 0.012);
    const rewire = () => {
      this.fxIn.disconnect();
      for (const fx of this.effects.values()) { try { fx.output.disconnect(); } catch { /* */ } }
      let prev = this.fxIn;
      for (const id of PEDAL_ORDER) { const fx = this.effects.get(id); if (fx) { prev.connect(fx.input); prev = fx.output; fx.sync?.(this.bpm); } }
      prev.connect(this.fxOut);
      const t2 = this.ctx.currentTime;
      this.fxOut.gain.setValueAtTime(0.0001, t2);
      this.fxOut.gain.linearRampToValueAtTime(1, t2 + 0.02);
    };
    if (this.ctx.state === 'running' && !(this.ctx instanceof (globalThis.OfflineAudioContext ?? Function))) setTimeout(rewire, 14); else rewire();
  }
  syncTempo(bpm) { this.bpm = bpm; for (const fx of this.effects.values()) fx.sync?.(bpm); this.inserts?.sync(bpm); }
  tune(root) { this.root = root; this.inserts?.tune(root); }
  setVolume(v) { this._vol = v; this._applyGain(); }
  setMute(m) { this._mute = m; this._applyGain(); }
  _applyGain() { const g = this._mute ? 0 : clamp(this._vol, 0, 1.5) ** 1.6; this.gain.gain.setTargetAtTime(g, this.ctx.currentTime, 0.015); }
  setPan(p) { if (this.panner) this.panner.pan.setTargetAtTime(clamp(p, -1, 1), this.ctx.currentTime, 0.02); }

  play(opts) { return startVoice(this.ctx, this.voiceIn, this.inst, opts); }

  dispose() {
    this.inserts?.dispose();
    for (const fx of this.effects.values()) fx.dispose();
    disconnectAll(this.voiceIn, this.fxIn, this.fxOut, this.gain, this.panner);
  }
}
