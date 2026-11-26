/**
 * Motor de áudio: cria o AudioContext no primeiro gesto do usuário, mantém o
 * barramento master (compressor de cola + limitador), trata interrupções do
 * iOS (chamadas, Siri, troca de app) e expõe o relógio de áudio.
 */
import { Emitter } from '../core/emitter.js';
import { Channel } from './channel.js';
import { ensureWorklets } from './dsp.js';
import { createEffect } from './effects.js';

export class AudioEngine extends Emitter {
  constructor() {
    super();
    this.ctx = null;
    this.volume = 0.8;
    this.ambience = 0.18;
    this.latencyComp = 0; // ms, calibrado pelo usuário
  }
  get ready() { return !!this.ctx; }
  get now() { return this.ctx ? this.ctx.currentTime : 0; }
  /** Latência de saída estimada (s): quanto tempo até o som sair do alto-falante. */
  get outputLatency() { const c = this.ctx; return c ? (c.outputLatency || 0) + (c.baseLatency || 0) : 0; }

  /** Deve ser chamado dentro de um gesto do usuário (toque/clique/tecla). */
  unlock() {
    if (!this.ctx) this._create();
    const c = this.ctx;
    if (c.state !== 'running') c.resume().catch(() => {});
    if (!this._unlocked) {
      // buffer silencioso destrava o áudio em WebKit antigo
      const b = c.createBuffer(1, 1, c.sampleRate), s = c.createBufferSource(); s.buffer = b; s.connect(c.destination); s.start();
      this._unlocked = true;
    }
    return c;
  }

  _create() {
    const AC = window.AudioContext || window.webkitAudioContext;
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* Safari 17+: ignora a chave de silencioso */ }
    const c = new AC({ latencyHint: 'interactive' });
    this.ctx = c;
    this.master = buildMaster(c, c.destination, this.volume, this.ambience);
    this.analyser = c.createAnalyser(); this.analyser.fftSize = 512; this.analyser.smoothingTimeConstant = 0.75;
    this.master.out.connect(this.analyser);
    ensureWorklets(c).then((ok) => this.emit('worklets', ok));
    c.onstatechange = () => this.emit('state', c.state);
    const resume = () => { if (c.state !== 'running' && c.state !== 'closed') c.resume().catch(() => {}); };
    document.addEventListener('visibilitychange', () => { if (!document.hidden) resume(); });
    window.addEventListener('pointerdown', resume, { capture: true, passive: true });
    window.addEventListener('keydown', resume, { capture: true, passive: true });
    window.addEventListener('pageshow', resume);
    this.emit('ready', c);
  }

  createChannel(opts) { return new Channel(this.ctx, this.master.input, opts); }
  setVolume(v) { this.volume = v; if (this.master) this.master.setVolume(v); }
  setAmbience(v) { this.ambience = v; if (this.master) this.master.setAmbience(v); }

  /** Nível RMS recente (0..1) para visualizações. */
  level() {
    if (!this.analyser) return 0;
    const a = this._buf ?? (this._buf = new Float32Array(this.analyser.fftSize));
    this.analyser.getFloatTimeDomainData(a);
    let s = 0; for (let i = 0; i < a.length; i += 2) s += a[i] * a[i];
    return Math.min(1, Math.sqrt(s / (a.length / 2)) * 3);
  }
  spectrum() {
    if (!this.analyser) return null;
    const b = this._spec ?? (this._spec = new Uint8Array(this.analyser.frequencyBinCount));
    this.analyser.getByteFrequencyData(b); return b;
  }
}

/** Barramento master reutilizado também na renderização offline. */
export function buildMaster(ctx, dest, volume = 0.8, ambience = 0.18) {
  const input = ctx.createGain();
  const glue = ctx.createDynamicsCompressor();
  glue.threshold.value = -16; glue.ratio.value = 2.5; glue.attack.value = 0.01; glue.release.value = 0.2; glue.knee.value = 10;
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -2; limiter.ratio.value = 20; limiter.attack.value = 0.002; limiter.release.value = 0.1; limiter.knee.value = 0;
  const out = ctx.createGain(); out.gain.value = volume;
  const amb = createEffect(ctx, 'reverb', { size: 2, mix: 1, tone: 0.5 });
  const ambSend = ctx.createGain(); ambSend.gain.value = ambience;
  input.connect(glue); input.connect(ambSend); ambSend.connect(amb.input); amb.output.connect(glue);
  glue.connect(limiter); limiter.connect(out); out.connect(dest);
  return {
    input, out, limiter,
    setVolume: (v) => out.gain.setTargetAtTime(v, ctx.currentTime, 0.02),
    setAmbience: (v) => ambSend.gain.setTargetAtTime(v, ctx.currentTime, 0.05),
  };
}

export const engine = new AudioEngine();
