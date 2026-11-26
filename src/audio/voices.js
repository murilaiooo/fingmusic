/**
 * Vozes: transformam (instrumento, nota, força, técnica) em som.
 * Funcionam com qualquer BaseAudioContext — inclusive OfflineAudioContext,
 * o que permite exportar WAV usando exatamente o mesmo código da execução ao vivo.
 *
 * Cada voz devolve um "handle" com: setBend(semitons, tempo), noteOff(quando),
 * kill(), alive, para técnicas expressivas (bend, slide, vibrato, hammer-on).
 */
import { renderPluck } from './synth/pluck.js';
import { renderModal, renderFM } from './synth/modal.js';
import { playDrum } from './drums.js';
import { clamp, mtof } from '../core/util.js';
import { disconnectAll } from './dsp.js';

// ───────────── cache de buffers renderizados (LRU por contexto)
const MAX_BUFFERS = 160;
const caches = new WeakMap();
function cacheFor(ctx) { let c = caches.get(ctx); if (!c) caches.set(ctx, (c = new Map())); return c; }
function getBuffer(ctx, key, render) {
  const cache = cacheFor(ctx);
  if (cache.has(key)) { const b = cache.get(key); cache.delete(key); cache.set(key, b); return b; }
  const sr = Math.min(ctx.sampleRate, 32000);
  const data = render(sr);
  const buf = ctx.createBuffer(1, data.length, sr);
  buf.getChannelData(0).set(data);
  cache.set(key, buf);
  if (cache.size > MAX_BUFFERS) cache.delete(cache.keys().next().value);
  return buf;
}
export const bufferCacheSize = (ctx) => cacheFor(ctx).size;

const velBucket = (v) => v < .5 ? .5 : .8;
const velGain = (v) => 0.1 + 0.9 * Math.pow(clamp(v, 0, 1.5), 1.4);

// ───────────── técnicas para cordas
const TECH = {
  finger: {},
  pick: { noise: +0.25, transient: { amount: 0.35, tone: 0.95, len: 0.004 } },
  slap: { bright: +0.12, transient: { amount: 1.1, tone: 0.55, len: 0.012 }, vel: 1.1 },
  pop: { bright: 0.98, pos: 0.05, transient: { amount: 1.0, tone: 1, len: 0.006 }, vel: 1.15 },
  mute: { mute: true, bright: -0.15 },
  harmonic: { harmonic: true },
  hammer: { noise: 0, transient: null, bright: -0.12, vel: 0.65 },
  snap: { bright: +0.2, transient: { amount: 0.8, tone: 0.9, len: 0.005 }, vel: 1.1 },
};

function pluckParams(inst, midi, vel, pos, tech) {
  const base = inst.params, t = TECH[tech] ?? {};
  const p = { ...base, freq: mtof(midi), vel };
  if (pos != null) p.pos = clamp(base.pos * 0.5 + pos * 0.5, 0.04, 0.5);
  for (const k of ['noise', 'bright']) if (typeof t[k] === 'number') p[k] = clamp(k === 'bright' && (t[k] > 0.5) ? t[k] : (base[k] ?? 0.5) + t[k], 0, 1);
  if (t.pos) p.pos = t.pos;
  if ('transient' in t) p.transient = t.transient ? { ...t.transient } : null;
  if (t.mute) { p.mute = true; p.muteDecay = inst.family === 'bass' ? 0.38 : 0.22; p.dur = 0.8; }
  if (t.harmonic) { p.freq *= 2; p.pos = 0.5; p.noise = 0.02; p.bright = 0.85; p.decay = (base.decay ?? 3) * 0.7; }
  return p;
}

