/**
 * Núcleo da aplicação: compõe motor de áudio, transporte, performer,
 * iluminação, superfícies, estúdio, prática, Genius e câmera, e roda o
 * laço de renderização com qualidade adaptativa (a música tem prioridade:
 * se o aparelho sofrer, os efeitos visuais diminuem primeiro).
 */
import { Emitter } from './core/emitter.js';
import { engine } from './audio/engine.js';
import { Transport, Metronome } from './core/transport.js';
import { Performer } from './core/performer.js';
import { Lighting } from './light/lighting.js';
import { Particles } from './render/particles.js';
import { haptics } from './core/haptics.js';
import { loadSettings, saveSettings } from './persist/settings.js';
import { getInstrument } from './instruments/catalog.js';
import { createSurface } from './surfaces/index.js';
import { bindPointers, bindKeyboard } from './input/pointers.js';
import { Studio } from './studio/session.js';
import { Practice } from './learn/practice.js';
import { GeniusController } from './genius/controller.js';
import { prewarm, activeVoiceCount } from './audio/voices.js';
import { debounce } from './core/util.js';

const BONES = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17]];

export class App extends Emitter {
  constructor(canvas) {
    super();
    this.canvas = canvas; this.ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
    this.settings = loadSettings();
    const s = this.settings;
    this.music = { root: s.root, scale: s.scale, octave: s.octave, assist: s.assist, highlightRoots: s.highlightRoots, showScale: s.showScale };
    this.engine = engine; engine.volume = s.volume; engine.ambience = s.ambience;
    this.transport = new Transport(engine);
    this.metronome = new Metronome(engine, this.transport); this.metronome.volume = s.metronomeVolume;
    this.transport.addPart(this.metronome);
    this.transportOwner = 'studio';
    this.performer = new Performer(engine);
    this.lighting = new Lighting(() => engine.now - engine.outputLatency);
    this.applyLightingSettings();
    this.particles = new Particles(matchMedia('(pointer: coarse)').matches ? 240 : 500);
    this.haptics = haptics; haptics.setEnabled(s.haptics);
    this.studio = new Studio(this);
    this.practice = new Practice(this);
    this.genius = new GeniusController(this);
    this.tracker = null;
    this.mode = 'home';
    this.qualityLevel = matchMedia('(pointer: coarse)').matches ? 1 : 2; this.frameMs = 16; this.slowFrames = 0; this.fastFrames = 0;
    this.insets = { top: 64, bottom: 90, left: 0, right: 0 };
    this.flashes = [];
    this.saveSettingsSoon = debounce(() => saveSettings(this.settings), 300);
    this.W = 0; this.H = 0;
    this.fx = { flash: (hue, k) => { if (!this.settings.reduceMotion) this.flashes.push({ hue, k, t: performance.now() }); } };
    this.setInstrument(s.lastInstrument, { silent: true });
    bindPointers(canvas, {
      down: (p) => { this.engine.unlock(); this.ensureLiveChannel(); this.surface?.down(p); this.emit('touch', p); },
      move: (p) => this.surface?.move(p),
      up: (p) => this.surface?.up(p),
    });
    bindKeyboard(this);
    engine.on('ready', () => { this.ensureLiveChannel(); this.prewarmSurface(); });
    addEventListener('resize', () => this.resize());
    window.visualViewport?.addEventListener('resize', () => this.resize());
    this.resize();
    requestAnimationFrame((t) => this.frame(t));
  }

  get quality() { return this.qualityLevel; }
  get currentInstrument() { return this.instrument; }

  update(patch) { Object.assign(this.settings, patch); this.saveSettingsSoon(); this.emit('settings', patch); }
  applyLightingSettings() {
    const s = this.settings, L = this.lighting;
    L.reduceFlashes = s.reduceMotion; L.highContrast = s.highContrast; L.showShapes = s.showShapes; L.anticipation = s.anticipation;
    L.enabled = s.lightsMode !== 'off';
  }
  setMusic(patch) {
    Object.assign(this.music, patch);
    for (const k of ['root', 'scale', 'octave', 'assist', 'highlightRoots', 'showScale']) if (k in patch) this.settings[k] = patch[k];
    this.saveSettingsSoon();
    this.liveChannel?.tune(this.music.root);
    if (this.surface && !this.surface.fixedNotes) this.surface.rebuild();
    this.emit('music', this.music);
  }

