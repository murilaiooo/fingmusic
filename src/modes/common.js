/**
 * Peças compartilhadas pelos modos: faixa de acordes, acompanhamento
 * automático (jam), arpejador sincronizado e ferramentas da superfície.
 */
import { h, btn, setPressed, segmented } from '../ui/dom.js';
import { toast } from '../ui/sheet.js';
import { diatonicChord, chordLabel, chordNotes, progressionChords, PROGRESSIONS, romanFor } from '../theory/music.js';
import { generateBassline, generateChordTrack, arpSequence, ARP_MODES, BASS_STYLES } from '../theory/assist.js';
import { generateDrums, DRUM_STYLES } from '../studio/patterns.js';
import { newSession, newTrack } from '../studio/session.js';

// ───────────── acordes
export function chordStrip(app, { onChord } = {}) {
  const wrap = h('div.chords', { role: 'group', 'aria-label': 'Acordes da escala' });
  const render = () => {
    const m = app.music;
    wrap.replaceChildren(...Array.from({ length: 7 }, (_, d) => {
      const ch = diatonicChord(d, m.root, m.scale);
      const b = h('button', { type: 'button', title: 'Tecla ' + (d + 1) }, chordLabel(ch, app.settings.noteLetters), h('small', {}, romanFor(d, ch.type)));
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); app.engine.unlock(); playChord(app, ch); b.classList.add('on'); setTimeout(() => b.classList.remove('on'), 220); onChord?.(ch, d); });
      return b;
    }));
  };
  render();
  const off = app.on('music', render);
  wrap.trigger = (d) => { const ch = diatonicChord(d, app.music.root, app.music.scale); app.engine.unlock(); playChord(app, ch); onChord?.(ch, d); };
  wrap.dispose = off;
  return wrap;
}
/** Toca um acorde no instrumento atual (dedilhado rápido nas cordas, bloco nas teclas). */
export function playChord(app, ch, { vel = 0.75 } = {}) {
  app.ensureLiveChannel();
  const inst = app.instrument;
  if (inst.engine === 'drum') return;
  const bass = inst.family === 'bass';
  const base = bass ? 33 : inst.surface === 'keys' ? 55 : 52;
  let notes = chordNotes(ch, base);
  if (bass) notes = [notes[0], notes[0] + 7];
  const strum = inst.surface === 'strings' || inst.surface === 'fretboard' ? 28 : 0;
  notes.forEach((m, i) => {
    const fire = () => {
      const key = app.surface?.keyFor?.(m) ?? null;
      const r = app.performer.noteOn({ midi: m, vel: vel * (1 - i * 0.04), source: 'chord', target: key, dur: inst.surface === 'keys' ? 1.4 : null });
      if (r) { app.lighting.flash({ midi: m, key }, 'hit'); setTimeout(() => app.performer.noteOff(r.ev), 900); }
    };
    if (strum && i) setTimeout(fire, i * strum); else fire();
  });
}

// ───────────── jam automática (bateria + baixo + acordes)
export const JAM_STYLES = {
  funk: { drums: 'funk', prog: 'funk', bass: 'octave', chords: 'stabs' },
  pop: { drums: 'rock', prog: 'pop', bass: 'rootFifth', chords: 'sustain' },
  lofi: { drums: 'lofi', prog: 'lofi', bass: 'root', chords: 'sustain' },
  house: { drums: 'house', prog: 'minorPop', bass: 'syncopated', chords: 'stabs' },
  trap: { drums: 'trap', prog: 'trap', bass: 'slide808', chords: 'sustain' },
  bossa: { drums: 'bossa', prog: 'bossa', bass: 'rootFifth', chords: 'bossa' },
  jazz: { drums: 'jazz', prog: 'jazz', bass: 'walking', chords: 'sustain' },
  baiao: { drums: 'baiao', prog: 'ballad', bass: 'rootFifth', chords: 'stabs' },
};
export const JAM_NAMES = { funk: 'Funk', pop: 'Pop', lofi: 'Lo-fi', house: 'House', trap: 'Trap', bossa: 'Bossa', jazz: 'Jazz', baiao: 'Baião' };