// Classic harp: the original noise-excited Karplus–Strong timbre, with
// fractional pitch corrected by the source sample clock and a short fade.
export function classicHarpSample(midi, sr = 32000) {
  const freq=mtof(midi), period=Math.max(2,Math.round(sr/freq-.5));
  const ring=new Float32Array(period), out=new Float32Array(Math.floor(sr*3));
  let seed=(midi*7919+12345)>>>0;
  for(let i=0;i<period;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;ring[i]=seed/2147483648-1;}
  for(let i=1;i<period;i++) ring[i]=(ring[i]+ring[i-1])*.5;
  let p=0;
  for(let i=0;i<out.length;i++){const nx=p+1===period?0:p+1;const a=ring[p];out[i]=a;ring[p]=(a+ring[nx])*.499;p=nx;}
  const fade=Math.floor(sr*.075);
  for(let i=0;i<fade;i++)out[out.length-1-i]*=i/fade;
  return out;
}
function pluckSample(inst,midi,tech,sr) {
  if(inst.id==='harp' && (tech==='finger'||tech==='snap')) return classicHarpSample(midi,sr);
  return renderPluck({...pluckParams(inst,midi,.8,null,tech),sr});
}

/** Vozes ativas (para limite de polifonia e roubo de vozes). */
const active = new Set();
export const MAX_VOICES = 40;
export const activeVoiceCount = () => active.size;
function register(v) {
  active.add(v);
  if (active.size > MAX_VOICES) {
    let oldest = null; for (const x of active) if (!oldest || x.started < oldest.started) oldest = x;
    if (oldest) { active.delete(oldest); oldest.kill(0.02); }
  }
}

function makePanner(ctx, pan, dest) {
  if (!ctx.createStereoPanner) return { node: null, out: dest };
  const p = ctx.createStereoPanner(); p.pan.value = clamp(pan, -1, 1); p.connect(dest); return { node: p, out: p };
}

/**
 * Inicia uma nota. opts: {midi, vel, when, pan, pos, tech, dur}
 * dest: AudioNode de entrada do canal (voiceIn).
 */
export function startVoice(ctx, dest, inst, opts) {
  const when = Math.max(ctx.currentTime, opts.when ?? ctx.currentTime);
  const vel = clamp(opts.vel ?? 0.7, 0.02, 1.5);
  switch (inst.engine) {
    case 'pluck': return pluckVoice(ctx, dest, inst, opts, when, vel);
    case 'modal': case 'fm': return bufferVoice(ctx, dest, inst, opts, when, vel);
    case 'osc': return oscVoice(ctx, dest, inst, opts, when, vel);
    case 'drum': playDrum(ctx, dest, inst.kit, opts.midi, when, vel * (inst.gain ?? 1)); return null;
    default: return null;
  }
}

function pluckVoice(ctx, dest, inst, opts, when, vel) {
  const tech = opts.tech ?? inst.tech ?? 'finger';
  const t = TECH[tech] ?? {};
  const v = clamp(vel * (t.vel ?? 1), 0.02, 1.5);
  // Position and force affect the native filter/gain, not the cache key.
  const posB = null;
  const vb = .8;
  const key = `p|${inst.id}|${opts.midi}|${vb}|${posB}|${tech}`;
  const buf = getBuffer(ctx, key, (sr) => pluckSample(inst, opts.midi, tech, sr));
  const src = ctx.createBufferSource(); src.buffer = buf;
  const baseRate = inst.id === 'harp' && (tech === 'finger' || tech === 'snap') ? mtof(opts.midi) * (Math.max(2, Math.round(buf.sampleRate / mtof(opts.midi) - .5)) + .5) / buf.sampleRate : 1;
  src.playbackRate.value = baseRate;
  const g = ctx.createGain(); g.gain.value = velGain(v) * (inst.gain ?? 1) * 0.55;
  const pan = makePanner(ctx, opts.pan ?? 0, dest);
  let chain = src, filt = null;
  const fe = inst.params.filterEnv;
  if (fe) {
    filt = ctx.createBiquadFilter(); filt.type = fe.type; filt.Q.value = fe.q;
    const amt = fe.velAmt ? 0.35 + 0.65 * clamp(v, 0, 1.2) : 1;
    const peak = fe.from + (fe.peak - fe.from) * amt;
    filt.frequency.setValueAtTime(fe.from, when);
    filt.frequency.linearRampToValueAtTime(peak, when + fe.attack);
    filt.frequency.setTargetAtTime(fe.to, when + fe.attack, fe.decay / 3);
    src.connect(filt); chain = filt;
  } else {
    filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.Q.value = .45;
    const pos = opts.pos ?? .35;
    filt.frequency.value = Math.min(14000, Math.max(mtof(opts.midi)*2, (inst.id === 'harp' ? 4500 : 5800) * (.58 + .65 * v) * (1.22 - .45 * pos)));
    src.connect(filt); chain = filt;
  }
  chain.connect(g); g.connect(pan.out);
  src.start(when);
  return handle(ctx, inst, opts.midi, when, src, g, [src, g, filt, pan.node], (semi, time, at) => {
    const r = baseRate * 2 ** (semi / 12), t0 = Math.max(ctx.currentTime, at ?? 0);
    src.playbackRate.cancelScheduledValues(t0);
    src.playbackRate.setValueAtTime(src.playbackRate.value, t0);
    if (time > 0) src.playbackRate.linearRampToValueAtTime(r, t0 + time); else src.playbackRate.setValueAtTime(r, t0);
  }, opts.tech === 'mute' ? 0.05 : 0.09);
}

