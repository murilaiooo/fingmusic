/**
 * Pedais de efeito. Cada efeito é criado sob demanda (só os ativos existem no
 * grafo de áudio) e expõe: input, output, set(param, valor), sync(bpm), dispose().
 * Os metadados (PEDALS) alimentam a interface da pedaleira.
 */
import { driveCurve, crushCurve, reverbIR, disconnectAll, hasWorklets } from './dsp.js';
import { clamp } from '../core/util.js';

const DIVS = [0.25, 0.5, 0.75, 1, 1.5, 2];
const DIV_LABELS = ['1/16', '1/8', '1/8 pont.', '1/4', '1/4 pont.', '1/2'];

export const PEDALS = {
  octaver: { name: 'Octaver', color: '#7f8cff', params: { sub: ['Oitava abaixo', 0, 1.2, 0.8], up: ['Oitava acima', 0, 1.2, 0], dry: ['Original', 0, 1.2, 0.7] } },
  compressor: { name: 'Compressor', color: '#8fd3ff', params: { threshold: ['Limiar', -50, 0, -24], ratio: ['Razão', 1, 20, 5], attack: ['Ataque', 0.001, 0.1, 0.006], makeup: ['Ganho', 0, 2.5, 1.4] } },
  wah: { name: 'Wah-wah', color: '#ffb36b', params: { mode: ['Modo', 0, 2, 1, ['Auto', 'Envelope', 'Pedal']], rate: ['Velocidade', 0.2, 8, 2], range: ['Alcance', 0.2, 1, 0.8], q: ['Ressonância', 1, 18, 7], pedal: ['Pedal', 0, 1, 0.5] } },
  overdrive: { name: 'Overdrive', color: '#ffd36b', params: { drive: ['Drive', 1, 12, 4], tone: ['Tom', 800, 9000, 4200], level: ['Nível', 0, 1.5, 0.8] } },
  distortion: { name: 'Distorção', color: '#ff7a6b', params: { drive: ['Drive', 4, 60, 22], tone: ['Tom', 600, 8000, 3200], level: ['Nível', 0, 1.5, 0.6] } },
  bitcrusher: { name: 'Bitcrusher', color: '#c8ff6b', params: { bits: ['Bits', 2, 12, 6], down: ['Redução', 1, 24, 6], mix: ['Mix', 0, 1, 0.8] } },
  eq: { name: 'Equalizador', color: '#9affc8', params: { low: ['Graves', -12, 12, 0], mid: ['Médios', -12, 12, 0], high: ['Agudos', -12, 12, 0] } },
  filter: { name: 'Filtro', color: '#6bffe0', params: { cutoff: ['Corte', 80, 16000, 2200], res: ['Ressonância', 0.1, 18, 3] } },
  chorus: { name: 'Chorus', color: '#b58cff', params: { rate: ['Velocidade', 0.1, 4, 0.9], depth: ['Profundidade', 0, 1, 0.5], mix: ['Mix', 0, 1, 0.5] } },
  flanger: { name: 'Flanger', color: '#ff8cf0', params: { rate: ['Velocidade', 0.05, 3, 0.25], depth: ['Profundidade', 0, 1, 0.7], feedback: ['Realimentação', 0, 0.9, 0.6], mix: ['Mix', 0, 1, 0.5] } },
  phaser: { name: 'Phaser', color: '#ff6bb0', params: { rate: ['Velocidade', 0.05, 4, 0.5], depth: ['Profundidade', 0, 1, 0.7], feedback: ['Realimentação', 0, 0.85, 0.5], mix: ['Mix', 0, 1, 0.6] } },
  tremolo: { name: 'Tremolo', color: '#6bc1ff', params: { rate: ['Velocidade', 0.5, 14, 5], depth: ['Profundidade', 0, 1, 0.6], sync: ['Sincronia', 0, 1, 0, ['Livre', 'BPM']] } },
  delay: { name: 'Delay', color: '#6b8cff', params: { div: ['Tempo', 0, 5, 2, DIV_LABELS], feedback: ['Repetições', 0, 0.85, 0.38], tone: ['Tom', 800, 9000, 3500], mix: ['Mix', 0, 1, 0.3] } },
  reverb: { name: 'Reverb', color: '#a6a8ff', params: { size: ['Tamanho', 0.4, 6, 2.6], tone: ['Brilho', 0, 1, 0.55], mix: ['Mix', 0, 1, 0.3] } },
};
export const PEDAL_ORDER = Object.keys(PEDALS);