/** Monta uma sessão de estúdio com acompanhamento no tom atual. */
export function buildJamSession(app, styleId = 'pop', { seed = Date.now() % 1000, withChords = true } = {}) {
  const st = JAM_STYLES[styleId] ?? JAM_STYLES.pop, ds = DRUM_STYLES[st.drums];
  const root = app.music.root, chords = progressionChords(st.prog, root);
  const bars = chords.length;
  const s = newSession({ name: `Jam ${JAM_NAMES[styleId] ?? styleId}`, bpm: ds.bpm, bars, key: { root, scale: PROGRESSIONS[st.prog].scale } });
  s.swing = ds.swing ?? 0;
  const kit = ds.kit === 'brazil' ? 'drumsBrazil' : ds.kit === 'electro' ? 'drumsElectro' : 'drumsAcoustic';
  const dr = newTrack(kit, { name: 'Bateria', hue: 30 }); dr.notes = generateDrums(st.drums, bars, { seed }); dr.volume = 0.7;
  const bassInst = styleId === 'trap' ? 'bass808' : styleId === 'house' ? 'synthBass' : styleId === 'funk' ? 'funkBass' : styleId === 'jazz' ? 'fretless' : 'bassFinger';
  const bs = newTrack(bassInst, { name: 'Baixo', hue: 200 }); bs.notes = generateBassline(chords, st.bass, { seed, base: 28 }); bs.volume = 0.75;
  s.tracks.push(dr, bs);
  if (withChords) {
    const keysInst = styleId === 'lofi' ? 'epiano' : styleId === 'house' || styleId === 'trap' ? 'pad' : styleId === 'funk' ? 'electricClean' : 'piano';
    const ck = newTrack(keysInst, { name: 'Acordes', hue: 280 }); ck.notes = generateChordTrack(chords, { base: 55, rhythm: st.chords }); ck.volume = 0.45;
    s.tracks.push(ck);
  }
  s.chords = chords.map((c) => chordLabel(c));
  return s;
}

export class Jam {
  constructor(app) { this.app = app; this.on = false; this.style = 'pop'; }
  start(style = this.style) {
    const app = this.app; app.engine.unlock();
    if (!app.engine.ready) { toast('Toque no instrumento para ativar o som'); return false; }
    this.style = style;
    app.studio.load(buildJamSession(app, style));
    app.transportOwner = 'studio';
    app.studio.play();
    this.on = true;
    toast(`Jam ${JAM_NAMES[style]} em ${app.studio.session.bpm} BPM: ${app.studio.session.chords.join(' · ')}`);
    return true;
  }
  stop() { if (!this.on) return; this.app.studio.stop(); this.on = false; }
  toggle() { if (this.on) this.stop(); else this.start(); return this.on; }
}

// ───────────── arpejador sincronizado ao transporte
export class Arpeggiator {
  constructor(app) {
    this.app = app; this.enabled = false; this.mode = 'up'; this.octaves = 1; this.div = 0.5; this.held = new Map(); this.step = 0; this.latch = true;
    app.transport.addPart(this);
    app.performer.on('noteon', (ev) => { if (!this.enabled || ev.source === 'arp' || ev.source === 'demo') return; if (this.latch && performance.now() - (this.lastIn ?? 0) > 900) this.held.clear(); this.lastIn = performance.now(); this.held.set(ev.midi, ev); });
    app.performer.on('noteoff', (ev) => { if (!this.enabled || this.latch) return; this.held.delete(ev.midi); });
  }
  setEnabled(v) {
    this.enabled = v; this.held.clear();
    const tr = this.app.transport;
    if (v && !tr.playing) { this.app.engine.unlock(); if (this.app.transportOwner !== 'studio' || !tr.playing) this.app.transportOwner = 'arp'; tr.setLoop(0, 0); tr.start(); this.startedTransport = true; }
    if (!v && this.startedTransport && this.app.transportOwner === 'arp') { tr.stop(); this.startedTransport = false; }
  }
  schedule(from, to, toTime) {
    if (!this.enabled || !this.held.size) return;
    const seq = arpSequence([...this.held.keys()], this.mode, this.octaves);
    if (!seq.length) return;
    const ch = this.app.performer.channel; if (!ch) return;
    for (let b = Math.ceil(from / this.div) * this.div; b < to; b += this.div) {
      const k = Math.round(b / this.div);
      const step = this.mode === 'random' ? seq[(k * 7919) % seq.length] : seq[k % seq.length];
      const notes = Array.isArray(step) ? step : [step];
      const when = toTime(b);
      for (const m of notes) {
        ch.play({ midi: m, vel: k % 4 === 0 ? 0.85 : 0.62, when, dur: this.div * 60 / this.app.transport.bpm * 0.9 });
        const key = this.app.surface?.keyFor?.(m) ?? null;
        this.app.lighting.add({ midi: m, key, t: when, dur: 0.12, vel: 0.6, tech: 'finger', demo: true });
      }
    }
  }
  silence() {}
}

