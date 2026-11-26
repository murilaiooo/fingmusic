/**
 * Bateria e percussão totalmente sintetizadas (sem samples). Cada kit mapeia
 * números de nota General MIDI para uma função de síntese, o que permite
 * exportar as pistas de bateria em MIDI no canal 10.
 */
import { noiseBuffer, disconnectAll } from './dsp.js';

function env(g, when, peak, attack, decay) {
  g.gain.setValueAtTime(0.0001, when);
  g.gain.linearRampToValueAtTime(peak, when + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, when + attack + decay);
}
function cleanupAt(ctx, nodes, at) {
  const src = nodes.find((n) => n.stop);
  if (src) src.onended = () => disconnectAll(...nodes);
}
function noise(ctx, when, dur) {
  const s = ctx.createBufferSource(); s.buffer = noiseBuffer(ctx, 1); s.loop = true;
  s.start(when, Math.random() * 0.5); s.stop(when + dur + 0.05); return s;
}

const S = {
  kick(ctx, out, when, v, p = {}) {
    const o = ctx.createOscillator(), g = ctx.createGain(), f0 = p.f ?? 52, dec = p.decay ?? 0.45;
    o.frequency.setValueAtTime(f0 * (p.sweep ?? 3.2), when);
    o.frequency.exponentialRampToValueAtTime(f0, when + (p.sweepT ?? 0.06));
    env(g, when, v, 0.002, dec);
    o.connect(g); g.connect(out); o.start(when); o.stop(when + dec + 0.1);
    const nodes = [o, g];
    if (p.click ?? 0.3) {
      const n = noise(ctx, when, 0.02), hp = ctx.createBiquadFilter(), ng = ctx.createGain();
      hp.type = 'highpass'; hp.frequency.value = 1800; env(ng, when, v * (p.click ?? 0.3), 0.001, 0.015);
      n.connect(hp); hp.connect(ng); ng.connect(out); n.onended = () => disconnectAll(n, hp, ng);
    }
    cleanupAt(ctx, nodes);
  },
  snare(ctx, out, when, v, p = {}) {
    const o = ctx.createOscillator(), og = ctx.createGain(); o.type = 'triangle';
    o.frequency.setValueAtTime((p.f ?? 190) * 1.6, when); o.frequency.exponentialRampToValueAtTime(p.f ?? 190, when + 0.03);
    env(og, when, v * (p.body ?? 0.7), 0.001, p.bodyDecay ?? 0.12); o.connect(og); og.connect(out); o.start(when); o.stop(when + 0.3);
    const n = noise(ctx, when, 0.35), bp = ctx.createBiquadFilter(), ng = ctx.createGain();
    bp.type = 'highpass'; bp.frequency.value = p.hp ?? 1400; env(ng, when, v * (p.snap ?? 0.8), 0.001, p.decay ?? 0.18);
    n.connect(bp); bp.connect(ng); ng.connect(out);
    o.onended = () => disconnectAll(o, og); n.onended = () => disconnectAll(n, bp, ng);
  },
  clap(ctx, out, when, v, p = {}) {
    const n = noise(ctx, when, 0.4), bp = ctx.createBiquadFilter(), g = ctx.createGain();
    bp.type = 'bandpass'; bp.frequency.value = p.f ?? 1100; bp.Q.value = 1.2;
    g.gain.setValueAtTime(0.0001, when);
    for (let i = 0; i < 3; i++) { const t = when + i * 0.011; g.gain.setValueAtTime(v * 0.9, t); g.gain.exponentialRampToValueAtTime(v * 0.15, t + 0.009); }
    g.gain.setValueAtTime(v * 0.8, when + 0.034); g.gain.exponentialRampToValueAtTime(0.0001, when + 0.034 + (p.decay ?? 0.2));
    n.connect(bp); bp.connect(g); g.connect(out); n.onended = () => disconnectAll(n, bp, g);
  },
  hat(ctx, out, when, v, p = {}) {
    // banco de quadradas inarmônicas (timbre metálico) + passa-altas
    const ratios = [2, 3, 4.16, 5.43, 6.79, 8.21], base = p.f ?? 40, g = ctx.createGain(), hp = ctx.createBiquadFilter(), bp = ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = p.hp ?? 7000; bp.type = 'bandpass'; bp.frequency.value = 10000; bp.Q.value = 0.5;
    const dec = p.decay ?? 0.05; env(g, when, v * 0.35, 0.001, dec);
    const oscs = ratios.map((r) => { const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = base * r * 2.3; o.connect(bp); o.start(when); o.stop(when + dec + 0.05); return o; });
    bp.connect(hp); hp.connect(g); g.connect(out);
    oscs[0].onended = () => disconnectAll(...oscs, bp, hp, g);
  },
  tom(ctx, out, when, v, p = {}) {
    const o = ctx.createOscillator(), g = ctx.createGain(), f = p.f ?? 120, dec = p.decay ?? 0.35;
    o.frequency.setValueAtTime(f * 1.5, when); o.frequency.exponentialRampToValueAtTime(f, when + 0.05);
    env(g, when, v * 0.9, 0.002, dec); o.connect(g); g.connect(out); o.start(when); o.stop(when + dec + 0.1);
    o.onended = () => disconnectAll(o, g);
    if (p.skin) { const n = noise(ctx, when, 0.05), lp = ctx.createBiquadFilter(), ng = ctx.createGain(); lp.type = 'lowpass'; lp.frequency.value = 3000; env(ng, when, v * p.skin, 0.001, 0.04); n.connect(lp); lp.connect(ng); ng.connect(out); n.onended = () => disconnectAll(n, lp, ng); }
  },
  cymbal(ctx, out, when, v, p = {}) {
    const dec = p.decay ?? 1.6, g = ctx.createGain(), hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = p.hp ?? 5000;
    env(g, when, v * (p.level ?? 0.3), 0.003, dec);
    const n = noise(ctx, when, dec), ng = ctx.createGain(); ng.gain.value = 0.5; n.connect(ng); ng.connect(hp);
    const oscs = [1, 1.47, 1.94, 2.51, 3.21].map((r) => { const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = (p.f ?? 340) * r; const og = ctx.createGain(); og.gain.value = 0.18; o.connect(og); og.connect(hp); o.start(when); o.stop(when + dec + 0.1); o._g = og; return o; });
    hp.connect(g); g.connect(out);
    n.onended = () => disconnectAll(n, ng, hp, g, ...oscs, ...oscs.map((o) => o._g));
  },
  rim(ctx, out, when, v, p = {}) {
    const o = ctx.createOscillator(), g = ctx.createGain(), bp = ctx.createBiquadFilter(); o.type = 'square'; o.frequency.value = p.f ?? 1700;
    bp.type = 'bandpass'; bp.frequency.value = p.f ?? 1700; bp.Q.value = 3; env(g, when, v * 0.5, 0.0005, p.decay ?? 0.03);
    o.connect(bp); bp.connect(g); g.connect(out); o.start(when); o.stop(when + 0.1); o.onended = () => disconnectAll(o, bp, g);
  },
  shaker(ctx, out, when, v, p = {}) {
    const n = noise(ctx, when, 0.2), hp = ctx.createBiquadFilter(), g = ctx.createGain(); hp.type = 'bandpass'; hp.frequency.value = p.f ?? 6500; hp.Q.value = 1.3;
    g.gain.setValueAtTime(0.0001, when); g.gain.linearRampToValueAtTime(v * 0.5, when + (p.attack ?? 0.015)); g.gain.exponentialRampToValueAtTime(0.0001, when + (p.decay ?? 0.08));
    n.connect(hp); hp.connect(g); g.connect(out); n.onended = () => disconnectAll(n, hp, g);
  },
  bell(ctx, out, when, v, p = {}) {
    // cowbell / agogô: duas quadradas em bandpass
    const g = ctx.createGain(), bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = (p.f ?? 560) * 1.4; bp.Q.value = 2;
    env(g, when, v * 0.4, 0.001, p.decay ?? 0.3);
    const oscs = [1, p.ratio ?? 1.48].map((r) => { const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = (p.f ?? 560) * r; o.connect(bp); o.start(when); o.stop(when + (p.decay ?? 0.3) + 0.1); return o; });
    bp.connect(g); g.connect(out); oscs[0].onended = () => disconnectAll(...oscs, bp, g);
  },
  conga(ctx, out, when, v, p = {}) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime((p.f ?? 300) * 1.25, when); o.frequency.exponentialRampToValueAtTime(p.f ?? 300, when + 0.02);
    env(g, when, v * 0.7, 0.001, p.decay ?? 0.22); o.connect(g); g.connect(out); o.start(when); o.stop(when + 0.5); o.onended = () => disconnectAll(o, g);
  },
  cuica(ctx, out, when, v, p = {}) {
    const o = ctx.createOscillator(), g = ctx.createGain(), f = p.f ?? 520; o.type = 'triangle';
    o.frequency.setValueAtTime(f * 0.6, when); o.frequency.exponentialRampToValueAtTime(f * 1.3, when + 0.09); o.frequency.exponentialRampToValueAtTime(f * 0.75, when + 0.2);
    env(g, when, v * 0.5, 0.02, 0.22); o.connect(g); g.connect(out); o.start(when); o.stop(when + 0.35); o.onended = () => disconnectAll(o, g);
  },
};