  // ───────────── instrumento e superfície
  setInstrument(id, { silent = false, surfaceOpts = {} } = {}) {
    const inst = getInstrument(id);
    this.instrument = inst;
    if (!silent) { this.settings.lastInstrument = inst.id; this.saveSettingsSoon(); }
    const fixed = this.surface?.fixedNotes ?? null;
    this.surface?.destroy();
    this.surface = createSurface(this, inst, { ...this.surfaceOpts, ...surfaceOpts });
    if (fixed && this.keepFixed) this.surface.fixedNotes = fixed;
    this.layoutSurface();
    if (this.liveChannel) {
      this.liveChannel.setInstrument(inst);
      this.liveChannel.setFxState(this.settings.fx[inst.id] ?? {});
    }
    this.prewarmSurface();
    this.emit('instrument', inst);
  }
  /** Opções de superfície do modo atual (ex.: cordas personalizadas, Playground). */
  setSurfaceOptions(opts) { this.surfaceOpts = opts; this.setInstrument(this.instrument.id, { silent: true }); }
  ensureLiveChannel() {
    if (!this.engine.ready) return null;
    if (!this.liveChannel) {
      this.liveChannel = this.engine.createChannel({ instrument: this.instrument, volume: 0.85 });
      this.liveChannel.setFxState(this.settings.fx[this.instrument.id] ?? {});
      this.liveChannel.tune(this.music.root);
    }
    if (!this.performerChannelOverride) this.performer.setChannel(this.liveChannel);
    return this.liveChannel;
  }
  /** Usa o canal de uma pista do estúdio (para gravar com os efeitos dela). */
  usePerformerChannel(ch) { this.performerChannelOverride = ch; this.performer.setChannel(ch ?? this.liveChannel); }
  prewarmSurface() {
    if (!this.engine.ready || !this.surface) return;
    const ms = [...new Set(this.surface.elements().map((e) => e.midi))].slice(0, 24);
    prewarm(this.engine.ctx, this.instrument, ms);
  }
  setFx(state) {
    this.settings.fx = { ...this.settings.fx, [this.instrument.id]: state }; this.saveSettingsSoon();
    (this.performerChannelOverride ?? this.liveChannel)?.setFxState(state);
    this.emit('fx', state);
  }

  // ───────────── layout
  resize() {
    const vv = window.visualViewport;
    const W = Math.round(vv?.width ?? innerWidth), H = Math.round(vv?.height ?? innerHeight);
    this.W = W; this.H = H;
    this.applyDpr();
    this.layoutSurface();
    this.emit('resize', { W, H });
  }
  applyDpr() {
    const max = [1, 1.5, 2][this.qualityLevel];
    const dpr = Math.min(devicePixelRatio || 1, max);
    this.dpr = dpr;
    this.canvas.width = Math.round(this.W * dpr); this.canvas.height = Math.round(this.H * dpr);
    this.canvas.style.width = this.W + 'px'; this.canvas.style.height = this.H + 'px';
  }
  setInsets(ins) { Object.assign(this.insets, ins); this.layoutSurface(); }
  layoutSurface() {
    if (!this.surface || !this.W) return;
    const cs = getComputedStyle(document.documentElement);
    const safe = (v) => parseFloat(cs.getPropertyValue(v)) || 0;
    const L = safe('--sal') + 10, R = safe('--sar') + 10;
    const top = this.insets.top + 6, bottom = this.insets.bottom + 6;
    this.surfaceRect = { x: L, y: top, w: Math.max(100, this.W - L - R), h: Math.max(120, this.H - top - bottom) };
    this.surface.layout(this.surfaceRect);
  }