const MODAL_KINDS = {
  piano(midi) {
    const t1 = clamp(9 * 2 ** (-(midi - 40) / 16), 1, 11);
    const partials = [];
    for (let n = 1; n <= 12; n++) partials.push({ r: n, a: (n === 1 ? 1 : 0.9 / n ** 1.05) * (n === 2 ? 1.25 : 1), t: t1 / n ** 0.75, det: n < 4 ? 1.4 : 0.6 });
    return { partials, inharm: 0.00012 * 2 ** ((midi - 48) / 14), noise: { amount: 0.25, tone: 0.35, len: 0.012 }, dur: clamp(t1 * 0.6, 1.6, 4), velBright: 0.9 };
  },
  marimba(midi) {
    const t = clamp(1.3 * 2 ** (-(midi - 55) / 24), 0.25, 1.4);
    return { partials: [{ r: 1, a: 1, t }, { r: 3.93, a: 0.35, t: t * 0.3 }, { r: 9.2, a: 0.12, t: t * 0.12 }], noise: { amount: 0.3, tone: 0.2, len: 0.006 }, dur: t + 0.2, velBright: 1 };
  },
  vibraphone(midi) {
    const t = clamp(5 * 2 ** (-(midi - 55) / 30), 1.6, 5);
    return { partials: [{ r: 1, a: 1, t }, { r: 4, a: 0.25, t: t * 0.25 }, { r: 10, a: 0.08, t: t * 0.1 }], noise: { amount: 0.08, tone: 0.5, len: 0.004 }, dur: Math.min(4, t), velBright: 0.8 };
  },
  kalimba(midi) {
    return { partials: [{ r: 1, a: 1, t: 2 }, { r: 5.4, a: 0.22, t: 0.35 }, { r: 8.93, a: 0.12, t: 0.2 }, { r: 2, a: 0.05, t: 0.8 }], noise: { amount: 0.18, tone: 0.8, len: 0.003 }, dur: 2.2, velBright: 1.1 };
  },
  bells() {
    const r = [0.56, 0.92, 1.19, 1.71, 2, 2.74, 3, 3.76, 4.07], a = [1, 0.67, 1, 1.8, 2.67, 1.67, 1.46, 1.33, 1.33], t = [6, 4.5, 3, 2.4, 2, 1.6, 1.3, 1, 0.9];
    return { partials: r.map((x, i) => ({ r: x, a: a[i] / 2.7, t: t[i], det: i === 1 ? 2 : 0 })), dur: 4.5, velBright: 0.7 };
  },
};

