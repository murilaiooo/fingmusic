/**
 * Avaliação de execução: compara eventos de entrada com as cues esperadas.
 * Mede acerto de nota, desvio rítmico (antecipação/atraso), intensidade,
 * duração e técnica. Compensa a latência de cada tipo de entrada.
 */
export const GRADES = { perfect: 'Perfeito', good: 'Bom', ok: 'Quase', miss: 'Perdeu', wrong: 'Nota errada' };

export function velClass(v) { return v < 0.42 ? 'soft' : v > 0.88 ? 'hard' : 'normal'; }

/** Técnicas que o motor de interação reconhece de forma confiável. */
export const RELIABLE_TECH = new Set(['finger', 'soft', 'hard', 'pull', 'slap', 'pop', 'mute', 'harmonic', 'hammer', 'slide', 'sustain', 'chord', 'ghost', 'vibrato', 'bend']);

export function techMatches(expected, ev) {
  if (!expected || expected === 'finger' || expected === 'normal' || expected === 'pick' || expected === 'chord' || expected === 'sustain' || expected === 'tremolo') return true;
  if (expected === 'soft' || expected === 'ghost') return ev.vel < 0.5 || ev.tech === 'mute';
  if (expected === 'hard') return ev.vel > 0.8;
  if (expected === 'pull') return ev.tech === 'pull' || ev.tech === 'snap' || ev.tech === 'pop';
  if (expected === 'slide' || expected === 'vibrato' || expected === 'bend') return (ev.post ?? []).includes(expected) || ev.tech === expected;
  return ev.tech === expected;
}

export class Evaluator {
  constructor(opts = {}) {
    this.windows = { perfect: 0.05, good: 0.1, ok: 0.18, ...opts.windows };
    this.latency = { touch: 0, mouse: 0, key: 0, hand: 0.07, ...opts.latency }; // s, calibrável
    this.checkVelocity = opts.checkVelocity ?? true;
    this.checkTech = opts.checkTech ?? true;
    this.reset();
  }
  reset() { this.results = []; this.pending = []; }
  setTolerance(mult) { this.windows = { perfect: 0.05 * mult, good: 0.1 * mult, ok: 0.18 * mult }; }
  expect(cues) { this.pending.push(...cues); this.pending.sort((a, b) => a.t - b.t); }

  /** Julga um evento de entrada. Devolve o resultado ou null se não houver cue próxima. */
  judge(ev) {
    const t = ev.time - (this.latency[ev.source] ?? 0);
    let best = null, bestAbs = Infinity;
    for (const c of this.pending) {
      if (c.state !== 'pending' || c.midi !== ev.midi) continue;
      const d = t - c.t, a = Math.abs(d);
      if (a <= this.windows.ok && a < bestAbs) { best = c; bestAbs = a; }
    }
    if (!best) {
      // nota errada se houver alguma cue esperada perto deste instante
      const near = this.pending.find((c) => c.state === 'pending' && Math.abs(t - c.t) <= this.windows.ok);
      if (near) { const r = { grade: 'wrong', ev, cue: near, offset: t - near.t }; this.results.push(r); return r; }
      return null;
    }
    const offset = t - best.t, a = Math.abs(offset);
    const grade = a <= this.windows.perfect ? 'perfect' : a <= this.windows.good ? 'good' : 'ok';
    const velOk = !this.checkVelocity || !best.vel || velClass(best.vel) === 'normal' || velClass(best.vel) === velClass(ev.vel);
    const techOk = !this.checkTech || techMatches(best.tech, ev);
    best.state = 'hit';
    const r = { grade, ev, cue: best, offset, velOk, techOk };
    this.results.push(r);
    return r;
  }
  /** Marca como perdidas as cues cujo prazo passou. Devolve as cues perdidas. */
  sweep(now) {
    const missed = [];
    for (const c of this.pending) if (c.state === 'pending' && now - c.t > this.windows.ok) { c.state = 'miss'; missed.push(c); this.results.push({ grade: 'miss', cue: c, offset: null }); }
    this.pending = this.pending.filter((c) => c.state === 'pending');
    return missed;
  }
  /** Duração: compara o note-off com a duração esperada (notas sustentadas). */
  judgeRelease(ev) {
    const r = [...this.results].reverse().find((x) => x.ev?.id === ev.id);
    if (r && r.cue?.dur > 0.4) r.durOk = ev.dur >= r.cue.dur * 0.6;
    return r;
  }
  summary() {
    const hits = this.results.filter((r) => ['perfect', 'good', 'ok'].includes(r.grade));
    const total = this.results.filter((r) => r.grade !== 'wrong').length || 1;
    const offs = hits.map((r) => r.offset);
    const mean = offs.length ? offs.reduce((a, b) => a + b, 0) / offs.length : 0;
    const sd = offs.length ? Math.sqrt(offs.reduce((a, b) => a + (b - mean) ** 2, 0) / offs.length) : 0;
    const count = (g) => this.results.filter((r) => r.grade === g).length;
    const accuracy = hits.length / total;
    const timing = hits.length ? hits.reduce((s, r) => s + (r.grade === 'perfect' ? 1 : r.grade === 'good' ? 0.75 : 0.4), 0) / hits.length : 0;
    const techTotal = hits.filter((r) => r.cue.tech && !['finger', 'normal'].includes(r.cue.tech)).length;
    const techHit = hits.filter((r) => r.cue.tech && !['finger', 'normal'].includes(r.cue.tech) && r.techOk).length;
    return {
      perfect: count('perfect'), good: count('good'), ok: count('ok'), miss: count('miss'), wrong: count('wrong'),
      accuracy, timing, meanOffsetMs: Math.round(mean * 1000), consistencyMs: Math.round(sd * 1000),
      technique: techTotal ? techHit / techTotal : null,
      score: Math.round(accuracy * 700 + timing * 300 - count('wrong') * 5),
      tendency: Math.abs(mean) < 0.02 ? 'no tempo' : mean < 0 ? 'adiantado' : 'atrasado',
    };
  }
  /** Agrupa erros por frase/seção para indicar os trechos mais difíceis. */
  hardestSections(sections) {
    return sections.map((s) => {
      const rs = this.results.filter((r) => r.cue && r.cue.b >= s.from && r.cue.b < s.to);
      const bad = rs.filter((r) => r.grade === 'miss' || r.grade === 'wrong' || r.grade === 'ok').length;
      return { ...s, errors: bad, total: rs.length, rate: rs.length ? bad / rs.length : 0 };
    }).sort((a, b) => b.rate - a.rate);
  }
}