  // ───────────── câmera
  async enableCamera() {
    if (!this.tracker) {
      const { HandTracker } = await import('./hands/tracker.js');
      this.tracker = new HandTracker();
      const s = this.settings;
      Object.assign(this.tracker, { pinchOn: s.pinchOn, pinchOff: s.pinchOff, maxFps: s.maxHandFps, fingers: s.handFingers === 1 ? [8] : s.handFingers === 3 ? [8, 12, 16] : [8, 12] });
      this.tracker.roles = { Left: s.handRoleLeft, Right: s.handRoleRight };
      this.tracker.on('pointer', (p) => {
        const S = this.surface; if (!S) return;
        if (p.type === 'down') { this.engine.unlock(); this.ensureLiveChannel(); S.down(p); }
        else if (p.type === 'move') S.move(p); else if (p.type === 'up') S.up(p);
        else if (p.type === 'hover') S.hover(p); else if (p.type === 'hoverEnd') S.hoverEnd?.(p.id);
      });
      this.tracker.on('fx', (f) => this.handFx(f));
      this.tracker.on('status', (st) => this.emit('camera-status', st));
    }
    await this.tracker.start();
    this.emit('camera', true);
  }
  disableCamera() { this.tracker?.stop(); this.emit('camera', false); }
  get cameraOn() { return !!this.tracker?.active; }
  /** Mão com papel de "efeito": altura controla o wah/filtro da pedaleira ao vivo. */
  handFx(f) {
    const ch = this.performerChannelOverride ?? this.liveChannel; if (!ch) return;
    const v = Math.max(0, Math.min(1, 1 - f.y));
    if (ch.effects.has('wah')) { ch.setFxParam('wah', 'mode', 2); ch.setFxParam('wah', 'pedal', v); }
    else if (ch.effects.has('filter')) ch.setFxParam('filter', 'cutoff', 200 * Math.pow(60, v));
    this.handFxValue = v;
  }