function bufferVoice(ctx, dest, inst, opts, when, vel) {
  const vb = .8;
  // Share a sample across adjacent pitches, so dense chords do not block input.
  const anchor = Math.max(0, Math.min(127, Math.round(opts.midi / 3) * 3));
  const ratio = 2 ** ((opts.midi - anchor) / 12);
  const key = `b|${inst.id}|${anchor}|${vb}`;
  const buf = getBuffer(ctx, key, (sr) => (inst.engine === 'fm'
    ? renderFM({ ...inst.params, freq: mtof(anchor), vel: vb, sr, dur: 3.2 })
    : renderModal({ ...MODAL_KINDS[inst.params.kind](anchor), freq: mtof(anchor), vel: vb, sr })));
  const src = ctx.createBufferSource(); src.buffer = buf; src.playbackRate.value = ratio;
  const g = ctx.createGain(); g.gain.value = velGain(vel) * (inst.gain ?? 1) * 0.5;
  const pan = makePanner(ctx, opts.pan ?? 0, dest);
  src.connect(g); g.connect(pan.out); src.start(when);
  const h = handle(ctx, inst, opts.midi, when, src, g, [src, g, pan.node], (semi, time) => {
    const t0 = ctx.currentTime; src.playbackRate.setTargetAtTime(ratio * 2 ** (semi / 12), t0, Math.max(0.005, time / 3));
  }, inst.release ?? 0.12);
  if (opts.dur != null && inst.sustain) h.noteOff(when + opts.dur);
  return h;
}

const noiseBufs = new WeakMap();
function oscVoice(ctx, dest, inst, opts, when, vel) {
  const p = inst.params, f = mtof(opts.midi), nodes = [];
  const out = ctx.createGain(); out.gain.value = 0; nodes.push(out);
  const filt = ctx.createBiquadFilter(); filt.type = p.filter.type; filt.Q.value = p.filter.q; nodes.push(filt);
  const kt = p.filter.keytrack ? (f / 130) ** p.filter.keytrack : 1;
  const base = clamp(p.filter.cutoff * kt, 40, 18000), peak = clamp(base + p.filter.env * (0.3 + 0.7 * vel), 40, 18000);
  filt.frequency.setValueAtTime(p.filter.attack ? base : peak, when);
  if (p.filter.attack) filt.frequency.linearRampToValueAtTime(peak, when + p.filter.attack);
  if (p.filter.env) filt.frequency.setTargetAtTime(base, when + (p.filter.attack ?? 0), (p.filter.decay ?? 0.3) / 2.5);
  const oscs = p.oscs.map(([type, ratio, cents, amp]) => {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.value = f * ratio; o.detune.value = cents; g.gain.value = amp;
    o.connect(g); g.connect(filt); nodes.push(o, g); o._ratio = ratio; return o;
  });
  if (p.pitchEnv) for (const o of oscs) { o.frequency.setValueAtTime(f * o._ratio * 2 ** (p.pitchEnv.semis / 12), when); o.frequency.exponentialRampToValueAtTime(f * o._ratio, when + p.pitchEnv.time); }
  let vib = null;
  if (p.vibrato) {
    vib = ctx.createOscillator(); const vg = ctx.createGain(); vib.frequency.value = p.vibrato.rate; vg.gain.setValueAtTime(0, when); vg.gain.linearRampToValueAtTime(p.vibrato.depth, when + p.vibrato.delay + 0.4);
    vib.connect(vg); for (const o of oscs) vg.connect(o.detune); vib.start(when); nodes.push(vib, vg);
  }
  if (p.click) {
    const s = ctx.createBufferSource(); let nb = noiseBufs.get(ctx);
    if (!nb) { nb = ctx.createBuffer(1, 2048, ctx.sampleRate); const d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / 200); noiseBufs.set(ctx, nb); }
    const cg = ctx.createGain(); cg.gain.value = p.click * vel; s.buffer = nb; s.connect(cg); cg.connect(out); s.start(when); nodes.push(s, cg);
  }
  const pan = makePanner(ctx, opts.pan ?? 0, dest); nodes.push(pan.node);
  filt.connect(out); out.connect(pan.out);
  const a = p.amp, peakG = velGain(vel) * (inst.gain ?? 1);
  out.gain.setValueAtTime(0, when);
  out.gain.linearRampToValueAtTime(peakG, when + a.a);
  if (a.hold) out.gain.setTargetAtTime(0.0001, when + a.a, a.d / 3);
  else out.gain.setTargetAtTime(peakG * a.s, when + a.a, a.d / 3);
  for (const o of oscs) o.start(when);
  const maxEnd = a.hold ? when + a.a + a.d * 1.6 + 0.1 : Infinity;
  if (isFinite(maxEnd)) for (const o of oscs) o.stop(maxEnd);
  const h = handle(ctx, inst, opts.midi, when, oscs[0], out, nodes, (semi, time) => {
    const t0 = ctx.currentTime, tc = Math.max(0.004, (time || p.glide || 0.01) / 3);
    for (const o of oscs) o.frequency.setTargetAtTime(f * o._ratio * 2 ** (semi / 12), t0, tc);
  }, a.r, oscs);
  if (opts.dur != null && !a.hold) h.noteOff(when + opts.dur);
  return h;
}