export function defaultParams(id) {
  const out = {}; for (const [k, v] of Object.entries(PEDALS[id].params)) out[k] = v[3];
  return out;
}

function lfo(ctx, rate, type = 'sine') { const o = ctx.createOscillator(); o.type = type; o.frequency.value = rate; o.start(); return o; }
function mixer(ctx, mix) {
  const input = ctx.createGain(), output = ctx.createGain(), dry = ctx.createGain(), wet = ctx.createGain();
  input.connect(dry); dry.connect(output); wet.connect(output);
  const setMix = (m) => { dry.gain.value = Math.cos(m * Math.PI / 2); wet.gain.value = Math.sin(m * Math.PI / 2); };
  setMix(mix);
  return { input, output, dry, wet, setMix };
}
const smooth = (param, v, ctx) => { try { param.setTargetAtTime(v, ctx.currentTime, 0.02); } catch { param.value = v; } };

const BUILDERS = {
  octaver(ctx, p) {
    if (hasWorklets(ctx)) {
      const node = new AudioWorkletNode(ctx, 'fm-octaver', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2] });
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 6000; node.connect(lp);
      const set = (k, v) => { const prm = node.parameters.get(k); if (prm) smooth(prm, v, ctx); };
      for (const k in p) set(k, p[k]);
      return { input: node, output: lp, set, nodes: [node, lp] };
    }
    // Fallback sem worklet: apenas oitava acima por retificação.
    const m = mixer(ctx, 0.5), sh = ctx.createWaveShaper(), c = new Float32Array(1024);
    for (let i = 0; i < c.length; i++) c[i] = Math.abs(i / 511.5 - 1) * 2 - 0.6; sh.curve = c;
    m.input.connect(sh); sh.connect(m.wet);
    return { input: m.input, output: m.output, set: (k, v) => { if (k === 'up') m.setMix(clamp(v / 1.2, 0, 1)); }, nodes: [sh, m.input, m.output, m.dry, m.wet], partial: true };
  },
  compressor(ctx, p) {
    const c = ctx.createDynamicsCompressor(), g = ctx.createGain(); c.connect(g); c.knee.value = 8; c.release.value = 0.18;
    const set = (k, v) => { if (k === 'makeup') smooth(g.gain, v, ctx); else if (c[k]) smooth(c[k], v, ctx); };
    for (const k in p) set(k, p[k]);
    return { input: c, output: g, set, nodes: [c, g] };
  },
  wah(ctx, p) {
    const input = ctx.createGain(), f = ctx.createBiquadFilter(), out = ctx.createGain();
    f.type = 'bandpass'; input.connect(f); f.connect(out); out.gain.value = 1.8;
    // dry fraco para manter corpo
    const dry = ctx.createGain(); dry.gain.value = 0.25; input.connect(dry); dry.connect(out);
    const osc = lfo(ctx, p.rate), depth = ctx.createGain(); osc.connect(depth);
    // seguidor de envelope sem worklet: |x| -> passa-baixas -> modula frequência
    const rect = ctx.createWaveShaper(), rc = new Float32Array(1024);
    for (let i = 0; i < rc.length; i++) rc[i] = Math.abs(i / 511.5 - 1); rect.curve = rc;
    const envLp = ctx.createBiquadFilter(); envLp.type = 'lowpass'; envLp.frequency.value = 12;
    const envAmt = ctx.createGain(); input.connect(rect); rect.connect(envLp); envLp.connect(envAmt);
    let mode = Math.round(p.mode), range = p.range, pedal = p.pedal;
    const apply = () => {
      depth.disconnect(); envAmt.disconnect();
      const lo = 350, hi = 350 + 2600 * range;
      if (mode === 0) { f.frequency.value = (lo + hi) / 2; depth.gain.value = (hi - lo) / 2; depth.connect(f.frequency); }
      else if (mode === 1) { f.frequency.value = lo; envAmt.gain.value = (hi - lo) * 6; envAmt.connect(f.frequency); }
      else smooth(f.frequency, lo * Math.pow(hi / lo, pedal), ctx);
    };
    const set = (k, v) => {
      if (k === 'mode') mode = Math.round(v); else if (k === 'rate') smooth(osc.frequency, v, ctx);
      else if (k === 'range') range = v; else if (k === 'q') smooth(f.Q, v, ctx); else if (k === 'pedal') pedal = v;
      if (k !== 'q' && k !== 'rate') apply();
    };
    f.Q.value = p.q; apply();
    return { input, output: out, set, nodes: [input, f, out, dry, depth, rect, envLp, envAmt], oscs: [osc] };
  },
  overdrive(ctx, p) {
    const pre = ctx.createGain(), sh = ctx.createWaveShaper(), tone = ctx.createBiquadFilter(), lvl = ctx.createGain(), hp = ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 90; tone.type = 'lowpass'; sh.oversample = '4x';
    pre.connect(hp); hp.connect(sh); sh.connect(tone); tone.connect(lvl);
    const set = (k, v) => {
      if (k === 'drive') { pre.gain.value = 1; sh.curve = driveCurve(v, 'asym'); }
      else if (k === 'tone') smooth(tone.frequency, v, ctx); else if (k === 'level') smooth(lvl.gain, v, ctx);
    };
    for (const k in p) set(k, p[k]);
    return { input: pre, output: lvl, set, nodes: [pre, sh, tone, lvl, hp] };
  },
  distortion(ctx, p) {
    const hp = ctx.createBiquadFilter(), sh = ctx.createWaveShaper(), sh2 = ctx.createWaveShaper(), tone = ctx.createBiquadFilter(), mid = ctx.createBiquadFilter(), lvl = ctx.createGain();
    hp.type = 'highpass'; hp.frequency.value = 160; sh.oversample = '4x'; sh2.curve = driveCurve(2, 'soft');
    tone.type = 'lowpass'; mid.type = 'peaking'; mid.frequency.value = 750; mid.gain.value = -4; mid.Q.value = 0.8;
    hp.connect(sh); sh.connect(sh2); sh2.connect(mid); mid.connect(tone); tone.connect(lvl);
    const set = (k, v) => {
      if (k === 'drive') sh.curve = driveCurve(v, 'hard'); else if (k === 'tone') smooth(tone.frequency, v, ctx); else if (k === 'level') smooth(lvl.gain, v * 0.7, ctx);
    };
    for (const k in p) set(k, p[k]);
    return { input: hp, output: lvl, set, nodes: [hp, sh, sh2, tone, mid, lvl] };
  },
  bitcrusher(ctx, p) {
    const m = mixer(ctx, p.mix);
    let node, set;
    if (hasWorklets(ctx)) {
      node = new AudioWorkletNode(ctx, 'fm-crusher', { outputChannelCount: [2] });
      set = (k, v) => { if (k === 'mix') m.setMix(v); else { const prm = node.parameters.get(k); if (prm) prm.value = v; } };
    } else {
      node = ctx.createWaveShaper(); node.curve = crushCurve(p.bits);
      set = (k, v) => { if (k === 'mix') m.setMix(v); else if (k === 'bits') node.curve = crushCurve(Math.round(v)); };
    }
    m.input.connect(node); node.connect(m.wet);
    for (const k in p) set(k, p[k]);
    return { input: m.input, output: m.output, set, nodes: [node, m.input, m.output, m.dry, m.wet] };
  },
  eq(ctx, p) {
    const lo = ctx.createBiquadFilter(), mi = ctx.createBiquadFilter(), hi = ctx.createBiquadFilter();
    lo.type = 'lowshelf'; lo.frequency.value = 140; mi.type = 'peaking'; mi.frequency.value = 1000; mi.Q.value = 0.8; hi.type = 'highshelf'; hi.frequency.value = 5500;
    lo.connect(mi); mi.connect(hi);
    const map = { low: lo, mid: mi, high: hi };
    const set = (k, v) => smooth(map[k].gain, v, ctx);
    for (const k in p) set(k, p[k]);
    return { input: lo, output: hi, set, nodes: [lo, mi, hi] };
  },
  filter(ctx, p) {
    const a = ctx.createBiquadFilter(), b = ctx.createBiquadFilter(); a.type = b.type = 'lowpass'; a.connect(b);
    const set = (k, v) => { if (k === 'cutoff') { smooth(a.frequency, v, ctx); smooth(b.frequency, v, ctx); } else { smooth(a.Q, v, ctx); b.Q.value = 0.7; } };
    for (const k in p) set(k, p[k]);
    return { input: a, output: b, set, nodes: [a, b] };
  },
  chorus(ctx, p) {
    const m = mixer(ctx, p.mix), merger = ctx.createChannelMerger(2), oscs = [], nodes = [merger];
    const depths = [];
    for (let i = 0; i < 2; i++) {
      const d = ctx.createDelay(0.05); d.delayTime.value = 0.018 + i * 0.006;
      const o = lfo(ctx, p.rate * (i ? 1.13 : 1)), g = ctx.createGain(); o.connect(g); g.connect(d.delayTime);
      m.input.connect(d); d.connect(merger, 0, i); oscs.push(o); depths.push(g); nodes.push(d, g);
    }
    merger.connect(m.wet);
    const set = (k, v) => {
      if (k === 'mix') m.setMix(v); else if (k === 'rate') oscs.forEach((o, i) => smooth(o.frequency, v * (i ? 1.13 : 1), ctx));
      else if (k === 'depth') depths.forEach((g) => (g.gain.value = 0.0045 * v));
    };
    for (const k in p) set(k, p[k]);
    return { input: m.input, output: m.output, set, nodes: [...nodes, m.input, m.output, m.dry, m.wet], oscs };
  },
  flanger(ctx, p) {
    const m = mixer(ctx, p.mix), d = ctx.createDelay(0.02), fb = ctx.createGain(), o = lfo(ctx, p.rate), g = ctx.createGain();
    d.delayTime.value = 0.004; o.connect(g); g.connect(d.delayTime); m.input.connect(d); d.connect(fb); fb.connect(d); d.connect(m.wet);
    const set = (k, v) => {
      if (k === 'mix') m.setMix(v); else if (k === 'rate') smooth(o.frequency, v, ctx); else if (k === 'depth') g.gain.value = 0.0035 * v; else if (k === 'feedback') smooth(fb.gain, v, ctx);
    };
    for (const k in p) set(k, p[k]);
    return { input: m.input, output: m.output, set, nodes: [d, fb, g, m.input, m.output, m.dry, m.wet], oscs: [o] };
  },
  phaser(ctx, p) {
    const m = mixer(ctx, p.mix), o = lfo(ctx, p.rate), g = ctx.createGain(), fb = ctx.createGain(), stages = [];
    o.connect(g);
    let prev = m.input;
    for (let i = 0; i < 6; i++) { const ap = ctx.createBiquadFilter(); ap.type = 'allpass'; ap.frequency.value = 900; ap.Q.value = 0.6; g.connect(ap.frequency); prev.connect(ap); prev = ap; stages.push(ap); }
    prev.connect(m.wet); prev.connect(fb); fb.connect(stages[0]);
    const set = (k, v) => {
      if (k === 'mix') m.setMix(v); else if (k === 'rate') smooth(o.frequency, v, ctx); else if (k === 'depth') g.gain.value = 750 * v; else if (k === 'feedback') smooth(fb.gain, v, ctx);
    };
    for (const k in p) set(k, p[k]);
    return { input: m.input, output: m.output, set, nodes: [...stages, g, fb, m.input, m.output, m.dry, m.wet], oscs: [o] };
  },
  tremolo(ctx, p) {
    const amp = ctx.createGain(), o = lfo(ctx, p.rate, 'sine'), g = ctx.createGain(); o.connect(g); g.connect(amp.gain);
    let rate = p.rate, sync = p.sync, bpm = 100, depth = p.depth;
    const apply = () => { smooth(o.frequency, sync >= 0.5 ? (bpm / 60) * 4 / 2 : rate, ctx); amp.gain.value = 1 - depth / 2; g.gain.value = depth / 2; };
    const set = (k, v) => { if (k === 'rate') rate = v; else if (k === 'sync') sync = v; else if (k === 'depth') depth = v; apply(); };
    apply();
    return { input: amp, output: amp, set, sync: (b) => { bpm = b; apply(); }, nodes: [amp, g], oscs: [o] };
  },
  delay(ctx, p) {
    const m = mixer(ctx, p.mix), dl = ctx.createDelay(2), dr = ctx.createDelay(2), fb = ctx.createGain(), tone = ctx.createBiquadFilter(), merger = ctx.createChannelMerger(2), cross = ctx.createGain();
    tone.type = 'lowpass';
    // ping-pong: L -> R -> L
    m.input.connect(tone); tone.connect(dl); dl.connect(dr); dr.connect(fb); fb.connect(tone);
    dl.connect(merger, 0, 0); dr.connect(merger, 0, 1); merger.connect(m.wet); cross.gain.value = 1;
    let div = p.div, bpm = 100;
    const apply = () => { const t = Math.min(1.9, (60 / bpm) * DIVS[clamp(Math.round(div), 0, 5)]); smooth(dl.delayTime, t / 2, ctx); smooth(dr.delayTime, t / 2, ctx); };
    const set = (k, v) => {
      if (k === 'mix') m.setMix(v); else if (k === 'div') { div = v; apply(); } else if (k === 'feedback') smooth(fb.gain, v, ctx); else if (k === 'tone') smooth(tone.frequency, v, ctx);
    };
    for (const k in p) set(k, p[k]);
    return { input: m.input, output: m.output, set, sync: (b) => { bpm = b; apply(); }, nodes: [dl, dr, fb, tone, merger, cross, m.input, m.output, m.dry, m.wet] };
  },
  reverb(ctx, p) {
    const m = mixer(ctx, p.mix), conv = ctx.createConvolver(), pre = ctx.createDelay(0.1); pre.delayTime.value = 0.012;
    m.input.connect(pre); pre.connect(conv); conv.connect(m.wet);
    let size = p.size, tone = p.tone;
    const apply = () => { conv.buffer = reverbIR(ctx, Math.round(size * 2) / 2, 3, Math.round(tone * 5) / 5); };
    const set = (k, v) => { if (k === 'mix') m.setMix(v); else { if (k === 'size') size = v; if (k === 'tone') tone = v; apply(); } };
    apply(); m.setMix(p.mix);
    return { input: m.input, output: m.output, set, nodes: [conv, pre, m.input, m.output, m.dry, m.wet] };
  },
};