  // ───────────── laço de quadros
  frame(t) {
    requestAnimationFrame((x) => this.frame(x));
    const dt = Math.min(100, t - (this.lastT ?? t)); this.lastT = t;
    this.adaptQuality(dt);
    if (document.hidden) return;
    if (!this.lastPrune || t - this.lastPrune > 400) { this.lighting.prune(); this.lastPrune = t; }
    if (this.tracker?.running) this.tracker.update(t, this.W, this.H);
    const ctx = this.ctx, W = this.W, H = this.H;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.drawBackground(ctx, t);
    if (this.surface && this.mode !== 'none') {
      ctx.globalCompositeOperation = 'lighter';
      this.surface.render(ctx, t, dt);
      this.particles.update(dt);
      this.particles.draw(ctx, this.settings.reduceMotion);
      ctx.globalCompositeOperation = 'source-over';
    }
    if (this.tracker?.running) this.drawHands(ctx);
    // flash de energia ao soltar uma corda com força
    for (const f of this.flashes) {
      const k = 1 - (t - f.t) / 380; if (k <= 0) { f.dead = true; continue; }
      ctx.fillStyle = `hsla(${f.hue},100%,70%,${0.12 * k * f.k})`; ctx.fillRect(0, 0, W, H);
    }
    if (this.flashes.length) this.flashes = this.flashes.filter((f) => !f.dead);
    this.emit('frame', { t, dt });
  }
  adaptQuality(dt) {
    this.frameMs += (dt - this.frameMs) * 0.05;
    const pref = this.settings.quality;
    let q = this.qualityLevel;
    if (pref !== 'auto') q = { low: 0, medium: 1, high: 2 }[pref] ?? 2;
    else {
      if (this.frameMs > 24) this.slowFrames++; else this.slowFrames = Math.max(0, this.slowFrames - 1);
      if (this.frameMs < 14) this.fastFrames++; else this.fastFrames = 0;
      if (this.slowFrames > 24 && q > 0) { q--; this.slowFrames = 0; }
      if (this.fastFrames > 600 && q < (matchMedia('(pointer: coarse)').matches ? 1 : 2)) { q++; this.fastFrames = 0; }
    }
    if (q !== this.qualityLevel) {
      this.qualityLevel = q; this.applyDpr();
      this.particles.setLimit([90, 240, 500][q]);
      if (this.tracker) this.tracker.maxFps = Math.min(this.settings.maxHandFps, [15, 24, 30][q]);
      this.emit('quality', q);
    }
  }
  drawBackground(ctx, t) {
    const W = this.W, H = this.H, hue = this.instrument?.hue ?? 260;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#06070d'; ctx.fillRect(0, 0, W, H);
    const tr = this.tracker;
    if (tr?.active && tr.video.videoWidth) {
      const v = tr.video, vw = v.videoWidth, vh = v.videoHeight, s = Math.max(W / vw, H / vh);
      ctx.save(); ctx.globalAlpha = this.settings.cameraOpacity;
      if (tr.facing === 'user') { ctx.translate(W, 0); ctx.scale(-1, 1); }
      ctx.drawImage(v, (W - vw * s) / 2, (H - vh * s) / 2, vw * s, vh * s);
      ctx.restore();
    }
    // aurora reativa ao som (nível RMS); estática se "reduzir movimento"
    const lvl = this.settings.reduceMotion ? 0.2 : this.qualityLevel === 0 ? 0.15 : this.engine.level();
    this.level = (this.level ?? 0) + (lvl - (this.level ?? 0)) * 0.12;
    const tint = this.backgroundTint ?? hue;
    const g = ctx.createRadialGradient(W * 0.5, H * 1.05, 0, W * 0.5, H * 1.05, Math.max(W, H) * (0.75 + this.level * 0.25));
    g.addColorStop(0, `hsla(${tint},70%,${18 + this.level * 14}%,${tr?.active ? 0.35 : 0.85})`); g.addColorStop(1, 'hsla(240,40%,4%,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    if (this.qualityLevel >= 1 && !tr?.active) {
      const g2 = ctx.createRadialGradient(W * 0.85, -H * 0.1, 0, W * 0.85, -H * 0.1, Math.max(W, H) * 0.7);
      g2.addColorStop(0, `hsla(${(tint + 60) % 360},70%,22%,.35)`); g2.addColorStop(1, 'hsla(0,0%,0%,0)');
      ctx.fillStyle = g2; ctx.fillRect(0, 0, W, H);
    }
  }
  drawHands(ctx) {
    for (const h of this.tracker.hands.values()) {
      const P = h.pts;
      if (this.settings.showSkeleton) {
        ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.lineWidth = 1.5; ctx.beginPath();
        for (const [i, j] of BONES) { ctx.moveTo(P[i].x, P[i].y); ctx.lineTo(P[j].x, P[j].y); } ctx.stroke();
      }
      const fx = h.role === 'fx';
      ctx.strokeStyle = fx ? 'rgba(255,200,120,.8)' : 'rgba(255,255,255,.6)'; ctx.lineWidth = 1.5;
      for (const ti of [4, ...this.tracker.fingers]) { ctx.beginPath(); ctx.arc(P[ti].x, P[ti].y, 7, 0, 6.283); ctx.stroke(); }
      if (h.pinch && h.pp) { const g = ctx.createRadialGradient(h.pp.x, h.pp.y, 0, h.pp.x, h.pp.y, 20); g.addColorStop(0, 'rgba(255,235,170,1)'); g.addColorStop(1, 'rgba(255,200,120,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(h.pp.x, h.pp.y, 20, 0, 6.283); ctx.fill(); }
      if (fx) { ctx.fillStyle = 'rgba(255,200,120,.9)'; ctx.font = '600 11px ui-rounded,system-ui'; ctx.textAlign = 'center'; ctx.fillText('efeito ' + Math.round((this.handFxValue ?? 0) * 100) + '%', P[9].x, P[9].y - 28); }
    }
  }
  stats() { return { fps: Math.round(1000 / this.frameMs), quality: this.qualityLevel, voices: activeVoiceCount(), handMs: this.tracker ? Math.round(this.tracker.latencyMs) : null, audioLatencyMs: Math.round(this.engine.outputLatency * 1000) }; }
}
