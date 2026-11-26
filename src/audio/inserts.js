/**
 * "Inserts" do instrumento: a parte do timbre que pertence ao próprio
 * instrumento (corpo acústico, amplificador, ressonância simpática...).
 * São aplicados no canal, sobre a soma das vozes — como num instrumento real,
 * onde a distorção do amplificador processa o acorde inteiro.
 */
import { createEffect } from './effects.js';
import { driveCurve, disconnectAll } from './dsp.js';
import { mtof } from '../core/util.js';

const BUILD = {
  body(ctx, o) {
    const nodes = o.bands.map(([type, freq, gain, q]) => { const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; if (gain != null) f.gain.value = gain; if (q != null) f.Q.value = q; return f; });
    for (let i = 1; i < nodes.length; i++) nodes[i - 1].connect(nodes[i]);
    return { input: nodes[0], output: nodes[nodes.length - 1], nodes };
  },
  amp(ctx, o) {
    const hp = ctx.createBiquadFilter(), pre = ctx.createGain(), sh = ctx.createWaveShaper(), mid = ctx.createBiquadFilter(), cab = ctx.createBiquadFilter(), cab2 = ctx.createBiquadFilter(), out = ctx.createGain();
    hp.type = 'highpass'; hp.frequency.value = o.hp ?? 80; pre.gain.value = o.pre ?? 1;
    sh.curve = driveCurve(o.drive ?? 2, o.kind ?? 'asym'); sh.oversample = '4x';
    mid.type = 'peaking'; mid.frequency.value = o.midFreq ?? 800; mid.gain.value = o.mid ?? 2; mid.Q.value = 0.9;
    cab.type = 'lowpass'; cab.frequency.value = o.lp ?? 5000; cab.Q.value = 0.9; cab2.type = 'lowpass'; cab2.frequency.value = (o.lp ?? 5000) * 1.3;
    out.gain.value = o.level ?? 0.8;
    hp.connect(pre); pre.connect(sh); sh.connect(mid); mid.connect(cab); cab.connect(cab2); cab2.connect(out);
    return { input: hp, output: out, nodes: [hp, pre, sh, mid, cab, cab2, out] };
  },
  bassdrive(ctx, o) {
    // crossover: graves limpos em paralelo + distorção nos médios/agudos
    const input = ctx.createGain(), out = ctx.createGain(), lo = ctx.createBiquadFilter(), hi = ctx.createBiquadFilter(), sh = ctx.createWaveShaper(), cab = ctx.createBiquadFilter(), g = ctx.createGain();
    lo.type = 'lowpass'; lo.frequency.value = 160; hi.type = 'highpass'; hi.frequency.value = 220;
    sh.curve = driveCurve(o.drive ?? 10, 'hard'); sh.oversample = '4x'; cab.type = 'lowpass'; cab.frequency.value = o.lp ?? 3000; g.gain.value = o.dist ?? 0.45;
    input.connect(lo); lo.connect(out); input.connect(hi); hi.connect(sh); sh.connect(cab); cab.connect(g); g.connect(out);
    return { input, output: out, nodes: [input, out, lo, hi, sh, cab, g] };
  },
  sat(ctx, o) {
    const sh = ctx.createWaveShaper(), g = ctx.createGain(); sh.curve = driveCurve(o.drive ?? 2, 'soft'); g.gain.value = o.level ?? 0.9; sh.connect(g);
    return { input: sh, output: g, nodes: [sh, g] };
  },
  sympathetic(ctx, o) {
    // cordas simpáticas: filtros-pente realimentados afinados na tônica e quinta
    const input = ctx.createGain(), out = ctx.createGain(), wet = ctx.createGain(); wet.gain.value = o.amount ?? 0.22;
    input.connect(out); const nodes = [input, out, wet]; const delays = [];
    for (let i = 0; i < 3; i++) {
      const d = ctx.createDelay(0.1), fb = ctx.createGain(), lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5000; fb.gain.value = 0.93;
      input.connect(d); d.connect(lp); lp.connect(fb); fb.connect(d); lp.connect(wet); nodes.push(d, fb, lp); delays.push(d);
    }
    wet.connect(out);
    const tune = (root) => { [0, 7, 12].forEach((iv, i) => { delays[i].delayTime.value = 1 / mtof(48 + root + iv); }); };
    tune(o.root ?? 0);
    return { input, output: out, nodes, tune };
  },
  fx(ctx, o) { const e = createEffect(ctx, o.id, o.params); return { input: e.input, output: e.output, nodes: [], effect: e, sync: e.sync }; },
};

/** Constrói a cadeia de inserts. Devolve {input, output, dispose, sync, tune}. */
export function buildInserts(ctx, list = []) {
  const input = ctx.createGain(), output = ctx.createGain();
  let prev = input; const parts = [];
  for (const item of list) {
    const part = BUILD[item.type](ctx, item);
    prev.connect(part.input); prev = part.output; parts.push(part);
  }
  prev.connect(output);
  return {
    input, output,
    sync: (bpm) => parts.forEach((p) => p.sync?.(bpm)),
    tune: (root) => parts.forEach((p) => p.tune?.(root)),
    dispose: () => { parts.forEach((p) => { p.effect?.dispose(); disconnectAll(...p.nodes); }); disconnectAll(input, output); },
  };
}