export function arpControls(arp) {
  return [
    segmented(Object.entries(ARP_MODES), arp.mode, (v) => { arp.mode = v; }),
    segmented([['1', '1 oit.'], ['2', '2 oit.'], ['3', '3 oit.']], String(arp.octaves), (v) => { arp.octaves = Number(v); }),
    segmented([['1', '1/4'], ['0.5', '1/8'], ['0.25', '1/16'], ['0.3333', 'tercina']], String(arp.div), (v) => { arp.div = Number(v); }),
  ];
}

// ───────────── ferramentas da superfície (dependem do tipo de instrumento)
export function surfaceTools(app) {
  const s = app.surface, kind = s?.constructor?.name;
  const out = [];
  const hold = (label, key, title) => {
    const b = h('button.btn.small', { type: 'button', title, 'aria-pressed': 'false' }, label);
    const set = (v) => { s.mods[key] = v; setPressed(b, v); };
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); set(true); });
    b.addEventListener('pointerup', () => set(false)); b.addEventListener('pointercancel', () => set(false)); b.addEventListener('pointerleave', () => set(false));
    b.addEventListener('dblclick', () => set(!s.mods[key]));
    return b;
  };
  if (kind === 'FretboardSurface') {
    out.push(hold('Abafar', 'mute', 'Segure para palm mute'), hold('Harm.', 'harm', 'Segure para harmônicos'));
    const tap = btn('Tap', () => { s.mods.tap = !s.mods.tap; setPressed(tap, s.mods.tap); }, { cls: 'small', title: 'Tapping: tocar só pressionando o braço' });
    const pos = h('span.pill', {}, '');
    const upd = () => { pos.innerHTML = `casa <b>${s.position}</b>`; };
    out.push(tap, btn(null, () => { s.shiftPosition(-1); upd(); }, { icon: 'minus', cls: 'small icon-only', title: 'Posição mais grave' }), pos, btn(null, () => { s.shiftPosition(1); upd(); }, { icon: 'plus', cls: 'small icon-only', title: 'Posição mais aguda' }));
    upd();
  } else if (kind === 'KeysSurface') {
    const lbl = h('span.pill', {}, '');
    const upd = () => { lbl.innerHTML = `oitava <b>${s.octaveShift >= 0 ? '+' : ''}${s.octaveShift}</b>`; };
    out.push(btn(null, () => { s.shiftOctave(-1); upd(); }, { icon: 'minus', cls: 'small icon-only', title: 'Oitava abaixo (Z)' }), lbl, btn(null, () => { s.shiftOctave(1); upd(); }, { icon: 'plus', cls: 'small icon-only', title: 'Oitava acima (X)' }));
    upd();
  } else if (kind === 'PadsSurface') {
    const rep = btn('Repetir notas', () => { s.repeat = !s.repeat; setPressed(rep, s.repeat); if (s.repeat && !app.transport.playing) toast('Repetição sincroniza com o metrônomo/jam'); }, { icon: 'repeat', cls: 'small' });
    out.push(rep, segmented([['0.5', '1/8'], ['0.25', '1/16'], ['0.125', '1/32']], String(s.repeatDiv), (v) => { s.repeatDiv = Number(v); }));
  }
  return out;
}

export const JAM_BASS_STYLES = BASS_STYLES;