const L = (m, name, short, fn, p, color) => ({ m, name, short, fn, p, color });
export const KITS = {
  electro: {
    name: 'Eletrônica',
    lanes: [
      L(36, 'Bumbo', 'BUM', 'kick', { f: 48, decay: 0.55, sweep: 3.5, click: 0.25 }, '#ff6b8b'),
      L(38, 'Caixa', 'CAI', 'snare', { f: 185, snap: 0.75, decay: 0.17 }, '#ffb36b'),
      L(39, 'Palma', 'PAL', 'clap', {}, '#ffe06b'),
      L(42, 'Chimbal fechado', 'HH', 'hat', { decay: 0.045 }, '#6bffb8'),
      L(46, 'Chimbal aberto', 'OH', 'hat', { decay: 0.32 }, '#6be0ff'),
      L(45, 'Tom grave', 'TG', 'tom', { f: 95, decay: 0.4 }, '#9d8eff'),
      L(48, 'Tom agudo', 'TA', 'tom', { f: 160, decay: 0.3 }, '#c48eff'),
      L(49, 'Prato', 'PRA', 'cymbal', { decay: 1.6 }, '#e6f0ff'),
      L(37, 'Aro', 'ARO', 'rim', {}, '#ff8ef0'),
      L(70, 'Shaker', 'SHK', 'shaker', {}, '#a0ff6b'),
      L(56, 'Cowbell', 'COW', 'bell', { f: 560 }, '#ffd0a0'),
      L(35, 'Bumbo 808 longo', '808', 'kick', { f: 42, decay: 1.2, sweep: 2.2, click: 0.1 }, '#ff4d6d'),
    ],
  },
  acoustic: {
    name: 'Acústica',
    lanes: [
      L(36, 'Bumbo', 'BUM', 'kick', { f: 58, decay: 0.32, sweep: 2.4, click: 0.45 }, '#ff6b8b'),
      L(38, 'Caixa', 'CAI', 'snare', { f: 210, snap: 0.9, decay: 0.2, body: 0.8, hp: 1800 }, '#ffb36b'),
      L(37, 'Aro', 'ARO', 'rim', { f: 1900 }, '#ff8ef0'),
      L(42, 'Chimbal fechado', 'HH', 'hat', { decay: 0.06, hp: 6500 }, '#6bffb8'),
      L(46, 'Chimbal aberto', 'OH', 'hat', { decay: 0.45, hp: 6000 }, '#6be0ff'),
      L(51, 'Condução', 'RID', 'cymbal', { decay: 1.1, f: 420, level: 0.18, hp: 6500 }, '#d6e4ff'),
      L(49, 'Ataque', 'CRA', 'cymbal', { decay: 2, level: 0.3 }, '#e6f0ff'),
      L(41, 'Surdo', 'SUR', 'tom', { f: 82, decay: 0.55, skin: 0.3 }, '#8e9dff'),
      L(45, 'Tom médio', 'TM', 'tom', { f: 128, decay: 0.38, skin: 0.3 }, '#9d8eff'),
      L(48, 'Tom agudo', 'TA', 'tom', { f: 175, decay: 0.3, skin: 0.3 }, '#c48eff'),
      L(39, 'Palma', 'PAL', 'clap', { f: 1300 }, '#ffe06b'),
      L(54, 'Pandeirola', 'PAN', 'shaker', { f: 8000, decay: 0.15 }, '#a0ff6b'),
    ],
  },
  brazil: {
    name: 'Brasil',
    lanes: [
      L(36, 'Surdo', 'SUR', 'tom', { f: 62, decay: 0.8, skin: 0.25 }, '#ff6b8b'),
      L(41, 'Surdo de corte', 'COR', 'tom', { f: 78, decay: 0.45, skin: 0.3 }, '#ff8b6b'),
      L(38, 'Caixa', 'CAI', 'snare', { f: 240, snap: 0.95, decay: 0.12, hp: 2500, body: 0.4 }, '#ffb36b'),
      L(37, 'Tamborim', 'TAM', 'rim', { f: 950, decay: 0.05 }, '#ffe06b'),
      L(67, 'Agogô agudo', 'AG1', 'bell', { f: 900, ratio: 1.5, decay: 0.35 }, '#6bffb8'),
      L(68, 'Agogô grave', 'AG2', 'bell', { f: 680, ratio: 1.5, decay: 0.4 }, '#6be0ff'),
      L(70, 'Ganzá', 'GAN', 'shaker', { f: 5500, attack: 0.025, decay: 0.09 }, '#a0ff6b'),
      L(54, 'Pandeiro', 'PAN', 'shaker', { f: 9000, decay: 0.2 }, '#c4ff6b'),
      L(63, 'Atabaque agudo', 'AT1', 'conga', { f: 330 }, '#9d8eff'),
      L(64, 'Atabaque grave', 'AT2', 'conga', { f: 220, decay: 0.3 }, '#c48eff'),
      L(78, 'Cuíca', 'CUI', 'cuica', {}, '#ff8ef0'),
      L(39, 'Palmas', 'PAL', 'clap', { f: 1200 }, '#ffd0a0'),
    ],
  },
};

export function playDrum(ctx, out, kitId, m, when, vel) {
  const kit = KITS[kitId] ?? KITS.electro;
  const lane = kit.lanes.find((l) => l.m === m) ?? kit.lanes[0];
  S[lane.fn](ctx, out, when, Math.min(1.2, Math.max(0.05, vel)), lane.p);
}
export const laneOf = (kitId, m) => (KITS[kitId] ?? KITS.electro).lanes.find((l) => l.m === m);
