/**
 * LightingEngine: o próprio instrumento indica onde, quando, quanto tempo,
 * com que força e com qual técnica tocar. Usado pelo Follow the Lights,
 * pelas demonstrações do Genius e pelos tutoriais.
 *
 * Uma "cue" é uma indicação luminosa ancorada no relógio de áudio:
 *  { id, midi, key?, t, dur, vel, tech, state, hidden, demo, order }
 * As superfícies consultam stateFor(midi|key, agora) a cada quadro; como o
 * tempo vem de ctx.currentTime, a luz fica sincronizada mesmo se o FPS cair.
 */
export const TECH_GLYPH = {
  finger: 'dot', pick: 'dot', normal: 'dot', soft: 'ring-small', hard: 'burst', pull: 'arrow-out', snap: 'arrow-out',
  slap: 'bar', pop: 'hook', sustain: 'line', vibrato: 'wave', slide: 'arrow-along', bend: 'arc', chord: 'dot',
  mute: 'cross', harmonic: 'diamond', tremolo: 'dots', hammer: 'chevron', ghost: 'ring-small',
};
export const TECH_LABEL = {
  finger: 'Toque', pick: 'Palheta', soft: 'Suave', hard: 'Forte', pull: 'Puxar e soltar', snap: 'Puxar e soltar', slap: 'Slap', pop: 'Pop',
  sustain: 'Sustentar', vibrato: 'Vibrato', slide: 'Slide', bend: 'Bend', chord: 'Acorde', mute: 'Abafado', harmonic: 'Harmônico',
  tremolo: 'Tremolo', hammer: 'Hammer-on', ghost: 'Ghost note',
};

let cueSeq = 0;
export class Lighting {
  constructor(clock) {
    this.clock = clock; // () => tempo de áudio
    this.cues = [];
    this.anticipation = 1.2; // segundos de brilho progressivo antes da nota
    this.reduceFlashes = false;
    this.highContrast = false;
    this.showShapes = true;
    this.enabled = true;
    this.flashes = []; // feedbacks curtos (acerto/erro) por elemento
  }
  clear() { this.cues = []; this.flashes = []; }
  add(c) { const cue = { id: ++cueSeq, dur: 0.25, vel: 0.7, tech: 'finger', state: 'pending', hidden: false, demo: false, ...c }; this.cues.push(cue); return cue; }
  addMany(list) { return list.map((c) => this.add(c)); }
  remove(cue) { this.cues = this.cues.filter((c) => c !== cue); }
  prune(now = this.clock()) { this.cues = this.cues.filter((c) => (c.waiting && c.state === 'pending') || c.t + c.dur + 1.2 > now); this.flashes = this.flashes.filter((f) => f.t + 0.8 > now); }
  mark(cue, state, extra = {}) { if (!cue) return; cue.state = state; Object.assign(cue, extra); cue.markedAt = this.clock(); }
  flash(match, kind, now = this.clock()) { this.flashes.push({ ...match, kind, t: now }); }

  /** Estado agregado de luz para um elemento (por midi e/ou chave do elemento). */
  stateFor(midi, key = null, now = this.clock()) {
    if (!this.enabled) return null;
    let best = null;
    for (const c of this.cues) {
      if (c.hidden && c.state === 'pending') continue;
      if (c.key ? c.key !== key : c.midi !== midi) continue;
      const dt = c.t - now; // >0: futuro
      const end = c.t + c.dur;
      let s = null;
      if (c.state === 'hit' && now - c.markedAt < 0.6) s = { phase: 'hit', k: 1 - (now - c.markedAt) / 0.6 };
      else if (c.state === 'miss' && now - c.markedAt < 0.9) s = { phase: 'miss', k: 1 - (now - c.markedAt) / 0.9 };
      else if (dt > 0 && dt <= this.anticipation) s = { phase: 'anticipate', k: 1 - dt / this.anticipation };
      else if (dt <= 0 && now <= end && c.state !== 'miss') s = { phase: now - c.t < 0.14 ? 'pulse' : 'sustain', k: c.dur > 0 ? (now - c.t) / c.dur : 1 };
      else if (c.waiting && c.state === 'pending') s = { phase: 'wait', k: 1 };
      if (!s) continue;
      // modo memória: a luz aparece e some antes do momento de tocar
      if (c.memory && c.state === 'pending' && ((s.phase === 'anticipate' && s.k > 0.55) || s.phase === 'pulse' || s.phase === 'sustain')) continue;
      s.cue = c;
      const prio = { pulse: 6, hit: 5, miss: 4, sustain: 3, wait: 3, anticipate: 2 }[s.phase] + (s.phase === 'anticipate' ? s.k : 0);
      if (!best || prio > best.prio) { best = s; best.prio = prio; }
    }
    for (const f of this.flashes) {
      if ((f.key && f.key === key) || (!f.key && f.midi === midi)) {
        const k = 1 - (now - f.t) / 0.8;
        if (k > 0 && (!best || best.prio < 4)) best = { phase: f.kind, k, prio: 4, cue: null };
      }
    }
    return best;
  }

  /** Próxima indicação pendente (para a animação de transição). */
  next(now = this.clock()) {
    let n = null;
    for (const c of this.cues) if (c.state === 'pending' && !c.hidden && (c.t + c.dur >= now || c.waiting) && (!n || c.t < n.t)) n = c;
    return n;
  }
}