export function createEffect(ctx, id, params) {
  const p = { ...defaultParams(id), ...params };
  const fx = BUILDERS[id](ctx, p);
  fx.id = id;
  fx.dispose = () => { for (const o of fx.oscs ?? []) { try { o.stop(); } catch { /* */ } } disconnectAll(...fx.nodes, ...(fx.oscs ?? [])); };
  return fx;
}

export const pedalValueLabel = (id, key, v) => {
  const meta = PEDALS[id].params[key];
  if (meta[4]) return meta[4][clamp(Math.round(v), 0, meta[4].length - 1)];
  if (key === 'cutoff' || key === 'tone' && v > 50) return v >= 1000 ? (v / 1000).toFixed(1) + ' kHz' : Math.round(v) + ' Hz';
  if (key === 'threshold' || key === 'low' || key === 'mid' || key === 'high') return Math.round(v) + ' dB';
  if (key === 'ratio') return v.toFixed(1) + ':1';
  if (key === 'attack') return Math.round(v * 1000) + ' ms';
  if (key === 'size') return v.toFixed(1) + ' s';
  if (key === 'bits' || key === 'down') return String(Math.round(v));
  if (key === 'rate') return v.toFixed(1) + ' Hz';
  return Math.round((v - meta[1]) / (meta[2] - meta[1]) * 100) + '%';
};