/** Handle comum: libera nós ao terminar, permite bend, note-off e corte rápido. */
function handle(ctx, inst, midi, when, src, gainNode, nodes, bend, release, extraSources = []) {
  const v = {
    inst, midi, started: when, alive: true, bendSemis: 0,
    setBend(semi, time = 0.02, at) { v.bendSemis = semi; if (v.alive) bend(semi, time, at); },
    noteOff(at = ctx.currentTime) {
      if (!v.alive || v._off) return; v._off = true;
      const t = Math.max(ctx.currentTime, at);
      gainNode.gain.cancelScheduledValues(t);
      gainNode.gain.setTargetAtTime(0, t, Math.max(0.005, release / 4));
      const stopAt = t + release * 1.6 + 0.05;
      for (const s of [src, ...extraSources]) { try { s.stop(stopAt); } catch { /* */ } }
    },
    kill(fade = 0.015) {
      if (!v.alive) return;
      const t = ctx.currentTime;
      try { gainNode.gain.cancelScheduledValues(t); gainNode.gain.setValueAtTime(gainNode.gain.value, t); gainNode.gain.linearRampToValueAtTime(0, t + fade); } catch { /* */ }
      for (const s of [src, ...extraSources]) { try { s.stop(t + fade + 0.01); } catch { /* */ } }
    },
  };
  src.onended = () => { v.alive = false; active.delete(v); disconnectAll(...nodes.filter(Boolean)); };
  if (ctx instanceof (globalThis.AudioContext ?? Object) || ctx.constructor?.name === 'webkitAudioContext') register(v);
  return v;
}

/** Pré-renderiza buffers em fatias ociosas para evitar latência na 1ª nota. */
const warmGeneration = new WeakMap();
export function prewarm(ctx, inst, midis) {
  if (!ctx) return;
  const generation=(warmGeneration.get(ctx)??0)+1; warmGeneration.set(ctx,generation);
  if (!['pluck','modal','fm'].includes(inst.engine)) return;
  const jobs=[...new Set(midis.map(m=>inst.engine==='pluck'?m:Math.max(0,Math.min(127,Math.round(m/3)*3))))];
  const idle=globalThis.requestIdleCallback ?? (fn=>setTimeout(fn,40));
  const step=()=>{
    if(warmGeneration.get(ctx)!==generation || !jobs.length) return;
    const m=jobs.shift();
    if(inst.engine==='pluck'){
      const tech=inst.tech??'finger';
      getBuffer(ctx,`p|${inst.id}|${m}|0.8|null|${tech}`,sr=>pluckSample(inst,m,tech,sr));
    }else{
      getBuffer(ctx,`b|${inst.id}|${m}|0.8`,sr=>inst.engine==='fm'?renderFM({...inst.params,freq:mtof(m),vel:.8,sr,dur:3.2}):renderModal({...MODAL_KINDS[inst.params.kind](m),freq:mtof(m),vel:.8,sr}));
    }
    if(jobs.length)idle(step);
  };
  idle(step);
}
